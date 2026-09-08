import math


EARTH_RADIUS_KM = 6371.0

# Batas maksimum visualisasi plume.
# Ini bukan batas ilmiah penyebaran abu.
MAX_PLUME_DISTANCE_KM = 150.0
MAX_PLUME_WIDTH_KM = 10.0


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

    distance_ratio = (
        distance_km / EARTH_RADIUS_KM
    )

    lat2 = math.asin(
        math.sin(lat1)
        * math.cos(distance_ratio)
        +
        math.cos(lat1)
        * math.sin(distance_ratio)
        * math.cos(bearing_rad)
    )

    lon2 = (
        lon1
        +
        math.atan2(
            math.sin(bearing_rad)
            * math.sin(distance_ratio)
            * math.cos(lat1),
            math.cos(distance_ratio)
            -
            math.sin(lat1)
            * math.sin(lat2),
        )
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

    CATATAN PENTING:
    Model ini bukan model prakiraan bahaya abu vulkanik resmi.

    Model digunakan untuk:
    - visualisasi arah plume
    - simulasi penyebaran
    - monitoring dashboard
    - demonstrasi sistem

    Bukan untuk:
    - keputusan evakuasi
    - navigasi penerbangan
    - peringatan keselamatan resmi
    """

    # =========================================================
    # 1. NORMALISASI INPUT
    # =========================================================

    wind_speed = max(
        float(wind_speed or 0),
        0.0,
    )

    wind_direction = (
        float(wind_direction or 0)
        % 360
    )

    forecast_hour = max(
        int(forecast_hour),
        1,
    )

    # =========================================================
    # 2. ARAH PLUME
    # =========================================================

    # BMKG menunjukkan arah DATANGNYA angin.
    #
    # Contoh:
    # Angin SE = 135°
    # Abu bergerak berlawanan = 315° / NW

    plume_direction = (
        wind_direction + 180
    ) % 360

    # =========================================================
    # 3. FAKTOR TINGGI KOLOM ABU
    # =========================================================

    height_factor = 1.0

    if ash_height is not None:

        ash_height = max(
            float(ash_height),
            0.0,
        )

        # Tinggi kolom memengaruhi
        # skala visual penyebaran.

        height_factor += min(
            ash_height / 10000.0,
            0.5,
        )

    # =========================================================
    # 4. FAKTOR STATUS GUNUNG
    # =========================================================

    activity_factor = 1.0

    if activity_level:

        activity = (
            str(activity_level)
            .lower()
        )

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

    # =========================================================
    # 6. JARAK ADVEKSI
    # =========================================================

    # wind_speed:
    # km/jam
    #
    # forecast_hour:
    # jam
    #
    # Secara sederhana:
    #
    # distance = wind speed × waktu × faktor visual
    #
    # Faktor 0.65 digunakan agar jarak visual
    # tidak sama persis dengan perpindahan udara
    # teoritis.

    advection_factor = 0.65

    distance_km = (
        wind_speed
        * forecast_hour
        * advection_factor
    )

    # Minimum agar plume tetap terlihat
    # ketika angin sangat lemah.

    distance_km = max(
        distance_km,
        1.0,
    )

    # Pengaruh tinggi kolom dan status aktivitas.

    distance_km *= (
        dispersion_factor
    )

    # Batas maksimum hanya untuk
    # menjaga visualisasi peta.

    distance_km = min(
        distance_km,
        MAX_PLUME_DISTANCE_KM,
    )

    # =========================================================
    # 7. CENTERLINE PLUME
    # =========================================================

    center_distances = [
        0.0,
        distance_km * 0.12,
        distance_km * 0.28,
        distance_km * 0.48,
        distance_km * 0.68,
        distance_km * 0.84,
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

        center_points.append(
            point
        )

    # =========================================================
    # 8. LEBAR PLUME
    # =========================================================

    # Angin lebih kuat → plume sedikit lebih panjang
    # tetapi relatif lebih sempit.
    #
    # Angin lemah → plume lebih mudah menyebar
    # ke samping.
    #
    # Ini tetap hanya pendekatan visual.

    if wind_speed < 5:

        base_width = 1.2

    elif wind_speed < 15:

        base_width = 1.0

    elif wind_speed < 30:

        base_width = 0.8

    else:

        base_width = 0.6

    # Status aktivitas mempengaruhi
    # lebar visual secara ringan.

    base_width *= (
        0.85
        + (
            dispersion_factor
            * 0.15
        )
    )

    left_points = []
    right_points = []

    left_direction = (
        plume_direction - 90
    ) % 360

    right_direction = (
        plume_direction + 90
    ) % 360

    for index, distance in enumerate(
        center_distances
    ):

        if distance_km > 0:

            progress = (
                distance
                / distance_km
            )

        else:

            progress = 0.0

        # =====================================================
        # Lebar plume bertambah secara gradual
        # =====================================================

        width_growth = (
            progress ** 0.75
        )

        width_km = (
            base_width
            +
            (
                3.5
                * width_growth
            )
        )

        width_km *= (
            0.90
            +
            (
                dispersion_factor
                * 0.10
            )
        )

        width_km = min(
            width_km,
            MAX_PLUME_WIDTH_KM,
        )

        center_lat, center_lon = (
            center_points[index]
        )

        # =====================================================
        # Titik sisi kiri
        # =====================================================

        left_point = destination_point(
            center_lat,
            center_lon,
            left_direction,
            width_km,
        )

        # =====================================================
        # Titik sisi kanan
        # =====================================================

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
    # 9. GEOJSON POLYGON
    # =========================================================

    polygon_points = (
        left_points
        +
        list(
            reversed(
                right_points
            )
        )
    )

    coordinates = []

    for lat, lon in polygon_points:

        coordinates.append(
            [
                lon,
                lat,
            ]
        )

    # Tutup polygon.

    if coordinates:

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
    # 10. RISK SCORE
    # =========================================================

    risk_score = 0

    # ---------------------------------------------------------
    # Kecepatan angin
    # ---------------------------------------------------------

    if wind_speed >= 30:

        risk_score += 3

    elif wind_speed >= 15:

        risk_score += 2

    elif wind_speed >= 5:

        risk_score += 1

    # ---------------------------------------------------------
    # Tinggi kolom abu
    # ---------------------------------------------------------

    if ash_height is not None:

        if ash_height >= 5000:

            risk_score += 3

        elif ash_height >= 2000:

            risk_score += 2

        elif ash_height >= 1000:

            risk_score += 1

    # ---------------------------------------------------------
    # Status gunung
    # ---------------------------------------------------------

    if activity_level:

        activity = (
            str(activity_level)
            .lower()
        )

        if "awas" in activity:

            risk_score += 3

        elif "siaga" in activity:

            risk_score += 2

        elif "waspada" in activity:

            risk_score += 1

    # ---------------------------------------------------------
    # Risk level
    # ---------------------------------------------------------

    if risk_score >= 7:

        risk_level = "extreme"

    elif risk_score >= 5:

        risk_level = "high"

    elif risk_score >= 3:

        risk_level = "medium"

    else:

        risk_level = "low"

    # =========================================================
    # 11. CONFIDENCE INTERNAL MODEL
    # =========================================================

    # Ini BUKAN probabilitas kejadian.
    # Hanya confidence internal untuk model visual.

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
    # 12. RETURN
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

