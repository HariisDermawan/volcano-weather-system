<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('weather_observations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('volcano_id')->constrained('volcanoes')->cascadeOnDelete();
            $table->timestamp('observed_at');
            $table->decimal('temperature', 6, 2)->nullable();
            $table->decimal('humidity', 6, 2)->nullable();
            $table->decimal('pressure', 8, 2)->nullable();
            $table->decimal('rainfall', 8, 2)->nullable();
            $table->index('observed_at');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('weather_observations');
    }
};
