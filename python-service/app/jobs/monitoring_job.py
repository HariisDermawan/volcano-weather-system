from app.collectors.weather_collector import (
    get_weather,
    extract_forecasts,
)
from app.database.connection import SessionLocal
from sqlalchemy import text




BMKG_ADM4 = "31.71.03.1001"



VOLCANO_ID = 1


def run_weather_collection():
    data = get_weather(BMKG_ADM4)

    forecasts = extract_forecasts(data)

    db = SessionLocal()

    try:
        for forecast in forecasts:
            db.execute(
                text("""
                    INSERT INTO weather_forecasts (
                        volcano_id,
                        source,
                        forecast_at,
                        temperature,
                        humidity,
                        wind_speed,
                        wind_direction,
                        weather,
                        created_at,
                        updated_at
                    )
                    VALUES (
                        :volcano_id,
                        :source,
                        :forecast_at,
                        :temperature,
                        :humidity,
                        :wind_speed,
                        :wind_direction,
                        :weather,
                        NOW(),
                        NOW()
                    )
                """),
                {
                    "volcano_id": VOLCANO_ID,
                    "source": "BMKG",
                    "forecast_at": forecast["local_datetime"],
                    "temperature": forecast["temperature"],
                    "humidity": forecast["humidity"],
                    "wind_speed": forecast["wind_speed"],
                    "wind_direction": forecast["wind_direction"],
                    "weather": forecast["weather"],
                },
            )

        db.commit()

        print(f"Berhasil menyimpan {len(forecasts)} forecast BMKG.")

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()
