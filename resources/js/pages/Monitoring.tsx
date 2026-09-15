import {
    lazy,
    Suspense,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from 'react';

import { Head } from '@inertiajs/react';

import VolcanoIcon from '@/components/VolcanoIcon';

import {
    Activity,
    AlertTriangle,
    ArrowLeft,
    ChevronDown,
    Cloud,
    CloudDrizzle,
    CloudFog,
    CloudLightning,
    CloudRain,
    CloudSnow,
    CloudSun,
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
    Sun,
    TriangleAlert,
    Wind,
    type LucideIcon,
} from 'lucide-react';

const VolcanoMap = lazy(() => import('@/components/VolcanoMap'));

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
    visibility: number | null;
    visibility_text: string | null;
}

interface Activity {
    occurred_at: string;
    activity_level: string | null;
    ash_height: number | null;
    description: string | null;
    author?: string | null;
    image?: string | null;
    source?: string;
}

interface EruptionEvent {
    name: string | null;
    occurred_at: string;
    ash_height: number | null;
    description: string | null;
    author?: string | null;
    image?: string | null;
    time_label?: string | null;
    date_label?: string | null;
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

interface UserCityWeather {
    time: string;
    temperature: number | null;
    apparent_temperature: number | null;
    humidity: number | null;
    wind_speed: number | null;
    wind_direction_deg: number | null;
    wind_gust: number | null;
    pressure_msl: number | null;
    visibility: number | null;
    weather_code: number | null;
}

interface CityWeather {
    source: string;
    adm4?: string | null;
    location?: string | null;
    time?: string | null;
    temperature?: number | null;
    humidity?: number | null;
    wind_speed?: number | null;
    wind_direction_deg?: number | null;
    wind_direction_cardinal?: string | null;
    visibility?: number | null;
    visibility_text?: string | null;
    weather_code?: number | null;
    weather_desc?: string | null;
}

interface WorkingCityWeather {
    source: 'BMKG' | 'Open-Meteo';
    location: string | null;
    time: string | null;
    temperature: number | null;
    humidity: number | null;
    wind_speed: number | null;
    wind_direction_deg: number | null;
    wind_direction_cardinal: string | null;
    visibility: number | null;
    visibility_text: string | null;
    weather_code: number | null;
    weather_desc: string | null;
    pressure_msl: number | null;
    wind_gust: number | null;
    apparent_temperature: number | null;
}

interface MonitoringData {
    volcano: Volcano;
    activity: Activity | null;
    eruptions?: EruptionEvent[];
    weather: Weather | null;
    weather_forecasts: WeatherForecast[];
    weather_location: string | null;
    current_weather: CurrentWeather | null;
    ash_prediction: AshPrediction | null;
    ash_predictions: AshPrediction[];
    ash_active: boolean;
    ash_advisory: AshAdvisory | null;
    gdacs: GdacsAlert | null;
}

interface GdacsAlert {
    alert_level: 'red' | 'orange' | 'green';
    is_current: boolean;
    event_id: string;
    episode_id: string;
    volcano_name: string | null;
    link: string;
    occurred_at: string | null;
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
    thumbnail: string | null;
}

interface GerakanTanahData {
    list: GerakanTanahItem[];
    error?: string | null;
}

interface CityData {
    city: {
        name: string | null;
        district: string | null;
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
    weather?: CityWeather | null;
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

const PANEL_ITEMS = [
    { key: 'kota', label: 'Kota Saya', Icon: MapPin },
    { key: 'letusan', label: 'Informasi Letusan', Icon: VolcanoIcon },
    { key: 'status', label: 'Status Erupsi & PVMBG', Icon: Activity },
    { key: 'cuaca', label: 'Cuaca & Sebaran Abu', Icon: CloudSun },
    { key: 'advisory', label: 'Advisory Abu Vulkanik', Icon: Radio },
    { key: 'gempa', label: 'Gempa Terkini', Icon: Siren },
    { key: 'gerakan', label: 'Gerakan Tanah', Icon: LandPlot },
] as const;

type PanelKey = (typeof PANEL_ITEMS)[number]['key'];

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

function bmkgConditionIcon(weather: string | null) {
    const text = (weather ?? '').toLowerCase();

    if (text.includes('petir') || text.includes('badai')) {
        return { Icon: CloudLightning, className: 'text-yellow-400' };
    }

    if (text.includes('hujan')) {
        return {
            Icon: text.includes('ringan') ? CloudDrizzle : CloudRain,
            className: 'text-sky-400',
        };
    }

    if (text.includes('kabut') || text.includes('kabur')) {
        return { Icon: CloudFog, className: 'text-slate-400' };
    }

    if (text.includes('berawan')) {
        return {
            Icon: text.includes('tebal') ? Cloud : CloudSun,
            className: 'text-slate-300',
        };
    }

    if (text.includes('cerah')) {
        return { Icon: Sun, className: 'text-amber-300' };
    }

    return { Icon: CloudSun, className: 'text-slate-400' };
}

/**
 * Kondisi cuaca BMKG: label memakai deskripsi resmi BMKG,
 * icon dipilih berdasar teks deskripsi; fallback ke kode WMO.
 */
function bmkgCondition(
    code: number | null,
    desc: string | null,
): { Icon: LucideIcon; className: string; label: string } {
    const fallback = openMeteoCondition(code);

    if (!desc) {
        return fallback;
    }

    return { ...bmkgConditionIcon(desc), label: desc };
}

/**
 * Normalisasi cuaca kota: BMKG (dari backend) diprioritaskan,
 * Open-Meteo jadi cadangan bila BMKG tidak tersedia.
 */
function toDisplayWeather(
    bmkg: CityWeather | null | undefined,
    openMeteo: UserCityWeather | null,
): WorkingCityWeather | null {
    if (bmkg?.source === 'BMKG') {
        return {
            source: 'BMKG',
            location: bmkg.location ?? null,
            time: bmkg.time ?? null,
            temperature: bmkg.temperature ?? null,
            humidity: bmkg.humidity ?? null,
            wind_speed: bmkg.wind_speed ?? null,
            wind_direction_deg: bmkg.wind_direction_deg ?? null,
            wind_direction_cardinal: bmkg.wind_direction_cardinal ?? null,
            visibility: bmkg.visibility ?? null,
            visibility_text: bmkg.visibility_text ?? null,
            weather_code: bmkg.weather_code ?? null,
            weather_desc: bmkg.weather_desc ?? null,
            pressure_msl: null,
            wind_gust: null,
            apparent_temperature: null,
        };
    }

    if (openMeteo) {
        return {
            source: 'Open-Meteo',
            location: null,
            time: openMeteo.time,
            temperature: openMeteo.temperature,
            humidity: openMeteo.humidity,
            wind_speed: openMeteo.wind_speed,
            wind_direction_deg: openMeteo.wind_direction_deg,
            wind_direction_cardinal: null,
            visibility: openMeteo.visibility,
            visibility_text: null,
            weather_code: openMeteo.weather_code,
            weather_desc: null,
            pressure_msl: openMeteo.pressure_msl,
            wind_gust: openMeteo.wind_gust,
            apparent_temperature: openMeteo.apparent_temperature,
        };
    }

    return null;
}

const WIND_DIRECTION_LABELS: Record<string, string> = {
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

function bmkgWindDirectionLabel(windDirection: string | null) {
    if (!windDirection) {
        return '-';
    }

    const key = windDirection.trim().toUpperCase();

    return WIND_DIRECTION_LABELS[key] ?? windDirection;
}

function bmkgNumber(value: number | null | undefined) {
    if (value === null || value === undefined || Number.isNaN(value)) {
        return '-';
    }

    return new Intl.NumberFormat('id-ID', {
        maximumFractionDigits: 1,
    }).format(value);
}

function formatNaiveTime(iso: string) {
    const match = iso.match(/T(\d{2}):(\d{2})/);

    return match !== null ? `${match[1]}.${match[2]}` : '-';
}

function formatNaiveDate(iso: string) {
    const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);

    if (match === null) {
        return '-';
    }

    const months = [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'Mei',
        'Jun',
        'Jul',
        'Agu',
        'Sep',
        'Okt',
        'Nov',
        'Des',
    ];

    return `${Number(match[3])} ${months[Number(match[2]) - 1]} ${match[1]}`;
}

async function fetchUserCityWeather(lat: number, lon: number) {
    const params = new URLSearchParams({
        latitude: String(lat),
        longitude: String(lon),
        current: [
            'temperature_2m',
            'relative_humidity_2m',
            'apparent_temperature',
            'pressure_msl',
            'wind_speed_10m',
            'wind_direction_10m',
            'wind_gusts_10m',
            'visibility',
            'weather_code',
        ].join(','),
        timezone: 'Asia/Jakarta',
        timeformat: 'iso8601',
    });

    const response = await fetch(
        `https://api.open-meteo.com/v1/forecast?${params.toString()}`,
    );

    if (!response.ok) {
        throw new Error('open-meteo gagal');
    }

    const json = await response.json();
    const current = json.current ?? {};

    return {
        time: current.time ?? '',
        temperature: current.temperature_2m ?? null,
        apparent_temperature: current.apparent_temperature ?? null,
        humidity: current.relative_humidity_2m ?? null,
        wind_speed: current.wind_speed_10m ?? null,
        wind_direction_deg: current.wind_direction_10m ?? null,
        wind_gust: current.wind_gusts_10m ?? null,
        pressure_msl: current.pressure_msl ?? null,
        visibility: current.visibility ?? null,
        weather_code: current.weather_code ?? null,
    } as UserCityWeather;
}

function openMeteoCondition(code: number | null): {
    Icon: LucideIcon;
    className: string;
    label: string;
} {
    switch (code) {
        case 0:
            return { Icon: Sun, className: 'text-amber-300', label: 'Cerah' };
        case 1:
            return {
                Icon: Sun,
                className: 'text-amber-300',
                label: 'Cerah Berawan',
            };
        case 2:
            return {
                Icon: CloudSun,
                className: 'text-slate-300',
                label: 'Berawan',
            };
        case 3:
            return {
                Icon: Cloud,
                className: 'text-slate-300',
                label: 'Mendung',
            };
        case 45:
        case 48:
            return {
                Icon: CloudFog,
                className: 'text-slate-400',
                label: 'Kabut',
            };
        case 51:
        case 53:
        case 55:
            return {
                Icon: CloudDrizzle,
                className: 'text-sky-400',
                label: 'Gerimis',
            };
        case 56:
        case 57:
            return {
                Icon: CloudDrizzle,
                className: 'text-sky-400',
                label: 'Gerimis Dingin',
            };
        case 61:
        case 63:
        case 65:
            return {
                Icon: CloudRain,
                className: 'text-sky-400',
                label: 'Hujan',
            };
        case 66:
        case 67:
            return {
                Icon: CloudRain,
                className: 'text-sky-400',
                label: 'Hujan Es',
            };
        case 71:
        case 73:
        case 75:
            return {
                Icon: CloudSnow,
                className: 'text-cyan-300',
                label: 'Salju',
            };
        case 77:
            return {
                Icon: CloudSnow,
                className: 'text-cyan-300',
                label: 'Butiran Salju',
            };
        case 80:
        case 81:
        case 82:
            return {
                Icon: CloudRain,
                className: 'text-sky-400',
                label: 'Hujan Deras',
            };
        case 85:
        case 86:
            return {
                Icon: CloudSnow,
                className: 'text-cyan-300',
                label: 'Hujan Salju',
            };
        case 95:
            return {
                Icon: CloudLightning,
                className: 'text-yellow-400',
                label: 'Badai Petir',
            };
        case 96:
        case 99:
            return {
                Icon: CloudLightning,
                className: 'text-yellow-400',
                label: 'Badai Petir & Hujan Es',
            };
        default:
            return {
                Icon: CloudSun,
                className: 'text-slate-400',
                label: 'Cuaca Beragam',
            };
    }
}

function degreesToWindDirection(degrees: number | null) {
    if (degrees === null || Number.isNaN(degrees)) {
        return null;
    }

    const directions = [
        'N',
        'NNE',
        'NE',
        'ENE',
        'E',
        'ESE',
        'SE',
        'SSE',
        'S',
        'SSW',
        'SW',
        'WSW',
        'W',
        'WNW',
        'NW',
        'NNW',
    ];

    const index = Math.round((degrees % 360) / 22.5) % 16;

    return bmkgWindDirectionLabel(directions[index]);
}

function formatVisibility(visibility: number | null) {
    if (visibility === null || Number.isNaN(visibility)) {
        return '-';
    }

    if (visibility >= 10000) {
        return '> 10 km';
    }

    return `${new Intl.NumberFormat('id-ID', {
        maximumFractionDigits: 1,
    }).format(visibility / 1000)} km`;
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

    const [volcanoOpen, setVolcanoOpen] = useState(false);

    const [volcanoQuery, setVolcanoQuery] = useState('');

    const [volcanoFocusKey, setVolcanoFocusKey] = useState(0);

    const [timelinePlaying, setTimelinePlaying] = useState(false);

    const [timelineBucketKey, setTimelineBucketKey] = useState('observasi');

    const [openPanel, setOpenPanel] = useState<PanelKey | null>(null);

    // ==========================================
    // DATA GEO (GEMPA & GERAKAN TANAH)
    // ==========================================

    const [gempa, setGempa] = useState<GempaData | null>(null);

    const [hasNewQuake, setHasNewQuake] = useState(false);

    const lastQuakeKeysRef = useRef<Set<string>>(new Set());

    const firstQuakeFetchRef = useRef(true);

    const [hasNewEruption, setHasNewEruption] = useState(false);

    const lastEruptionKeysRef = useRef<Set<string>>(new Set());

    const firstEruptionFetchRef = useRef(true);

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

    const [bmkgWeather, setBmkgWeather] = useState<CityWeather | null>(null);

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

                const eruptionKeys = new Set(
                    (result.eruptions ?? []).map((item) =>
                        `${item.occurred_at}|${item.name ?? ''}`.replace(
                            /null/g,
                            '?',
                        ),
                    ),
                );

                const freshEruptions = [...eruptionKeys].filter(
                    (key) => !lastEruptionKeysRef.current.has(key),
                );

                if (firstEruptionFetchRef.current) {
                    firstEruptionFetchRef.current = false;
                } else if (freshEruptions.length > 0) {
                    setHasNewEruption(true);
                }

                lastEruptionKeysRef.current = eruptionKeys;

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

    // Reset deteksi erupsi baru saat gunung diganti,
    // supaya tidak muncul alert "1" karena pindah gunung.
    useEffect(() => {
        lastEruptionKeysRef.current = new Set();
        firstEruptionFetchRef.current = true;
        setHasNewEruption(false);
    }, [selectedVolcanoId]);

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
                const gempaData = gempaResult as GempaData;

                const quakeKeys = new Set(
                    (gempaData.list ?? []).map(
                        (item) =>
                            item.eventid ??
                            `${item.datetime}|${item.latitude}|${item.longitude}`
                                .replace(/null/g, '?')
                                .trim(),
                    ),
                );

                const freshOnes = [...quakeKeys].filter(
                    (key) => !lastQuakeKeysRef.current.has(key),
                );

                if (firstQuakeFetchRef.current) {
                    firstQuakeFetchRef.current = false;
                } else if (freshOnes.length > 0) {
                    setHasNewQuake(true);
                }

                lastQuakeKeysRef.current = quakeKeys;

                setGempa(gempaData);
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
                    setBmkgWeather(result.weather ?? null);
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

    // ==========================================
    // CUACA KOTA SAYA — REAL-TIME (BMKG, FALLBACK OPEN-METEO)
    // ==========================================

    const [userWeather, setUserWeather] = useState<UserCityWeather | null>(
        null,
    );

    const [userWeatherLoading, setUserWeatherLoading] = useState(false);

    const [userWeatherError, setUserWeatherError] = useState<string | null>(
        null,
    );

    const [userWeatherKey, setUserWeatherKey] = useState(0);

    useEffect(() => {
        if (cityCoords === null) {
            return;
        }

        let cancelled = false;

        setUserWeatherLoading(true);
        setUserWeatherError(null);

        fetchUserCityWeather(cityCoords.lat, cityCoords.lon)
            .then((weather) => {
                if (!cancelled) {
                    setUserWeather(weather);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setUserWeatherError('Gagal memuat cuaca real-time.');
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setUserWeatherLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [cityCoords, refreshKey, userWeatherKey]);

    const cityLocationLabel = [
        cityData?.city.district,
        cityData?.city.name,
        cityData?.city.provinsi,
    ]
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

        // Minta peta mengarah ke gunung ini (termasuk saat marker
        // gunung yang sama diklik kembali).
        setVolcanoFocusKey((key) => key + 1);

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

        if (!query) {
            return true;
        }

        // "Gunung ..." dipakai user sebagai awalan nama, tetapi prefix
        // itu tidak dipakai untuk pencocokan. Tanpa pengecualian ini,
        // mengetik "gunung ..." membuat "Gunung Anak Krakatau" (satu-satunya
        // nama berprefix "Gunung " yang tersisa di daftar) selalu muncul
        // lebih dulu sebelum gunung tujuan.
        const normQuery = query.replace(/^gunung\s*/i, '').trim();

        // Masih hanya "gunung" / "gunung " → tampilkan seluruh daftar
        // sampai user mengetik nama gunung yang dituju.
        if (normQuery === '') {
            return true;
        }

        const normName = volcano.name.toLowerCase().replace(/^gunung\s*/i, '');

        return (
            normName.includes(normQuery) ||
            volcano.code.toLowerCase().includes(normQuery)
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

    const formatWIBTimeHM = (date: string) => {
        const parsed = new Date(date);

        if (Number.isNaN(parsed.getTime())) {
            return '-';
        }

        const parts = new Intl.DateTimeFormat('id-ID', {
            timeZone: 'Asia/Jakarta',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
        }).formatToParts(parsed);

        const pick = (type: string) =>
            parts.find((part) => part.type === type)?.value ?? '';

        return `${pick('hour')}.${pick('minute')}`;
    };

    const formatWIBShortDate = (date: string) => {
        const parsed = new Date(date);

        if (Number.isNaN(parsed.getTime())) {
            return '-';
        }

        const parts = new Intl.DateTimeFormat('id-ID', {
            timeZone: 'Asia/Jakarta',
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        }).formatToParts(parsed);

        const pick = (type: string) =>
            parts.find((part) => part.type === type)?.value ?? '';

        return `${pick('day')} ${pick('month')} ${pick('year')}`;
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

    const formatWIBLongDate = (date: string) => {
        const parsed = new Date(date);

        if (Number.isNaN(parsed.getTime())) {
            return '-';
        }

        const parts = new Intl.DateTimeFormat('id-ID', {
            timeZone: 'Asia/Jakarta',
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        }).formatToParts(parsed);

        const pick = (type: string) =>
            parts.find((part) => part.type === type)?.value ?? '';

        return `${pick('weekday')}, ${pick('day')} ${pick('month')} ${pick('year')}`;
    };

    const isEruptionToday = (date: string) => {
        const parsed = new Date(date);

        if (Number.isNaN(parsed.getTime())) {
            return false;
        }

        const keyOf = (value: Date) =>
            new Intl.DateTimeFormat('en-CA', {
                timeZone: 'Asia/Jakarta',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
            }).format(value);

        return keyOf(parsed) === keyOf(new Date());
    };

    const magnitudeLabel = (magnitude: string | null) =>
        magnitude && !Number.isNaN(Number(magnitude))
            ? Number(magnitude).toFixed(1).replace('.', ',')
            : '-';

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

    const renderGempaCard = (item: GempaItem) => (
        <>
            <div className="flex items-start justify-between gap-2">
                <p className="text-[11px] font-semibold text-slate-300">
                    {item.datetime
                        ? formatWIBShort(item.datetime)
                        : `${item.tanggal ?? '-'}${
                              item.jam ? ` • ${item.jam}` : ''
                          }`}
                </p>

                {item.status && (
                    <span className="shrink-0 rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">
                        {item.status === 'confirmed'
                            ? 'Terkonfirmasi'
                            : item.status}
                    </span>
                )}
            </div>

            <p className="mt-0.5 text-[13px] leading-snug font-bold text-white">
                {item.region}
            </p>

            {item.potential && (
                <p
                    className={`mt-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                        item.potential.toLowerCase().includes('tidak')
                            ? 'bg-emerald-500/10 text-emerald-300'
                            : 'bg-red-500/10 text-red-300'
                    }`}
                >
                    {item.potential}
                </p>
            )}

            <dl className="mt-2.5 space-y-1.5 text-[11px]">
                <div className="flex items-center justify-between border-b border-white/5 pb-1.5">
                    <dt className="font-semibold text-slate-500">Magnitudo</dt>

                    <dd
                        className="font-black"
                        style={{
                            color: gempaMagColor(
                                item.magnitude != null
                                    ? Number(item.magnitude)
                                    : null,
                            ),
                        }}
                    >
                        {magnitudeLabel(item.magnitude)}
                    </dd>
                </div>

                <div className="flex items-center justify-between border-b border-white/5 pb-1.5">
                    <dt className="font-semibold text-slate-500">Kedalaman</dt>

                    <dd className="font-semibold text-slate-300">
                        {kedalamanLabel(item.depth)}
                    </dd>
                </div>

                <div className="flex items-center justify-between">
                    <dt className="font-semibold text-slate-500">Lokasi</dt>

                    <dd className="text-right font-semibold text-slate-300">
                        {locationLabel(item)}
                    </dd>
                </div>
            </dl>
        </>
    );

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
    // PRAKIRAAN BMKG PER 3 JAM (GADGET CUACA)
    // ==========================================

    const bmkgForecasts = useMemo(() => {
        const sorted = (data?.weather_forecasts ?? [])
            .map((forecast) => ({
                forecast,
                ts: new Date(forecast.forecast_at).getTime(),
            }))
            .filter(
                ({ ts }) =>
                    !Number.isNaN(ts) && ts >= Date.now() - 3 * 60 * 60 * 1000,
            )
            .sort((a, b) => a.ts - b.ts)
            .map(({ forecast }) => forecast);

        const daysMap = new Map<string, typeof sorted>();

        for (const forecast of sorted) {
            const key = formatWIBLongDate(forecast.forecast_at);
            const day = daysMap.get(key) ?? [];

            day.push(forecast);

            daysMap.set(key, day);
        }

        return [...daysMap.entries()].map(([label, slots]) => ({
            label,
            slots,
        }));
    }, [data, formatWIBLongDate]);

    const bmkgCurrent = bmkgForecasts[0]?.slots[0] ?? null;

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
                        src="/logo/logoSi-thumb.webp"
                        alt="Volcano Watch"
                        width={120}
                        height={129}
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
                        src="/logo/logoSi-thumb.webp"
                        alt="Volcano Watch"
                        width={120}
                        height={129}
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
    // RENDER
    // ==========================================

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

    // ==========================================
    // STATUS ERUPSI REAL-TIME (TAB STATUS)
    // ==========================================

    const ashHeightM = data.ash_advisory?.ash_height_m ?? null;

    const ashDirectionLabel = realTimeAsh?.movement
        ? (WIND_DIRECTION_LABELS[realTimeAsh.movement.toUpperCase()] ??
          realTimeAsh.movement)
        : null;

    const statusEruptionText = (() => {
        if (ashActive) {
            if (ashHeightM !== null && ashDirectionLabel) {
                return `Terdeteksi abu di ketinggian ~${bmkgNumber(ashHeightM / 1000)} km bergerak ke arah ${ashDirectionLabel}.`;
            }

            return 'Terdeteksi sebaran abu vulkanik aktif (VAAC).';
        }

        if (erupting) {
            return (
                data.activity?.description ?? 'Gunung sedang bererupsi (MAGMA).'
            );
        }

        return 'Tidak terdeteksi erupsi maupun sebaran abu aktif saat ini.';
    })();

    const statusDataTimeLabel = (() => {
        if (ashActive && data.ash_advisory?.issued_at) {
            return `Data diambil ${formatWIBStamp(data.ash_advisory.issued_at)} WIB`;
        }

        if (data.activity?.occurred_at) {
            return `Data diambil ${formatWIBStamp(data.activity.occurred_at)} WIB`;
        }

        return 'Data diambil -';
    })();

    const GDACS_LEVEL_LABEL: Record<GdacsAlert['alert_level'], string> = {
        red: 'Merah - Bahaya Tinggi',
        orange: 'Oranye - Waspada',
        green: 'Hijau - Normal',
    };

    const GDACS_LEVEL_COLOR: Record<GdacsAlert['alert_level'], string> = {
        red: '#ef4444',
        orange: '#f97316',
        green: '#22c55e',
    };

    const gdacsState = (() => {
        const alert = data.gdacs;

        if (alert === null) {
            return { color: '#64748b', label: 'Tidak Ada', activity: null };
        }

        const label = GDACS_LEVEL_LABEL[alert.alert_level];

        if (alert.is_current) {
            return {
                color: GDACS_LEVEL_COLOR[alert.alert_level],
                label,
                activity: null,
            };
        }

        return {
            color: '#64748b',
            label: `${label} (berakhir)`,
            activity: `episode terakhir GDACS • ${formatWIBShortDate(alert.occurred_at ?? '')}`,
        };
    })();

    const gdacsBadgeClass =
        gdacsState.color === '#ef4444'
            ? 'border-red-500/30 bg-red-500/10 text-red-300'
            : gdacsState.color === '#f97316'
              ? 'border-orange-500/30 bg-orange-500/10 text-orange-300'
              : gdacsState.color === '#22c55e'
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                : 'border-slate-500/30 bg-slate-500/10 text-slate-300';

    // ==========================================
    // PRAKIRAAN BMKG PER 3 JAM
    //
    // Data BMKG per jam; ditampilkan ala situs
    // prakiraan-cuaca BMKG: slot tiap 3 jam,
    // dikelompokkan per tanggal (WIB).
    // ==========================================

    const availPanels = PANEL_ITEMS;

    const active = availPanels.some((panel) => panel.key === openPanel)
        ? openPanel
        : null;

    return (
        <div className="relative h-screen w-screen overflow-hidden bg-[#05070a] text-[#eef1f5]">
            <Head title="Monitoring Gunung Berapi & Cuaca Indonesia">
                <meta
                    name="description"
                    content="Monitor real-time status aktivitas gunung berapi Indonesia, prakiraan cuaca, arah angin, sebaran abu vulkanik, laporan erupsi dan gempa vulkanik."
                />
                <meta name="robots" content="index, follow" />
            </Head>

            {/* =====================================
            PETA LAYAR PENUH (LATAR BELAKANG)
        ====================================== */}

            <div className="absolute inset-0 z-0">
                <Suspense
                    fallback={
                        <div className="h-full w-full bg-[#12263e] [background-image:linear-gradient(135deg,rgba(14,165,233,0.08)_25%,transparent_25%),linear-gradient(315deg,rgba(14,165,233,0.08)_25%,transparent_25%),linear-gradient(45deg,rgba(14,165,233,0.08)_25%,transparent_25%),linear-gradient(45deg,transparent_75%,rgba(14,165,233,0.08)_75%)] [background-size:40px_40px]" />
                    }
                >
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
                        focusKey={volcanoFocusKey}
                        onSelectEarthquake={(quake) => {
                            const matched =
                                gempa?.list.find(
                                    (g) =>
                                        g.eventid != null &&
                                        g.eventid === quake.id,
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
                </Suspense>
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
                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                        <div className="flex min-w-0 items-center gap-2.5">
                            <img
                                src="/logo/logoSi-nav.webp"
                                alt="Volcano Watch"
                                width={72}
                                height={77}
                                fetchPriority="high"
                                className="h-8 w-auto shrink-0 object-contain drop-shadow-[0_0_14px_rgba(14,165,233,0.5)] sm:h-10"
                            />

                            <div className="min-w-0">
                                <p className="truncate bg-gradient-to-r from-white via-sky-100 to-sky-300 bg-clip-text text-sm leading-tight font-black tracking-tight text-transparent sm:text-[15px]">
                                    Volcano Watch
                                </p>

                                <p className="mt-0.5 flex items-center gap-1.5">
                                    <span className="relative flex h-1.5 w-1.5">
                                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75" />
                                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-sky-400" />
                                    </span>

                                    <span className="truncate text-[8px] font-extrabold tracking-[2px] text-sky-400/90 uppercase sm:text-[9px]">
                                        Live Monitoring · 24 Jam
                                    </span>
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

            <aside className="pointer-events-auto absolute top-[190px] left-2 z-[1100] flex items-start gap-2 sm:left-3">
                {/* TOGGLE PANEL (KAYA LULCC IPB) */}

                <div className="flex min-h-0 w-14 flex-col items-center justify-center gap-2 rounded-2xl border border-white/10 bg-gradient-to-b from-[#111b2e]/95 to-[#0a0f1c]/95 py-1.5 shadow-2xl shadow-black/50 backdrop-blur-xl">
                    {availPanels.map(({ key, label, Icon }) => {
                        const isActive = active === key;

                        const isQuake = key === 'gempa' && hasNewQuake;

                        const isEruptionNotif =
                            key === 'letusan' && hasNewEruption;

                        const isAlert = isQuake || isEruptionNotif;

                        return (
                            <button
                                key={key}
                                type="button"
                                title={label}
                                aria-label={label}
                                onClick={() => {
                                    setOpenPanel(isActive ? null : key);

                                    if (key === 'gempa') {
                                        setHasNewQuake(false);
                                    }

                                    if (key === 'letusan') {
                                        setHasNewEruption(false);
                                    }
                                }}
                                className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition ${
                                    isAlert
                                        ? isActive
                                            ? 'border-red-400/60 bg-gradient-to-b from-[#111b2e] to-[#0a0f1c] text-red-400 shadow-[0_0_16px_rgba(239,68,68,0.45)]'
                                            : 'border-red-400/40 bg-gradient-to-b from-[#111b2e]/95 to-[#0a0f1c]/95 text-red-400 hover:border-red-400/70 hover:text-red-300'
                                        : isActive
                                          ? 'border-sky-400/60 bg-gradient-to-b from-[#111b2e] to-[#0a0f1c] text-sky-300 shadow-[0_0_14px_rgba(56,189,248,0.35)]'
                                          : 'border-white/10 bg-gradient-to-b from-[#111b2e]/95 to-[#0a0f1c]/95 text-slate-300 hover:border-sky-500/40 hover:text-sky-300'
                                }`}
                            >
                                <span
                                    className={`relative flex items-center justify-center ${
                                        isAlert ? 'vg-bell-shake' : ''
                                    }`}
                                >
                                    <Icon size={18} strokeWidth={2.5} />

                                    {isQuake && (
                                        <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,1)]" />
                                    )}

                                    {isEruptionNotif && (
                                        <span className="absolute -top-2 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] leading-none font-black text-white shadow-[0_0_8px_rgba(239,68,68,1)]">
                                            1
                                        </span>
                                    )}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {/* PANEL AKTIF */}

                <div
                    className={`w-[308px] max-w-[calc(100vw-96px)] self-start overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-[#111b2e] to-[#0a0f1c] pt-3.5 pb-3.5 pl-3.5 shadow-2xl shadow-black/50 ${
                        active !== null ? '' : 'hidden'
                    }`}
                    style={{ maxHeight: 'calc(100dvh - 280px)' }}
                >
                    <div
                        className="flex w-full min-w-0 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.18)_transparent] flex-col gap-3 overflow-x-hidden overflow-y-auto pr-2.5 [&::-webkit-scrollbar]:w-[4px] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-track]:bg-transparent"
                        style={{ maxHeight: 'calc(100dvh - 280px)' }}
                    >
                        {active === 'kota' && (
                            <section>
                                <PanelTitle
                                    icon={
                                        <MapPin size={11} strokeWidth={2.5} />
                                    }
                                >
                                    Kota Saya &amp; Sebaran Abu
                                </PanelTitle>

                                {geoState === 'idle' && !cityCoords && (
                                    <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
                                        Klik{' '}
                                        <span className="font-bold text-sky-400">
                                            Kota Saya
                                        </span>{' '}
                                        di bar atas untuk mendeteksi lokasi
                                        Anda. Browser akan meminta izin
                                        (Allow/Izinkan), lalu kota Anda dipantau
                                        sebaran abu vulkanik secara real-time.
                                    </p>
                                )}

                                {geoState === 'requesting' && (
                                    <p className="mt-2 flex items-center gap-2 text-[11px] text-sky-300">
                                        <span className="h-2 w-2 animate-pulse rounded-full bg-sky-400" />
                                        Meminta izin lokasi… Lihat popup
                                        Allow/Izinkan di browser Anda.
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
                                                    cityData.summary
                                                        .inside_plume
                                                        ? 'bg-red-500/25'
                                                        : 'bg-sky-500/25'
                                                }`}
                                            />

                                            <div className="relative flex items-center gap-2">
                                                <span
                                                    className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border ${
                                                        cityData.summary
                                                            .inside_plume
                                                            ? 'border-red-400/40 bg-red-500/15 shadow-[0_0_16px_rgba(255,59,59,0.4)]'
                                                            : 'border-sky-400/30 bg-sky-500/15 shadow-[0_0_16px_rgba(14,165,233,0.35)]'
                                                    }`}
                                                >
                                                    {cityData.summary
                                                        .inside_plume ? (
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

                                                    {cityData.summary
                                                        .inside_plume && (
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
                                            ) : cityData.summary.plume_volcanoes
                                                  .length > 0 ? (
                                                <p className="relative mt-2 flex items-baseline gap-1.5">
                                                    <span className="text-[30px] leading-none font-black text-sky-300 tabular-nums drop-shadow-[0_0_18px_rgba(56,189,248,0.35)]">
                                                        ≈{' '}
                                                        {formatAshKm(
                                                            cityData.summary
                                                                .ash_edge_km ??
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

                                {/* CUACA KOTA SAYA (REAL-TIME) */}

                                <section className="mt-4">
                                    <PanelTitle
                                        icon={
                                            <MapPin
                                                size={11}
                                                strokeWidth={2.5}
                                            />
                                        }
                                    >
                                        Cuaca Kota Saya
                                    </PanelTitle>

                                    {geoState === 'requesting' ||
                                    geoState === 'idle' ? (
                                        <p className="rounded-xl border border-white/10 bg-white/5 p-2.5 text-[11px] leading-relaxed text-slate-500">
                                            Mengakses lokasi Anda untuk
                                            menampilkan cuaca real-time…
                                        </p>
                                    ) : geoState === 'denied' ||
                                      geoState === 'error' ? (
                                        <div className="rounded-xl border border-white/10 bg-white/5 p-2.5">
                                            <p className="text-[11px] leading-relaxed text-slate-500">
                                                {geoError ??
                                                    'Lokasi tidak tersedia.'}
                                            </p>

                                            <button
                                                type="button"
                                                onClick={() =>
                                                    requestCityLocation()
                                                }
                                                className="mt-2 flex items-center gap-1.5 rounded-lg border border-sky-400/30 bg-sky-400/10 px-2.5 py-1 text-[10px] font-bold text-sky-300"
                                            >
                                                <MapPin
                                                    size={10}
                                                    strokeWidth={2.5}
                                                />
                                                Coba lagi
                                            </button>
                                        </div>
                                    ) : !toDisplayWeather(
                                          bmkgWeather,
                                          userWeather,
                                      ) ? (
                                        <div className="rounded-xl border border-white/10 bg-white/5 p-2.5">
                                            <p className="text-[11px] leading-relaxed text-slate-500">
                                                {userWeatherLoading
                                                    ? 'Memuat cuaca real-time…'
                                                    : (userWeatherError ??
                                                      'Menunggu data cuaca kota.')}
                                            </p>

                                            {userWeatherError && (
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setUserWeatherKey(
                                                            (key) => key + 1,
                                                        )
                                                    }
                                                    className="mt-2 flex items-center gap-1.5 rounded-lg border border-sky-400/30 bg-sky-400/10 px-2.5 py-1 text-[10px] font-bold text-sky-300"
                                                >
                                                    <RefreshCw
                                                        size={10}
                                                        strokeWidth={2.5}
                                                    />
                                                    Muat ulang
                                                </button>
                                            )}
                                        </div>
                                    ) : (
                                        (() => {
                                            const weather = toDisplayWeather(
                                                bmkgWeather,
                                                userWeather,
                                            )!;

                                            const weatherTime = weather.time
                                                ? weather.time.replace(' ', 'T')
                                                : null;

                                            const { Icon, className, label } =
                                                weather.weather_desc
                                                    ? bmkgCondition(
                                                          weather.weather_code,
                                                          weather.weather_desc,
                                                      )
                                                    : openMeteoCondition(
                                                          weather.weather_code,
                                                      );

                                            const windLabel =
                                                weather.wind_direction_cardinal
                                                    ? bmkgWindDirectionLabel(
                                                          weather.wind_direction_cardinal,
                                                      )
                                                    : (degreesToWindDirection(
                                                          weather.wind_direction_deg,
                                                      ) ?? '-');

                                            return (
                                                <div className="rounded-xl border border-emerald-400/20 bg-gradient-to-b from-emerald-400/10 to-white/[0.03] p-3.5 pb-4">
                                                    <div className="flex items-center justify-between">
                                                        <span className="flex items-center gap-1.5 text-[9px] font-extrabold tracking-wider text-emerald-300 uppercase">
                                                            <span className="relative flex h-1.5 w-1.5">
                                                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                                                                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                                                            </span>
                                                            Real-time
                                                        </span>

                                                        <span className="text-[8.5px] text-slate-500">
                                                            Pemutakhiran:{' '}
                                                            {weatherTime
                                                                ? formatNaiveDate(
                                                                      weatherTime,
                                                                  )
                                                                : '-'}{' '}
                                                            •{' '}
                                                            {weatherTime
                                                                ? formatNaiveTime(
                                                                      weatherTime,
                                                                  )
                                                                : '-'}{' '}
                                                            WIB
                                                        </span>
                                                    </div>

                                                    <div className="mt-2 flex items-center gap-3">
                                                        <Icon
                                                            size={38}
                                                            strokeWidth={2}
                                                            className={`shrink-0 ${className}`}
                                                        />

                                                        <div>
                                                            <p className="text-[30px] leading-none font-extrabold text-white">
                                                                {bmkgNumber(
                                                                    weather.temperature,
                                                                )}
                                                                °
                                                            </p>

                                                            <p className="mt-1 text-[11px] font-semibold text-slate-300">
                                                                {label}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <p className="mt-1.5 text-[9.5px] text-slate-500">
                                                        di{' '}
                                                        {cityLocationLabel ||
                                                            'Lokasi Anda'}
                                                    </p>

                                                    <div className="mt-2.5 grid grid-cols-2 gap-1.5">
                                                        <div className="rounded-lg bg-white/5 p-2">
                                                            <p className="text-[8px] tracking-wide text-slate-500 uppercase">
                                                                Kelembapan
                                                            </p>

                                                            <p className="mt-0.5 text-[12px] font-bold text-white">
                                                                {bmkgNumber(
                                                                    weather.humidity,
                                                                )}
                                                                %
                                                            </p>
                                                        </div>

                                                        <div className="rounded-lg bg-white/5 p-2">
                                                            <p className="text-[8px] tracking-wide text-slate-500 uppercase">
                                                                Kecepatan Angin
                                                            </p>

                                                            <p className="mt-0.5 text-[12px] font-bold text-white">
                                                                {bmkgNumber(
                                                                    weather.wind_speed,
                                                                )}{' '}
                                                                km/jam
                                                            </p>
                                                        </div>

                                                        <div className="rounded-lg bg-white/5 p-2">
                                                            <p className="text-[8px] tracking-wide text-slate-500 uppercase">
                                                                Arah Angin dari
                                                            </p>

                                                            <p className="mt-0.5 text-[12px] font-bold text-white">
                                                                {windLabel}
                                                            </p>
                                                        </div>

                                                        <div className="rounded-lg bg-white/5 p-2">
                                                            <p className="text-[8px] tracking-wide text-slate-500 uppercase">
                                                                Jarak Pandang
                                                            </p>

                                                            <p className="mt-0.5 text-[12px] font-bold text-white">
                                                                {weather.visibility_text ??
                                                                    formatVisibility(
                                                                        weather.visibility,
                                                                    )}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <div className="mt-2 flex items-center justify-between border-t border-white/5 pt-1.5 text-[9px] text-slate-500">
                                                        <span>
                                                            {weather.pressure_msl !==
                                                            null
                                                                ? `tekanan ${bmkgNumber(
                                                                      weather.pressure_msl,
                                                                  )} hPa`
                                                                : ''}
                                                        </span>

                                                        <span>
                                                            {weather.wind_gust !==
                                                            null
                                                                ? `hembusan ${bmkgNumber(
                                                                      weather.wind_gust,
                                                                  )} km/jam`
                                                                : ''}
                                                        </span>

                                                        <span>
                                                            {weather.apparent_temperature !==
                                                            null
                                                                ? `terasa ${bmkgNumber(
                                                                      weather.apparent_temperature,
                                                                  )}°C`
                                                                : ''}
                                                        </span>
                                                    </div>

                                                    <p className="mt-2.5 text-[8.5px] leading-relaxed text-slate-600">
                                                        {weather.source ===
                                                        'BMKG'
                                                            ? `Sumber: BMKG (prakiraan resmi)${weather.location ? ` • Prakiraan ${weather.location}` : ''} • Lokasi dari GPS perangkat`
                                                            : 'Sumber: Open-Meteo (data meteorologi internasional, bukan data resmi BMKG) • Lokasi dari GPS perangkat'}
                                                    </p>
                                                </div>
                                            );
                                        })()
                                    )}
                                </section>
                            </section>
                        )}

                        {/* LETUSAN GUNUNG (MAGMA informasi-letusan) */}

                        {active === 'letusan' && (
                            <section>
                                <PanelTitle
                                    icon={
                                        <VolcanoIcon
                                            size={11}
                                            strokeWidth={2.5}
                                        />
                                    }
                                >
                                    Letusan Gunung
                                </PanelTitle>

                                {(data.eruptions?.length ?? 0) > 0 ? (
                                    <div className="flex flex-col gap-3">
                                        {data.eruptions!.map(
                                            (eruption, index) => (
                                                <div
                                                    key={
                                                        eruption.occurred_at
                                                            ? `${eruption.occurred_at}-${index}`
                                                            : `${eruption.name}-${index}`
                                                    }
                                                    className="rounded-xl border border-sky-400/25 border-l-sky-400/80 bg-sky-400/[0.07] px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                                                >
                                                    <p className="flex items-center gap-1.5 text-[9px] font-extrabold tracking-widest text-sky-300 uppercase">
                                                        <VolcanoIcon
                                                            size={10}
                                                            strokeWidth={2.5}
                                                        />
                                                        Informasi Letusan ·
                                                        MAGMA
                                                    </p>

                                                    <p className="mt-1.5 text-[12px] font-black text-white">
                                                        {eruption.date_label ??
                                                            (isEruptionToday(
                                                                eruption.occurred_at,
                                                            )
                                                                ? `Hari Ini, ${formatWIBLongDate(eruption.occurred_at)}`
                                                                : formatWIBLongDate(
                                                                      eruption.occurred_at,
                                                                  ))}
                                                    </p>

                                                    <p className="mt-0.5 text-[13px] font-black text-white">
                                                        {eruption.time_label
                                                            ? `${eruption.time_label} · `
                                                            : ''}
                                                        {eruption.name ??
                                                            data.volcano.name}
                                                    </p>

                                                    {eruption.author && (
                                                        <p className="mt-1 text-[10.5px] text-slate-400">
                                                            Dibuat oleh{' '}
                                                            <span className="font-semibold text-slate-300">
                                                                {
                                                                    eruption.author
                                                                }
                                                            </span>
                                                        </p>
                                                    )}

                                                    {eruption.description && (
                                                        <p className="mt-2.5 border-t border-white/10 pt-2 text-[11.5px] leading-relaxed text-slate-200">
                                                            {
                                                                eruption.description
                                                            }
                                                        </p>
                                                    )}

                                                    {eruption.image && (
                                                        <a
                                                            href={
                                                                eruption.image
                                                            }
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="mt-3 block overflow-hidden rounded-lg border border-white/10"
                                                        >
                                                            <img
                                                                src={
                                                                    eruption.image
                                                                }
                                                                alt={`Letusan G. ${eruption.name ?? data.volcano.name}`}
                                                                loading="lazy"
                                                                className="h-40 w-full object-cover transition duration-300 hover:scale-105"
                                                            />
                                                        </a>
                                                    )}
                                                </div>
                                            ),
                                        )}
                                    </div>
                                ) : data.activity?.description ? (
                                    <div className="rounded-xl border border-sky-400/25 border-l-sky-400/80 bg-sky-400/[0.07] px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                                        <p className="flex items-center gap-1.5 text-[9px] font-extrabold tracking-widest text-sky-300 uppercase">
                                            <VolcanoIcon
                                                size={10}
                                                strokeWidth={2.5}
                                            />
                                            Informasi Letusan · MAGMA
                                        </p>

                                        <p className="mt-1.5 text-[13px] font-black text-white">
                                            {isEruptionToday(
                                                data.activity.occurred_at,
                                            ) && 'Hari Ini, '}
                                            {formatWIBLongDate(
                                                data.activity.occurred_at,
                                            )}
                                        </p>

                                        <p className="mt-0.5 text-[13px] font-black text-white">
                                            {data.volcano.name}
                                        </p>

                                        {data.activity.author && (
                                            <p className="mt-1 text-[10.5px] text-slate-400">
                                                Dibuat oleh{' '}
                                                <span className="font-semibold text-slate-300">
                                                    {data.activity.author}
                                                </span>
                                            </p>
                                        )}

                                        <p className="mt-2.5 border-t border-white/10 pt-2 text-[11.5px] leading-relaxed text-slate-200">
                                            {data.activity.description}
                                        </p>

                                        {data.activity.image && (
                                            <a
                                                href={data.activity.image}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="mt-3 block overflow-hidden rounded-lg border border-white/10"
                                            >
                                                <img
                                                    src={data.activity.image}
                                                    alt={`Letusan G. ${data.volcano.name}`}
                                                    loading="lazy"
                                                    className="h-40 w-full object-cover transition duration-300 hover:scale-105"
                                                />
                                            </a>
                                        )}
                                    </div>
                                ) : (
                                    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-4 text-[11.5px] leading-relaxed text-slate-400">
                                        Belum ada laporan letusan terbaru dari
                                        MAGMA.
                                    </div>
                                )}
                            </section>
                        )}

                        {/* STATUS ERUPSI */}

                        {active === 'status' && (
                            <section>
                                <PanelTitle
                                    icon={
                                        <Activity size={11} strokeWidth={2.5} />
                                    }
                                >
                                    Status Erupsi
                                </PanelTitle>

                                <div className="rounded-xl border border-sky-400/25 border-l-sky-400/80 bg-sky-400/[0.07] px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                                    <p className="flex items-center gap-1.5 text-[9px] font-extrabold tracking-widest text-sky-300 uppercase">
                                        <Radio size={10} strokeWidth={2.5} />
                                        Status Erupsi Real-time
                                    </p>

                                    <p className="mt-1.5 text-[13px] font-black text-white">
                                        {statusEruptionText}
                                    </p>

                                    <p className="mt-1 text-[9.5px] text-slate-500">
                                        {statusDataTimeLabel}
                                    </p>
                                </div>

                                <p className="mt-3 text-[9px] font-extrabold tracking-widest text-slate-400 uppercase">
                                    Status Bahaya (GDACS)
                                </p>

                                <div
                                    className={`mt-1 flex items-center gap-2 rounded-xl border px-3 py-2 text-[12.5px] font-extrabold shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ${gdacsBadgeClass}`}
                                >
                                    <span
                                        className="h-2.5 w-2.5 shrink-0 rounded-full shadow-[0_0_10px_currentColor]"
                                        style={{ background: gdacsState.color }}
                                    />

                                    <span>
                                        {gdacsState.label}

                                        {gdacsState.activity && (
                                            <span className="block text-[9px] font-semibold text-slate-500 normal-case">
                                                {gdacsState.activity}
                                            </span>
                                        )}
                                    </span>
                                </div>

                                <p className="mt-3 text-[9px] font-extrabold tracking-widest text-slate-400 uppercase">
                                    Status Resmi PVMBG
                                </p>

                                <div
                                    className={`mt-1 flex items-center gap-2 rounded-xl border px-3 py-2.5 text-[12.5px] font-extrabold shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ${pvmbgClass}`}
                                >
                                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/10">
                                        <ShieldCheck
                                            size={15}
                                            strokeWidth={2.5}
                                        />
                                    </span>

                                    <span>
                                        <span className="block text-[9px] font-extrabold tracking-widest uppercase opacity-70">
                                            Level Resmi PVMBG
                                        </span>
                                        {pvmbgLevelText}
                                    </span>
                                </div>

                                <p className="mt-1 text-[9px] text-slate-500">
                                    {data.volcano.status_source === 'live'
                                        ? 'Sumber: PVMBG (MAGMA) real-time'
                                        : 'status tersimpan (fallback)'}
                                </p>
                            </section>
                        )}

                        {/* TIMELINE SEBARAN */}

                        {active === 'cuaca' && hasTimelineData && (
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
                                            setTimelinePlaying(
                                                (playing) => !playing,
                                            )
                                        }
                                        aria-label={
                                            timelinePlaying ? 'Jeda' : 'Putar'
                                        }
                                        className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-white/5 text-[9px] text-white transition hover:bg-white/10"
                                    >
                                        {timelinePlaying ? (
                                            <Pause
                                                size={11}
                                                strokeWidth={2.5}
                                            />
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

                        {/* PRAKIRAAN CUACA BMKG (PER 3 JAM) */}

                        {active === 'cuaca' && (
                            <section>
                                <PanelTitle
                                    icon={
                                        <CloudSun size={11} strokeWidth={2.5} />
                                    }
                                >
                                    Prakiraan Cuaca BMKG
                                </PanelTitle>

                                <div className="flex items-center gap-2">
                                    <span className="flex h-5 w-5 items-center justify-center rounded-full border border-sky-500/30 bg-sky-500/10">
                                        <MapPin
                                            size={10}
                                            strokeWidth={2.5}
                                            className="text-sky-400"
                                        />
                                    </span>

                                    <p className="truncate text-[11px] font-bold text-white">
                                        {data.weather_location ??
                                            data.volcano.name}
                                    </p>
                                </div>

                                <p className="mt-0.5 text-[9.5px] text-slate-500">
                                    Sumber: BMKG • Prakiraan setiap 3 jam di
                                    sekitar gunung
                                </p>

                                {bmkgCurrent ? (
                                    <>
                                        {(() => {
                                            const { Icon, className } =
                                                bmkgConditionIcon(
                                                    bmkgCurrent.weather,
                                                );

                                            const extras = data.current_weather;

                                            const pressure =
                                                extras?.pressure_msl ?? null;

                                            const gust =
                                                extras?.wind_gust_kmh ?? null;

                                            const feels =
                                                extras?.apparent_temperature_c ??
                                                null;

                                            const hasExtras =
                                                pressure !== null ||
                                                gust !== null ||
                                                feels !== null;

                                            const visibilityValue =
                                                bmkgCurrent.visibility_text ??
                                                (bmkgCurrent.visibility !== null
                                                    ? `${bmkgCurrent.visibility} km`
                                                    : null);

                                            return (
                                                <div className="mt-2.5 rounded-xl border border-sky-400/20 bg-gradient-to-b from-sky-400/10 to-white/[0.03] p-3">
                                                    <div className="flex items-center justify-between">
                                                        <p className="text-[10px] font-extrabold tracking-wide text-sky-300 uppercase">
                                                            Saat ini
                                                        </p>

                                                        <span className="text-[8.5px] text-slate-500">
                                                            Pemutakhiran:{' '}
                                                            {formatWIBShortDate(
                                                                bmkgCurrent.forecast_at,
                                                            )}{' '}
                                                            •{' '}
                                                            {formatWIBTimeHM(
                                                                bmkgCurrent.forecast_at,
                                                            )}{' '}
                                                            WIB
                                                        </span>
                                                    </div>

                                                    <div className="mt-2 flex items-center gap-3">
                                                        <Icon
                                                            size={38}
                                                            strokeWidth={2}
                                                            className={`shrink-0 ${className}`}
                                                        />

                                                        <div>
                                                            <p className="text-[30px] leading-none font-extrabold text-white">
                                                                {bmkgNumber(
                                                                    bmkgCurrent.temperature,
                                                                )}
                                                                °
                                                            </p>

                                                            <p className="mt-1 text-[11px] font-semibold text-slate-300">
                                                                {bmkgCurrent.weather ??
                                                                    '-'}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <p className="mt-1.5 text-[9.5px] text-slate-500">
                                                        di{' '}
                                                        {data.weather_location ??
                                                            data.volcano.name}
                                                    </p>

                                                    <div className="mt-2.5 grid grid-cols-2 gap-1.5">
                                                        <div className="rounded-lg bg-white/5 p-2">
                                                            <p className="text-[8px] tracking-wide text-slate-500 uppercase">
                                                                Kelembapan
                                                            </p>

                                                            <p className="mt-0.5 text-[12px] font-bold text-white">
                                                                {bmkgNumber(
                                                                    bmkgCurrent.humidity,
                                                                )}
                                                                %
                                                            </p>
                                                        </div>

                                                        <div className="rounded-lg bg-white/5 p-2">
                                                            <p className="text-[8px] tracking-wide text-slate-500 uppercase">
                                                                Kecepatan Angin
                                                            </p>

                                                            <p className="mt-0.5 text-[12px] font-bold text-white">
                                                                {bmkgNumber(
                                                                    bmkgCurrent.wind_speed,
                                                                )}{' '}
                                                                km/jam
                                                            </p>
                                                        </div>

                                                        <div className="rounded-lg bg-white/5 p-2">
                                                            <p className="text-[8px] tracking-wide text-slate-500 uppercase">
                                                                Arah Angin dari
                                                            </p>

                                                            <p className="mt-0.5 text-[12px] font-bold text-white">
                                                                {bmkgWindDirectionLabel(
                                                                    bmkgCurrent.wind_direction,
                                                                )}
                                                            </p>
                                                        </div>

                                                        {visibilityValue && (
                                                            <div className="rounded-lg bg-white/5 p-2">
                                                                <p className="text-[8px] tracking-wide text-slate-500 uppercase">
                                                                    Jarak
                                                                    Pandang
                                                                </p>

                                                                <p className="mt-0.5 text-[12px] font-bold text-white">
                                                                    {
                                                                        visibilityValue
                                                                    }
                                                                </p>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {hasExtras && (
                                                        <div className="mt-2 flex items-center justify-between border-t border-white/5 pt-1.5 text-[9px] text-slate-500">
                                                            <span>
                                                                {pressure !==
                                                                null
                                                                    ? `tekanan ${Math.round(pressure)} hPa`
                                                                    : ''}
                                                            </span>

                                                            <span>
                                                                {gust !== null
                                                                    ? `hembusan ${Math.round(gust)} km/jam`
                                                                    : ''}
                                                            </span>

                                                            <span>
                                                                {feels !== null
                                                                    ? `terasa ${Math.round(feels)}°C`
                                                                    : ''}
                                                            </span>
                                                        </div>
                                                    )}

                                                    <p className="mt-1.5 text-[8.5px] leading-relaxed text-slate-600">
                                                        Sumber: BMKG (prakiraan
                                                        resmi) • Prakiraan{' '}
                                                        {data.weather_location ??
                                                            data.volcano.name}
                                                    </p>
                                                </div>
                                            );
                                        })()}
                                    </>
                                ) : data.current_weather ? (
                                    (() => {
                                        const numOrDash = (
                                            value: number | null | undefined,
                                            suffix = '',
                                        ) =>
                                            value != null
                                                ? `${Math.round(value)}${suffix}`
                                                : '-';

                                        const openMeteoWind =
                                            data.current_weather
                                                .wind_direction_cardinal ??
                                            degreesToWindDirection(
                                                data.current_weather
                                                    .wind_direction_deg,
                                            );

                                        return (
                                            <div className="mt-2.5 rounded-xl border border-white/10 bg-white/5 p-3">
                                                <div className="flex items-center justify-between">
                                                    <p className="text-[10px] font-extrabold tracking-wide text-slate-400 uppercase">
                                                        Saat ini (pengukuran
                                                        langsung)
                                                    </p>

                                                    <span className="text-[8.5px] text-slate-500">
                                                        Pemutakhiran:{' '}
                                                        {data.current_weather
                                                            .observed_at
                                                            ? `${formatWIBShortDate(data.current_weather.observed_at)} • ${formatWIBTimeHM(data.current_weather.observed_at)} WIB`
                                                            : '-'}
                                                    </span>
                                                </div>

                                                <div className="mt-2 flex items-center gap-3">
                                                    <Gauge
                                                        size={38}
                                                        strokeWidth={2}
                                                        className="shrink-0 text-slate-400"
                                                    />

                                                    <div>
                                                        <p className="text-[30px] leading-none font-extrabold text-white">
                                                            {numOrDash(
                                                                data
                                                                    .current_weather
                                                                    .temperature_c,
                                                            )}
                                                            °
                                                        </p>

                                                        <p className="mt-1 text-[11px] font-semibold text-slate-300">
                                                            Open-Meteo
                                                            (cadangan)
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="mt-2.5 grid grid-cols-2 gap-1.5">
                                                    <div className="rounded-lg bg-white/5 p-2">
                                                        <p className="text-[8px] tracking-wide text-slate-500 uppercase">
                                                            Kelembapan
                                                        </p>

                                                        <p className="mt-0.5 text-[12px] font-bold text-white">
                                                            {numOrDash(
                                                                data
                                                                    .current_weather
                                                                    .humidity,
                                                                '%',
                                                            )}
                                                        </p>
                                                    </div>

                                                    <div className="rounded-lg bg-white/5 p-2">
                                                        <p className="text-[8px] tracking-wide text-slate-500 uppercase">
                                                            Kecepatan Angin
                                                        </p>

                                                        <p className="mt-0.5 text-[12px] font-bold text-white">
                                                            {numOrDash(
                                                                data
                                                                    .current_weather
                                                                    .wind_speed_kmh,
                                                                ' km/jam',
                                                            )}
                                                        </p>
                                                    </div>

                                                    <div className="rounded-lg bg-white/5 p-2">
                                                        <p className="text-[8px] tracking-wide text-slate-500 uppercase">
                                                            Arah Angin dari
                                                        </p>

                                                        <p className="mt-0.5 text-[12px] font-bold text-white">
                                                            {openMeteoWind ??
                                                                '-'}
                                                        </p>
                                                    </div>

                                                    <div className="rounded-lg bg-white/5 p-2">
                                                        <p className="text-[8px] tracking-wide text-slate-500 uppercase">
                                                            Hembusan Angin
                                                        </p>

                                                        <p className="mt-0.5 text-[12px] font-bold text-white">
                                                            {numOrDash(
                                                                data
                                                                    .current_weather
                                                                    .wind_gust_kmh,
                                                                ' km/jam',
                                                            )}
                                                        </p>
                                                    </div>

                                                    <div className="rounded-lg bg-white/5 p-2">
                                                        <p className="text-[8px] tracking-wide text-slate-500 uppercase">
                                                            Suhu Terasa
                                                        </p>

                                                        <p className="mt-0.5 text-[12px] font-bold text-white">
                                                            {numOrDash(
                                                                data
                                                                    .current_weather
                                                                    .apparent_temperature_c,
                                                                '°',
                                                            )}
                                                        </p>
                                                    </div>

                                                    <div className="rounded-lg bg-white/5 p-2">
                                                        <p className="text-[8px] tracking-wide text-slate-500 uppercase">
                                                            Tekanan Udara
                                                        </p>

                                                        <p className="mt-0.5 text-[12px] font-bold text-white">
                                                            {numOrDash(
                                                                data
                                                                    .current_weather
                                                                    .pressure_msl,
                                                                ' hPa',
                                                            )}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })()
                                ) : (
                                    <p className="mt-2.5 rounded-xl border border-white/10 bg-white/5 p-2.5 text-[11px] leading-relaxed text-slate-500">
                                        Belum ada kondisi cuaca saat ini untuk
                                        wilayah ini.
                                    </p>
                                )}

                                <div className="mt-2.5 flex flex-col gap-3">
                                    {bmkgForecasts.length === 0 ? (
                                        <p className="rounded-xl border border-white/10 bg-white/5 p-2.5 text-[11px] leading-relaxed text-slate-500">
                                            Belum ada prakiraan cuaca BMKG untuk
                                            wilayah ini.
                                        </p>
                                    ) : (
                                        bmkgForecasts.map((day) => (
                                            <div key={day.label}>
                                                <p className="mb-1 flex items-center gap-1.5 text-[9.5px] font-extrabold tracking-wide text-slate-400 uppercase">
                                                    <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
                                                    {day.label}
                                                </p>

                                                <div className="flex flex-col gap-1">
                                                    {day.slots.map((slot) => {
                                                        const {
                                                            Icon,
                                                            className,
                                                        } = bmkgConditionIcon(
                                                            slot.weather,
                                                        );

                                                        return (
                                                            <div
                                                                key={slot.id}
                                                                className="grid grid-cols-[34px_1fr_auto] items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-2 py-1.5"
                                                            >
                                                                <span className="text-[11px] font-extrabold text-white">
                                                                    {formatWIBTimeHM(
                                                                        slot.forecast_at,
                                                                    )}
                                                                </span>

                                                                <span className="flex min-w-0 items-center gap-1.5">
                                                                    <Icon
                                                                        size={
                                                                            13
                                                                        }
                                                                        strokeWidth={
                                                                            2.5
                                                                        }
                                                                        className={`shrink-0 ${className}`}
                                                                    />

                                                                    <span
                                                                        className="truncate text-[10px] text-slate-400"
                                                                        title={
                                                                            slot.weather ??
                                                                            '-'
                                                                        }
                                                                    >
                                                                        {slot.weather ??
                                                                            '-'}
                                                                    </span>
                                                                </span>

                                                                <span className="flex items-center gap-2 text-right">
                                                                    <span className="text-[12px] font-bold text-white">
                                                                        {slot.temperature ??
                                                                            '-'}
                                                                        °
                                                                    </span>

                                                                    <span className="text-[9px] text-sky-400">
                                                                        {slot.humidity ??
                                                                            '-'}
                                                                        %
                                                                    </span>
                                                                </span>

                                                                <span className="col-span-3 flex items-center justify-between border-t border-white/5 pt-1 text-[9px] text-slate-500">
                                                                    <span>
                                                                        angin{' '}
                                                                        <b className="text-slate-400">
                                                                            {slot.wind_speed ??
                                                                                '-'}{' '}
                                                                            km/j
                                                                        </b>
                                                                    </span>

                                                                    <span>
                                                                        arah{' '}
                                                                        <b className="text-slate-400">
                                                                            {slot.wind_direction ??
                                                                                '-'}
                                                                        </b>
                                                                    </span>
                                                                </span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </section>
                        )}

                        {/* ADVISORY ABU VULKANIK */}

                        {active === 'advisory' && (
                            <section>
                                <PanelTitle
                                    icon={<Radio size={11} strokeWidth={2.5} />}
                                >
                                    Advisory Abu Vulkanik
                                </PanelTitle>

                                {(() => {
                                    const ash = data.ash_advisory;

                                    if (!ash) {
                                        return (
                                            <p className="rounded-xl border border-dashed border-white/10 bg-white/5 p-2.5 text-[11px] leading-relaxed text-slate-500">
                                                Belum ada advisory VAAC Darwin
                                                untuk gunung ini dalam 24 jam
                                                terakhir.
                                            </p>
                                        );
                                    }

                                    const detected = ash.ash_detected;

                                    const heightKm =
                                        ash.ash_height_m != null
                                            ? `~${(
                                                  ash.ash_height_m / 1000
                                              ).toFixed(1)} km`
                                            : '-';

                                    const flightLevel =
                                        ash.altitude_ft != null
                                            ? `FL${Math.round(
                                                  ash.altitude_ft / 100,
                                              )}`
                                            : null;

                                    const direction = ash.movement
                                        ? bmkgWindDirectionLabel(ash.movement)
                                        : '-';

                                    const speed =
                                        ash.speed_kts != null
                                            ? `${ash.speed_kts} kt`
                                            : null;

                                    const observed = ash.observed_at
                                        ? formatWIBStamp(ash.observed_at)
                                        : '-';

                                    const nextAdvisory = ash.next_advisory_at
                                        ? formatWIBStamp(ash.next_advisory_at)
                                        : '-';

                                    return (
                                        <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
                                            <div
                                                className={`flex items-start justify-between gap-2 border-b px-3 py-2.5 ${
                                                    detected
                                                        ? 'border-red-500/25 bg-red-500/10'
                                                        : 'border-emerald-500/25 bg-emerald-500/10'
                                                }`}
                                            >
                                                <div>
                                                    <p className="text-[13px] font-black text-white">
                                                        {ash.volcano_name ??
                                                            data.volcano.name}
                                                    </p>

                                                    <p className="mt-0.5 text-[9.5px] tracking-wider text-slate-400 uppercase">
                                                        {ash.source ??
                                                            'VAAC Darwin (BOM)'}{' '}
                                                        — Advisory #
                                                        {ash.advisory_nr ?? '-'}
                                                    </p>
                                                </div>

                                                <span
                                                    className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase ring-1 ${
                                                        detected
                                                            ? 'bg-red-500/15 text-red-300 ring-red-400/30'
                                                            : 'bg-emerald-500/10 text-emerald-300 ring-emerald-400/20'
                                                    }`}
                                                >
                                                    {detected
                                                        ? 'Abu terdeteksi'
                                                        : 'Tidak ada abu'}
                                                </span>
                                            </div>

                                            <div className="mt-2 grid grid-cols-2 gap-1.5 px-3">
                                                {[
                                                    {
                                                        label: 'Tinggi abu',
                                                        value: heightKm,
                                                        sub: flightLevel,
                                                    },
                                                    {
                                                        label: 'Arah & kecepatan',
                                                        value: direction,
                                                        sub: speed,
                                                    },
                                                    {
                                                        label: 'Waktu pengamatan',
                                                        value: observed,
                                                    },
                                                    {
                                                        label: 'Advisory berikutnya',
                                                        value: nextAdvisory,
                                                    },
                                                ].map((stat) => (
                                                    <div
                                                        key={stat.label}
                                                        className="rounded-lg border border-white/5 bg-white/[0.03] px-2.5 py-2"
                                                    >
                                                        <p className="text-[8.5px] font-bold tracking-wider text-slate-500 uppercase">
                                                            {stat.label}
                                                        </p>

                                                        <p className="mt-0.5 text-[11.5px] font-black text-slate-200">
                                                            {stat.value}
                                                        </p>

                                                        {stat.sub && (
                                                            <p className="mt-0.5 text-[9px] text-slate-500">
                                                                {stat.sub}
                                                            </p>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>

                                            <div className="mt-2 flex items-center justify-between gap-2 px-3 pb-1 text-[10px] text-slate-500">
                                                <span>
                                                    Diterbitkan{' '}
                                                    <b className="text-slate-300">
                                                        {formatWIB(
                                                            ash.issued_at,
                                                        )}{' '}
                                                        WIB
                                                    </b>
                                                </span>
                                            </div>

                                            {ash.eruption_detail && (
                                                <div className="mt-1 border-t border-white/5 px-3 py-2">
                                                    <p className="text-[8.5px] font-bold tracking-wider text-slate-500 uppercase">
                                                        Detil erupsi
                                                    </p>

                                                    <p className="mt-0.5 text-[10.5px] leading-relaxed text-slate-300">
                                                        {ash.eruption_detail}
                                                    </p>
                                                </div>
                                            )}

                                            {ash.remarks && (
                                                <div className="border-t border-white/5 px-3 py-2">
                                                    <p className="text-[8.5px] font-bold tracking-wider text-slate-500 uppercase">
                                                        Catatan (RMK)
                                                    </p>

                                                    <p className="mt-0.5 text-[10.5px] leading-relaxed text-slate-400">
                                                        {ash.remarks}
                                                    </p>
                                                </div>
                                            )}

                                            <div className="border-t border-white/10 bg-white/[0.02] px-3 py-2">
                                                <p className="text-[9px] leading-relaxed text-slate-600 italic">
                                                    Sumber:{' '}
                                                    {ash.source ??
                                                        'VAAC Darwin (BOM)'}
                                                    . Gunakan bersama info resmi
                                                    PVMBG / BPBD.
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </section>
                        )}

                        {/* PREDIKSI SEBARAN ABU */}

                        {active === 'cuaca' &&
                            ashActive &&
                            selectedForecast && (
                                <section>
                                    <PanelTitle
                                        icon={
                                            <Navigation
                                                size={11}
                                                strokeWidth={2.5}
                                            />
                                        }
                                    >
                                        Perkiraan Sebaran Abu (Perhitungan
                                        Sistem)
                                    </PanelTitle>

                                    <div className="grid grid-cols-2 gap-1.5">
                                        <div className="rounded-xl border border-white/10 bg-white/5 p-2.5">
                                            <div className="flex items-center gap-1.5 text-slate-500">
                                                <Navigation
                                                    size={11}
                                                    strokeWidth={2.5}
                                                />
                                                <p className="text-[10px]">
                                                    Arah Sebaran
                                                </p>
                                            </div>

                                            <p className="mt-0.5 text-[15px] font-bold text-white">
                                                {selectedForecast.direction !=
                                                null
                                                    ? `${Number(
                                                          selectedForecast.direction,
                                                      ).toFixed(2)}°`
                                                    : '-'}
                                            </p>
                                        </div>

                                        <div className="rounded-xl border border-white/10 bg-white/5 p-2.5">
                                            <div className="flex items-center gap-1.5 text-slate-500">
                                                <Wind
                                                    size={11}
                                                    strokeWidth={2.5}
                                                />
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
                                                <p className="text-[10px]">
                                                    Risiko
                                                </p>
                                            </div>

                                            <p
                                                className={`mt-0.5 text-[15px] font-bold uppercase ${riskClass}`}
                                            >
                                                {selectedForecast.risk_level}
                                            </p>
                                        </div>

                                        <div className="rounded-xl border border-white/10 bg-white/5 p-2.5">
                                            <div className="flex items-center gap-1.5 text-slate-500">
                                                <Gauge
                                                    size={11}
                                                    strokeWidth={2.5}
                                                />
                                                <p className="text-[10px]">
                                                    Confidence
                                                </p>
                                            </div>

                                            <p className="mt-0.5 text-[15px] font-bold text-white">
                                                {selectedForecast.confidence !=
                                                null
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

                        {active === 'gempa' && (
                            <section>
                                <PanelTitle
                                    icon={<Siren size={11} strokeWidth={2.5} />}
                                >
                                    Gempa Terkini (BMKG)
                                </PanelTitle>

                                {selectedGempa && (
                                    <button
                                        type="button"
                                        onClick={() => setSelectedGempa(null)}
                                        className="mb-1.5 flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[9.5px] font-semibold text-slate-400 transition hover:border-sky-500/40 hover:text-white"
                                    >
                                        <ArrowLeft
                                            size={10}
                                            strokeWidth={2.5}
                                        />
                                        Kembali ke gempa terbaru
                                    </button>
                                )}

                                {gempa === null ? (
                                    <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-[11px] text-slate-500">
                                        Memuat data gempa…
                                    </p>
                                ) : displayGempa?.region ? (
                                    <>
                                        <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
                                            {renderGempaCard(displayGempa)}
                                        </div>

                                        {!selectedGempa &&
                                            (gempa?.list.length ?? 0) > 1 && (
                                                <div className="mt-2.5">
                                                    <p className="mb-1 flex items-center gap-1.5 text-[9.5px] font-extrabold tracking-wide text-slate-400 uppercase">
                                                        <Siren
                                                            size={9}
                                                            strokeWidth={2.5}
                                                            className="text-slate-500"
                                                        />
                                                        Gempa terbaru lainnya
                                                    </p>

                                                    <ul className="flex flex-col gap-1">
                                                        {gempa!.list
                                                            .slice(1)
                                                            .map(
                                                                (
                                                                    item,
                                                                    index,
                                                                ) => (
                                                                    <li
                                                                        key={
                                                                            item.eventid ??
                                                                            `gempa-${index}`
                                                                        }
                                                                    >
                                                                        <div className="w-full rounded-lg border border-white/5 bg-white/[0.04] p-2.5 text-left text-[11px]">
                                                                            {renderGempaCard(
                                                                                item,
                                                                            )}
                                                                        </div>
                                                                    </li>
                                                                ),
                                                            )}
                                                    </ul>
                                                </div>
                                            )}
                                    </>
                                ) : (
                                    <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-[11px] text-slate-500">
                                        {gempa.error ??
                                            'Data gempa belum tersedia.'}
                                    </p>
                                )}
                            </section>
                        )}

                        {/* GERAKAN TANAH (PVMBG / VSI) */}

                        {active === 'gerakan' && (
                            <section>
                                <PanelTitle
                                    icon={
                                        <LandPlot size={11} strokeWidth={2.5} />
                                    }
                                >
                                    Gerakan Tanah (PVMBG)
                                </PanelTitle>

                                {gerakanTanah === null ? (
                                    <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-[11px] text-slate-500">
                                        Memuat laporan tanggapan…
                                    </p>
                                ) : gerakanTanah.list.length > 0 ? (
                                    <ul className="space-y-2.5">
                                        {gerakanTanah.list.map(
                                            (item, index) => (
                                                <li
                                                    key={String(
                                                        item.id ??
                                                            item.title ??
                                                            index,
                                                    )}
                                                >
                                                    <a
                                                        href={item.url ?? '#'}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="group block overflow-hidden rounded-xl border border-white/10 bg-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition hover:border-sky-500/30 hover:bg-sky-500/10"
                                                    >
                                                        {item.thumbnail && (
                                                            <div className="relative h-32 overflow-hidden border-b border-white/10">
                                                                <img
                                                                    src={
                                                                        item.thumbnail
                                                                    }
                                                                    alt={
                                                                        item.title ??
                                                                        'Laporan tanggapan VSI'
                                                                    }
                                                                    loading="lazy"
                                                                    className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                                                                />
                                                            </div>
                                                        )}

                                                        <span className="block px-3 py-2.5">
                                                            <span className="flex items-start justify-between gap-2">
                                                                <span className="text-[11px] leading-snug font-semibold text-slate-300 group-hover:text-white">
                                                                    {item.title}
                                                                </span>

                                                                <ExternalLink
                                                                    size={11}
                                                                    strokeWidth={
                                                                        2.5
                                                                    }
                                                                    className="mt-0.5 shrink-0 text-slate-600 group-hover:text-sky-400"
                                                                />
                                                            </span>

                                                            {item.date && (
                                                                <span className="mt-1 block text-[9.5px] font-medium text-slate-600">
                                                                    {formatWIB(
                                                                        item.date,
                                                                    )}
                                                                </span>
                                                            )}
                                                        </span>
                                                    </a>
                                                </li>
                                            ),
                                        )}
                                    </ul>
                                ) : (
                                    <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-[11px] text-slate-500">
                                        {gerakanTanah.error ??
                                            'Belum ada laporan.'}
                                    </p>
                                )}
                            </section>
                        )}

                        {/* META */}

                        {active !== null && active !== 'advisory' && (
                            <div className="border-t border-white/10 pt-2.5 text-[10px] leading-relaxed text-slate-600">
                                <p>
                                    <b className="text-slate-500">Sumber:</b>{' '}
                                    VAAC Darwin (BOM Australia) •
                                    PVMBG/MAGMA-VSI • BMKG
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </aside>

            {/* =====================================
            LEGENDA & LAYER (KANAN)
        ====================================== */}

            <aside className="pointer-events-auto absolute top-[190px] right-2 z-[1100] hidden w-[230px] max-w-[40vw] rounded-2xl border border-white/10 bg-gradient-to-b from-[#111b2e] to-[#0a0f1c] p-3.5 shadow-2xl shadow-black/50 lg:block">
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
            </footer>
        </div>
    );
}
