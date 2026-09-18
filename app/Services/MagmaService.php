<?php

namespace App\Services;

use GuzzleHttp\Cookie\CookieJar;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

class MagmaService
{
    private const LEVELS_URL = 'https://magma.esdm.go.id/v1/gunung-api/tingkat-aktivitas';

    private const ERUPTIONS_URL = 'https://magma.esdm.go.id/v1/gunung-api/informasi-letusan';

    private const MAP_URL = 'https://magma.esdm.go.id/v1';

    private const VAR_URL = 'https://magma.esdm.go.id/v1/json/var';

    private const VAR_SIGNATURE = '22bb021f910ca5d2cb91120509029340e9367d214d8d1f382aa4f5ce4faf11b6';

    private const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';

    private const LEVELS_CACHE_KEY = 'magma:levels';

    private const ERUPTIONS_CACHE_KEY = 'magma:eruptions';

    private const ERUPT_CACHE_KEY = 'magma:erupt';

    private const MARKER_META_CACHE_KEY = 'magma:marker-meta';

    private const VAR_CACHE_KEY = 'magma:var';

    private const CACHE_TTL = 600;

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

    private function resolveGaCode(string $volcanoName): ?string
    {
        $key = $this->normalizeName($volcanoName);

        if ($key === '') {
            return null;
        }

        $meta = $this->getMarkerMeta()[$key] ?? null;

        $code = $meta['ga_code'] ?? null;

        return is_string($code) && $code !== '' ? $code : null;
    }

    /**
     * Data popup resmi dari /v1 untuk sebuah gunung (foto, lokasi,
     * klimatologi, periode, rekomendasi, dll) — sumber yang sama
     * dengan popup magma.esdm.go.id/v1.
     *
     * Di-cache 10 menit per ga_code agar tidak membobol rate-limit.
     * Saat MAGMA gagal/tidak menjawab, hasil null tetap di-cache
     * (sentinel) agar halaman tidak memukul ulang setiap request.
     *
     * @return array<string, mixed>|null
     */
    public function getVarData(string $volcanoName): ?array
    {
        $gaCode = $this->resolveGaCode($volcanoName);

        if ($gaCode === null) {
            return null;
        }

        $raw = Cache::remember(
            self::VAR_CACHE_KEY.':'.mb_strtolower($gaCode),
            600,
            function () use ($gaCode): array {
                return $this->fetchVarData($gaCode) ?? ['__missing' => true];
            },
        );

        return isset($raw['__missing']) ? null : $raw;
    }

    /**
     * Fetch data /v1 via POST `json/var` — alur yang dipakai popup browser.
     *
     * GET `/v1` untuk CSRF token + session → POST `json/var` dengan
     * `ga_code`. CookieJar menjaga session antar request.
     *
     * @return array<string, mixed>|null
     */
    private function fetchVarData(string $gaCode): ?array
    {
        try {
            $jar = new CookieJar;

            $r1 = Http::withOptions(['cookies' => $jar, 'allow_redirects' => true])
                ->withHeaders([
                    'User-Agent' => self::USER_AGENT,
                    'Accept' => 'text/html,application/xhtml+xml',
                ])
                ->timeout(25)
                ->get(self::MAP_URL);

            if ($r1->failed()) {
                return null;
            }

            $html = $r1->body();

            if (! preg_match('/<meta name="csrf-token" content="([^"]+)"/', $html, $cm)) {
                return null;
            }

            $csrf = $cm[1];

            $r2 = Http::withOptions(['cookies' => $jar, 'allow_redirects' => true])
                ->asForm()
                ->withHeaders([
                    'User-Agent' => self::USER_AGENT,
                    'X-CSRF-TOKEN' => $csrf,
                    'X-Requested-With' => 'XMLHttpRequest',
                    'Accept' => 'application/json, text/javascript, */*; q=0.01',
                ])
                ->timeout(25)
                ->post(
                    self::VAR_URL.'?signature='.self::VAR_SIGNATURE,
                    ['ga_code' => $gaCode],
                );

            if ($r2->failed()) {
                return null;
            }

            $json = json_decode($r2->body(), true);

            $data = $json['data'] ?? null;

            if (! is_array($data)) {
                return null;
            }

            $lokasi = $data['gunungapi']['deskripsi'] ?? null;

            if (is_string($lokasi)) {
                $lokasi = $this->cleanVarText($lokasi);
            }

            $klima = $data['klimatologi']['deskripsi'] ?? null;

            if (is_string($klima)) {
                $klima = $this->cleanVarText($klima);
            }

            $visual = $data['visual']['deskripsi'] ?? null;

            if (is_string($visual)) {
                $visual = $this->cleanVarText($visual);
            }

            $rekom = $data['rekomendasi'] ?? null;

            if (is_string($rekom)) {
                $rekom = $this->cleanVarText($rekom);
            }

            $lainnya = $data['visual']['lainnya'] ?? null;

            if (is_string($lainnya)) {
                $lainnya = $this->cleanVarText($lainnya);
            }

            return [
                'foto' => $data['visual']['foto'] ?? null,
                'lokasi' => $lokasi,
                'periode_text' => $data['laporan']['tanggal'] ?? null,
                'klimatologi' => $klima,
                'visual' => $visual,
                'visual_lainnya' => $lainnya,
                'rekomendasi' => $rekom,
                'pembuat' => $data['laporan']['pembuat'] ?? null,
                'grafik_gempa' => $data['gempa']['grafik'] ?? null,
                'deskripsi_gempa' => is_array($data['gempa']['deskripsi'] ?? null)
                    ? $data['gempa']['deskripsi']
                    : null,
                'status' => $data['gunungapi']['status'] ?? null,
                'vona' => $data['vona'] ?? null,
            ];
        } catch (\Throwable $e) {
            report($e);

            return null;
        }
    }

    private function cleanVarText(string $html): string
    {
        $html = preg_replace('/<br\s*\/?\s*>/i', "\n", $html);
        $html = strip_tags($html);
        $html = html_entity_decode(
            $html,
            ENT_QUOTES | ENT_HTML5,
            'UTF-8',
        );

        return trim($html);
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
                    'ga_code' => (string) ($item['ga_code'] ?? ''),
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
            array_shift($chunks);

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

    private function extractImage(string $chunk): ?string
    {
        if (! preg_match('/<img[^>]+src="(https?:\/\/[^"]+)"/', $chunk, $m)) {
            return null;
        }

        return $m[1];
    }

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

    private function extractAshHeight(string $description): ?int
    {
        $patterns = [
            // Kuat: "tinggi ... 300 m di atas puncak / dari puncak" dengan rentang
            '/(?:se)?(?:tinggi|ketinggian|ketinggian asap)\s*(?:sekitar|±|~|\/-)?\s*(\d{1,5}(?:[.,]\d+)?)\s*(?:[-–]\s*(\d{1,5}(?:[.,]\d+)?))?\s*(?:m|meter)\s+(?:di\s+atas\s+puncak|dari\s+puncak)/i',
            // Angka dulu: "300 m di atas puncak"
            '/(\d{1,5}(?:[.,]\d+)?)\s*(?:[-–]\s*(\d{1,5}(?:[.,]\d+)?))?\s*(?:m|meter)\s+(?:di\s+atas\s+puncak|dari\s+puncak)/i',
            // Konteks asap/abu: "asap kawah ... tinggi 100 m"
            '/(?:teramati\s+)?(?:asap|abu|kolom\s*(?:abu|asap)?)\s*(?:kawah\s*(?:utama)?|letusan|erupsi|vulkanik)?\s*(?:utama\s+)?(?:berwarna[^.]*?)?(?:dengan\s+)?(?:intensitas[^.]*?)?(?:se)?(?:ketinggian|tinggi)\s+(?:sekitar|±|~|\/-)?\s*(\d{1,5}(?:[.,]\d+)?)\s*(?:[-–]\s*(\d{1,5}(?:[.,]\d+)?))?\s*(?:m|meter)/i',
        ];

        foreach ($patterns as $pattern) {
            if (! preg_match($pattern, $description, $m)) {
                continue;
            }

            $v1 = (float) str_replace(',', '.', $m[1]);

            if ($v1 < 1) {
                continue;
            }

            $v2 = $v1;

            if (! empty($m[2])) {
                $v2 = (float) str_replace(',', '.', $m[2]);
            }

            return (int) max($v1, $v2);
        }

        // Fallback lama: "tinggi kolom abu teramati 300 m"
        if (preg_match('/tinggi kolom abu teramati\s*(?:&plusmn;|±)?\s*(\d{1,4})\s*m/i', $description, $m)) {
            return (int) $m[1];
        }

        return null;
    }

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
