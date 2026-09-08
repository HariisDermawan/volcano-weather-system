import math

EARTH_RADIUS_KM = 6371.0


def destination_point(
    latitude: float,
    longitude: float,
    bearing: float,
    distance_km: float,
):
    """
    Menghitung titik tujuan berdasarkan:
    - koordinat awal
    - bearing dalam derajat
    - jarak dalam kilometer
    """

    lat1 = math.radians(latitude)
    lon1 = math.radians(longitude)
    bearing_rad = math.radians(bearing)

    distance_ratio = distance_km / EARTH_RADIUS_KM

    lat2 = math.asin(
        math.sin(lat1) * math.cos(distance_ratio)
        +
        math.cos(lat1)
        * math.sin(distance_ratio)
        * math.cos(bearing_rad)
    )

    lon2 = lon1 + math.atan2(
        math.sin(bearing_rad)
        * math.sin(distance_ratio)
        * math.cos(lat1),
        math.cos(distance_ratio)
        - math.sin(lat1) * math.sin(lat2),
    )

    return (
        math.degrees(lat2),
        math.degrees(lon2),
    )


def generate_ash_plume(
    latitude: float,
    longitude: float,
    wind_speed: float,
    wind_direction: float,
    forecast_hour: int = 1,
    ash_height: float | None = None,
    activity_level: str | None = None,
):
    """
    Estimasi visual penyebaran plume abu berdasarkan angin.

    Catatan:
    Model ini bukan model prakiraan bahaya abu vulkanik resmi.
    Ini merupakan model sederhana untuk visualisasi dan simulasi.
    """

    # =========================================================
    # 1. ARAH PLUME
    # =========================================================

    # Wind direction BMKG menunjukkan arah datangnya angin.
    # Abu bergerak mengikuti arah sebaliknya.

    plume_direction = (
        wind_direction + 180
    ) % 360

    # =========================================================
    # 2. JARAK ADVEKSI
    # =========================================================

    forecast_hour = max(
        int(forecast_hour),
        1,
    )

    # wind_speed dalam km/jam
    # forecast_hour dalam jam

    advection_factor = 0.65

    distance_km = (
        wind_speed
        * forecast_hour
        * advection_factor
    )

    distance_km = max(
        distance_km,
        1.0,
    )

    distance_km = min(
        distance_km,
        100.0,
    )

    # =========================================================
    # 3. PENGARUH TINGGI KOLOM ABU
    # =========================================================

    height_factor = 1.0

    if ash_height is not None:

        ash_height = max(
            float(ash_height),
            0.0,
        )

        height_factor += min(
            ash_height / 10000.0,
            0.5,
        )

    # =========================================================
    # 4. PENGARUH STATUS GUNUNG
    # =========================================================

    activity_factor = 1.0

    if activity_level:

        activity = activity_level.lower()

        if "awas" in activity:
            activity_factor = 1.35

        elif "siaga" in activity:
            activity_factor = 1.20

        elif "waspada" in activity:
            activity_factor = 1.10

    # =========================================================
    # 5. FAKTOR DISPERSI
    # =========================================================

    dispersion_factor = (
        height_factor
        * activity_factor
    )

    distance_km *= dispersion_factor

    distance_km = min(
        distance_km,
        120.0,
    )

    # =========================================================
    # 6. CENTERLINE PLUME
    # =========================================================

    center_distances = [
        0.0,
        distance_km * 0.18,
        distance_km * 0.38,
        distance_km * 0.62,
        distance_km * 0.82,
        distance_km,
    ]

    center_points = []

    for distance in center_distances:

        point = destination_point(
            latitude,
            longitude,
            plume_direction,
            distance,
        )

        center_points.append(point)

    # =========================================================
    # 7. LEBAR PLUME
    # =========================================================

    base_width = max(
        0.15,
        min(
            0.5 + (wind_speed * 0.02),
            1.5,
        ),
    )

    left_points = []
    right_points = []

    for index, distance in enumerate(
        center_distances
    ):

        if distance_km > 0:
            progress = (
                distance / distance_km
            )
        else:
            progress = 0

        # Plume semakin melebar semakin jauh
        # dari sumber erupsi.

        width_km = (
            base_width
            +
            (
                2.5
                * (progress ** 0.7)
            )
        )

        width_km *= dispersion_factor

        width_km = min(
            width_km,
            8.0,
        )

        left_direction = (
            plume_direction - 90
        ) % 360

        right_direction = (
            plume_direction + 90
        ) % 360

        center_lat, center_lon = (
            center_points[index]
        )

        left_point = destination_point(
            center_lat,
            center_lon,
            left_direction,
            width_km,
        )

        right_point = destination_point(
            center_lat,
            center_lon,
            right_direction,
            width_km,
        )

        left_points.append(
            left_point
        )

        right_points.append(
            right_point
        )

    # =========================================================
    # 8. GEOJSON POLYGON
    # =========================================================

    polygon_points = (
        left_points
        +
        list(reversed(right_points))
    )

    coordinates = []

    for lat, lon in polygon_points:

        coordinates.append([
            lon,
            lat,
        ])

    # Tutup polygon

    coordinates.append(
        coordinates[0]
    )

    geometry = {
        "type": "Polygon",
        "coordinates": [
            coordinates
        ],
    }

    # =========================================================
    # 9. RISK SCORE
    # =========================================================

    risk_score = 0

    # Kecepatan angin

    if wind_speed >= 30:
        risk_score += 3

    elif wind_speed >= 15:
        risk_score += 2

    elif wind_speed >= 5:
        risk_score += 1

    # Tinggi kolom abu

    if ash_height is not None:

        if ash_height >= 5000:
            risk_score += 3

        elif ash_height >= 2000:
            risk_score += 2

        elif ash_height >= 1000:
            risk_score += 1

    # Status gunung

    if activity_level:

        activity = activity_level.lower()

        if "awas" in activity:
            risk_score += 3

        elif "siaga" in activity:
            risk_score += 2

        elif "waspada" in activity:
            risk_score += 1

    if risk_score >= 7:
        risk_level = "extreme"

    elif risk_score >= 5:
        risk_level = "high"

    elif risk_score >= 3:
        risk_level = "medium"

    else:
        risk_level = "low"

    # =========================================================
    # 10. CONFIDENCE INTERNAL MODEL
    # =========================================================

    confidence = 55.0

    if wind_speed > 0:
        confidence += 10.0

    if wind_direction is not None:
        confidence += 10.0

    if ash_height is not None:
        confidence += 10.0

    if activity_level:
        confidence += 5.0

    confidence = min(
        confidence,
        90.0,
    )

    # =========================================================
    # 11. RETURN
    # =========================================================

    return {
        "direction": round(
            plume_direction,
            2,
        ),

        "speed": round(
            wind_speed,
            2,
        ),

        "distance_km": round(
            distance_km,
            2,
        ),

        "risk_level": risk_level,

        "confidence": round(
            confidence,
            2,
        ),

        "geometry": geometry,
    }

