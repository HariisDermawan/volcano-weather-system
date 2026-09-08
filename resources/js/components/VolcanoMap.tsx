import 'leaflet/dist/leaflet.css';

import { useEffect } from 'react';
import L from 'leaflet';

import {
    Circle,
    CircleMarker,
    MapContainer,
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

interface VolcanoMapProps {
    latitude?: number;
    longitude?: number;
    ashGeometry?: AshGeometry | null;
    windDirection?: number | null;
    windSpeed?: number | null;
    riskLevel?: string | null;
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

function LivePulse({
    position,
}: {
    position: [number, number];
}) {
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
            const elapsed =
                currentTime - startTime;

            waves.forEach((wave, index) => {
                /*
                 * Delay antar gelombang.
                 */
                const delay =
                    (index / waveCount) *
                    duration;

                let progress =
                    (elapsed - delay) /
                    duration;

                /*
                 * Loop animasi.
                 */
                progress =
                    ((progress % 1) + 1) % 1;

                /*
                 * Radius awal sampai akhir.
                 */
                const minRadius = 250;
                const maxRadius = 4500;

                const radius =
                    minRadius +
                    (maxRadius - minRadius) *
                        progress;

                /*
                 * Semakin menyebar,
                 * semakin transparan.
                 */
                const opacity =
                    0.75 * (1 - progress);

                const fillOpacity =
                    0.10 * (1 - progress);

                wave.setRadius(radius);

                wave.setStyle({
                    opacity,
                    fillOpacity,
                });
            });

            animationFrame =
                requestAnimationFrame(animate);
        };

        animationFrame =
            requestAnimationFrame(animate);

        return () => {
            cancelAnimationFrame(
                animationFrame,
            );

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

    const bearingRad =
        (bearing * Math.PI) / 180;

    const distanceRatio =
        distanceKm / earthRadiusKm;

    const lat2 = Math.asin(
        Math.sin(lat1) *
            Math.cos(distanceRatio) +
            Math.cos(lat1) *
                Math.sin(distanceRatio) *
                Math.cos(bearingRad),
    );

    const lon2 =
        lon1 +
        Math.atan2(
            Math.sin(bearingRad) *
                Math.sin(distanceRatio) *
                Math.cos(lat1),
            Math.cos(distanceRatio) -
                Math.sin(lat1) *
                    Math.sin(lat2),
        );

    return [
        (lat2 * 180) / Math.PI,
        (lon2 * 180) / Math.PI,
    ];
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
}: VolcanoMapProps) {
    const position: [number, number] = [
        Number(latitude),
        Number(longitude),
    ];

    const direction =
        windDirection != null
            ? Number(windDirection)
            : null;

    const speed =
        windSpeed != null
            ? Number(windSpeed)
            : null;

    const risk =
        riskLevel?.toLowerCase() ?? 'low';

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

    /*
     * ==========================================
     * GEOJSON PLUME
     * ==========================================
     */

    const polygonPositions: [number, number][] =
        ashGeometry?.type === 'Polygon' &&
        ashGeometry.coordinates?.[0]
            ? ashGeometry.coordinates[0].map(
                  ([lng, lat]) =>
                      [
                          Number(lat),
                          Number(lng),
                      ] as [number, number],
              )
            : [];

    /*
     * ==========================================
     * ARAH PLUME
     * ==========================================
     */

    let arrowEnd: [number, number] | null =
        null;

    if (
        direction !== null &&
        Number.isFinite(direction)
    ) {
        const distanceKm = Math.max(
            4,
            Math.min(
                25,
                (speed ?? 10) * 0.3,
            ),
        );

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

    let arrowLeft: [number, number] | null =
        null;

    let arrowRight: [number, number] | null =
        null;

    if (
        arrowEnd &&
        direction !== null
    ) {
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

    const directionText =
        direction !== null
            ? `${direction.toFixed(0)}°`
            : '-';

    const speedText =
        speed !== null
            ? `${speed.toFixed(1)} km/h`
            : '-';

    return (
        <div
            style={{
                position: 'relative',
                height: '500px',
                width: '100%',
            }}
        >
            <MapContainer
                center={position}
                zoom={10}
                scrollWheelZoom={true}
                style={{
                    height: '100%',
                    width: '100%',
                }}
            >
                <TileLayer
                    attribution="&copy; OpenStreetMap contributors"
                    url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {/* ==================================
                    LIVE WAVE
                ================================== */}

                <LivePulse
                    position={position}
                />

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
                        <strong>
                            🌋 Gunung Anak Krakatau
                        </strong>

                        <br />

                        Status: Siaga

                        <br />

                        Elevasi: 157 mdpl

                        <br />

                        Latitude: {position[0]}

                        <br />

                        Longitude: {position[1]}

                        <br />

                        <br />

                        <strong>
                            🔴 LIVE MONITORING
                        </strong>
                    </Popup>
                </CircleMarker>

                {/* ==================================
                    PLUME / SEBARAN ABU
                ================================== */}

                {polygonPositions.length > 0 && (
                    <Polygon
                        positions={polygonPositions}
                        pathOptions={{
                            color: plumeColor,
                            fillColor: plumeColor,
                            fillOpacity: 0.18,
                            weight: 1.5,
                            opacity: 0.7,
                        }}
                    >
                        <Popup>
                            <strong>
                                🌫️ Prediksi Sebaran Abu
                            </strong>

                            <br />

                            Arah plume:{' '}
                            {directionText}

                            <br />

                            Kecepatan angin:{' '}
                            {speedText}

                            <br />

                            Risiko:{' '}
                            {riskLevel ?? '-'}
                        </Popup>
                    </Polygon>
                )}

                {/* ==================================
                    GARIS ARAH ANGIN
                ================================== */}

                {arrowEnd && (
                    <Polyline
                        positions={[
                            position,
                            arrowEnd,
                        ]}
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

                {arrowEnd &&
                    arrowLeft && (
                        <Polyline
                            positions={[
                                arrowLeft,
                                arrowEnd,
                            ]}
                            pathOptions={{
                                color: plumeColor,
                                weight: 4,
                                opacity: 0.8,
                            }}
                        />
                    )}

                {arrowEnd &&
                    arrowRight && (
                        <Polyline
                            positions={[
                                arrowRight,
                                arrowEnd,
                            ]}
                            pathOptions={{
                                color: plumeColor,
                                weight: 4,
                                opacity: 0.8,
                            }}
                        />
                    )}
            </MapContainer>

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

                    background:
                        'rgba(15, 23, 42, 0.9)',

                    border:
                        '1px solid rgba(255,255,255,0.12)',

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
                        boxShadow:
                            '0 0 10px rgba(239,68,68,0.9)',
                    }}
                />

                LIVE
            </div>
        </div>
    );
}

