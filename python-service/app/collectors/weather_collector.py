import requests


BMKG_URL = "https://api.bmkg.go.id/publik/prakiraan-cuaca"


def get_weather(adm4: str):
    response = requests.get(
        BMKG_URL,
        params={
            "adm4": adm4
        },
        timeout=30,
    )

    response.raise_for_status()

    return response.json()


def extract_forecasts(data: dict):
    results = []

    for location in data.get("data", []):
        cuaca = location.get("cuaca", [])

        for forecast_group in cuaca:
            for forecast in forecast_group:
                results.append({
                    "local_datetime": forecast.get("local_datetime"),
                    "utc_datetime": forecast.get("utc_datetime"),
                    "temperature": forecast.get("t"),
                    "humidity": forecast.get("hu"),
                    "wind_speed": forecast.get("ws"),
                    "wind_direction": forecast.get("wd"),
                    "weather": forecast.get("weather_desc"),
                })

    return results
