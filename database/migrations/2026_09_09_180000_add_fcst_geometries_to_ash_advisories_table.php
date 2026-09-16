<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('ash_advisories', function (Blueprint $table) {
            $table->json('fcst_geometries')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('ash_advisories', function (Blueprint $table) {
            $table->dropColumn('fcst_geometries');
        });
    }
};
