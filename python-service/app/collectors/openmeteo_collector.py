import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"


def create_openmeteo_session():
    retry = Retry(
        total=3,
        connect=3,
        read=3,
        status=3,
        backoff_factor=1.5,
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=["GET"],
        respect_retry_after_header=True,
        raise_on_status=False,
    )

    adapter = HTTPAdapter(max_retries=retry)

    session = requests.Session()

    session.mount("https://", adapter)

    session.headers.update({
        "User-Agent": (
            "Volcano-Watch/1.0 "
            "(monitoring wilayah gunung api Indonesia)"
        )
    })

    return session


def get_current_weather(latitude, longitude):
    session = create_openmeteo_session()

    try:
        response = session.get(
            OPEN_METEO_URL,
            params={
                "latitude": latitude,
                "longitude": longitude,
                "current": (
                    "temperature_2m,relative_humidity_2m,"
                    "apparent_temperature,wind_speed_10m,"
                    "wind_direction_10m,wind_gusts_10m,"
                    "pressure_msl"
                ),
                "wind_speed_unit": "kmh",
                "timezone": "UTC",
                "forecast_days": 1,
            },
            timeout=30,
        )

        response.raise_for_status()

        return response.json()

    finally:
        session.close()