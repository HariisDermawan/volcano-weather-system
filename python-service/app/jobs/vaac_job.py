import json

from sqlalchemy import text

from app.collectors.name_aliases import volcano_match_candidates
from app.collectors.vaac_collector import get_darwin_advisories
from app.database.connection import SessionLocal


RETENTION_DAYS = 7


def resolve_volcano_id(db, advisory_name):


    for candidate in volcano_match_candidates(advisory_name):
        row = db.execute(
            text(
                """
                SELECT id
                FROM volcanoes
                WHERE LOWER(name) = LOWER(:candidate)
                ORDER BY id
                LIMIT 1
                """
            ),
            {
                "candidate": candidate,
            },
        ).fetchone()

        if row:
            return row.id


    base = " ".join(advisory_name.split()).lower()

    row = db.execute(
        text(
            """
            SELECT id
            FROM volcanoes
            WHERE LOWER(name) LIKE :pattern
            ORDER BY id
            LIMIT 1
            """
        ),
        {
            "pattern": f"%{base}%",
        },
    ).fetchone()

    return row.id if row else None


def sync_vaac_advisories():
    advisories = get_darwin_advisories()

    print("=" * 70)
    print("SYNC ADVISORY VAAC DARWIN")
    print("=" * 70)
    print(f"Advisory VAAC : {len(advisories)}")

    db = SessionLocal()

    try:
        success = 0
        skipped = 0
        failed = 0

        for index, advisory in enumerate(
            advisories,
            start=1,
        ):
            print()
            print(
                f"[{index}/{len(advisories)}] "
                f"{advisory['volcano_name']} | "
                f"{advisory['issued_at']}"
            )

            try:
                volcano_id = resolve_volcano_id(
                    db,
                    advisory["volcano_name"],
                )

                if not volcano_id:
                    print(
                        "  -> VOLCANO TIDAK DITEMUKAN "
                        f"({advisory['volcano_name']})"
                    )
                    skipped += 1
                    continue

                existing = db.execute(
                    text(
                        """
                        SELECT id
                        FROM ash_advisories
                        WHERE volcano_id = :volcano_id
                          AND issued_at = :issued_at
                        LIMIT 1
                        """
                    ),
                    {
                        "volcano_id": volcano_id,
                        "issued_at": advisory["issued_at"],
                    },
                ).fetchone()

                if existing:
                    db.execute(
                        text(
                            """
                            UPDATE ash_advisories
                            SET
                                advisory_nr = :advisory_nr,
                                observed_at = :observed_at,
                                next_advisory_at = :next_advisory_at,
                                volcano_code = :volcano_code,
                                volcano_name = :volcano_name,
                                ash_detected = :ash_detected,
                                altitude_ft = :altitude_ft,
                                ash_height_m = :ash_height_m,
                                movement = :movement,
                                speed_kts = :speed_kts,
                                geometry = :geometry,
                                fcst_geometries = :fcst_geometries,
                                eruption_detail = :eruption_detail,
                                remarks = :remarks,
                                raw_text = :raw_text,
                                updated_at = NOW()
                            WHERE id = :id
                            """
                        ),
                        {
                            "id": existing.id,
                            "advisory_nr": advisory[
                                "advisory_nr"
                            ],
                            "observed_at": advisory[
                                "observed_at"
                            ],
                            "next_advisory_at": advisory[
                                "next_advisory_at"
                            ],
                            "volcano_code": advisory[
                                "volcano_code"
                            ],
                            "volcano_name": advisory[
                                "volcano_name"
                            ],
                            "ash_detected": advisory[
                                "ash_detected"
                            ],
                            "altitude_ft": advisory[
                                "altitude_ft"
                            ],
                            "ash_height_m": advisory[
                                "ash_height_m"
                            ],
                            "movement": advisory[
                                "movement"
                            ],
                            "speed_kts": advisory[
                                "speed_kts"
                            ],
                            "geometry": json.dumps(
                                advisory["geometry"]
                            ),
                            "fcst_geometries": json.dumps(
                                advisory["fcst_geometries"]
                            ),
                            "eruption_detail": advisory[
                                "eruption_detail"
                            ],
                            "remarks": advisory[
                                "remarks"
                            ],
                            "raw_text": advisory[
                                "raw_text"
                            ],
                        },
                    )

                    print("  -> UPDATE")

                else:
                    db.execute(
                        text(
                            """
                            INSERT INTO ash_advisories (
                                volcano_id,
                                source,
                                advisory_nr,
                                issued_at,
                                observed_at,
                                next_advisory_at,
                                volcano_code,
                                volcano_name,
                                ash_detected,
                                altitude_ft,
                                ash_height_m,
                                movement,
                                speed_kts,
                                geometry,
                                fcst_geometries,
                                eruption_detail,
                                remarks,
                                raw_text,
                                created_at,
                                updated_at
                            )
                            VALUES (
                                :volcano_id,
                                :source,
                                :advisory_nr,
                                :issued_at,
                                :observed_at,
                                :next_advisory_at,
                                :volcano_code,
                                :volcano_name,
                                :ash_detected,
                                :altitude_ft,
                                :ash_height_m,
                                :movement,
                                :speed_kts,
                                :geometry,
                                :fcst_geometries,
                                :eruption_detail,
                                :remarks,
                                :raw_text,
                                NOW(),
                                NOW()
                            )
                            """
                        ),
                        {
                            "volcano_id": volcano_id,
                            "source": advisory["source"],
                            "advisory_nr": advisory[
                                "advisory_nr"
                            ],
                            "issued_at": advisory["issued_at"],
                            "observed_at": advisory[
                                "observed_at"
                            ],
                            "next_advisory_at": advisory[
                                "next_advisory_at"
                            ],
                            "volcano_code": advisory[
                                "volcano_code"
                            ],
                            "volcano_name": advisory[
                                "volcano_name"
                            ],
                            "ash_detected": advisory[
                                "ash_detected"
                            ],
                            "altitude_ft": advisory[
                                "altitude_ft"
                            ],
                            "ash_height_m": advisory[
                                "ash_height_m"
                            ],
                            "movement": advisory[
                                "movement"
                            ],
                            "speed_kts": advisory[
                                "speed_kts"
                            ],
                            "geometry": json.dumps(
                                advisory["geometry"]
                            ),
                            "fcst_geometries": json.dumps(
                                advisory["fcst_geometries"]
                            ),
                            "eruption_detail": advisory[
                                "eruption_detail"
                            ],
                            "remarks": advisory[
                                "remarks"
                            ],
                            "raw_text": advisory[
                                "raw_text"
                            ],
                        },
                    )

                    print("  -> INSERT")

                success += 1

            except Exception as error:
                print(f"  -> ERROR: {error}")
                failed += 1


        db.execute(
            text(
                """
                DELETE FROM ash_advisories
                WHERE issued_at < NOW() - INTERVAL :days DAY
                """
            ),
            {
                "days": RETENTION_DAYS,
            },
        )

        db.commit()

        print()
        print("=" * 70)
        print("SYNC ADVISORY VAAC SELESAI")
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
    sync_vaac_advisories()