<?php

namespace App\Services;

use App\Models\Volcano;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

class MagmaCctvService
{
    public function __construct(
        private readonly MagmaService $magma,
    ) {}

    private const CCTV_BASE_URL = 'https://magma.esdm.go.id/v1/gunung-api/cctv';

    private const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';

    private const CACHE_TTL = 900;

    private const CCTV_CODES = [
        'bromo' => 'BRO',
        'dempo' => 'DEM',
        'dieng' => 'DIE',
        'guntur' => 'GUN',
        'ibu' => 'IBU',
        'ijen' => 'IJE',
        'kerinci' => 'KER',
        'anak krakatau' => 'KRA',
        'papandayan' => 'PAP',
        'sinabung' => 'SIN',
        'semeru' => 'SMR',
    ];

    /**
     * Latest camera snapshots (label + base64 image) for a volcano.
     *
     * @return list<array{label: string, image: string}>
     */
    public function getCameras(Volcano $volcano): array
    {
        $code = $this->resolveCctvCode($volcano);

        if ($code === null) {
            return [];
        }

        return Cache::remember("magma:cctv:{$code}", self::CACHE_TTL, function () use ($code) {
            return $this->fetchCameras($code);
        });
    }

    private function resolveCctvCode(Volcano $volcano): ?string
    {
        $key = $this->magma->normalizeName($volcano->name);

        if ($key === '') {
            $key = mb_strtolower((string) $volcano->code);
        }

        return self::CCTV_CODES[$key] ?? null;
    }

    /**
     * Fetch the CCTV page and extract camera snapshots in page order.
     *
     * @return list<array{label: string, image: string}>
     */
    private function fetchCameras(string $code): array
    {
        try {
            $response = Http::withHeaders([
                'User-Agent' => self::USER_AGENT,
                'Accept' => 'text/html,application/xhtml+xml',
            ])
                ->timeout(25)
                ->get(self::CCTV_BASE_URL.'/'.$code);

            if ($response->failed()) {
                return [];
            }

            $html = $response->body();
            $images = [];
            $labels = [];

            if (! preg_match_all('/src="(data:image\/jpeg;base64,[^"]+)"/', $html, $images)) {
                return [];
            }

            preg_match_all('/class="text-right">\s*([^<]+?)\s*<\/small>/', $html, $labels);

            $cameras = [];

            foreach ($images[1] as $index => $image) {
                $label = trim(html_entity_decode(
                    $labels[1][$index] ?? 'Kamera',
                    ENT_QUOTES | ENT_HTML5,
                    'UTF-8',
                ));

                $cameras[] = [
                    'label' => $label,
                    'image' => $image,
                ];
            }

            return $cameras;
        } catch (\Throwable $e) {
            report($e);

            return [];
        }
    }
}
