from app.collectors.volcano_collector import (
    get_volcano_report,
    parse_volcano_report,
    save_volcano_report,
)


def run_volcano_job():
    print("Mengambil laporan aktivitas gunung dari Badan Geologi...")

    html = get_volcano_report()

    data = parse_volcano_report(html)

    save_volcano_report(data)


if __name__ == "__main__":
    run_volcano_job()
