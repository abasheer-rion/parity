"""Send the registry's changes to Supabase (DEC-0064).

Connects as `parity_writer`, which may only call report_registry(); the function checks every
field and refuses chart previews for series whose display rights do not allow one. Rows are
sent in pieces of at most 400, sources first, so a series always arrives after its source.
A piece that fails stays marked and goes again next cycle. Only an error's type is ever
printed: database errors can quote the connection string.
"""

from __future__ import annotations

import json
import os
import sqlite3

from . import db, rights

CHUNK = 400


class NotConfigured(RuntimeError):
    pass


def _url() -> str:
    url = os.environ.get("PARITY_WRITER_DB_URL", "")
    if not url.startswith("postgres"):
        raise NotConfigured("PARITY_WRITER_DB_URL is not set")
    return url


def pending(con: sqlite3.Connection) -> dict[str, list]:
    """Everything not yet sent, as report_registry() takes it."""
    srcs = [json.loads(r[0]) for r in con.execute("SELECT row FROM sources WHERE dirty = 1")]
    series = [json.loads(r[0]) for r in con.execute("SELECT row FROM series WHERE dirty = 1")]
    lineage = []
    if db.get_state(con, "lineage_sent") != "1":
        lineage = [{"series_id": s, "kind": k, "consumer": c} for s, k, c in db.lineage(con)]
    upto = int(db.get_state(con, "events_sent_through", "0") or 0)
    events = [{"event_key": k, "at": at, "series_id": s, "source_id": src, "kind": kind,
               "from_state": f, "to_state": t, "detail": json.loads(d), "_id": i}
              for i, k, at, s, src, kind, f, t, d in con.execute(
                  "SELECT id, event_key, at, series_id, source_id, kind, from_state, to_state, "
                  "detail FROM events WHERE id > ? ORDER BY id", (upto,))]
    uptime = [dict(zip(("scope", "id", "day", "checks", "ok", "late", "stale", "down"), r,
                       strict=True)) for r in con.execute(
        "SELECT scope, id, day, checks, ok, late, stale, down FROM uptime WHERE dirty = 1")]
    previews = []
    for sid, pts in con.execute("SELECT series_id, points FROM previews WHERE dirty = 1"):
        rec = db.get(con, sid)
        # The same rule the database applies: values only where the rights allow showing them.
        if rec and rights.may_show(rec["display_rights"], "team"):
            previews.append({"series_id": sid, "points": json.loads(pts)})
    backtests = [{"series_id": s, "ran_at": at, "trials": n, "battery": json.loads(b)}
                 for s, at, n, b in con.execute(
                     "SELECT series_id, ran_at, trials, battery FROM backtests WHERE dirty = 1")]
    return {"sources": srcs, "series": series, "lineage": lineage, "events": events,
            "uptime": uptime, "previews": previews, "backtests": backtests}


def _lineage_chunks(rows: list[dict]) -> list[list[dict]]:
    """Pieces that never split one series' list, since each piece replaces the lists of the
    series it names."""
    groups: dict[str, list[dict]] = {}
    for r in rows:
        groups.setdefault(r["series_id"], []).append(r)
    out, cur = [], []
    for group in groups.values():
        group = group[:CHUNK]
        if cur and len(cur) + len(group) > CHUNK:
            out.append(cur)
            cur = []
        cur += group
    return out + ([cur] if cur else [])


def publish(con: sqlite3.Connection, send=None) -> dict:
    """Send everything pending. `send(doc) -> dict` is the database call (tests pass their
    own). Returns counts sent per kind."""
    todo = pending(con)
    sent = {k: 0 for k in todo}
    if not any(todo.values()):
        return sent
    if send is None:
        import psycopg

        conn = psycopg.connect(_url(), connect_timeout=20, autocommit=True)

        def send(doc: dict) -> dict:
            return conn.execute("select public.report_registry(%s::jsonb)",
                                (json.dumps(doc, default=str),)).fetchone()[0]
    else:
        conn = None
    try:
        for kind in ("sources", "series"):
            rows = todo[kind]
            for i in range(0, len(rows), CHUNK):
                piece = rows[i:i + CHUNK]
                send({kind: piece})
                table = "sources" if kind == "sources" else "series"
                con.executemany(f"UPDATE {table} SET dirty = 0 WHERE id = ? AND row = ?",
                                [(r["id"], json.dumps(r, default=str)) for r in piece])
                con.commit()
                sent[kind] += len(piece)
        if todo["lineage"]:
            for piece in _lineage_chunks(todo["lineage"]):
                send({"lineage": piece})
                sent["lineage"] += len(piece)
            db.set_state(con, "lineage_sent", "1")
            con.commit()
        for i in range(0, len(todo["events"]), CHUNK):
            piece = todo["events"][i:i + CHUNK]
            send({"events": [{k: v for k, v in e.items() if k != "_id"} for e in piece]})
            db.set_state(con, "events_sent_through", piece[-1]["_id"])
            con.commit()
            sent["events"] += len(piece)
        for kind, table, key in (("uptime", "uptime", None), ("previews", "previews", "series_id"),
                                 ("backtests", "backtests", "series_id")):
            rows = todo[kind]
            for i in range(0, len(rows), CHUNK):
                piece = rows[i:i + CHUNK]
                send({kind: piece})
                if kind == "uptime":
                    con.executemany("UPDATE uptime SET dirty = 0 WHERE scope = ? AND id = ? AND "
                                    "day = ? AND checks = ?",
                                    [(r["scope"], r["id"], r["day"], r["checks"]) for r in piece])
                else:
                    con.executemany(f"UPDATE {table} SET dirty = 0 WHERE {key} = ?",
                                    [(r["series_id"],) for r in piece])
                con.commit()
                sent[kind] += len(piece)
        # Previews the rights no longer allow are dropped here too, never sent.
        con.execute("UPDATE previews SET dirty = 0 WHERE dirty = 1")
        con.commit()
    finally:
        if conn is not None:
            conn.close()
    return sent


def try_publish(con: sqlite3.Connection) -> str:
    """Publish if a writer URL is set. Returns a short note for the log, never a secret."""
    try:
        sent = publish(con)
        return "sent " + ", ".join(f"{v} {k}" for k, v in sent.items() if v) if any(
            sent.values()) else "nothing new to send"
    except NotConfigured:
        return "no writer URL, not sent"
    except Exception as exc:  # only the type: errors can quote the connection string
        return f"send failed: {type(exc).__name__}"
