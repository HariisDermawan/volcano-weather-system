import re
from datetime import datetime

import requests
from bs4 import BeautifulSoup
from sqlalchemy import text

from app.database.connection import SessionLocal


URL = "https://geologi.esdm.go.id/media-center/perkembangan-erupsi-gunungapi-anak-krakatau-tanggal-7-september-2026"

VOLCANO_ID = 1


def get_volcano_report():
    response = requests.get(
        URL,
        timeout=30,
        headers={
            "User-Agent": "VolcanoMonitoringSystem/1.0"
        },
    )

    response.raise_for_status()

    return response.text


def parse_volcano_report(html: str):
    soup = BeautifulSoup(html, "html.parser")

    text = soup.get_text(" ", strip=True)

    # Status aktivitas
    status_match = re.search(
        r"Level\s+(I{1,3}|IV)\s*\(([^)]+)\)",
        text,
        re.IGNORECASE,
    )

    status_level = None
    status_name = None

    if status_match:
        status_level = status_match.group(1).upper()
        status_name = status_match.group(2).strip()

    # Aktivitas visual
    visual_match = re.search(
        r"Pengamatan Visual(.*?)(?=II\.\s*Pengamatan Instrumental)",
        text,
        re.IGNORECASE,
    )

    visual_observation = (
        visual_match.group(1).strip()
        if visual_match
        else None
    )

    # Aktivitas instrumental
    instrumental_match = re.search(
        r"II\.\s*Pengamatan Instrumental(.*?)(?=III\.|IV\.)",
        text,
        re.IGNORECASE,
    )

    instrumental_observation = (
        instrumental_match.group(1).strip()
        if instrumental_match
        else None
    )

    # Rekomendasi
    recommendation_match = re.search(
        r"IV\.\s*Rekomendasi(.*)",
        text,
        re.IGNORECASE,
    )

    recommendation = (
        recommendation_match.group(1).strip()
        if recommendation_match
        else None
    )

    # Tanggal laporan
    date_match = re.search(
        r"tanggal\s+(\d{1,2}\s+\w+\s+\d{4})\s+pukul\s+(\d{2}\.\d{2})\s+WIB",
        text,
        re.IGNORECASE,
    )

    report_date = None

    if date_match:
        report_date = (
            f"{date_match.group(1)} "
            f"{date_match.group(2)} WIB"
        )

    return {
        "volcano_name": "Gunung Anak Krakatau",
        "status_level": status_level,
        "status_name": status_name,
        "report_date": report_date,
        "visual_observation": visual_observation,
        "instrumental_observation": instrumental_observation,
        "recommendation": recommendation,
    }


def save_volcano_report(data: dict):
    db = SessionLocal()

    try:
        # Pastikan data gunung tersedia
        volcano = db.execute(
            text("""
                SELECT id, name
                FROM volcanoes
                WHERE id = :volcano_id
                LIMIT 1
            """),
            {
                "volcano_id": VOLCANO_ID,
            },
        ).mappings().first()

        if not volcano:
            print("Volcano dengan ID tersebut tidak ditemukan.")
            return

        # Update status gunung
        db.execute(
            text("""
                UPDATE volcanoes
                SET status = :status,
                    updated_at = NOW()
                WHERE id = :volcano_id
            """),
            {
                "status": data["status_name"].lower(),
                "volcano_id": VOLCANO_ID,
            },
        )

        # Parse tanggal laporan
        occurred_at = None

        if data.get("report_date"):
            occurred_at = datetime.strptime(
                data["report_date"],
                "%d %B %Y %H.%M WIB",
            )

        # Simpan aktivitas hanya jika tanggal berhasil ditemukan
        if occurred_at:
            # Cek apakah laporan dengan waktu yang sama
            # sudah pernah disimpan
            existing = db.execute(
                text("""
                    SELECT id
                    FROM eruptions
                    WHERE volcano_id = :volcano_id
                      AND occurred_at = :occurred_at
                    LIMIT 1
                """),
                {
                    "volcano_id": VOLCANO_ID,
                    "occurred_at": occurred_at,
                },
            ).first()

            if existing:
                # Update laporan yang sudah ada
                db.execute(
                    text("""
                        UPDATE eruptions
                        SET activity_level = :activity_level,
                            description = :description,
                            updated_at = NOW()
                        WHERE id = :id
                    """),
                    {
                        "id": existing[0],
                        "activity_level": (
                            f"Level {data['status_level']} - "
                            f"{data['status_name']}"
                        ),
                        "description": data["visual_observation"],
                    },
                )

                eruption_action = "DIUPDATE"

            else:
                # Insert laporan baru
                db.execute(
                    text("""
                        INSERT INTO eruptions (
                            volcano_id,
                            occurred_at,
                            ash_height,
                            activity_level,
                            description,
                            created_at,
                            updated_at
                        )
                        VALUES (
                            :volcano_id,
                            :occurred_at,
                            NULL,
                            :activity_level,
                            :description,
                            NOW(),
                            NOW()
                        )
                    """),
                    {
                        "volcano_id": VOLCANO_ID,
                        "occurred_at": occurred_at,
                        "activity_level": (
                            f"Level {data['status_level']} - "
                            f"{data['status_name']}"
                        ),
                        "description": data["visual_observation"],
                    },
                )

                eruption_action = "DITAMBAHKAN"

        else:
            eruption_action = "TIDAK DISIMPAN - TANGGAL TIDAK DITEMUKAN"

        db.commit()

        print()
        print("=" * 60)
        print("LAPORAN GUNUNG API BERHASIL DIPROSES")
        print("=" * 60)
        print(f"Gunung          : {data['volcano_name']}")
        print(
            f"Status          : Level {data['status_level']} - "
            f"{data['status_name']}"
        )
        print(f"Tanggal laporan : {data['report_date']}")
        print(f"Eruption        : {eruption_action}")
        print(
            "Visual           : "
            f"{'ADA' if data['visual_observation'] else 'TIDAK ADA'}"
        )
        print(
            "Instrumental     : "
            f"{'ADA' if data['instrumental_observation'] else 'TIDAK ADA'}"
        )
        print(
            "Rekomendasi      : "
            f"{'ADA' if data['recommendation'] else 'TIDAK ADA'}"
        )
        print("=" * 60)

    except Exception as error:
        db.rollback()

        print()
        print("GAGAL MENYIMPAN LAPORAN GUNUNG API")
        print(error)

    finally:
        db.close()

