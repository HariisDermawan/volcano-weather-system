<?php

namespace App\Http\Controllers;

use App\Models\AshAdvisory;
use App\Models\AshPrediction;
use App\Models\Eruption;
use App\Models\Volcano;
use App\Models\WeatherCurrent;
use App\Models\WeatherForecast;
use App\Services\MagmaService;
use App\Services\VaacDarwinService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class MonitoringController extends Controller
{
    public function show(
        Volcano $volcano,
        VaacDarwinService $vaac,
        MagmaService $magma,
    ): JsonResponse {

        $liveStatus = $magma->getStatusForVolcano(
            $volcano->name
        );

        $volcanoStatus = $liveStatus['label'] ?? $volcano->status;

        $eruptingNames = array_flip($magma->getEruptingVolcanoNames());

        $erupting = isset($eruptingNames[$magma->normalizeName(
            $volcano->name
        )]);

        $liveEruption = $magma->getLatestEruptionForVolcano(
            $volcano->name
        );

        $volcanoEruptions = $magma->getEruptionsForVolcano(
            $volcano->name
        );

        if ($liveEruption !== null) {
            $liveEruption['activity_level'] = $volcanoStatus;
            $activity = $liveEruption;
        } else {
            $activity = Eruption::where(
                'volcano_id',
                $volcano->id
            )
                ->latest('occurred_at')
                ->first();
        }

        $ashPredictions = AshPrediction::where(
            'volcano_id',
            $volcano->id
        )
            ->orderBy('forecast_at')
            ->get();

        $ashPrediction = $ashPredictions->first();

        $weather = null;

        if (
            $ashPrediction &&
            $ashPrediction->forecast_at
        ) {
            $weather = WeatherForecast::where(
                'volcano_id',
                $volcano->id
            )
                ->where(
                    'forecast_at',
                    $ashPrediction->forecast_at
                )
                ->first();
        }

        if (! $weather) {
            $weather = WeatherForecast::where(
                'volcano_id',
                $volcano->id
            )
                ->where(
                    'forecast_at',
                    '>=',
                    now()
                )
                ->orderBy('forecast_at')
                ->first();
        }

        $weatherForecasts = WeatherForecast::where(
            'volcano_id',
            $volcano->id
        )
            ->orderBy('forecast_at')
            ->get();

        $weatherLocation = DB::table('volcano_weather_sources')
            ->where('volcano_id', $volcano->id)
            ->where('source', 'BMKG')
            ->value('location_name');

        $currentWeather = WeatherCurrent::where(
            'volcano_id',
            $volcano->id
        )
            ->latest('observed_at')
            ->first();

        $liveAdvisory = $vaac->getLatestForVolcano(
            $volcano->id
        );

        $ashAdvisory = null;
        $advisorySource = null;

        if ($liveAdvisory !== null) {
            $advisorySource = 'live';
            $ashAdvisory = (object) $liveAdvisory;
        } else {

            $ashAdvisory = AshAdvisory::where(
                'volcano_id',
                $volcano->id
            )
                ->latest('issued_at')
                ->first();

            if (! $ashAdvisory) {
                $baseName = preg_replace(
                    '/^Gunung\s+/i',
                    '',
                    trim($volcano->name)
                );

                $matchingIds = Volcano::where(
                    'id',
                    '!=',
                    $volcano->id
                )
                    ->where(function ($query) use (
                        $volcano,
                        $baseName
                    ) {
                        $query->where(
                            'name',
                            $volcano->name
                        )->orWhere(
                            'name',
                            'Gunung '.$baseName
                        )->orWhere(
                            'name',
                            $baseName
                        );
                    })
                    ->pluck('id');

                if ($matchingIds->isEmpty()) {
                    $matchingIds = Volcano::where(
                        'id',
                        '!=',
                        $volcano->id
                    )
                        ->where(
                            'name',
                            'like',
                            '%'.$baseName.'%'
                        )
                        ->pluck('id');
                }

                $ashAdvisory = AshAdvisory::whereIn(
                    'volcano_id',
                    $matchingIds->push($volcano->id)
                )
                    ->latest('issued_at')
                    ->first();
            }

            if ($ashAdvisory) {
                $advisorySource = 'database';
            }
        }

        $issuedAt = $ashAdvisory->issued_at ?? null;

        if ($issuedAt instanceof \DateTimeInterface) {
            $issuedTimestamp = $issuedAt->getTimestamp();
        } elseif (is_string($issuedAt)) {
            $issuedTimestamp = strtotime($issuedAt);
        } else {
            $issuedTimestamp = null;
        }

        $ashActive = $ashAdvisory !== null
            && ($ashAdvisory->ash_detected ?? false)
            && $issuedTimestamp !== null
            && $issuedTimestamp >= now()->subHours(24)->getTimestamp();

        return response()->json([

            'volcano' => [
                'id' => $volcano->id,
                'name' => $volcano->name,
                'code' => $volcano->code,
                'latitude' => (float) $volcano->latitude,
                'longitude' => (float) $volcano->longitude,
                'elevation' => $volcano->elevation,
                'status' => $volcanoStatus,
                'status_source' => $liveStatus ? 'live' : 'database',
                'erupting' => $erupting,
            ],

            'activity' => $this->formatActivity($activity),

            'eruptions' => collect($volcanoEruptions)
                ->map(function ($eruption) use ($volcanoStatus) {
                    return [
                        'name' => $eruption['name'] ?? null,
                        'occurred_at' => $this->formatDateTime(
                            $eruption['occurred_at'] ?? null
                        ),
                        'activity_level' => $volcanoStatus,
                        'ash_height' => $eruption['ash_height'] ?? null,
                        'description' => $eruption['description'] ?? null,
                        'author' => $eruption['author'] ?? null,
                        'image' => $eruption['image'] ?? null,
                        'time_label' => $eruption['time_label'] ?? null,
                        'date_label' => $eruption['date_label'] ?? null,
                        'source' => 'MAGMA (live)',
                    ];
                })
                ->values(),

            'gdacs' => $gdacs->getAlertForVolcano($volcano->id),

            'weather' => $weather
                ? [
                    'forecast_at' => $weather->forecast_at,
                    'temperature' => $weather->temperature,
                    'humidity' => $weather->humidity,
                    'wind_speed' => $weather->wind_speed,
                    'wind_direction' => $weather->wind_direction,
                    'weather' => $weather->weather,
                    'visibility' => $weather->visibility,
                    'visibility_text' => $weather->visibility_text,
                ]
                : null,

            'weather_forecasts' => $weatherForecasts
                ->map(function ($forecast) {
                    return [
                        'id' => $forecast->id,
                        'forecast_at' => $forecast->forecast_at,
                        'temperature' => $forecast->temperature,
                        'humidity' => $forecast->humidity,
                        'wind_speed' => $forecast->wind_speed,
                        'wind_direction' => $forecast->wind_direction,
                        'weather' => $forecast->weather,
                        'visibility' => $forecast->visibility,
                        'visibility_text' => $forecast->visibility_text,
                    ];
                })
                ->values(),

            'weather_location' => $weatherLocation,

            'current_weather' => $currentWeather
                ? [
                    'source' => $currentWeather->source,
                    'observed_at' => $currentWeather->observed_at->format(
                        'Y-m-d\TH:i:s+00:00'
                    ),
                    'temperature_c' => $currentWeather->temperature_c,
                    'apparent_temperature_c' => $currentWeather->apparent_temperature_c,
                    'humidity' => $currentWeather->humidity,
                    'pressure_msl' => $currentWeather->pressure_msl,
                    'wind_speed_kmh' => $currentWeather->wind_speed_kmh,
                    'wind_direction_deg' => $currentWeather->wind_direction_deg,
                    'wind_direction_cardinal' => $currentWeather->wind_direction_cardinal,
                    'wind_gust_kmh' => $currentWeather->wind_gust_kmh,
                ]
                : null,

            'ash_active' => $ashActive,

            'ash_advisory' => $ashAdvisory
                ? [
                    'id' => $ashAdvisory->id ?? null,
                    'source' => $ashAdvisory->source ?? 'VAAC Darwin',
                    'advisory_nr' => $ashAdvisory->advisory_nr ?? null,
                    'issued_at' => $this->formatDateTime(
                        $ashAdvisory->issued_at ?? null
                    ),
                    'observed_at' => $this->formatDateTime(
                        $ashAdvisory->observed_at ?? null
                    ),
                    'next_advisory_at' => $this->formatDateTime(
                        $ashAdvisory->next_advisory_at ?? null
                    ),
                    'volcano_code' => $ashAdvisory->volcano_code ?? null,
                    'volcano_name' => $ashAdvisory->volcano_name ?? null,
                    'ash_detected' => $ashAdvisory->ash_detected ?? false,
                    'altitude_ft' => $ashAdvisory->altitude_ft ?? null,
                    'ash_height_m' => $ashAdvisory->ash_height_m ?? null,
                    'movement' => $ashAdvisory->movement ?? null,
                    'speed_kts' => $ashAdvisory->speed_kts ?? null,
                    'geometry' => $this->decodeJson(
                        $ashAdvisory->geometry ?? null
                    ),
                    'fcst_geometries' => $this->decodeJson(
                        $ashAdvisory->fcst_geometries ?? []
                    ) ?? [],
                    'eruption_detail' => $ashAdvisory->eruption_detail ?? null,
                    'remarks' => $ashAdvisory->remarks ?? null,
                ]
                : null,

            'ash_prediction' => $ashPrediction
                ? [
                    'id' => $ashPrediction->id,
                    'generated_at' => $ashPrediction->generated_at,
                    'forecast_at' => $ashPrediction->forecast_at,
                    'forecast_hour' => $ashPrediction->forecast_hour,
                    'direction' => $ashPrediction->direction,
                    'speed' => $ashPrediction->speed,
                    'risk_level' => $ashPrediction->risk_level,
                    'confidence' => $ashPrediction->confidence,
                    'geometry' => $this->decodeJson(
                        $ashPrediction->geometry ?? null
                    ),
                ]
                : null,

            'ash_predictions' => $ashPredictions
                ->map(function ($prediction) {
                    return [
                        'id' => $prediction->id,
                        'generated_at' => $prediction->generated_at,
                        'forecast_at' => $prediction->forecast_at,
                        'forecast_hour' => $prediction->forecast_hour,
                        'direction' => $prediction->direction,
                        'speed' => $prediction->speed,
                        'risk_level' => $prediction->risk_level,
                        'confidence' => $prediction->confidence,
                        'geometry' => is_string(
                            $prediction->geometry
                        )
                            ? json_decode(
                                $prediction->geometry,
                                true
                            )
                            : $prediction->geometry,
                    ];
                })
                ->values(),
        ]);
    }

    private function formatDateTime(mixed $value): ?string
    {
        if ($value instanceof \DateTimeInterface) {
            return $value->format('Y-m-d H:i:s');
        }

        if (is_string($value) && $value !== '') {
            return $value;
        }

        return null;
    }

    /**
     * Build the activity response payload.
     *
     * Terima event erupsi real-time dari MagmaService (array) atau
     * record database (Eruption) sebagai fallback.
     *
     * @param  Eruption|array<string, mixed>|null  $activity
     * @return array<string, mixed>|null
     */
    private function formatActivity(
        Eruption|array|null $activity,
    ): ?array {
        if ($activity === null) {
            return null;
        }

        if ($activity instanceof Eruption) {
            return [
                'occurred_at' => $this->formatDateTime(
                    $activity->occurred_at
                ),
                'activity_level' => $activity->activity_level,
                'ash_height' => $activity->ash_height,
                'description' => $activity->description,
                'author' => null,
                'image' => null,
                'source' => 'MAGMA (database)',
            ];
        }

        return [
            'occurred_at' => $this->formatDateTime(
                $activity['occurred_at'] ?? null
            ),
            'activity_level' => $activity['activity_level'] ?? null,
            'ash_height' => $activity['ash_height'] ?? null,
            'description' => $activity['description'] ?? null,
            'author' => $activity['author'] ?? null,
            'image' => $activity['image'] ?? null,
            'source' => 'MAGMA (live)',
        ];
    }

    /**
     * Decode JSON string or return array as-is.
     *
     * @param  string|array<string, mixed>|null  $value
     * @return array<string, mixed>|null
     */
    private function decodeJson(
        string|array|null $value,
    ): ?array {
        if ($value === null) {
            return null;
        }

        if (is_array($value)) {
            return $value;
        }

        $decoded = json_decode($value, true);

        return is_array($decoded) ? $decoded : null;
    }
}
