import math
import sqlite3
import time

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from sqlalchemy import text

from app.database.connection import SessionLocal


WILAYAH_DB = r"wilayah-adm4\locations.db"
BMKG_URL = "https://api.bmkg.go.id/publik/prakiraan-cuaca"

CANDIDATE_LIMIT = 5
REQUEST_TIMEOUT = 30

# Retry per request BMKG
BMKG_RETRY_TOTAL = 4
BMKG_BACKOFF_FACTOR = 1.0

# Jeda kecil antar request agar tidak terlalu agresif
REQUEST_DELAY = 0.3


def create_bmkg_session():
    """
    Membuat HTTP session dengan automatic retry.
    """

    retry = Retry(
        total=BMKG_RETRY_TOTAL,
        connect=BMKG_RETRY_TOTAL,
        read=BMKG_RETRY_TOTAL,
        status=BMKG_RETRY_TOTAL,
        backoff_factor=BMKG_BACKOFF_FACTOR,
        status_forcelist=[
            429,
            500,
            502,
            503,
            504,
        ],
        allowed_methods=["GET"],
        raise_on_status=False,
    )

    adapter = HTTPAdapter(
        max_retries=retry
    )

    session = requests.Session()

    session.mount(
        "https://",
        adapter,
    )

    session.mount(
        "http://",
        adapter,
    )

    session.headers.update(
        {
            "Accept": "application/json",
            "User-Agent": "VolcanoWeatherSystem/1.0",
        }
    )

    return session


def haversine(lat1, lon1, lat2, lon2):
    """
    Menghitung jarak dua koordinat dalam kilometer.
    """

    radius = 6371.0

    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)

    d_phi = math.radians(
        lat2 - lat1
    )

    d_lambda = math.radians(
        lon2 - lon1
    )

    a = (
        math.sin(d_phi / 2) ** 2
        + math.cos(phi1)
        * math.cos(phi2)
        * math.sin(d_lambda / 2) ** 2
    )

    return (
        2
        * radius
        * math.asin(
            math.sqrt(a)
        )
    )


def find_nearest_villages(
    db,
    lat,
    lon,
    limit=CANDIDATE_LIMIT,
):
    """
    Mencari desa terdekat dari koordinat gunung.
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
        key=lambda item: item[
            "distance_km"
        ]
    )

    return results[:limit]


def validate_bmkg(
    session,
    adm4,
):
    """
    Validasi ADM4 ke API BMKG.

    Return:
        dict -> valid
        None -> tidak valid / gagal
    """

    try:
        response = session.get(
            BMKG_URL,
            params={
                "adm4": adm4,
            },
            timeout=REQUEST_TIMEOUT,
        )

    except requests.RequestException as error:
        print(
            f"    BMKG CONNECTION ERROR: "
            f"{error}"
        )
        return None

    # Setelah retry selesai, tetap bukan sukses.
    if response.status_code != 200:
        print(
            f"    BMKG HTTP ERROR: "
            f"{response.status_code}"
        )
        return None

    try:
        data = response.json()

    except ValueError as error:
        print(
            f"    BMKG JSON ERROR: "
            f"{error}"
        )
        return None

    # ============================================
    # ROOT LOKASI
    # ============================================

    lokasi = data.get(
        "lokasi"
    )

    if not isinstance(
        lokasi,
        dict,
    ):
        return None

    returned_adm4 = lokasi.get(
        "adm4"
    )

    if not returned_adm4:
        return None

    # Pastikan kode yang dikembalikan BMKG
    # benar-benar sama.
    if returned_adm4 != adm4:
        print(
            f"    BMKG ADM4 MISMATCH: "
            f"{returned_adm4}"
        )
        return None

    # ============================================
    # FORECAST DATA
    # ============================================

    forecast_data = data.get(
        "data"
    )

    if not isinstance(
        forecast_data,
        list,
    ):
        return None

    if len(
        forecast_data
    ) == 0:
        return None

    first_data = forecast_data[0]

    if not isinstance(
        first_data,
        dict,
    ):
        return None

    forecast_groups = first_data.get(
        "cuaca"
    )

    if not isinstance(
        forecast_groups,
        list,
    ):
        return None

    # ============================================
    # HITUNG FORECAST
    # ============================================

    forecast_count = 0

    for group in forecast_groups:
        if isinstance(
            group,
            list,
        ):
            forecast_count += len(
                group
            )

    if forecast_count == 0:
        return None

    # ============================================
    # VALID
    # ============================================

    return {
        "adm4": returned_adm4,
        "desa": lokasi.get(
            "desa"
        ),
        "kecamatan": lokasi.get(
            "kecamatan"
        ),
        "kota": lokasi.get(
            "kotkab"
        ),
        "provinsi": lokasi.get(
            "provinsi"
        ),
        "forecast_count": forecast_count,
    }


def get_volcanoes():
    """
    Mengambil daftar gunung dari MySQL.
    """

    db = SessionLocal()

    try:
        return db.execute(
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

    finally:
        db.close()


def save_mapping(
    volcano_id,
    adm4,
    location_name,
):
    """
    Insert atau update mapping BMKG.
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

        # ========================================
        # UPDATE
        # ========================================

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

        # ========================================
        # INSERT
        # ========================================

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

    wilayah = sqlite3.connect(
        WILAYAH_DB
    )

    bmkg_session = create_bmkg_session()

    try:
        volcanoes = get_volcanoes()

        print("=" * 80)
        print(
            "SAVE BMKG WEATHER MAPPINGS"
        )
        print("=" * 80)

        print(
            f"Total gunung : "
            f"{len(volcanoes)}"
        )

        print()

        success = 0
        failed = 0

        failed_volcanoes = []

        for index, volcano in enumerate(
            volcanoes,
            start=1,
        ):

            volcano_id = volcano.id
            name = volcano.name

            lat = float(
                volcano.latitude
            )

            lon = float(
                volcano.longitude
            )

            print(
                f"[{index}/{len(volcanoes)}] "
                f"{name} "
                f"(ID {volcano_id})"
            )

            # ====================================
            # Cari kandidat desa terdekat
            # ====================================

            candidates = (
                find_nearest_villages(
                    wilayah,
                    lat,
                    lon,
                    limit=CANDIDATE_LIMIT,
                )
            )

            selected = None

            # ====================================
            # Cek kandidat
            # ====================================

            for candidate in candidates:

                print(
                    f"  cek: "
                    f"{candidate['nama']} "
                    f"({candidate['kode']}) "
                    f"{candidate['distance_km']:.2f} km"
                )

                bmkg = validate_bmkg(
                    bmkg_session,
                    candidate[
                        "kode"
                    ],
                )

                # Beri jeda antar request
                time.sleep(
                    REQUEST_DELAY
                )

                if not bmkg:

                    print(
                        "    BMKG INVALID"
                    )

                    continue

                print(
                    f"    BMKG OK "
                    f"({bmkg['forecast_count']} forecast)"
                )

                selected = {
                    "candidate": candidate,
                    "bmkg": bmkg,
                }

                break

            # ====================================
            # Tidak ada kandidat valid
            # ====================================

            if not selected:

                print(
                    "  => GAGAL"
                )

                failed += 1

                failed_volcanoes.append(
                    {
                        "id": volcano_id,
                        "name": name,
                        "lat": lat,
                        "lon": lon,
                    }
                )

                print()

                continue

            # ====================================
            # Kandidat berhasil ditemukan
            # ====================================

            candidate = selected[
                "candidate"
            ]

            bmkg = selected[
                "bmkg"
            ]

            location_name = (
                bmkg["desa"]
                or candidate["nama"]
            )

            # ====================================
            # Simpan mapping
            # ====================================

            try:

                action = save_mapping(
                    volcano_id=volcano_id,
                    adm4=bmkg["adm4"],
                    location_name=location_name,
                )

            except Exception as error:

                print(
                    f"  => DATABASE ERROR: "
                    f"{error}"
                )

                failed += 1

                failed_volcanoes.append(
                    {
                        "id": volcano_id,
                        "name": name,
                        "lat": lat,
                        "lon": lon,
                    }
                )

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

        # ========================================
        # SUMMARY
        # ========================================

        print(
            "=" * 80
        )

        print(
            "SELESAI"
        )

        print(
            f"Berhasil : {success}"
        )

        print(
            f"Gagal    : {failed}"
        )

        print(
            "=" * 80
        )

        # ========================================
        # DETAIL YANG GAGAL
        # ========================================

        if failed_volcanoes:

            print()
            print(
                "DETAIL GUNUNG YANG GAGAL"
            )

            print(
                "=" * 80
            )

            for volcano in (
                failed_volcanoes
            ):

                print(
                    f"ID {volcano['id']} | "
                    f"{volcano['name']} | "
                    f"lat={volcano['lat']} | "
                    f"lon={volcano['lon']}"
                )

    finally:

        wilayah.close()

        bmkg_session.close()


if __name__ == "__main__":
    main()

