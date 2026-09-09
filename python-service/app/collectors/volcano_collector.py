import re

import requests
from bs4 import BeautifulSoup
from sqlalchemy import text

from app.collectors.name_aliases import (
    normalize_volcano_name,
)
from app.database.connection import SessionLocal


MAGMA_ACTIVITY_URL = (
    "https://magma.esdm.go.id/v1/gunung-api/tingkat-aktivitas"
)


def get_activity_page():
    response = requests.get(
        MAGMA_ACTIVITY_URL,
        timeout=30,
    )
    response.raise_for_status()

    return BeautifulSoup(
        response.text,
        "html.parser",
    )


def get_volcano_reports():
    soup = get_activity_page()

    reports = []

    for link in soup.find_all("a", href=True):
        href = link.get("href", "")

        if "/v1/gunung-api/laporan/" not in href:
            continue

        row = link.find_parent("td")

        if not row:
            continue

        name = row.get_text(" ", strip=True)

        name = name.replace(
            "Lihat laporan",
            "",
        ).strip()

        reports.append({
            "name": name,
            "url": href,
        })

    return reports


def parse_volcano_detail(url):
    response = requests.get(
        url,
        timeout=30,
    )
    response.raise_for_status()

    soup = BeautifulSoup(
        response.text,
        "html.parser",
    )

    text_content = soup.get_text(
        " ",
        strip=True,
    )

    pattern = (
        r"Gunung Api "
        r"([A-Za-zÀ-ÿ0-9 .'-]+?)"
        r" terletak di .*?"
        r"Latitude ([+-]?[0-9.]+).*?"
        r"Longitude ([+-]?[0-9.]+).*?"
        r"ketinggian ([+-]?[0-9]+) mdpl"
    )

    match = re.search(
        pattern,
        text_content,
        re.IGNORECASE,
    )

    if not match:
        return None

    name = normalize_volcano_name(
        match.group(1)
    )

    latitude = float(match.group(2))
    longitude = float(match.group(3))
    elevation = int(match.group(4))

    status_match = re.search(
        r"Level ([IV]+)\s*\(([^)]+)\)",
        text_content,
        re.IGNORECASE,
    )

    status = "normal"

    if status_match:
        level = status_match.group(1).upper()
        status_name = status_match.group(2).strip()

        status = (
            f"Level {level} - {status_name}"
        )

    return {
        "name": name,
        "latitude": latitude,
        "longitude": longitude,
        "elevation": elevation,
        "status": status,
    }


def generate_code(name):
    clean_name = re.sub(
        r"[^A-Za-z0-9 ]",
        "",
        name,
    )

    words = clean_name.split()

    if len(words) == 1:
        return words[0][:3].upper()

    return "".join(
        word[0]
        for word in words
    )[:5].upper()


def sync_volcanoes():
    reports = get_volcano_reports()

    print(
        f"Jumlah laporan MAGMA : {len(reports)}"
    )

    db = SessionLocal()

    try:
        success = 0
        failed = 0

        for index, report in enumerate(
            reports,
            start=1,
        ):
            print(
                f"[{index}/{len(reports)}] "
                f"{report['name']}"
            )

            try:
                volcano = parse_volcano_detail(
                    report["url"]
                )

                if not volcano:
                    print("  -> GAGAL PARSE")
                    failed += 1
                    continue

                code = generate_code(
                    volcano["name"]
                )

                existing = db.execute(
                    text(
                        """
                        SELECT id
                        FROM volcanoes
                        WHERE name = :name
                        LIMIT 1
                        """
                    ),
                    {
                        "name": volcano["name"],
                    },
                ).fetchone()

                if existing:
                    db.execute(
                        text(
                            """
                            UPDATE volcanoes
                            SET
                                code = :code,
                                latitude = :latitude,
                                longitude = :longitude,
                                elevation = :elevation,
                                status = :status,
                                updated_at = NOW()
                            WHERE id = :id
                            """
                        ),
                        {
                            "id": existing.id,
                            "code": code,
                            "latitude": volcano["latitude"],
                            "longitude": volcano["longitude"],
                            "elevation": volcano["elevation"],
                            "status": volcano["status"],
                        },
                    )

                    print(
                        f"  -> UPDATE "
                        f"{volcano['latitude']}, "
                        f"{volcano['longitude']}"
                    )

                else:
                    db.execute(
                        text(
                            """
                            INSERT INTO volcanoes (
                                name,
                                code,
                                latitude,
                                longitude,
                                elevation,
                                status,
                                created_at,
                                updated_at
                            )
                            VALUES (
                                :name,
                                :code,
                                :latitude,
                                :longitude,
                                :elevation,
                                :status,
                                NOW(),
                                NOW()
                            )
                            """
                        ),
                        {
                            "name": volcano["name"],
                            "code": code,
                            "latitude": volcano["latitude"],
                            "longitude": volcano["longitude"],
                            "elevation": volcano["elevation"],
                            "status": volcano["status"],
                        },
                    )

                    print(
                        f"  -> INSERT "
                        f"{volcano['latitude']}, "
                        f"{volcano['longitude']}"
                    )

                success += 1

            except Exception as error:
                print(
                    f"  -> ERROR: {error}"
                )
                failed += 1

        db.commit()

        print()
        print("================================")
        print("SYNC SELESAI")
        print("================================")
        print(f"Berhasil : {success}")
        print(f"Gagal    : {failed}")

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()


if __name__ == "__main__":
    sync_volcanoes()

