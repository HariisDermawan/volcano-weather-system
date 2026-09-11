<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

/**
 * Real-time MAGMA Indonesia volcano status & eruption events.
 *
 * Fetches directly from magma.esdm.go.id on each request (cached 3 minutes)
 * so the frontend gets fresh PVMBG status and eruption data without
 * waiting for the Python scheduler.
 *
 * Sources:
 * - Levels:      /v1/gunung-api/tingkat-aktivitas (volcano list by level)
 * - Eruptions:   /v1/gunung-api/informasi-letusan  (newest eruption events)
 */
class MagmaService
{
    private const LEVELS_URL = 'https://magma.esdm.go.id/v1/gunung-api/tingkat-aktivitas';

    private const ERUPTIONS_URL = 'https://magma.esdm.go.id/v1/gunung-api/informasi-letusan';

    private const MAP_URL = 'https://magma.esdm.go.id/v1';

    private const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';

    private const LEVELS_CACHE_KEY = 'magma:levels';

    private const ERUPTIONS_CACHE_KEY = 'magma:eruptions';

    private const ERUPT_CACHE_KEY = 'magma:erupt';

    private const CACHE_TTL = 180; // 3 minutes

    /**
     * All volcano statuses by normalized name.
     *
     * @return array<string, array<string, string>>
     */
    public function getStatuses(): array
    {
        $statuses = [];

        foreach ($this->getLiveLevels() as $level) {
            $key = $this->normalizeName($level['name'] ?? '');
            $statuses[$key] = $level;
        }

        return $statuses;
    }

    /**
     * Live status for a volcano matched by name.
     *
     * @return array<string, string>|null
     */
    public function getStatusForVolcano(string $volcanoName): ?array
    {
        $key = $this->normalizeName($volcanoName);

        if ($key === '') {
            return null;
        }

        return $this->getStatuses()[$key] ?? null;
    }

    /**
     * Latest eruption events, newest first.
     *
     * @return list<array<string, mixed>>
     */
    public function getEruptions(): array
    {
        $raw = Cache::remember(self::ERUPTIONS_CACHE_KEY, self::CACHE_TTL, function () {
            return $this->toCacheSafe($this->fetchEruptions());
        });

        return $this->fromCacheSafe($raw);
    }

    /**
     * Latest eruption event for a volcano matched by name.
     *
     * @return array<string, mixed>|null
     */
    public function getLatestEruptionForVolcano(string $volcanoName): ?array
    {
        $key = $this->normalizeName($volcanoName);

        foreach ($this->getEruptions() as $eruption) {
            if ($this->normalizeName($eruption['name'] ?? '') === $key) {
                return $eruption;
            }
        }

        return null;
    }

    /**
     * Names of volcanoes currently erupting per MAGMA Indonesia.
     *
     * Flag `erupt_icon` pada halaman peta /v1 menandai gunung yang
     * sedang bererupsi (berbeda dari sekadar level status). Dikembalikan
     * sebagai nama ternormalisasi agar mudah dicocokkan ke database.
     *
     * @return list<string>
     */
    public function getEruptingVolcanoNames(): array
    {
        return Cache::remember(self::ERUPT_CACHE_KEY, self::CACHE_TTL, function () {
            return $this->fetchEruptingVolcanoNames();
        });
    }

    /**
     * Scrape flag `erupt_icon` dari array `markersGunungApi` di peta /v1.
     *
     * @return list<string>
     */
    private function fetchEruptingVolcanoNames(): array
    {
        try {
            $response = Http::withHeaders([
                'User-Agent' => self::USER_AGENT,
                'Accept' => 'text/html,application/xhtml+xml',
            ])
                ->timeout(25)
                ->get(self::MAP_URL);

            if ($response->failed()) {
                return [];
            }

            $html = $response->body();
            $names = [];
            $matches = [];

            if (! preg_match_all('/"ga_nama_gapi":"([^"]+)".{0,400}?"erupt_icon":(true|false)/', $html, $matches, PREG_SET_ORDER)) {
                return [];
            }

            foreach ($matches as $match) {
                if ($match[2] === 'true') {
                    $names[] = $this->normalizeName($match[1]);
                }
            }

            return $names;
        } catch (\Throwable $e) {
            report($e);

            return [];
        }
    }

    /**
     * Get live volcano levels from MAGMA.
     *
     * @return list<array<string, string>>
     */
    private function getLiveLevels(): array
    {
        return Cache::remember(self::LEVELS_CACHE_KEY, self::CACHE_TTL, function () {
            return $this->fetchLevels();
        });
    }

    /**
     * Parse the levels page into per-volcano status entries.
     *
     * @return list<array<string, string>>
     */
    private function fetchLevels(): array
    {
        try {
            $response = Http::withHeaders([
                'User-Agent' => self::USER_AGENT,
                'Accept' => 'text/html,application/xhtml+xml',
            ])
                ->timeout(25)
                ->get(self::LEVELS_URL);

            if ($response->failed()) {
                return [];
            }

            $html = $response->body();
            $result = [];
            $current = null;

            if (! preg_match_all('/<tr>(.*?)<\/tr>/is', $html, $rows)) {
                return [];
            }

            foreach ($rows[1] as $row) {
                if (str_contains($row, '<th')) {
                    continue;
                }

                if (preg_match('/Level (IV|III|II|I)\s*\(([^)]+)\)/', $row, $m)) {
                    $current = [$m[1], trim($m[2])];

                    continue;
                }

                if ($current === null || preg_match('/<td>(.*?)<\/td>/is', $row, $cell) !== 1) {
                    continue;
                }

                $inner = preg_replace('/<a\b[^>]*>.*?<\/a>/is', ' ', $cell[1]);
                $text = preg_replace('/\s+/', ' ', html_entity_decode(
                    trim(strip_tags((string) $inner)),
                    ENT_QUOTES | ENT_HTML5,
                    'UTF-8',
                ));

                if (! preg_match('/^(.+?)\s+-\s+(.+)$/', $text, $nm)) {
                    continue;
                }

                $result[] = [
                    'name' => trim($nm[1]),
                    'province' => trim($nm[2]),
                    'level' => $current[0],
                    'status' => $current[1],
                    'label' => "Level {$current[0]} - {$current[1]}",
                ];
            }

            return $result;
        } catch (\Throwable $e) {
            report($e);

            return [];
        }
    }

    /**
     * Parse the eruption info page into events, newest first.
     *
     * @return list<array<string, mixed>>
     */
    private function fetchEruptions(): array
    {
        try {
            $response = Http::withHeaders([
                'User-Agent' => self::USER_AGENT,
                'Accept' => 'text/html,application/xhtml+xml',
            ])
                ->timeout(25)
                ->get(self::ERUPTIONS_URL);

            if ($response->failed()) {
                return [];
            }

            $html = $response->body();
            $result = [];

            $chunks = explode('<div class="timeline-item">', $html);
            array_shift($chunks); // drop preamble

            foreach ($chunks as $chunk) {
                $eruption = $this->parseEruptionChunk($chunk);

                if ($eruption !== null) {
                    $result[] = $eruption;
                }
            }

            return $result;
        } catch (\Throwable $e) {
            report($e);

            return [];
        }
    }

    /**
     * Parse one `.timeline-item` chunk into an eruption event.
     *
     * @return array<string, mixed>|null
     */
    private function parseEruptionChunk(string $chunk): ?array
    {
        if (! preg_match('/<p class="timeline-title"><a href="#">([^<]+)<\/a><\/p>/', $chunk, $title)) {
            return null;
        }

        if (! preg_match('/<p class="timeline-text">\s*(.*?)\s*<\/p>/is', $chunk, $text)) {
            return null;
        }

        $description = preg_replace('/\s+/', ' ', html_entity_decode(
            trim(strip_tags($text[1])),
            ENT_QUOTES | ENT_HTML5,
            'UTF-8',
        ));

        $occurredAt = $this->parseOccurredAt($description);

        return [
            'name' => trim(html_entity_decode($title[1], ENT_QUOTES | ENT_HTML5, 'UTF-8')),
            'occurred_at' => $occurredAt,
            'ash_height' => $this->extractAshHeight($description),
            'description' => $description !== '' ? $description : null,
        ];
    }

    /**
     * Extract eruption occurrence time from the event description.
     *
     * Format: `pukul 16:24 WIT`, date `23 Agustus 2026` -> DateTime UTC.
     */
    private function parseOccurredAt(string $description): ?\DateTimeImmutable
    {
        if (! preg_match('/pukul (\d{1,2}):(\d{2})\s*(WIB|WITA|WIT)/', $description, $t)) {
            return null;
        }

        if (! preg_match('/pada hari\s+[^,]+,?\s+(\d{1,2})\s+(\p{L}+)\s+(\d{4})/u', $description, $d)) {
            return null;
        }

        $months = [
            'Januari' => 1,
            'Februari' => 2,
            'Maret' => 3,
            'April' => 4,
            'Mei' => 5,
            'Juni' => 6,
            'Juli' => 7,
            'Agustus' => 8,
            'September' => 9,
            'Oktober' => 10,
            'November' => 11,
            'Desember' => 12,
        ];

        $month = $months[$d[2]] ?? null;

        if ($month === null) {
            return null;
        }

        $offsets = ['WIB' => 7, 'WITA' => 8, 'WIT' => 9];
        $offset = $offsets[$t[3]];

        try {
            $utc = new \DateTimeImmutable(
                sprintf('%04d-%02d-%02d %02d:%02d',
                    (int) $d[3],
                    $month,
                    (int) $d[1],
                    (int) $t[1],
                    (int) $t[2],
                ),
                new \DateTimeZone('UTC'),
            );

            return $utc->modify("-{$offset} hours");
        } catch (\Throwable) {
            return null;
        }
    }

    /**
     * Extract ash column height in meters from the description.
     */
    private function extractAshHeight(string $description): ?int
    {
        if (! preg_match('/tinggi kolom abu teramati\s*(?:&plusmn;|±)?\s*(\d{1,4})\s*m/i', $description, $m)) {
            return null;
        }

        return (int) $m[1];
    }

    /**
     * Normalize a volcano name for matching.
     *
     * Strips `Gunung`/`g.` prefixes, lowercases and collapses
     * punctuation/spaces so `Gunung Anak Krakatau` === `Anak Krakatau`.
     */
    public function normalizeName(string $name): string
    {
        $name = mb_strtolower(trim($name));
        $name = preg_replace('/^(gunung\s+api\s+|gunung\s+|g\.\s*)/', '', $name);
        $name = preg_replace('/[^\p{L}\p{N}]+/u', ' ', $name);

        return trim(preg_replace('/\s+/', ' ', $name));
    }

    /**
     * Convert DateTime fields to strings for the cache.
     *
     * @param  list<array<string, mixed>>  $eruptions
     * @return list<array<string, mixed>>
     */
    private function toCacheSafe(array $eruptions): array
    {
        return array_map(function (array $eruption): array {
            if ($eruption['occurred_at'] instanceof \DateTimeInterface) {
                $eruption['occurred_at'] = $eruption['occurred_at']->format('Y-m-d H:i:s');
            }

            return $eruption;
        }, $eruptions);
    }

    /**
     * Rehydrate string dates back to DateTimeImmutable.
     *
     * @param  list<array<string, mixed>>  $eruptions
     * @return list<array<string, mixed>>
     */
    private function fromCacheSafe(array $eruptions): array
    {
        return array_map(function (array $eruption): array {
            $value = $eruption['occurred_at'] ?? null;

            if (is_string($value) && $value !== '') {
                $eruption['occurred_at'] = new \DateTimeImmutable(
                    $value,
                    new \DateTimeZone('UTC'),
                );
            }

            return $eruption;
        }, $eruptions);
    }
}
