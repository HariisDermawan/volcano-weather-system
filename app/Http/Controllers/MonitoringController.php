<?php

namespace App\Http\Controllers;

use App\Models\Volcano;
use App\Models\Eruption;
use App\Models\WeatherForecast;
use App\Models\AshPrediction;

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

        if (!$weather) {
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
        // 7. RESPONSE
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

