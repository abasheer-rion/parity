"""Bring the registry in line with the code (DEC-0064): providers, curated catalog series,
live feeds and lineage. Runs at the start of every registry cycle, so a series added to
catalog.py is in the registry within the hour and one removed from it is retired.
"""

from __future__ import annotations

import sqlite3

from . import db, seed
from .model import Record

#: Fields the services learn. A sync never overwrites them on an existing record.
LEARNED = ("status", "health", "health_checked_at", "health_detail", "quality", "enrolled_at",
           "reason", "discovered_at", "discovered_by")
#: Filled from the last fetch only while the record has no value of its own.
FILL_ONCE = ("start_date", "end_date", "last_obs")


def sync(con: sqlite3.Connection, coverage: dict | None = None) -> dict:
    """Write the seed rows. Returns counts of what changed."""
    out = {"sources": 0, "added": 0, "updated": 0, "retired": 0, "lineage": False}
    with con:
        for s in seed.sources():
            out["sources"] += db.put_source(con, s)
        wanted: set[str] = set()
        for rec in seed.records(coverage):
            wanted.add(rec.id)
            old = db.get(con, rec.id)
            row = rec.row()
            if old is None:
                row["enrolled_at"] = db.now()
                db.put(con, row)
                db.add_event(con, "seeded", series_id=rec.id, source_id=rec.source_id,
                             to_state=rec.status, detail={"origin": rec.origin})
                out["added"] += 1
                continue
            for k in LEARNED:
                row[k] = old.get(k, row[k])
            for k in FILL_ONCE:
                row[k] = old.get(k) or row[k]
            if old["status"] == "retired" and old.get("origin") == rec.origin:
                # Back in the code: enrolled again, and the log says so.
                row["status"] = "enrolled"
                row["reason"] = "back in the catalog"
                db.add_event(con, "status", series_id=rec.id, source_id=rec.source_id,
                             from_state="retired", to_state="enrolled",
                             detail={"reason": "back in the catalog"})
            out["updated"] += db.put(con, row)
        for old in db.all_series(con):
            if old["origin"] in ("catalog", "live") and old["id"] not in wanted \
                    and old["status"] != "retired":
                db.set_status(con, old["id"], "retired", "removed from the code", kind="retired")
                out["retired"] += 1
        out["lineage"] = db.set_lineage(con, seed.lineage())
    return out


def record(row: dict) -> Record:
    return Record(**row)
