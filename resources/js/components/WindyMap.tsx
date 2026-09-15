'use client';

import { useState } from 'react';

interface WindyMapProps {
    latitude: number;
    longitude: number;
    volcanoName?: string;
}

export default function WindyMap({
    latitude,
    longitude,
    volcanoName,
}: WindyMapProps) {
    const [loading, setLoading] = useState(true);

    const windyUrl =
        `https://embed.windy.com/embed2.html` +
        `?lat=${latitude}` +
        `&lon=${longitude}` +
        `&detailLat=${latitude}` +
        `&detailLon=${longitude}` +
        `&zoom=7` +
        `&level=surface` +
        `&product=cams` +
        `&overlay=tcso2` +
        `&menu=` +
        `&message=true` +
        `&marker=true` +
        `&calendar=now` +
        `&pressure=` +
        `&type=map` +
        `&location=coordinates` +
        `&detail=` +
        `&metricWind=default` +
        `&metricTemp=default` +
        `&radarRange=-1`;

    return (
        <div className="w-full overflow-hidden rounded-2xl border border-white/10 bg-slate-950">
            <div className="flex items-center gap-2.5 border-b border-white/10 bg-white/[0.04] px-3 py-2.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-sky-500/25 bg-sky-500/10">
                    <span className="text-[13px]">🌋</span>
                </span>

                <div className="min-w-0">
                    <p className="text-[9.5px] font-bold tracking-wide text-slate-500 uppercase">
                        Pusat Pemantauan
                    </p>

                    <p className="truncate text-[11.5px] font-semibold text-white">
                        {volcanoName ?? 'Gunung'}
                    </p>

                    <p className="text-[10px] font-medium text-slate-400">
                        {latitude.toFixed(5)}, {longitude.toFixed(5)}
                    </p>
                </div>
            </div>

            <div className="relative h-[420px] w-full">
                {loading && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/90">
                        <div className="text-center">
                            <div className="mb-3 text-4xl">🌋</div>

                            <p className="text-sm text-slate-300">
                                Memuat peta SO2…
                            </p>

                            <p className="mt-1 text-xs text-slate-500">
                                Total column sulfur dioksida (CAMS)
                            </p>
                        </div>
                    </div>
                )}

                <iframe
                    title="Windy SO2 Monitoring"
                    src={windyUrl}
                    onLoad={() => setLoading(false)}
                    className="h-full w-full border-0"
                />
            </div>
        </div>
    );
}
