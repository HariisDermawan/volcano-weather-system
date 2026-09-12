<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Merge volcano rows that were created twice (e.g. `Gunung Semeru`
 * vs canonical `Semeru`). The `Gunung ...` row (created with a
 * non-MAGMA code) is removed, but all of its children are first
 * reparented to the canonical row so no data is lost.
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $duplicates = DB::table('volcanoes')
            ->select('id', 'name')
            ->where('name', 'like', 'Gunung %')
            ->orderBy('id')
            ->get();

        foreach ($duplicates as $duplicate) {
            $shortName = preg_replace('/^Gunung\s+/i', '', $duplicate->name);

            $canonical = DB::table('volcanoes')
                ->where('name', $shortName)
                ->first();

            if ($canonical === null) {
                continue;
            }

            $dupId = $duplicate->id;
            $keepId = $canonical->id;

            // Tables without a unique constraint on volcano_id:
            // reparent every child row.
            $reparentTables = [
                'eruptions',
                'ash_predictions',
                'weather_observations',
                'wind_observations',
            ];

            foreach ($reparentTables as $table) {
                DB::table($table)
                    ->where('volcano_id', $dupId)
                    ->update(['volcano_id' => $keepId]);
            }

            // weather_forecasts: unique (volcano_id, forecast_at).
            // Reparent rows whose forecast_at does not collide with the
            // canonical volcano; drop the colliding duplicate-side rows.
            $forecasts = DB::table('weather_forecasts')
                ->where('volcano_id', $dupId)
                ->get();

            foreach ($forecasts as $forecast) {
                $exists = DB::table('weather_forecasts')
                    ->where('volcano_id', $keepId)
                    ->where('forecast_at', $forecast->forecast_at)
                    ->exists();

                if (! $exists) {
                    DB::table('weather_forecasts')
                        ->where('id', $forecast->id)
                        ->update(['volcano_id' => $keepId]);
                } else {
                    DB::table('weather_forecasts')
                        ->where('id', $forecast->id)
                        ->delete();
                }
            }

            // weather_currents: unique key on volcano_id alone.
            // The canonical row wins; drop the duplicate-side row.
            DB::table('weather_currents')
                ->where('volcano_id', $dupId)
                ->delete();

            // volcano_weather_sources: unique (volcano_id, source).
            $sources = DB::table('volcano_weather_sources')
                ->where('volcano_id', $dupId)
                ->get();

            foreach ($sources as $source) {
                $exists = DB::table('volcano_weather_sources')
                    ->where('volcano_id', $keepId)
                    ->where('source', $source->source)
                    ->exists();

                if (! $exists) {
                    DB::table('volcano_weather_sources')
                        ->where('id', $source->id)
                        ->update(['volcano_id' => $keepId]);
                } else {
                    DB::table('volcano_weather_sources')
                        ->where('id', $source->id)
                        ->delete();
                }
            }

            // ash_advisories: unique (volcano_id, issued_at).
            $advisories = DB::table('ash_advisories')
                ->where('volcano_id', $dupId)
                ->get();

            foreach ($advisories as $advisory) {
                $exists = DB::table('ash_advisories')
                    ->where('volcano_id', $keepId)
                    ->where('issued_at', $advisory->issued_at)
                    ->exists();

                if (! $exists) {
                    DB::table('ash_advisories')
                        ->where('id', $advisory->id)
                        ->update(['volcano_id' => $keepId]);
                } else {
                    DB::table('ash_advisories')
                        ->where('id', $advisory->id)
                        ->delete();
                }
            }

            DB::table('volcanoes')->where('id', $dupId)->delete();
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Tidak dapat dikembalikan secara otomatis.
    }
};
