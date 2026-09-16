<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
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

            DB::table('weather_currents')
                ->where('volcano_id', $dupId)
                ->delete();

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

    public function down(): void {}
};
