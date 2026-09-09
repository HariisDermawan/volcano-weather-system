import time

from sqlalchemy import text

from app.database.connection import SessionLocal
from app.jobs.ash_job import generate_prediction
from app.jobs.vaac_job import sync_vaac_advisories
from app.jobs.volcano_job import run_volcano_job
from app.jobs.weather_job import save_weather_forecasts


REQUEST_DELAY = 0.5

WEATHER_SOURCE_PREFIX = "BMKG - "


def get_weather_sources():
    db = SessionLocal()

    try:
        rows = db.execute(
            text(
                """
                SELECT
                    volcano_id,
                    source,
                    adm4,
                    location_name
                FROM volcano_weather_sources
                WHERE source = 'BMKG'
                ORDER BY volcano_id
                """
            )
        ).fetchall()

        return rows

    finally:
        db.close()


def run_all_jobs():
    print("\n" + "=" * 60)
    print("MENJALANKAN SEMUA JOB MONITORING")
    print("=" * 60)

    # 1. Ambil laporan aktivitas gunung (semua gunung)
    run_volcano_job()

    # 2. Ambil advisory abu VAAC Darwin (maskapai, real-time)
    try:
        sync_vaac_advisories()
    except Exception as error:
        print(f"[VAAC ERROR] {error}")

    # 3. Ambil forecast cuaca BMKG untuk semua gunung
    #    yang sudah di-mapping di volcano_weather_sources.
    sources = get_weather_sources()

    if not sources:
        print(
            "Tidak ada mapping BMKG. "
            "Jalankan save_weather_mappings.py dulu."
        )

    for source in sources:
        try:
            print(
                f"\n>>> WEATHER | Volcano ID "
                f"{source.volcano_id} | "
                f"{source.location_name} ({source.adm4})"
            )

            save_weather_forecasts(
                volcano_id=source.volcano_id,
                adm4=source.adm4,
                source=(
                    WEATHER_SOURCE_PREFIX
                    + str(source.location_name)
                ),
            )

        except Exception as error:
            print(
                f"[WEATHER ERROR] Volcano ID "
                f"{source.volcano_id}: {error}"
            )

        # Jeda antar request BMKG agar tidak kena rate limit.
        time.sleep(REQUEST_DELAY)

    # 4. Buat prediksi sebaran abu untuk semua gunung
    for source in sources:
        try:
            print(
                f"\n>>> PREDICTION | Volcano ID "
                f"{source.volcano_id} | "
                f"{source.location_name}"
            )

            generate_prediction(
                volcano_id=source.volcano_id,
            )

        except Exception as error:
            print(
                f"[PREDICTION ERROR] Volcano ID "
                f"{source.volcano_id}: {error}"
            )

    print("=" * 60)
    print("SEMUA JOB SELESAI")
    print("=" * 60)


if __name__ == "__main__":
    while True:
        try:
            run_all_jobs()

        except Exception as error:
            print("Scheduler error:")
            print(error)

        print("\nMenunggu 10 menit sebelum menjalankan kembali...")
        time.sleep(600)
