<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('eruptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('volcano_id')->constrained('volcanoes')->cascadeOnDelete();
            $table->timestamp('occurred_at');
            $table->decimal('ash_height', 10, 2)->nullable();
            $table->string('activity_level')->nullable();
            $table->text('description')->nullable();
            $table->index('occurred_at');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('eruptions');
    }
};
