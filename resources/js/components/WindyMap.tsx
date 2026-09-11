'use client';

import { useEffect, useState } from 'react';

interface UserLocation {
    latitude: number;
    longitude: number;
}

export default function WindyMap() {
    const [location, setLocation] = useState<UserLocation>({
        latitude: -6.1831,
        longitude: 106.9077,
    });

    const [loading, setLoading] = useState(true);

    const [locationError, setLocationError] = useState<string | null>(null);

    useEffect(() => {
        if (!navigator.geolocation) {
            setLocationError('Browser tidak mendukung geolocation.');

            setLoading(false);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                setLocation({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                });

                setLoading(false);
            },

            (error) => {
                console.error('Location error:', error);

                setLocationError(
                    'Lokasi tidak dapat diakses. Menggunakan lokasi default.',
                );

                setLoading(false);
            },

            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 60000,
            },
        );
    }, []);

    const windyUrl =
        `https://embed.windy.com/embed2.html` +
        `?lat=${location.latitude}` +
        `&lon=${location.longitude}` +
        `&detailLat=${location.latitude}` +
        `&detailLon=${location.longitude}` +
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
        <div className="relative h-[650px] w-full overflow-hidden rounded-2xl bg-slate-950">
            {loading && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/90">
                    <div className="text-center">
                        <div className="mb-3 text-4xl">📍</div>

                        <p className="text-sm text-slate-300">
                            Mendapatkan lokasi Anda...
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                            Mohon izinkan akses lokasi
                        </p>
                    </div>
                </div>
            )}

            <iframe
                title="Windy SO2 Monitoring"
                src={windyUrl}
                className="h-full w-full border-0"
                allow="geolocation"
            />

            <div className="absolute top-4 left-4 z-20 rounded-xl border border-white/10 bg-slate-950 px-4 py-3">
                <p className="text-xs text-slate-500">Lokasi Saat Ini</p>

                <p className="mt-1 text-sm font-semibold text-white">
                    📍 {location.latitude.toFixed(5)},{' '}
                    {location.longitude.toFixed(5)}
                </p>
            </div>

            {locationError && (
                <div className="absolute bottom-4 left-4 z-20 rounded-xl border border-yellow-500/20 bg-slate-950 px-4 py-3 text-xs text-yellow-300">
                    ⚠️ {locationError}
                </div>
            )}
        </div>
    );
}

