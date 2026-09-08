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
        Schema::create('wind_observations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('volcano_id')->constrained('volcanoes')->cascadeOnDelete();
            $table->timestamp('observed_at');
            $table->integer('altitude');
            $table->decimal('wind_speed', 8, 2);
            $table->decimal('wind_direction', 6, 2);
            $table->index(['volcano_id','observed_at','altitude',]);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('wind_observations');
    }
};
