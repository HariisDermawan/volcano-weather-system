from app.collectors.volcano_collector import sync_volcanoes
from app.jobs.activity_job import sync_activities


def run_volcano_job():
    print("Mengambil laporan aktivitas gunung dari Badan Geologi...")

    sync_volcanoes()
    sync_activities()


if __name__ == "__main__":
    run_volcano_job()
