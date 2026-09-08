import re
from datetime import datetime

import requests
from bs4 import BeautifulSoup


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


def normalize_volcano_name(name):
    name = name.strip()

    if name == "Anak Krakatau":
        return "Gunung Anak Krakatau"

    return name


def extract_section(
    text_content,
    section_name,
    next_sections,
):
    pattern = (
        re.escape(section_name)
        + r"\s*(.*?)"
        + r"(?="
        + "|".join(
            re.escape(section)
            for section in next_sections
        )
        + r"|Copyright|$)"
    )

    match = re.search(
        pattern,
        text_content,
        re.IGNORECASE | re.DOTALL,
    )

    if not match:
        return None

    value = match.group(1).strip()

    value = re.sub(
        r"\s+",
        " ",
        value,
    )

    return value or None


def parse_report_datetime(text_content):
    pattern = (
        r"Laporan Aktivitas Gunung Api - "
        r".*?,\s*"
        r"(Senin|Selasa|Rabu|Kamis|Jumat|Sabtu|Minggu)"
        r"\s*-\s*"
        r"(\d{2})\s+"
        r"(Januari|Februari|Maret|April|Mei|Juni|Juli|"
        r"Agustus|September|Oktober|November|Desember)"
        r"\s+"
        r"(\d{4}),\s*"
        r"periode\s*"
        r"(\d{2}):(\d{2})-"
        r"(\d{2}):(\d{2})\s*"
        r"(WIB|WITA|WIT)"
    )

    match = re.search(
        pattern,
        text_content,
        re.IGNORECASE,
    )

    if not match:
        return None

    month_map = {
        "januari": 1,
        "februari": 2,
        "maret": 3,
        "april": 4,
        "mei": 5,
        "juni": 6,
        "juli": 7,
        "agustus": 8,
        "september": 9,
        "oktober": 10,
        "november": 11,
        "desember": 12,
    }

    day = int(match.group(2))
    month = month_map[
        match.group(3).lower()
    ]
    year = int(match.group(4))

    hour = int(match.group(5))
    minute = int(match.group(6))

    return datetime(
        year,
        month,
        day,
        hour,
        minute,
    )


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

    volcano_pattern = (
        r"Gunung Api "
        r"([A-Za-zÀ-ÿ0-9 .'-]+?)"
        r" terletak di .*?"
        r"Latitude ([+-]?[0-9.]+).*?"
        r"Longitude ([+-]?[0-9.]+).*?"
        r"ketinggian ([+-]?[0-9]+) mdpl"
    )

    volcano_match = re.search(
        volcano_pattern,
        text_content,
        re.IGNORECASE,
    )

    if not volcano_match:
        return None

    name = normalize_volcano_name(
        volcano_match.group(1)
    )

    status_match = re.search(
        r"Level ([IV]+)\s*\(([^)]+)\)",
        text_content,
        re.IGNORECASE,
    )

    activity_level = None

    if status_match:
        level = status_match.group(1).upper()
        status_name = status_match.group(2).strip()

        activity_level = (
            f"Level {level} - {status_name}"
        )

    occurred_at = parse_report_datetime(
        text_content
    )

    visual = extract_section(
        text_content,
        "Pengamatan Visual",
        [
            "Keterangan Lainnya",
            "Klimatologi",
            "Pengamatan Kegempaan",
            "Rekomendasi",
        ],
    )

    other = extract_section(
        text_content,
        "Keterangan Lainnya",
        [
            "Klimatologi",
            "Pengamatan Kegempaan",
            "Rekomendasi",
        ],
    )

    climatology = extract_section(
        text_content,
        "Klimatologi",
        [
            "Pengamatan Kegempaan",
            "Rekomendasi",
        ],
    )

    seismic = extract_section(
        text_content,
        "Pengamatan Kegempaan",
        [
            "Rekomendasi",
        ],
    )

    descriptions = [
        value
        for value in [
            visual,
            other,
            climatology,
            seismic,
        ]
        if value
    ]

    description = "\n".join(
        descriptions
    ) if descriptions else None

    return {
        "name": name,
        "occurred_at": occurred_at,
        "activity_level": activity_level,
        "ash_height": None,
        "description": description,
    }


if __name__ == "__main__":
    reports = get_volcano_reports()

    print(
        f"Jumlah laporan MAGMA: {len(reports)}"
    )

    for report in reports[:5]:
        print()
        print("=" * 60)
        print(report["name"])
        print("=" * 60)

        data = parse_volcano_detail(
            report["url"]
        )

        if not data:
            print("GAGAL PARSE")
            continue

        print(
            "Occurred at   :",
            data["occurred_at"],
        )
        print(
            "Activity      :",
            data["activity_level"],
        )
        print(
            "Description   :",
            data["description"],
        )