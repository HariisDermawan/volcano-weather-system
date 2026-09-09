from app.database.connection import SessionLocal
from sqlalchemy import text

db = SessionLocal()

try:
    rows = db.execute(
        text("""
            SELECT
                v.id,
                v.name,
                v.status,
                e.occurred_at,
                e.activity_level
            FROM volcanoes v
            LEFT JOIN eruptions e
                ON e.volcano_id = v.id
                AND e.occurred_at = (
                    SELECT MAX(e2.occurred_at)
                    FROM eruptions e2
                    WHERE e2.volcano_id = v.id
                )
            ORDER BY v.name
        """)
    ).fetchall()

    print("=" * 100)
    print("STATUS AKTIVITAS GUNUNG")
    print("=" * 100)

    for row in rows:
        print(
            f"{row.id:>3} | "
            f"{row.name:<30} | "
            f"VOLCANO: {row.status:<22} | "
            f"ACTIVITY: {row.activity_level}"
        )

finally:
    db.close()