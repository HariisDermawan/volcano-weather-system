import { useEffect, useState } from 'react';

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
}

interface MonitoringAlert {
id: string;
level: 'critical' | 'warning' | 'info';
title: string;
message: string;
}

export default function Monitoring() {
// ==========================================
// DAFTAR GUNUNG
// ==========================================

const [volcanoes, setVolcanoes] = useState<Volcano[]>([]);

const [selectedVolcanoId, setSelectedVolcanoId] =
    useState<number>(1);

const [volcanoLoading, setVolcanoLoading] =
    useState(true);

const [volcanoError, setVolcanoError] =
    useState<string | null>(null);

// ==========================================
// DATA MONITORING
// ==========================================

const [data, setData] =
    useState<MonitoringData | null>(null);

const [loading, setLoading] =
    useState(true);

const [error, setError] =
    useState<string | null>(null);

const [selectedForecastId, setSelectedForecastId] =
    useState<number | null>(null);

// ==========================================
// AMBIL DAFTAR SEMUA GUNUNG
// ==========================================

useEffect(() => {
    const fetchVolcanoes = async () => {
        try {
            setVolcanoLoading(true);
            setVolcanoError(null);

            const response = await fetch(
                '/api/volcanoes',
                {
                    headers: {
                        Accept: 'application/json',
                    },
                },
            );

            if (!response.ok) {
                throw new Error(
                    'Gagal mengambil daftar gunung api.',
                );
            }

            const result: Volcano[] =
                await response.json();

            setVolcanoes(result);

            // Pertahankan gunung yang sedang dipilih
            // jika masih tersedia di database.
            setSelectedVolcanoId((currentId) => {
                const exists = result.some(
                    (volcano) =>
                        volcano.id === currentId,
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
                throw new Error(
                    'Gagal mengambil data monitoring.',
                );
            }

            const result: MonitoringData =
                await response.json();

            if (cancelled) {
                return;
            }

            setData(result);

            // Reset / pertahankan forecast
            // sesuai gunung yang sedang aktif.
            if (
                result.ash_predictions &&
                result.ash_predictions.length > 0
            ) {
                setSelectedForecastId(
                    (currentId) => {
                        const stillExists =
                            currentId !== null &&
                            result.ash_predictions.some(
                                (prediction) =>
                                    prediction.id ===
                                    currentId,
                            );

                        if (stillExists) {
                            return currentId;
                        }

                        return result
                            .ash_predictions[0]
                            .id;
                    },
                );
            } else {
                setSelectedForecastId(null);
            }
        } catch (err) {
            if (cancelled) {
                return;
            }

            setData(null);

            setError(
                err instanceof Error
                    ? err.message
                    : 'Terjadi kesalahan.',
            );
        } finally {
            if (!cancelled) {
                setLoading(false);
            }
        }
    };

    fetchMonitoringData();

    // Refresh monitoring setiap 60 detik.
    const interval = setInterval(
        fetchMonitoringData,
        60 * 1000,
    );

    return () => {
        cancelled = true;
        clearInterval(interval);
    };
}, [selectedVolcanoId]);

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

    // Bersihkan data lama.
    setData(null);
};

// ==========================================
// LOADING DAFTAR GUNUNG
// ==========================================

if (
    volcanoLoading &&
    volcanoes.length === 0
) {
    return (
        <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
            <div className="text-center">
                <div className="mb-3 text-4xl">
                    🌋
                </div>

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

if (
    volcanoError &&
    volcanoes.length === 0
) {
    return (
        <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6">
            <div className="max-w-lg rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-red-300">
                <h2 className="font-semibold">
                    Gagal memuat daftar gunung
                </h2>

                <p className="mt-2 text-sm">
                    {volcanoError}
                </p>

                <p className="mt-4 text-xs text-red-400">
                    Pastikan endpoint{' '}
                    <code>/api/volcanoes</code>{' '}
                    sudah tersedia.
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
                        <span className="text-3xl">
                            🌋
                        </span>

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
                    <label className="text-xs font-medium uppercase tracking-widest text-slate-500">
                        Pilih Gunung Api
                    </label>

                    <select
                        value={selectedVolcanoId}
                        onChange={handleVolcanoChange}
                        className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-orange-500/50"
                    >
                        {volcanoes.map(
                            (volcano) => (
                                <option
                                    key={
                                        volcano.id
                                    }
                                    value={
                                        volcano.id
                                    }
                                >
                                    {volcano.name}
                                </option>
                            ),
                        )}
                    </select>
                </div>

                <div className="flex min-h-[300px] items-center justify-center">
                    <div className="text-center">
                        <div className="mb-3 text-4xl">
                            🌋
                        </div>

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
                            <span className="text-3xl">
                                🌋
                            </span>

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
                                BMKG + PVMBG
                            </span>
                        </div>
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-7xl px-6 py-6">
                <div className="mb-6 rounded-2xl border border-white/10 bg-slate-900 p-5">
                    <label className="text-xs font-medium uppercase tracking-widest text-slate-500">
                        Pilih Gunung Api
                    </label>

                    <select
                        value={selectedVolcanoId}
                        onChange={handleVolcanoChange}
                        className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-orange-500/50"
                    >
                        {volcanoes.map(
                            (volcano) => (
                                <option
                                    key={
                                        volcano.id
                                    }
                                    value={
                                        volcano.id
                                    }
                                >
                                    {volcano.name}
                                </option>
                            ),
                        )}
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
    return new Intl.DateTimeFormat(
        'id-ID',
        {
            timeZone: 'Asia/Jakarta',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
        },
    ).format(new Date(date));
};

// ==========================================
// FORMAT JAM FORECAST
// ==========================================

const formatForecastTime = (
    date: string | null,
) => {
    if (!date) {
        return '-';
    }

    return new Intl.DateTimeFormat(
        'id-ID',
        {
            timeZone: 'Asia/Jakarta',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
        },
    ).format(new Date(date));
};

// ==========================================
// STATUS GUNUNG
// ==========================================

const status =
    data.volcano.status.toLowerCase();

const statusLabel =
    status.includes('siaga')
        ? 'SIAGA'
        : status.includes('waspada')
            ? 'WASPADA'
            : status.includes('awas')
                ? 'AWAS'
                : status.includes('normal')
                    ? 'NORMAL'
                    : data.volcano.status.toUpperCase();

const statusClass =
    status.includes('siaga')
        ? 'bg-orange-500/15 text-orange-400 border-orange-500/30'
        : status.includes('waspada')
            ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30'
            : status.includes('awas')
                ? 'bg-red-500/15 text-red-400 border-red-500/30'
                : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';

// ==========================================
// FORECAST YANG DIPILIH
// ==========================================

const selectedForecast =
    data.ash_predictions?.find(
        (prediction) =>
            prediction.id ===
            selectedForecastId,
    ) ??
    data.ash_predictions?.[0] ??
    data.ash_prediction;

// ==========================================
// WEATHER SESUAI FORECAST
// ==========================================

const selectedWeather =
    data.weather_forecasts?.find(
        (forecast) =>
            selectedForecast?.forecast_at &&
            new Date(
                forecast.forecast_at,
            ).getTime() ===
                new Date(
                    selectedForecast.forecast_at,
                ).getTime(),
    ) ??
    data.weather ??
    null;

// ==========================================
// RISIKO ABU
// ==========================================

const riskLevel =
    selectedForecast?.risk_level?.toLowerCase() ??
    '';

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

if (riskLevel === 'extreme') {
    alerts.push({
        id: 'ash-extreme',
        level: 'critical',
        title: 'Risiko Sebaran Abu Ekstrem',
        message:
            'Prediksi menunjukkan risiko sebaran abu berada pada tingkat EXTREME. Kondisi perlu mendapat perhatian khusus.',
    });
}

if (riskLevel === 'high') {
    alerts.push({
        id: 'ash-high',
        level: 'warning',
        title: 'Risiko Sebaran Abu Tinggi',
        message:
            'Prediksi menunjukkan risiko sebaran abu berada pada tingkat HIGH.',
    });
}

if (status.includes('siaga')) {
    alerts.push({
        id: 'volcano-siaga',
        level: 'warning',
        title: 'Status Gunung SIAGA',
        message: `${data.volcano.name} saat ini berada pada status SIAGA. Aktivitas vulkanik perlu dipantau secara intensif.`,
    });
}

const ashHeight =
    data.activity?.ash_height != null
        ? Number(data.activity.ash_height)
        : null;

if (
    ashHeight !== null &&
    Number.isFinite(ashHeight) &&
    ashHeight >= 1000
) {
    alerts.push({
        id: 'ash-height',
        level: 'warning',
        title: 'Kolom Abu Tinggi',
        message: `Tinggi kolom abu terdeteksi sekitar ${ashHeight.toFixed(0)} meter.`,
    });
}

if (alerts.length === 0) {
    alerts.push({
        id: 'monitoring-normal',
        level: 'info',
        title: 'Monitoring Normal',
        message:
            'Tidak ada peringatan kritis berdasarkan data monitoring terbaru.',
    });
}

// ==========================================
// RENDER
// ==========================================

return (
    <div className="min-h-screen bg-slate-950 text-white">

        {/* =====================================
            HEADER
        ====================================== */}

        <header className="border-b border-white/10 bg-slate-950/90">
            <div className="mx-auto max-w-7xl px-6 py-5">

                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">

                    <div>
                        <div className="flex items-center gap-3">
                            <span className="text-3xl">
                                🌋
                            </span>

                            <div>
                                <h1 className="text-2xl font-bold tracking-tight">
                                    Volcano Monitoring
                                </h1>

                                <p className="text-sm text-slate-400">
                                    Sistem monitoring gunung api & cuaca
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">

                        {/* SELECT GUNUNG */}

                        <div className="min-w-[280px]">
                            <label
                                htmlFor="volcano-select"
                                className="mb-1 block text-xs font-medium uppercase tracking-widest text-slate-500"
                            >
                                Pilih Gunung Api
                            </label>

                            <select
                                id="volcano-select"
                                value={selectedVolcanoId}
                                onChange={
                                    handleVolcanoChange
                                }
                                className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-2.5 text-sm font-medium text-white outline-none transition focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/30"
                            >
                                {volcanoes.map(
                                    (volcano) => (
                                        <option
                                            key={
                                                volcano.id
                                            }
                                            value={
                                                volcano.id
                                            }
                                        >
                                            {volcano.name} —{' '}
                                            {
                                                volcano.code
                                            }
                                        </option>
                                    ),
                                )}
                            </select>
                        </div>

                        {/* STATUS SISTEM */}

                        <div className="flex items-center gap-3">
                            <span className="flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-400">
                                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                                ONLINE
                            </span>

                            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-400">
                                BMKG + PVMBG
                            </span>
                        </div>
                    </div>
                </div>

                {/* INFO GUNUNG TERPILIH */}

                <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span>
                        Gunung aktif:
                    </span>

                    <span className="font-medium text-slate-300">
                        {data.volcano.name}
                    </span>

                    <span>•</span>

                    <span>
                        {data.volcano.code}
                    </span>

                    <span>•</span>

                    <span>
                        Update monitoring otomatis setiap 60 detik
                    </span>
                </div>
            </div>
        </header>

        <main className="mx-auto max-w-7xl space-y-6 px-6 py-6">

            {/* =================================
                ALERT & NOTIFIKASI
            ================================== */}

            <section className="space-y-3">
                <div className="flex items-center justify-between">

                    <div>
                        <h2 className="text-lg font-semibold">
                            Alert & Notifikasi
                        </h2>

                        <p className="text-sm text-slate-500">
                            Peringatan berdasarkan kondisi monitoring terbaru
                        </p>
                    </div>

                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-400">
                        {alerts.length} Alert
                    </span>
                </div>

                <div className="space-y-3">
                    {alerts.map((alert) => {

                        const alertClass =
                            alert.level ===
                            'critical'
                                ? 'border-red-500/30 bg-red-500/10'
                                : alert.level ===
                                    'warning'
                                    ? 'border-orange-500/30 bg-orange-500/10'
                                    : 'border-emerald-500/30 bg-emerald-500/10';

                        const titleClass =
                            alert.level ===
                            'critical'
                                ? 'text-red-400'
                                : alert.level ===
                                    'warning'
                                    ? 'text-orange-400'
                                    : 'text-emerald-400';

                        const icon =
                            alert.level ===
                            'critical'
                                ? '🚨'
                                : alert.level ===
                                    'warning'
                                    ? '⚠️'
                                    : '🟢';

                        return (
                            <div
                                key={alert.id}
                                className={`rounded-2xl border p-4 ${alertClass}`}
                            >
                                <div className="flex items-start gap-4">

                                    <div className="text-2xl">
                                        {icon}
                                    </div>

                                    <div className="flex-1">
                                        <h3
                                            className={`font-semibold ${titleClass}`}
                                        >
                                            {
                                                alert.title
                                            }
                                        </h3>

                                        <p className="mt-1 text-sm leading-6 text-slate-400">
                                            {
                                                alert.message
                                            }
                                        </p>
                                    </div>

                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* =================================
                VOLCANO OVERVIEW
            ================================== */}

            <section className="grid gap-4 lg:grid-cols-3">

                <div className="rounded-2xl border border-white/10 bg-slate-900 p-5 shadow-xl lg:col-span-2">

                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">

                        <div>
                            <p className="text-xs font-medium uppercase tracking-widest text-slate-500">
                                Volcano
                            </p>

                            <h2 className="mt-1 text-2xl font-bold">
                                {
                                    data.volcano.name
                                }
                            </h2>

                            <p className="mt-1 text-sm text-slate-400">
                                Kode:{' '}
                                {
                                    data.volcano.code
                                }
                            </p>
                        </div>

                        <span
                            className={`w-fit rounded-full border px-4 py-2 text-sm font-bold ${statusClass}`}
                        >
                            ● {statusLabel}
                        </span>
                    </div>

                    <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">

                        <div className="rounded-xl bg-slate-950 p-4">
                            <p className="text-xs text-slate-500">
                                Elevasi
                            </p>

                            <p className="mt-1 text-lg font-semibold">
                                {
                                    data.volcano
                                        .elevation ??
                                    '-'
                                }

                                <span className="ml-1 text-xs font-normal text-slate-500">
                                    mdpl
                                </span>
                            </p>
                        </div>

                        <div className="rounded-xl bg-slate-950 p-4">
                            <p className="text-xs text-slate-500">
                                Latitude
                            </p>

                            <p className="mt-1 text-sm font-semibold">
                                {
                                    data.volcano
                                        .latitude
                                }
                            </p>
                        </div>

                        <div className="rounded-xl bg-slate-950 p-4">
                            <p className="text-xs text-slate-500">
                                Longitude
                            </p>

                            <p className="mt-1 text-sm font-semibold">
                                {
                                    data.volcano
                                        .longitude
                                }
                            </p>
                        </div>

                        <div className="rounded-xl bg-slate-950 p-4">
                            <p className="text-xs text-slate-500">
                                Status
                            </p>

                            <p className="mt-1 text-sm font-semibold uppercase">
                                {
                                    data.volcano
                                        .status
                                }
                            </p>
                        </div>
                    </div>
                </div>

                {/* ACTIVITY */}

                <div className="rounded-2xl border border-orange-500/20 bg-orange-500/5 p-5">

                    <div className="flex items-center justify-between">

                        <p className="text-xs font-medium uppercase tracking-widest text-orange-400">
                            Aktivitas
                        </p>

                        <span className="text-xl">
                            ⚠️
                        </span>
                    </div>

                    <h3 className="mt-3 text-xl font-bold">
                        {
                            data.activity
                                ?.activity_level ??
                            'Tidak ada data'
                        }
                    </h3>

                    <p className="mt-3 text-sm leading-6 text-slate-400">
                        {
                            data.activity
                                ?.description ??
                            'Belum tersedia informasi aktivitas terbaru.'
                        }
                    </p>

                    {data.activity
                        ?.occurred_at && (
                        <p className="mt-4 text-xs text-slate-500">
                            Update:{' '}
                            {formatWIB(
                                data.activity
                                    .occurred_at,
                            )}{' '}
                            WIB
                        </p>
                    )}
                </div>
            </section>

            {/* =================================
                WEATHER
            ================================== */}

            <section>

                <div className="mb-3 flex items-center justify-between">

                    <div>
                        <h2 className="text-lg font-semibold">
                            Kondisi Cuaca
                        </h2>

                        <p className="text-sm text-slate-500">
                            Data forecast dari BMKG • sinkron dengan timeline abu
                        </p>
                    </div>

                    <span className="text-xs text-slate-500">
                        {selectedWeather?.forecast_at
                            ? `${formatWIB(
                                selectedWeather.forecast_at,
                            )} WIB`
                            : '-'}
                    </span>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

                    {/* SUHU */}

                    <div className="rounded-2xl border border-white/10 bg-slate-900 p-5">

                        <p className="text-sm text-slate-400">
                            Suhu
                        </p>

                        <div className="mt-3 flex items-end gap-2">

                            <span className="text-3xl font-bold">
                                {
                                    selectedWeather
                                        ?.temperature ??
                                    '-'
                                }
                            </span>

                            <span className="mb-1 text-sm text-slate-500">
                                °C
                            </span>
                        </div>

                        <p className="mt-2 text-xs text-slate-500">
                            🌡️ Temperature
                        </p>
                    </div>

                    {/* KELEMBAPAN */}

                    <div className="rounded-2xl border border-white/10 bg-slate-900 p-5">

                        <p className="text-sm text-slate-400">
                            Kelembapan
                        </p>

                        <div className="mt-3 flex items-end gap-2">

                            <span className="text-3xl font-bold">
                                {
                                    selectedWeather
                                        ?.humidity ??
                                    '-'
                                }
                            </span>

                            <span className="mb-1 text-sm text-slate-500">
                                %
                            </span>
                        </div>

                        <p className="mt-2 text-xs text-slate-500">
                            💧 Humidity
                        </p>
                    </div>

                    {/* KECEPATAN ANGIN */}

                    <div className="rounded-2xl border border-white/10 bg-slate-900 p-5">

                        <p className="text-sm text-slate-400">
                            Kecepatan Angin
                        </p>

                        <div className="mt-3 flex items-end gap-2">

                            <span className="text-3xl font-bold">
                                {
                                    selectedWeather
                                        ?.wind_speed ??
                                    '-'
                                }
                            </span>

                            <span className="mb-1 text-sm text-slate-500">
                                km/h
                            </span>
                        </div>

                        <p className="mt-2 text-xs text-slate-500">
                            💨 Wind speed
                        </p>
                    </div>

                    {/* ARAH ANGIN */}

                    <div className="rounded-2xl border border-white/10 bg-slate-900 p-5">

                        <p className="text-sm text-slate-400">
                            Arah Angin
                        </p>

                        <div className="mt-3 flex items-center gap-3">

                            <span className="text-3xl">
                                🧭
                            </span>

                            <span className="text-2xl font-bold">
                                {
                                    selectedWeather
                                        ?.wind_direction ??
                                    '-'
                                }
                            </span>
                        </div>

                        <p className="mt-2 text-xs text-slate-500">
                            Wind direction
                        </p>
                    </div>
                </div>
            </section>

            {/* =================================
                MAP
            ================================== */}

            <section className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900 shadow-xl">

                <div className="border-b border-white/10 px-5 py-4">

                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">

                        <div>
                            <h2 className="text-lg font-semibold">
                                Peta Monitoring
                            </h2>

                            <p className="text-sm text-slate-500">
                                Posisi gunung api dan area sebaran abu
                            </p>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-slate-400">

                            <span className="flex items-center gap-1.5">
                                <span className="h-2 w-2 rounded-full bg-red-500" />
                                Volcano
                            </span>

                            <span>•</span>

                            <span>
                                OpenStreetMap
                            </span>

                            {selectedForecast?.geometry && (
                                <>
                                    <span>
                                        •
                                    </span>

                                    <span className="text-orange-400">
                                        Prediksi Abu
                                    </span>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                <VolcanoMap
                    latitude={
                        data.volcano
                            .latitude
                    }
                    longitude={
                        data.volcano
                            .longitude
                    }
                    ashGeometry={
                        selectedForecast?.geometry ??
                        null
                    }
                    windDirection={
                        selectedForecast?.direction !=
                        null
                            ? Number(
                                selectedForecast.direction,
                            )
                            : null
                    }
                    windSpeed={
                        selectedForecast?.speed !=
                        null
                            ? Number(
                                selectedForecast.speed,
                            )
                            : null
                    }
                    riskLevel={
                        selectedForecast?.risk_level ??
                        null
                    }
                />
            </section>

            {/* =================================
                FORECAST TIMELINE
            ================================== */}

            <section className="rounded-2xl border border-white/10 bg-slate-900 p-5">

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">

                    <div>
                        <h2 className="text-lg font-semibold">
                            Timeline Prediksi Abu
                        </h2>

                        <p className="text-sm text-slate-500">
                            Pilih waktu forecast untuk melihat perubahan sebaran abu pada peta dan kondisi cuaca
                        </p>
                    </div>

                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-400">
                        {data.ash_predictions
                            ?.length ?? 0}{' '}
                        Forecast
                    </span>
                </div>

                {data.ash_predictions
                    ?.length > 0 ? (
                    <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">

                        {data.ash_predictions.map(
                            (prediction) => {

                                const isSelected =
                                    prediction.id ===
                                    selectedForecastId;

                                const predictionRisk =
                                    prediction.risk_level?.toLowerCase() ??
                                    '';

                                const predictionRiskClass =
                                    predictionRisk ===
                                    'extreme'
                                        ? 'text-red-400'
                                        : predictionRisk ===
                                            'high'
                                            ? 'text-orange-400'
                                            : predictionRisk ===
                                                'medium'
                                                ? 'text-yellow-400'
                                                : 'text-emerald-400';

                                return (
                                    <button
                                        key={
                                            prediction.id
                                        }
                                        type="button"
                                        onClick={() =>
                                            setSelectedForecastId(
                                                prediction.id,
                                            )
                                        }
                                        className={`rounded-xl border p-4 text-left transition ${
                                            isSelected
                                                ? 'border-orange-500/50 bg-orange-500/10'
                                                : 'border-white/10 bg-slate-950 hover:border-white/20 hover:bg-white/5'
                                        }`}
                                    >

                                        <div className="flex items-start justify-between gap-3">

                                            <div>
                                                <p className="text-xs text-slate-500">
                                                    Forecast
                                                </p>

                                                <p className="mt-1 text-lg font-bold">
                                                    +
                                                    {
                                                        prediction.forecast_hour
                                                    }{' '}
                                                    jam
                                                </p>
                                            </div>

                                            <span
                                                className={`rounded-full bg-white/5 px-2 py-1 text-xs font-semibold uppercase ${predictionRiskClass}`}
                                            >
                                                {
                                                    prediction.risk_level
                                                }
                                            </span>
                                        </div>

                                        <div className="mt-4 grid grid-cols-2 gap-3">

                                            <div>
                                                <p className="text-xs text-slate-500">
                                                    Waktu
                                                </p>

                                                <p className="mt-1 text-sm font-semibold">
                                                    {formatForecastTime(
                                                        prediction.forecast_at,
                                                    )}
                                                </p>
                                            </div>

                                            <div>
                                                <p className="text-xs text-slate-500">
                                                    Angin
                                                </p>

                                                <p className="mt-1 text-sm font-semibold">
                                                    {prediction.speed !=
                                                    null
                                                        ? `${Number(
                                                            prediction.speed,
                                                        ).toFixed(
                                                            1,
                                                        )} km/h`
                                                        : '-'}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="mt-3 text-xs text-slate-500">
                                            Arah plume:{' '}
                                            <span className="font-semibold text-slate-300">
                                                {prediction.direction !=
                                                null
                                                    ? `${Number(
                                                        prediction.direction,
                                                    ).toFixed(
                                                        0,
                                                    )}°`
                                                    : '-'}
                                            </span>
                                        </div>

                                        {isSelected && (
                                            <div className="mt-3 border-t border-orange-500/20 pt-3 text-xs font-medium text-orange-400">
                                                ● Forecast aktif di peta & cuaca
                                            </div>
                                        )}
                                    </button>
                                );
                            },
                        )}
                    </div>
                ) : (
                    <div className="mt-5 rounded-xl border border-white/10 bg-slate-950 p-5 text-sm text-slate-500">
                        Belum ada data forecast abu.
                    </div>
                )}
            </section>

            {/* =================================
                ASH PREDICTION DETAIL
            ================================== */}

            <section className="rounded-2xl border border-white/10 bg-slate-900 p-5">

                <div className="flex items-center justify-between">

                    <div>
                        <h2 className="text-lg font-semibold">
                            Prediksi Sebaran Abu
                        </h2>

                        <p className="text-sm text-slate-500">
                            Estimasi berdasarkan data angin
                        </p>
                    </div>

                    <span className="text-2xl">
                        🌫️
                    </span>
                </div>

                {selectedForecast && (
                    <>
                        <div className="mt-4 rounded-xl border border-orange-500/20 bg-orange-500/5 p-4">

                            <div className="flex flex-wrap items-center gap-3">

                                <span className="rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1 text-xs font-semibold text-orange-400">
                                    +
                                    {
                                        selectedForecast.forecast_hour
                                    }{' '}
                                    jam
                                </span>

                                <span className="text-sm text-slate-400">
                                    {selectedForecast.forecast_at
                                        ? `${formatWIB(
                                            selectedForecast.forecast_at,
                                        )} WIB`
                                        : '-'}
                                </span>
                            </div>
                        </div>

                        <div className="mt-5 grid gap-4 sm:grid-cols-4">

                            {/* ARAH */}

                            <div className="rounded-xl bg-slate-950 p-4">

                                <p className="text-xs text-slate-500">
                                    Arah Sebaran
                                </p>

                                <p className="mt-2 text-xl font-bold">
                                    {selectedForecast.direction !=
                                    null
                                        ? `${Number(
                                            selectedForecast.direction,
                                        ).toFixed(
                                            2,
                                        )}°`
                                        : '-'}
                                </p>
                            </div>

                            {/* KECEPATAN */}

                            <div className="rounded-xl bg-slate-950 p-4">

                                <p className="text-xs text-slate-500">
                                    Kecepatan Angin
                                </p>

                                <p className="mt-2 text-xl font-bold">
                                    {selectedForecast.speed !=
                                    null
                                        ? `${Number(
                                            selectedForecast.speed,
                                        ).toFixed(
                                            1,
                                        )} km/h`
                                        : '-'}
                                </p>
                            </div>

                            {/* RISIKO */}

                            <div className="rounded-xl bg-slate-950 p-4">

                                <p className="text-xs text-slate-500">
                                    Risiko
                                </p>

                                <p
                                    className={`mt-2 text-xl font-bold uppercase ${riskClass}`}
                                >
                                    {
                                        selectedForecast.risk_level
                                    }
                                </p>
                            </div>

                            {/* CONFIDENCE */}

                            <div className="rounded-xl bg-slate-950 p-4">

                                <p className="text-xs text-slate-500">
                                    Confidence
                                </p>

                                <p className="mt-2 text-xl font-bold">
                                    {selectedForecast.confidence !=
                                    null
                                        ? `${Number(
                                            selectedForecast.confidence,
                                        ).toFixed(
                                            2,
                                        )}%`
                                        : '-'}
                                </p>
                            </div>
                        </div>

                        <div className="mt-4 rounded-xl border border-white/10 bg-slate-950 p-4">

                            <p className="text-xs leading-5 text-slate-500">
                                Catatan: prediksi sebaran abu ini
                                merupakan estimasi model untuk
                                visualisasi berdasarkan kondisi
                                angin, bukan pengganti informasi
                                bahaya resmi dari PVMBG/VAAC.
                            </p>
                        </div>
                    </>
                )}

                {!selectedForecast && (
                    <div className="mt-5 rounded-xl border border-white/10 bg-slate-950 p-5 text-sm text-slate-500">
                        Belum ada prediksi sebaran abu.
                    </div>
                )}
            </section>
        </main>

        {/* =====================================
            FOOTER
        ====================================== */}

        <footer className="border-t border-white/10 py-6 text-center text-xs text-slate-600">
            Volcano Monitoring System • BMKG / PVMBG Data
        </footer>
    </div>
);

}
