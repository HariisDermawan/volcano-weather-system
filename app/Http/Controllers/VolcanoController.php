<?php

namespace App\Http\Controllers;

use App\Models\Volcano;
use App\Services\MagmaService;
use App\Services\VaacDarwinService;
use Illuminate\Http\JsonResponse;

class VolcanoController extends Controller
{
    public function cctv(
        Volcano $volcano,
        MagmaService $magma,
    ): JsonResponse {
        $data = $magma->getVarData($volcano->name);

        $foto = $data['foto'] ?? null;

        if (is_string($foto) && $foto !== '') {
            return response()->json([
                'name' => $volcano->name,
                'cameras' => [],
                'image' => $foto,
                'source' => 'photo',
            ]);
        }

        return response()->json([
            'name' => $volcano->name,
            'cameras' => [],
            'image' => null,
            'source' => null,
        ]);
    }

    /**
     * Rincian laporan MAGMA untuk satu gunung (lazy-loaded).
     */
    public function report(
        Volcano $volcano,
        MagmaService $magma,
    ): JsonResponse {
        $data = $magma->getVarData($volcano->name);

        return response()->json([
            'id' => $volcano->id,
            'name' => $volcano->name,
            'foto' => $data['foto'] ?? null,
            'lokasi' => $data['lokasi'] ?? null,
            'periode_text' => $data['periode_text'] ?? null,
            'klimatologi' => $data['klimatologi'] ?? null,
            'visual' => $data['visual'] ?? null,
            'visual_lainnya' => $data['visual_lainnya'] ?? null,
            'rekomendasi' => $data['rekomendasi'] ?? null,
            'grafik_gempa' => $data['grafik_gempa'] ?? null,
        ]);
    }

    public function index(
        VaacDarwinService $vaac,
        MagmaService $magma,
    ): JsonResponse {

        $liveActiveIds = $vaac->getActiveAshVolcanoIds();

        $liveStatuses = $magma->getStatuses();

        $eruptingSet = array_flip($magma->getEruptingVolcanoNames());

        $markerMeta = $magma->getMarkerMeta();

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

                $eruptionWhen = $latestEruptionAt[$key] ?? null;

                $volcano->setAttribute(
                    'last_eruption_at',
                    $eruptionWhen instanceof \DateTimeInterface
                        ? $eruptionWhen->format('Y-m-d H:i:s')
                        : null,
                );

                return $volcano;
            });

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
