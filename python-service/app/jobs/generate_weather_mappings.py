import math
import sqlite3

import requests
from sqlalchemy import text

from app.database.connection import SessionLocal


WILAYAH_DB = r"wilayah-adm4\locations.db"
BMKG_URL = "https://api.bmkg.go.id/publik/prakiraan-cuaca"


def haversine(lat1, lon1, lat2, lon2):
    radius = 6371.0

    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)

    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(d_phi / 2) ** 2
        + math.cos(phi1)
        * math.cos(phi2)
        * math.sin(d_lambda / 2) ** 2
    )

    return 2 * radius * math.asin(math.sqrt(a))


def find_nearest_villages(db, lat, lon, limit=5):
    rows = db.execute(
        """
        SELECT
            kode,
            nama,
            kecamatan,
            kota,
            provinsi,
            lat,
            lon
        FROM locations
        """
    ).fetchall()

    results = []

    for row in rows:
        distance = haversine(
            lat,
            lon,
            row[5],
            row[6],
        )

        results.append({
            "kode": row[0],
            "nama": row[1],
            "kecamatan": row[2],
            "kota": row[3],
            "provinsi": row[4],
            "lat": row[5],
            "lon": row[6],
            "distance_km": distance,
        })

    results.sort(key=lambda item: item["distance_km"])

    return results[:limit]


def validate_bmkg(adm4):
    response = requests.get(
        BMKG_URL,
        params={"adm4": adm4},
        timeout=30,
    )

    if response.status_code != 200:
        return None

    data = response.json()

    locations = data.get("data", [])

    if not locations:
        return None

    location = locations[0].get("lokasi", {})
    forecasts = locations[0].get("cuaca", [])

    forecast_count = sum(len(group) for group in forecasts)

    return {
        "adm4": location.get("adm4"),
        "desa": location.get("desa"),
        "kecamatan": location.get("kecamatan"),
        "kota": location.get("kotkab"),
        "provinsi": location.get("provinsi"),
        "lat": location.get("lat"),
        "lon": location.get("lon"),
        "forecast_count": forecast_count,
    }


def get_volcanoes():
    db = SessionLocal()

    try:
        rows = db.execute(
            text(
                """
                SELECT
                    id,
                    name,
                    latitude,
                    longitude
                FROM volcanoes
                ORDER BY id
                """
            )
        ).fetchall()

        return rows

    finally:
        db.close()


def main():
    wilayah = sqlite3.connect(WILAYAH_DB)

    volcanoes = get_volcanoes()

    print("=" * 80)
    print("GENERATE BMKG WEATHER MAPPING - DRY RUN")
    print("=" * 80)
    print(f"Total gunung : {len(volcanoes)}")
    print()

    success = 0
    failed = 0

    for index, volcano in enumerate(volcanoes, start=1):
        volcano_id = volcano.id
        name = volcano.name
        lat = float(volcano.latitude)
        lon = float(volcano.longitude)

        print(
            f"[{index}/{len(volcanoes)}] "
            f"{name} (ID {volcano_id})"
        )

        candidates = find_nearest_villages(
            wilayah,
            lat,
            lon,
            limit=5,
        )

        selected = None

        for candidate in candidates:
            print(
                f"  kandidat: "
                f"{candidate['nama']} "
                f"({candidate['kode']}) "
                f"{candidate['distance_km']:.2f} km"
            )

            try:
                bmkg = validate_bmkg(candidate["kode"])
            except Exception as error:
                print(f"    BMKG error: {error}")
                continue

            if not bmkg:
                print("    BMKG: INVALID")
                continue

            selected = {
                "candidate": candidate,
                "bmkg": bmkg,
            }

            print(
                f"    BMKG: OK "
                f"({bmkg['forecast_count']} forecast)"
            )

            break

        if selected:
            candidate = selected["candidate"]
            bmkg = selected["bmkg"]

            print(
                f"  => PILIH: "
                f"{bmkg['desa']} "
                f"({bmkg['adm4']}) "
                f"{candidate['distance_km']:.2f} km"
            )

            success += 1

        else:
            print("  => GAGAL: tidak ada kandidat BMKG valid")
            failed += 1

        print()

    wilayah.close()

    print("=" * 80)
    print("DRY RUN SELESAI")
    print(f"Berhasil : {success}")
    print(f"Gagal    : {failed}")
    print("=" * 80)


if __name__ == "__main__":
    main()