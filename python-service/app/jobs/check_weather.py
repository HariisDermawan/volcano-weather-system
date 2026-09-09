from app.database.connection import SessionLocal
from sqlalchemy import text


db = SessionLocal()

try:
    total = db.execute(
        text("""
            SELECT COUNT(*)
            FROM weather_forecasts
        """)
    ).scalar()

    distinct_volcanoes = db.execute(
        text("""
            SELECT COUNT(DISTINCT volcano_id)
            FROM weather_forecasts
        """)
    ).scalar()

    print("=" * 80)
    print("CHECK WEATHER FORECAST")
    print("=" * 80)
    print(f"Total weather forecast       : {total}")
    print(f"Gunung punya weather forecast: {distinct_volcanoes}")
    print()

    rows = db.execute(
        text("""
            SELECT
                v.id,
                v.name,
                vws.adm4,
                vws.location_name,
                COUNT(wf.id) AS total_forecast,
                MIN(wf.forecast_at) AS forecast_awal,
                MAX(wf.forecast_at) AS forecast_akhir
            FROM volcanoes v
            LEFT JOIN volcano_weather_sources vws
                ON vws.volcano_id = v.id
                AND vws.source = 'BMKG'
            LEFT JOIN weather_forecasts wf
                ON wf.volcano_id = v.id
            GROUP BY
                v.id,
                v.name,
                vws.adm4,
                vws.location_name
            ORDER BY v.id
        """)
    ).fetchall()

    print("=" * 120)
    print(
        f"{'ID':>3} | "
        f"{'GUNUNG':<30} | "
        f"{'ADM4':<18} | "
        f"{'LOKASI':<20} | "
        f"{'FORECAST':>8}"
    )
    print("=" * 120)

    for row in rows:
        print(
            f"{row.id:>3} | "
            f"{row.name:<30} | "
            f"{(row.adm4 or '-'): <18} | "
            f"{(row.location_name or '-'): <20} | "
            f"{row.total_forecast:>8}"
        )

finally:
    db.close()