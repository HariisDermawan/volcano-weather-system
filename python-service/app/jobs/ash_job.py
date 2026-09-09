import json

from datetime import datetime

from sqlalchemy import text

from app.database.connection import SessionLocal

from app.models.ash_model import generate_ash_plume


# =========================================================
# CONFIG
# =========================================================

FORECAST_LIMIT = 6


# =========================================================
# WIND DIRECTION
# =========================================================

WIND_DIRECTION_MAP = {
    "N": 0,
    "NE": 45,
    "E": 90,
    "SE": 135,
    "S": 180,
    "SW": 225,
    "W": 270,
    "NW": 315,
}


def wind_direction_to_degree(direction: str):
    if not direction:
        return None

    return WIND_DIRECTION_MAP.get(
        direction.upper().strip()
    )


# =========================================================
# FORECAST HOUR
# =========================================================

def calculate_forecast_hour(
    forecast_at,
    base_forecast_at,
):
    """
    Menghitung horizon forecast berdasarkan
    forecast pertama sebagai +0 jam.
    """

    difference = forecast_at - base_forecast_at

    seconds = difference.total_seconds()

    if seconds < 0:
        return None

    forecast_hour = round(
        seconds / 3600
    )

    return max(0, forecast_hour)


# =========================================================
# GET WEATHER SOURCES
# =========================================================

def get_weather_sources():
    db = SessionLocal()

    try:
        rows = db.execute(
            text(
                """
                SELECT
                    vws.volcano_id,
                    vws.source,
                    vws.adm4,
                    vws.location_name
                FROM volcano_weather_sources vws
                INNER JOIN volcanoes v
                    ON v.id = vws.volcano_id
                WHERE vws.source = 'BMKG'
                ORDER BY vws.volcano_id
                """
            )
        ).mappings().all()

        return rows

    finally:
        db.close()


# =========================================================
# GENERATE PREDICTION
# =========================================================

def generate_prediction(volcano_id: int):

    db = SessionLocal()

    try:

        # =================================================
        # 1. AMBIL DATA GUNUNG
        # =================================================

        volcano = db.execute(
            text(
                """
                SELECT
                    id,
                    name,
                    latitude,
                    longitude,
                    status
                FROM volcanoes
                WHERE id = :volcano_id
                LIMIT 1
                """
            ),
            {
                "volcano_id": volcano_id,
            },
        ).mappings().first()

        if not volcano:
            print(
                f"Volcano ID {volcano_id} "
                "tidak ditemukan."
            )

            return False

        # =================================================
        # 2. AMBIL CONFIG WEATHER DARI DATABASE
        # =================================================

        weather_config = db.execute(
            text(
                """
                SELECT
                    source,
                    adm4,
                    location_name
                FROM volcano_weather_sources
                WHERE volcano_id = :volcano_id
                  AND source = 'BMKG'
                LIMIT 1
                """
            ),
            {
                "volcano_id": volcano_id,
            },
        ).mappings().first()

        if not weather_config:

            print(
                f"[SKIP] {volcano['name']} "
                f"(ID {volcano_id}) "
                "belum memiliki mapping BMKG."
            )

            return False

        weather_source = (
            f"BMKG - "
            f"{weather_config['location_name']}"
            if weather_config["location_name"]
            else "BMKG"
        )

        # =================================================
        # 3. AMBIL AKTIVITAS TERBARU
        # =================================================

        activity = db.execute(
            text(
                """
                SELECT
                    occurred_at,
                    ash_height,
                    activity_level,
                    description
                FROM eruptions
                WHERE volcano_id = :volcano_id
                ORDER BY occurred_at DESC
                LIMIT 1
                """
            ),
            {
                "volcano_id": volcano_id,
            },
        ).mappings().first()

        ash_height = None

        activity_level = volcano["status"]

        if activity:

            if activity["ash_height"] is not None:

                ash_height = float(
                    activity["ash_height"]
                )

            if activity["activity_level"]:

                activity_level = (
                    activity["activity_level"]
                )

        # =================================================
        # 4. WAKTU GENERATE
        # =================================================

        generated_at = datetime.now()

        # =================================================
        # 5. AMBIL FORECAST BMKG
        # =================================================

        forecasts = db.execute(
            text(
                """
                SELECT
                    forecast_at,
                    temperature,
                    humidity,
                    wind_speed,
                    wind_direction,
                    weather
                FROM weather_forecasts
                WHERE volcano_id = :volcano_id
                  AND source = :source
                  AND forecast_at >= :generated_at
                GROUP BY
                    forecast_at,
                    temperature,
                    humidity,
                    wind_speed,
                    wind_direction,
                    weather
                ORDER BY forecast_at ASC
                LIMIT :limit
                """
            ),
            {
                "volcano_id": volcano_id,
                "source": weather_source,
                "generated_at": generated_at,
                "limit": FORECAST_LIMIT,
            },
        ).mappings().all()

        # =================================================
        # FALLBACK
        # =================================================
        # Jika waktu server sedikit melewati forecast pertama,
        # ambil forecast terdekat yang tersedia.

        if not forecasts:

            forecasts = db.execute(
                text(
                    """
                    SELECT
                        forecast_at,
                        temperature,
                        humidity,
                        wind_speed,
                        wind_direction,
                        weather
                    FROM weather_forecasts
                    WHERE volcano_id = :volcano_id
                      AND source = :source
                    GROUP BY
                        forecast_at,
                        temperature,
                        humidity,
                        wind_speed,
                        wind_direction,
                        weather
                    ORDER BY forecast_at ASC
                    LIMIT :limit
                    """
                ),
                {
                    "volcano_id": volcano_id,
                    "source": weather_source,
                    "limit": FORECAST_LIMIT,
                },
            ).mappings().all()

        if not forecasts:

            print(
                f"[SKIP] {volcano['name']} "
                "tidak memiliki forecast BMKG."
            )

            return False

        # =================================================
        # 6. BASE FORECAST
        # =================================================

        base_forecast_at = forecasts[0]["forecast_at"]

        # =================================================
        # 7. HAPUS PREDIKSI LAMA
        # =================================================

        db.execute(
            text(
                """
                DELETE FROM ash_predictions
                WHERE volcano_id = :volcano_id
                """
            ),
            {
                "volcano_id": volcano_id,
            },
        )

        # =================================================
        # 8. LOG
        # =================================================

        print()

        print("=" * 70)

        print(
            "GENERATING MULTI-HOUR ASH PREDICTION"
        )

        print("=" * 70)

        print(
            f"Gunung         : "
            f"{volcano['name']}"
        )

        print(
            f"Status         : "
            f"{activity_level}"
        )

        print(
            f"Generated at   : "
            f"{generated_at}"
        )

        print(
            f"Weather source : "
            f"{weather_source}"
        )

        print(
            f"Base forecast  : "
            f"{base_forecast_at}"
        )

        print(
            f"Forecast titik : "
            f"{len(forecasts)}"
        )

        print()

        prediction_count = 0

        skipped_count = 0

        # =================================================
        # 9. GENERATE SETIAP FORECAST
        # =================================================

        for forecast in forecasts:

            forecast_at = forecast[
                "forecast_at"
            ]

            # -------------------------------------------------
            # Hitung horizon forecast
            # -------------------------------------------------

            forecast_hour = (
                calculate_forecast_hour(
                    forecast_at,
                    base_forecast_at,
                )
            )

            if forecast_hour is None:

                print(
                    f"SKIP | {forecast_at} | "
                    "Forecast tidak valid"
                )

                skipped_count += 1

                continue

            # -------------------------------------------------
            # Konversi arah angin
            # -------------------------------------------------

            wind_direction = (
                wind_direction_to_degree(
                    forecast[
                        "wind_direction"
                    ]
                )
            )

            if wind_direction is None:

                print(
                    "SKIP | "
                    f"{forecast_at} | "
                    "Arah angin tidak dikenali: "
                    f"{forecast['wind_direction']}"
                )

                skipped_count += 1

                continue

            # -------------------------------------------------
            # Kecepatan angin
            # -------------------------------------------------

            wind_speed = float(
                forecast["wind_speed"] or 0
            )

            # -------------------------------------------------
            # Generate plume
            # -------------------------------------------------

            prediction = generate_ash_plume(

                latitude=float(
                    volcano["latitude"]
                ),

                longitude=float(
                    volcano["longitude"]
                ),

                wind_speed=wind_speed,

                wind_direction=wind_direction,

                forecast_hour=forecast_hour,

                ash_height=ash_height,

                activity_level=activity_level,
            )

            # =================================================
            # 10. SIMPAN PREDIKSI
            # =================================================

            db.execute(
                text(
                    """
                    INSERT INTO ash_predictions (
                        volcano_id,
                        generated_at,
                        forecast_at,
                        forecast_hour,
                        direction,
                        speed,
                        risk_level,
                        confidence,
                        geometry,
                        created_at,
                        updated_at
                    )
                    VALUES (
                        :volcano_id,
                        :generated_at,
                        :forecast_at,
                        :forecast_hour,
                        :direction,
                        :speed,
                        :risk_level,
                        :confidence,
                        :geometry,
                        NOW(),
                        NOW()
                    )
                    """
                ),
                {
                    "volcano_id": volcano_id,

                    "generated_at": generated_at,

                    "forecast_at": forecast_at,

                    "forecast_hour": forecast_hour,

                    "direction": prediction[
                        "direction"
                    ],

                    "speed": prediction[
                        "speed"
                    ],

                    "risk_level": prediction[
                        "risk_level"
                    ],

                    "confidence": prediction[
                        "confidence"
                    ],

                    "geometry": json.dumps(
                        prediction["geometry"]
                    ),
                },
            )

            prediction_count += 1

            print(
                f"[{prediction_count}] "
                f"{forecast_at} | "
                f"+{forecast_hour} jam | "
                f"Angin "
                f"{forecast['wind_direction']} "
                f"{wind_speed} km/h | "
                f"Plume "
                f"{prediction['direction']}° | "
                f"{prediction['distance_km']} km | "
                f"Risk "
                f"{prediction['risk_level']}"
            )

        # =================================================
        # 11. COMMIT
        # =================================================

        db.commit()

        print()

        print("=" * 70)

        print("ASH PREDICTION SELESAI")

        print("=" * 70)

        print(
            f"Gunung          : "
            f"{volcano['name']}"
        )

        print(
            f"Prediction dibuat: "
            f"{prediction_count}"
        )

        print(
            f"Prediction skip  : "
            f"{skipped_count}"
        )

        print(
            f"Source           : "
            f"{weather_source}"
        )

        print(
            f"Generated at     : "
            f"{generated_at}"
        )

        print("=" * 70)

        return prediction_count > 0

    except Exception as error:

        db.rollback()

        print()

        print(
            "GAGAL MEMBUAT ASH PREDICTION"
        )

        print(
            f"Gunung ID : {volcano_id}"
        )

        print(error)

        raise

    finally:

        db.close()


# =========================================================
# RUN ALL VOLCANOES
# =========================================================

if __name__ == "__main__":

    weather_sources = get_weather_sources()

    print("=" * 70)

    print(
        "ASH PREDICTION - ALL VOLCANOES"
    )

    print("=" * 70)

    print(
        f"Total mapping BMKG : "
        f"{len(weather_sources)}"
    )

    print()

    if not weather_sources:

        print(
            "Tidak ada mapping BMKG."
        )

    success = 0

    failed = 0

    for source in weather_sources:

        volcano_id = source[
            "volcano_id"
        ]

        print()

        print(
            f">>> Processing Volcano ID "
            f"{volcano_id} | "
            f"{source['location_name']}"
        )

        try:

            result = generate_prediction(
                volcano_id=volcano_id
            )

            if result:

                success += 1

            else:

                failed += 1

        except Exception as error:

            failed += 1

            print(
                f"[ERROR] Volcano ID "
                f"{volcano_id}: {error}"
            )

    print()

    print("=" * 70)

    print("ALL ASH PREDICTION SELESAI")

    print("=" * 70)

    print(
        f"Berhasil : {success}"
    )

    print(
        f"Gagal/Skip : {failed}"
    )

    print("=" * 70)