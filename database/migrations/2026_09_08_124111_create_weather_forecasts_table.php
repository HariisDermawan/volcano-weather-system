<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('weather_forecasts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('volcano_id')->constrained('volcanoes')->cascadeOnDelete();
            $table->string('source')->default('BMKG');
            $table->timestamp('forecast_at');
            $table->decimal('temperature', 6, 2)->nullable();
            $table->decimal('humidity', 6, 2)->nullable();
            $table->decimal('wind_speed', 8, 2)->nullable();
            $table->string('wind_direction', 10)->nullable();
            $table->string('weather')->nullable();
            $table->timestamps();
            $table->index(['volcano_id', 'forecast_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('weather_forecasts');
    }
};
