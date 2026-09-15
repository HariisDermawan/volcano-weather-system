<?php

namespace App\Http\Controllers;

use App\Models\Volcano;
use App\Services\MagmaCctvService;
use App\Services\MagmaService;
use App\Services\VaacDarwinService;
use Illuminate\Http\JsonResponse;

class VolcanoController extends Controller
{
    /**
     * Foto popup untuk sebuah gunung, sumber terbaik yang tersedia.
     *
     * Prioritas: (1) visual VEN terbaru dari halaman letusan MAGMA — foto
     * persis yang tampil di popup magma.esdm.go.id/v1, (2) snapshot CCTV
     * real-time sebagai cadangan, (3) null → placeholder di frontend.
     */
    public function cctv(
        Volcano $volcano,
        MagmaCctvService $cctv,
        MagmaService $magma,
    ): JsonResponse {
        $visual = $magma->getVisualPhoto($volcano->name);

        if ($visual !== null) {
            return response()->json([
                'name' => $volcano->name,
                'cameras' => [],
                'image' => $visual,
                'source' => 'ven',
            ]);
        }

        $cameras = $cctv->getCameras($volcano);

        if ($cameras !== []) {
            return response()->json([
                'name' => $volcano->name,
                'cameras' => $cameras,
                'image' => $cameras[0]['image'],
                'source' => 'cctv',
            ]);
        }

        return response()->json([
            'name' => $volcano->name,
            'cameras' => [],
            'image' => null,
            'source' => null,
        ]);
    }

    public function index(
        VaacDarwinService $vaac,
        MagmaService $magma,
    ): JsonResponse {
        // =====================================================
        // STATUS ABU REAL-TIME PER GUNUNG
        //
        // Utama: fetch langsung dari VAAC Darwin (cached 2m).
        // Fallback: database (diisi Python scheduler tiap 10m).
        // =====================================================

        $liveActiveIds = $vaac->getActiveAshVolcanoIds();

        // Status PVMBG real-time dari MAGMA (cached 3m).
        $liveStatuses = $magma->getStatuses();

        // Gunung yang sedang bererupsi menurut MAGMA (erupt_icon) (cached 3m).
        $eruptingSet = array_flip($magma->getEruptingVolcanoNames());

        // Meta administratif/geografis + periode laporan pengamatan per gunung.
        $markerMeta = $magma->getMarkerMeta();
        $reportPeriods = $magma->getReportPeriods();

        // Waktu erupsi terakhir per gunung (UTC) dari MAGMA — dipakai
        // frontend untuk memilih gunung erupsi yang paling baru.
        $latestEruptionAt = [];

        foreach ($magma->getEruptions() as $eruption) {
            $key = $magma->normalizeName((string) ($eruption['name'] ?? ''));

            if ($key === '') {
                continue;
            }

            if (! isset($latestEruptionAt[$key])) {
                $latestEruptionAt[$key] = $eruption['occurred_at'] ?? null;
            }
        }

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
                $eruptingSet,
                $markerMeta,
                $reportPeriods,
                $latestEruptionAt,
                $magma,
            ) {
                $volcano->setAttribute(
                    'ash_active',
                    $liveActiveIds->contains($volcano->id),
                );

                $key = $magma->normalizeName((string) $volcano->name);

                $live = $liveStatuses[$key] ?? null;

                $volcano->status = $live['label'] ?? $volcano->status;
                $volcano->setAttribute(
                    'status_source',
                    $live ? 'live' : 'database',
                );

                $volcano->setAttribute(
                    'erupting',
                    isset($eruptingSet[$key]),
                );

                $meta = $markerMeta[$key] ?? null;

                $volcano->setAttribute(
                    'kabupaten',
                    $meta['kabupaten'] ?? null,
                );

                $volcano->setAttribute(
                    'province',
                    $meta['province'] ?? ($live['province'] ?? null),
                );

                if (isset($meta['elevation'])) {
                    $volcano->setAttribute('elevation', $meta['elevation']);
                }

                $report = $reportPeriods[$key] ?? null;

                $volcano->setAttribute(
                    'periode_periode',
                    $report['period'] ?? null,
                );

                $volcano->setAttribute(
                    'periode_report_date',
                    $report['report_date'] ?? null,
                );

                $eruptionWhen = $latestEruptionAt[$key] ?? null;

                $volcano->setAttribute(
                    'last_eruption_at',
                    $eruptionWhen instanceof \DateTimeInterface
                        ? $eruptionWhen->format('Y-m-d H:i:s')
                        : null,
                );

                return $volcano;
            });

        // =====================================================
        // HAPUS DUPLIKAT NAMA (Gunung Semeru vs Semeru)
        //
        // Pipeline Python bisa menciptakan baris `Gunung ...`
        // baru setelah migrasi merge. Pilih nama resmi MAGMA
        // (tanpa prefix `Gunung `) agar dropdown tidak dobel.
        // =====================================================

        $seen = [];

        foreach ($volcanoes as $volcano) {
            $key = $magma->normalizeName((string) $volcano->name);

            if ($key === '') {
                $key = 'v'.$volcano->id;
            }

            $existing = $seen[$key] ?? null;

            $hasPrefix = str_starts_with((string) $volcano->name, 'Gunung ');

            if ($existing === null) {
                $seen[$key] = $volcano;
            } elseif (str_starts_with((string) $existing->name, 'Gunung ') && ! $hasPrefix) {
                $seen[$key] = $volcano;
            }
        }

        $volcanoes = array_values($seen);

        return response()->json($volcanoes);
    }
}
