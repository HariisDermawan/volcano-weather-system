<?php

namespace App\Http\Controllers;

use App\Models\AshAdvisory;
use App\Models\Volcano;

class VolcanoController extends Controller
{
    public function index()
    {
        // =====================================================
        // STATUS ABU REAL-TIME PER GUNUNG
        //
        // Gunung dianggap erupsi (menghasilkan abu) bila
        // advisory VAAC terbarunya terdeteksi abu dalam
        // 24 jam terakhir.
        // =====================================================

        $since = now()->subHours(24);

        $ashActiveByVolcano = AshAdvisory::query()
            ->where('issued_at', '>=', $since)
            ->orderByDesc('issued_at')
            ->get()
            ->unique('volcano_id')
            ->filter(fn ($advisory) => $advisory->ash_detected)
            ->pluck('volcano_id')
            ->flip();

        $volcanoes = Volcano::query()
            ->orderBy('name')
            ->get([
                'id',
                'name',
                'code',
                'latitude',
                'longitude',
                'elevation',
                'status',
            ])
            ->map(function ($volcano) use ($ashActiveByVolcano) {
                $volcano->ash_active = $ashActiveByVolcano->has($volcano->id);

                return $volcano;
            });

        return response()->json($volcanoes);
    }
}
