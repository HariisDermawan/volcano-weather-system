<?php

namespace App\Http\Controllers;

use App\Models\Volcano;
use App\Services\VaacDarwinService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

/**
 * Monitoring real-time sebaran abu vulkanik ke kota
 * pengguna berdasarkan koordinat lokasi saat ini.
 */
class CityMonitoringController extends Controller
{
    private const GEOCODE_CACHE_TTL = 86400;

    private const USER_AGENT = 'Pantau-Abu-Vulkanik/1.0 (+monitoring lokal)';

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

        // Advisory abu VAAC Darwin real-time (cached 2m),
        // diambil hanya untuk gunung yang abunya aktif (< 24 jam).
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

        // Nama gunung untuk respons (hanya yang benar-benar dipakai).
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
        // Proyeksi equirectangular lokal sekitar titik kota:
        // akurat untuk radius ratusan km di sekitar gunung berapi.
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

    /**
     * Jarak titik (px,py) ke segmen [a,b] pada bidang (meter).
     */
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
        $key = 'geo:city:v3:'.(int) round($latitude * 1000).':'.(int) round($longitude * 1000);

        $cached = Cache::get($key);

        if (is_array($cached)) {
            return $cached;
        }

        // Nominatim diprioritaskan: admin boundaries Indonesia
        // umumnya lebih tepat (kota + provinsi). BigDataCloud jadi cadangan.
        $geocoded = $this->geocodeNominatim($latitude, $longitude)
            ?? $this->geocodeBigDataCloud($latitude, $longitude)
            ?? [];

        $result = [
            'name' => $geocoded['name'] ?? null,
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

            $name = $address['city']
                ?? $address['town']
                ?? $address['village']
                ?? $address['municipality']
                ?? null;
            $provinsi = $address['state']
                ?? $address['province']
                ?? null;
            $country = $address['country'] ?? null;

            return [
                'name' => is_string($name) ? $name : null,
                'provinsi' => is_string($provinsi) ? $provinsi : null,
                'country' => is_string($country) ? $country : null,
                'source' => 'nominatim',
            ];
        } catch (\Throwable) {
            return null;
        }
    }

    /**
     * Reverse geocode fallback via BigDataCloud (gratis, tanpa API key).
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

            $name = $json['city'] ?? $json['locality'] ?? null;
            $provinsi = $json['principalSubdivision'] ?? null;
            $country = $json['countryName'] ?? null;

            if (! is_string($name) || $name === '') {
                $name = is_string($provinsi) ? $provinsi : null;
            }

            if (! is_string($name) || $name === '') {
                $name = is_string($country) ? $country : null;
            }

            return [
                'name' => $name,
                'provinsi' => is_string($provinsi) ? $provinsi : null,
                'country' => is_string($country) ? $country : null,
                'source' => 'bigdatacloud',
            ];
        } catch (\Throwable) {
            return null;
        }
    }
}
