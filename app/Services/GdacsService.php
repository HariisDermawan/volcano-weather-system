<?php

namespace App\Services;

use App\Models\Volcano;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

/**
 * Live-fetch & parse GDACS volcano alerts dari beranda resmi.
 *
 * Sumber: https://www.gdacs.org/default.aspx (panel "Volcanoes") —
 * mengandung daftar episode erupsi terkini & lewat beserta level
 * alert (Green/Orange/Red) masing-masing.
 *
 * RSS GDACS (`rss.xml`) tidak memuat alert gunung berapi; beranda
 * adalah satu-satunya sumber terlengkap untuk data ini.
 *
 * Data di-fetch langsung per request (cache 10 menit) supaya
 * frontend selalu menampilkan status GDACS terkini secara akurat.
 */
class GdacsService
{
    private const HOMEPAGE_URL = 'https://www.gdacs.org/default.aspx';

    private const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';

    private const CACHE_KEY = 'gdacs:volcano:alerts';

    private const CACHE_TTL = 600; // 10 menit

    /**
     * Ambil alert GDACS paling relevan untuk satu gunung.
     *
     * Prioritas: alert aktif (current) > episode terakhir (past).
     * Mengembalikan `null` bila gunung belum pernah terdaftar di GDACS.
     *
     * @return array<string, mixed>|null
     */
    public function getAlertForVolcano(int $volcanoId): ?array
    {
        $volcano = Volcano::find($volcanoId);

        if ($volcano === null) {
            return null;
        }

        $matched = $this->matchAlert(
            $this->getVolcanoAlerts(),
            $volcano,
        );

        if ($matched === null) {
            return null;
        }

        return [
            'alert_level' => $matched['level'],
            'is_current' => $matched['is_current'],
            'event_id' => $matched['event_id'],
            'episode_id' => $matched['episode_id'],
            'volcano_name' => $matched['volcano_name'],
            'link' => $matched['link'],
            'occurred_at' => $matched['occurred_at'],
        ];
    }

    /**
     * Ambil semua alert volcano dari beranda GDACS (cache-safe).
     *
     * @return array<int, array<string, mixed>>
     */
    private function getVolcanoAlerts(): array
    {
        return Cache::remember(
            self::CACHE_KEY,
            self::CACHE_TTL,
            function () {
                return $this->parseHomepage();
            },
        );
    }

    /**
     * Fetch beranda GDACS dan parse panel Volcanoes.
     *
     * @return array<int, array<string, mixed>>
     */
    private function parseHomepage(): array
    {
        try {
            $response = Http::withHeaders([
                'User-Agent' => self::USER_AGENT,
                'Accept' => 'text/html,application/xhtml+xml',
            ])
                ->timeout(30)
                ->get(self::HOMEPAGE_URL);

            if ($response->failed()) {
                return [];
            }

            $body = $response->body();

            $volcIdx = stripos($body, 'gdacs_eventtype_VO');

            if ($volcIdx === false) {
                return [];
            }

            $section = substr($body, $volcIdx);

            return $this->extractEntries($section);
        } catch (\Throwable $e) {
            report($e);

            return [];
        }
    }

    /**
     * Ekstrak entri gunung dari potongan HTML panel VO.
     *
     * @return array<int, array<string, mixed>>
     */
    private function extractEntries(string $section): array
    {
        $chunks = preg_split('/gdacs_toc_VO_/', $section);

        if (! is_array($chunks)) {
            return [];
        }

        $chunks = array_slice($chunks, 1);

        $entries = [];

        foreach ($chunks as $chunk) {
            $entry = $this->parseEntryChunk($chunk);

            if ($entry !== null) {
                $entries[] = $entry;
            }
        }

        return $entries;
    }

    /**
     * Parse satu blok VO menjadi array terstruktur.
     *
     * @return array<string, mixed>|null
     */
    private function parseEntryChunk(string $chunk): ?array
    {
        if (! preg_match('/^(\d+)_(\d+)/', $chunk, $idMatch)) {
            return null;
        }

        if (! preg_match('/alert_VO_(PAST_)?(Green|Orange|Red)/', $chunk, $levelMatch)) {
            return null;
        }

        $isPast = $levelMatch[1] !== '';

        if (! preg_match('/class="alert_item_name(?:_past)?"\s*>\s*([^<]+)/', $chunk, $nameMatch)) {
            return null;
        }

        $rawName = trim(strip_tags($nameMatch[1]));

        $dateMatched = preg_match(
            '/class="alert_date(?:_past)?"\s*>\s*-\s*([^<]+)/',
            $chunk,
            $dateMatch,
        );
        $rawDate = $dateMatched === 1
            ? trim(strip_tags($dateMatch[1]))
            : null;

        $linkMatched = preg_match('/href="([^"]+)"/', $chunk, $linkMatch);
        $link = $linkMatched === 1
            ? html_entity_decode($linkMatch[1], ENT_QUOTES | ENT_HTML5, 'UTF-8')
            : null;

        return [
            'event_id' => $idMatch[1],
            'episode_id' => $idMatch[2],
            'level' => strtolower($levelMatch[2]),
            'is_current' => ! $isPast,
            'volcano_name' => $rawName,
            'occurred_at' => $this->parseOccurredDate($rawDate),
            'link' => $link,
        ];
    }

    /**
     * Parse tanggal `"04 Sep 2026"` → `"2026-09-04"`.
     */
    private function parseOccurredDate(?string $dateText): ?string
    {
        if ($dateText === null || trim($dateText) === '') {
            return null;
        }

        $clean = trim($dateText);

        $formats = ['d M Y', 'd-M-Y'];

        foreach ($formats as $fmt) {
            try {
                $dt = \DateTimeImmutable::createFromFormat(
                    $fmt,
                    $clean,
                    new \DateTimeZone('UTC'),
                );

                if ($dt !== false) {
                    return $dt->format('Y-m-d');
                }
            } catch (\Throwable) {
                continue;
            }
        }

        return $clean;
    }

    /**
     * Cocokkan alert ke gunung: nama dulu, lalu kata kunci parsial.
     *
     * @param  array<int, array<string, mixed>>  $alerts
     * @return array<string, mixed>|null
     */
    private function matchAlert(
        array $alerts,
        Volcano $volcano,
    ): ?array {
        $volcanoName = strtolower(preg_replace(
            '/^gunung\s+/i',
            '',
            trim($volcano->name),
        ));

        if ($volcanoName === '') {
            return null;
        }

        $current = [];
        $past = [];

        foreach ($alerts as $alert) {
            // Bersihkan: "Krakatau (Indonesia)" → "Krakatau"
            $gdacsName = preg_replace('/\s*\(.+\)\s*$/', '', $alert['volcano_name'] ?? '');
            $gdacsName = strtolower(trim($gdacsName));

            if ($gdacsName === '') {
                continue;
            }

            $matches = str_contains($volcanoName, $gdacsName)
                || str_contains($gdacsName, $volcanoName);

            if ($matches) {
                if ($alert['is_current'] ?? false) {
                    $current[] = $alert;
                } else {
                    $past[] = $alert;
                }
            }
        }

        // Prioritas: alert aktif > episode terakhir.
        if ($current !== []) {
            return $current[0];
        }

        if ($past !== []) {
            usort($past, static function (array $a, array $b): int {
                return ($b['event_id'] ?? '0') <=> ($a['event_id'] ?? '0');
            });

            return $past[0];
        }

        return null;
    }
}
