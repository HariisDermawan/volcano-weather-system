<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

class GeoHazardController extends Controller
{
    public function gempa(): JsonResponse
    {
        $data = Cache::remember('geo:gempa', 90, function () {

            try {
                $list = $this->fetchRealtimeGempa();

                if (! empty($list)) {

                    $gempaterkini = [];

                    try {
                        $gempaterkini = Http::timeout(20)
                            ->get('https://data.bmkg.go.id/DataMKG/TEWS/gempaterkini.json')
                            ->json('Infogempa.gempa') ?? [];
                    } catch (\Throwable $e) {

                    }

                    try {
                        $autogempa = $this->fetchAutogempa(
                            is_array($gempaterkini) ? $gempaterkini : [],
                        );

                        if ($autogempa !== null && ! $this->rowExists($autogempa, $list)) {
                            $list[] = $autogempa;
                        }
                    } catch (\Throwable $e) {

                    }

                    foreach ($list as &$item) {
                        $dt = (string) ($item['datetime'] ?? '');

                        if ($dt !== '') {
                            $coords = isset($item['latitude'], $item['longitude'])
                                ? sprintf('%.2f,%.2f', $item['latitude'], $item['longitude'])
                                : '';

                            $item['potential'] = $this->tsunamiPotential(
                                $dt,
                                $coords,
                                is_array($gempaterkini) ? $gempaterkini : [],
                            );
                        }
                    }

                    unset($item);

                    $list = $this->sortUniqueGempa($list);

                    $latest = $list[0];

                    return ['latest' => $latest, 'list' => $list];
                }
            } catch (\Throwable $e) {

            }

            try {
                $latest = $this->fetchAutogempa();

                if ($latest !== null) {
                    return ['latest' => $latest, 'list' => [$latest]];
                }
            } catch (\Throwable $e) {

            }

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

        $latest = $data['latest'] ?? null;

        $list = $data['list'];

        if ($latest === null && count($list) > 0) {
            $latest = $list[0];
        }

        $data['list'] = array_slice($list, 0, 2);
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
     * @param  array<int, array<string, mixed>>|null  $gempaterkini  Baris gempaterkini.json yang sudah diambil pemanggil.
     * @return array<string, mixed>|null
     */
    private function fetchAutogempa(?array $gempaterkini = null): ?array
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
            if ($gempaterkini === null) {
                $gempaterkini = Http::timeout(20)
                    ->get('https://data.bmkg.go.id/DataMKG/TEWS/gempaterkini.json')
                    ->json('Infogempa.gempa');
            }

            $gempa['potential'] = $this->tsunamiPotential(
                $dateTime,
                (string) ($row['Coordinates'] ?? ''),
                is_array($gempaterkini) ? $gempaterkini : [],
            );
        }

        return $gempa;
    }

    /**
     * Penilaian tsunami yang akurat untuk satu kejadian gempa.
     *
     * Mencocokkan waktu kejadian DAN koordinat, sehingga jika ada
     * dua gempa pada jam yang sama tetapi lokasi berbeda, masing-masing
     * mendapat potensi tsunami yang benar (tidak saling tertukar).
     *
     * @param  string  $dateTime  Waktu kejadian (ISO dengan timezone).
     * @param  string  $coordinates  Koordinat "lat,lon" (2 desimal), boleh kosong.
     * @param  array<int, array<string, mixed>>  $gempaterkini  Baris mentah gempaterkini.json.
     */
    private function tsunamiPotential(string $dateTime, string $coordinates, array $gempaterkini): ?string
    {
        $normalize = function (string $value): string {
            return trim(preg_replace('/\s+/', '', $value) ?? '');
        };

        $wantTime = strtotime($dateTime);
        $wantCoords = $normalize($coordinates);

        foreach ($gempaterkini as $row) {
            $candidate = $row['DateTime'] ?? null;

            if (! is_string($candidate) || $candidate === '') {
                continue;
            }

            if (strtotime($candidate) !== $wantTime) {
                continue;
            }

            if ($wantCoords !== '') {
                $candidateCoords = $normalize((string) ($row['Coordinates'] ?? ''));

                if ($candidateCoords !== '' && $candidateCoords !== $wantCoords) {
                    continue;
                }
            }

            $potensi = $row['Potensi'] ?? null;

            return is_string($potensi) && $potensi !== '' ? $potensi : null;
        }

        return null;
    }

    /**
     * Cek apakah sebuah baris gempa sudah ada di dalam list.
     *
     * Baris dianggap sama bila waktu kejadian sama DAN (jika keduanya
     * punya koordinat) koordinatnya juga sama.
     *
     * @param  array<string, mixed>  $needle
     * @param  array<int, array<string, mixed>>  $list
     */
    private function rowExists(array $needle, array $list): bool
    {
        $time = strtotime((string) ($needle['datetime'] ?? ''));

        $coords = $this->coordsKey($needle);

        foreach ($list as $row) {
            if (strtotime((string) ($row['datetime'] ?? '')) !== $time) {
                continue;
            }

            $rowCoords = $this->coordsKey($row);

            if ($coords === null || $rowCoords === null) {
                return true;
            }

            if ($coords === $rowCoords) {
                return true;
            }
        }

        return false;
    }

    /**
     * Kunci koordinat berbentuk "lat,lon" (2 desimal) atau null bila
     * salah satu koordinat tidak valid.
     *
     * @param  array<string, mixed>  $row
     */
    private function coordsKey(array $row): ?string
    {
        if (! isset($row['latitude'], $row['longitude'])) {
            return null;
        }

        $lat = is_numeric($row['latitude']) ? (float) $row['latitude'] : null;
        $lon = is_numeric($row['longitude']) ? (float) $row['longitude'] : null;

        if ($lat === null || $lon === null) {
            return null;
        }

        return sprintf('%.2f,%.2f', $lat, $lon);
    }

    /**
     * Urutkan baris gempa dari yang terbaru dan buang baris duplikat.
     *
     * @param  array<int, array<string, mixed>>  $list
     * @return array<int, array<string, mixed>>
     */
    private function sortUniqueGempa(array $list): array
    {
        $unique = [];

        foreach ($list as $row) {
            foreach ($unique as $existing) {
                if (strtotime((string) ($existing['datetime'] ?? ''))
                    !== strtotime((string) ($row['datetime'] ?? ''))) {
                    continue;
                }

                $coords = $this->coordsKey($row);
                $existingCoords = $this->coordsKey($existing);

                if ($coords === null || $existingCoords === null || $coords === $existingCoords) {
                    continue 2;
                }
            }

            $unique[] = $row;
        }

        usort($unique, static function (array $a, array $b): int {
            $ta = strtotime((string) ($a['datetime'] ?? ''));
            $tb = strtotime((string) ($b['datetime'] ?? ''));

            if ($ta === false && $tb === false) {
                return 0;
            }

            if ($ta === false) {
                return 1;
            }

            if ($tb === false) {
                return -1;
            }

            return $tb <=> $ta;
        });

        return $unique;
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

                $dateTime = sprintf('%s-%s-%sT%s:%s:%s+00:00', $y, $mo, $d, $h, $mi, $s);

                try {
                    $wib = (new \DateTimeImmutable($dateTime))
                        ->setTimezone(new \DateTimeZone('Asia/Jakarta'));

                    $tanggal = $wib->format('Y-m-d');
                    $jam = $wib->format('H:i:s').' WIB';
                } catch (\Exception $e) {
                    $tanggal = sprintf('%s-%s-%s', $y, $mo, $d);
                    $jam = sprintf('%s:%s:%s WIB', $h, $mi, $s);
                }
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
     *
     * @return array<string, mixed>
     */
    private function findInfogempa(mixed $node): array
    {
        if (! is_array($node)) {
            return [];
        }

        if (array_key_exists('Infogempa', $node)) {
            return is_array($node['Infogempa']) ? $node['Infogempa'] : [];
        }

        foreach ($node as $child) {
            if (is_array($child)) {
                $result = $this->findInfogempa($child);

                if ($result !== []) {
                    return $result;
                }
            }
        }

        return [];
    }

    /**
     * Ambil gempa terkini dari gempaterkini.json + autogempa.json.
     *
     * @return array{0: array<string, mixed>, 1: list<array<string, mixed>>}
     */
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
                    (string) ($autogempa['Coordinates'] ?? ''),
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

    public function gerakanTanah(): JsonResponse
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
                            'thumbnail' => $row['thumbnail'] ?? null,
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
