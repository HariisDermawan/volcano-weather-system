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
        Schema::table('ash_predictions', function (Blueprint $table) {
            $table->timestamp('forecast_at')->nullable()->after('generated_at');
            $table->index('forecast_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('ash_predictions', function (Blueprint $table) {
            $table->dropIndex(['forecast_at']);
            $table->dropColumn('forecast_at');
        });
    }
};
