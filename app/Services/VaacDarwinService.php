<?php

namespace App\Services;

use App\Models\Volcano;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

class VaacDarwinService
{
    private const VAAC_URL = 'https://www.bom.gov.au/aviation/warnings/volcanic-ash/';

    private const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';

    private const CACHE_KEY = 'vaac:darwin:advisories';

    private const CACHE_TTL = 600;

    /**
     * Volcano name aliases (mirrors python name_aliases.py).
     *
     * @var array<string, string>
     */
    private const NAME_ALIASES = [
        'anak krakatau' => 'Gunung Anak Krakatau',
        'gunung anak krakatau' => 'Gunung Anak Krakatau',
        'krakatau' => 'Gunung Anak Krakatau',
        'gunung krakatau' => 'Gunung Anak Krakatau',
        'kelud' => 'Gunung Kelud',
        'merapi' => 'Gunung Merapi',
        'semeru' => 'Gunung Semeru',
        'bromo' => 'Gunung Bromo',
        'agung' => 'Gunung Agung',
        'batur' => 'Gunung Batur',
        'rinjani' => 'Gunung Rinjani',
        'soputan' => 'Gunung Soputan',
        'karangetang' => 'Gunung Karangetang',
        'sinabung' => 'Gunung Sinabung',
        'raung' => 'Gunung Raung',
        'ijen' => 'Gunung Ijen',
        'merapi jawa tengah' => 'Gunung Merapi',
        'merapi diy' => 'Gunung Merapi',
        'slamet' => 'Gunung Slamet',
        'galunggung' => 'Gunung Galunggung',
        'papandayan' => 'Gunung Papandayan',
        'guntur' => 'Gunung Guntur',
        'ciremai' => 'Gunung Ciremai',
        'ceremai' => 'Gunung Ciremai',
        'tangkuban parahu' => 'Gunung Tangkuban Parahu',
        'tangkubanparahu' => 'Gunung Tangkuban Parahu',
        'salak' => 'Gunung Salak',
        'gede' => 'Gunung Gede',
        'pancar' => 'Gunung Pancar',
        'kelimutu' => 'Gunung Kelimutu',
        'ewon' => 'Gunung Ewon',
        'lewotobi' => 'Gunung Lewotobi',
        'lewotolo' => 'Gunung Lewotolo',
        'lewotolok' => 'Ili Lewotolok',
        'leroboleng' => 'Gunung Leroboleng',
        'batutara' => 'Gunung Batutara',
        'ile werung' => 'Gunung Ile Werung',
        'ile mandiri' => 'Gunung Ile Mandiri',
        'iya' => 'Gunung Iya',
        'sumbing' => 'Gunung Sumbing',
        'sindoro' => 'Gunung Sindoro',
        'dieng' => 'Gunung Dieng',
        'kaba' => 'Gunung Kaba',
        'dempo' => 'Gunung Dempo',
        'kerinci' => 'Gunung Kerinci',
        'talang' => 'Gunung Talang',
        'marapi' => 'Gunung Marapi',
        'singgalang' => 'Gunung Singgalang',
        'tandikat' => 'Gunung Tandikat',
        'sibayak' => 'Gunung Sibayak',
        'sibualbuali' => 'Gunung Sibualbuali',
        'lubukraya' => 'Gunung Lubuk Raya',
        'sorik merapi' => 'Gunung Sorik Merapi',
        'talamau' => 'Gunung Talamau',
        'gadang' => 'Gunung Gadang',
        'sago' => 'Gunung Sago',
        'pasaman' => 'Gunung Pasaman',
        'tandai' => 'Gunung Tandai',
    ];

    /**
     * Get all live advisories from VAAC Darwin, matched to volcano IDs.
     *
     * @return array<int, array<string, mixed>>
     */
    public function getLiveAdvisories(): array
    {
        $raw = Cache::remember(self::CACHE_KEY, self::CACHE_TTL, function () {

            return $this->toCacheSafe($this->fetchAndParse());
        });

        $advisories = $this->fromCacheSafe($raw);

        return $this->matchToVolcanoes($advisories);
    }

    /**
     * Convert DateTime fields to strings for the cache.
     *
     * @param  array<int, array<string, mixed>>  $advisories
     * @return array<int, array<string, mixed>>
     */
    private function toCacheSafe(array $advisories): array
    {
        return array_map(function (array $advisory): array {
            foreach (['issued_at', 'observed_at', 'next_advisory_at'] as $key) {
                $value = $advisory[$key] ?? null;

                if ($value instanceof \DateTimeInterface) {
                    $advisory[$key] = $value->format('Y-m-d H:i:s');
                }
            }

            return $advisory;
        }, $advisories);
    }

    /**
     * Rehydrate string dates back to DateTimeImmutable.
     *
     * @param  array<int, array<string, mixed>>  $advisories
     * @return array<int, array<string, mixed>>
     */
    private function fromCacheSafe(array $advisories): array
    {
        return array_map(function (array $advisory): array {
            foreach (['issued_at', 'observed_at', 'next_advisory_at'] as $key) {
                $value = $advisory[$key] ?? null;

                if (is_string($value) && $value !== '') {
                    $advisory[$key] = new \DateTimeImmutable($value);
                }
            }

            return $advisory;
        }, $advisories);
    }

    /**
     * Get the latest advisory for a specific volcano (live).
     *
     * @return array<string, mixed>|null
     */
    public function getLatestForVolcano(int $volcanoId): ?array
    {
        $advisories = $this->getLiveAdvisories();

        foreach ($advisories as $advisory) {
            if (($advisory['volcano_id'] ?? null) === $volcanoId) {
                return $advisory;
            }
        }

        return null;
    }

    /**
     * Get volcano IDs that have active ash advisories (< 24h, ash_detected).
     *
     * @return Collection<int, int>
     */
    public function getActiveAshVolcanoIds(): Collection
    {
        $advisories = $this->getLiveAdvisories();
        $since = now()->subHours(24);

        $active = collect($advisories)
            ->filter(function (array $a) use ($since): bool {
                if (! ($a['ash_detected'] ?? false)) {
                    return false;
                }

                $issued = $a['issued_at'] ?? null;

                if (! $issued instanceof \DateTimeImmutable) {
                    return false;
                }

                return $issued->getTimestamp() >= $since->getTimestamp();
            })
            ->pluck('volcano_id')
            ->unique();

        return $active;
    }

    /**
     * Fetch BOM page, parse HTML, extract advisory blocks.
     *
     * @return array<int, array<string, mixed>>
     */
    private function fetchAndParse(): array
    {
        try {
            $response = Http::withHeaders([
                'User-Agent' => self::USER_AGENT,
                'Accept' => 'text/html,application/xhtml+xml',
            ])
                ->timeout(30)
                ->get(self::VAAC_URL);

            if ($response->failed()) {
                return [];
            }

            $html = $response->body();
            $text = $this->htmlToPlainText($html);
            $blocks = $this->splitDarwinAdvisories($text);

            $advisories = [];

            foreach ($blocks as $block) {
                $parsed = $this->parseAdvisory($block);

                if ($parsed !== null && ($parsed['issued_at'] ?? null) !== null) {
                    $advisories[] = $parsed;
                }
            }

            return $advisories;
        } catch (\Throwable $e) {
            report($e);

            return [];
        }
    }

    private function htmlToPlainText(string $html): string
    {
        $text = preg_replace('#<script\b[^>]*>.*?</script>#is', ' ', $html);
        $text = preg_replace('#<style\b[^>]*>.*?</style>#is', ' ', $text);
        $text = preg_replace('/<br\s*\/?>/i', ' ', $text);

        $text = strip_tags($text);
        $text = html_entity_decode($text, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $text = preg_replace('/\s+/', ' ', $text);

        return trim($text);
    }

    private function getDarwin24hSection(string $text): ?string
    {
        $marker = 'FROM DARWIN VAAC - LAST 24 HOURS';
        $start = strpos($text, $marker);

        if ($start === false) {
            return null;
        }

        $section = substr($text, $start);

        $nextMarker = strpos($section, '- LAST 24 HOURS', strlen($marker));

        if ($nextMarker !== false) {
            $section = substr($section, 0, $nextMarker);
        }

        return $section;
    }

    /**
     * Split Darwin section into individual advisory blocks.
     *
     * @return list<string>
     */
    private function splitDarwinAdvisories(string $text): array
    {
        $section = $this->getDarwin24hSection($text);

        if ($section === null) {
            return [];
        }

        $parts = explode('Received FVAU', $section);
        $blocks = [];

        for ($i = 1, $len = count($parts); $i < $len; $i++) {
            $end = strpos($parts[$i], '=');
            $block = $end === false ? $parts[$i] : substr($parts[$i], 0, $end);
            $block = trim($block);

            if ($block !== '' && str_contains($block, 'VAAC: DARWIN')) {
                $blocks[] = $block;
            }
        }

        return $blocks;
    }

    /**
     * Parse a single advisory block into structured data.
     *
     * @return array<string, mixed>|null
     */
    private function parseAdvisory(string $block): ?array
    {
        $issuedUtc = $this->parseAdvisoryDtg($block);

        if ($issuedUtc === null) {
            return null;
        }

        $volcanoName = null;
        $volcanoCode = null;

        if (preg_match('/VOLCANO:\s*(.+?)\s+(\d{6,7})\b/', $block, $m)) {
            $volcanoName = trim($m[1]);
            $volcanoCode = $m[2];
        }

        $psn = null;

        if (preg_match('/PSN:\s*([NSEW]\d{4})\s+([NSEW]\d{5})/', $block, $m)) {
            $psn = trim(str_replace('PSN:', '', $m[0]));
        }

        $advisoryNr = null;

        if (preg_match('/ADVISORY NR:\s*([\d\/]+)/', $block, $m)) {
            $advisoryNr = $m[1];
        }

        $eruptionDetail = null;

        if (preg_match('/ERUPTION DETAILS:\s*(.+?)(?=\s*(?:OBS|EST) VA DTG:)/', $block, $m)) {
            $eruptionDetail = trim($m[1]);
        }

        $observedUtc = $this->parseObsDtg($block, $issuedUtc);

        $vaCld = null;

        if (preg_match('/(?:OBS|EST) VA CLD:\s*(.+?)(?=\s*FCST VA CLD)/', $block, $m)) {
            $vaCld = trim($m[1]);
        }

        [$ashDetected, $altitudeFt, $movement, $speedKts] = $this->extractVaCloudInfo($vaCld);
        $geometry = $this->extractVaCloudGeometry($vaCld);
        $fcstGeometries = $this->extractFcstVaCloudGeometries($block);

        $remarks = null;

        if (preg_match('/RMK:\s*(.+?)(?=\s*NXT ADVISORY)/', $block, $m)) {
            $remarks = trim($m[1]);
        }

        $nextUtc = $this->parseNextAdvisory($block, $issuedUtc);

        $issuedWib = (clone $issuedUtc)->modify('+7 hours');
        $observedWib = $observedUtc !== null
            ? (clone $observedUtc)->modify('+7 hours')
            : null;
        $nextWib = $nextUtc !== null
            ? (clone $nextUtc)->modify('+7 hours')
            : null;

        $altitudeM = $altitudeFt !== null
            ? round($altitudeFt * 0.3048, 2)
            : null;

        return [
            'source' => 'VAAC Darwin',
            'advisory_nr' => $advisoryNr,
            'issued_at' => $issuedWib,
            'observed_at' => $observedWib,
            'next_advisory_at' => $nextWib,
            'volcano_code' => $volcanoCode,
            'volcano_name' => $volcanoName,
            'psn' => $psn,
            'ash_detected' => $ashDetected,
            'altitude_ft' => $altitudeFt,
            'ash_height_m' => $altitudeM,
            'movement' => $movement,
            'speed_kts' => $speedKts,
            'geometry' => $geometry,
            'fcst_geometries' => $fcstGeometries,
            'eruption_detail' => $eruptionDetail,
            'remarks' => $remarks,
            'raw_text' => $block,
        ];
    }

    private function parseAdvisoryDtg(string $raw): ?\DateTimeImmutable
    {
        if (! preg_match('/DTG:\s*(\d{8})\/(\d{4})Z/', $raw, $m)) {
            return null;
        }

        try {
            return new \DateTimeImmutable("{$m[1]} {$m[2]} +0000", new \DateTimeZone('UTC'));
        } catch (\Throwable) {
            return null;
        }
    }

    private function parseObsDtg(string $raw, \DateTimeImmutable $issuedUtc): ?\DateTimeImmutable
    {
        if (! preg_match('/(?:OBS|EST) VA DTG:\s*(\d{2})\/(\d{4})Z/', $raw, $m)) {
            return null;
        }

        try {
            $day = (int) $m[1];
            $hour = (int) substr($m[2], 0, 2);
            $minute = (int) substr($m[2], 2, 2);

            $year = (int) $issuedUtc->format('Y');
            $month = (int) $issuedUtc->format('n');
            $issuedDay = (int) $issuedUtc->format('j');

            if ($day > $issuedDay + 15) {
                $month--;
                if ($month < 1) {
                    $month = 12;
                    $year--;
                }
            } elseif ($day < $issuedDay - 15) {
                $month++;
                if ($month > 12) {
                    $month = 1;
                    $year++;
                }
            }

            return new \DateTimeImmutable(
                sprintf('%04d-%02d-%02d %02d:%02d:00', $year, $month, $day, $hour, $minute),
                new \DateTimeZone('UTC'),
            );
        } catch (\Throwable) {
            return null;
        }
    }

    private function parseNextAdvisory(string $raw, \DateTimeImmutable $issuedUtc): ?\DateTimeImmutable
    {
        if (! preg_match('/NXT ADVISORY:\s*(.+?)\s*$/m', $raw, $m)) {
            return null;
        }

        $value = trim($m[1]);

        if (str_contains(strtoupper($value), 'NO FURTHER')) {
            return null;
        }

        if (! preg_match('/(\d{8})\/(\d{4})Z/', $value, $dtg)) {
            return null;
        }

        try {
            return new \DateTimeImmutable("{$dtg[1]} {$dtg[2]} +0000", new \DateTimeZone('UTC'));
        } catch (\Throwable) {
            return null;
        }
    }

    /**
     * Extract ash detection info from OBS/EST VA CLD text.
     *
     * @return array{0: bool, 1: int|null, 2: string|null, 3: int|null}
     */
    private function extractVaCloudInfo(?string $vaCld): array
    {
        $ashDetected = false;
        $altitudeFt = null;
        $movement = null;
        $speedKts = null;

        if ($vaCld === null) {
            return [$ashDetected, $altitudeFt, $movement, $speedKts];
        }

        $upper = strtoupper($vaCld);

        if (! str_contains($upper, 'NOT IDENTIFIABLE') && str_contains($upper, 'SFC/')) {
            $ashDetected = true;

            if (preg_match('/(?:SFC\/)?FL(\d{3})/', $upper, $m)) {
                $altitudeFt = (int) $m[1] * 100;
            }

            if (preg_match('/MOV\s+([NSEW]{1,3})(?:\s+(\d{1,3})\s*KT)?/', $upper, $m)) {
                $movement = $m[1];

                if (isset($m[2])) {
                    $speedKts = (int) $m[2];
                }
            }
        }

        return [$ashDetected, $altitudeFt, $movement, $speedKts];
    }

    /**
     * Convert OBS/EST VA CLD polygon string to GeoJSON Polygon.
     *
     * Format: `S0601 E10552 - S0636 E10513 - ...`
     *
     * @return array<string, mixed>|null
     */
    private function extractVaCloudGeometry(?string $vaCld): ?array
    {
        if ($vaCld === null) {
            return null;
        }

        $upper = strtoupper($vaCld);

        if (str_contains($upper, 'NOT IDENTIFIABLE') || str_contains($upper, 'NO VA')) {
            return null;
        }

        $tokens = [];
        preg_match_all('/([NSEW])(\d{3,5})/', $upper, $tokens, PREG_SET_ORDER);

        $points = [];

        for ($i = 0, $len = count($tokens); $i < $len - 1; $i += 2) {
            $lat = $this->azimuthToDecimal($tokens[$i][1], $tokens[$i][2]);
            $lng = $this->azimuthToDecimal($tokens[$i + 1][1], $tokens[$i + 1][2]);
            $points[] = [$lng, $lat];
        }

        if (count($points) < 3) {
            return null;
        }

        if ($points[0] !== $points[count($points) - 1]) {
            $points[] = $points[0];
        }

        return [
            'type' => 'Polygon',
            'coordinates' => [$points],
        ];
    }

    private function azimuthToDecimal(string $letter, string $digits): float
    {
        $degreesLen = strlen($digits) - 2;
        $value = (int) substr($digits, 0, $degreesLen)
            + (int) substr($digits, $degreesLen) / 60.0;

        return in_array($letter, ['S', 'W'], true) ? -$value : $value;
    }

    /**
     * Extract FCST VA CLD +N HR geometries.
     *
     * @return array<int, array<string, mixed>>
     */
    private function extractFcstVaCloudGeometries(string $block): array
    {
        $geometries = [];

        $pattern = '/FCST VA CLD \+(\d+) HR:\s*(?:[\d\/]+Z)?\s*(.+?)(?=\s*(?:FCST VA CLD \+\d+ HR:|RMK:|NXT ADVISORY))/s';

        if (preg_match_all($pattern, $block, $matches, PREG_SET_ORDER)) {
            foreach ($matches as $match) {
                $hour = (string) (int) $match[1];
                $geometry = $this->extractVaCloudGeometry(trim($match[2]));

                if ($geometry !== null) {
                    $geometries[$hour] = $geometry;
                }
            }
        }

        return $geometries;
    }

    /**
     * Match parsed advisory volcano names to database volcano IDs.
     *
     * @param  array<int, array<string, mixed>>  $advisories
     * @return array<int, array<string, mixed>>
     */
    private function matchToVolcanoes(array $advisories): array
    {
        $volcanoes = Volcano::all(['id', 'name']);
        $result = [];

        foreach ($advisories as $advisory) {
            $volcanoId = $this->resolveVolcanoId(
                $advisory['volcano_name'] ?? '',
                $volcanoes,
            );

            if ($volcanoId !== null) {
                $advisory['volcano_id'] = $volcanoId;
                $result[] = $advisory;
            }
        }

        return $result;
    }

    /**
     * Resolve a VAAC advisory volcano name to a database volcano ID.
     *
     * @param  \Illuminate\Database\Eloquent\Collection<int, Volcano>  $volcanoes
     */
    private function resolveVolcanoId(string $advisoryName, \Illuminate\Database\Eloquent\Collection $volcanoes): ?int
    {
        $candidates = $this->volcanoMatchCandidates($advisoryName);

        foreach ($candidates as $candidate) {
            $match = $volcanoes->first(
                fn (Volcano $v): bool => strcasecmp($v->name, $candidate) === 0,
            );

            if ($match !== null) {
                /** @var int */
                return $match->id;
            }
        }

        $base = strtolower(preg_replace('/\s+/', ' ', trim($advisoryName)));

        $match = $volcanoes->first(
            fn (Volcano $v): bool => str_contains(strtolower($v->name), $base),
        );

        if ($match !== null) {
            /** @var int */
            return $match->id;
        }

        return null;
    }

    /**
     * Generate candidate names for volcano matching.
     *
     * @return list<string>
     */
    private function volcanoMatchCandidates(string $name): array
    {
        $clean = preg_replace('/\s+/', ' ', trim($name));
        $normalized = self::NAME_ALIASES[strtolower($clean)] ?? $clean;

        $candidates = [];
        $seen = [];

        $push = function (string $value) use (&$candidates, &$seen): void {
            $value = preg_replace('/\s+/', ' ', trim($value));

            if ($value !== '' && ! in_array(strtolower($value), $seen, true)) {
                $candidates[] = $value;
                $seen[] = strtolower($value);
            }
        };

        $push($clean);
        $push($normalized);

        if (! str_starts_with(strtolower($clean), 'gunung ')) {
            $push("Gunung {$clean}");
        }

        if (str_starts_with(strtolower($clean), 'gunung ')) {
            $base = preg_replace('/^gunung\s+/i', '', $clean);
            $push($base);
        }

        return $candidates;
    }
}
