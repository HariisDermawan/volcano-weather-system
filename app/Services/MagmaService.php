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

    /**
     * Endpoints
     */
    private const VAR_URL = 'https://magma.esdm.go.id/v1/json/var';

    private const VAR_SIGNATURE = '22bb021f910ca5d2cb91120509029340e9367d214d8d1f382aa4f5ce4faf11b6';

    private const REPORTS_URL = 'https://magma.esdm.go.id/v1/gunung-api/laporan';

    private const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';

    private const LEVELS_CACHE_KEY = 'magma:levels';

    private const ERUPTIONS_CACHE_KEY = 'magma:eruptions';

    private const ERUPT_CACHE_KEY = 'magma:erupt';

    private const MARKER_META_CACHE_KEY = 'magma:marker-meta';

    private const REPORT_PERIODS_CACHE_KEY = 'magma:report-periods';

    private const CACHE_TTL = 180; // 3 minutes

    private const INDONESIAN_MONTHS = [
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
     * All eruption events for a volcano matched by name, newest first.
     *
     * Mengambil halaman khusus gunung (`informasi-letusan/{slug}`) seperti
     * yang dilihat user, sehingga gunung yang jarang erupsi (mis. Krakatau)
     * tetap mendapat riwayat erupsi sebenarnya — bukan laporan harian.
     *
     * @return list<array<string, mixed>>
     */
    public function getEruptionsForVolcano(string $volcanoName): array
    {
        $slug = $this->getVolcanoSlugForName($volcanoName);

        if ($slug === null) {
            return [];
        }

        return $this->fromCacheSafe(Cache::remember(
            'magma:eruptions:'.mb_strtolower($slug),
            self::CACHE_TTL,
            function () use ($slug) {
                return $this->toCacheSafe(
                    $this->fetchEruptionsForVolcano($slug)
                );
            },
        ));
    }

    /**
     * Latest eruption event for a volcano matched by name.
     *
     * @return array<string, mixed>|null
     */
    public function getLatestEruptionForVolcano(string $volcanoName): ?array
    {
        return $this->getEruptionsForVolcano(
            $volcanoName
        )[0] ?? null;
    }

    /**
     * Resolve MAGMA slug (`KRA`) for a volcano name.
     */
    public function getVolcanoSlugForName(string $volcanoName): ?string
    {
        $key = $this->normalizeName($volcanoName);

        return $this->getVolcanoSlugs()[$key] ?? null;
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
     * Meta administratif & geografis per gunung (kabupaten, provinsi,
     * ketinggian) — disalin dari array `markersGunungApi` peta /v1.
     *
     * @return array<string, array<string, string|int|null>>
     */
    public function getMarkerMeta(): array
    {
        return Cache::remember(self::MARKER_META_CACHE_KEY, self::CACHE_TTL, function () {
            return $this->fetchMarkerMeta();
        });
    }

    /**
     * Entri laporan pengamatan terbaru per gunung dari `gunung-api/laporan`.
     *
     * Berisi id + signature link detail (untuk menarik foto & konten
     * laporan) sekaligus periode + tanggal. Halaman terurut terbaru dulu,
     * sehingga entri PERTAMA per gunung yang disimpan.
     *
     * @return array<string, array{id: string, signature: string, period: string, report_date: string}>
     */
    public function getReportEntries(): array
    {
        return Cache::remember(
            self::REPORT_PERIODS_CACHE_KEY,
            self::CACHE_TTL * 2,
            function (): array {
                return $this->fetchReportEntries();
            },
        );
    }

    /**
     * Periode pengamatan laporan per gunung, dari entri laporan.
     *
     * @return array<string, array<string, string>>
     */
    public function getReportPeriods(): array
    {
        $result = [];

        foreach ($this->getReportEntries() as $key => $entry) {
            $result[$key] = [
                'period' => $entry['period'],
                'report_date' => $entry['report_date'],
            ];
        }

        return $result;
    }

    /**
     * Data laporan pengamatan terbaru sebuah gunung, atau null.
     *
     * Menarik halaman detail `gunung-api/laporan/{id}?signature=...`
     * — sumber publik yang sama dengan popup magma.esdm.go.id/v1 — lalu
     * mengekstrak kalimat lokasi, foto resmi, visual, klimatologi, dan
     * seismik. Di-cache 10 menit per gunung.
     *
     * @return array<string, string|null>|null
     */
    public function getReportData(string $volcanoName): ?array
    {
        $key = $this->normalizeName($volcanoName);

        if ($key === '') {
            return null;
        }

        return Cache::remember(
            'magma:report-data:'.mb_strtolower(str_replace(' ', '-', $key)),
            600,
            function () use ($volcanoName, $key): ?array {
                return $this->fetchReportData($volcanoName, $key);
            },
        );
    }

    /**
     * Foto resmi periode pengamatan terbaru sebuah gunung, atau null.
     *
     * Diambil dari halaman detail laporan MAGMA (`img/ga/...`) — foto
     * yang sama persis dengan yang tampil di popup /v1.
     */
    public function getReportPhoto(string $volcanoName): ?string
    {
        $data = $this->getReportData($volcanoName);

        $image = $data['image'] ?? null;

        return is_string($image) && $image !== '' ? $image : null;
    }

    /**
     * Visual photo terbaru sebuah gunung (`VEN_` crs image) atau null.
     *
     * Diambil dari halaman `informasi-letusan/{SLUG}` — gambar visual
     * terbaru yang tersimpan di `magma.vsi.esdm.go.id/img/crs/`. Photo
     * yang benar-benar real-time hanya tersedia lewat API `var` yang
     * terkunci per-session, jadi ini pendekatan publik terbaik. Di-cache
     * 1 jam agar popup tetap ringan.
     */
    public function getVisualPhoto(string $volcanoName): ?string
    {
        $slug = $this->getVolcanoSlugForName($volcanoName);

        if ($slug === null) {
            return null;
        }

        return Cache::remember(
            'magma:visual:'.mb_strtolower($slug),
            3600,
            function () use ($slug): ?string {
                return $this->fetchVisualPhoto($slug);
            },
        );
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
     * Parse array `markersGunungApi` dari peta /v1 menjadi meta per gunung.
     *
     * Array ini `[{...},{...}]` (JSON murni tanpa tanda kurung di dalam
     * string), sehingga cukup diimbangi `[`/`]` dengan hitungan kedalaman.
     *
     * @return array<string, array<string, string|int|null>>
     */
    private function fetchMarkerMeta(): array
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

            $start = strpos($html, 'var markersGunungApi = ');

            if ($start === false) {
                return [];
            }

            $start = strpos($html, '[', $start);

            if ($start === false) {
                return [];
            }

            $json = $this->extractBracketedJson($html, $start);

            if ($json === null) {
                return [];
            }

            $items = json_decode($json, true);

            if (! is_array($items)) {
                return [];
            }

            $result = [];

            foreach ($items as $item) {
                $key = $this->normalizeName((string) ($item['ga_nama_gapi'] ?? ''));

                if ($key === '') {
                    continue;
                }

                $result[$key] = [
                    'kabupaten' => (string) ($item['ga_kab_gapi'] ?? ''),
                    'province' => (string) ($item['ga_prov_gapi'] ?? ''),
                    'elevation' => isset($item['ga_elev_gapi'])
                        ? (int) $item['ga_elev_gapi']
                        : null,
                ];
            }

            return $result;
        } catch (\Throwable $e) {
            report($e);

            return [];
        }
    }

    /**
     * Parse halaman laporan pengamatan (`gunung-api/laporan`) menjadi
     * entri per gunung: id + signature link detail, periode, dan tanggal.
     *
     * @return array<string, array{id: string, signature: string, period: string, report_date: string}>
     */
    private function fetchReportEntries(): array
    {
        try {
            $response = Http::withHeaders([
                'User-Agent' => self::USER_AGENT,
                'Accept' => 'text/html,application/xhtml+xml',
            ])
                ->timeout(25)
                ->get(self::REPORTS_URL);

            if ($response->failed()) {
                return [];
            }

            $html = $response->body();
            $result = [];
            $chunks = explode('<div class="timeline-item">', $html);

            array_shift($chunks); // drop preamble

            foreach ($chunks as $chunk) {
                if (! preg_match('/<small>\s*(Periode\s+[^<]+)\s*<\/small>/', $chunk, $period)) {
                    continue;
                }

                if (! preg_match('/<p class="timeline-title"><a href="#">([^<]+)<\/a>/', $chunk, $name)) {
                    continue;
                }

                if (! preg_match('/- ([\p{L}]+),\s*(\d{1,2})\s+(\p{L}+)\s+(\d{4})/u', $chunk, $date)) {
                    continue;
                }

                if (! preg_match('/laporan\/(\d+)\?signature=([0-9a-f]{64})/', $chunk, $link)) {
                    continue;
                }

                $reportDate = $this->parseReportDate($date[2], $date[3], $date[4]);

                if ($reportDate === null) {
                    continue;
                }

                $key = $this->normalizeName(trim($name[1]));

                // Halaman terurut laporan terbaru dulu — pertahankan entri
                // PERTAMA per gunung agar periode (dan fotonya) selalu yang
                // paling baru, bukan terakhir yang kebetulan muncul.
                if (isset($result[$key])) {
                    continue;
                }

                $result[$key] = [
                    'id' => $link[1],
                    'signature' => $link[2],
                    'period' => trim(html_entity_decode(
                        $period[1],
                        ENT_QUOTES | ENT_HTML5,
                        'UTF-8',
                    )),
                    'report_date' => $reportDate,
                ];
            }

            return $result;
        } catch (\Throwable $e) {
            report($e);

            return [];
        }
    }

    /**
     * Fetch halaman detail laporan sebuah gunung dan ekstrak isinya.
     *
     * Halaman ini adalah sumber publik resmi yang juga dipakai popup /v1:
     * kalimat lokasi geografis, foto resmi `img/ga/...`, visual, keterangan
     * lainnya, klimatologi, kegempaan, dan rekomendasi.
     *
     * @return array<string, string|null>|null
     */
    private function fetchReportData(
        string $volcanoName,
        string $normalizedName,
    ): ?array {
        $entry = $this->getReportEntries()[$normalizedName] ?? null;

        if ($entry === null) {
            return null;
        }

        try {
            $response = Http::withHeaders([
                'User-Agent' => self::USER_AGENT,
                'Accept' => 'text/html,application/xhtml+xml',
            ])
                ->timeout(25)
                ->get(self::REPORTS_URL.'/'.$entry['id'].'?signature='.$entry['signature']);

            if ($response->failed()) {
                return null;
            }

            $html = $response->body();

            $result = [
                'period' => $entry['period'],
                'report_date' => $entry['report_date'],
                'periode_text' => sprintf(
                    'Laporan per 6 jam, tanggal %s pukul %s',
                    $entry['report_date'],
                    trim((string) preg_replace(
                        '/^Periode\s+/i',
                        '',
                        $entry['period'],
                    )),
                ),
                'location' => null,
                'image' => null,
                'visual' => null,
                'keterangan' => null,
                'klimatologi' => null,
                'kegempaan' => null,
                'rekomendasi' => null,
            ];

            if (preg_match('/<p class="col-lg-6 pd-0">([^<]+)<\/p>/', $html, $m)) {
                $result['location'] = trim(html_entity_decode(
                    $m[1],
                    ENT_QUOTES | ENT_HTML5,
                    'UTF-8',
                ));
            }

            if (preg_match('/<img class="img-fluid" src="(https?:\/\/[^"]+)"/', $html, $m)) {
                $result['image'] = $m[1];
            }

            $sectionMap = [
                'Pengamatan Visual' => 'visual',
                'Keterangan Lainnya' => 'keterangan',
                'Klimatologi' => 'klimatologi',
                'Pengamatan Kegempaan' => 'kegempaan',
                'Rekomendasi' => 'rekomendasi',
            ];

            $searchOffset = 0;

            while (preg_match(
                '/<h6 class="slim-card-title">([^<]+)<\/h6>/',
                $html,
                $m,
                PREG_OFFSET_CAPTURE,
                $searchOffset,
            )) {
                $field = $sectionMap[trim($m[1][0])] ?? null;
                $contentStart = $m[0][1] + strlen($m[0][0]);

                if (preg_match(
                    '/<\/div>\s*<\/div>\s*<\/div>/',
                    $html,
                    $em,
                    PREG_OFFSET_CAPTURE,
                    $contentStart,
                )) {
                    $contentEnd = $em[0][1];
                } else {
                    $contentEnd = strlen($html);
                }

                if ($field !== null) {
                    $clean = $this->cleanReportBlock(
                        substr($html, $contentStart, $contentEnd - $contentStart),
                    );

                    if ($clean !== null) {
                        $result[$field] = $clean;
                    }
                }

                $searchOffset = $contentEnd;
            }

            return $result;
        } catch (\Throwable $e) {
            report($e);

            return null;
        }
    }

    /**
     * Bersihkan HTML satu blok laporan menjadi teks per baris.
     */
    private function cleanReportBlock(string $html): ?string
    {
        $html = preg_replace('/<br\s*\/?\s*>/i', "\n", $html);
        $html = preg_replace('/<hr\s*\/?\s*>/i', "\n", $html);
        $html = strip_tags($html);
        $html = html_entity_decode($html, ENT_QUOTES | ENT_HTML5, 'UTF-8');

        $lines = array_values(array_filter(
            array_map(
                fn (string $line): string => trim(preg_replace('/\s+/u', ' ', $line)),
                explode("\n", $html),
            ),
            fn (string $line): bool => $line !== ''
                && ! in_array($line, ['Rekomendasi', 'Pengamatan Kegempaan'], true),
        ));

        return $lines === [] ? null : implode("\n", $lines);
    }

    /**
     * Fetch halaman letusan sebuah gunung dan ambil visual `VEN_` pertama.
     */
    private function fetchVisualPhoto(string $slug): ?string
    {
        try {
            $response = Http::withHeaders([
                'User-Agent' => self::USER_AGENT,
                'Accept' => 'text/html,application/xhtml+xml',
            ])
                ->timeout(25)
                ->get(self::ERUPTIONS_URL.'/'.$slug);

            if ($response->failed()) {
                return null;
            }

            $html = $response->body();

            if (! preg_match(
                '/https?:\/\/magma\.vsi\.esdm\.go\.id\/img\/crs\/VEN_[A-Z0-9_]+\.png/',
                $html,
                $match,
            )) {
                return null;
            }

            return $match[0];
        } catch (\Throwable $e) {
            report($e);

            return null;
        }
    }

    /**
     * Extract a balanced `[...]` JSON block starting at `$start`.
     */
    private function extractBracketedJson(string $html, int $start): ?string
    {
        $depth = 0;
        $length = strlen($html);

        for ($i = $start; $i < $length; $i++) {
            $char = $html[$i];

            if ($char === '[') {
                $depth++;
            } elseif ($char === ']') {
                $depth--;

                if ($depth === 0) {
                    return substr($html, $start, $i - $start + 1);
                }
            }
        }

        return null;
    }

    /**
     * Convert an Indonesian date label (`15 September 2026`) to `Y-m-d`.
     */
    private function parseReportDate(
        string $day,
        string $monthLabel,
        string $year,
    ): ?string {
        $month = self::INDONESIAN_MONTHS[$monthLabel] ?? null;

        if ($month === null) {
            return null;
        }

        return sprintf(
            '%04d-%02d-%02d',
            (int) $year,
            $month,
            (int) $day,
        );
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
     * Slug map untuk setiap gunung (dari daftar tombol halaman letusan).
     *
     * @return array<string, string>
     */
    private function getVolcanoSlugs(): array
    {
        return Cache::remember(
            'magma:volcano-slugs',
            self::CACHE_TTL,
            function (): array {
                return $this->fetchVolcanoSlugs();
            },
        );
    }

    /**
     * Parse daftar tombol `<a href=".../informasi-letusan/{SLUG}">` menjadi
     * map nama ternormalisasi -> slug.
     *
     * @return array<string, string>
     */
    private function fetchVolcanoSlugs(): array
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
            $slugs = [];
            $matches = [];

            if (! preg_match_all(
                '/informasi-letusan\/([A-Z]+)"[^>]*>([^<]+)<\/a>/',
                $html,
                $matches,
                PREG_SET_ORDER,
            )) {
                return [];
            }

            foreach ($matches as $match) {
                $slugs[$this->normalizeName($match[2])] = $match[1];
            }

            return $slugs;
        } catch (\Throwable $e) {
            report($e);

            return [];
        }
    }

    /**
     * Parse the per-volcano eruption page into events, newest first.
     *
     * Halaman ini memuat hanya erupsi gunung tersebut lengkap dengan
     * header tanggal (`.timeline-day`) dan jam (`09:10 WIB`).
     *
     * @return list<array<string, mixed>>
     */
    private function fetchEruptionsForVolcano(string $slug): array
    {
        try {
            $response = Http::withHeaders([
                'User-Agent' => self::USER_AGENT,
                'Accept' => 'text/html,application/xhtml+xml',
            ])
                ->timeout(25)
                ->get(self::ERUPTIONS_URL.'/'.$slug);

            if ($response->failed()) {
                return [];
            }

            $html = $response->body();
            $result = [];
            $currentDateLabel = null;

            $matches = [];

            preg_match_all(
                '/<div class="timeline-item(?:\s+timeline-day)?">(.*?)<\/div>\s*<\/div>/is',
                $html,
                $matches,
                PREG_SET_ORDER,
            );

            foreach ($matches as $match) {
                $chunk = $match[1];
                $whole = $match[0];

                if (str_contains($whole, 'timeline-day')) {
                    if (preg_match(
                        '/<p class="timeline-date">([^<]+)<\/p>/',
                        $chunk,
                        $date,
                    )) {
                        $currentDateLabel = trim(
                            html_entity_decode(
                                $date[1],
                                ENT_QUOTES | ENT_HTML5,
                                'UTF-8',
                            ),
                        );
                    }

                    continue;
                }

                $eruption = $this->parseEruptionChunk(
                    $chunk,
                    $currentDateLabel,
                );

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
    private function parseEruptionChunk(
        string $chunk,
        ?string $dateLabel = null,
    ): ?array {
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
            'author' => $this->extractAuthor($chunk),
            'image' => $this->extractImage($chunk),
            'time_label' => $this->extractTimeLabel($chunk),
            'date_label' => $dateLabel,
        ];
    }

    /**
     * Extract the event time displayed on the source page (`09:10 WIB`).
     */
    private function extractTimeLabel(string $chunk): ?string
    {
        if (! preg_match('/<div class="timeline-time"><small>(.*?)<\/small><\/div>/is', $chunk, $m)) {
            return null;
        }

        $time = preg_replace('/\s+/', ' ', html_entity_decode(
            trim(strip_tags($m[1])),
            ENT_QUOTES | ENT_HTML5,
            'UTF-8',
        ));

        return $time !== '' ? $time : null;
    }

    /**
     * Extract the report author (`Dibuat oleh ...`) from the chunk.
     */
    private function extractAuthor(string $chunk): ?string
    {
        if (! preg_match('/<p class="timeline-author">\s*(.*?)\s*<\/p>/is', $chunk, $m)) {
            return null;
        }

        $author = preg_replace('/\s+/', ' ', html_entity_decode(
            trim(strip_tags($m[1])),
            ENT_QUOTES | ENT_HTML5,
            'UTF-8',
        ));

        $author = preg_replace('/^(dibuat\s+oleh\s*[:-]?\s*)/i', '', $author);

        return $author !== '' ? $author : null;
    }

    /**
     * Extract the eruption photo URL from the chunk.
     */
    private function extractImage(string $chunk): ?string
    {
        if (! preg_match('/<img[^>]+src="(https?:\/\/[^"]+)"/', $chunk, $m)) {
            return null;
        }

        return $m[1];
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

        $month = self::INDONESIAN_MONTHS[$d[2]] ?? null;

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
