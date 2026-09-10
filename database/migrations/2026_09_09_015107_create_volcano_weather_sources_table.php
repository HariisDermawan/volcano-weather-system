<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('volcano_weather_sources', function (Blueprint $table) {
            $table->id();
            $table->foreignId('volcano_id')->constrained('volcanoes')->cascadeOnDelete();
            $table->string('source');
            $table->string('adm4', 20);
            $table->string('location_name')->nullable();
            $table->timestamps();
            $table->unique(['volcano_id', 'source'], 'volcano_weather_sources_volcano_source_unique');
            $table->index('adm4');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('volcano_weather_sources');
    }
};
