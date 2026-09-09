from app.database.connection import SessionLocal
from sqlalchemy import text

db = SessionLocal()

try:
    total = db.execute(
        text("SELECT COUNT(*) FROM eruptions")
    ).scalar()

    distinct_volcanoes = db.execute(
        text(
            "SELECT COUNT(DISTINCT volcano_id) "
            "FROM eruptions"
        )
    ).scalar()

    print(f"Total activity : {total}")
    print(f"Gunung punya activity : {distinct_volcanoes}")

finally:
    db.close()