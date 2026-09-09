<?php

namespace App\Http\Controllers;

use App\Models\AshAdvisory;
use App\Models\AshPrediction;
use App\Models\Eruption;
use App\Models\Volcano;
use App\Models\WeatherForecast;

class MonitoringController extends Controller
{
    public function show(Volcano $volcano)
    {
        // =====================================================
        // 1. AKTIVITAS / ERUPSI TERBARU
        // =====================================================

        $activity = Eruption::where(
            'volcano_id',
            $volcano->id
        )
            ->latest('occurred_at')
            ->first();

        // =====================================================
        // 2. AMBIL SEMUA ASH PREDICTION
        // =====================================================

        $ashPredictions = AshPrediction::where(
            'volcano_id',
            $volcano->id
        )
            ->orderBy('forecast_at')
            ->get();

        // =====================================================
        // 3. PREDICTION UTAMA
        //
        // Tetap dipertahankan supaya frontend lama
        // masih bisa menggunakan ash_prediction.
        // =====================================================

        $ashPrediction = $ashPredictions->first();

        // =====================================================
        // 4. WEATHER YANG SESUAI DENGAN PREDICTION UTAMA
        // =====================================================

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

        // =====================================================
        // 5. FALLBACK WEATHER
        // =====================================================

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

        // =====================================================
        // 6. AMBIL SEMUA WEATHER FORECAST
        //
        // Digunakan frontend untuk sinkronisasi dengan
        // timeline prediksi abu.
        // =====================================================

        $weatherForecasts = WeatherForecast::where(
            'volcano_id',
            $volcano->id
        )
            ->orderBy('forecast_at')
            ->get();

        // =====================================================
        // 7. ADVISORY ABU VAAC DARWIN TERBARU
        // =====================================================

        $ashAdvisory = AshAdvisory::where(
            'volcano_id',
            $volcano->id
        )
            ->latest('issued_at')
            ->first();

        // Fallback: database punya beberapa gunung ganda
        // (misal `Semeru` dan `Gunung Semeru`). Kalau gunung
        // yang dipilih tidak punya advisory, cari through
        // baris volcano lain dengan nama sepadan.
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

        // =====================================================
        // 7b. STATUS ABU REAL-TIME
        //
        // Gunung dianggap sedang bererupsi (menghasilkan abu)
        // hanya bila VAAC masih menerbitkan advisory dengan abu
        // terdeteksi dalam 24 jam terakhir. Selain itu, gunung
        // tidak erupsi -> data tampilan harus mencerminkan
        // kondisi real-time (tidak ada sebaran abu).
        // =====================================================

        $ashActive = $ashAdvisory !== null
            && $ashAdvisory->ash_detected
            && $ashAdvisory->issued_at?->gte(
                now()->subHours(24)
            );

        // =====================================================
        // 8. RESPONSE
        // =====================================================

        return response()->json([
            // =================================================
            // VOLCANO
            // =================================================

            'volcano' => [
                'id' => $volcano->id,
                'name' => $volcano->name,
                'code' => $volcano->code,
                'latitude' => (float) $volcano->latitude,
                'longitude' => (float) $volcano->longitude,
                'elevation' => $volcano->elevation,
                'status' => $volcano->status,
            ],

            // =================================================
            // ACTIVITY
            // =================================================

            'activity' => $activity
                ? [
                    'occurred_at' => $activity->occurred_at,
                    'activity_level' => $activity->activity_level,
                    'ash_height' => $activity->ash_height,
                    'description' => $activity->description,
                ]
                : null,

            // =================================================
            // WEATHER UTAMA
            // =================================================

            'weather' => $weather
                ? [
                    'forecast_at' => $weather->forecast_at,
                    'temperature' => $weather->temperature,
                    'humidity' => $weather->humidity,
                    'wind_speed' => $weather->wind_speed,
                    'wind_direction' => $weather->wind_direction,
                    'weather' => $weather->weather,
                ]
                : null,

            // =================================================
            // SEMUA WEATHER FORECAST
            //
            // Dicocokkan frontend berdasarkan forecast_at.
            // =================================================

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
                    ];
                })
                ->values(),

            // =================================================
            // ADVISORY ABU VAAC DARWIN
            // =================================================

            'ash_active' => $ashActive,

            'ash_advisory' => $ashAdvisory
                ? [
                    'id' => $ashAdvisory->id,
                    'source' => $ashAdvisory->source,
                    'advisory_nr' => $ashAdvisory->advisory_nr,
                    'issued_at' => $ashAdvisory->issued_at,
                    'observed_at' => $ashAdvisory->observed_at,
                    'next_advisory_at' => $ashAdvisory->next_advisory_at,
                    'volcano_code' => $ashAdvisory->volcano_code,
                    'volcano_name' => $ashAdvisory->volcano_name,
                    'ash_detected' => $ashAdvisory->ash_detected,
                    'altitude_ft' => $ashAdvisory->altitude_ft,
                    'ash_height_m' => $ashAdvisory->ash_height_m,
                    'movement' => $ashAdvisory->movement,
                    'speed_kts' => $ashAdvisory->speed_kts,
                    'geometry' => is_string(
                        $ashAdvisory->geometry
                    )
                        ? json_decode(
                            $ashAdvisory->geometry,
                            true
                        )
                        : $ashAdvisory->geometry,
                    'fcst_geometries' => is_string(
                        $ashAdvisory->fcst_geometries
                    )
                        ? json_decode(
                            $ashAdvisory->fcst_geometries,
                            true
                        )
                        : ($ashAdvisory->fcst_geometries ?? []),
                    'eruption_detail' => $ashAdvisory->eruption_detail,
                    'remarks' => $ashAdvisory->remarks,
                ]
                : null,

            // =================================================
            // ASH PREDICTION UTAMA
            //
            // Untuk kompatibilitas dengan frontend lama.
            // =================================================

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
                    'geometry' => is_string(
                        $ashPrediction->geometry
                    )
                        ? json_decode(
                            $ashPrediction->geometry,
                            true
                        )
                        : $ashPrediction->geometry,
                ]
                : null,

            // =================================================
            // SEMUA ASH PREDICTIONS
            //
            // Digunakan untuk timeline forecast
            // dan pemilihan plume di frontend.
            // =================================================

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
}
