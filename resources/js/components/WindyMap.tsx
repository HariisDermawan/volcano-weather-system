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
        <div className="w-full overflow-hidden rounded-2xl border border-white/10 bg-slate-950 shadow-xl shadow-black/20">
            {/* Header */}
            <div className="flex items-center gap-2.5 border-b border-white/10 bg-white/[0.04] px-3 py-2.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5">
                    <img
                        src="/icons/co2.svg"
                        alt="SO2"
                        width={16}
                        height={16}
                        style={{ filter: 'invert(1)' }}
                    />
                </span>

                <div className="min-w-0 flex-1">
                    <p className="truncate text-[11.5px] leading-tight font-semibold text-white">
                        {volcanoName ?? 'Gunung'}
                    </p>
                    <p className="text-[9.5px] font-medium text-slate-400">
                        {latitude.toFixed(4)}°, {longitude.toFixed(4)}°
                    </p>
                </div>
            </div>

            {/* Map */}
            <div className="relative h-[380px] w-full bg-[#0a1220]">
                {loading && (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-gradient-to-b from-[#0f182b] to-[#0a1220] p-6 text-center">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-sky-400/20 bg-sky-400/10 shadow-inner">
                            <span className="animate-pulse text-2xl">🌋</span>
                        </div>
                        <div>
                            <p className="text-[12px] font-semibold text-white">
                                Memuat peta SO₂…
                            </p>
                            <p className="mt-1 text-[10px] leading-relaxed text-slate-400">
                                Total kolom sulfur dioksida
                                <br />
                                <span className="text-slate-500">
                                    CAMS Copernicus • ECMWF via Windy
                                </span>
                            </p>
                        </div>
                        <div className="mt-2 h-1 w-24 overflow-hidden rounded-full bg-white/10">
                            <div className="h-full w-1/2 animate-[shimmer_1.2s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-sky-400 to-cyan-400" />
                        </div>
                    </div>
                )}

                <iframe
                    title="Windy SO2 Monitoring"
                    src={windyUrl}
                    onLoad={() => setLoading(false)}
                    className="h-full w-full border-0"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                />

                {/* Floating legend */}
                <div className="pointer-events-none absolute right-2 bottom-2 left-2 flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-[#0f182b]/90 px-2.5 py-1.5 shadow-lg backdrop-blur-md">
                    <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-emerald-400" />
                        <span className="text-[8px] font-bold tracking-widest text-slate-400 uppercase">
                            Rendah
                        </span>
                    </div>
                    <div className="h-1.5 flex-1 rounded-full bg-gradient-to-r from-emerald-400 via-orange-400 via-yellow-400 to-red-500 opacity-90" />
                    <div className="flex items-center gap-1.5">
                        <span className="text-[8px] font-bold tracking-widest text-slate-400 uppercase">
                            Tinggi
                        </span>
                        <span className="h-2 w-2 rounded-full bg-red-500" />
                    </div>
                </div>
            </div>

            <style>{`@keyframes shimmer{0%{transform:translateX(-100%)}100%{transform:translateX(200%)}}`}</style>
        </div>
    );
}
