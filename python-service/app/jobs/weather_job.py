from datetime import datetime

from sqlalchemy import text

from app.collectors.weather_collector import (
    get_weather,
    extract_forecasts,
)
from app.database.connection import SessionLocal


# =========================================================
# GET BMKG WEATHER SOURCES
# =========================================================

def get_weather_sources():
    db = SessionLocal()

    try:
        rows = db.execute(
            text("""
                SELECT
                    volcano_id,
                    source,
                    adm4,
                    location_name
                FROM volcano_weather_sources
                WHERE source = 'BMKG'
                ORDER BY volcano_id
            """)
        ).fetchall()

        return rows

    finally:
        db.close()


# =========================================================
# SAVE WEATHER FORECAST
# =========================================================

def save_weather_forecasts(
    volcano_id: int,
    adm4: str,
    source: str,
):
    print("=" * 60)
    print("BMKG WEATHER FORECAST JOB")
    print("=" * 60)
    print(f"Volcano ID : {volcano_id}")
    print(f"ADM4       : {adm4}")
    print(f"Source     : {source}")
    print()

    # =====================================================
    # 1. AMBIL DATA DARI BMKG
    # =====================================================

    print("Mengambil data cuaca dari BMKG...")

    data = get_weather(adm4)
    forecasts = extract_forecasts(data)

    if not forecasts:
        print("Tidak ada data forecast dari BMKG.")
        return

    print(
        f"Forecast dari BMKG : {len(forecasts)} data"
    )
    print()

    # =====================================================
    # 2. CONNECT DATABASE
    # =====================================================

    db = SessionLocal()

    inserted = 0
    updated = 0
    skipped = 0

    try:

        # =================================================
        # 3. LOOP FORECAST
        # =================================================

        for forecast in forecasts:

            local_datetime = forecast.get(
                "local_datetime"
            )

            if not local_datetime:
                skipped += 1
                continue

            # =============================================
            # PARSE DATETIME
            # =============================================

            try:
                forecast_at = datetime.fromisoformat(
                    local_datetime
                )

            except ValueError:
                print(
                    f"SKIP | datetime tidak valid: "
                    f"{local_datetime}"
                )

                skipped += 1
                continue

            # =============================================
            # DATA FORECAST
            # =============================================

            temperature = forecast.get(
                "temperature"
            )

            humidity = forecast.get(
                "humidity"
            )

            wind_speed = forecast.get(
                "wind_speed"
            )

            wind_direction = forecast.get(
                "wind_direction"
            )

            weather = forecast.get(
                "weather"
            )

            visibility = forecast.get(
                "visibility"
            )

            visibility_text = forecast.get(
                "visibility_text"
            )

            # =============================================
            # CEK DATABASE
            #
            # Kunci:
            # volcano_id + forecast_at
            # =============================================

            existing = db.execute(
                text("""
                    SELECT id
                    FROM weather_forecasts
                    WHERE volcano_id = :volcano_id
                      AND forecast_at = :forecast_at
                    LIMIT 1
                """),
                {
                    "volcano_id": volcano_id,
                    "forecast_at": forecast_at,
                },
            ).fetchone()

            # =================================================
            # 4. UPDATE JIKA SUDAH ADA
            # =================================================

            if existing:

                db.execute(
                    text("""
                        UPDATE weather_forecasts
                        SET
                            source = :source,
                            temperature = :temperature,
                            humidity = :humidity,
                            wind_speed = :wind_speed,
                            wind_direction = :wind_direction,
                            weather = :weather,
                            visibility = :visibility,
                            visibility_text = :visibility_text,
                            updated_at = NOW()
                        WHERE id = :id
                    """),
                    {
                        "id": existing.id,
                        "source": source,
                        "temperature": temperature,
                        "humidity": humidity,
                        "wind_speed": wind_speed,
                        "wind_direction": wind_direction,
                        "weather": weather,
                        "visibility": visibility,
                        "visibility_text": visibility_text,
                    },
                )

                updated += 1

                print(
                    f"UPDATE | "
                    f"{forecast_at} | "
                    f"{weather} | "
                    f"Angin {wind_direction} "
                    f"{wind_speed} km/h"
                )

            # =================================================
            # 5. INSERT JIKA BELUM ADA
            # =================================================

            else:

                db.execute(
                    text("""
                        INSERT INTO weather_forecasts (
                            volcano_id,
                            source,
                            forecast_at,
                            temperature,
                            humidity,
                            wind_speed,
                            wind_direction,
                            weather,
                            visibility,
                            visibility_text,
                            created_at,
                            updated_at
                        )
                        VALUES (
                            :volcano_id,
                            :source,
                            :forecast_at,
                            :temperature,
                            :humidity,
                            :wind_speed,
                            :wind_direction,
                            :weather,
                            :visibility,
                            :visibility_text,
                            NOW(),
                            NOW()
                        )
                    """),
                    {
                        "volcano_id": volcano_id,
                        "source": source,
                        "forecast_at": forecast_at,
                        "temperature": temperature,
                        "humidity": humidity,
                        "wind_speed": wind_speed,
                        "wind_direction": wind_direction,
                        "weather": weather,
                        "visibility": visibility,
                        "visibility_text": visibility_text,
                    },
                )

                inserted += 1

                print(
                    f"INSERT | "
                    f"{forecast_at} | "
                    f"{weather} | "
                    f"Angin {wind_direction} "
                    f"{wind_speed} km/h"
                )

        # =================================================
        # 6. COMMIT
        # =================================================

        db.commit()

        # =================================================
        # 7. SUMMARY
        # =================================================

        print()

        print("=" * 60)
        print("WEATHER JOB SELESAI")
        print("=" * 60)

        print(
            f"Total forecast : {len(forecasts)}"
        )

        print(
            f"Inserted       : {inserted}"
        )

        print(
            f"Updated        : {updated}"
        )

        print(
            f"Skipped        : {skipped}"
        )

        print("=" * 60)

    except Exception as error:

        db.rollback()

        print()

        print("=" * 60)
        print("WEATHER JOB ERROR")
        print("=" * 60)

        print(error)

        raise

    finally:
        db.close()


# =========================================================
# RUN DIRECTLY
# =========================================================

if __name__ == "__main__":

    weather_sources = get_weather_sources()

    print("=" * 60)
    print("BMKG WEATHER SOURCES")
    print("=" * 60)
    print(
        f"Total mapping : {len(weather_sources)}"
    )
    print()

    if not weather_sources:
        print(
            "Tidak ada mapping BMKG "
            "di volcano_weather_sources."
        )

    for source in weather_sources:

        print(
            f"[Volcano ID {source.volcano_id}] "
            f"{source.location_name} "
            f"({source.adm4})"
        )

        save_weather_forecasts(
            volcano_id=source.volcano_id,
            adm4=source.adm4,
            source=(
                f"BMKG - "
                f"{source.location_name}"
            ),
        )