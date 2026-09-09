from app.database.connection import SessionLocal
from sqlalchemy import text

db = SessionLocal()

try:
    result = db.execute(
        text(
            "SELECT COUNT(*) "
            "FROM volcano_weather_sources "
            "WHERE source = 'BMKG'"
        )
    ).scalar()

    print(f"Total mapping BMKG: {result}")

finally:
    db.close()