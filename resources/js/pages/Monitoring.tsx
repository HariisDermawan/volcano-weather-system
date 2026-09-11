import { useEffect, useMemo, useState, type ReactNode } from 'react';

import {
    Activity,
    AlertTriangle,
    ArrowLeft,
    ChevronDown,
    CircleCheck,
    CloudSun,
    Droplets,
    ExternalLink,
    Gauge,
    LandPlot,
    Layers,
    MapPin,
    MountainSnow,
    Navigation,
    Pause,
    Play,
    Radio,
    RefreshCw,
    ShieldCheck,
    Siren,
    Thermometer,
    TriangleAlert,
    Wind,
} from 'lucide-react';

import VolcanoMap from '@/components/VolcanoMap';

interface Volcano {
    id: number;
    name: string;
    code: string;
    latitude: number;
    longitude: number;
    elevation: number | null;
    status: string;
    status_source?: 'live' | 'database';
    ash_active?: boolean;
    erupting?: boolean;
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
    source?: string;
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

interface CurrentWeather {
    source: string | null;
    observed_at: string | null;
    temperature_c: number | null;
    apparent_temperature_c: number | null;
    humidity: number | null;
    pressure_msl: number | null;
    wind_speed_kmh: number | null;
    wind_direction_deg: number | null;
    wind_direction_cardinal: string | null;
    wind_gust_kmh: number | null;
}

interface MonitoringData {
    volcano: Volcano;
    activity: Activity | null;
    weather: Weather | null;
    weather_forecasts: WeatherForecast[];
    current_weather: CurrentWeather | null;
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

interface GempaItem {
    eventid?: string | null;
    status?: string | null;
    datetime: string | null;
    tanggal: string | null;
    jam: string | null;
    latitude: number | null;
    longitude: number | null;
    lintang: string | null;
    bujur: string | null;
    magnitude: string | null;
    depth: string | null;
    region: string | null;
    potential: string | null;
    felt: string | null;
    shakemap: string | null;
}

interface GempaData {
    latest: GempaItem | null;
    list: GempaItem[];
    error?: string | null;
}

interface GerakanTanahItem {
    id: string | number | null;
    title: string | null;
    date: string | null;
    url: string | null;
}

interface GerakanTanahData {
    list: GerakanTanahItem[];
    error?: string | null;
}

interface CityData {
    city: {
        name: string | null;
        provinsi: string | null;
        country: string | null;
        latitude: number;
        longitude: number;
        geocode_source: string | null;
    };
    summary: {
        ash_edge_km: number | null;
        inside_plume: boolean;
        nearest_ash_volcano: string | null;
        plume_volcanoes: Array<string | null>;
    };
}

interface EarthquakeMarkerInfo {
    id: string;
    latitude: number | null;
    longitude: number | null;
    magnitude: number | null;
    region: string | null;
    datetime: string | null;
    depth: string | null;
    felt: string | null;
}

interface VolcanoQuakeInfo {
    magnitude: string | null;
    region: string | null;
    datetime: string | null;
    distanceKm: number;
}

/*
 * ==========================================
 * JARAK AMBANG GEMPA "DEKAT GUNUNG" (KM)
 * ==========================================
 */

const QUIKE_NEAR_KM = 150;

function haversineKm(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
): number {
    const toRad = (deg: number) => (deg * Math.PI) / 180;

    const earthRadiusKm = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);

    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;

    return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/*
 * ==========================================
 * JUDUL SEKSI (PANEL DECK / SIDE)
 * ==========================================
 */

function PanelTitle({
    icon,
    children,
}: {
    icon?: ReactNode;
    children: ReactNode;
}) {
    return (
        <p className="mb-2.5 flex items-center gap-2 text-[10.5px] font-extrabold tracking-[1px] text-slate-300 uppercase">
            <span className="h-3 w-[3px] shrink-0 rounded-full bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.7)]" />

            {icon && (
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/5 text-[10.5px] text-sky-400">
                    {icon}
                </span>
            )}

            <span>{children}</span>

            <span className="h-px flex-1 bg-gradient-to-r from-white/20 via-white/10 to-transparent" />
        </p>
    );
}

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

function LegendPanel({
    showGempaMarkers,
    onToggleGempa,
    volcanoQuakesCount,
    checkedLayers,
    onToggleLayer,
    ashActive,
}: {
    showGempaMarkers: boolean;
    onToggleGempa: () => void;
    volcanoQuakesCount: number;
    checkedLayers: string[];
    onToggleLayer: (key: string) => void;
    ashActive: boolean;
}) {
    return (
        <div className="flex flex-col">
            <PanelTitle icon={<Layers size={11} strokeWidth={2.5} />}>
                Legenda &amp; Layer
            </PanelTitle>

            <label className="flex w-full cursor-pointer items-center justify-between py-1.5 text-xs">
                <span className="flex items-center gap-2">
                    <span className="relative grid h-[18px] w-[18px] shrink-0 place-items-center">
                        <span className="absolute inset-0 animate-ping rounded-full border border-red-400/70" />
                        <span className="h-[9px] w-[9px] rounded-full border-2 border-red-400 bg-red-500/30" />
                    </span>
                    Gempa Terkini (BMKG)
                </span>

                <span className="relative inline-flex h-[19px] w-[34px] shrink-0 items-center">
                    <input
                        type="checkbox"
                        checked={showGempaMarkers}
                        onChange={onToggleGempa}
                        className="peer sr-only"
                    />

                    <span className="absolute inset-0 rounded-full bg-white/15 transition peer-checked:bg-red-500" />

                    <span className="absolute top-[2.5px] left-[2.5px] h-[14px] w-[14px] rounded-full bg-white transition peer-checked:translate-x-[15px]" />
                </span>
            </label>

            <div className="mb-1.5 grid grid-cols-2 gap-x-2 gap-y-1 rounded-lg border border-white/5 bg-white/[0.03] px-2.5 py-2 text-[9px] text-slate-500">
                {[
                    ['#22c55e', 'M < 4'],
                    ['#eab308', 'M 4–5'],
                    ['#f97316', 'M 5–6'],
                    ['#ef4444', 'M 6–7'],
                    ['#a855f7', 'M ≥ 7'],
                ].map(([color, labelKey]) => (
                    <span key={labelKey} className="flex items-center gap-1.5">
                        <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full border border-white/30"
                            style={{ background: color }}
                        />
                        {labelKey}
                    </span>
                ))}
            </div>

            {volcanoQuakesCount > 0 && (
                <p className="mb-1.5 flex items-center gap-1.5 rounded-lg border border-red-500/15 bg-red-500/5 px-2 py-1.5 text-[9.5px] font-semibold text-red-300">
                    <Siren size={10} strokeWidth={2.5} />
                    {volcanoQuakesCount} gunung sedang dekat gempa
                </p>
            )}

            <div className="mb-1 flex items-center gap-1.5 border-b border-white/10 pb-2 text-[9.5px] font-semibold tracking-widest text-slate-500 uppercase">
                <span className="h-2 w-2 rounded-full bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,1)]" />
                Sebaran Abu Vulkanik {ashActive ? '' : '(tidak ada)'}
            </div>

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
                                        onChange={() => onToggleLayer(key)}
                                        className="peer sr-only"
                                    />

                                    <span className="absolute inset-0 rounded-full bg-white/15 transition peer-checked:bg-sky-500" />

                                    <span className="absolute top-[2.5px] left-[2.5px] h-[14px] w-[14px] rounded-full bg-white transition peer-checked:translate-x-[15px]" />
                                </span>
                            </label>
                        );
                    })}

                    <p className="mt-2 text-[10px] leading-relaxed text-slate-600">
                        Klik salah satu titik timeline di panel kiri buat sorot
                        layer itu doang di peta, atau pencet play buat muter
                        sebarannya otomatis.
                    </p>
                </>
            ) : (
                <p className="mt-1 flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-medium text-emerald-300">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                    tidak terdeteksi sebaran abu
                </p>
            )}
        </div>
    );
}

interface WavePoint {
    label: string;
    temperature: number | null;
    wind_speed: number | null;
    humidity: number | null;
}

function WeatherWaveChart({
    points,
    activeKey,
    waveColor,
}: {
    points: WavePoint[];
    activeKey: string;
    waveColor: string;
}) {
    const series = useMemo(() => {
        const prevTime = Date.now() - 6 * 60 * 60 * 1000;
        const step = 6 * 60 * 60 * 1000;

        return points.map((point, idx) => ({
            idx,
            label: point.label,
            t: prevTime + idx * step,
            v: point.temperature,
        }));
    }, [points]);

    const activeIndex = Math.max(
        0,
        LAYER_ORDER.indexOf(activeKey as (typeof LAYER_ORDER)[number]),
    );

    const activeEntry = series[activeIndex] ?? null;

    const values = series.map((entry) => entry.v);

    const validCount = values.filter((value) => value != null).length;

    if (validCount < 2) {
        return (
            <div className="mt-2 rounded-xl border border-white/10 bg-white/5 p-2.5">
                <p className="text-center text-[10px] text-slate-500">
                    Belum cukup data prakiraan untuk grafik.
                </p>
            </div>
        );
    }

    const W = 292;
    const H = 76;
    const PADX = 6;
    const PADT = 10;
    const PADB = 14;

    const minT = series[0].t;
    const maxT = series[series.length - 1].t;
    const spanT = Math.max(1, maxT - minT);

    const presentValues = values.filter(
        (value): value is number => value != null,
    );
    const minV = Math.min(...presentValues);
    const maxV = Math.max(...presentValues);
    const pad = (maxV - minV) * 0.2 || 1;
    const lo = minV - pad;
    const hi = maxV + pad;

    const x = (t: number) => PADX + ((t - minT) / spanT) * (W - PADX * 2);
    const y = (v: number) => PADT + ((hi - v) / (hi - lo)) * (H - PADT - PADB);

    const coords = series
        .filter((entry) => entry.v != null)
        .map((entry) => ({
            idx: entry.idx,
            x: x(entry.t),
            y: y(entry.v as number),
        }));

    let lineD = `M ${coords[0].x.toFixed(1)},${coords[0].y.toFixed(1)}`;

    for (let i = 1; i < coords.length; i++) {
        const prev = coords[i - 1];
        const curr = coords[i];
        const midX = (prev.x + curr.x) / 2;
        lineD += ` Q ${midX.toFixed(1)},${prev.y.toFixed(1)} ${curr.x.toFixed(1)},${curr.y.toFixed(1)}`;
    }

    const lastCoord = coords[coords.length - 1];
    const areaD = `${lineD} L ${lastCoord.x.toFixed(1)},${H - PADB} L ${coords[0].x.toFixed(1)},${H - PADB} Z`;

    return (
        <div className="mt-2 rounded-xl border border-white/10 bg-white/5 p-2.5">
            <div className="relative overflow-hidden rounded-lg">
                <svg
                    viewBox={`0 0 ${W} ${H}`}
                    className="block h-[74px] w-full"
                    role="img"
                    aria-label="Grafik suhu per jam observasi & prakiraan"
                >
                    <defs>
                        <linearGradient
                            id="weatherWaveAreaFill"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                        >
                            <stop
                                offset="0%"
                                stop-color={waveColor}
                                stop-opacity="0.3"
                            />
                            <stop
                                offset="100%"
                                stop-color={waveColor}
                                stop-opacity="0"
                            />
                        </linearGradient>
                    </defs>

                    {[lo, (lo + hi) / 2, hi].map((gridValue, idx) => (
                        <line
                            key={idx}
                            x1={PADX}
                            x2={W - PADX}
                            y1={y(gridValue)}
                            y2={y(gridValue)}
                            stroke="rgba(255,255,255,0.06)"
                            stroke-dasharray="3 4"
                            stroke-width="1"
                        />
                    ))}

                    <path d={areaD} fill="url(#weatherWaveAreaFill)" />

                    <path
                        d={lineD}
                        fill="none"
                        stroke={waveColor}
                        stroke-width="1.6"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    />

                    {coords.map(({ x: cx, y: cy, idx }) => {
                        const isActive = idx === activeIndex;

                        return (
                            <g key={idx}>
                                {isActive && (
                                    <>
                                        <line
                                            x1={cx}
                                            x2={cx}
                                            y1={cy}
                                            y2={H - PADB}
                                            stroke={waveColor}
                                            stroke-opacity={0.35}
                                            stroke-dasharray="2 3"
                                            stroke-width="1"
                                        />

                                        <circle
                                            cx={cx}
                                            cy={cy}
                                            r={7}
                                            fill={waveColor}
                                            opacity={0.16}
                                        />
                                    </>
                                )}

                                <circle
                                    cx={cx}
                                    cy={cy}
                                    r={isActive ? 3.4 : 1.6}
                                    fill="#0a0f1c"
                                    stroke={waveColor}
                                    stroke-width={isActive ? 2 : 1.4}
                                />
                            </g>
                        );
                    })}

                    <rect
                        className="wave-scan"
                        x="-1"
                        y={PADT}
                        width="1.5"
                        height={H - PADT - PADB}
                        style={{ fill: waveColor, fillOpacity: 0.35 }}
                    />

                    {series.map((entry, idx) => (
                        <text
                            key={idx}
                            x={x(entry.t)}
                            y={H - 3}
                            text-anchor={
                                idx === series.length - 1
                                    ? 'end'
                                    : idx === 0
                                      ? 'start'
                                      : 'middle'
                            }
                            fill="#64748b"
                            fontSize="7"
                        >
                            {entry.label}
                        </text>
                    ))}
                </svg>
            </div>

            <div className="mt-1 flex items-center justify-between text-[8.5px] text-slate-600">
                <span>min {minV}°C</span>

                <span className="flex items-center gap-1 font-semibold text-slate-300">
                    <span
                        className="h-1 w-1 animate-pulse rounded-full"
                        style={{ background: waveColor }}
                    />
                    {activeEntry?.label}{' '}
                    {activeEntry?.v != null ? `${activeEntry.v}°C` : '—'}
                </span>

                <span>maks {maxV}°C</span>
            </div>

            <p className="mt-1 flex items-center justify-center gap-1 text-[8.5px] text-slate-600">
                <span
                    className="h-1 w-1 animate-pulse rounded-full"
                    style={{ background: waveColor }}
                />
                Data sesuai jam observasi &amp; prakiraan · diperbarui otomatis
                tiap 30 detik
            </p>
        </div>
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

    const [timelineBucketKey, setTimelineBucketKey] = useState('observasi');

    // ==========================================
    // DATA GEO (GEMPA & GERAKAN TANAH)
    // ==========================================

    const [gempa, setGempa] = useState<GempaData | null>(null);

    const [gerakanTanah, setGerakanTanah] = useState<GerakanTanahData | null>(
        null,
    );

    const [showGempaMarkers, setShowGempaMarkers] = useState(true);

    const [layerOpen, setLayerOpen] = useState(false);

    const [selectedGempa, setSelectedGempa] = useState<GempaItem | null>(null);

    const [geoState, setGeoState] = useState<
        'idle' | 'requesting' | 'success' | 'denied' | 'error'
    >('idle');

    const [cityCoords, setCityCoords] = useState<{
        lat: number;
        lon: number;
    } | null>(null);

    const [cityData, setCityData] = useState<CityData | null>(null);

    const [geoError, setGeoError] = useState<string | null>(null);

    const selectedQuakeId = selectedGempa?.eventid ?? null;

    const displayGempa = selectedGempa ?? gempa?.latest ?? null;

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
                } else if (result.ash_advisory?.fcst_geometries) {
                    const fcstHours = Object.keys(
                        result.ash_advisory.fcst_geometries,
                    )
                        .map(Number)
                        .filter((h) => h > 0)
                        .sort((a, b) => a - b);

                    if (fcstHours.length > 0) {
                        setSelectedForecastId((currentId) => {
                            if (currentId !== null && currentId < 0) {
                                return currentId;
                            }

                            return -(0 + 1);
                        });
                    } else {
                        setSelectedForecastId(null);
                    }
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

        return () => {
            cancelled = true;
        };
    }, [selectedVolcanoId, refreshKey]);

    // ==========================================
    // AMBIL GEMPA TERKINI & GERAKAN TANAH
    // (sekali pada load; refresh manual via tombol)
    // ==========================================

    useEffect(() => {
        let cancelled = false;

        const fetchJson = async (url: string) => {
            try {
                const response = await fetch(url, {
                    headers: {
                        Accept: 'application/json',
                    },
                });

                if (!response.ok) {
                    return null;
                }

                return await response.json();
            } catch {
                return null;
            }
        };

        const fetchGeoData = async () => {
            const [gempaResult, gerakanTanahResult] = await Promise.all([
                fetchJson('/api/gempa'),
                fetchJson('/api/gerakan-tanah'),
            ]);

            if (cancelled) {
                return;
            }

            if (gempaResult) {
                setGempa(gempaResult as GempaData);
            }

            if (gerakanTanahResult) {
                setGerakanTanah(gerakanTanahResult as GerakanTanahData);
            }
        };

        void fetchGeoData();

        return () => {
            cancelled = true;
        };
    }, [refreshKey]);

    // ==========================================
    // AUTO-REFRESH (REAL-TIME)
    //
    // Polling otomatis tiap 30 detik selama tab
    // tampak; sekali lagi saat tab kembali fokus,
    // supaya status erupsi dan gempa tetap segar
    // tanpa interaksi manual.
    // ==========================================

    useEffect(() => {
        const interval = window.setInterval(() => {
            if (document.visibilityState === 'visible') {
                setRefreshKey((key) => key + 1);
            }
        }, 30_000);

        const onVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                setRefreshKey((key) => key + 1);
            }
        };

        document.addEventListener('visibilitychange', onVisibilityChange);

        return () => {
            window.clearInterval(interval);
            document.removeEventListener(
                'visibilitychange',
                onVisibilityChange,
            );
        };
    }, []);

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
    // KOTA SAYA — GEOLOKASI + SEBARAN ABU
    // ==========================================

    const requestCityLocation = () => {
        if (!('geolocation' in navigator)) {
            setGeoState('error');
            setGeoError('Browser Anda tidak mendukung geolokasi.');

            return;
        }

        setGeoState('requesting');
        setGeoError(null);

        // Coba GPS akurat dulu; kalau gagal, turun ke Wi-Fi/IP.
        let retried = false;

        const attemptLocation = (
            highAccuracy: boolean,
            onSuccess: (position: GeolocationPosition) => void,
            onError: (error: GeolocationPositionError) => void,
        ) => {
            navigator.geolocation.getCurrentPosition(onSuccess, onError, {
                enableHighAccuracy: highAccuracy,
                timeout: highAccuracy ? 12000 : 15000,
                maximumAge: highAccuracy ? 0 : 60000,
            });
        };

        const storePosition = (position: GeolocationPosition) => {
            const coords = {
                lat: position.coords.latitude,
                lon: position.coords.longitude,
            };

            setCityCoords(coords);
            setGeoState('success');
        };

        const failFinal = (error: GeolocationPositionError) => {
            if (error.code === error.PERMISSION_DENIED) {
                setGeoState('denied');
                setGeoError(
                    'Izin lokasi ditolak. Izinkan melalui ikon gembok di bilah alamat, lalu klik "Kota Saya" lagi.',
                );
            } else if (error.code === error.POSITION_UNAVAILABLE) {
                setGeoState('error');
                setGeoError('Lokasi tidak tersedia saat ini.');
            } else {
                setGeoState('error');
                setGeoError(
                    'Waktu deteksi lokasi habis. Coba lagi, atau pastikan GPS aktif.',
                );
            }
        };

        const failWithFallback = (error: GeolocationPositionError) => {
            if (
                !retried &&
                (error.code === error.TIMEOUT ||
                    error.code === error.POSITION_UNAVAILABLE)
            ) {
                // GPS lambat/tidak ada sinyal → coba lagi pakai
                // sumber yang lebih kasar (Wi-Fi/telepon seluler).
                retried = true;

                attemptLocation(false, storePosition, failFinal);

                return;
            }

            failFinal(error);
        };

        attemptLocation(true, storePosition, failWithFallback);
    };

    // Deteksi posisi secara otomatis saat halaman dibuka — browser akan
    // meminta izin (Allow/Block). Koordinat selalu real-time, tidak
    // diambil dari penyimpanan lama.
    useEffect(() => {
        requestCityLocation();
    }, []);

    useEffect(() => {
        if (cityCoords === null) {
            return;
        }

        let cancelled = false;

        const loadCityData = async () => {
            try {
                const response = await fetch(
                    `/api/kota?lat=${encodeURIComponent(cityCoords.lat)}&lon=${encodeURIComponent(cityCoords.lon)}`,
                    {
                        headers: {
                            Accept: 'application/json',
                        },
                    },
                );

                if (!response.ok) {
                    return;
                }

                const result: CityData = await response.json();

                if (!cancelled) {
                    setCityData(result);
                    setGeoState('success');
                }
            } catch {
                if (!cancelled) {
                    setGeoError('Gagal mengambil data kota dari server.');
                }
            }
        };

        void loadCityData();

        return () => {
            cancelled = true;
        };
    }, [cityCoords, refreshKey]);

    const cityLocationLabel = [cityData?.city.name, cityData?.city.provinsi]
        .filter(
            (part): part is string =>
                typeof part === 'string' && part.trim() !== '',
        )
        .join(', ');

    const formatAshKm = (km: number): string => {
        if (km <= 0) {
            return '0';
        }

        if (km >= 100) {
            return String(Math.round(km / 10) * 10);
        }

        return km >= 10 ? String(Math.round(km)) : km.toFixed(1);
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
        setTimelineBucketKey('observasi');
    };

    const filteredVolcanoes = volcanoes.filter((volcano) => {
        const query = volcanoQuery.trim().toLowerCase();

        return (
            !query ||
            volcano.name.toLowerCase().includes(query) ||
            volcano.code.toLowerCase().includes(query)
        );
    });

    const eruptingVolcanoIds = volcanoes
        .filter((volcano) => volcano.erupting)
        .map((volcano) => volcano.id);

    // ==========================================
    // GEMPA → MARKER PETA
    // ==========================================

    const gempaMarkers: EarthquakeMarkerInfo[] = (gempa?.list ?? [])
        .map((item, index) => ({
            id: item.eventid ?? `gempa-${index}`,
            latitude: item.latitude,
            longitude: item.longitude,
            magnitude: item.magnitude != null ? Number(item.magnitude) : null,
            region: item.region,
            datetime: item.datetime,
            depth: item.depth,
            felt: item.felt,
        }))
        .filter(
            (marker) =>
                !Number.isNaN(Number(marker.latitude)) &&
                !Number.isNaN(Number(marker.longitude)) &&
                marker.latitude !== null &&
                marker.longitude !== null,
        );

    const gempaMagColor = (magnitude: number | null) => {
        if (magnitude === null) {
            return '#22c55e';
        }

        if (magnitude < 4) {
            return '#22c55e';
        }

        if (magnitude < 5) {
            return '#eab308';
        }

        if (magnitude < 6) {
            return '#f97316';
        }

        if (magnitude < 7) {
            return '#ef4444';
        }

        return '#a855f7';
    };

    const formatWIBShort = (date: string) => {
        const parsed = new Date(date);

        if (Number.isNaN(parsed.getTime())) {
            return '-';
        }

        const parts = new Intl.DateTimeFormat('id-ID', {
            timeZone: 'Asia/Jakarta',
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
        }).formatToParts(parsed);

        const pick = (type: string) =>
            parts.find((part) => part.type === type)?.value ?? '';

        return `${pick('day')} ${pick('month')} ${pick(
            'year',
        )} • ${pick('hour')}.${pick('minute')}.${pick('second')} WIB`;
    };

    const formatWIBStamp = (date: string) => {
        const parsed = new Date(date);

        if (Number.isNaN(parsed.getTime())) {
            return '-';
        }

        const parts = new Intl.DateTimeFormat('id-ID', {
            timeZone: 'Asia/Jakarta',
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
        }).formatToParts(parsed);

        const pick = (type: string) =>
            parts.find((part) => part.type === type)?.value ?? '';

        return `${pick('day')} ${pick('month')}, ${pick('hour')}:${pick('minute')} WIB`;
    };

    // Usia data dalam jam (null bila tidak valid). Dipakai untuk
    // memberi peringatan bila data sudah tidak segar.
    const hoursAgo = (date: string | null | undefined): number | null => {
        if (!date) {
            return null;
        }

        const parsed = new Date(date).getTime();

        if (Number.isNaN(parsed)) {
            return null;
        }

        return (Date.now() - parsed) / 3_600_000;
    };

    const magnitudeLabel = (magnitude: string | null) =>
        magnitude ? magnitude.replace('.', ',') : '-';

    const kedalamanLabel = (depth: string | null) =>
        depth ? depth.replace('.', ',').toLowerCase() : '-';

    const locationLabel = (item: GempaItem) => {
        if (item.lintang && item.bujur) {
            return `${item.lintang.replace('.', ',')} - ${item.bujur.replace(
                '.',
                ',',
            )}`;
        }

        if (item.latitude != null && item.longitude != null) {
            const lat = `${Math.abs(item.latitude)
                .toFixed(2)
                .replace('.', ',')} ${item.latitude < 0 ? 'LS' : 'LU'}`;
            const lng = `${Math.abs(item.longitude)
                .toFixed(2)
                .replace('.', ',')} ${item.longitude < 0 ? 'BB' : 'BT'}`;

            return `${lat} - ${lng}`;
        }

        return '-';
    };

    // ==========================================
    // STATUS GEMPA REAL-TIME PER GUNUNG
    //
    // Setiap gunung = titik pemantau. Bila gempa
    // BMKG terbaru berada dalam ambang jarak,
    // gunung itu dianggap "sedang dekat gempa"
    // dan ikonnya berubah menjadi ikon seismik.
    // ==========================================

    const volcanoQuakes = useMemo(() => {
        const quakes = gempa?.list ?? [];
        const result: Record<number, VolcanoQuakeInfo | null> = {};

        for (const volcano of volcanoes) {
            let nearest: VolcanoQuakeInfo | null = null;

            for (const quake of quakes) {
                if (quake.latitude === null || quake.longitude === null) {
                    continue;
                }

                const distanceKm = haversineKm(
                    Number(volcano.latitude),
                    Number(volcano.longitude),
                    quake.latitude,
                    quake.longitude,
                );

                if (distanceKm > QUIKE_NEAR_KM) {
                    continue;
                }

                if (nearest === null || distanceKm < nearest.distanceKm) {
                    nearest = {
                        magnitude: quake.magnitude,
                        region: quake.region,
                        datetime: quake.datetime,
                        distanceKm,
                    };
                }
            }

            result[volcano.id] = nearest;
        }

        return result;
    }, [volcanoes, gempa]);

    const volcanoQuakesCount =
        Object.values(volcanoQuakes).filter(Boolean).length;

    // ==========================================
    // TIMELINE PLAY (PUTAR OTOMATIS)
    // ==========================================

    useEffect(() => {
        if (!timelinePlaying) {
            return;
        }

        if ((effectivePredictions ?? []).length === 0) {
            setTimelinePlaying(false);

            return;
        }

        const currentIndex = LAYER_ORDER.indexOf(
            timelineBucketKey as (typeof LAYER_ORDER)[number],
        );

        const nextKey = LAYER_ORDER[(currentIndex + 1) % LAYER_ORDER.length];

        const prediction = closestForecastByHour(bucketHourOf(nextKey));

        const timer = window.setTimeout(() => {
            setTimelineBucketKey(nextKey);

            setCheckedLayers([nextKey]);

            setSelectedForecastId(prediction?.id ?? null);
        }, 900);

        return () => window.clearTimeout(timer);
    }, [timelinePlaying, timelineBucketKey, data]);

    const selectBucket = (key: string) => {
        const hour = bucketHourOf(key);

        setTimelineBucketKey(key);

        setCheckedLayers((prev) =>
            prev.includes(key) ? prev : [...prev, key],
        );

        const prediction = closestForecastByHour(hour);

        setSelectedForecastId(prediction?.id ?? null);
    };

    // ==========================================
    // LOADING DAFTAR GUNUNG
    // ==========================================

    if (volcanoLoading && volcanoes.length === 0) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
                <div className="text-center">
                    <img
                        src="/logo/logoSi.png"
                        alt="Volcano Watch"
                        className="mx-auto mb-4 h-14 w-14 animate-pulse object-contain drop-shadow-[0_0_20px_rgba(14,165,233,0.6)]"
                    />

                    <p className="text-sm font-semibold text-slate-300">
                        Memuat daftar gunung...
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
    // LOADING MONITORING (layar pertama saja)
    // ==========================================

    if (loading && !data) {
        return (
            <div className="relative flex h-screen w-screen items-center justify-center overflow-hidden bg-[#05070a] text-[#eef1f5]">
                <div className="text-center">
                    <img
                        src="/logo/logoSi.png"
                        alt="Volcano Watch"
                        className="mx-auto mb-4 h-16 w-16 animate-pulse object-contain drop-shadow-[0_0_20px_rgba(14,165,233,0.6)]"
                    />

                    <p className="text-sm font-semibold text-slate-300">
                        Memuat data monitoring…
                    </p>

                    <p className="mt-1 text-[10px] font-semibold tracking-[0.25em] text-slate-600">
                        Volcano Watch
                    </p>
                </div>
            </div>
        );
    }

    // ==========================================
    // ERROR MONITORING
    // ==========================================

    if (error) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#05070a] px-6 text-[#eef1f5]">
                <div className="w-full max-w-md rounded-2xl border border-red-500/20 bg-white/[0.05] p-6 text-center backdrop-blur-xl">
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/15">
                        <AlertTriangle size={22} className="text-red-400" />
                    </div>

                    <h2 className="text-sm font-bold text-white">
                        Gagal memuat data monitoring
                    </h2>

                    <p className="mt-2 text-xs text-slate-400">{error}</p>
                </div>
            </div>
        );
    }

    // ==========================================
    // DATA KOSONG
    // ==========================================

    if (!data) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#05070a] text-slate-400">
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

    const pvmbgLevelText = (() => {
        const parts = data.volcano.status.split(/[–—-]/);

        if (parts.length < 2) {
            return data.volcano.status.trim().toUpperCase();
        }

        const head = parts.slice(0, -1).join('-').replace(/\s+/g, ' ').trim();
        const level = parts[parts.length - 1].trim().toUpperCase();

        return `${head} - ${level}`;
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

    // ==========================================
    // ABU REAL-TIME VAAC DARWIN (PETA)
    // ==========================================

    const ashActive = data.ash_active;

    // Bererupsi mengikuti status erupsi real-time MAGMA Indonesia.
    const erupting = data.volcano.erupting ?? false;

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
    // SYNTHETIC PREDICTIONS DARI ADVISORY
    //
    // Bila ash_predictions dari DB kosong, buat
    // entry sintetis dari advisory fcst_geometries
    // supaya timeline & layer tetap tampil.
    // ==========================================

    const advisoryFcstHours = data.ash_advisory?.fcst_geometries
        ? Object.keys(data.ash_advisory.fcst_geometries)
              .map(Number)
              .filter((h) => h > 0)
              .sort((a, b) => a - b)
        : [];

    const syntheticPredictions: AshPrediction[] = advisoryFcstHours.map(
        (hour, index) => ({
            id: -(index + 1),
            generated_at: data.ash_advisory!.issued_at,
            forecast_at: null,
            forecast_hour: hour,
            direction: realTimeDirection,
            speed: realTimeSpeed,
            risk_level: 'unknown',
            confidence: null,
            geometry:
                data.ash_advisory!.fcst_geometries?.[String(hour)] ?? null,
        }),
    );

    const effectivePredictions =
        data.ash_predictions.length > 0
            ? data.ash_predictions
            : syntheticPredictions;

    const hasTimelineData =
        ashActive &&
        (data.ash_predictions.length > 0 ||
            (data.ash_advisory?.fcst_geometries &&
                Object.keys(data.ash_advisory.fcst_geometries).length > 0));

    // ==========================================
    // FORECAST YANG DIPILIH
    // ==========================================

    const selectedForecast =
        effectivePredictions?.find(
            (prediction) => prediction.id === selectedForecastId,
        ) ??
        effectivePredictions?.[0] ??
        data.ash_prediction;

    // ==========================================
    // WEATHER SESUAI FORECAST
    // ==========================================

    const selectedWeather = (() => {
        if (!selectedForecast?.forecast_at) {
            const now = Date.now();

            let bestWeather = data.weather ?? null;
            let bestDiff = Infinity;

            for (const forecast of data.weather_forecasts ?? []) {
                const diff = Math.abs(
                    new Date(forecast.forecast_at).getTime() - now,
                );

                if (diff < bestDiff) {
                    bestDiff = diff;
                    bestWeather = forecast;
                }
            }

            return bestWeather;
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
    // LEGENDA & LAYER
    // ==========================================

    const closestForecastByHour = (hour: number) => {
        const predictions = effectivePredictions ?? [];

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
    const bucketHourOf = (key: string): number =>
        key === 'observasi' ? 0 : Number(key.split('-')[1]);

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

            setTimelineBucketKey(key);

            return;
        }

        // Hapus centang: fallback ke layer lain yang masih aktif.
        const nextLayers = checkedLayers.filter((layerKey) => layerKey !== key);

        setCheckedLayers(nextLayers);

        const primaryKey = nextLayers[nextLayers.length - 1] ?? null;

        const prediction = primaryKey ? forecastForLayer(primaryKey) : null;

        setSelectedForecastId(prediction?.id ?? null);

        setTimelineBucketKey(primaryKey ?? 'observasi');
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

    const advisoryHeightM = data.ash_advisory?.ash_height_m ?? null;

    const ashCritical =
        ashActive && advisoryHeightM !== null && advisoryHeightM >= 8000;

    // =====================================================
    // ALERT BERDASARKAN KONDISI MONITORING REAL-TIME
    //
    // Level & judul alert mengikuti kondisi aktual:
    // - Bererupsi (status erupsi MAGMA)    -> alert status + info abu.
    // - Abu VAAC tanpa status erupsi MAGMA -> info abu vulkanik terdeteksi.
    // - Tidak bererupsi                    -> Status Gunung NORMAL,
    //   apa pun level resmi PVMBG di database.
    // =====================================================

    if (erupting && status.includes('awas')) {
        alerts.push({
            id: 'volcano-awas',
            level: 'critical',
            title: 'Status Gunung AWAS',
            message: `${data.volcano.name} berada pada status AWAS.`,
        });
    } else if (erupting && status.includes('siaga')) {
        alerts.push({
            id: 'volcano-siaga',
            level: ashCritical ? 'critical' : 'warning',
            title: 'Status Gunung SIAGA',
            message: `${data.volcano.name} saat ini berada pada status SIAGA.`,
        });
    } else if (erupting && status.includes('waspada')) {
        alerts.push({
            id: 'volcano-waspada',
            level: ashCritical ? 'critical' : 'warning',
            title: 'Status Gunung WASPADA',
            message: `${data.volcano.name} saat ini berada pada status WASPADA.`,
        });
    } else if (erupting) {
        alerts.push({
            id: 'volcano-eruption',
            level: ashCritical ? 'critical' : 'warning',
            title: ashCritical
                ? 'Kolom Abu Sangat Tinggi'
                : 'Gunung Sedang Bererupsi',
            message: 'MAGMA melaporkan gunung ini sedang erupsi.',
        });
    } else if (ashActive) {
        alerts.push({
            id: 'vaac-ash-active',
            level: ashCritical ? 'critical' : 'warning',
            title: ashCritical
                ? 'Kolom Abu Sangat Tinggi'
                : 'Abu Vulkanik Terdeteksi',
            message: 'VAAC mendeteksi emisi abu aktif.',
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
            return { color: '#ef4444', label: 'Awas' };
        }

        if (official.includes('siaga')) {
            return { color: '#f97316', label: 'Waspada' };
        }

        if (official.includes('waspada')) {
            return { color: '#eab308', label: 'Siaga' };
        }

        return { color: '#22c55e', label: 'Normal' };
    })();

    // Status utama memakai laporan erupsi MAGMA (PVMBG). Bila MAGMA
    // belum menandai erupsi tetapi VAAC mendeteksi abu, jangan
    // menampilkan "tidak ada erupsi" — tampilkan kondisi abu agar
    // tidak menyesatkan masyarakat.
    const statusPillText =
        data === null
            ? 'MEMUAT DATA'
            : erupting
              ? 'ERUPSI AKTIF (MAGMA)'
              : ashActive
                ? 'ABU TERDETEKSI (VAAC)'
                : 'NORMAL';

    const statusPillClass =
        data === null
            ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
            : erupting
              ? 'border-red-500/30 bg-red-500/15 text-red-300 shadow-[0_0_24px_rgba(255,59,59,0.45)]'
              : ashActive
                ? 'border-orange-500/30 bg-orange-500/15 text-orange-300'
                : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';

    const statusDotClass =
        data === null
            ? 'bg-amber-400 animate-pulse'
            : erupting
              ? 'bg-red-500 shadow-[0_0_8px_rgba(255,59,59,1)] animate-pulse'
              : ashActive
                ? 'bg-orange-400 shadow-[0_0_8px_rgba(251,146,60,1)]'
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

    // BMKG primary; fallback Open-Meteo untuk yang belum ada
    // mapping/forecast BMKG (Angin di Kawah & Kondisi Cuaca).
    const bmkgWeather = selectedWeather;

    const displayWeather: Weather | null = bmkgWeather
        ? bmkgWeather
        : data.current_weather
          ? {
                forecast_at: data.current_weather.observed_at ?? '',
                temperature: data.current_weather.temperature_c ?? null,
                humidity: data.current_weather.humidity ?? null,
                wind_speed: data.current_weather.wind_speed_kmh ?? null,
                wind_direction:
                    data.current_weather.wind_direction_deg != null
                        ? `${data.current_weather.wind_direction_deg}°${
                              data.current_weather.wind_direction_cardinal
                                  ? ` ${data.current_weather.wind_direction_cardinal}`
                                  : ''
                          }`
                        : data.current_weather.wind_direction_cardinal,
                weather: null,
            }
          : null;

    const usingBmkgWeather = bmkgWeather !== null;

    const windDeg = bmkgWeather?.wind_direction
        ? (COMPASS_DEGREES[bmkgWeather.wind_direction.toUpperCase()] ?? 0)
        : (data.current_weather?.wind_direction_deg ?? 0);

    // Warna grafik mengikuti level resmi PVMBG
    const pvmbgWaveColor = (() => {
        const official = data.volcano.status?.toLowerCase() ?? '';

        if (official.includes('awas')) return '#ef4444';

        if (official.includes('siaga')) return '#f97316';

        if (official.includes('waspada')) return '#eab308';

        return '#22c55e';
    })();

    // Waktu dasar: issued_at advisory/prediction, fallback ke now.
    // Tiap titik wave = targetTime + jam forecast (0, 6, 12, 18)
    // supaya sesuai "penyebaran abu" dari waktu erupsi/advisory.
    const waveBaseTime = (() => {
        const raw =
            data.ash_advisory?.issued_at ??
            data.ash_prediction?.generated_at ??
            null;

        if (!raw) return Date.now();

        const parsed = new Date(raw).getTime();

        return Number.isNaN(parsed) ? Date.now() : parsed;
    })();

    // Data gelombang: Observasi (+6/+12/+18 jam dari issued_at advisory).
    // Tiap titik diambil dari weather_forecast terdekat di waktu target.
    const waveDataPoints: WavePoint[] = LAYER_ORDER.map((key) => {
        const hour = bucketHourOf(key);
        const targetTime = waveBaseTime + hour * 60 * 60 * 1000;

        let bestForecast: WeatherForecast | Weather | null =
            data.weather ?? null;
        let bestDiff = Infinity;

        for (const forecast of data.weather_forecasts ?? []) {
            const diff = Math.abs(
                new Date(forecast.forecast_at).getTime() - targetTime,
            );

            if (diff < bestDiff) {
                bestDiff = diff;
                bestForecast = forecast;
            }
        }

        const label = key === 'observasi' ? 'Observasi' : `+${hour} jam`;

        return {
            label,
            temperature: bestForecast?.temperature ?? null,
            wind_speed: bestForecast?.wind_speed ?? null,
            humidity: bestForecast?.humidity ?? null,
        };
    });

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
                    volcanoes={volcanoes}
                    selectedVolcanoId={selectedVolcanoId}
                    activeVolcanoIds={eruptingVolcanoIds}
                    onSelectVolcano={selectVolcanoById}
                    earthquakes={showGempaMarkers ? gempaMarkers : []}
                    selectedQuakeId={selectedQuakeId}
                    onSelectEarthquake={(quake) => {
                        const matched =
                            gempa?.list.find(
                                (g) =>
                                    g.eventid != null && g.eventid === quake.id,
                            ) ?? null;

                        if (matched) {
                            setSelectedGempa(matched);

                            return;
                        }

                        setSelectedGempa({
                            eventid: quake.id,
                            status: null,
                            datetime: quake.datetime,
                            tanggal: quake.datetime
                                ? quake.datetime.slice(0, 10)
                                : null,
                            jam: null,
                            latitude: quake.latitude,
                            longitude: quake.longitude,
                            lintang: null,
                            bujur: null,
                            magnitude:
                                quake.magnitude != null
                                    ? String(quake.magnitude)
                                    : null,
                            depth: quake.depth,
                            region: quake.region,
                            potential: null,
                            felt: quake.felt,
                            shakemap: null,
                        });
                    }}
                    volcanoQuakes={volcanoQuakes}
                    dark={false}
                />
            </div>

            {/* =====================================
            AMBIENT GLOW (LATAR)
        ====================================== */}

            <div className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-72 bg-[radial-gradient(70%_100%_at_50%_0%,rgba(14,165,233,0.14),rgba(124,58,237,0.06)_60%,transparent)]" />

            {/* =====================================
            TOPBAR (GLASS)
        ====================================== */}

            <header className="pointer-events-none absolute inset-x-0 top-0 z-[1200] px-3 pt-3">
                <div className="pointer-events-auto rounded-2xl border border-white/10 bg-gradient-to-b from-[#111b2e]/95 to-[#0a0f1c]/95 px-4 py-3 shadow-2xl shadow-black/50 backdrop-blur-xl">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2.5">
                            <img
                                src="/logo/logoSi.png"
                                alt="Volcano Watch"
                                className="h-10 w-auto shrink-0 object-contain drop-shadow-[0_0_14px_rgba(14,165,233,0.5)]"
                            />

                            <div className="hidden min-w-0 sm:block">
                                <p className="truncate text-[15px] leading-tight font-black tracking-tight text-white">
                                    Volcano Watch
                                </p>

                                <p className="truncate text-[9px] font-extrabold tracking-[2px] text-sky-400/90 uppercase">
                                    Live Monitoring · 24 Jam
                                </p>
                            </div>
                        </div>

                        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                            {/* STATUS PILL */}

                            <span
                                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-extrabold tracking-wide uppercase ${statusPillClass}`}
                            >
                                <span
                                    className={`h-2 w-2 rounded-full ${statusDotClass}`}
                                />

                                <span className="hidden md:inline">
                                    {statusPillText}
                                </span>
                            </span>

                            {/* KOTA SAYA */}

                            <button
                                type="button"
                                onClick={requestCityLocation}
                                title={
                                    cityLocationLabel
                                        ? `Kota: ${cityLocationLabel}`
                                        : 'Deteksi kota saya (minta izin lokasi)'
                                }
                                aria-label="Deteksi kota saya"
                                className={`flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-[11px] font-bold transition ${
                                    geoState === 'denied'
                                        ? 'border-red-500/40 bg-red-500/10 text-red-300'
                                        : geoState === 'requesting'
                                          ? 'border-sky-500/40 bg-sky-500/10 text-sky-300'
                                          : cityData?.summary.inside_plume
                                            ? 'border-red-500/40 bg-red-500/10 text-red-300 shadow-[0_0_18px_rgba(255,59,59,0.35)]'
                                            : 'border-white/10 bg-white/5 text-sky-400 hover:bg-white/10'
                                }`}
                            >
                                {cityData?.summary.inside_plume ? (
                                    <TriangleAlert
                                        size={12}
                                        strokeWidth={2.5}
                                    />
                                ) : (
                                    <MapPin size={12} strokeWidth={2.5} />
                                )}

                                <span className="max-w-[38vw] truncate sm:max-w-[160px]">
                                    {cityData?.city.name ?? 'Kota Saya'}
                                </span>
                            </button>

                            {/* LEGENDA (MOBILE) */}

                            <button
                                type="button"
                                onClick={() => setLayerOpen((open) => !open)}
                                title="Legenda & Layer"
                                aria-label="Buka legenda & layer"
                                className="flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 text-[11px] font-bold text-violet-300 transition hover:bg-white/10 lg:hidden"
                            >
                                <Layers size={12} strokeWidth={2.5} />
                                <span className="hidden sm:inline">Layer</span>
                            </button>

                            {/* REFRESH RING */}

                            <button
                                type="button"
                                onClick={refreshNow}
                                title="Tarik data sekarang"
                                aria-label="Tarik data sekarang"
                                className={`flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-white/5 text-sm text-sky-400 transition hover:bg-white/10 ${
                                    refreshing ? 'animate-spin' : ''
                                }`}
                            >
                                <RefreshCw size={14} strokeWidth={2.5} />
                            </button>
                        </div>
                    </div>

                    {/* SEARCH SELECT GUNUNG */}

                    <div className="relative mt-2.5">
                        <div
                            className={`flex items-center gap-2 rounded-xl border px-3 py-2 transition ${
                                volcanoOpen
                                    ? 'border-sky-500/50 bg-white/10'
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
                                <ChevronDown size={12} strokeWidth={2.5} />
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

                                <div className="absolute top-full right-0 left-0 z-10 mt-1.5 max-h-64 overflow-y-auto rounded-xl border border-white/10 bg-gradient-to-b from-[#111b2e]/98 to-[#0a0f1c]/98 p-1.5 shadow-2xl shadow-black/50 backdrop-blur-xl">
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
                                                className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-xs transition hover:bg-sky-500/15 ${
                                                    volcano.id ===
                                                    selectedVolcanoId
                                                        ? 'bg-sky-500/15'
                                                        : ''
                                                }`}
                                            >
                                                <span className="flex min-w-0 items-center gap-2 font-bold text-white">
                                                    <MountainSnow
                                                        size={12}
                                                        className="shrink-0 text-slate-500"
                                                        strokeWidth={2}
                                                    />{' '}
                                                    {volcano.name}
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
            BANNER ANCAMAN ABU KE KOTA (REAL-TIME)
        ====================================== */}

            {cityData?.summary.inside_plume && (
                <div className="pointer-events-none absolute inset-x-0 top-[92px] z-[1250] flex justify-center px-4">
                    <div className="pointer-events-auto flex max-w-[92vw] items-center gap-2 rounded-full border border-red-500/40 bg-red-500/15 px-4 py-2 text-xs font-bold text-red-300 shadow-[0_0_24px_rgba(255,59,59,0.45)] backdrop-blur">
                        <TriangleAlert size={14} className="shrink-0" />
                        <span className="truncate">
                            Kota Anda di dalam sebaran abu —{' '}
                            {cityData.summary.nearest_ash_volcano ??
                                'ada erupsi abu aktif'}
                        </span>
                    </div>
                </div>
            )}

            {/* =====================================
            DECK KIRI (INFO MONITORING)
        ====================================== */}

            <aside className="pointer-events-auto absolute top-[128px] left-2 z-[1100] flex max-h-[calc(100dvh-205px)] w-[308px] max-w-[calc(100vw-32px)] flex-col gap-3.5 overflow-y-auto rounded-2xl border border-white/10 bg-gradient-to-b from-[#111b2e]/95 to-[#0a0f1c]/95 p-3.5 shadow-2xl shadow-black/50 backdrop-blur-xl sm:left-3">
                {/* KOTA SAYA & SEBARAN ABU */}

                <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-3.5">
                    <PanelTitle icon={<MapPin size={11} strokeWidth={2.5} />}>
                        Kota Saya &amp; Sebaran Abu
                    </PanelTitle>

                    {geoState === 'idle' && !cityCoords && (
                        <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
                            Klik{' '}
                            <span className="font-bold text-sky-400">
                                Kota Saya
                            </span>{' '}
                            di bar atas untuk mendeteksi lokasi Anda. Browser
                            akan meminta izin (Allow/Izinkan), lalu kota Anda
                            dipantau sebaran abu vulkanik secara real-time.
                        </p>
                    )}

                    {geoState === 'requesting' && (
                        <p className="mt-2 flex items-center gap-2 text-[11px] text-sky-300">
                            <span className="h-2 w-2 animate-pulse rounded-full bg-sky-400" />
                            Meminta izin lokasi… Lihat popup Allow/Izinkan di
                            browser Anda.
                        </p>
                    )}

                    {geoState === 'denied' && geoError && (
                        <div className="mt-2 rounded-lg border border-red-500/25 bg-red-500/10 px-2.5 py-2 text-[11px] leading-relaxed text-red-300">
                            {geoError}
                        </div>
                    )}

                    {geoState === 'error' && geoError && (
                        <div className="mt-2 rounded-lg border border-orange-500/25 bg-orange-500/10 px-2.5 py-2 text-[11px] leading-relaxed text-orange-300">
                            {geoError}
                        </div>
                    )}

                    {geoState === 'success' && cityData && (
                        <>
                            <div
                                className={`relative mt-2.5 overflow-hidden rounded-xl border px-3 pt-3 pb-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ${
                                    cityData.summary.inside_plume
                                        ? 'border-red-500/30 bg-gradient-to-br from-red-500/15 via-[#180b12] to-[#0a0f1c]'
                                        : 'border-sky-500/25 bg-gradient-to-br from-sky-500/15 via-[#0a1220] to-[#0a0f1c]'
                                }`}
                            >
                                <span
                                    className={`pointer-events-none absolute -top-10 -right-10 h-28 w-28 rounded-full blur-2xl ${
                                        cityData.summary.inside_plume
                                            ? 'bg-red-500/25'
                                            : 'bg-sky-500/25'
                                    }`}
                                />

                                <div className="relative flex items-center gap-2">
                                    <span
                                        className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border ${
                                            cityData.summary.inside_plume
                                                ? 'border-red-400/40 bg-red-500/15 shadow-[0_0_16px_rgba(255,59,59,0.4)]'
                                                : 'border-sky-400/30 bg-sky-500/15 shadow-[0_0_16px_rgba(14,165,233,0.35)]'
                                        }`}
                                    >
                                        {cityData.summary.inside_plume ? (
                                            <TriangleAlert
                                                size={15}
                                                strokeWidth={2.5}
                                                className="text-red-400"
                                            />
                                        ) : (
                                            <MapPin
                                                size={15}
                                                strokeWidth={2.5}
                                                className="text-sky-400"
                                            />
                                        )}
                                    </span>

                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-[14px] font-extrabold text-white">
                                            {cityLocationLabel ||
                                                `⌀ ${cityData.city.latitude.toFixed(2)}, ${cityData.city.longitude.toFixed(2)}`}
                                        </p>

                                        {cityData.summary.inside_plume && (
                                            <p className="flex animate-pulse items-center gap-1 text-[9px] font-extrabold text-red-400 uppercase">
                                                <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                                                Di dalam sebaran abu
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {cityData.summary.inside_plume ? (
                                    <p className="relative mt-2 text-[15px] font-bold text-red-300">
                                        Di dalam area sebaran abu.
                                    </p>
                                ) : cityData.summary.plume_volcanoes.length >
                                  0 ? (
                                    <p className="relative mt-2 flex items-baseline gap-1.5">
                                        <span className="text-[30px] leading-none font-black text-sky-300 tabular-nums drop-shadow-[0_0_18px_rgba(56,189,248,0.35)]">
                                            ≈{' '}
                                            {formatAshKm(
                                                cityData.summary.ash_edge_km ??
                                                    0,
                                            )}
                                        </span>

                                        <span className="text-[10px] font-semibold text-slate-400">
                                            km dari tepi abu
                                        </span>
                                    </p>
                                ) : (
                                    <p className="relative mt-2 text-[13px] font-bold text-emerald-300">
                                        Tidak ada sebaran abu aktif
                                    </p>
                                )}
                            </div>
                        </>
                    )}
                </section>

                {/* STATUS ERUPSI */}

                <section>
                    <PanelTitle icon={<Activity size={11} strokeWidth={2.5} />}>
                        Status Erupsi
                    </PanelTitle>

                    {alerts.map((alert) => {
                        const alertClass =
                            alert.level === 'critical'
                                ? 'border-red-500/25 border-l-red-500/70 bg-red-500/10 text-red-200 shadow-[0_0_20px_rgba(255,59,59,0.15)]'
                                : alert.level === 'warning'
                                  ? 'border-orange-500/25 border-l-orange-500/70 bg-orange-500/10 text-orange-200 shadow-[0_0_20px_rgba(251,146,60,0.12)]'
                                  : 'border-emerald-500/25 border-l-emerald-500/70 bg-emerald-500/10 text-emerald-200';

                        const IconComponent =
                            alert.level === 'critical'
                                ? TriangleAlert
                                : alert.level === 'warning'
                                  ? AlertTriangle
                                  : CircleCheck;

                        return (
                            <div
                                key={alert.id}
                                className={`flex items-start gap-2 rounded-xl border-l-[3px] px-3 py-2.5 text-[12.5px] leading-relaxed ${alertClass}`}
                            >
                                <span className="mt-0.5 shrink-0">
                                    <IconComponent
                                        size={15}
                                        strokeWidth={2.5}
                                        className="text-current"
                                    />
                                </span>

                                <div>
                                    <p className="font-bold">{alert.title}</p>

                                    <p className="mt-0.5 font-medium text-slate-300">
                                        {alert.message}
                                    </p>

                                    {data.ash_advisory && (
                                        <p className="mt-2 border-t border-white/10 pt-2 text-[9.5px] leading-relaxed text-slate-400">
                                            Data diambil{' '}
                                            <span className="font-semibold text-slate-300">
                                                {data.ash_advisory.issued_at
                                                    ? formatWIBStamp(
                                                          data.ash_advisory
                                                              .issued_at,
                                                      )
                                                    : '-'}
                                            </span>{' '}
                                            · update berikutnya paling lambat{' '}
                                            <span className="font-semibold text-sky-300">
                                                {data.ash_advisory
                                                    .next_advisory_at
                                                    ? formatWIBStamp(
                                                          data.ash_advisory
                                                              .next_advisory_at,
                                                      )
                                                    : 'segera'}
                                            </span>
                                        </p>
                                    )}
                                </div>
                            </div>
                        );
                    })}

                    {/* BADGE GDACS */}

                    <div
                        className={`mt-2 flex items-center gap-2 rounded-xl border px-3 py-2 text-[11.5px] font-bold shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ${gdacsBadgeClass}`}
                    >
                        <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full shadow-[0_0_10px_currentColor]"
                            style={{ background: gdacsLevel.color }}
                        />

                        <span>
                            <span className="block text-[9px] font-extrabold tracking-widest uppercase opacity-70">
                                Status Bahaya (GDACS)
                            </span>

                            {gdacsLevel.label.toUpperCase()}
                        </span>
                    </div>
                </section>

                {/* STATUS RESMI PVMBG */}

                <section>
                    <PanelTitle
                        icon={<ShieldCheck size={11} strokeWidth={2.5} />}
                    >
                        Status Resmi PVMBG
                    </PanelTitle>

                    <div
                        className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-[12.5px] font-extrabold shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ${pvmbgClass}`}
                    >
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/10">
                            <ShieldCheck size={15} strokeWidth={2.5} />
                        </span>

                        <span>
                            <span className="block text-[9px] font-extrabold tracking-widest uppercase opacity-70">
                                Level Resmi
                            </span>
                            {pvmbgLevelText}
                        </span>
                    </div>

                    <p className="mt-1.5 flex items-center gap-1.5 text-[10px] text-slate-500">
                        <span
                            className={
                                data.volcano.status_source === 'live'
                                    ? 'inline-block size-1.5 rounded-full bg-emerald-400'
                                    : 'inline-block size-1.5 rounded-full bg-slate-500'
                            }
                        />
                        {data.volcano.status_source === 'live'
                            ? 'Status Resmi MAGMA'
                            : 'status tersimpan (fallback)'}
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

                {hasTimelineData && (
                    <section>
                        <PanelTitle
                            icon={<Gauge size={11} strokeWidth={2.5} />}
                        >
                            Timeline Sebaran
                        </PanelTitle>

                        <div className="flex items-center gap-1.5">
                            <button
                                type="button"
                                onClick={() =>
                                    setTimelinePlaying((playing) => !playing)
                                }
                                aria-label={timelinePlaying ? 'Jeda' : 'Putar'}
                                className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-white/5 text-[9px] text-white transition hover:bg-white/10"
                            >
                                {timelinePlaying ? (
                                    <Pause size={11} strokeWidth={2.5} />
                                ) : (
                                    <Play size={11} strokeWidth={2.5} />
                                )}
                            </button>

                            <div className="relative h-8 flex-1">
                                <span className="absolute top-[9px] right-2 left-2 h-0.5 bg-white/10" />

                                <div className="relative flex h-full items-start justify-between">
                                    {LAYER_ORDER.map((key) => {
                                        const active =
                                            key === timelineBucketKey;

                                        return (
                                            <button
                                                key={key}
                                                type="button"
                                                onClick={() =>
                                                    selectBucket(key)
                                                }
                                                className="flex cursor-pointer flex-col items-center gap-1"
                                            >
                                                <span
                                                    className={`z-10 flex h-[18px] w-[18px] items-center justify-center rounded-full border-2 transition ${
                                                        active
                                                            ? 'scale-125 border-sky-500 bg-sky-500/40 shadow-[0_0_12px_#38bdf8]'
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
                                                    {key === 'observasi'
                                                        ? 'Observasi'
                                                        : `+${bucketHourOf(key)}`}
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
                    <PanelTitle icon={<Wind size={11} strokeWidth={2.5} />}>
                        Angin di Kawah
                    </PanelTitle>

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
                                    {displayWeather?.wind_speed ?? '-'}
                                </b>{' '}
                                km/j
                            </div>

                            <div>
                                arah {displayWeather?.wind_direction ?? '-'}
                            </div>

                            <div>
                                suhu {displayWeather?.temperature ?? '-'}°C
                            </div>
                        </div>
                    </div>

                    {!usingBmkgWeather && displayWeather?.forecast_at ? (
                        <p className="mt-1.5 text-[9.5px] text-slate-500">
                            Open-Meteo (GFS/ICON) •{' '}
                            {formatWIBStamp(displayWeather.forecast_at)}{' '}
                            (estimasi)
                        </p>
                    ) : null}
                </section>

                {/* KONDISI CUACA */}

                <section>
                    <PanelTitle icon={<CloudSun size={11} strokeWidth={2.5} />}>
                        Kondisi Cuaca
                    </PanelTitle>

                    <div className="grid grid-cols-2 gap-1.5">
                        <div className="rounded-xl border border-white/10 bg-white/5 p-2.5">
                            <div className="flex items-center gap-1.5 text-slate-500">
                                <Thermometer size={11} strokeWidth={2.5} />
                                <p className="text-[10px]">Suhu</p>
                            </div>

                            <p className="mt-0.5 text-[15px] font-bold text-white">
                                {displayWeather?.temperature ?? '-'}°
                            </p>
                        </div>

                        <div className="rounded-xl border border-white/10 bg-white/5 p-2.5">
                            <div className="flex items-center gap-1.5 text-slate-500">
                                <Droplets size={11} strokeWidth={2.5} />
                                <p className="text-[10px]">Kelembapan</p>
                            </div>

                            <p className="mt-0.5 text-[15px] font-bold text-white">
                                {displayWeather?.humidity ?? '-'}%
                            </p>
                        </div>

                        <div className="rounded-xl border border-white/10 bg-white/5 p-2.5">
                            <div className="flex items-center gap-1.5 text-slate-500">
                                <Wind size={11} strokeWidth={2.5} />
                                <p className="text-[10px]">Angin</p>
                            </div>

                            <p className="mt-0.5 text-[15px] font-bold text-white">
                                {displayWeather?.wind_speed ?? '-'} km/j
                            </p>
                        </div>

                        <div className="rounded-xl border border-white/10 bg-white/5 p-2.5">
                            <div className="flex items-center gap-1.5 text-slate-500">
                                <Navigation size={11} strokeWidth={2.5} />
                                <p className="text-[10px]">Arah</p>
                            </div>

                            <p className="mt-0.5 text-[15px] font-bold text-white">
                                {displayWeather?.wind_direction ?? '-'}
                            </p>
                        </div>
                    </div>

                    {usingBmkgWeather && selectedWeather?.forecast_at ? (
                        <p className="mt-1.5 text-[9.5px] text-slate-500">
                            Prakiraan BMKG •{' '}
                            {formatWIBStamp(selectedWeather.forecast_at)}
                        </p>
                    ) : null}

                    {!usingBmkgWeather && displayWeather?.forecast_at ? (
                        <p className="mt-1.5 text-[9.5px] text-slate-500">
                            Open-Meteo (GFS/ICON) •{' '}
                            {formatWIBStamp(displayWeather.forecast_at)}{' '}
                            (estimasi)
                        </p>
                    ) : null}

                    <WeatherWaveChart
                        points={waveDataPoints}
                        activeKey={timelineBucketKey}
                        waveColor={pvmbgWaveColor}
                    />
                </section>

                {/* KONDISI SAAT INI (OPEN-METEO / REAL-TIME) */}

                <section>
                    <PanelTitle icon={<Gauge size={11} strokeWidth={2.5} />}>
                        Kondisi Saat Ini
                    </PanelTitle>

                    {data.current_weather ? (
                        <>
                            <div className="grid grid-cols-2 gap-1.5">
                                <div className="rounded-xl border border-white/10 bg-white/5 p-2.5">
                                    <div className="flex items-center gap-1.5 text-slate-500">
                                        <Thermometer
                                            size={11}
                                            strokeWidth={2.5}
                                        />
                                        <p className="text-[10px]">Suhu</p>
                                    </div>

                                    <p className="mt-0.5 text-[15px] font-bold text-white">
                                        {data.current_weather.temperature_c ??
                                            '-'}
                                        °
                                    </p>
                                </div>

                                <div className="rounded-xl border border-white/10 bg-white/5 p-2.5">
                                    <div className="flex items-center gap-1.5 text-slate-500">
                                        <Droplets size={11} strokeWidth={2.5} />
                                        <p className="text-[10px]">
                                            Kelembapan
                                        </p>
                                    </div>

                                    <p className="mt-0.5 text-[15px] font-bold text-white">
                                        {data.current_weather.humidity ?? '-'}%
                                    </p>
                                </div>

                                <div className="rounded-xl border border-white/10 bg-white/5 p-2.5">
                                    <div className="flex items-center gap-1.5 text-slate-500">
                                        <Wind size={11} strokeWidth={2.5} />
                                        <p className="text-[10px]">Tekanan</p>
                                    </div>

                                    <p className="mt-0.5 text-[15px] font-bold text-white">
                                        {data.current_weather.pressure_msl ??
                                            '-'}{' '}
                                        hPa
                                    </p>
                                </div>

                                <div className="rounded-xl border border-white/10 bg-white/5 p-2.5">
                                    <div className="flex items-center gap-1.5 text-slate-500">
                                        <Navigation
                                            size={11}
                                            strokeWidth={2.5}
                                        />
                                        <p className="text-[10px]">Angin</p>
                                    </div>

                                    <p className="mt-0.5 text-[15px] font-bold text-white">
                                        {data.current_weather.wind_speed_kmh ??
                                            '-'}{' '}
                                        km/j
                                    </p>
                                </div>
                            </div>

                            <div className="mt-1.5 rounded-xl border border-white/10 bg-white/5 p-2.5 text-[11px] leading-relaxed text-slate-400">
                                <p>
                                    arah{' '}
                                    {data.current_weather.wind_direction_deg !=
                                    null
                                        ? `${data.current_weather.wind_direction_deg}°${
                                              data.current_weather
                                                  .wind_direction_cardinal
                                                  ? ` (${data.current_weather.wind_direction_cardinal})`
                                                  : ''
                                          }`
                                        : '-'}
                                    {data.current_weather.wind_gust_kmh != null
                                        ? ` • hembusan ${data.current_weather.wind_gust_kmh} km/j`
                                        : ''}
                                    {data.current_weather
                                        .apparent_temperature_c != null
                                        ? ` • terasa ${data.current_weather.apparent_temperature_c}°C`
                                        : ''}
                                </p>
                            </div>

                            {data.current_weather.observed_at ? (
                                <p className="mt-1.5 text-[9.5px] text-slate-500">
                                    Open-Meteo (GFS/ICON) •{' '}
                                    {formatWIBStamp(
                                        data.current_weather.observed_at,
                                    )}
                                </p>
                            ) : null}
                        </>
                    ) : (
                        <p className="rounded-xl border border-white/10 bg-white/5 p-2.5 text-[11px] leading-relaxed text-slate-500">
                            Belum ada data kondisi saat ini. Sinkronisasi
                            Open-Meteo berjalan tiap 5 menit.
                        </p>
                    )}
                </section>

                {/* ADVISORY ABU VULKANIK */}

                <section>
                    <PanelTitle icon={<Radio size={11} strokeWidth={2.5} />}>
                        Advisory Abu Vulkanik
                    </PanelTitle>

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
                                        ? 'Abu terdeteksi'
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
                        <PanelTitle
                            icon={<Navigation size={11} strokeWidth={2.5} />}
                        >
                            Prediksi Sebaran Abu
                        </PanelTitle>

                        <div className="grid grid-cols-2 gap-1.5">
                            <div className="rounded-xl border border-white/10 bg-white/5 p-2.5">
                                <div className="flex items-center gap-1.5 text-slate-500">
                                    <Navigation size={11} strokeWidth={2.5} />
                                    <p className="text-[10px]">Arah Sebaran</p>
                                </div>

                                <p className="mt-0.5 text-[15px] font-bold text-white">
                                    {selectedForecast.direction != null
                                        ? `${Number(
                                              selectedForecast.direction,
                                          ).toFixed(2)}°`
                                        : '-'}
                                </p>
                            </div>

                            <div className="rounded-xl border border-white/10 bg-white/5 p-2.5">
                                <div className="flex items-center gap-1.5 text-slate-500">
                                    <Wind size={11} strokeWidth={2.5} />
                                    <p className="text-[10px]">
                                        Kecepatan Angin
                                    </p>
                                </div>

                                <p className="mt-0.5 text-[15px] font-bold text-white">
                                    {selectedForecast.speed != null
                                        ? `${Number(
                                              selectedForecast.speed,
                                          ).toFixed(1)} km/h`
                                        : '-'}
                                </p>
                            </div>

                            <div className="rounded-xl border border-white/10 bg-white/5 p-2.5">
                                <div className="flex items-center gap-1.5 text-slate-500">
                                    <TriangleAlert
                                        size={11}
                                        strokeWidth={2.5}
                                    />
                                    <p className="text-[10px]">Risiko</p>
                                </div>

                                <p
                                    className={`mt-0.5 text-[15px] font-bold uppercase ${riskClass}`}
                                >
                                    {selectedForecast.risk_level}
                                </p>
                            </div>

                            <div className="rounded-xl border border-white/10 bg-white/5 p-2.5">
                                <div className="flex items-center gap-1.5 text-slate-500">
                                    <Gauge size={11} strokeWidth={2.5} />
                                    <p className="text-[10px]">Confidence</p>
                                </div>

                                <p className="mt-0.5 text-[15px] font-bold text-white">
                                    {selectedForecast.confidence != null
                                        ? `${Number(
                                              selectedForecast.confidence,
                                          ).toFixed(2)}%`
                                        : '-'}
                                </p>
                            </div>
                        </div>
                    </section>
                )}

                {/* GEMPA TERKINI (BMKG) */}

                <section>
                    <PanelTitle icon={<Siren size={11} strokeWidth={2.5} />}>
                        Gempa Terkini (BMKG)
                    </PanelTitle>

                    {selectedGempa && (
                        <button
                            type="button"
                            onClick={() => setSelectedGempa(null)}
                            className="mb-1.5 flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[9.5px] font-semibold text-slate-400 transition hover:border-sky-500/40 hover:text-white"
                        >
                            <ArrowLeft size={10} strokeWidth={2.5} />
                            Kembali ke gempa terbaru
                        </button>
                    )}

                    {gempa === null ? (
                        <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-[11px] text-slate-500">
                            Memuat data gempa…
                        </p>
                    ) : displayGempa?.region ? (
                        <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
                            <div className="flex items-start justify-between gap-2">
                                <p className="text-[11px] font-semibold text-slate-300">
                                    {displayGempa.datetime
                                        ? formatWIBShort(displayGempa.datetime)
                                        : `${displayGempa.tanggal ?? '-'}${
                                              displayGempa.jam
                                                  ? ` • ${displayGempa.jam}`
                                                  : ''
                                          }`}
                                </p>

                                {displayGempa.status && (
                                    <span className="shrink-0 rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">
                                        {displayGempa.status === 'confirmed'
                                            ? 'Terkonfirmasi'
                                            : displayGempa.status}
                                    </span>
                                )}
                            </div>

                            <p className="mt-0.5 text-[13px] leading-snug font-bold text-white">
                                {displayGempa.region}
                            </p>

                            {displayGempa.potential && (
                                <p
                                    className={`mt-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                                        displayGempa.potential
                                            .toLowerCase()
                                            .includes('tidak')
                                            ? 'bg-emerald-500/10 text-emerald-300'
                                            : 'bg-red-500/10 text-red-300'
                                    }`}
                                >
                                    {displayGempa.potential}
                                </p>
                            )}

                            <dl className="mt-2.5 space-y-1.5 text-[11px]">
                                <div className="flex items-center justify-between border-b border-white/5 pb-1.5">
                                    <dt className="font-semibold text-slate-500">
                                        Magnitudo
                                    </dt>

                                    <dd
                                        className="font-black"
                                        style={{
                                            color: gempaMagColor(
                                                displayGempa.magnitude != null
                                                    ? Number(
                                                          displayGempa.magnitude,
                                                      )
                                                    : null,
                                            ),
                                        }}
                                    >
                                        {magnitudeLabel(displayGempa.magnitude)}
                                    </dd>
                                </div>

                                <div className="flex items-center justify-between border-b border-white/5 pb-1.5">
                                    <dt className="font-semibold text-slate-500">
                                        Kedalaman
                                    </dt>

                                    <dd className="font-semibold text-slate-300">
                                        {kedalamanLabel(displayGempa.depth)}
                                    </dd>
                                </div>

                                <div className="flex items-center justify-between">
                                    <dt className="font-semibold text-slate-500">
                                        Lokasi
                                    </dt>

                                    <dd className="text-right font-semibold text-slate-300">
                                        {locationLabel(displayGempa)}
                                    </dd>
                                </div>
                            </dl>
                        </div>
                    ) : (
                        <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-[11px] text-slate-500">
                            {gempa.error ?? 'Data gempa belum tersedia.'}
                        </p>
                    )}
                </section>

                {/* GERAKAN TANAH (PVMBG / VSI) */}

                <section>
                    <PanelTitle icon={<LandPlot size={11} strokeWidth={2.5} />}>
                        Gerakan Tanah (PVMBG)
                    </PanelTitle>

                    {gerakanTanah === null ? (
                        <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-[11px] text-slate-500">
                            Memuat laporan tanggapan…
                        </p>
                    ) : gerakanTanah.list.length > 0 ? (
                        <ul className="space-y-1.5">
                            {gerakanTanah.list.map((item, index) => (
                                <li
                                    key={String(item.id ?? item.title ?? index)}
                                >
                                    <a
                                        href={item.url ?? '#'}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="group block rounded-lg border border-white/5 bg-white/[0.04] px-2.5 py-2 text-[11px] transition hover:border-sky-500/30 hover:bg-sky-500/10"
                                    >
                                        <span className="flex items-start justify-between gap-2">
                                            <span className="leading-snug font-semibold text-slate-300 group-hover:text-white">
                                                {item.title}
                                            </span>

                                            <ExternalLink
                                                size={11}
                                                strokeWidth={2.5}
                                                className="mt-0.5 shrink-0 text-slate-600 group-hover:text-sky-400"
                                            />
                                        </span>

                                        {item.date && (
                                            <span className="mt-1 block text-[9.5px] font-medium text-slate-600">
                                                {formatWIB(item.date)}
                                            </span>
                                        )}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-[11px] text-slate-500">
                            {gerakanTanah.error ?? 'Belum ada laporan.'}
                        </p>
                    )}
                </section>

                {/* META */}

                <div className="border-t border-white/10 pt-2.5 text-[10px] leading-relaxed text-slate-600">
                    <p>
                        <b className="text-slate-500">Sumber:</b> VAAC Darwin
                        (BOM Australia) • PVMBG/MAGMA-VSI • BMKG
                    </p>
                </div>
            </aside>

            {/* =====================================
            LEGENDA & LAYER (KANAN)
        ====================================== */}

            <aside className="pointer-events-auto absolute top-[128px] right-2 z-[1100] hidden w-[230px] max-w-[40vw] rounded-2xl border border-white/10 bg-gradient-to-b from-[#111b2e]/95 to-[#0a0f1c]/95 p-3.5 shadow-2xl shadow-black/50 backdrop-blur-xl lg:block">
                <LegendPanel
                    showGempaMarkers={showGempaMarkers}
                    onToggleGempa={() => setShowGempaMarkers((value) => !value)}
                    volcanoQuakesCount={volcanoQuakesCount}
                    checkedLayers={checkedLayers}
                    onToggleLayer={toggleLayer}
                    ashActive={ashActive}
                />
            </aside>

            {/* =====================================
                LEGENDA & LAYER (MOBILE DRAWER)
            ====================================== */}

            {layerOpen && (
                <div className="absolute inset-0 z-[1400] flex items-end justify-center lg:hidden">
                    <button
                        type="button"
                        aria-label="Tutup legenda & layer"
                        onClick={() => setLayerOpen(false)}
                        className="absolute inset-0 z-0 cursor-default bg-black/50 backdrop-blur-sm"
                    />

                    <div className="pointer-events-auto relative z-10 mx-3 mb-24 max-h-[60dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/10 bg-gradient-to-b from-[#111b2e]/98 to-[#0a0f1c]/98 p-3.5 shadow-2xl shadow-black/60 backdrop-blur-xl">
                        <LegendPanel
                            showGempaMarkers={showGempaMarkers}
                            onToggleGempa={() =>
                                setShowGempaMarkers((value) => !value)
                            }
                            volcanoQuakesCount={volcanoQuakesCount}
                            checkedLayers={checkedLayers}
                            onToggleLayer={toggleLayer}
                            ashActive={ashActive}
                        />
                    </div>
                </div>
            )}

            {/* =====================================
                BOTTOM BAR
            ====================================== */}

            <footer className="pointer-events-none absolute inset-x-3 bottom-3 z-[1100] flex items-end justify-between gap-2">
                <div className="pointer-events-auto rounded-xl border border-white/10 bg-gradient-to-b from-[#111b2e]/95 to-[#0a0f1c]/95 px-3 py-2 text-[10.5px] text-slate-500 backdrop-blur-xl">
                    Volcano Watch by : Haris Darmawan | • BMKG / PVMBG / VAAC
                    Darwin
                </div>

                <div className="pointer-events-auto flex items-center justify-end gap-2 rounded-xl border border-white/10 bg-gradient-to-b from-[#111b2e]/95 to-[#0a0f1c]/95 px-3 py-2 text-[10.5px] text-slate-400 backdrop-blur-xl">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(61,220,132,1)]" />
                    Update terakhir:{' '}
                    {lastUpdated ? formatWIB(lastUpdated.toISOString()) : '-'}{' '}
                    WIB
                </div>
            </footer>
        </div>
    );
}
