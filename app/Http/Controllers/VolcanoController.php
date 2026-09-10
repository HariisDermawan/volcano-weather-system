<?php

namespace App\Http\Controllers;

use App\Models\Volcano;
use App\Services\MagmaService;
use App\Services\VaacDarwinService;

class VolcanoController extends Controller
{
    public function index(
        VaacDarwinService $vaac,
        MagmaService $magma,
    ) {
        // =====================================================
        // STATUS ABU REAL-TIME PER GUNUNG
        //
        // Utama: fetch langsung dari VAAC Darwin (cached 2m).
        // Fallback: database (diisi Python scheduler tiap 10m).
        // =====================================================

        $liveActiveIds = $vaac->getActiveAshVolcanoIds();

        // Status PVMBG real-time dari MAGMA (cached 3m).
        $liveStatuses = $magma->getStatuses();

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
            ->map(function ($volcano) use (
                $liveActiveIds,
                $liveStatuses,
                $magma,
            ) {
                $volcano->setAttribute(
                    'ash_active',
                    $liveActiveIds->contains($volcano->id),
                );

                $live = $liveStatuses[$magma->normalizeName(
                    $volcano->name
                )] ?? null;

                $volcano->status = $live['label'] ?? $volcano->status;
                $volcano->setAttribute(
                    'status_source',
                    $live ? 'live' : 'database',
                );

                return $volcano;
            });

        return response()->json($volcanoes);
    }
}
