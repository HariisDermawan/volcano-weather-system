from sqlalchemy import text

from app.collectors.activity_collector import (
    get_volcano_reports,
    parse_volcano_detail,
)
from app.database.connection import SessionLocal


def sync_activities():
    reports = get_volcano_reports()

    print("=" * 70)
    print("SYNC AKTIVITAS MAGMA")
    print("=" * 70)
    print(f"Laporan MAGMA : {len(reports)}")

    db = SessionLocal()

    try:
        success = 0
        skipped = 0
        failed = 0

        for index, report in enumerate(
            reports,
            start=1,
        ):
            print()
            print(
                f"[{index}/{len(reports)}] "
                f"{report['name']}"
            )

            try:
                activity = parse_volcano_detail(
                    report["url"]
                )

                if not activity:
                    print("  -> GAGAL PARSE")
                    failed += 1
                    continue

                volcano = db.execute(
                    text(
                        """
                        SELECT id, name
                        FROM volcanoes
                        WHERE name = :name
                        LIMIT 1
                        """
                    ),
                    {
                        "name": activity["name"],
                    },
                ).fetchone()

                if not volcano:
                    print(
                        "  -> VOLCANO TIDAK DITEMUKAN "
                        f"({activity['name']})"
                    )
                    skipped += 1
                    continue

                existing = db.execute(
                    text(
                        """
                        SELECT id
                        FROM eruptions
                        WHERE volcano_id = :volcano_id
                          AND occurred_at = :occurred_at
                        LIMIT 1
                        """
                    ),
                    {
                        "volcano_id": volcano.id,
                        "occurred_at": activity[
                            "occurred_at"
                        ],
                    },
                ).fetchone()

                if existing:
                    db.execute(
                        text(
                            """
                            UPDATE eruptions
                            SET
                                ash_height = :ash_height,
                                activity_level = :activity_level,
                                description = :description,
                                updated_at = NOW()
                            WHERE id = :id
                            """
                        ),
                        {
                            "id": existing.id,
                            "ash_height": activity[
                                "ash_height"
                            ],
                            "activity_level": activity[
                                "activity_level"
                            ],
                            "description": activity[
                                "description"
                            ],
                        },
                    )

                    print(
                        "  -> UPDATE"
                    )

                else:
                    db.execute(
                        text(
                            """
                            INSERT INTO eruptions (
                                volcano_id,
                                occurred_at,
                                ash_height,
                                activity_level,
                                description,
                                created_at,
                                updated_at
                            )
                            VALUES (
                                :volcano_id,
                                :occurred_at,
                                :ash_height,
                                :activity_level,
                                :description,
                                NOW(),
                                NOW()
                            )
                            """
                        ),
                        {
                            "volcano_id": volcano.id,
                            "occurred_at": activity[
                                "occurred_at"
                            ],
                            "ash_height": activity[
                                "ash_height"
                            ],
                            "activity_level": activity[
                                "activity_level"
                            ],
                            "description": activity[
                                "description"
                            ],
                        },
                    )

                    print(
                        "  -> INSERT"
                    )

                success += 1

            except Exception as error:
                print(
                    f"  -> ERROR: {error}"
                )
                failed += 1

        db.commit()

        print()
        print("=" * 70)
        print("SYNC AKTIVITAS SELESAI")
        print("=" * 70)
        print(f"Berhasil : {success}")
        print(f"Skip     : {skipped}")
        print(f"Gagal    : {failed}")
        print("=" * 70)

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()


if __name__ == "__main__":
    sync_activities()