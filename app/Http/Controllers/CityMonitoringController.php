<?php

namespace App\Http\Controllers;

use App\Models\Volcano;
use App\Services\VaacDarwinService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

class CityMonitoringController extends Controller
{
    private const GEOCODE_CACHE_TTL = 86400;

    private const USER_AGENT = 'Pantau-Abu-Vulkanik/1.0 (+monitoring lokal)';

    private const BMKG_URL = 'https://api.bmkg.go.id/publik/prakiraan-cuaca';

    private const BMKG_CACHE_TTL = 1800;

    private const ADM4_CACHE_TTL = 604800;

    private const WILAYAH_DB_PATH = 'python-service/wilayah-adm4/locations.db';

    private const MAX_ADM4_DISTANCE_KM = 40;

    public function show(
        Request $request,
        VaacDarwinService $vaac,
    ): JsonResponse {
        $lat = $request->query('lat');
        $lon = $request->query('lon');

        if (! is_numeric($lat) || ! is_numeric($lon)) {
            return response()->json([
                'error' => 'Parameter lat dan lon (decimal) wajib diisi.',
            ], 422);
        }

        $latitude = (float) $lat;
        $longitude = (float) $lon;

        if (
            $latitude < -90 ||
            $latitude > 90 ||
            $longitude < -180 ||
            $longitude > 180
        ) {
            return response()->json([
                'error' => 'Koordinat di luar jangkauan yang valid.',
            ], 422);
        }

        $city = $this->resolveCity($latitude, $longitude);

        $weather = $this->resolveCityWeather($latitude, $longitude);

        $activeAdvisories = $this->activeAdvisories(
            $vaac->getLiveAdvisories(),
        );

        $insidePlume = false;
        $minEdgeKm = null;
        $nearestVolcano = null;
        $plumeVolcanoes = [];

        foreach ($activeAdvisories as $advisory) {
            $volcanoId = $advisory['volcano_id'] ?? null;

            if (! is_int($volcanoId)) {
                continue;
            }

            $geometries = $this->collectGeometries(
                $advisory['geometry'] ?? null,
                $advisory['fcst_geometries'] ?? [],
            );

            if ($geometries === []) {
                continue;
            }

            foreach ($geometries as $geometry) {
                if ($this->pointInPolygon($latitude, $longitude, $geometry)) {
                    $insidePlume = true;
                }
            }

            $edgeKm = $this->minEdgeDistanceKm(
                $latitude,
                $longitude,
                $geometries,
            );

            if (
                $edgeKm !== null &&
                ($minEdgeKm === null || $edgeKm < $minEdgeKm)
            ) {
                $minEdgeKm = $edgeKm;
                $nearestVolcano = $volcanoId;
            }

            $plumeVolcanoes[] = $volcanoId;
        }

        if ($insidePlume) {
            $minEdgeKm = 0.0;
        }

        $names = $plumeVolcanoes === [] ? [] : Volcano::whereIn(
            'id',
            array_unique(array_merge($plumeVolcanoes, $nearestVolcano !== null ? [$nearestVolcano] : [])),
        )->pluck('name', 'id');

        return response()->json([
            'city' => $city,
            'summary' => [
                'ash_edge_km' => $minEdgeKm,
                'inside_plume' => $insidePlume,
                'nearest_ash_volcano' => $nearestVolcano !== null
                    ? ($names[$nearestVolcano] ?? null)
                    : null,
                'plume_volcanoes' => collect($plumeVolcanoes)
                    ->unique()
                    ->map(fn (int $id): ?string => $names[$id] ?? null)
                    ->values(),
            ],
            'weather' => $weather,
        ]);
    }

    /**
     * Advisory live yang masih menampilkan abu (< 24 jam).
     *
     * @param  array<int, array<string, mixed>>  $advisories
     * @return array<int, array<string, mixed>>
     */
    private function activeAdvisories(array $advisories): array
    {
        $since = now()->subHours(24)->getTimestamp();
        $active = [];

        foreach ($advisories as $advisory) {
            $issuedAt = $advisory['issued_at'] ?? null;
            $issuedTs = $issuedAt instanceof \DateTimeInterface
                ? $issuedAt->getTimestamp()
                : null;

            if (
                ($advisory['ash_detected'] ?? false)
                && $issuedTs !== null
                && $issuedTs >= $since
            ) {
                $active[] = $advisory;
            }
        }

        return $active;
    }

    /**
     * Cuaca BMKG terkini untuk koordinat pengguna.
     *
     * ADM4 (desa) terdekat diambil dari database wilayah, lalu prakiraan
     * BMKG dicache per ADM4 selama 30 menit agar tidak membebani rate
     * limit API BMKG. Mengembalikan null bila wilayah tidak dikenal atau
     * fetch BMKG gagal, frontend kemudian memakai cadangan Open-Meteo.
     *
     * @return array<string, mixed>|null
     */
    private function resolveCityWeather(
        float $latitude,
        float $longitude,
    ): ?array {
        $adm4 = $this->resolveAdm4($latitude, $longitude);

        if ($adm4 === null) {
            return null;
        }

        $code = is_string($adm4['kode'] ?? null) ? $adm4['kode'] : null;

        if ($code === null) {
            return null;
        }

        $cacheKey = 'bmkg:city:weather:v1:'.$code;

        $cached = Cache::get($cacheKey);

        if (is_array($cached)) {
            return $cached;
        }

        $weather = $this->fetchAndBuildCityWeather($adm4);

        if (is_array($weather)) {
            Cache::put($cacheKey, $weather, self::BMKG_CACHE_TTL);
        }

        return $weather;
    }

    /**
     * Desa ADM4 (kode wilayah BMKG) terdekat dari koordinat GPS.
     *
     * @return array<string, mixed>|null
     */
    private function resolveAdm4(float $latitude, float $longitude): ?array
    {
        $key = 'geo:adm4:v2:'.(int) round($latitude * 1000).':'.(int) round($longitude * 1000);

        $cached = Cache::get($key);

        if (is_array($cached)) {
            return $cached;
        }

        $adm4 = $this->findNearestAdm4($latitude, $longitude);

        if (is_array($adm4)) {
            Cache::put($key, $adm4, self::ADM4_CACHE_TTL);
        }

        return $adm4;
    }

    /**
     * Cari desa terdekat pada database wilayah adm4 (SQLite read-only).
     *
     * Filter bounding-box dulu, lalu perhitungan haversine untuk presisi.
     * Cukup dengan query satu tabel; database hanya dibaca.
     *
     * @return array<string, mixed>|null
     */
    private function findNearestAdm4(float $latitude, float $longitude): ?array
    {
        $path = base_path(self::WILAYAH_DB_PATH);

        if (! is_file($path)) {
            return null;
        }

        try {
            $pdo = new \PDO('sqlite:'.$path, null, null, [
                \PDO::ATTR_ERRMODE => \PDO::ERRMODE_EXCEPTION,
                \PDO::ATTR_TIMEOUT => 5,
            ]);

            $delta = 0.5;
            $minLat = $latitude - $delta;
            $maxLat = $latitude + $delta;
            $minLon = $longitude - $delta;
            $maxLon = $longitude + $delta;

            $statement = $pdo->prepare(
                'SELECT kode, nama, kecamatan, kota, provinsi, lat, lon
                 FROM locations
                 WHERE lat BETWEEN :minLat AND :maxLat
                   AND lon BETWEEN :minLon AND :maxLon',
            );

            $statement->execute([
                'minLat' => $minLat,
                'maxLat' => $maxLat,
                'minLon' => $minLon,
                'maxLon' => $maxLon,
            ]);

            /** @var list<array<string, mixed>> $rows */
            $rows = $statement->fetchAll(\PDO::FETCH_ASSOC);
        } catch (\Throwable) {
            return null;
        } finally {
            $pdo = null;
        }

        $best = null;
        $bestDistance = null;

        foreach ($rows as $row) {
            $distance = $this->haversineKm(
                $latitude,
                $longitude,
                (float) ($row['lat'] ?? 0),
                (float) ($row['lon'] ?? 0),
            );

            if ($bestDistance === null || $distance < $bestDistance) {
                $bestDistance = $distance;
                $best = $row;
            }
        }

        if ($best === null || $bestDistance > self::MAX_ADM4_DISTANCE_KM) {
            return null;
        }

        $best['distance_km'] = round($bestDistance, 2);

        return $best;
    }

    private function haversineKm(
        float $lat1,
        float $lon1,
        float $lat2,
        float $lon2,
    ): float {
        $radius = 6371.0;

        $phi1 = deg2rad($lat1);
        $phi2 = deg2rad($lat2);

        $dPhi = deg2rad($lat2 - $lat1);
        $dLambda = deg2rad($lon2 - $lon1);

        $a = sin($dPhi / 2) ** 2
            + cos($phi1) * cos($phi2) * sin($dLambda / 2) ** 2;

        return $radius * 2 * asin(sqrt($a));
    }

    /**
     * Ambil prakiraan BMKG untuk ADM4 lalu susun payload cuaca kota.
     *
     * @param  array<string, mixed>  $adm4
     * @return array<string, mixed>|null
     */
    private function fetchAndBuildCityWeather(array $adm4): ?array
    {
        $code = is_string($adm4['kode'] ?? null) ? $adm4['kode'] : null;

        if ($code === null) {
            return null;
        }

        try {
            $json = Http::retry(3, 500, null, false)
                ->timeout(25)
                ->withHeaders([
                    'User-Agent' => self::USER_AGENT,
                    'Accept' => 'application/json',
                ])
                ->get(self::BMKG_URL, ['adm4' => $code])
                ->json();
        } catch (\Throwable) {
            return null;
        }

        if (! is_array($json)) {
            return null;
        }

        $entries = $this->flattenBmkgForecasts($json);

        if ($entries === []) {
            return null;
        }

        $entry = $this->pickNearestForecast($entries);

        if ($entry === null) {
            return null;
        }

        $lokasi = is_array($json['lokasi'] ?? null) ? $json['lokasi'] : [];

        return $this->buildCityWeather($adm4, $lokasi, $entry);
    }

    /**
     * Ratakan kelompok prakiraan BMKG (data[].cuaca[][]) jadi daftar entri.
     *
     * @param  array<string, mixed>  $json
     * @return list<array<string, mixed>>
     */
    private function flattenBmkgForecasts(array $json): array
    {
        $entries = [];

        $data = $json['data'] ?? [];

        if (! is_array($data)) {
            return [];
        }

        foreach ($data as $item) {
            if (! is_array($item)) {
                continue;
            }

            $cuaca = $item['cuaca'] ?? [];

            if (! is_array($cuaca)) {
                continue;
            }

            foreach ($cuaca as $group) {
                if (! is_array($group)) {
                    continue;
                }

                foreach ($group as $forecast) {
                    if (is_array($forecast)) {
                        $entries[] = $forecast;
                    }
                }
            }
        }

        return $entries;
    }

    /**
     * Pilih entri prakiraan yang paling dekat dengan waktu sekarang (WIB).
     *
     * @param  list<array<string, mixed>>  $entries
     * @return array<string, mixed>|null
     */
    private function pickNearestForecast(array $entries): ?array
    {
        $now = new \DateTimeImmutable(
            'now',
            new \DateTimeZone('Asia/Jakarta'),
        );

        $best = null;
        $bestDiff = null;

        foreach ($entries as $entry) {
            $local = $entry['local_datetime'] ?? null;

            if (! is_string($local)) {
                $best ??= $entry;

                continue;
            }

            try {
                $date = new \DateTimeImmutable(
                    $local,
                    new \DateTimeZone('Asia/Jakarta'),
                );
            } catch (\Throwable) {
                $best ??= $entry;

                continue;
            }

            $diff = abs($date->getTimestamp() - $now->getTimestamp());

            if ($bestDiff === null || $diff < $bestDiff) {
                $bestDiff = $diff;
                $best = $entry;
            }
        }

        return $best;
    }

    /**
     * Susun payload cuaca kota dari entri prakiraan BMKG terpilih.
     *
     * BMKG tidak menyediakan tekanan, hembusan angin, maupun suhu terasa,
     * jadi field tersebut sengaja tidak diisi (null).
     *
     * @param  array<string, mixed>  $adm4
     * @param  array<string, mixed>  $lokasi
     * @param  array<string, mixed>  $entry
     * @return array<string, mixed>
     */
    private function buildCityWeather(
        array $adm4,
        array $lokasi,
        array $entry,
    ): array {
        $location = collect([
            $lokasi['desa'] ?? null,
            $lokasi['kecamatan'] ?? null,
            $lokasi['kotkab'] ?? null,
        ])
            ->filter(fn ($part): bool => is_string($part) && $part !== '')
            ->values()
            ->implode(', ');

        return [
            'source' => 'BMKG',
            'adm4' => $adm4['kode'] ?? null,
            'location' => $location === '' ? null : $location,
            'time' => $entry['local_datetime'] ?? null,
            'temperature' => isset($entry['t'])
                ? round((float) $entry['t'], 1)
                : null,
            'humidity' => isset($entry['hu'])
                ? round((float) $entry['hu'], 1)
                : null,
            'wind_speed' => isset($entry['ws'])
                ? round((float) $entry['ws'], 1)
                : null,
            'wind_direction_deg' => isset($entry['wd_deg'])
                ? (float) $entry['wd_deg']
                : null,
            'wind_direction_cardinal' => is_string($entry['wd'] ?? null)
                ? $entry['wd']
                : null,
            'visibility' => isset($entry['vs'])
                ? (float) $entry['vs']
                : null,
            'visibility_text' => is_string($entry['vs_text'] ?? null)
                ? $entry['vs_text']
                : null,
            'weather_code' => isset($entry['weather'])
                ? (int) $entry['weather']
                : null,
            'weather_desc' => is_string($entry['weather_desc'] ?? null)
                ? $entry['weather_desc']
                : null,
        ];
    }

    /**
     * Gabungkan geometri observasi + semua prediksi menjadi satu daftar.
     *
     * @param  array<string, mixed>|null  $geometry
     * @param  array<int, mixed>  $fcstGeometries
     * @return array<int, array<string, mixed>>
     */
    private function collectGeometries(
        ?array $geometry,
        array $fcstGeometries,
    ): array {
        $list = [];

        if (is_array($geometry)) {
            $list[] = $geometry;
        }

        foreach ($fcstGeometries as $fcst) {
            if (is_array($fcst)) {
                $list[] = $fcst;
            }
        }

        return $list;
    }

    /**
     * Jarak minimum titik kota ke tepi poligon sebaran abu (km).
     *
     * @param  array<int, array<string, mixed>>  $geometries
     */
    private function minEdgeDistanceKm(
        float $latitude,
        float $longitude,
        array $geometries,
    ): ?float {

        $metersPerDegLat = 110540.0;
        $metersPerDegLon = 111320.0 * cos(deg2rad($latitude));

        $min = null;

        foreach ($geometries as $geometry) {
            $ring = $geometry['coordinates'][0] ?? null;

            if (! is_array($ring) || count($ring) < 3) {
                continue;
            }

            $count = count($ring);

            for ($i = 0; $i < $count; $i++) {
                $j = ($i + 1) % $count;

                $ax = $ring[$i][0] ?? null;
                $ay = $ring[$i][1] ?? null;
                $bx = $ring[$j][0] ?? null;
                $by = $ring[$j][1] ?? null;

                if (
                    ! is_numeric($ax) ||
                    ! is_numeric($ay) ||
                    ! is_numeric($bx) ||
                    ! is_numeric($by)
                ) {
                    continue;
                }

                $distance = $this->pointSegmentDistance(
                    0.0,
                    0.0,
                    ((float) $ax - $longitude) * $metersPerDegLon,
                    ((float) $ay - $latitude) * $metersPerDegLat,
                    ((float) $bx - $longitude) * $metersPerDegLon,
                    ((float) $by - $latitude) * $metersPerDegLat,
                );

                if ($min === null || $distance < $min) {
                    $min = $distance;
                }
            }
        }

        return $min === null ? null : $min / 1000.0;
    }

    private function pointSegmentDistance(
        float $px,
        float $py,
        float $ax,
        float $ay,
        float $bx,
        float $by,
    ): float {
        $dx = $bx - $ax;
        $dy = $by - $ay;

        $squared = $dx * $dx + $dy * $dy;

        if ($squared === 0.0) {
            return hypot($px - $ax, $py - $ay);
        }

        $t = max(0.0, min(1.0, (($px - $ax) * $dx + ($py - $ay) * $dy) / $squared));

        $cx = $ax + $t * $dx;
        $cy = $ay + $t * $dy;

        return hypot($px - $cx, $py - $cy);
    }

    /**
     * Uji titik terhadap poligon GeoJSON (ray casting).
     *
     * @param  array<string, mixed>  $geometry
     */
    private function pointInPolygon(
        float $latitude,
        float $longitude,
        array $geometry,
    ): bool {
        $coordinates = $geometry['coordinates'] ?? null;
        $ring = is_array($coordinates) ? ($coordinates[0] ?? null) : null;

        if (! is_array($ring)) {
            return false;
        }

        $inside = false;

        $count = count($ring);

        if ($count < 3) {
            return false;
        }

        for ($i = 0, $j = $count - 1; $i < $count; $j = $i++) {
            $xi = $ring[$i][0] ?? null;
            $yi = $ring[$i][1] ?? null;
            $xj = $ring[$j][0] ?? null;
            $yj = $ring[$j][1] ?? null;

            if (
                ! is_numeric($xi) ||
                ! is_numeric($yi) ||
                ! is_numeric($xj) ||
                ! is_numeric($yj)
            ) {
                continue;
            }

            $intersect = (($yi > $latitude) !== ($yj > $latitude))
                && ($longitude < ($xj - $xi) * ($latitude - $yi) / ($yj - $yi) + $xi);

            if ($intersect) {
                $inside = ! $inside;
            }
        }

        return $inside;
    }

    /**
     * Ubah koordinat menjadi nama kota melalui reverse geocoding.
     *
     * @return array<string, mixed>
     */
    private function resolveCity(float $latitude, float $longitude): array
    {
        $key = 'geo:city:v4:'.(int) round($latitude * 1000).':'.(int) round($longitude * 1000);

        $cached = Cache::get($key);

        if (is_array($cached)) {
            return $cached;
        }

        $geocoded = $this->geocodeNominatim($latitude, $longitude)
            ?? $this->geocodeBigDataCloud($latitude, $longitude)
            ?? [];

        $result = [
            'name' => $geocoded['name'] ?? null,
            'district' => $geocoded['district'] ?? null,
            'provinsi' => $geocoded['provinsi'] ?? null,
            'country' => $geocoded['country'] ?? null,
            'latitude' => $latitude,
            'longitude' => $longitude,
            'geocode_source' => $geocoded['source'] ?? null,
        ];

        Cache::put($key, $result, self::GEOCODE_CACHE_TTL);

        return $result;
    }

    /**
     * Reverse geocode via Nominatim/OpenStreetMap.
     *
     * DKI Jakarta adalah provinsi sekaligus satuan setingkat kota, sehingga
     * Nominatim menaruh "Daerah Khusus Ibukota Jakarta" pada kunci `city`.
     * Dalam kasus ini nama kota diganti ke kota administrasi (mis. "Jakarta
     * Pusat") dan provinsi diisi "DKI Jakarta" agar label tetap benar.
     *
     * @return array<string, mixed>|null
     */
    private function geocodeNominatim(float $latitude, float $longitude): ?array
    {
        try {
            $json = Http::timeout(8)
                ->withHeaders(['User-Agent' => self::USER_AGENT])
                ->get(
                    'https://nominatim.openstreetmap.org/reverse',
                    [
                        'lat' => $latitude,
                        'lon' => $longitude,
                        'format' => 'jsonv2',
                        'accept-language' => 'id',
                        'zoom' => 12,
                    ],
                )
                ->json();

            if (! is_array($json)) {
                return null;
            }

            $address = is_array($json['address'] ?? null) ? $json['address'] : [];

            $rawCity = $address['city'] ?? null;
            $district = $address['neighbourhood']
                ?? $address['suburb']
                ?? $address['city_district']
                ?? $address['town']
                ?? $address['village']
                ?? null;

            $name = is_string($rawCity) ? $rawCity : null;
            $provinsi = $address['state'] ?? $address['province'] ?? null;

            if (
                is_string($name)
                && in_array(
                    strtolower($name),
                    ['daerah khusus ibukota jakarta', 'dki jakarta', 'jakarta raya'],
                    true,
                )
            ) {
                $name = is_string($address['city_district'] ?? null)
                    ? $address['city_district']
                    : null;
                $provinsi = 'DKI Jakarta';
            } elseif (
                ! is_string($provinsi)
                && ($address['ISO3166-2-lvl4'] ?? null) === 'ID-JK'
            ) {
                $provinsi = 'DKI Jakarta';
            }

            if (! is_string($name) || $name === '') {
                $name = is_string($address['city_district'] ?? null)
                    ? $address['city_district']
                    : null;
            }

            if (! is_string($name) || $name === '') {
                $name = $address['town'] ?? $address['village'] ?? null;
            }

            if (! is_string($name) || $name === '') {
                return null;
            }

            return [
                'name' => $name,
                'district' => is_string($district) ? $district : null,
                'provinsi' => is_string($provinsi) ? $provinsi : null,
                'country' => is_string($address['country'] ?? null)
                    ? $address['country']
                    : null,
                'source' => 'nominatim',
            ];
        } catch (\Throwable) {
            return null;
        }
    }

    /**
     * Reverse geocode fallback via BigDataCloud (gratis, tanpa API key).
     *
     * Nama provinsi/kota/kecamatan diambil dari `localityInfo.administrative`
     * (adminLevel 4/5/6) — bukan `principalSubdivision` yang untuk Indonesia
     * mengembalikan nama pulau (mis. "Jawa"), bukan provinsi.
     *
     * @return array<string, mixed>|null
     */
    private function geocodeBigDataCloud(float $latitude, float $longitude): ?array
    {
        try {
            $json = Http::timeout(8)
                ->withHeaders(['User-Agent' => self::USER_AGENT])
                ->get(
                    'https://api.bigdatacloud.net/data/reverse-geocode-client',
                    [
                        'latitude' => $latitude,
                        'longitude' => $longitude,
                        'localityLanguage' => 'id',
                    ],
                )
                ->json();

            if (! is_array($json)) {
                return null;
            }

            $provinsi = null;
            $city = null;
            $district = null;

            $administrative = $json['localityInfo']['administrative'] ?? null;

            if (is_array($administrative)) {
                foreach ($administrative as $entry) {
                    if (! is_array($entry)) {
                        continue;
                    }

                    $level = $entry['adminLevel'] ?? null;
                    $entryName = is_string($entry['name'] ?? null)
                        ? $entry['name']
                        : null;

                    if (! is_string($entryName) || $entryName === '') {
                        continue;
                    }

                    if ($level === 4 && $provinsi === null) {
                        $provinsi = $entryName;
                    } elseif ($level === 5 && $city === null) {
                        $city = $entryName;
                    } elseif ($level === 6 && $district === null) {
                        $district = $entryName;
                    }
                }
            }

            $candidates = [
                $city,
                is_string($json['city'] ?? null) ? $json['city'] : null,
                is_string($json['locality'] ?? null) ? $json['locality'] : null,
                $provinsi,
                is_string($json['countryName'] ?? null) ? $json['countryName'] : null,
            ];

            $name = null;

            foreach ($candidates as $candidate) {
                if (is_string($candidate) && $candidate !== '') {
                    $name = $candidate;

                    break;
                }
            }

            if ($name === null) {
                return null;
            }

            return [
                'name' => $name,
                'district' => $district,
                'provinsi' => is_string($provinsi) ? $provinsi : null,
                'country' => is_string($json['countryName'] ?? null) ? $json['countryName'] : null,
                'source' => 'bigdatacloud',
            ];
        } catch (\Throwable) {
            return null;
        }
    }
}
