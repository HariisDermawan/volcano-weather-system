import requests


BMKG_URL = "https://api.bmkg.go.id/publik/prakiraan-cuaca"


def get_wind(adm4: str):
    params = {
        "adm4": adm4
    }

    response = requests.get(
        BMKG_URL,
        params=params,
        timeout=30
    )

    response.raise_for_status()

    data = response.json()

    return data
