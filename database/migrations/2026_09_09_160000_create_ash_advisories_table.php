<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ash_advisories', function (Blueprint $table) {
            $table->id();

            $table->foreignId('volcano_id')
                ->constrained('volcanoes')
                ->cascadeOnDelete();

            $table->string('source')->default('VAAC Darwin');
            $table->string('advisory_nr')->nullable();
            $table->timestamp('issued_at');
            $table->timestamp('observed_at')->nullable();
            $table->timestamp('next_advisory_at')->nullable();
            $table->string('volcano_code')->nullable();
            $table->string('volcano_name')->nullable();
            $table->boolean('ash_detected')->default(false);
            $table->unsignedInteger('altitude_ft')->nullable();
            $table->decimal('ash_height_m', 10, 2)->nullable();
            $table->string('movement', 10)->nullable();
            $table->unsignedInteger('speed_kts')->nullable();
            $table->text('eruption_detail')->nullable();
            $table->text('remarks')->nullable();
            $table->text('raw_text')->nullable();

            $table->index('issued_at');
            $table->unique(
                ['volcano_id', 'issued_at'],
                'ash_advisories_volcano_issued_unique'
            );

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ash_advisories');
    }
};
