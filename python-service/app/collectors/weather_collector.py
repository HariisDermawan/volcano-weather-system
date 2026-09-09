import time

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


BMKG_URL = "https://api.bmkg.go.id/publik/prakiraan-cuaca"


def create_bmkg_session():
    retry = Retry(
        total=5,
        connect=5,
        read=5,
        status=5,
        backoff_factor=2,
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=["GET"],
        respect_retry_after_header=True,
        raise_on_status=False,
    )

    adapter = HTTPAdapter(
        max_retries=retry
    )

    session = requests.Session()

    session.mount(
        "https://",
        adapter
    )

    session.headers.update({
        "User-Agent": (
            "Mozilla/5.0 "
            "(Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 "
            "Chrome/131.0 Safari/537.36"
        )
    })

    return session


def get_weather(adm4: str):
    session = create_bmkg_session()

    try:
        for attempt in range(1, 4):
            response = session.get(
                BMKG_URL,
                params={"adm4": adm4},
                timeout=30,
            )

            if response.status_code == 200:
                return response.json()

            if response.status_code == 429:
                retry_after = response.headers.get(
                    "Retry-After"
                )

                if retry_after:
                    try:
                        wait_seconds = int(retry_after)
                    except ValueError:
                        wait_seconds = 10
                else:
                    wait_seconds = 10 * attempt

                print(
                    f"BMKG 429 | attempt {attempt}/3 | "
                    f"tunggu {wait_seconds} detik..."
                )

                time.sleep(wait_seconds)
                continue

            response.raise_for_status()

        raise RuntimeError(
            f"BMKG tetap 429 setelah beberapa percobaan "
            f"untuk ADM4 {adm4}"
        )

    finally:
        session.close()


def extract_forecasts(data: dict):
    results = []

    for location in data.get("data", []):
        cuaca = location.get("cuaca", [])

        for forecast_group in cuaca:
            for forecast in forecast_group:
                results.append({
                    "local_datetime": forecast.get(
                        "local_datetime"
                    ),
                    "utc_datetime": forecast.get(
                        "utc_datetime"
                    ),
                    "temperature": forecast.get("t"),
                    "humidity": forecast.get("hu"),
                    "wind_speed": forecast.get("ws"),
                    "wind_direction": forecast.get("wd"),
                    "weather": forecast.get(
                        "weather_desc"
                    ),
                })

    return results
