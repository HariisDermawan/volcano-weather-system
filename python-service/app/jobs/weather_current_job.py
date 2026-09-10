from datetime import datetime

from sqlalchemy import text

from app.collectors.openmeteo_collector import get_current_weather
from app.database.connection import SessionLocal


CARDINALS = [
    "N", "NNE", "NE", "ENE",
    "E", "ESE", "SE", "SSE",
    "S", "SSW", "SW", "WSW",
    "W", "WNW", "NW", "NNW",
]


def cardinal_from_degrees(degrees):
    if degrees is None:
        return None

    deg = float(degrees) % 360

    index = round(deg / 22.5) % 16

    return CARDINALS[index]


def get_volcanoes():
    db = SessionLocal()

    try:
        rows = db.execute(
            text("""
                SELECT id, name, latitude, longitude
                FROM volcanoes
                WHERE latitude IS NOT NULL
                  AND longitude IS NOT NULL
                ORDER BY id
            """)
        ).fetchall()

        return rows

    finally:
        db.close()


def sync_current_weather():
    print("=" * 60)
    print("CURRENT WEATHER JOB (OPEN-METEO / GFS-ICON)")
    print("=" * 60)

    volcanoes = get_volcanoes()

    if not volcanoes:
        print("Tidak ada gunung ber-koordinat.")
        return

    db = SessionLocal()

    inserted = 0
    updated = 0
    skipped = 0

    try:
        for volcano in volcanoes:
            print(
                f"\n>>> CURRENT WEATHER | Volcano ID "
                f"{volcano.id} | {volcano.name}"
            )

            try:
                data = get_current_weather(
                    volcano.latitude,
                    volcano.longitude,
                )

            except Exception as error:
                print(f"  [ERROR] {error}")
                skipped += 1
                continue

            current = data.get("current") or {}

            observed_at = current.get("time")

            if not observed_at:
                print("  [SKIP] tidak ada current.time di respons.")
                skipped += 1
                continue

            try:
                observed_at = datetime.fromisoformat(
                    observed_at.replace("Z", "+00:00")
                )

            except ValueError:
                print(f"  [SKIP] datetime tidak valid: {observed_at}")
                skipped += 1
                continue

            temperature = current.get("temperature_2m")
            apparent = current.get("apparent_temperature")
            humidity = current.get("relative_humidity_2m")
            pressure = current.get("surface_pressure")
            wind_speed = current.get("wind_speed_10m")
            wind_deg = current.get("wind_direction_10m")
            wind_gust = current.get("wind_gusts_10m")

            existing = db.execute(
                text("""
                    SELECT id
                    FROM weather_currents
                    WHERE volcano_id = :volcano_id
                    LIMIT 1
                """),
                {"volcano_id": volcano.id},
            ).fetchone()

            values = {
                "volcano_id": volcano.id,
                "observed_at": observed_at,
                "temperature_c": temperature,
                "apparent_temperature_c": apparent,
                "humidity": humidity,
                "pressure_msl": pressure,
                "wind_speed_kmh": wind_speed,
                "wind_direction_deg": wind_deg,
                "wind_direction_cardinal": cardinal_from_degrees(wind_deg),
                "wind_gust_kmh": wind_gust,
            }

            if existing:
                db.execute(
                    text("""
                        UPDATE weather_currents
                        SET
                            source = 'Open-Meteo',
                            observed_at = :observed_at,
                            temperature_c = :temperature_c,
                            apparent_temperature_c = :apparent_temperature_c,
                            humidity = :humidity,
                            pressure_msl = :pressure_msl,
                            wind_speed_kmh = :wind_speed_kmh,
                            wind_direction_deg = :wind_direction_deg,
                            wind_direction_cardinal = :wind_direction_cardinal,
                            wind_gust_kmh = :wind_gust_kmh,
                            updated_at = NOW()
                        WHERE id = :id
                    """),
                    {**values, "id": existing.id},
                )

                updated += 1

            else:
                db.execute(
                    text("""
                        INSERT INTO weather_currents (
                            volcano_id,
                            source,
                            observed_at,
                            temperature_c,
                            apparent_temperature_c,
                            humidity,
                            pressure_msl,
                            wind_speed_kmh,
                            wind_direction_deg,
                            wind_direction_cardinal,
                            wind_gust_kmh,
                            created_at,
                            updated_at
                        )
                        VALUES (
                            :volcano_id,
                            'Open-Meteo',
                            :observed_at,
                            :temperature_c,
                            :apparent_temperature_c,
                            :humidity,
                            :pressure_msl,
                            :wind_speed_kmh,
                            :wind_direction_deg,
                            :wind_direction_cardinal,
                            :wind_gust_kmh,
                            NOW(),
                            NOW()
                        )
                    """),
                    values,
                )

                inserted += 1

            db.commit()

            print(
                f"  OK | {observed_at} UTC | "
                f"{temperature}°C | hum {humidity}% | "
                f"angin {wind_deg}° "
                f"({cardinal_from_degrees(wind_deg)}) "
                f"{wind_speed} km/h | hembusan {wind_gust} km/h"
            )

        print()
        print("=" * 60)
        print("CURRENT WEATHER JOB SELESAI")
        print("=" * 60)
        print(f"Volcanoes  : {len(volcanoes)}")
        print(f"Inserted   : {inserted}")
        print(f"Updated    : {updated}")
        print(f"Skipped    : {skipped}")
        print("=" * 60)

    except Exception as error:
        db.rollback()

        print()
        print("=" * 60)
        print("CURRENT WEATHER JOB ERROR")
        print("=" * 60)

        print(error)

        raise

    finally:
        db.close()


if __name__ == "__main__":
    sync_current_weather()