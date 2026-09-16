











import re
from datetime import datetime, timedelta, timezone

import requests
from bs4 import BeautifulSoup

VAAC_DARWIN_URL = (
    "https://www.bom.gov.au/aviation/warnings/volcanic-ash/"
)

USER_AGENT = (
    "Mozilla/5.0 "
    "(Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 "
    "(KHTML, like Gecko) "
    "Chrome/131.0 Safari/537.36"
)

WIB = timezone(timedelta(hours=7))


def get_volcanic_ash_page():

    response = requests.get(
        VAAC_DARWIN_URL,
        headers={"User-Agent": USER_AGENT},
        timeout=30,
    )
    response.raise_for_status()
    return response.text


def to_plain_text(html):

    soup = BeautifulSoup(html, "html.parser")
    return " ".join(soup.stripped_strings)


DARWIN_24H_MARKER = (
    "FROM DARWIN VAAC - LAST 24 HOURS"
)


def get_darwin_24h_section(text):






    start = text.find(DARWIN_24H_MARKER)
    if start == -1:
        return None

    section = text[start:]



    next_marker = section.find(
        "- LAST 24 HOURS",
        len(DARWIN_24H_MARKER),
    )

    if next_marker != -1:
        section = section[:next_marker]

    return section


def split_darwin_advisories(text):




    section = get_darwin_24h_section(text)
    if not section:
        return []

    parts = section.split("Received FVAU")
    blocks = []

    for part in parts[1:]:
        end = part.find("=")
        block = part if end == -1 else part[:end]
        block = block.strip()
        if block and "VAAC: DARWIN" in block:
            blocks.append(block)

    return blocks


DTG_RE = re.compile(r"DTG:\s*(\d{8})/(\d{4})Z")
VOLCANO_RE = re.compile(r"VOLCANO:\s*(.+?)\s+(\d{6,7})\b")
PSN_RE = re.compile(r"PSN:\s*([NSEW]\d{4})\s+([NSEW]\d{5})")
ADVISORY_NR_RE = re.compile(r"ADVISORY NR:\s*([\d/]+)")
ERUPTION_RE = re.compile(
    r"ERUPTION DETAILS:\s*(.+?)(?=\s*(?:OBS|EST) VA DTG:)"
)
OBS_DTG_RE = re.compile(r"(?:OBS|EST) VA DTG:\s*(\d{2})/(\d{4})Z")
VA_CLD_RE = re.compile(
    r"(?:OBS|EST) VA CLD:\s*(.+?)(?=\s*FCST VA CLD)"
)
FCST_CLD_RE = re.compile(
    r"FCST VA CLD \+(\d+) HR:\s*(?:[\d/]+Z)?\s*"
    r"(.+?)(?=\s*(?:FCST VA CLD \+\d+ HR:|RMK:|NXT ADVISORY))"
)
RMK_RE = re.compile(r"RMK:\s*(.+?)(?=\s*NXT ADVISORY)")
NXT_RE = re.compile(r"NXT ADVISORY:\s*(.+?)\s*$")
FL_RE = re.compile(r"(?:SFC/)?FL(\d{3})")
MOV_RE = re.compile(r"MOV\s+([NSEW]{1,3})(?:\s+(\d{1,3})\s*KT)?")
VA_COORD_RE = re.compile(r"([NSEW])(\d{3,5})")


def azimuth_to_decimal(letter, digits):





    degrees_len = len(digits) - 2

    value = (
        int(digits[:degrees_len])
        + int(digits[degrees_len:]) / 60.0
    )

    return -value if letter in "SW" else value


def extract_va_cloud_geometry(va_cld):






    if not va_cld:
        return None

    upper = va_cld.upper()

    if "NOT IDENTIFIABLE" in upper or "NO VA" in upper:
        return None

    tokens = VA_COORD_RE.findall(upper)

    points = []

    for i in range(0, len(tokens) - 1, 2):
        lat_letter, lat_digits = tokens[i]
        lon_letter, lon_digits = tokens[i + 1]

        latitude = azimuth_to_decimal(
            lat_letter,
            lat_digits,
        )
        longitude = azimuth_to_decimal(
            lon_letter,
            lon_digits,
        )

        points.append([longitude, latitude])

    if len(points) < 3:
        return None

    if points[0] != points[-1]:
        points.append(list(points[0]))

    return {
        "type": "Polygon",
        "coordinates": [points],
    }


def parse_advisory_dtg(raw):

    match = DTG_RE.search(raw)
    if not match:
        return None

    date_part = match.group(1)
    time_part = match.group(2)

    issued_utc = datetime.strptime(
        f"{date_part} {time_part}",
        "%Y%m%d %H%M",
    )

    return issued_utc.replace(tzinfo=timezone.utc)


def parse_obs_dtg(raw, issued_utc):

    match = OBS_DTG_RE.search(raw)
    if not match or not issued_utc:
        return None

    day = int(match.group(1))
    hour = int(match.group(2)[:2])
    minute = int(match.group(2)[2:])

    observed_utc = datetime(
        issued_utc.year,
        issued_utc.month,
        day,
        hour,
        minute,
        tzinfo=timezone.utc,
    )

    return observed_utc


def parse_next_advisory(raw, issued_utc):

    match = NXT_RE.search(raw)
    if not match:
        return None

    value = match.group(1).strip()

    if "NO FURTHER" in value.upper():
        return None

    dteg_match = re.search(r"(\d{8})/(\d{4})Z", value)

    if not dteg_match:
        return None

    next_utc = datetime.strptime(
        f"{dteg_match.group(1)} {dteg_match.group(2)}",
        "%Y%m%d %H%M",
    )

    return next_utc.replace(tzinfo=timezone.utc)


def extract_va_cloud_info(va_cld):

    ash_detected = False
    altitude_ft = None
    movement = None
    speed_kts = None

    if not va_cld:
        return ash_detected, altitude_ft, movement, speed_kts

    upper = va_cld.upper()

    if "NOT IDENTIFIABLE" not in upper and "SFC/" in upper:
        ash_detected = True

        fl_match = FL_RE.search(upper)
        if fl_match:
            altitude_ft = int(fl_match.group(1)) * 100

        mov_match = MOV_RE.search(upper)
        if mov_match:
            movement = mov_match.group(1)
            if mov_match.group(2):
                speed_kts = int(mov_match.group(2))

    return ash_detected, altitude_ft, movement, speed_kts


def extract_fcst_va_cloud_geometries(block):





    geometries = {}

    for match in FCST_CLD_RE.finditer(block):
        hour = int(match.group(1))

        geometry = extract_va_cloud_geometry(match.group(2))

        if geometry:
            geometries[str(hour)] = geometry

    return geometries


def parse_advisory(block):

    issued_utc = parse_advisory_dtg(block)

    volcano_match = VOLCANO_RE.search(block)
    volcano_name = None
    volcano_code = None

    if volcano_match:
        volcano_name = volcano_match.group(1).strip()
        volcano_code = volcano_match.group(2)

    psn_match = PSN_RE.search(block)
    psn = psn_match.group(0).replace("PSN:", "").strip() \
        if psn_match else None

    advisory_nr = None
    nr_match = ADVISORY_NR_RE.search(block)
    if nr_match:
        advisory_nr = nr_match.group(1)

    eruption_detail = None
    eruption_match = ERUPTION_RE.search(block)
    if eruption_match:
        eruption_detail = eruption_match.group(1).strip()

    observed_utc = (
        parse_obs_dtg(block, issued_utc)
        if issued_utc
        else None
    )

    va_cld = None
    cld_match = VA_CLD_RE.search(block)
    if cld_match:
        va_cld = cld_match.group(1).strip()

    ash_detected, altitude_ft, movement, speed_kts = (
        extract_va_cloud_info(va_cld)
    )

    geometry = extract_va_cloud_geometry(va_cld)

    fcst_geometries = extract_fcst_va_cloud_geometries(block)

    remarks = None
    rmk_match = RMK_RE.search(block)
    if rmk_match:
        remarks = rmk_match.group(1).strip()

    next_utc = (
        parse_next_advisory(block, issued_utc)
        if issued_utc
        else None
    )

    issued_wib = (
        issued_utc.astimezone(WIB).replace(tzinfo=None)
        if issued_utc
        else None
    )
    observed_wib = (
        observed_utc.astimezone(WIB).replace(tzinfo=None)
        if observed_utc
        else None
    )
    next_wib = (
        next_utc.astimezone(WIB).replace(tzinfo=None)
        if next_utc
        else None
    )

    altitude_m = (
        round(altitude_ft * 0.3048, 2)
        if altitude_ft
        else None
    )

    return {
        "source": "VAAC Darwin",
        "advisory_nr": advisory_nr,
        "issued_at": issued_wib,
        "observed_at": observed_wib,
        "next_advisory_at": next_wib,
        "volcano_code": volcano_code,
        "volcano_name": volcano_name,
        "psn": psn,
        "ash_detected": ash_detected,
        "altitude_ft": altitude_ft,
        "ash_height_m": altitude_m,
        "movement": movement,
        "speed_kts": speed_kts,
        "geometry": geometry,
        "fcst_geometries": fcst_geometries,
        "eruption_detail": eruption_detail,
        "remarks": remarks,
        "raw_text": block,
    }


def get_darwin_advisories():

    html = get_volcanic_ash_page()
    text = to_plain_text(html)
    blocks = split_darwin_advisories(text)

    advisories = [parse_advisory(block) for block in blocks]

    return [a for a in advisories if a["issued_at"]]


if __name__ == "__main__":
    for advisory in get_darwin_advisories():
        print("=" * 60)
        for key, value in advisory.items():
            print(f"{key:22} : {value}")