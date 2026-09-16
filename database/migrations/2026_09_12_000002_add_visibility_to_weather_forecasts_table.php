<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('weather_forecasts', function (Blueprint $table) {
            $table->unsignedInteger('visibility')->nullable()->after('weather');
            $table->string('visibility_text')->nullable()->after('visibility');
        });
    }

    public function down(): void
    {
        Schema::table('weather_forecasts', function (Blueprint $table) {
            $table->dropColumn(['visibility', 'visibility_text']);
        });
    }
};
