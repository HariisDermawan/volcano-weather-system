<?php

namespace App\Console\Commands;

use App\Models\Volcano;
use App\Services\MagmaService;
use App\Services\VaacDarwinService;
use Illuminate\Console\Command;

class WarmVolcanoCache extends Command
{
    protected $signature = 'volcano:cache-warm';

    protected $description = 'Warm every MAGMA/VAAC cache used by /api/volcanoes';

    public function handle(
        MagmaService $magma,
        VaacDarwinService $vaac,
    ): int {
        $this->components->info('Warming MAGMA/VAAC caches...');

        $this->warnUpGlobalCaches($magma, $vaac);

        $volcanoes = Volcano::query()
            ->orderBy('name')
            ->pluck('name');

        $this->components->info("Memproses {$volcanoes->count()} volcanoes");

        foreach ($volcanoes as $name) {
            $magma->getVarData((string) $name);
        }

        $this->components->info('Cache warm-up selesai.');

        return self::SUCCESS;
    }

    private function warnUpGlobalCaches(
        MagmaService $magma,
        VaacDarwinService $vaac,
    ): void {
        $magma->getStatuses();
        $magma->getEruptingVolcanoNames();
        $magma->getMarkerMeta();
        $magma->getEruptions();
        $vaac->getActiveAshVolcanoIds();
    }
}
