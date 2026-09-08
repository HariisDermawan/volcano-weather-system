import time

from app.jobs.weather_job import save_weather_forecasts
from app.jobs.volcano_job import run_volcano_job
from app.jobs.ash_job import generate_prediction


PULAU_SEBESI_ADM4 = "18.01.16.2014"
ANAK_KRAKATAU_ID = 1


def run_all_jobs():
    print("\n" + "=" * 60)
    print("MENJALANKAN SEMUA JOB MONITORING")
    print("=" * 60)

    # 1. Ambil laporan aktivitas gunung
    run_volcano_job()

    # 2. Ambil forecast cuaca BMKG
    save_weather_forecasts(
        volcano_id=ANAK_KRAKATAU_ID,
        adm4=PULAU_SEBESI_ADM4,
    )

    # 3. Buat prediksi sebaran abu
    generate_prediction(
        volcano_id=ANAK_KRAKATAU_ID,
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
