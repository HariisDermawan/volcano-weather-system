import 'leaflet/dist/leaflet.css';

import { useEffect, useMemo, useRef } from 'react';

import L from 'leaflet';

import {
    CircleMarker,
    MapContainer,
    Marker,
    Polygon,
    Polyline,
    Popup,
    TileLayer,
    Tooltip,
    useMap,
} from 'react-leaflet';

interface AshGeometry {
    type: string;
    coordinates: number[][][];
}

interface AshLayerDisplay {
    geometry: AshGeometry | null;
    color: string;
    label: string;
    direction: number | null;
    speed: number | null;
    strokeDashArray?: string | null;
    fillOpacity?: number;
}

interface VolcanoMarkerInfo {
    id: number;
    name: string;
    latitude: number | string;
    longitude: number | string;
    status?: string | null;
    kabupaten?: string | null;
    province?: string | null;
    elevation?: number | string | null;
    periode_text?: string | null;
    lokasi?: string | null;
    visual?: string | null;
    visual_lainnya?: string | null;
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

interface VolcanoMapProps {
    latitude?: number;
    longitude?: number;
    ashGeometry?: AshGeometry | null;
    windDirection?: number | null;
    windSpeed?: number | null;
    riskLevel?: string | null;
    ashLabel?: string;
    ashColor?: string;
    ashLayers?: AshLayerDisplay[];
    height?: string;
    className?: string;
    volcanoName?: string;
    volcanoStatus?: string | null;
    volcanoElevation?: number | null;
    dark?: boolean;
    volcanoes?: VolcanoMarkerInfo[];
    selectedVolcanoId?: number | null;
    activeVolcanoIds?: number[];
    onSelectVolcano?: (id: number) => void;
    earthquakes?: EarthquakeMarkerInfo[];
    selectedQuakeId?: string | null;
    focusKey?: number;
    onSelectEarthquake?: (quake: EarthquakeMarkerInfo) => void;
    volcanoImage?: string | null;
    volcanoImageLoading?: boolean;
    volcanoImageSource?: 'photo' | 'cctv' | 'ven' | null;
    volcanoReport?: {
        lokasi?: string | null;
        periode_text?: string | null;
        visual?: string | null;
        visual_lainnya?: string | null;
    } | null;
    userLocation?: { lat: number; lon: number } | null;
}

function statusColor(status?: string | null): string {
    const value = status?.toLowerCase() ?? '';

    if (value.includes('awas')) {
        return '#ef4444';
    }

    if (value.includes('siaga')) {
        return '#f97316';
    }

    if (value.includes('waspada')) {
        return '#eab308';
    }

    return '#22c55e';
}

function renderVolcanoSvg(color: string): string {
    return `
        <svg xmlns="http://www.w3.org/2000/svg" width="30" height="38" viewBox="0 0 30 38">
            <path d="M15 2 L27 34 L3 34 Z" fill="${color}" stroke="rgba(0,0,0,0.6)" stroke-width="1.5" stroke-linejoin="round"/>
            <path d="M15 10 L24 34 L6 34 Z" fill="rgba(255,255,255,0.16)"/>
            <circle cx="15" cy="12" r="3" fill="rgba(0,0,0,0.35)"/>
        </svg>
    `;
}

function eruptingImage(status?: string | null): string {
    return (status?.toLowerCase() ?? '').includes('waspada')
        ? '/icons/gn2.gif'
        : '/icons/gn.gif';
}

function renderEruptingHtml(src: string): string {
    return `
        <div style="width:44px;height:44px;display:flex;align-items:center;justify-content:center;">
            <img src="${src}" alt="Erupsi" width="36" height="36" style="object-fit:contain;filter:drop-shadow(0 2px 6px rgba(0,0,0,0.6));" />
        </div>
    `;
}

function earthquakeHtml(
    magnitude: number | null,
    color: string,
    selected: boolean,
): string {
    const label = magnitude !== null ? `M${magnitude.toFixed(1)}` : 'M?';

    return `
        <div style="width:44px;height:44px;position:relative;">
            <style>
                .vg-eq-ring{
                    position:absolute;inset:0;border-radius:9999px;border:2px solid ${color};
                    box-shadow:0 0 14px ${color}99, inset 0 0 10px ${color}44;
                    animation:vg-eq-pulse 1.8s ease-out infinite;
                }
                .vg-eq-core{
                    position:absolute;inset:13px;border-radius:9999px;
                    background:${color}30;border:2px solid ${color};
                    display:flex;align-items:center;justify-content:center;
                }
                .vg-eq-core--selected{
                    border-color:#ffffff;
                    background:${color}66;
                    box-shadow:0 0 0 2px rgba(255,255,255,.9), 0 0 16px ${color};
                }
                .vg-eq-mag{
                    font:700 9.5px/1 system-ui;color:#fff;
                    text-shadow:0 0 5px rgba(0,0,0,.9);
                }
                @keyframes vg-eq-pulse{
                    0%{transform:scale(.45);opacity:1}
                    70%{transform:scale(1.55);opacity:0}
                    100%{opacity:0}
                }
            </style>
            <span class="vg-eq-ring"></span>
            <span class="vg-eq-core${selected ? ' vg-eq-core--selected' : ''}"><span class="vg-eq-mag">${label}</span></span>
        </div>
    `;
}

function UserLocationMarker({ position }: { position: [number, number] }) {
    const icon = useMemo(
        () =>
            L.divIcon({
                className: '',
                html: `<div class="vg-user-loc-wrap"><span class="vg-user-loc-ring"></span><span class="vg-user-loc-ring vg-user-loc-ring-2"></span><svg class="vg-user-loc-pin" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" fill="#7dd3fc" stroke="#ffffff" stroke-width="1.8" stroke-linejoin="round"/><circle cx="12" cy="10" r="3" fill="#131c30"/></svg></div>`,
                iconSize: [34, 38],
                iconAnchor: [17, 31],
            }),
        [],
    );

    return (
        <Marker position={position} icon={icon} zIndexOffset={2000}>
            <Tooltip
                permanent
                direction="top"
                offset={[0, -18]}
                className="vg-user-loc-tooltip"
            >
                Lokasi Saya
            </Tooltip>
        </Marker>
    );
}

function EarthquakeMarker({
    quake,
    selected,
    onSelect,
}: {
    quake: EarthquakeMarkerInfo;
    selected?: boolean;
    onSelect?: () => void;
}) {
    const color = earthquakeColor(quake.magnitude);

    const markerLat = Number(quake.latitude);
    const markerLng = Number(quake.longitude);

    const icon = useMemo(
        () =>
            L.divIcon({
                className: 'vg-eq-icon',
                html: earthquakeHtml(quake.magnitude, color, selected ?? false),
                iconSize: [44, 44],
                iconAnchor: [22, 22],
                popupAnchor: [-2, -18],
            }),
        [color, quake.magnitude, selected],
    );

    if (
        quake.latitude == null ||
        quake.longitude == null ||
        !Number.isFinite(markerLat) ||
        !Number.isFinite(markerLng)
    ) {
        return null;
    }

    const formatWIBDate = (dateStr: string) => {
        const date = new Date(dateStr.replace(' ', 'T'));

        if (Number.isNaN(date.getTime())) {
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
        }).formatToParts(date);

        const pick = (type: string) =>
            parts.find((part) => part.type === type)?.value ?? '';

        return `${pick('day')} ${pick('month')} ${pick('year')} • ${pick('hour')}.${pick('minute')}.${pick('second')} WIB`;
    };

    const formatMagnitude = (mag: number | null) => {
        if (mag === null) return '-';

        return Number(mag).toFixed(1).replace('.', ',');
    };

    const formatDepth = (depth: string | null) => {
        if (!depth) return '-';

        return depth.replace('.', ',').trim();
    };

    return (
        <Marker
            position={[markerLat, markerLng]}
            icon={icon}
            eventHandlers={{ click: () => onSelect?.() }}
        >
            <Popup>
                <div className="p-1">
                    {quake.datetime && (
                        <p className="mb-2 text-[11px] font-semibold text-slate-400">
                            {formatWIBDate(quake.datetime)}
                        </p>
                    )}

                    <p className="mb-3 text-[12px] font-bold text-white">
                        {quake.region ?? '-'}
                    </p>

                    <dl className="space-y-1.5 text-[11px]">
                        <div className="flex items-center justify-between border-b border-white/5 pb-1.5">
                            <dt className="font-semibold text-slate-500">
                                Magnitudo
                            </dt>
                            <dd className="font-black" style={{ color }}>
                                {formatMagnitude(quake.magnitude)}
                            </dd>
                        </div>

                        <div className="flex items-center justify-between border-b border-white/5 pb-1.5">
                            <dt className="font-semibold text-slate-500">
                                Kedalaman
                            </dt>
                            <dd className="font-semibold text-slate-300">
                                {formatDepth(quake.depth)}
                            </dd>
                        </div>

                        <div className="flex items-center justify-between">
                            <dt className="font-semibold text-slate-500">
                                Lokasi
                            </dt>
                            <dd className="text-right font-semibold text-slate-300">
                                {quake.latitude && quake.longitude
                                    ? `${Math.abs(quake.latitude).toFixed(2)}° ${quake.latitude >= 0 ? 'LS' : 'LU'} - ${Math.abs(quake.longitude).toFixed(2)}° ${quake.longitude >= 0 ? 'BT' : 'BB'}`
                                    : '-'}
                            </dd>
                        </div>
                    </dl>

                    {quake.felt && (
                        <p className="mt-2 rounded-md bg-amber-500/10 px-2 py-1 text-[10px] font-semibold text-amber-300">
                            Dirasakan: {quake.felt}
                        </p>
                    )}
                </div>
            </Popup>
        </Marker>
    );
}

function VolcanoMarker({
    volcano,
    isSelected,
    active,
    image,
    imageLoading,
    imageSource,
    onSelect,
}: {
    volcano: VolcanoMarkerInfo;
    isSelected: boolean;
    active: boolean;
    image?: string | null;
    imageLoading?: boolean;
    imageSource?: 'photo' | 'cctv' | 'ven' | null;
    onSelect?: (id: number) => void;
}) {
    const icon = useMemo(() => {
        const size = active ? [44, 50] : [30, 38];

        const eventIcon = active
            ? renderEruptingHtml(eruptingImage(volcano.status))
            : renderVolcanoSvg(statusColor(volcano.status));

        return L.divIcon({
            html: eventIcon,
            className: 'vg-marker',
            iconSize: [size[0], size[1]],
            iconAnchor: [size[0] / 2, size[1] - 2],
            popupAnchor: [0, -(size[1] - 4)],
        });
    }, [volcano.status, isSelected, active]);

    return (
        <Marker
            position={[Number(volcano.latitude), Number(volcano.longitude)]}
            icon={icon}
            zIndexOffset={isSelected ? 1000 : 0}
            eventHandlers={{
                click: () => onSelect?.(volcano.id),
            }}
        >
            <Tooltip
                direction="top"
                offset={[0, -10]}
                opacity={1}
                className="volcano-map-tooltip"
            >
                <strong style={{ fontSize: 12.5, color: '#f1f5f9' }}>
                    {volcano.name}
                </strong>
                {volcano.elevation != null && (
                    <div style={{ fontSize: 11.5, color: '#94a3b8' }}>
                        Ketinggian {volcano.elevation} mdpl
                    </div>
                )}
            </Tooltip>
            <Popup>
                <div style={{ width: 268 }}>
                    {image ? (
                        <img
                            src={image}
                            alt={volcano.name}
                            style={{
                                width: '100%',
                                height: 150,
                                objectFit: 'cover',
                                borderRadius: 10,
                                display: 'block',
                                marginBottom: 2,
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                            }}
                        />
                    ) : (
                        <div
                            style={{
                                width: '100%',
                                height: 150,
                                borderRadius: 10,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 6,
                                background:
                                    'linear-gradient(160deg, #1e2c4c, #131c30)',
                                border: '1px dashed rgba(255, 255, 255, 0.16)',
                                marginBottom: 2,
                                color: '#7e8ba1',
                            }}
                        >
                            <svg
                                width="34"
                                height="34"
                                viewBox="0 0 34 34"
                                fill="none"
                            >
                                <path
                                    d="M17 4 L30 30 L4 30 Z"
                                    fill="#1c2a45"
                                    stroke="#3b4a68"
                                    strokeWidth="1.5"
                                    strokeLinejoin="round"
                                />
                                <path
                                    d="M17 10 L26 30 L8 30 Z"
                                    fill="#131f35"
                                />
                                <circle
                                    cx="17"
                                    cy="12"
                                    r="2.5"
                                    fill="#f59e0b"
                                    opacity="0.9"
                                />
                            </svg>
                            <span style={{ fontSize: 11.5 }}>
                                {imageLoading
                                    ? 'Memuat foto…'
                                    : 'Foto tidak tersedia'}
                            </span>
                        </div>
                    )}
                    {image && (
                        <div
                            style={{
                                textAlign: 'right',
                                fontSize: 10.5,
                                color: '#64748b',
                                marginBottom: 8,
                            }}
                        >
                            {imageSource === 'cctv'
                                ? 'Kamera PVMBG'
                                : imageSource === 'ven' ||
                                    imageSource === 'photo'
                                  ? 'Foto visual PVMBG'
                                  : null}
                        </div>
                    )}
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 10,
                            borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
                            paddingBottom: 8,
                            marginBottom: 8,
                        }}
                    >
                        <strong
                            style={{
                                fontSize: '1.05em',
                                letterSpacing: 0.2,
                                flex: 1,
                            }}
                        >
                            {volcano.name}
                        </strong>
                        {volcano.status && (
                            <span
                                style={{
                                    display: 'inline-block',
                                    padding: '1px 9px',
                                    borderRadius: 999,
                                    fontSize: 11,
                                    fontWeight: 700,
                                    color: '#0b1220',
                                    background: statusColor(volcano.status),
                                    whiteSpace: 'nowrap',
                                    textAlign: 'right',
                                }}
                            >
                                {volcano.status}
                            </span>
                        )}
                    </div>
                    {(volcano.kabupaten || volcano.province) && (
                        <>
                            <div
                                style={{
                                    fontSize: 11,
                                    fontWeight: 700,
                                    textTransform: 'uppercase',
                                    letterSpacing: 0.6,
                                    color: '#94a3b8',
                                    marginBottom: 2,
                                }}
                            >
                                Lokasi Administratif dan Geografis
                            </div>
                            <p
                                style={{
                                    margin: '2px 0 9px',
                                    fontSize: 12.5,
                                    lineHeight: 1.55,
                                    color: '#cfd7e5',
                                }}
                            >
                                {volcano.lokasi ??
                                    `Terletak di Kab\\Kota ${volcano.kabupaten ?? '-'}, ${
                                        volcano.province ?? '-'
                                    } dengan posisi geografis di Latitude ${Number(
                                        volcano.latitude,
                                    )}°LU, Longitude ${Number(
                                        volcano.longitude,
                                    )}°BT dan memiliki ketinggian ${
                                        volcano.elevation != null
                                            ? volcano.elevation
                                            : '-'
                                    } mdpl`}
                            </p>
                        </>
                    )}
                    <div
                        style={{
                            fontSize: 11,
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: 0.6,
                            color: '#94a3b8',
                            marginBottom: 2,
                        }}
                    >
                        Periode Pengamatan
                    </div>
                    <p
                        style={{
                            margin: '2px 0 8px',
                            fontSize: 12.5,
                            lineHeight: 1.55,
                            color: '#cfd7e5',
                        }}
                    >
                        {volcano.periode_text ? (
                            <>{volcano.periode_text}</>
                        ) : (
                            'Tidak ada laporan pengamatan terbaru.'
                        )}
                    </p>
                    {(volcano.visual || volcano.visual_lainnya) && (
                        <>
                            <div
                                style={{
                                    fontSize: 11,
                                    fontWeight: 700,
                                    textTransform: 'uppercase',
                                    letterSpacing: 0.6,
                                    color: '#94a3b8',
                                    marginBottom: 2,
                                }}
                            >
                                Pengamatan Visual
                            </div>
                            <p
                                style={{
                                    margin: '2px 0 9px',
                                    fontSize: 12.5,
                                    lineHeight: 1.55,
                                    color: '#cfd7e5',
                                }}
                            >
                                {volcano.visual}
                                {volcano.visual_lainnya &&
                                    volcano.visual_lainnya !== 'null' &&
                                    volcano.visual_lainnya !== 'Nihil' &&
                                    volcano.visual_lainnya.toLowerCase() !==
                                        'nihil' && (
                                        <span>
                                            <br />
                                            {volcano.visual_lainnya}
                                        </span>
                                    )}
                            </p>
                        </>
                    )}
                </div>
            </Popup>
        </Marker>
    );
}

function earthquakeColor(magnitude: number | null): string {
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
}

function DarkTiles({ enabled }: { enabled: boolean }) {
    const map = useMap();

    useEffect(() => {
        map.whenReady(() => {
            const pane = map
                .getContainer()
                .querySelector<HTMLElement>('.leaflet-tile-pane');

            if (pane) {
                pane.style.filter = enabled
                    ? 'invert(1) hue-rotate(180deg) brightness(0.8) contrast(0.95) saturate(1.1)'
                    : '';
            }
        });
    }, [map, enabled]);

    return null;
}

function MapFly({
    target,
    zoom,
    fit,
    fitKey,
    focusKey = 0,
    quakeFocus = null,
    quakeFocusKey = null,
}: {
    target: [number, number];
    zoom: number;
    fit?: Array<[number, number]>;
    fitKey?: string;
    focusKey?: number;
    quakeFocus?: [number, number] | null;
    quakeFocusKey?: string | null;
}) {
    const map = useMap();

    const [lat, lng] = target;

    const fitRef = useRef(fit);
    fitRef.current = fit;

    const prev = useRef({
        lat,
        lng,
        focusKey,
        fitKey: '',
        quakeFocusKey: null as string | null,
    });

    const first = useRef(true);

    const focusedRef = useRef(false);

    useEffect(() => {
        if (first.current) {
            first.current = false;
            return;
        }

        const before = prev.current;

        const posChanged = before.lat !== lat || before.lng !== lng;

        const focusChanged = before.focusKey !== focusKey;

        const fitChanged = before.fitKey !== (fitKey ?? '');

        const quakeFocusChanged = before.quakeFocusKey !== quakeFocusKey;

        prev.current = {
            lat,
            lng,
            focusKey,
            fitKey: fitKey ?? '',
            quakeFocusKey: quakeFocusKey ?? null,
        };

        if (quakeFocusChanged && quakeFocus) {
            focusedRef.current = true;
            map.flyTo(quakeFocus, 8, { duration: 0.9 });

            return;
        }

        if (posChanged || focusChanged) {
            focusedRef.current = true;
            map.flyTo([lat, lng], zoom, { duration: 0.9 });

            return;
        }

        if (fitChanged && !focusedRef.current) {
            const currentFit = fitRef.current;

            if (currentFit && currentFit.length > 0) {
                map.flyToBounds(L.latLngBounds([[lat, lng], ...currentFit]), {
                    padding: [60, 60],
                    maxZoom: 10,
                    duration: 0.9,
                });
            }
        }
    }, [map, lat, lng, zoom, fitKey, focusKey, quakeFocusKey, quakeFocus]);

    return null;
}

function LivePulse({ position }: { position: [number, number] }) {
    const map = useMap();

    useEffect(() => {
        const waves: L.Circle[] = [];

        const waveCount = 3;

        for (let i = 0; i < waveCount; i++) {
            const wave = L.circle(position, {
                radius: 300,
                color: '#ef4444',
                weight: 2,
                opacity: 0.75,
                fillColor: '#ef4444',
                fillOpacity: 0.08,
                interactive: false,
            });

            wave.addTo(map);

            waves.push(wave);
        }

        let animationFrame: number;

        const startTime = performance.now();

        const duration = 2400;

        const animate = (currentTime: number) => {
            const elapsed = currentTime - startTime;

            waves.forEach((wave, index) => {
                const delay = (index / waveCount) * duration;

                let progress = (elapsed - delay) / duration;

                progress = ((progress % 1) + 1) % 1;

                const minRadius = 250;
                const maxRadius = 4500;

                const radius = minRadius + (maxRadius - minRadius) * progress;

                const opacity = 0.75 * (1 - progress);

                const fillOpacity = 0.1 * (1 - progress);

                wave.setRadius(radius);

                wave.setStyle({
                    opacity,
                    fillOpacity,
                });
            });

            animationFrame = requestAnimationFrame(animate);
        };

        animationFrame = requestAnimationFrame(animate);

        return () => {
            cancelAnimationFrame(animationFrame);

            waves.forEach((wave) => {
                map.removeLayer(wave);
            });
        };
    }, [map, position]);

    return null;
}

function destinationPoint(
    latitude: number,
    longitude: number,
    bearing: number,
    distanceKm: number,
): [number, number] {
    const earthRadiusKm = 6371;

    const lat1 = (latitude * Math.PI) / 180;
    const lon1 = (longitude * Math.PI) / 180;

    const bearingRad = (bearing * Math.PI) / 180;

    const distanceRatio = distanceKm / earthRadiusKm;

    const lat2 = Math.asin(
        Math.sin(lat1) * Math.cos(distanceRatio) +
            Math.cos(lat1) * Math.sin(distanceRatio) * Math.cos(bearingRad),
    );

    const lon2 =
        lon1 +
        Math.atan2(
            Math.sin(bearingRad) * Math.sin(distanceRatio) * Math.cos(lat1),
            Math.cos(distanceRatio) - Math.sin(lat1) * Math.sin(lat2),
        );

    return [(lat2 * 180) / Math.PI, (lon2 * 180) / Math.PI];
}

export default function VolcanoMap({
    latitude = -6.102,
    longitude = 105.423,
    ashGeometry = null,
    windDirection = null,
    windSpeed = null,
    riskLevel = null,
    ashLabel,
    ashColor,
    ashLayers = [],
    height = '500px',
    className,
    volcanoName,
    volcanoStatus,
    volcanoElevation,
    dark = false,
    volcanoes = [],
    selectedVolcanoId = null,
    activeVolcanoIds = [],
    earthquakes = [],
    selectedQuakeId = null,
    focusKey = 0,
    volcanoImage = null,
    volcanoImageLoading = false,
    volcanoImageSource = null,
    volcanoReport = null,
    userLocation = null,
    onSelectVolcano,
    onSelectEarthquake,
}: VolcanoMapProps) {
    const position = useMemo<[number, number]>(
        () => [Number(latitude), Number(longitude)],
        [latitude, longitude],
    );

    const direction = windDirection != null ? Number(windDirection) : null;

    const speed = windSpeed != null ? Number(windSpeed) : null;

    const risk = riskLevel?.toLowerCase() ?? 'low';

    const fitQuakes = useMemo(
        () =>
            (earthquakes ?? [])
                .map(
                    (quake) =>
                        [Number(quake.latitude), Number(quake.longitude)] as [
                            number,
                            number,
                        ],
                )
                .filter(
                    ([lat, lng]) => !Number.isNaN(lat) && !Number.isNaN(lng),
                ),
        [earthquakes],
    );

    const fitKey = fitQuakes.map((point) => point.join(',')).join('|');

    const plumeColor =
        risk === 'extreme'
            ? '#ef4444'
            : risk === 'high'
              ? '#f97316'
              : risk === 'medium'
                ? '#eab308'
                : '#22c55e';

    const polygonColor = ashColor ?? plumeColor;

    const markerVolcanoes = useMemo(() => {
        const groups = new Map<string, VolcanoMarkerInfo>();

        for (const volcano of volcanoes) {
            const key = `${Number(volcano.latitude).toFixed(4)}-${Number(
                volcano.longitude,
            ).toFixed(4)}`;

            const existing = groups.get(key);

            const isActive = activeVolcanoIds.includes(volcano.id);

            const existingActive = existing
                ? activeVolcanoIds.includes(existing.id)
                : false;

            if (!existing || (isActive && !existingActive)) {
                groups.set(key, volcano);
            }
        }

        return [...groups.values()];
    }, [volcanoes, activeVolcanoIds]);

    const selectedVolcano = useMemo(
        () => markerVolcanoes.find((v) => v.id === selectedVolcanoId) ?? null,
        [markerVolcanoes, selectedVolcanoId],
    );

    const selectedQuake = useMemo(
        () =>
            (earthquakes ?? []).find((quake) => quake.id === selectedQuakeId) ??
            null,
        [earthquakes, selectedQuakeId],
    );

    const quakeFocus = useMemo<[number, number] | null>(
        () =>
            selectedQuake
                ? [
                      Number(selectedQuake.latitude),
                      Number(selectedQuake.longitude),
                  ]
                : null,
        [selectedQuake],
    );

    const flyTarget: [number, number] = selectedVolcano
        ? [Number(selectedVolcano.latitude), Number(selectedVolcano.longitude)]
        : position;

    const toPolygonPositions = (
        geometry: AshGeometry | null | undefined,
    ): [number, number][] =>
        geometry?.type === 'Polygon' && geometry.coordinates?.[0]
            ? geometry.coordinates[0].map(
                  ([lng, lat]) =>
                      [Number(lat), Number(lng)] as [number, number],
              )
            : [];

    const polygonPositions = toPolygonPositions(ashGeometry);

    let arrowEnd: [number, number] | null = null;

    if (direction !== null && Number.isFinite(direction)) {
        const distanceKm = Math.max(4, Math.min(25, (speed ?? 10) * 0.3));

        arrowEnd = destinationPoint(
            position[0],
            position[1],
            direction,
            distanceKm,
        );
    }

    let arrowLeft: [number, number] | null = null;

    let arrowRight: [number, number] | null = null;

    if (arrowEnd && direction !== null) {
        arrowLeft = destinationPoint(
            arrowEnd[0],
            arrowEnd[1],
            direction + 150,
            1.5,
        );

        arrowRight = destinationPoint(
            arrowEnd[0],
            arrowEnd[1],
            direction - 150,
            1.5,
        );
    }

    const directionText = direction !== null ? `${direction.toFixed(0)}°` : '-';

    const speedText = speed !== null ? `${speed.toFixed(1)} km/h` : '-';

    return (
        <div
            className={className}
            style={{
                position: 'relative',
                height,
                width: '100%',
            }}
        >
            <MapContainer
                center={[position[0] + 0.05, position[1]]}
                zoom={10}
                minZoom={5}
                scrollWheelZoom={true}
                zoomControl={false}
                attributionControl={false}
                maxBounds={[
                    [-21.41, 73.65],
                    [14.3069694978258, 170],
                ]}
                maxBoundsViscosity={1}
                style={{
                    height: '100%',
                    width: '100%',
                }}
            >
                <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />

                <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}" />

                <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}" />

                <DarkTiles enabled={dark} />

                {}

                {markerVolcanoes.map((volcano) => {
                    const report =
                        volcano.id === selectedVolcanoId && volcanoReport
                            ? volcanoReport
                            : null;

                    return (
                        <VolcanoMarker
                            key={volcano.id}
                            volcano={
                                report ? { ...volcano, ...report } : volcano
                            }
                            isSelected={volcano.id === selectedVolcanoId}
                            active={activeVolcanoIds.includes(volcano.id)}
                            image={
                                volcano.id === selectedVolcanoId
                                    ? volcanoImage
                                    : null
                            }
                            imageLoading={
                                volcano.id === selectedVolcanoId &&
                                volcanoImageLoading
                            }
                            imageSource={
                                volcano.id === selectedVolcanoId
                                    ? volcanoImageSource
                                    : null
                            }
                            onSelect={onSelectVolcano}
                        />
                    );
                })}

                {}

                {userLocation && (
                    <UserLocationMarker
                        position={[
                            Number(userLocation.lat),
                            Number(userLocation.lon),
                        ]}
                    />
                )}

                {}

                {(earthquakes ?? []).map((quake) => (
                    <EarthquakeMarker
                        key={quake.id}
                        quake={quake}
                        selected={
                            selectedQuakeId != null &&
                            selectedQuakeId === quake.id
                        }
                        onSelect={() => onSelectEarthquake?.(quake)}
                    />
                ))}

                <MapFly
                    target={flyTarget}
                    zoom={10}
                    fit={fitQuakes}
                    fitKey={fitKey}
                    focusKey={focusKey}
                    quakeFocus={quakeFocus}
                    quakeFocusKey={selectedQuakeId}
                />

                {}

                <LivePulse position={position} />

                {}

                <CircleMarker
                    center={position}
                    radius={8}
                    pathOptions={{
                        color: '#ffffff',
                        fillColor: '#ef4444',
                        fillOpacity: 1,
                        weight: 3,
                    }}
                >
                    <Popup>
                        <strong>{volcanoName ?? 'Gunung Anak Krakatau'}</strong>
                        <br />
                        Status: {volcanoStatus ?? 'Siaga'}
                        <br />
                        Elevasi:{' '}
                        {volcanoElevation != null
                            ? `${volcanoElevation} mdpl`
                            : '157 mdpl'}
                        <br />
                        Latitude: {position[0]}
                        <br />
                        Longitude: {position[1]}
                        <br />
                        <br />
                        <strong>LIVE MONITORING</strong>
                    </Popup>
                </CircleMarker>

                {}

                {ashLayers.length > 0
                    ? ashLayers.map((layer, layerIndex) => {
                          const layerPositions = toPolygonPositions(
                              layer.geometry,
                          );

                          if (layerPositions.length === 0) {
                              return null;
                          }

                          const layerDirectionText =
                              layer.direction != null &&
                              Number.isFinite(layer.direction)
                                  ? `${layer.direction.toFixed(0)}°`
                                  : '-';

                          const layerSpeedText =
                              layer.speed != null &&
                              Number.isFinite(layer.speed)
                                  ? `${layer.speed.toFixed(1)} km/h`
                                  : '-';

                          return (
                              <Polygon
                                  key={`${layer.label}-${layerIndex}`}
                                  positions={layerPositions}
                                  pathOptions={{
                                      color: layer.color,
                                      fillColor: layer.color,
                                      fillOpacity: layer.fillOpacity ?? 0.12,
                                      weight: 1.5,
                                      opacity: 0.85,
                                      dashArray:
                                          layer.strokeDashArray ?? undefined,
                                  }}
                              >
                                  <Popup>
                                      <strong>{layer.label}</strong>
                                      <br />
                                      Arah: {layerDirectionText}
                                      <br />
                                      Kecepatan angin: {layerSpeedText}
                                      <br />
                                      {layer.label.includes('VAAC')
                                          ? 'Deteksi satelit'
                                          : `Risiko: ${riskLevel ?? '-'}`}
                                  </Popup>
                              </Polygon>
                          );
                      })
                    : polygonPositions.length > 0 && (
                          <Polygon
                              positions={polygonPositions}
                              pathOptions={{
                                  color: polygonColor,
                                  fillColor: polygonColor,
                                  fillOpacity: 0.18,
                                  weight: 1.5,
                                  opacity: 0.7,
                              }}
                          >
                              <Popup>
                                  <strong>
                                      {ashLabel ?? 'Prediksi Sebaran Abu'}
                                  </strong>
                                  <br />
                                  Arah: {directionText}
                                  <br />
                                  Kecepatan angin: {speedText}
                                  <br />
                                  {ashLabel
                                      ? 'Deteksi satelit real-time'
                                      : `Risiko: ${riskLevel ?? '-'}`}
                              </Popup>
                          </Polygon>
                      )}

                {}

                {arrowEnd && (
                    <Polyline
                        positions={[position, arrowEnd]}
                        pathOptions={{
                            color: plumeColor,
                            weight: 3,
                            opacity: 0.65,
                            dashArray: '8 10',
                        }}
                    />
                )}

                {}

                {arrowEnd && arrowLeft && (
                    <Polyline
                        positions={[arrowLeft, arrowEnd]}
                        pathOptions={{
                            color: plumeColor,
                            weight: 4,
                            opacity: 0.8,
                        }}
                    />
                )}

                {arrowEnd && arrowRight && (
                    <Polyline
                        positions={[arrowRight, arrowEnd]}
                        pathOptions={{
                            color: plumeColor,
                            weight: 4,
                            opacity: 0.8,
                        }}
                    />
                )}
            </MapContainer>

            {}

            <div
                style={{
                    position: 'absolute',
                    top: '15px',
                    left: '15px',
                    zIndex: 1000,

                    display: 'flex',
                    alignItems: 'center',
                    gap: '7px',

                    padding: '7px 12px',

                    borderRadius: '999px',

                    background:
                        'linear-gradient(to bottom, rgba(17,27,46,0.95), rgba(10,15,28,0.95))',

                    border: '1px solid rgba(255,255,255,0.12)',

                    color: 'white',

                    fontSize: '12px',

                    fontWeight: 600,

                    backdropFilter: 'blur(24px)',
                    WebkitBackdropFilter: 'blur(24px)',

                    pointerEvents: 'none',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                }}
            >
                <span
                    style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: '#ef4444',
                        boxShadow: '0 0 10px rgba(239,68,68,0.9)',
                    }}
                />
                LIVE
            </div>
        </div>
    );
}
