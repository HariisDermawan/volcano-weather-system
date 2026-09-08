import math
import sqlite3

import requests
from sqlalchemy import text

from app.database.connection import SessionLocal


WILAYAH_DB = r"wilayah-adm4\locations.db"
BMKG_URL = "https://api.bmkg.go.id/publik/prakiraan-cuaca"

# Jumlah kandidat desa terdekat yang akan diperiksa.
CANDIDATE_LIMIT = 5

# Timeout request BMKG.
REQUEST_TIMEOUT = 30


def haversine(lat1, lon1, lat2, lon2):
    """
    Menghitung jarak dua koordinat menggunakan rumus Haversine.

    Hasil dalam kilometer.
    """
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


def find_nearest_villages(db, lat, lon, limit=CANDIDATE_LIMIT):
    """
    Mencari desa terdekat dari koordinat gunung.

    Sumber data:
    wilayah-adm4/locations.db
    """

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

        results.append(
            {
                "kode": row[0],
                "nama": row[1],
                "kecamatan": row[2],
                "kota": row[3],
                "provinsi": row[4],
                "lat": row[5],
                "lon": row[6],
                "distance_km": distance,
            }
        )

    results.sort(
        key=lambda item: item["distance_km"]
    )

    return results[:limit]


def validate_bmkg(adm4):
    """
    Memvalidasi ADM4 terhadap API BMKG.

    Struktur response BMKG yang digunakan:

    {
        "lokasi": {
            "adm1": "...",
            "adm2": "...",
            "adm3": "...",
            "adm4": "...",
            "provinsi": "...",
            "kotkab": "...",
            "kecamatan": "...",
            "desa": "..."
        },
        "data": [
            {
                "lokasi": {
                    ...
                },
                "cuaca": [
                    [...],
                    [...],
                    [...]
                ]
            }
        ]
    }

    Return:
        dict jika valid
        None jika tidak valid
    """

    try:
        response = requests.get(
            BMKG_URL,
            params={
                "adm4": adm4,
            },
            timeout=REQUEST_TIMEOUT,
        )

        response.raise_for_status()

    except requests.RequestException as error:
        print(f"    BMKG REQUEST ERROR: {error}")
        return None

    try:
        data = response.json()

    except ValueError as error:
        print(f"    BMKG JSON ERROR: {error}")
        return None

    # ---------------------------------------------------------
    # 1. Ambil lokasi dari ROOT response
    # ---------------------------------------------------------

    lokasi = data.get("lokasi")

    if not isinstance(lokasi, dict):
        return None

    returned_adm4 = lokasi.get("adm4")

    if not returned_adm4:
        return None

    # ---------------------------------------------------------
    # 2. Pastikan ADM4 yang dikembalikan BMKG sama
    # ---------------------------------------------------------

    if returned_adm4 != adm4:
        return None

    # ---------------------------------------------------------
    # 3. Ambil data forecast
    # ---------------------------------------------------------

    forecast_data = data.get("data")

    if not isinstance(forecast_data, list):
        return None

    if not forecast_data:
        return None

    # ---------------------------------------------------------
    # 4. Response BMKG memiliki:
    #
    # data[0]["cuaca"]
    #
    # cuaca berbentuk:
    #
    # [
    #     [...],
    #     [...],
    #     [...]
    # ]
    # ---------------------------------------------------------

    first_data = forecast_data[0]

    if not isinstance(first_data, dict):
        return None

    forecast_groups = first_data.get("cuaca")

    if not isinstance(forecast_groups, list):
        return None

    # ---------------------------------------------------------
    # 5. Hitung jumlah forecast
    # ---------------------------------------------------------

    forecast_count = 0

    for forecast_group in forecast_groups:
        if not isinstance(forecast_group, list):
            continue

        forecast_count += len(forecast_group)

    # Tidak ada forecast = mapping tidak valid.
    if forecast_count == 0:
        return None

    # ---------------------------------------------------------
    # 6. Return data mapping
    # ---------------------------------------------------------

    return {
        "adm4": returned_adm4,
        "desa": lokasi.get("desa"),
        "kecamatan": lokasi.get("kecamatan"),
        "kota": lokasi.get("kotkab"),
        "provinsi": lokasi.get("provinsi"),
        "forecast_count": forecast_count,
    }


def get_volcanoes():
    """
    Mengambil seluruh volcano dari MySQL.
    """

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


def save_mapping(
    volcano_id,
    adm4,
    location_name,
):
    """
    Insert atau update mapping BMKG.

    Constraint:
        satu volcano hanya memiliki satu mapping BMKG.
    """

    db = SessionLocal()

    try:
        existing = db.execute(
            text(
                """
                SELECT id
                FROM volcano_weather_sources
                WHERE volcano_id = :volcano_id
                  AND source = 'BMKG'
                LIMIT 1
                """
            ),
            {
                "volcano_id": volcano_id,
            },
        ).fetchone()

        # -----------------------------------------------------
        # UPDATE
        # -----------------------------------------------------

        if existing:
            db.execute(
                text(
                    """
                    UPDATE volcano_weather_sources
                    SET
                        adm4 = :adm4,
                        location_name = :location_name,
                        updated_at = NOW()
                    WHERE id = :id
                    """
                ),
                {
                    "id": existing.id,
                    "adm4": adm4,
                    "location_name": location_name,
                },
            )

            action = "UPDATE"

        # -----------------------------------------------------
        # INSERT
        # -----------------------------------------------------

        else:
            db.execute(
                text(
                    """
                    INSERT INTO volcano_weather_sources (
                        volcano_id,
                        source,
                        adm4,
                        location_name,
                        created_at,
                        updated_at
                    )
                    VALUES (
                        :volcano_id,
                        'BMKG',
                        :adm4,
                        :location_name,
                        NOW(),
                        NOW()
                    )
                    """
                ),
                {
                    "volcano_id": volcano_id,
                    "adm4": adm4,
                    "location_name": location_name,
                },
            )

            action = "INSERT"

        db.commit()

        return action

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()


def main():
    """
    Main process:

    1. Baca 69 volcano dari MySQL.
    2. Cari 5 desa terdekat.
    3. Validasi kandidat ke BMKG.
    4. Pilih kandidat BMKG pertama yang valid.
    5. Simpan mapping ke MySQL.
    """

    wilayah = sqlite3.connect(
        WILAYAH_DB
    )

    try:
        volcanoes = get_volcanoes()

        print("=" * 80)
        print("SAVE BMKG WEATHER MAPPINGS")
        print("=" * 80)
        print(f"Total gunung : {len(volcanoes)}")
        print()

        success = 0
        failed = 0

        for index, volcano in enumerate(
            volcanoes,
            start=1,
        ):
            volcano_id = volcano.id
            name = volcano.name

            lat = float(volcano.latitude)
            lon = float(volcano.longitude)

            print(
                f"[{index}/{len(volcanoes)}] "
                f"{name} (ID {volcano_id})"
            )

            # -------------------------------------------------
            # Cari kandidat desa terdekat
            # -------------------------------------------------

            candidates = find_nearest_villages(
                wilayah,
                lat,
                lon,
                limit=CANDIDATE_LIMIT,
            )

            selected = None

            # -------------------------------------------------
            # Cek kandidat satu per satu ke BMKG
            # -------------------------------------------------

            for candidate in candidates:
                print(
                    f"  cek: "
                    f"{candidate['nama']} "
                    f"({candidate['kode']}) "
                    f"{candidate['distance_km']:.2f} km"
                )

                bmkg = validate_bmkg(
                    candidate["kode"]
                )

                if not bmkg:
                    print(
                        "    BMKG INVALID"
                    )
                    continue

                print(
                    f"    BMKG OK: "
                    f"{bmkg['forecast_count']} forecast"
                )

                selected = {
                    "candidate": candidate,
                    "bmkg": bmkg,
                }

                break

            # -------------------------------------------------
            # Tidak menemukan kandidat
            # -------------------------------------------------

            if not selected:
                print(
                    "  => GAGAL"
                )

                failed += 1
                print()

                continue

            # -------------------------------------------------
            # Ambil hasil kandidat
            # -------------------------------------------------

            candidate = selected["candidate"]
            bmkg = selected["bmkg"]

            location_name = (
                bmkg["desa"]
                or candidate["nama"]
            )

            # -------------------------------------------------
            # Simpan mapping
            # -------------------------------------------------

            try:
                action = save_mapping(
                    volcano_id=volcano_id,
                    adm4=bmkg["adm4"],
                    location_name=location_name,
                )

            except Exception as error:
                print(
                    f"  => DATABASE ERROR: {error}"
                )

                failed += 1
                print()

                continue

            print(
                f"  => {action}: "
                f"{location_name} "
                f"({bmkg['adm4']}) "
                f"{candidate['distance_km']:.2f} km"
            )

            success += 1

            print()

        print("=" * 80)
        print("SELESAI")
        print(f"Berhasil : {success}")
        print(f"Gagal    : {failed}")
        print("=" * 80)

    finally:
        wilayah.close()


if __name__ == "__main__":
    main()

