<?php

namespace App\Http\Controllers;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

class GeoHazardController extends Controller
{
    /*
     * =====================================================
     * GEMPA TERKINI (BMKG)
     *
     * Sumber utama: halaman "Gempabumi Terkini (Real-time)"
     *   https://www.bmkg.go.id/gempabumi/gempabumi-realtime
     * Data dikirim sebagai payload Nuxt SSR (`__NUXT_DATA__`)
     * dengan skema `Infogempa.gempa` (35+ kejadian terakhir).
     *
     * Fallback bila halaman tidak dapat di-scrape:
     *   - autogempa.json      : gempa terakhir yang dirasakan
     *   - gempaterkini.json   : 15 gempa terkini
     *
     * Hasil di-cache 90 detik supaya tidak membebani BMKG.
     * =====================================================
     */

    public function gempa()
    {
        $data = Cache::remember('geo:gempa', 90, function () {
            // Utama: "Gempa Dirasakan" (autogempa.json) — sumber yang
            // sama persis dengan banner Gempa Dirasakan di situs BMKG.
            // Paling cepat (hari ini pukul 20:54:13 WIB) dan terbaru.
            try {
                $latest = $this->fetchAutogempa();

                if ($latest !== null) {
                    return ['latest' => $latest, 'list' => [$latest]];
                }
            } catch (\Throwable $e) {
                // lanjut ke fallback berikutnya
            }

            // Fallback 1: halaman "Gempabumi Terkini (Real-time)".
            try {
                $list = $this->fetchRealtimeGempa();

                return ['latest' => $list[0] ?? null, 'list' => $list];
            } catch (\Throwable $e) {
                // lanjut ke fallback berikutnya
            }

            // Fallback 2: gempaterkini.json + autogempa.json.
            try {
                [$latest, $list] = $this->fetchGempa();

                return ['latest' => $latest, 'list' => $list];
            } catch (\Throwable $e2) {
                return [
                    'latest' => null,
                    'list' => [],
                    'error' => 'Sumber BMKG sedang tidak dapat dihubungi.',
                ];
            }
        });

        // Tampilkan hanya gempa PALING TERBARU; gempa lama dihidden.
        // Saat ada gempa baru, list + latest otomatis berganti saat
        // polling berikutnya (cache 90 detik).
        $latest = $data['latest'] ?? ($data['list'][0] ?? null);

        $data['list'] = $latest ? [$latest] : [];
        $data['latest'] = $latest;

        return response()->json($data);
    }

    /**
     * Ambil gempa terakhir yang dirasakan (autogempa.json).
     *
     * Field `Potensi` pada autogempa.json berisi pesan publikasi
     * ("Gempa ini dirasakan untuk diteruskan pada masyarakat"),
     * bukan penilaian tsunami. Penilaian tsunami yang akurat diambil
     * dari gempaterkini.json dengan mencocokkan DateTime kejadian.
     *
     * @return array<string, mixed>|null
     */
    private function fetchAutogempa(): ?array
    {
        $row = Http::timeout(20)
            ->get('https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json')
            ->json('Infogempa.gempa');

        if (! is_array($row)) {
            return null;
        }

        $gempa = $this->buildGempaRow($row);

        $dateTime = (string) ($row['DateTime'] ?? '');

        if ($dateTime !== '') {
            $gempaterkini = Http::timeout(20)
                ->get('https://data.bmkg.go.id/DataMKG/TEWS/gempaterkini.json')
                ->json('Infogempa.gempa');

            $gempa['potential'] = $this->tsunamiPotential(
                $dateTime,
                is_array($gempaterkini) ? $gempaterkini : [],
            );
        }

        return $gempa;
    }

    /**
     * Penilaian tsunami yang akurat untuk satu kejadian gempa.
     *
     * @param  string  $dateTime  Waktu kejadian (DateTime autogempa).
     * @param  array<int, array<string, mixed>>  $gempaterkini  Baris mentah gempaterkini.json.
     */
    private function tsunamiPotential(string $dateTime, array $gempaterkini): ?string
    {
        foreach ($gempaterkini as $row) {
            if (! is_array($row)) {
                continue;
            }

            $candidate = $row['DateTime'] ?? null;

            if (is_string($candidate) && $candidate !== '' && strtotime($candidate) === strtotime($dateTime)) {
                $potensi = $row['Potensi'] ?? null;

                return is_string($potensi) && $potensi !== '' ? $potensi : null;
            }
        }

        return null;
    }

    /**
     * Scrape halaman Gempabumi Real-time BMKG dan urai payload Nuxt SSR.
     *
     * @return array<int, array<string, mixed>>
     */
    private function fetchRealtimeGempa(): array
    {
        $response = Http::withHeaders([
            'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
            'Accept' => 'text/html,application/xhtml+xml',
        ])
            ->timeout(20)
            ->get('https://www.bmkg.go.id/gempabumi/gempabumi-realtime');

        if (! preg_match('/__NUXT_DATA__">(.*?)<\/script>/s', $response->body(), $matches)) {
            throw new \RuntimeException('Payload Nuxt BMKG tidak ditemukan.');
        }

        $payload = json_decode($matches[1], true);

        if (! is_array($payload)) {
            $payload = json_decode(html_entity_decode($matches[1]), true);

            if (! is_array($payload)) {
                throw new \RuntimeException('Payload Nuxt BMKG tidak valid.');
            }
        }

        $infogempa = $this->findInfogempa($this->nuxtValue($payload, 1));
        $rows = $infogempa['gempa'] ?? [];

        $list = [];

        foreach ((is_array($rows) ? $rows : []) as $row) {
            if (! is_array($row)) {
                continue;
            }

            $time = (string) ($row['waktu'] ?? '');
            $dateTime = null;
            $tanggal = null;
            $jam = null;

            if (preg_match(
                '/^(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/',
                preg_replace('/\s+/', ' ', trim($time)),
                $parts,
            )) {
                [, $y, $mo, $d, $h, $mi, $s] = $parts;
                $dateTime = sprintf('%s-%s-%sT%s:%s:%s+07:00', $y, $mo, $d, $h, $mi, $s);
                $tanggal = sprintf('%s-%s-%s', $y, $mo, $d);
                $jam = sprintf('%s:%s:%s WIB', $h, $mi, $s);
            }

            $list[] = [
                'eventid' => $row['eventid'] ?? null,
                'status' => $row['status'] ?? null,
                'datetime' => $dateTime,
                'tanggal' => $tanggal,
                'jam' => $jam,
                'latitude' => isset($row['lintang']) ? (float) $row['lintang'] : null,
                'longitude' => isset($row['bujur']) ? (float) $row['bujur'] : null,
                'lintang' => null,
                'bujur' => null,
                'magnitude' => isset($row['mag']) ? (string) $row['mag'] : null,
                'depth' => isset($row['dalam']) ? trim((string) $row['dalam']).' km' : null,
                'region' => $row['area'] ?? null,
                'potential' => null,
                'felt' => null,
                'shakemap' => null,
            ];
        }

        return $list;
    }

    /**
     * Urai satu node payload Nuxt SSR (indeks sudah me-resolve referensi).
     *
     * @param  array<int, mixed>  $payload
     */
    private function nuxtValue(array $payload, int $index): mixed
    {
        if (! array_key_exists($index, $payload)) {
            return null;
        }

        $value = $payload[$index];

        if (! is_array($value)) {
            return $value;
        }

        if (isset($value[0]) && is_string($value[0])) {
            $marker = $value[0];

            return match ($marker) {
                'ShallowReactive', 'Reactive', 'ShallowRef', 'Ref' => isset($value[1])
                    && is_int($value[1]) ? $this->nuxtValue($payload, $value[1]) : null,
                default => null,
            };
        }

        if (array_is_list($value)) {
            return array_map(
                fn (mixed $item): mixed => is_int($item) ? $this->nuxtValue($payload, $item) : $item,
                $value,
            );
        }

        $resolved = [];

        foreach ($value as $key => $item) {
            $resolved[$key] = is_int($item) ? $this->nuxtValue($payload, $item) : $item;
        }

        return $resolved;
    }

    /**
     * Temukan node `Infogempa` di dalam payload yang sudah diurai.
     */
    private function findInfogempa(mixed $node, array &$found = []): array
    {
        if (! is_array($node)) {
            return $found;
        }

        if (array_key_exists('Infogempa', $node)) {
            $found = is_array($node['Infogempa']) ? $node['Infogempa'] : [];

            return $found;
        }

        foreach ($node as $child) {
            if (is_array($child)) {
                $found = $this->findInfogempa($child, $found);
            }
        }

        return $found;
    }

    private function fetchGempa(): array
    {
        $gempaterkini = Http::timeout(20)
            ->get('https://data.bmkg.go.id/DataMKG/TEWS/gempaterkini.json')
            ->json('Infogempa.gempa');

        $autogempa = Http::timeout(20)
            ->get('https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json')
            ->json('Infogempa.gempa');

        $list = [];

        foreach ((is_array($gempaterkini) ? $gempaterkini : []) as $row) {
            $list[] = $this->buildGempaRow($row);
        }

        $latest = $this->buildGempaRow(
            is_array($autogempa) ? $autogempa : [],
        );

        if (is_array($autogempa)) {
            $dateTime = (string) ($autogempa['DateTime'] ?? '');

            if ($dateTime !== '') {
                $latest['potential'] = $this->tsunamiPotential(
                    $dateTime,
                    is_array($gempaterkini) ? $gempaterkini : [],
                );
            }
        }

        return [$latest, $list];
    }

    /**
     * Normalisasi satu baris gempa BMKG ke payload API.
     *
     * @param  array<string, mixed>  $row
     * @return array<string, mixed>
     */
    private function buildGempaRow(array $row): array
    {
        $coordinates = array_values(
            array_filter(
                array_map(
                    'floatval',
                    explode(',', (string) ($row['Coordinates'] ?? '')),
                ),
            ),
        );

        return [
            'datetime' => $row['DateTime'] ?? null,
            'tanggal' => $row['Tanggal'] ?? null,
            'jam' => $row['Jam'] ?? null,
            'latitude' => $coordinates[0] ?? null,
            'longitude' => $coordinates[1] ?? null,
            'lintang' => $row['Lintang'] ?? null,
            'bujur' => $row['Bujur'] ?? null,
            'magnitude' => $row['Magnitude'] ?? null,
            'depth' => $row['Kedalaman'] ?? null,
            'region' => $row['Wilayah'] ?? null,
            'potential' => $row['Potensi'] ?? null,
            'felt' => $row['Dirasakan'] ?? null,
            'shakemap' => $row['Shakemap'] ?? null,
        ];
    }

    /*
     * =====================================================
     * GERAKAN TANAH (PVMBG / VSI)
     *
     * VSI tidak menyediakan API "gerakan tanah" dengan data
     * nyata; feed `/gerakan-tanah?category_id=1` hanya berisi
     * artikel uji-coba. Feed nyata & terbaru adalah laporan
     * tanggapan kejadian geologi (termasuk penyelidikan
     * gerakan tanah / lahan relokasi):
     *   GET https://vsi.esdm.go.id/tanggapan-kejadian/apis/get
     * Hasil di-cache 3 menit.
     * =====================================================
     */

    public function gerakanTanah()
    {
        $data = Cache::remember('geo:gerakan-tanah', 180, function () {
            try {
                $response = Http::timeout(20)->get(
                    'https://vsi.esdm.go.id/tanggapan-kejadian/apis/get',
                    [
                        'page' => 1,
                        'pageSize' => 8,
                        'search' => '',
                    ],
                );

                $items = [];
                $rows = $response->json('serve.data') ?? [];

                if (is_array($rows)) {
                    foreach ($rows as $row) {
                        $title = preg_replace(
                            '/\s+/',
                            ' ',
                            trim((string) ($row['title'] ?? '')),
                        );

                        $items[] = [
                            'id' => $row['id'] ?? null,
                            'title' => $title,
                            'date' => $row['created_at'] ?? null,
                            'url' => $row['vsi_link'] ?? null,
                        ];
                    }
                }

                return ['list' => $items];
            } catch (\Throwable $e) {
                return [
                    'list' => [],
                    'error' => 'Sumber VSI sedang tidak dapat dihubungi.',
                ];
            }
        });

        return response()->json($data);
    }
}
