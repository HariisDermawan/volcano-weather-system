<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('weather_currents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('volcano_id')
                ->constrained('volcanoes')
                ->cascadeOnDelete();
            $table->string('source')->default('Open-Meteo');
            $table->timestamp('observed_at');
            $table->decimal('temperature_c', 6, 2)->nullable();
            $table->decimal('apparent_temperature_c', 6, 2)->nullable();
            $table->decimal('humidity', 6, 2)->nullable();
            $table->decimal('pressure_msl', 8, 2)->nullable();
            $table->decimal('wind_speed_kmh', 8, 2)->nullable();
            $table->decimal('wind_direction_deg', 8, 2)->nullable();
            $table->string('wind_direction_cardinal', 5)->nullable();
            $table->decimal('wind_gust_kmh', 8, 2)->nullable();
            $table->timestamps();
            $table->unique('volcano_id');
            $table->index('observed_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('weather_currents');
    }
};
