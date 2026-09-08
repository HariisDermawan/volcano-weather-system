import json
from datetime import datetime

from sqlalchemy import text

from app.database.connection import SessionLocal
from app.models.ash_model import generate_ash_plume


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

WEATHER_SOURCE = "BMKG - Pulau Sebesi"

ANAK_KRAKATAU_ID = 1

FORECAST_LIMIT = 6


def wind_direction_to_degree(direction: str):
    if not direction:
        return None

    return WIND_DIRECTION_MAP.get(
        direction.upper().strip()
    )


def generate_prediction(volcano_id: int):
    db = SessionLocal()

    try:

        # =====================================================
        # 1. AMBIL DATA GUNUNG
        # =====================================================

        volcano = db.execute(
            text("""
                SELECT
                    id,
                    name,
                    latitude,
                    longitude,
                    status
                FROM volcanoes
                WHERE id = :volcano_id
                LIMIT 1
            """),
            {
                "volcano_id": volcano_id,
            },
        ).mappings().first()

        if not volcano:
            print("Volcano tidak ditemukan.")
            return

        # =====================================================
        # 2. AMBIL AKTIVITAS TERBARU
        # =====================================================

        activity = db.execute(
            text("""
                SELECT
                    occurred_at,
                    ash_height,
                    activity_level,
                    description
                FROM eruptions
                WHERE volcano_id = :volcano_id
                ORDER BY occurred_at DESC
                LIMIT 1
            """),
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

        # =====================================================
        # 3. WAKTU GENERATE
        # =====================================================

        generated_at = datetime.now()

        # =====================================================
        # 4. AMBIL FORECAST BMKG
        #
        # DISTINCT forecast_at mencegah forecast duplikat.
        # =====================================================

        forecasts = db.execute(
            text("""
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
            """),
            {
                "volcano_id": volcano_id,
                "source": WEATHER_SOURCE,
                "generated_at": generated_at,
                "limit": FORECAST_LIMIT,
            },
        ).mappings().all()

        if not forecasts:

            print(
                "Data forecast BMKG terbaru "
                "tidak ditemukan."
            )

            return

        # =====================================================
        # 5. HAPUS PREDIKSI SEBELUMNYA
        #
        # Karena prediction selalu dihitung ulang
        # berdasarkan forecast BMKG terbaru.
        # =====================================================

        db.execute(
            text("""
                DELETE FROM ash_predictions
                WHERE volcano_id = :volcano_id
            """),
            {
                "volcano_id": volcano_id,
            },
        )

        # =====================================================
        # 6. LOG
        # =====================================================

        print()
        print("=" * 65)
        print("GENERATING MULTI-HOUR ASH PREDICTION")
        print("=" * 65)

        print(
            f"Gunung          : {volcano['name']}"
        )

        print(
            f"Status          : {activity_level}"
        )

        print(
            f"Forecast unik   : {len(forecasts)} titik"
        )

        print()

        prediction_count = 0

        # =====================================================
        # 7. GENERATE SETIAP FORECAST
        # =====================================================

        for forecast in forecasts:

            wind_direction = wind_direction_to_degree(
                forecast["wind_direction"]
            )

            if wind_direction is None:

                print(
                    "Skip forecast karena arah angin "
                    f"tidak dikenali: "
                    f"{forecast['wind_direction']}"
                )

                continue

            wind_speed = float(
                forecast["wind_speed"] or 0
            )

            # -------------------------------------------------
            # Hitung horizon berdasarkan waktu aktual.
            #
            # Contoh:
            # sekarang 23:40
            # forecast 00:00
            #
            # dibulatkan minimum menjadi 1 jam.
            # -------------------------------------------------

            difference = (
                forecast["forecast_at"]
                - generated_at
            )

            forecast_hour = max(
                1,
                round(
                    difference.total_seconds()
                    / 3600
                ),
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
            # 8. SIMPAN
            # =================================================

            db.execute(
                text("""
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
                """),
                {
                    "volcano_id": volcano_id,

                    "generated_at": generated_at,

                    "forecast_at": forecast[
                        "forecast_at"
                    ],

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
                f"{forecast['forecast_at']} | "
                f"+{forecast_hour} jam | "
                f"Angin {forecast['wind_direction']} "
                f"{wind_speed} km/h | "
                f"Plume {prediction['direction']}° | "
                f"{prediction['distance_km']} km | "
                f"Risk {prediction['risk_level']}"
            )

        # =====================================================
        # 9. COMMIT
        # =====================================================

        db.commit()

        print()
        print("=" * 65)
        print("ASH PREDICTION SELESAI")
        print("=" * 65)

        print(
            f"Prediction dibuat : {prediction_count}"
        )

        print(
            f"Source            : {WEATHER_SOURCE}"
        )

        print(
            f"Generated at      : {generated_at}"
        )

        print("=" * 65)

    except Exception as error:

        db.rollback()

        print()
        print("GAGAL MEMBUAT ASH PREDICTION")
        print(error)

    finally:

        db.close()


if __name__ == "__main__":

    generate_prediction(
        volcano_id=ANAK_KRAKATAU_ID
    )

