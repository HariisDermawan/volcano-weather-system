import time

from concurrent.futures import (
    ThreadPoolExecutor,
    as_completed,
)
from datetime import datetime

from sqlalchemy import text


from app.database.connection import SessionLocal
from app.jobs.ash_job import generate_prediction
from app.jobs.vaac_job import sync_vaac_advisories
from app.jobs.volcano_job import run_volcano_job
from app.jobs.weather_current_job import sync_current_weather
from app.jobs.weather_job import save_weather_forecasts


REQUEST_DELAY = 0.5

WEATHER_SOURCE_PREFIX = "BMKG - "

# Seberapa banyak request BMKG yang dijalankan bersamaan. Nilai kecil
# agar tidak memicu rate limit (BMKG 429 di-retry otomatis).
MAX_WEATHER_WORKERS = 4


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


def fetch_forecast(source):
    """Ambil & simpan forecast BMKG untuk satu gunung (dipanggil paralel)."""

    volcano_id = int(source.volcano_id)

    try:
        print(
            f">>> WEATHER | Volcano ID {volcano_id} | "
            f"{source.location_name} ({source.adm4})"
        )

        save_weather_forecasts(
            volcano_id=volcano_id,
            adm4=source.adm4,
            source=(
                WEATHER_SOURCE_PREFIX
                + str(source.location_name)
            ),
        )

        return volcano_id, None

    except Exception as error:
        return volcano_id, error


def run_prediction(volcano_id, location_name):
    """Generate prediksi sebaran abu untuk satu gunung (paralel)."""

    try:
        print(
            f">>> PREDICTION | Volcano ID "
            f"{volcano_id} | {location_name}"
        )

        generate_prediction(volcano_id=volcano_id)

        return volcano_id, None

    except Exception as error:
        return volcano_id, error


def run_all_jobs():
    started = datetime.now()

    print("\n" + "=" * 60)
    print("MENJALANKAN SEMUA JOB MONITORING")
    print(f"Mulai      : {started:%Y-%m-%d %H:%M:%S}")
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
    #    Dijalankan paralel (worker terbatas) untuk memangkas
    #    durasi siklus sehingga data lebih segar.
    sources = get_weather_sources()

    if not sources:
        print(
            "Tidak ada mapping BMKG. "
            "Jalankan save_weather_mappings.py dulu."
        )

    with ThreadPoolExecutor(
        max_workers=MAX_WEATHER_WORKERS
    ) as pool:
        futures = [
            pool.submit(fetch_forecast, source)
            for source in sources
        ]

        for future in as_completed(futures):
            try:
                volcano_id, error = future.result()
            except Exception as error:  # pragma: no cover
                print(f"[WEATHER WORKER ERROR] {error}")
                continue

            if error:
                print(
                    f"[WEATHER ERROR] Volcano ID "
                    f"{volcano_id}: {error}"
                )

            # Jeda kecil agar BMKG tidak dibanjiri sesaat.
            time.sleep(REQUEST_DELAY)

    # 3b. Ambil kondisi cuaca saat ini (Open-Meteo / GFS-ICON)
    #     untuk semua gunung yang punya koordinat.
    try:
        sync_current_weather()
    except Exception as error:
        print(f"[CURRENT WEATHER ERROR] {error}")

    # 4. Buat prediksi sebaran abu untuk semua gunung
    #    (setelah forecast BMKG selesai ditulis).
    #
    # CATATAN: sengaja tetap sekuensial. generate_prediction
    # memakai DELETE + INSERT dalam satu transaksi pada tabel
    # yang sama; bila dijalankan paralel memicu deadlock MySQL
    # (error 1213). Prediksi cepat di database, jadi paralel
    # tidak memberi banyak manfaat.
    for source in sources:
        try:
            volcano_id, error = run_prediction(
                int(source.volcano_id),
                source.location_name,
            )

            if error:
                print(
                    f"[PREDICTION ERROR] Volcano ID "
                    f"{volcano_id}: {error}"
                )

        except Exception as error:  # pragma: no cover
            print(f"[PREDICTION WORKER ERROR] {error}")

    elapsed = (datetime.now() - started).total_seconds()

    print("=" * 60)
    print("SEMUA JOB SELESAI")
    print(f"Durasi siklus : {elapsed:.1f} detik")
    print("=" * 60)


if __name__ == "__main__":
    while True:
        try:
            run_all_jobs()

        except Exception as error:
            print("Scheduler error:")
            print(error)

        print("\nMenunggu 5 menit sebelum menjalankan kembali...")
        time.sleep(300)
