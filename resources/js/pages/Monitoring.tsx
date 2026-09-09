import { useEffect, useState, type ReactNode } from 'react';

import VolcanoMap from '@/components/VolcanoMap';

interface Volcano {
    id: number;
    name: string;
    code: string;
    latitude: number;
    longitude: number;
    elevation: number | null;
    status: string;
}

interface Weather {
    forecast_at: string;
    temperature: number | null;
    humidity: number | null;
    wind_speed: number | null;
    wind_direction: string | null;
    weather: string | null;
}

interface WeatherForecast {
    id: number;
    forecast_at: string;
    temperature: number | null;
    humidity: number | null;
    wind_speed: number | null;
    wind_direction: string | null;
    weather: string | null;
}

interface Activity {
    occurred_at: string;
    activity_level: string | null;
    ash_height: number | null;
    description: string | null;
}

interface AshGeometry {
    type: string;
    coordinates: number[][][];
}

interface AshPrediction {
    id: number;
    generated_at: string;
    forecast_at: string | null;
    forecast_hour: number;
    direction: number | string | null;
    speed: number | string | null;
    risk_level: string;
    confidence: number | string | null;
    geometry: AshGeometry | null;
}

interface MonitoringData {
    volcano: Volcano;
    activity: Activity | null;
    weather: Weather | null;
    weather_forecasts: WeatherForecast[];
    ash_prediction: AshPrediction | null;
    ash_predictions: AshPrediction[];
    ash_active: boolean;
    ash_advisory: AshAdvisory | null;
}

interface AshAdvisory {
    id: number;
    source: string;
    advisory_nr: string | null;
    issued_at: string;
    observed_at: string | null;
    next_advisory_at: string | null;
    volcano_code: string | null;
    volcano_name: string | null;
    ash_detected: boolean;
    altitude_ft: number | null;
    ash_height_m: number | null;
    movement: string | null;
    speed_kts: number | null;
    geometry: AshGeometry | null;
    fcst_geometries: Record<string, AshGeometry> | null;
    eruption_detail: string | null;
    remarks: string | null;
}

interface MonitoringAlert {
    id: string;
    level: 'critical' | 'warning' | 'info';
    title: string;
    message: string;
}

/*
 * ==========================================
 * JUDUL SEKSI (PANEL DECK / SIDE)
 * ==========================================
 */

function PanelTitle({ children }: { children: ReactNode }) {
    return (
        <p className="mb-2.5 flex items-center gap-1.5 text-[10.5px] font-extrabold tracking-[1px] text-slate-400 uppercase">
            {children}

            <span className="h-px flex-1 bg-gradient-to-r from-white/15 to-transparent" />
        </p>
    );
}

export default function Monitoring() {
    // ==========================================
    // DAFTAR GUNUNG
    // ==========================================

    const [volcanoes, setVolcanoes] = useState<Volcano[]>([]);

    const [selectedVolcanoId, setSelectedVolcanoId] = useState<number>(1);

    const [volcanoLoading, setVolcanoLoading] = useState(true);

    const [volcanoError, setVolcanoError] = useState<string | null>(null);

    // ==========================================
    // DATA MONITORING
    // ==========================================

    const [data, setData] = useState<MonitoringData | null>(null);

    const [loading, setLoading] = useState(true);

    const [error, setError] = useState<string | null>(null);

    const [selectedForecastId, setSelectedForecastId] = useState<number | null>(
        null,
    );

    const [checkedLayers, setCheckedLayers] = useState<string[]>(['observasi']);

    const [refreshKey, setRefreshKey] = useState(0);

    const [refreshing, setRefreshing] = useState(false);

    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    const [volcanoOpen, setVolcanoOpen] = useState(false);

    const [volcanoQuery, setVolcanoQuery] = useState('');

    const [timelinePlaying, setTimelinePlaying] = useState(false);

    // ==========================================
    // AMBIL DAFTAR SEMUA GUNUNG
    // ==========================================

    useEffect(() => {
        const fetchVolcanoes = async () => {
            try {
                setVolcanoLoading(true);
                setVolcanoError(null);

                const response = await fetch('/api/volcanoes', {
                    headers: {
                        Accept: 'application/json',
                    },
                });

                if (!response.ok) {
                    throw new Error('Gagal mengambil daftar gunung api.');
                }

                const result: Volcano[] = await response.json();

                setVolcanoes(result);

                // Pertahankan gunung yang sedang dipilih
                // jika masih tersedia di database.
                setSelectedVolcanoId((currentId) => {
                    const exists = result.some(
                        (volcano) => volcano.id === currentId,
                    );

                    if (exists) {
                        return currentId;
                    }

                    // Jika tidak ada, gunakan gunung pertama.
                    return result[0]?.id ?? 1;
                });
            } catch (err) {
                setVolcanoError(
                    err instanceof Error
                        ? err.message
                        : 'Gagal mengambil daftar gunung.',
                );
            } finally {
                setVolcanoLoading(false);
            }
        };

        fetchVolcanoes();
    }, []);

    // ==========================================
    // AMBIL DATA MONITORING GUNUNG TERPILIH
    // ==========================================

    useEffect(() => {
        let cancelled = false;

        const fetchMonitoringData = async () => {
            try {
                setLoading(true);
                setError(null);

                const response = await fetch(
                    `/api/monitoring/volcano/${selectedVolcanoId}`,
                    {
                        headers: {
                            Accept: 'application/json',
                        },
                    },
                );

                if (!response.ok) {
                    throw new Error('Gagal mengambil data monitoring.');
                }

                const result: MonitoringData = await response.json();

                if (cancelled) {
                    return;
                }

                setData(result);

                if (!cancelled) {
                    setLastUpdated(new Date());
                }

                // Reset / pertahankan forecast
                // sesuai gunung yang sedang aktif.
                if (
                    result.ash_predictions &&
                    result.ash_predictions.length > 0
                ) {
                    setSelectedForecastId((currentId) => {
                        const stillExists =
                            currentId !== null &&
                            result.ash_predictions.some(
                                (prediction) => prediction.id === currentId,
                            );

                        if (stillExists) {
                            return currentId;
                        }

                        return result.ash_predictions[0].id;
                    });
                } else {
                    setSelectedForecastId(null);
                }
            } catch (err) {
                if (cancelled) {
                    return;
                }

                setData(null);

                setError(
                    err instanceof Error ? err.message : 'Terjadi kesalahan.',
                );
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        fetchMonitoringData();

        // Refresh monitoring setiap 60 detik.
        const interval = setInterval(fetchMonitoringData, 60 * 1000);

        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [selectedVolcanoId, refreshKey]);

    // ==========================================
    // HANDLER PILIH GUNUNG
    // ==========================================

    const handleVolcanoChange = (
        event: React.ChangeEvent<HTMLSelectElement>,
    ) => {
        const volcanoId = Number(event.target.value);

        setSelectedVolcanoId(volcanoId);

        // Reset forecast ketika gunung berubah.
        setSelectedForecastId(null);

        // Kembali ke layer observasi.
        setCheckedLayers(['observasi']);

        // Bersihkan data lama.
        setData(null);
    };

    // ==========================================
    // SYNC NAMA GUNUNG KE SEARCH SELECT
    // ==========================================

    useEffect(() => {
        const volcano = volcanoes.find((v) => v.id === selectedVolcanoId);

        setVolcanoQuery(volcano?.name ?? '');
    }, [selectedVolcanoId, volcanoes]);

    // ==========================================
    // REFRESH MANUAL (TOMBOL RING)
    // ==========================================

    const refreshNow = () => {
        setRefreshing(true);
        setRefreshKey((key) => key + 1);
        window.setTimeout(() => setRefreshing(false), 1200);
    };

    // ==========================================
    // PILIH GUNUNG (SEARCH SELECT)
    // ==========================================

    const selectVolcanoById = (id: number) => {
        setVolcanoOpen(false);

        if (id === selectedVolcanoId) {
            return;
        }

        setSelectedVolcanoId(id);
        setSelectedForecastId(null);
        setCheckedLayers(['observasi']);
        setData(null);
    };

    const filteredVolcanoes = volcanoes.filter((volcano) => {
        const query = volcanoQuery.trim().toLowerCase();

        return (
            !query ||
            volcano.name.toLowerCase().includes(query) ||
            volcano.code.toLowerCase().includes(query)
        );
    });

    // ==========================================
    // TIMELINE PLAY (PUTAR OTOMATIS)
    // ==========================================

    useEffect(() => {
        if (!timelinePlaying) {
            return;
        }

        const predictions = data?.ash_predictions ?? [];

        if (predictions.length === 0) {
            setTimelinePlaying(false);

            return;
        }

        const interval = window.setInterval(() => {
            setSelectedForecastId((current) => {
                const index = predictions.findIndex(
                    (prediction) => prediction.id === current,
                );

                const next = predictions[(index + 1) % predictions.length];

                return next?.id ?? current;
            });
        }, 900);

        return () => window.clearInterval(interval);
    }, [timelinePlaying, data]);

    const selectForecast = (id: number, forecastHour: number) => {
        setSelectedForecastId(id);

        const layerKey = layerKeyForForecastHour(forecastHour);

        setCheckedLayers((prev) =>
            prev.includes(layerKey) ? prev : [...prev, layerKey],
        );
    };

    // ==========================================
    // LOADING DAFTAR GUNUNG
    // ==========================================

    if (volcanoLoading && volcanoes.length === 0) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
                <div className="text-center">
                    <div className="mb-3 text-4xl">🌋</div>

                    <p className="text-slate-300">
                        Memuat daftar gunung api...
                    </p>
                </div>
            </div>
        );
    }

    // ==========================================
    // ERROR DAFTAR GUNUNG
    // ==========================================

    if (volcanoError && volcanoes.length === 0) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6">
                <div className="max-w-lg rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-red-300">
                    <h2 className="font-semibold">
                        Gagal memuat daftar gunung
                    </h2>

                    <p className="mt-2 text-sm">{volcanoError}</p>

                    <p className="mt-4 text-xs text-red-400">
                        Pastikan endpoint <code>/api/volcanoes</code> sudah
                        tersedia.
                    </p>
                </div>
            </div>
        );
    }

    // ==========================================
    // LOADING MONITORING
    // ==========================================

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 text-white">
                <header className="border-b border-white/10 bg-slate-950/90">
                    <div className="mx-auto max-w-7xl px-6 py-5">
                        <div className="flex items-center gap-3">
                            <span className="text-3xl">🌋</span>

                            <div>
                                <h1 className="text-2xl font-bold">
                                    Volcano Monitoring
                                </h1>

                                <p className="text-sm text-slate-400">
                                    Sistem monitoring gunung api & cuaca
                                </p>
                            </div>
                        </div>
                    </div>
                </header>

                <main className="mx-auto max-w-7xl px-6 py-6">
                    <div className="mb-6 rounded-2xl border border-white/10 bg-slate-900 p-5">
                        <label className="text-xs font-medium tracking-widest text-slate-500 uppercase">
                            Pilih Gunung Api
                        </label>

                        <select
                            value={selectedVolcanoId}
                            onChange={handleVolcanoChange}
                            className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-orange-500/50"
                        >
                            {volcanoes.map((volcano) => (
                                <option key={volcano.id} value={volcano.id}>
                                    {volcano.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="flex min-h-[300px] items-center justify-center">
                        <div className="text-center">
                            <div className="mb-3 text-4xl">🌋</div>

                            <p className="text-slate-300">
                                Memuat data monitoring...
                            </p>
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    // ==========================================
    // ERROR MONITORING
    // ==========================================

    if (error) {
        return (
            <div className="min-h-screen bg-slate-950 text-white">
                <header className="border-b border-white/10 bg-slate-950/90">
                    <div className="mx-auto max-w-7xl px-6 py-5">
                        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                            <div className="flex items-center gap-3">
                                <span className="text-3xl">🌋</span>

                                <div>
                                    <h1 className="text-2xl font-bold">
                                        Volcano Monitoring
                                    </h1>

                                    <p className="text-sm text-slate-400">
                                        Sistem monitoring gunung api & cuaca
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <span className="flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-400">
                                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                                    ONLINE
                                </span>

                                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-400">
                                    BMKG + PVMBG + VAAC
                                </span>
                            </div>
                        </div>
                    </div>
                </header>

                <main className="mx-auto max-w-7xl px-6 py-6">
                    <div className="mb-6 rounded-2xl border border-white/10 bg-slate-900 p-5">
                        <label className="text-xs font-medium tracking-widest text-slate-500 uppercase">
                            Pilih Gunung Api
                        </label>

                        <select
                            value={selectedVolcanoId}
                            onChange={handleVolcanoChange}
                            className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-orange-500/50"
                        >
                            {volcanoes.map((volcano) => (
                                <option key={volcano.id} value={volcano.id}>
                                    {volcano.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-red-300">
                        Error: {error}
                    </div>
                </main>
            </div>
        );
    }

    // ==========================================
    // DATA KOSONG
    // ==========================================

    if (!data) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-300">
                Data monitoring tidak ditemukan.
            </div>
        );
    }

    // ==========================================
    // FORMAT WIB
    // ==========================================

    const formatWIB = (date: string) => {
        return new Intl.DateTimeFormat('id-ID', {
            timeZone: 'Asia/Jakarta',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
        }).format(new Date(date));
    };

    // ==========================================
    // STATUS GUNUNG
    // ==========================================

    const status = data.volcano.status.toLowerCase();

    const statusLabel = status.includes('siaga')
        ? 'SIAGA'
        : status.includes('waspada')
          ? 'WASPADA'
          : status.includes('awas')
            ? 'AWAS'
            : status.includes('normal')
              ? 'NORMAL'
              : data.volcano.status.toUpperCase();

    // ==========================================
    // FORECAST YANG DIPILIH
    // ==========================================

    const selectedForecast =
        data.ash_predictions?.find(
            (prediction) => prediction.id === selectedForecastId,
        ) ??
        data.ash_predictions?.[0] ??
        data.ash_prediction;

    // ==========================================
    // WEATHER SESUAI FORECAST
    // ==========================================

    const selectedWeather = (() => {
        if (!selectedForecast?.forecast_at) {
            return data.weather ?? null;
        }

        const targetTime = new Date(selectedForecast.forecast_at).getTime();

        let bestWeather = data.weather ?? null;
        let bestDiff = Infinity;

        for (const forecast of data.weather_forecasts ?? []) {
            const diff = Math.abs(
                new Date(forecast.forecast_at).getTime() - targetTime,
            );

            if (diff < bestDiff) {
                bestDiff = diff;
                bestWeather = forecast;
            }
        }

        return bestWeather;
    })();

    // ==========================================
    // ARAH ANGIN (KOMPAS)
    // ==========================================

    const COMPASS_DEGREES: Record<string, number> = {
        N: 0,
        NNE: 22.5,
        NE: 45,
        ENE: 67.5,
        E: 90,
        ESE: 112.5,
        SE: 135,
        SSE: 157.5,
        S: 180,
        SSW: 202.5,
        SW: 225,
        WSW: 247.5,
        W: 270,
        WNW: 292.5,
        NW: 315,
        NNW: 337.5,
    };

    const COMPASS_ID: Record<string, string> = {
        N: 'Utara',
        NNE: 'Utara Timur Laut',
        NE: 'Timur Laut',
        ENE: 'Timur Timur Laut',
        E: 'Timur',
        ESE: 'Timur Tenggara',
        SE: 'Tenggara',
        SSE: 'Selatan Tenggara',
        S: 'Selatan',
        SSW: 'Selatan Barat Daya',
        SW: 'Barat Daya',
        WSW: 'Barat Barat Daya',
        W: 'Barat',
        WNW: 'Barat Barat Laut',
        NW: 'Barat Laut',
        NNW: 'Utara Barat Laut',
    };

    const degreesToCompass = (degrees: number): string | null => {
        if (degrees == null || !Number.isFinite(Number(degrees))) {
            return null;
        }

        const compassPoints = [
            'Utara',
            'Utara Timur Laut',
            'Timur Laut',
            'Timur Timur Laut',
            'Timur',
            'Timur Tenggara',
            'Tenggara',
            'Selatan Tenggara',
            'Selatan',
            'Selatan Barat Daya',
            'Barat Daya',
            'Barat Barat Daya',
            'Barat',
            'Barat Barat Laut',
            'Barat Laut',
            'Utara Barat Laut',
        ];

        const index = Math.round(Number(degrees) / 22.5) % 16;

        return compassPoints[index];
    };

    // ==========================================
    // ABU REAL-TIME VAAC DARWIN (PETA)
    // ==========================================

    const ashActive = data.ash_active;

    const realTimeAsh =
        data.ash_advisory?.ash_detected && data.ash_advisory.geometry
            ? data.ash_advisory
            : null;

    const realTimeDirection = realTimeAsh?.movement
        ? (COMPASS_DEGREES[realTimeAsh.movement.toUpperCase()] ?? null)
        : null;

    const realTimeSpeed = realTimeAsh?.speed_kts
        ? Number(realTimeAsh.speed_kts) * 1.852
        : null;

    // ==========================================
    // LEGENDA & LAYER
    // ==========================================

    const LAYER_ORDER = ['observasi', 'hour-6', 'hour-12', 'hour-18'] as const;

    const LAYER_COLORS: Record<string, string> = {
        observasi: '#ef4444',
        'hour-6': '#f97316',
        'hour-12': '#eab308',
        'hour-18': '#3b82f6',
    };

    const LAYER_LABELS: Record<string, string> = {
        observasi: 'Observasi',
        'hour-6': '+6 jam',
        'hour-12': '+12 jam',
        'hour-18': '+18 jam',
    };

    // Gaya layer mengikuti referensi peta sebaran abu:
    // Observasi solid (area VAAC), forecast garis putus.
    const LAYER_STYLE: Record<
        string,
        { fillOpacity: number; strokeDashArray?: string }
    > = {
        observasi: {
            fillOpacity: 0.16,
            strokeDashArray: undefined,
        },
        'hour-6': {
            fillOpacity: 0.1,
            strokeDashArray: '6 6',
        },
        'hour-12': {
            fillOpacity: 0.07,
            strokeDashArray: '3 7',
        },
        'hour-18': {
            fillOpacity: 0.05,
            strokeDashArray: '1 8',
        },
    };

    const closestForecastByHour = (hour: number) => {
        const predictions = data.ash_predictions ?? [];

        if (predictions.length === 0) {
            return null;
        }

        let closest = predictions[0];

        for (const prediction of predictions) {
            const currentDiff = Math.abs(prediction.forecast_hour - hour);

            if (currentDiff < Math.abs(closest.forecast_hour - hour)) {
                closest = prediction;
            }
        }

        return closest;
    };

    // Pemetaan jam forecast → layer terdekat
    // (dipakai saat mengklik kartu timeline).
    const layerKeyForForecastHour = (hour: number): string => {
        if (hour <= 3) {
            return 'observasi';
        }

        if (hour <= 9) {
            return 'hour-6';
        }

        if (hour <= 15) {
            return 'hour-12';
        }

        return 'hour-18';
    };

    const forecastForLayer = (key: string): AshPrediction | null => {
        if (key === 'observasi') {
            return closestForecastByHour(0);
        }

        const hour = Number(key.split('-')[1]);

        return closestForecastByHour(hour);
    };

    const toggleLayer = (key: string) => {
        const wasChecked = checkedLayers.includes(key);

        if (!wasChecked) {
            // Centang: aktifkan layer + jadikan ini yang utama.
            setCheckedLayers([...checkedLayers, key]);

            const prediction = forecastForLayer(key);

            if (prediction) {
                setSelectedForecastId(prediction.id);
            }

            return;
        }

        // Hapus centang: fallback ke layer lain yang masih aktif.
        const nextLayers = checkedLayers.filter((layerKey) => layerKey !== key);

        setCheckedLayers(nextLayers);

        const primaryKey = nextLayers[nextLayers.length - 1] ?? null;

        const prediction = primaryKey ? forecastForLayer(primaryKey) : null;

        setSelectedForecastId(prediction?.id ?? null);
    };

    // ==========================================
    // LAYER PETA AKTIF
    // ==========================================

    const mapAshLayers = LAYER_ORDER.filter((key) =>
        checkedLayers.includes(key),
    )
        .map((key) => {
            if (key === 'observasi') {
                const observation = forecastForLayer(key);

                return {
                    // Area Observasi = poligon VAAC (lebar, mengikuti
                    // sebaran abu real-time), fallback ke plume +0 jam.
                    geometry:
                        realTimeAsh?.geometry ?? observation?.geometry ?? null,
                    color: LAYER_COLORS[key],
                    label: 'Observasi (VAAC real-time)',
                    direction: realTimeDirection,
                    speed: realTimeSpeed,
                    ...LAYER_STYLE[key],
                };
            }

            const prediction = forecastForLayer(key);
            const forecastHour = Number(key.split('-')[1]);

            return {
                // Poligon prakiraan = area lebar VAAC (FCST VA CLD),
                // fallback ke plume hasil prediksi model.
                geometry:
                    realTimeAsh?.fcst_geometries?.[String(forecastHour)] ??
                    prediction?.geometry ??
                    null,
                color: LAYER_COLORS[key],
                label: `Prakiraan +${prediction?.forecast_hour ?? forecastHour} jam ke depan`,
                direction:
                    prediction?.direction != null &&
                    Number.isFinite(Number(prediction.direction))
                        ? Number(prediction.direction)
                        : null,
                speed:
                    prediction?.speed != null &&
                    Number.isFinite(Number(prediction.speed))
                        ? Number(prediction.speed)
                        : null,
                ...LAYER_STYLE[key],
            };
        })
        .filter((layer) => layer.geometry);

    // Gunung tanpa erupsi (tidak ada advisory VAAC real-time)
    // tidak menampilkan layer sebaran abu sama sekali.
    const ashLayers = ashActive ? mapAshLayers : [];

    const observasiVisible = checkedLayers.includes('observasi') && realTimeAsh;

    const mapWindDirection = observasiVisible
        ? realTimeDirection
        : selectedForecast?.direction != null &&
            Number.isFinite(Number(selectedForecast.direction))
          ? Number(selectedForecast.direction)
          : realTimeDirection;

    const mapWindSpeed = observasiVisible
        ? realTimeSpeed
        : selectedForecast?.speed != null &&
            Number.isFinite(Number(selectedForecast.speed))
          ? Number(selectedForecast.speed)
          : realTimeSpeed;

    // ==========================================
    // DESKRIPSI LAYER AKTIF
    // ==========================================

    const formatKm = (km: number): string => {
        if (km < 1) {
            return `${Math.round(km * 1000)} m`;
        }

        const value = Math.round(km * 10) / 10;

        return `${value % 1 === 0 ? Math.round(value) : value} km`;
    };

    const layerDescriptions = LAYER_ORDER.filter(
        (key) => ashActive && checkedLayers.includes(key),
    )
        .map((key) => {
            if (key === 'observasi') {
                return {
                    key,
                    label: 'Posisi saat ini',
                    heightKm:
                        data.ash_advisory?.ash_height_m != null
                            ? data.ash_advisory.ash_height_m / 1000
                            : null,
                    movementText: realTimeAsh?.movement
                        ? `Bergerak ke arah ${
                              COMPASS_ID[realTimeAsh.movement.toUpperCase()] ??
                              realTimeAsh.movement
                          }${
                              realTimeAsh.speed_kts != null
                                  ? ` (~${realTimeAsh.speed_kts} knot)`
                                  : ''
                          }`
                        : null,
                };
            }

            const forecast = forecastForLayer(key);

            const hour = forecast?.forecast_hour ?? Number(key.split('-')[1]);

            let movementText: string | null = null;

            if (realTimeAsh?.movement) {
                movementText = `Bergerak ke arah ${
                    COMPASS_ID[realTimeAsh.movement.toUpperCase()] ??
                    realTimeAsh.movement
                }${
                    realTimeAsh.speed_kts != null
                        ? ` (~${realTimeAsh.speed_kts} knot)`
                        : ''
                }`;
            } else if (forecast?.direction != null) {
                const arah =
                    degreesToCompass(Number(forecast.direction)) ??
                    `${Number(forecast.direction).toFixed(0)}°`;

                movementText = `Bergerak ke arah ${arah}${
                    forecast.speed != null
                        ? ` (~${Number(forecast.speed).toFixed(1)} km/h)`
                        : ''
                }`;
            }

            return {
                key,
                label: `Prakiraan +${hour} jam ke depan`,
                heightKm:
                    data.ash_advisory?.ash_height_m != null
                        ? data.ash_advisory.ash_height_m / 1000
                        : null,
                movementText,
            };
        })
        .filter((description) => description.key);

    // ==========================================
    // RISIKO ABU
    // ==========================================

    const riskLevel = selectedForecast?.risk_level?.toLowerCase() ?? '';
    const riskClass =
        riskLevel === 'high'
            ? 'text-orange-400'
            : riskLevel === 'extreme'
              ? 'text-red-400'
              : riskLevel === 'medium'
                ? 'text-yellow-400'
                : 'text-emerald-400';

    // ==========================================
    // ALERT / NOTIFICATION
    // ==========================================

    const alerts: MonitoringAlert[] = [];

    // =====================================================
    // INFO ABU REAL-TIME (VAAC DARWIN)
    //
    // Disatukan ke dalam alert status gunung agar hanya
    // muncul SATU peringatan, tapi tetap berisi data
    // monitoring real-time.
    // =====================================================

    const advisoryHeightM = data.ash_advisory?.ash_height_m ?? null;

    const advisorySummary = data.ash_advisory?.issued_at
        ? `per VAAC ${formatWIB(data.ash_advisory.issued_at)} WIB`
        : 'per VAAC Darwin';

    const ashCritical =
        ashActive && advisoryHeightM !== null && advisoryHeightM >= 8000;

    let ashRealTimeBits: string[] = [];

    if (ashActive) {
        const heightText =
            advisoryHeightM !== null
                ? `kolom abu ~${(advisoryHeightM / 1000).toFixed(1)} km`
                : null;

        const moveText = realTimeAsh?.movement
            ? `bergerak ke arah ${
                  COMPASS_ID[realTimeAsh.movement.toUpperCase()] ??
                  realTimeAsh.movement
              }${
                  realTimeAsh.speed_kts != null
                      ? ` (~${realTimeAsh.speed_kts} knot)`
                      : ''
              }`
            : null;

        ashRealTimeBits = [heightText, moveText, advisorySummary].filter(
            (bit): bit is string => Boolean(bit),
        );
    }

    const ashRealTimeText = ashRealTimeBits.length
        ? ` Abu terdeteksi: ${ashRealTimeBits.join(' · ')}.`
        : '';

    // =====================================================
    // ALERT BERDASARKAN KONDISI MONITORING REAL-TIME
    //
    // Level & judul alert mengikuti kondisi aktual:
    // - Bererupsi (abu terdeteksi VAAC) -> alert status + info abu.
    // - Tidak bererupsi                 -> Status Gunung NORMAL
    //   (real-time), apa pun level resmi PVMBG di database.
    // =====================================================

    if (ashActive && status.includes('awas')) {
        alerts.push({
            id: 'volcano-awas',
            level: 'critical',
            title: 'Status Gunung AWAS',
            message: `${data.volcano.name} berada pada status AWAS. Tindak siaga darurat segera.${ashRealTimeText}`,
        });
    } else if (ashActive && status.includes('siaga')) {
        alerts.push({
            id: 'volcano-siaga',
            level: ashCritical ? 'critical' : 'warning',
            title: 'Status Gunung SIAGA',
            message: `${data.volcano.name} saat ini berada pada status SIAGA. Aktivitas vulkanik perlu dipantau secara intensif.${ashRealTimeText}`,
        });
    } else if (ashActive && status.includes('waspada')) {
        alerts.push({
            id: 'volcano-waspada',
            level: ashCritical ? 'critical' : 'warning',
            title: 'Status Gunung WASPADA',
            message: `${data.volcano.name} saat ini berada pada status WASPADA. Masyarakat di sekitar gunung agar meningkatkan kewaspadaan.${ashRealTimeText}`,
        });
    } else if (ashActive) {
        alerts.push({
            id: 'vaac-ash-active',
            level: ashCritical ? 'critical' : 'warning',
            title: ashCritical
                ? 'Kolom Abu Sangat Tinggi'
                : 'Abu Vulkanik Terdeteksi',
            message: `VAAC mendeteksi emisi abu aktif.${ashRealTimeText}`,
        });
    } else {
        alerts.push({
            id: 'volcano-quiet',
            level: 'info',
            title: 'Status Gunung NORMAL',
            message: `${data.volcano.name} tidak terdeteksi erupsi/sebaran abu saat ini (kondisi monitoring real-time).`,
        });
    }

    // ==========================================
    // RENDER
    // ==========================================

    const gdacsLevel = (() => {
        const official = data.volcano.status?.toLowerCase() ?? '';

        if (official.includes('awas')) {
            return { color: '#ef4444', label: 'Merah - Awas' };
        }

        if (official.includes('siaga')) {
            return { color: '#f97316', label: 'Oranye - Waspada' };
        }

        if (official.includes('waspada')) {
            return { color: '#eab308', label: 'Kuning - Siaga' };
        }

        return { color: '#22c55e', label: 'Hijau - Normal' };
    })();

    const statusPillText =
        data === null
            ? 'MEMUAT DATA'
            : ashActive
              ? 'ERUPSI AKTIF'
              : 'TIDAK ADA ERUPSI';

    const statusPillClass =
        data === null
            ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
            : ashActive
              ? 'border-red-500/30 bg-red-500/15 text-red-300 shadow-[0_0_24px_rgba(255,59,59,0.45)]'
              : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';

    const statusDotClass =
        data === null
            ? 'bg-amber-400 animate-pulse'
            : ashActive
              ? 'bg-red-500 shadow-[0_0_8px_rgba(255,59,59,1)] animate-pulse'
              : 'bg-emerald-400 shadow-[0_0_8px_rgba(61,220,132,1)]';

    const gdacsBadgeClass =
        gdacsLevel.color === '#ef4444'
            ? 'border-red-500/30 bg-red-500/10 text-red-300'
            : gdacsLevel.color === '#f97316'
              ? 'border-orange-500/30 bg-orange-500/10 text-orange-300'
              : gdacsLevel.color === '#eab308'
                ? 'border-yellow-500/30 bg-yellow-500/10 text-yellow-200'
                : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';

    const pvmbgClass = (() => {
        const official = data.volcano.status?.toLowerCase() ?? '';

        if (official.includes('awas')) {
            return 'border-red-500/30 bg-red-500/10 text-red-300';
        }

        if (official.includes('siaga')) {
            return 'border-orange-500/30 bg-orange-500/10 text-orange-300';
        }

        if (official.includes('waspada')) {
            return 'border-yellow-500/30 bg-yellow-500/10 text-yellow-200';
        }

        return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
    })();

    const windDeg = selectedWeather?.wind_direction
        ? (COMPASS_DEGREES[selectedWeather.wind_direction.toUpperCase()] ?? 0)
        : 0;

    return (
        <div className="relative h-screen w-screen overflow-hidden bg-[#05070a] text-[#eef1f5]">
            {/* =====================================
            PETA LAYAR PENUH (LATAR BELAKANG)
        ====================================== */}

            <div className="absolute inset-0 z-0">
                <VolcanoMap
                    latitude={data.volcano.latitude}
                    longitude={data.volcano.longitude}
                    ashLayers={ashLayers}
                    windDirection={ashActive ? mapWindDirection : null}
                    windSpeed={ashActive ? mapWindSpeed : null}
                    riskLevel={
                        ashActive
                            ? (selectedForecast?.risk_level ?? null)
                            : null
                    }
                    height="100%"
                    className="h-full w-full"
                    volcanoName={data.volcano.name}
                    volcanoStatus={data.volcano.status}
                    volcanoElevation={data.volcano.elevation}
                    dark
                />
            </div>

            {/* =====================================
            TOPBAR (GLASS)
        ====================================== */}

            <header className="pointer-events-none absolute inset-x-0 top-0 z-[1200] px-3 pt-3">
                <div className="pointer-events-auto rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 shadow-2xl shadow-black/40 backdrop-blur-xl">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2.5">
                            <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-gradient-to-br from-orange-500 to-red-500 text-lg shadow-[0_0_18px_rgba(255,110,20,0.5)]">
                                🌋
                            </span>

                            <div className="min-w-0">
                                <h1 className="text-sm font-extrabold tracking-tight">
                                    PANTAU{' '}
                                    <span className="bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent">
                                        ABU VULKANIK
                                    </span>
                                </h1>

                                <small className="block text-[10px] font-medium text-slate-400">
                                    Live · sumber VAAC Darwin
                                </small>
                            </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                            {/* STATUS PILL */}

                            <span
                                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-extrabold tracking-wide uppercase ${statusPillClass}`}
                            >
                                <span
                                    className={`h-2 w-2 rounded-full ${statusDotClass}`}
                                />

                                {statusPillText}
                            </span>

                            {/* REFRESH RING */}

                            <button
                                type="button"
                                onClick={refreshNow}
                                title="Tarik data sekarang"
                                aria-label="Tarik data sekarang"
                                className={`flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-white/5 text-sm text-orange-500 transition hover:bg-white/10 ${
                                    refreshing ? 'animate-spin' : ''
                                }`}
                            >
                                ⟳
                            </button>
                        </div>
                    </div>

                    {/* SEARCH SELECT GUNUNG */}

                    <div className="relative mt-2.5">
                        <div
                            className={`flex items-center gap-2 rounded-xl border px-3 py-2 transition ${
                                volcanoOpen
                                    ? 'border-orange-500/50 bg-white/10'
                                    : 'border-white/10 bg-white/5'
                            }`}
                        >
                            <span className="text-[9px] font-extrabold tracking-widest text-slate-500 uppercase">
                                Gunung
                            </span>

                            <input
                                value={volcanoQuery}
                                onChange={(event) => {
                                    setVolcanoQuery(event.target.value);
                                    setVolcanoOpen(true);
                                }}
                                onFocus={() => setVolcanoOpen(true)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Escape') {
                                        setVolcanoOpen(false);
                                    }
                                }}
                                placeholder="Cari gunung api..."
                                className="w-full min-w-0 flex-1 bg-transparent text-xs font-semibold text-white outline-none placeholder:text-slate-600"
                            />

                            <button
                                type="button"
                                onClick={() => setVolcanoOpen((open) => !open)}
                                className={`shrink-0 text-xs text-slate-500 transition ${
                                    volcanoOpen ? 'rotate-180' : ''
                                }`}
                                aria-label="Buka daftar gunung"
                            >
                                ▼
                            </button>
                        </div>

                        {volcanoOpen && (
                            <>
                                <button
                                    type="button"
                                    aria-label="Tutup daftar gunung"
                                    onClick={() => setVolcanoOpen(false)}
                                    className="fixed inset-0 z-0 cursor-default"
                                />

                                <div className="absolute top-full right-0 left-0 z-10 mt-1.5 max-h-64 overflow-y-auto rounded-xl border border-white/10 bg-[#0d1117]/95 p-1.5 shadow-2xl shadow-black/50 backdrop-blur-xl">
                                    {filteredVolcanoes.length > 0 ? (
                                        filteredVolcanoes.map((volcano) => (
                                            <button
                                                key={volcano.id}
                                                type="button"
                                                onClick={() =>
                                                    selectVolcanoById(
                                                        volcano.id,
                                                    )
                                                }
                                                className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-xs transition hover:bg-orange-500/15 ${
                                                    volcano.id ===
                                                    selectedVolcanoId
                                                        ? 'bg-orange-500/15'
                                                        : ''
                                                }`}
                                            >
                                                <span className="flex min-w-0 items-center gap-2 font-bold text-white">
                                                    🌋 {volcano.name}
                                                    {volcano.id ===
                                                        selectedVolcanoId && (
                                                        <span className="shrink-0 text-[9px] font-extrabold text-red-500 uppercase">
                                                            aktif
                                                        </span>
                                                    )}
                                                </span>

                                                <span className="shrink-0 text-[10px] text-slate-500">
                                                    {volcano.status}
                                                </span>
                                            </button>
                                        ))
                                    ) : (
                                        <div className="px-3 py-2 text-center text-[11px] text-slate-600">
                                            Gak ada hasil.
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </header>

            {/* =====================================
            DECK KIRI (INFO MONITORING)
        ====================================== */}

            <aside className="pointer-events-auto absolute top-[132px] left-3 z-[1100] flex max-h-[calc(100dvh-210px)] w-[308px] max-w-[calc(100vw-24px)] flex-col gap-3.5 overflow-y-auto rounded-2xl border border-white/10 bg-white/[0.06] p-3.5 shadow-2xl shadow-black/40 backdrop-blur-xl">
                {/* STATUS ERUPSI */}

                <section>
                    <PanelTitle>Status Erupsi</PanelTitle>

                    {alerts.map((alert) => {
                        const alertClass =
                            alert.level === 'critical'
                                ? 'border-red-500/25 bg-red-500/10 text-red-200'
                                : alert.level === 'warning'
                                  ? 'border-orange-500/25 bg-orange-500/10 text-orange-200'
                                  : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200';

                        const icon =
                            alert.level === 'critical'
                                ? '🚨'
                                : alert.level === 'warning'
                                  ? '⚠️'
                                  : '🟢';

                        return (
                            <div
                                key={alert.id}
                                className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 text-[12.5px] leading-relaxed ${alertClass}`}
                            >
                                <span className="shrink-0">{icon}</span>

                                <div>
                                    <p className="font-bold">{alert.title}</p>

                                    <p className="mt-0.5 font-medium text-slate-300">
                                        {alert.message}
                                    </p>
                                </div>
                            </div>
                        );
                    })}

                    {/* BADGE GDACS */}

                    <div
                        className={`mt-2 flex items-center gap-2 rounded-xl border px-3 py-2 text-[11.5px] font-bold ${gdacsBadgeClass}`}
                    >
                        <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ background: gdacsLevel.color }}
                        />

                        <span>
                            <span className="block text-[9px] font-extrabold tracking-widest uppercase opacity-70">
                                Status Bahaya (GDACS)
                            </span>

                            {gdacsLevel.label}
                        </span>
                    </div>
                </section>

                {/* STATUS RESMI PVMBG */}

                <section>
                    <PanelTitle>Status Resmi PVMBG</PanelTitle>

                    <div
                        className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-[12.5px] font-extrabold ${pvmbgClass}`}
                    >
                        <span className="text-sm">🛡️</span>

                        <span>
                            <span className="block text-[9px] font-extrabold tracking-widest uppercase opacity-70">
                                Level Resmi
                            </span>
                            {data.volcano.status} — {statusLabel}
                        </span>
                    </div>

                    <p className="mt-1.5 text-[11.5px] leading-relaxed text-slate-400">
                        {data.activity?.description ??
                            'Belum tersedia keterangan aktivitas terbaru dari PVMBG.'}
                    </p>

                    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[10.5px] text-slate-400">
                        <span className="font-semibold text-slate-300">
                            {data.volcano.code}
                        </span>

                        <span>•</span>

                        <span>
                            Elevasi {data.volcano.elevation ?? '-'} mdpl
                        </span>

                        <span>•</span>

                        <span>
                            {data.volcano.latitude}, {data.volcano.longitude}
                        </span>
                    </div>
                </section>

                {/* TIMELINE SEBARAN */}

                {ashActive && data.ash_predictions?.length > 0 && (
                    <section>
                        <PanelTitle>Timeline Sebaran</PanelTitle>

                        <div className="flex items-center gap-1.5">
                            <button
                                type="button"
                                onClick={() =>
                                    setTimelinePlaying((playing) => !playing)
                                }
                                aria-label={timelinePlaying ? 'Jeda' : 'Putar'}
                                className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-white/5 text-[9px] text-white transition hover:bg-white/10"
                            >
                                {timelinePlaying ? '⏸' : '▶'}
                            </button>

                            <div className="relative h-8 flex-1">
                                <span className="absolute top-[9px] right-2 left-2 h-0.5 bg-white/10" />

                                <div className="relative flex h-full items-start justify-between">
                                    {data.ash_predictions.map((prediction) => {
                                        const active =
                                            prediction.id ===
                                            selectedForecastId;

                                        return (
                                            <button
                                                key={prediction.id}
                                                type="button"
                                                onClick={() =>
                                                    selectForecast(
                                                        prediction.id,
                                                        prediction.forecast_hour,
                                                    )
                                                }
                                                className="flex cursor-pointer flex-col items-center gap-1"
                                            >
                                                <span
                                                    className={`z-10 flex h-[18px] w-[18px] items-center justify-center rounded-full border-2 transition ${
                                                        active
                                                            ? 'scale-125 border-orange-500 bg-orange-500/40 shadow-[0_0_12px_#ff8a3d]'
                                                            : 'border-white/20 bg-[#141821]'
                                                    }`}
                                                />

                                                <span
                                                    className={`text-[9.5px] font-bold ${
                                                        active
                                                            ? 'text-white'
                                                            : 'text-slate-500'
                                                    }`}
                                                >
                                                    +{prediction.forecast_hour}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </section>
                )}

                {/* ANGIN DI KAWAH */}

                <section>
                    <PanelTitle>Angin di Kawah</PanelTitle>

                    <div className="flex items-center gap-3">
                        <div className="relative h-[66px] w-[66px] shrink-0 rounded-full border border-white/10 bg-[radial-gradient(circle,rgba(255,255,255,0.04),transparent_70%)]">
                            <span className="absolute top-0.5 left-1/2 -translate-x-1/2 text-[8px] font-extrabold text-slate-600">
                                U
                            </span>

                            <span className="absolute top-1/2 right-1 -translate-y-1/2 text-[8px] font-extrabold text-slate-600">
                                T
                            </span>

                            <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 text-[8px] font-extrabold text-slate-600">
                                S
                            </span>

                            <span className="absolute top-1/2 left-1 -translate-y-1/2 text-[8px] font-extrabold text-slate-600">
                                B
                            </span>

                            <span
                                className="absolute rounded-sm bg-gradient-to-b from-blue-500 to-transparent"
                                style={{
                                    left: '50%',
                                    top: '50%',
                                    width: '3px',
                                    height: '24px',
                                    marginLeft: '-1.5px',
                                    marginTop: '-24px',
                                    transformOrigin: '50% 24px',
                                    transform: `rotate(${windDeg}deg)`,
                                }}
                            />
                        </div>

                        <div className="text-xs leading-relaxed text-slate-400">
                            <div>
                                <b className="text-[15px] text-white">
                                    {selectedWeather?.wind_speed ?? '-'}
                                </b>{' '}
                                km/j
                            </div>

                            <div>
                                arah {selectedWeather?.wind_direction ?? '-'}
                            </div>

                            <div>
                                suhu {selectedWeather?.temperature ?? '-'}°C
                            </div>
                        </div>
                    </div>
                </section>

                {/* KONDISI CUACA */}

                <section>
                    <PanelTitle>Kondisi Cuaca</PanelTitle>

                    <div className="grid grid-cols-2 gap-1.5">
                        <div className="rounded-xl border border-white/10 bg-white/5 p-2.5">
                            <p className="text-[10px] text-slate-500">Suhu</p>

                            <p className="mt-0.5 text-[15px] font-bold text-white">
                                {selectedWeather?.temperature ?? '-'}°
                            </p>
                        </div>

                        <div className="rounded-xl border border-white/10 bg-white/5 p-2.5">
                            <p className="text-[10px] text-slate-500">
                                Kelembapan
                            </p>

                            <p className="mt-0.5 text-[15px] font-bold text-white">
                                {selectedWeather?.humidity ?? '-'}%
                            </p>
                        </div>

                        <div className="rounded-xl border border-white/10 bg-white/5 p-2.5">
                            <p className="text-[10px] text-slate-500">Angin</p>

                            <p className="mt-0.5 text-[15px] font-bold text-white">
                                {selectedWeather?.wind_speed ?? '-'} km/j
                            </p>
                        </div>

                        <div className="rounded-xl border border-white/10 bg-white/5 p-2.5">
                            <p className="text-[10px] text-slate-500">Arah</p>

                            <p className="mt-0.5 text-[15px] font-bold text-white">
                                {selectedWeather?.wind_direction ?? '-'}
                            </p>
                        </div>
                    </div>
                </section>

                {/* ADVISORY ABU VULKANIK */}

                <section>
                    <PanelTitle>Advisory Abu Vulkanik</PanelTitle>

                    {data.ash_advisory ? (
                        <div className="rounded-xl border border-white/10 bg-white/5 p-2.5 text-[11.5px]">
                            <div className="flex items-center justify-between gap-2">
                                <p className="font-bold text-white">
                                    {data.ash_advisory.volcano_name ??
                                        data.volcano.name}
                                </p>

                                <span
                                    className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase ${
                                        data.ash_advisory.ash_detected
                                            ? 'bg-red-500/15 text-red-300'
                                            : 'bg-emerald-500/10 text-emerald-300'
                                    }`}
                                >
                                    {data.ash_advisory.ash_detected
                                        ? '🌋 Abu terdeteksi'
                                        : 'Tidak ada abu'}
                                </span>
                            </div>

                            <div className="mt-2 space-y-0.5 leading-relaxed text-slate-400">
                                <p>
                                    Tinggi abu ~
                                    {data.ash_advisory.ash_height_m != null
                                        ? `${(
                                              data.ash_advisory.ash_height_m /
                                              1000
                                          ).toFixed(1)} km`
                                        : '-'}
                                    {data.ash_advisory.movement
                                        ? ` • arah ${
                                              data.ash_advisory.movement
                                          }${
                                              data.ash_advisory.speed_kts
                                                  ? ` (${data.ash_advisory.speed_kts} kt)`
                                                  : ''
                                          }`
                                        : ''}
                                </p>

                                <p>
                                    Advisory #
                                    {data.ash_advisory.advisory_nr ?? '-'} •{' '}
                                    {formatWIB(data.ash_advisory.issued_at)} WIB
                                </p>
                            </div>
                        </div>
                    ) : (
                        <p className="rounded-xl border border-dashed border-white/10 bg-white/5 p-2.5 text-[11px] leading-relaxed text-slate-500">
                            Belum ada advisory VAAC Darwin untuk gunung ini
                            dalam 24 jam terakhir.
                        </p>
                    )}
                </section>

                {/* PREDIKSI SEBARAN ABU */}

                {ashActive && selectedForecast && (
                    <section>
                        <PanelTitle>Prediksi Sebaran Abu</PanelTitle>

                        <div className="grid grid-cols-2 gap-1.5">
                            <div className="rounded-xl border border-white/10 bg-white/5 p-2.5">
                                <p className="text-[10px] text-slate-500">
                                    Arah Sebaran
                                </p>

                                <p className="mt-0.5 text-[15px] font-bold text-white">
                                    {selectedForecast.direction != null
                                        ? `${Number(
                                              selectedForecast.direction,
                                          ).toFixed(2)}°`
                                        : '-'}
                                </p>
                            </div>

                            <div className="rounded-xl border border-white/10 bg-white/5 p-2.5">
                                <p className="text-[10px] text-slate-500">
                                    Kecepatan Angin
                                </p>

                                <p className="mt-0.5 text-[15px] font-bold text-white">
                                    {selectedForecast.speed != null
                                        ? `${Number(
                                              selectedForecast.speed,
                                          ).toFixed(1)} km/h`
                                        : '-'}
                                </p>
                            </div>

                            <div className="rounded-xl border border-white/10 bg-white/5 p-2.5">
                                <p className="text-[10px] text-slate-500">
                                    Risiko
                                </p>

                                <p
                                    className={`mt-0.5 text-[15px] font-bold uppercase ${riskClass}`}
                                >
                                    {selectedForecast.risk_level}
                                </p>
                            </div>

                            <div className="rounded-xl border border-white/10 bg-white/5 p-2.5">
                                <p className="text-[10px] text-slate-500">
                                    Confidence
                                </p>

                                <p className="mt-0.5 text-[15px] font-bold text-white">
                                    {selectedForecast.confidence != null
                                        ? `${Number(
                                              selectedForecast.confidence,
                                          ).toFixed(2)}%`
                                        : '-'}
                                </p>
                            </div>
                        </div>

                        <p className="mt-1.5 text-[9.5px] leading-relaxed text-slate-600">
                            +{selectedForecast.forecast_hour} jam •{' '}
                            {selectedForecast.forecast_at
                                ? `${formatWIB(
                                      selectedForecast.forecast_at,
                                  )} WIB`
                                : '-'}
                            . Prediksi model untuk visualisasi, bukan pengganti
                            informasi resmi PVMBG/VAAC.
                        </p>
                    </section>
                )}

                {/* META */}

                <div className="border-t border-white/10 pt-2.5 text-[10px] leading-relaxed text-slate-600">
                    <p>
                        <b className="text-slate-500">Sumber:</b> VAAC Darwin
                        (BOM Australia) • PVMBG/MAGMA • BMKG
                    </p>

                    <p>
                        Update terakhir:{' '}
                        {lastUpdated
                            ? formatWIB(lastUpdated.toISOString())
                            : '-'}{' '}
                        WIB • otomatis 60 detik. Status official PVMBG &amp;
                        sebaran abu VAAC saling melengkapi.
                    </p>
                </div>
            </aside>

            {/* =====================================
            LEGENDA & LAYER (KANAN)
        ====================================== */}

            <aside className="pointer-events-auto absolute top-[132px] right-3 z-[1100] w-[230px] max-w-[40vw] rounded-2xl border border-white/10 bg-white/[0.06] p-3.5 shadow-2xl shadow-black/40 backdrop-blur-xl">
                <PanelTitle>Legenda &amp; Layer</PanelTitle>

                {ashActive ? (
                    <>
                        {LAYER_ORDER.map((key) => {
                            const isChecked = checkedLayers.includes(key);

                            const layerStyle = LAYER_STYLE[key];

                            return (
                                <label
                                    key={key}
                                    className="flex w-full cursor-pointer items-center justify-between py-1.5 text-xs"
                                >
                                    <span className="flex items-center gap-2">
                                        <span
                                            className="w-[18px]"
                                            style={{
                                                borderTop: `3px solid ${LAYER_COLORS[key]}`,
                                                borderTopStyle:
                                                    layerStyle.strokeDashArray
                                                        ? 'dashed'
                                                        : 'solid',
                                                borderRadius: 2,
                                            }}
                                        />

                                        {LAYER_LABELS[key]}
                                    </span>

                                    <span className="relative inline-flex h-[19px] w-[34px] shrink-0 items-center">
                                        <input
                                            type="checkbox"
                                            checked={isChecked}
                                            onChange={() => toggleLayer(key)}
                                            className="peer sr-only"
                                        />

                                        <span className="absolute inset-0 rounded-full bg-white/15 transition peer-checked:bg-orange-500" />

                                        <span className="absolute top-[2.5px] left-[2.5px] h-[14px] w-[14px] rounded-full bg-white transition peer-checked:translate-x-[15px]" />
                                    </span>
                                </label>
                            );
                        })}

                        <p className="mt-2 text-[10px] leading-relaxed text-slate-600">
                            Klik salah satu titik timeline di panel kiri buat
                            sorot layer itu doang di peta, atau pencet play buat
                            muter sebarannya otomatis.
                        </p>

                        {layerDescriptions.length > 0 && (
                            <div className="mt-3 border-t border-white/10 pt-2.5">
                                <p className="text-[9px] font-extrabold tracking-widest text-slate-500 uppercase">
                                    Detail Sebaran Abu
                                </p>

                                <div className="mt-1.5 space-y-1.5">
                                    {layerDescriptions.map((description) => (
                                        <div
                                            key={description.key}
                                            className="rounded-lg bg-white/5 p-2 text-[11px] text-slate-400"
                                        >
                                            <p className="flex items-center gap-1.5 font-semibold text-slate-200">
                                                <span
                                                    className="h-2 w-2 rounded-full"
                                                    style={{
                                                        background:
                                                            LAYER_COLORS[
                                                                description.key
                                                            ],
                                                    }}
                                                />

                                                {description.label}
                                            </p>

                                            {description.heightKm != null && (
                                                <p className="mt-0.5">
                                                    Ketinggian ~
                                                    {formatKm(
                                                        description.heightKm,
                                                    )}
                                                </p>
                                            )}

                                            {description.movementText !=
                                                null && (
                                                <p>
                                                    {description.movementText}
                                                </p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    <p className="mt-1 flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-medium text-emerald-300">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                        Real-time: tidak terdeteksi sebaran abu
                    </p>
                )}
            </aside>

            {/* =====================================
                BOTTOM BAR
            ====================================== */}

            <footer className="pointer-events-none absolute inset-x-3 bottom-3 z-[1100] flex items-end justify-between gap-2">
                <div className="pointer-events-auto rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[10.5px] text-slate-500 backdrop-blur-xl">
                    Volcano Monitoring System • BMKG / PVMBG / VAAC Darwin
                </div>

                <div className="pointer-events-auto rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[10.5px] text-slate-400 backdrop-blur-xl">
                    Update terakhir:{' '}
                    {lastUpdated ? formatWIB(lastUpdated.toISOString()) : '-'}{' '}
                    WIB • live 60 detik
                </div>
            </footer>
        </div>
    );
}
