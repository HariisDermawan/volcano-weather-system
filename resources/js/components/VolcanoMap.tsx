import 'leaflet/dist/leaflet.css';

import { useEffect, useMemo, useRef, useState } from 'react';

import { Maximize2 } from 'lucide-react';

import L from 'leaflet';

import {
    CircleMarker,
    MapContainer,
    Marker,
    Polygon,
    Polyline,
    Popup,
    TileLayer,
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
    onSelectEarthquake?: (quake: EarthquakeMarkerInfo) => void;
    volcanoQuakes?: Record<number, VolcanoQuakeInfo | null>;
}

/*
 * ==========================================
 * WARNA STATUS (seperti MAGMA ESDM)
 * ==========================================
 */

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

/*
 * ==========================================
 * MARKER GUNUNG (ikon segitiga ala MAGMA)
 * ==========================================
 */

function renderVolcanoSvg(color: string): string {
    return `
        <svg xmlns="http://www.w3.org/2000/svg" width="30" height="38" viewBox="0 0 30 38">
            <path d="M15 2 L27 34 L3 34 Z" fill="${color}" stroke="rgba(0,0,0,0.6)" stroke-width="1.5" stroke-linejoin="round"/>
            <path d="M15 10 L24 34 L6 34 Z" fill="rgba(255,255,255,0.16)"/>
            <circle cx="15" cy="12" r="3" fill="rgba(0,0,0,0.35)"/>
        </svg>
    `;
}

/*
 * ==========================================
 * PENANDA GEMPA DEKAT GUNUNG
 *
 * Gunung tetap tampil sebagai segitiga seperti
 * biasa; bila berada dekat gempa terkini (BMKG)
 * ditambah cincin merah berdenyut di belakangnya.
 * ==========================================
 */

function renderQuakeHtml(inner: string): string {
    return `
        <div style="width:44px;height:50px;position:relative;">
            <style>
                .vg-quake-ring{
                    position:absolute;left:5px;top:8px;width:34px;height:34px;
                    border-radius:9999px;
                    border:2px solid rgba(239,68,68,0.9);
                    box-shadow:0 0 14px rgba(239,68,68,0.7);
                    animation:vg-quake-pulse 1.6s ease-out infinite;
                }
                @keyframes vg-quake-pulse{
                    0%{transform:scale(0.55);opacity:1;}
                    70%{transform:scale(1.25);opacity:0;}
                    100%{opacity:0;}
                }
            </style>
            <span class="vg-quake-ring"></span>
            <div style="position:absolute;bottom:0;left:7px;">${inner}</div>
        </div>
    `;
}

/*
 * ==========================================
 * IKON ERUPSI REAL-TIME
 *
 * Level II (Waspada) memakai gn2.gif,
 * selain itu memakai gn.gif.
 * ==========================================
 */

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

/*
 * ==========================================
 * MARKER GEMPABUMI (simpul berdenyut)
 *
 * Simbol klasik episenter: cincin yang memancar
 * ke luar + titik berlabel magnitude. Warna
 * mengikuti skala kekuatan (earthquakeColor).
 * ==========================================
 */

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

    return (
        <Marker
            position={[Number(quake.latitude), Number(quake.longitude)]}
            icon={icon}
            eventHandlers={{ click: () => onSelect?.() }}
        >
            <Popup>
                <strong>Gempa M{quake.magnitude ?? '-'}</strong>
                <br />
                {quake.depth || '-'}
                <br />
                {quake.region ?? '-'}
                {quake.datetime && (
                    <>
                        <br />
                        {new Date(quake.datetime).toLocaleString('id-ID')}
                    </>
                )}
                {quake.felt && (
                    <>
                        <br />
                        <span style={{ color: '#f59e0b' }}>
                            Dirasakan: {quake.felt}
                        </span>
                    </>
                )}
            </Popup>
        </Marker>
    );
}

function VolcanoMarker({
    volcano,
    isSelected,
    active,
    quake,
    onSelect,
}: {
    volcano: VolcanoMarkerInfo;
    isSelected: boolean;
    active: boolean;
    quake?: VolcanoQuakeInfo | null;
    onSelect?: (id: number) => void;
}) {
    const icon = useMemo(() => {
        const size = active || quake ? [44, 50] : [30, 38];

        const eventIcon = active
            ? renderEruptingHtml(eruptingImage(volcano.status))
            : quake
              ? renderQuakeHtml(renderVolcanoSvg(statusColor(volcano.status)))
              : renderVolcanoSvg(statusColor(volcano.status));

        return L.divIcon({
            html: eventIcon,
            className: 'vg-marker',
            iconSize: [size[0], size[1]],
            iconAnchor: [size[0] / 2, size[1] - 2],
            popupAnchor: [0, -(size[1] - 4)],
        });
    }, [volcano.status, isSelected, active, quake]);

    return (
        <Marker
            position={[Number(volcano.latitude), Number(volcano.longitude)]}
            icon={icon}
            zIndexOffset={isSelected ? 1000 : 0}
            eventHandlers={{
                click: () => onSelect?.(volcano.id),
            }}
        >
            <Popup>
                <strong>{volcano.name}</strong>
                <br />
                Status: {volcano.status ?? '-'}
                {quake && (
                    <>
                        <br />
                        <span style={{ color: '#ef4444' }}>
                            Gempa terdekat M{quake.magnitude ?? '-'}
                            {quake.distanceKm != null &&
                                ` • ${quake.distanceKm.toFixed(0)} km`}
                        </span>
                        {quake.region && (
                            <>
                                <br />
                                {quake.region}
                            </>
                        )}
                    </>
                )}
                <br />
                <span style={{ color: '#f97316' }}>Klik untuk pantau →</span>
            </Popup>
        </Marker>
    );
}

/*
 * ==========================================
 * MARKER GEMPABUMI (warna berdasarkan magnitudo)
 * ==========================================
 */

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

/*
 * ==========================================
 * DARK TILES
 *
 * Invert tiles agar serasi dengan tema gelap
 * (sama seperti referensi peta abu).
 * ==========================================
 */

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

/*
 * ==========================================
 * MAP BRIDGE
 *
 * Ekspos instance peta Leaflet ke luar
 * agar overlay (tombol) bisa memakai-nya.
 * ==========================================
 */

function MapBridge({ onMap }: { onMap: (map: L.Map) => void }) {
    const map = useMap();

    useEffect(() => {
        onMap(map);
    }, [map, onMap]);

    return null;
}

/*
 * ==========================================
 * MAP FLY
 *
 * Terbang mengikuti gunung yang dipilih.
 * Melewatkan render pertama supaya view
 * awal tetap seperti yang sudah diatur.
 * ==========================================
 */

function MapFly({ target, zoom }: { target: [number, number]; zoom: number }) {
    const map = useMap();

    const first = useRef(true);

    const [lat, lng] = target;

    useEffect(() => {
        if (first.current) {
            first.current = false;
            return;
        }

        map.flyTo([lat, lng], zoom, { duration: 0.9 });
    }, [map, lat, lng, zoom]);

    return null;
}

/*
 * ==========================================
 * LIVE WAVE
 *
 * Lingkaran dibuat langsung sebagai
 * layer Leaflet sehingga selalu mengikuti
 * koordinat gunung.
 * ==========================================
 */

function LivePulse({ position }: { position: [number, number] }) {
    const map = useMap();

    useEffect(() => {
        const waves: L.Circle[] = [];

        /*
         * Buat 3 gelombang.
         *
         * Setiap gelombang akan menyebar
         * dari titik gunung.
         */
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
                /*
                 * Delay antar gelombang.
                 */
                const delay = (index / waveCount) * duration;

                let progress = (elapsed - delay) / duration;

                /*
                 * Loop animasi.
                 */
                progress = ((progress % 1) + 1) % 1;

                /*
                 * Radius awal sampai akhir.
                 */
                const minRadius = 250;
                const maxRadius = 4500;

                const radius = minRadius + (maxRadius - minRadius) * progress;

                /*
                 * Semakin menyebar,
                 * semakin transparan.
                 */
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

/*
 * ==========================================
 * DESTINATION POINT
 * ==========================================
 */

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

/*
 * ==========================================
 * MAIN MAP
 * ==========================================
 */

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
    volcanoQuakes = {},
    onSelectVolcano,
    onSelectEarthquake,
}: VolcanoMapProps) {
    const position: [number, number] = [Number(latitude), Number(longitude)];

    const [mapInstance, setMapInstance] = useState<L.Map | null>(null);

    const direction = windDirection != null ? Number(windDirection) : null;

    const speed = windSpeed != null ? Number(windSpeed) : null;

    const risk = riskLevel?.toLowerCase() ?? 'low';

    /*
     * ==========================================
     * WARNA PLUME
     * ==========================================
     */

    const plumeColor =
        risk === 'extreme'
            ? '#ef4444'
            : risk === 'high'
              ? '#f97316'
              : risk === 'medium'
                ? '#eab308'
                : '#22c55e';

    const polygonColor = ashColor ?? plumeColor;

    /*
     * ==========================================
     * DEDUPE MARKER GUNUNG
     *
     * Database punya baris ganda per gunung
     * (mis. `Semeru` & `Gunung Semeru` dengan
     * koordinat sama). Kelompokkan per titik dan
     * prioritaskan baris yang sedang erupsi.
     * ==========================================
     */

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

    const toPolygonPositions = (
        geometry: AshGeometry | null | undefined,
    ): [number, number][] =>
        geometry?.type === 'Polygon' && geometry.coordinates?.[0]
            ? geometry.coordinates[0].map(
                  ([lng, lat]) =>
                      [Number(lat), Number(lng)] as [number, number],
              )
            : [];

    /*
     * ==========================================
     * GEOJSON PLUME
     * ==========================================
     */

    const polygonPositions = toPolygonPositions(ashGeometry);

    /*
     * ==========================================
     * ARAH PLUME
     * ==========================================
     */

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

    /*
     * ==========================================
     * KEPALA PANAH
     * ==========================================
     */

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
                center={position}
                zoom={10}
                scrollWheelZoom={true}
                zoomControl={false}
                attributionControl={false}
                style={{
                    height: '100%',
                    width: '100%',
                }}
            >
                <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />

                <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}" />

                <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}" />

                <DarkTiles enabled={dark} />

                <MapBridge onMap={setMapInstance} />

                {/* ==================================
                    SEMUA GUNUNG (IKON ALa MAGMA)
                ================================== */}

                {markerVolcanoes.map((volcano) => (
                    <VolcanoMarker
                        key={volcano.id}
                        volcano={volcano}
                        isSelected={volcano.id === selectedVolcanoId}
                        active={activeVolcanoIds.includes(volcano.id)}
                        quake={volcanoQuakes[volcano.id] ?? null}
                        onSelect={onSelectVolcano}
                    />
                ))}

                {/* ==================================
                    GEMPA TERKINI (BMKG)
                ================================== */}

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

                <MapFly target={position} zoom={10} />

                {/* ==================================
                    LIVE WAVE
                ================================== */}

                <LivePulse position={position} />

                {/* ==================================
                    TITIK GUNUNG
                ================================== */}

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

                {/* ==================================
                    PLUME / SEBARAN ABU
                ================================== */}

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
                                          ? 'Deteksi satelit real-time'
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

                {/* ==================================
                    GARIS ARAH ANGIN
                ================================== */}

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

                {/* ==================================
                    KEPALA PANAH
                ================================== */}

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

            {/* ==================================
                SELURUH GUNUNG (ZOOM KELUAR)
            ================================== */}

            {mapInstance && markerVolcanoes.length > 1 && (
                <button
                    type="button"
                    onClick={() => {
                        const latLngs = markerVolcanoes.map((volcano) =>
                            L.latLng(
                                Number(volcano.latitude),
                                Number(volcano.longitude),
                            ),
                        );

                        mapInstance.fitBounds(
                            L.latLngBounds(latLngs).pad(0.12),
                            {
                                duration: 0.9,
                            },
                        );
                    }}
                    title="Tampilkan semua gunung api"
                    className="absolute bottom-[14px] left-[14px] z-[1000] flex cursor-pointer items-center gap-1.5 rounded-full border border-white/10 bg-[#0d1117] px-3 py-1.5 text-[11px] font-bold text-slate-200 shadow-xl shadow-black/40 transition hover:bg-white/10"
                >
                    <Maximize2 size={12} strokeWidth={2.5} />
                    Seluruh Gunung
                </button>
            )}

            {/* ==================================
                LIVE LABEL
            ================================== */}

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

                    background: 'rgba(15, 23, 42, 0.9)',

                    border: '1px solid rgba(255,255,255,0.12)',

                    color: 'white',

                    fontSize: '12px',

                    fontWeight: 600,

                    pointerEvents: 'none',
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
