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
        Schema::create('ash_predictions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('volcano_id')->constrained('volcanoes')->cascadeOnDelete();
            $table->timestamp('generated_at');
            $table->integer('forecast_hour');
            $table->decimal('direction', 6, 2)->nullable();
            $table->decimal('speed', 8, 2)->nullable();
            $table->enum('risk_level', ['low','medium','high','extreme'])->default('low');
            $table->decimal('confidence', 5, 2)->nullable();
            $table->json('geometry')->nullable();
            $table->index(['volcano_id','generated_at','forecast_hour',]);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('ash_predictions');
    }
};
