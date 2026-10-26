"""The registry's working copy on the machine that runs the services (DEC-0064).

A SQLite file, engine/output/registry.db, next to search.db and sims.db. Every change marks
the row to be sent; `publish` sends marked rows and new events to Supabase, which holds the
registry of record for the site. The event log is append-only here as well: triggers refuse
any update or delete, and the send position is kept apart from the rows.
"""

from __future__ import annotations

import hashlib
import json
import os
import sqlite3
import uuid
from datetime import UTC, datetime
from pathlib import Path

from ..data import catalog
from .model import Record, Source, check_record, check_source

OUT = Path(__file__).resolve().parents[3] / "output"
DB = Path(os.environ.get("PARITY_REGISTRY_DB", OUT / "registry.db"))

SCHEMA = """
CREATE TABLE IF NOT EXISTS sources (id TEXT PRIMARY KEY, row TEXT NOT NULL,
  dirty INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS series (id TEXT PRIMARY KEY, source_id TEXT NOT NULL,
  status TEXT NOT NULL, origin TEXT NOT NULL, row TEXT NOT NULL,
  dirty INTEGER NOT NULL DEFAULT 1);
CREATE INDEX IF NOT EXISTS series_status ON series (status, origin);
CREATE TABLE IF NOT EXISTS lineage (series_id TEXT NOT NULL, kind TEXT NOT NULL,
  consumer TEXT NOT NULL, PRIMARY KEY (series_id, kind, consumer));
CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY, event_key TEXT NOT NULL UNIQUE,
  at TEXT NOT NULL, series_id TEXT, source_id TEXT, kind TEXT NOT NULL, from_state TEXT,
  to_state TEXT, detail TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS events_series ON events (series_id, id);
CREATE TRIGGER IF NOT EXISTS events_no_update BEFORE UPDATE ON events
  BEGIN SELECT RAISE(ABORT, 'events are append-only'); END;
CREATE TRIGGER IF NOT EXISTS events_no_delete BEFORE DELETE ON events
  BEGIN SELECT RAISE(ABORT, 'events are append-only'); END;
CREATE TABLE IF NOT EXISTS uptime (scope TEXT NOT NULL, id TEXT NOT NULL, day TEXT NOT NULL,
  checks INTEGER NOT NULL DEFAULT 0, ok INTEGER NOT NULL DEFAULT 0,
  late INTEGER NOT NULL DEFAULT 0, stale INTEGER NOT NULL DEFAULT 0,
  down INTEGER NOT NULL DEFAULT 0, dirty INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (scope, id, day));
CREATE TABLE IF NOT EXISTS previews (series_id TEXT PRIMARY KEY, points TEXT NOT NULL,
  dirty INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS backtests (series_id TEXT PRIMARY KEY, ran_at TEXT NOT NULL,
  trials INTEGER NOT NULL, battery TEXT NOT NULL, dirty INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS fetch_log (at TEXT NOT NULL, source_id TEXT NOT NULL,
  series_id TEXT, ok INTEGER NOT NULL, seconds REAL NOT NULL, error TEXT);
CREATE INDEX IF NOT EXISTS fetch_log_at ON fetch_log (source_id, at);
CREATE TABLE IF NOT EXISTS state (key TEXT PRIMARY KEY, value TEXT NOT NULL)
"""


def now() -> str:
    return datetime.now(UTC).isoformat(timespec="seconds")


def connect(path: Path | None = None) -> sqlite3.Connection:
    path = Path(path or DB)
    path.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(path, timeout=30)
    con.execute("PRAGMA journal_mode=WAL")
    con.executescript(SCHEMA)
    return con


def get_state(con: sqlite3.Connection, key: str, default: str | None = None) -> str | None:
    row = con.execute("SELECT value FROM state WHERE key = ?", (key,)).fetchone()
    return row[0] if row else default


def set_state(con: sqlite3.Connection, key: str, value) -> None:
    con.execute("INSERT INTO state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET "
                "value = excluded.value", (key, str(value)))


# ------------------------------------------------------------------ events

def clip(value, depth: int = 0):
    """A copy small enough for the public detail columns: strings cut to 200 characters with
    key values blanked, lists to 10 items, objects to 16 keys, three levels deep. Cuts values,
    never the JSON text, so the result always parses."""
    from ..data.sources import redact

    if isinstance(value, str):
        return redact(value)[:200]
    if isinstance(value, dict):
        if depth >= 3:
            return {}
        return {str(k)[:40]: clip(v, depth + 1) for k, v in list(value.items())[:16]}
    if isinstance(value, (list, tuple)):
        return [clip(v, depth + 1) for v in list(value)[:10]] if depth < 3 else []
    if isinstance(value, float):
        return round(value, 6)
    return value if value is None or isinstance(value, (bool, int)) else str(value)[:200]


def add_event(con: sqlite3.Connection, kind: str, series_id: str | None = None,
              source_id: str | None = None, from_state: str | None = None,
              to_state: str | None = None, detail: dict | None = None) -> str:
    """Append one event. Never changes or removes an old one."""
    key = uuid.uuid4().hex[:24]
    con.execute("INSERT INTO events (event_key, at, series_id, source_id, kind, from_state, "
                "to_state, detail) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (key, now(), series_id, source_id, kind, from_state, to_state,
                 json.dumps(clip(detail or {}))))
    return key


def events(con: sqlite3.Connection, series_id: str | None = None, limit: int = 50) -> list[dict]:
    q = "SELECT id, event_key, at, series_id, source_id, kind, from_state, to_state, detail " \
        "FROM events"
    args: tuple = ()
    if series_id:
        q += " WHERE series_id = ?"
        args = (series_id,)
    rows = con.execute(q + " ORDER BY id DESC LIMIT ?", (*args, limit)).fetchall()
    cols = ("id", "event_key", "at", "series_id", "source_id", "kind", "from_state", "to_state",
            "detail")
    return [dict(zip(cols, r[:-1], strict=False)) | {"detail": json.loads(r[-1])} for r in rows]


# ------------------------------------------------------------------ sources and series

def put_source(con: sqlite3.Connection, s: Source) -> bool:
    """Insert or update a source. Returns True when anything changed; a change to the licence,
    rights or terms date is logged as a licence event."""
    check_source(s)
    row = s.row()
    old = con.execute("SELECT row FROM sources WHERE id = ?", (s.id,)).fetchone()
    if old and json.loads(old[0]) == row:
        return False
    before = json.loads(old[0]) if old else {}
    con.execute("INSERT INTO sources (id, row, dirty) VALUES (?, ?, 1) ON CONFLICT(id) DO UPDATE "
                "SET row = excluded.row, dirty = 1", (s.id, json.dumps(row)))
    changed = {k: row[k] for k in ("licence", "display_rights", "terms_url", "terms_read_on")
               if before.get(k) != row[k]}
    if changed:
        add_event(con, "licence", source_id=s.id, from_state=before.get("display_rights"),
                  to_state=row["display_rights"], detail=changed)
    return True


def sources(con: sqlite3.Connection) -> list[dict]:
    return [json.loads(r[0]) for r in con.execute("SELECT row FROM sources ORDER BY id")]


def get(con: sqlite3.Connection, series_id: str) -> dict | None:
    row = con.execute("SELECT row FROM series WHERE id = ?", (series_id,)).fetchone()
    return json.loads(row[0]) if row else None


def all_series(con: sqlite3.Connection, status: str | tuple[str, ...] | None = None,
               origin: str | None = None) -> list[dict]:
    q, args = "SELECT row FROM series WHERE 1 = 1", []
    if status:
        sts = (status,) if isinstance(status, str) else status
        q += f" AND status IN ({', '.join('?' * len(sts))})"
        args += list(sts)
    if origin:
        q += " AND origin = ?"
        args.append(origin)
    return [json.loads(r[0]) for r in con.execute(q + " ORDER BY id", args)]


def put(con: sqlite3.Connection, rec: dict | Record) -> bool:
    """Insert or update a series record (all fields). Returns True when anything changed."""
    row = rec.row() if isinstance(rec, Record) else dict(rec)
    row["health_detail"] = clip(row.get("health_detail") or {})
    row["labels"] = clip(row.get("labels") or {})
    check_record(Record(**row))
    old = con.execute("SELECT row FROM series WHERE id = ?", (row["id"],)).fetchone()
    if old and json.loads(old[0]) == row:
        return False
    con.execute("INSERT INTO series (id, source_id, status, origin, row, dirty) VALUES "
                "(?, ?, ?, ?, ?, 1) ON CONFLICT(id) DO UPDATE SET source_id = excluded.source_id,"
                " status = excluded.status, origin = excluded.origin, row = excluded.row, "
                "dirty = 1", (row["id"], row["source_id"], row["status"], row["origin"],
                              json.dumps(row, default=str)))
    return True


def set_status(con: sqlite3.Connection, series_id: str, status: str, reason: str = "",
               kind: str = "status", detail: dict | None = None, **fields) -> bool:
    """Move a series to a new status, logging the change. Extra fields are saved with it.
    Returns True when the status changed."""
    rec = get(con, series_id)
    if rec is None:
        raise KeyError(series_id)
    before = rec["status"]
    rec.update(fields, status=status)
    if reason or before != status:
        rec["reason"] = reason[:300]
    put(con, rec)
    if before != status:
        add_event(con, kind, series_id=series_id, source_id=rec["source_id"],
                  from_state=before, to_state=status,
                  detail={**({"reason": reason[:200]} if reason else {}), **(detail or {})})
        return True
    return False


# ------------------------------------------------------------------ lineage

def set_lineage(con: sqlite3.Connection, rows: list[tuple[str, str, str]]) -> bool:
    """Replace the whole lineage. Returns True when it changed."""
    new = sorted(set(rows))
    digest = hashlib.sha256(json.dumps(new).encode()).hexdigest()
    if get_state(con, "lineage_hash") == digest:
        return False
    con.execute("DELETE FROM lineage")
    con.executemany("INSERT INTO lineage (series_id, kind, consumer) VALUES (?, ?, ?)", new)
    set_state(con, "lineage_hash", digest)
    set_state(con, "lineage_sent", "0")
    return True


def lineage(con: sqlite3.Connection, series_id: str | None = None) -> list[tuple[str, str, str]]:
    if series_id:
        return con.execute("SELECT series_id, kind, consumer FROM lineage WHERE series_id = ? "
                           "ORDER BY kind, consumer", (series_id,)).fetchall()
    return con.execute("SELECT series_id, kind, consumer FROM lineage ORDER BY 1, 2, 3").fetchall()


# ------------------------------------------------------------------ the engine reads these

_EXTRA: dict = {"mtime": None, "series": {}}


def lookup(key: str, path: Path | None = None) -> dict | None:
    """The registry record for a key, from the default working copy, or None."""
    p = Path(path or DB)
    if not p.exists():
        return None
    con = sqlite3.connect(p, timeout=30)
    try:
        row = con.execute("SELECT row FROM series WHERE id = ?", (key,)).fetchone()
    except sqlite3.OperationalError:
        return None
    finally:
        con.close()
    return json.loads(row[0]) if row else None


#: Statuses whose data the engine may read: accepted and not retired.
READABLE = ("enrolled", "live", "degraded")


def extra_series(path: Path | None = None) -> dict[str, catalog.Series]:
    """Series that discovery found and enrolment accepted, as catalog Series, so `catalog.get`
    and the store read them like curated ones. Cached until the file changes."""
    p = Path(path or DB)
    if not p.exists():
        return {}
    mtime = (p.stat().st_mtime, (p.parent / (p.name + "-wal")).stat().st_mtime
             if (p.parent / (p.name + "-wal")).exists() else 0)
    if _EXTRA["mtime"] == (str(p), mtime):
        return _EXTRA["series"]
    con = sqlite3.connect(p, timeout=30)
    try:
        rows = con.execute(f"SELECT row FROM series WHERE origin = 'discovered' AND status IN "
                           f"({', '.join('?' * len(READABLE))})", READABLE).fetchall()
    except sqlite3.OperationalError:
        rows = []
    finally:
        con.close()
    out = {}
    for (raw,) in rows:
        r = json.loads(raw)
        if r["frequency"] not in ("D", "W", "M", "Q") or r["display_rights"] == "none":
            continue
        out[r["id"]] = catalog.Series(
            r["id"], r["source_id"], r["code"], r["name"], frequency=r["frequency"],
            required=False, published_after=r.get("published_after"),
            lag_days=int(r.get("lag_days") or 0), site=False)
    _EXTRA.update(mtime=(str(p), mtime), series=out)
    return out
