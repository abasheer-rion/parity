"""The enrolment gate (DEC-0064). A candidate moves to enrolled only when every check
passes; otherwise it stays a candidate with the first failing reason.

    1. licence      its source has display rights, a terms link and the date we read them,
                    and the rights allow the intended use
    2. schema       a fetcher exists for its source and code, and its frequency is known
    3. history      enough history was fetched (checks.MIN_HISTORY)
    4. lag          a look-ahead lag is set before any use (checks.default_lag)
    5. sanity       dates, duplicates, gaps, outliers, non-positive prices, flat stretches,
                    calendar (checks.sanity)
    6. quality      a score from 0 to 1, at least checks.MIN_QUALITY

Candidates for the live feed (new Base pools) skip history: they pass when the licence
allows a public feed and the pool is still as deep as the bar. Going live in the feed is a
code change to its pool list; the record says so.

At most `limit` candidates are tried per cycle, and none more than once a day, so the gate
never floods a source with requests.
"""

from __future__ import annotations

import json
import sqlite3

import pandas as pd

from . import checks, db, fetch, rights

RETRY_HOURS = 24.0
CRYPTO_SOURCES = ("kraken", "coinbase", "gemini", "binanceus", "hyperliquid")


def _source(con: sqlite3.Connection, source_id: str) -> dict | None:
    return next((s for s in db.sources(con) if s["id"] == source_id), None)


def licence(con: sqlite3.Connection, rec: dict) -> str:
    """The licence check. Returns the reason it fails, or an empty string."""
    src = _source(con, rec["source_id"])
    if src is None:
        return f"licence: no source record for {rec['source_id']}"
    r = rights.narrowest(rec["display_rights"], src["display_rights"])
    if r == "none":
        return f"licence: {src['name']} has no display rights recorded for any use"
    if not src.get("terms_url") or not src.get("terms_read_on"):
        return f"licence: terms of {src['name']} not recorded with the date read"
    if not rights.may_use(r, rec["intended_use"]):
        return f"licence: {r} rights do not allow {rec['intended_use']} use"
    return ""


def schema(rec: dict) -> str:
    if rec["code"].endswith("/"):
        return "schema: a data set, not a series; a series key must be chosen"
    if rec["frequency"] not in ("D", "W", "M", "Q"):
        return f"schema: frequency {rec['frequency']} is not one the panel reads"
    if not fetch.has_fetcher(rec):
        return f"schema: no history fetcher for source {rec['source_id']}"
    return ""


def _due(con: sqlite3.Connection, rec: dict, now: pd.Timestamp) -> bool:
    last = db.get_state(con, f"gate:{rec['id']}")
    return not last or now - pd.Timestamp(last) >= pd.Timedelta(hours=RETRY_HOURS)


def _priority(rec: dict) -> tuple:
    tier = rec.get("labels", {}).get("liquidity_tier") or 4
    return (rec["intended_use"] != "research", tier, rec.get("discovered_at") or "")


def gate(con: sqlite3.Connection, rec: dict, now: pd.Timestamp | None = None) -> dict:
    """Run every check on one candidate and move it on or leave it with its reason."""
    now = now or pd.Timestamp.now(tz="UTC")
    db.set_state(con, f"gate:{rec['id']}", now.isoformat())
    why = licence(con, rec)
    data = None
    result = None
    if not why and rec["intended_use"] == "feed":
        depth = rec.get("health_detail", {}).get("depth_usd") or rec.get("labels", {}).get(
            "depth_usd")
        tier = rec.get("labels", {}).get("liquidity_tier")
        if tier is None and depth is None:
            why = "feed: depth unknown"
    elif not why:
        why = schema(rec)
        if not why:
            try:
                data = fetch.history(con, rec)
            except Exception as exc:
                why = f"history: fetch failed ({type(exc).__name__})"
        if not why and data is not None:
            lag = checks.default_lag(rec["frequency"])
            if rec.get("published_after") is None and not rec.get("lag_days"):
                rec.update(lag)
            elif rec["frequency"] in ("M", "Q") and rec.get("published_after") is None:
                rec["published_after"] = lag["published_after"]
            result = checks.sanity(data, rec["frequency"], rec["asset_class"],
                                   crypto=rec["source_id"] in CRYPTO_SOURCES, today=now)
            if not result.ok:
                why = f"{'history' if result.reason.startswith('history') else 'sanity'}: " \
                      f"{result.reason}".replace("history: history:", "history:")
    previous = rec.get("reason", "")
    if why:
        rec["reason"] = why[:300]
        if result is not None:
            rec["quality"] = result.quality
        db.put(con, rec)
        if why != previous:
            db.add_event(con, "rejected", series_id=rec["id"], source_id=rec["source_id"],
                         from_state="candidate", to_state="candidate",
                         detail={"reason": why[:200], **({"checks": result.checks}
                                                         if result else {})})
        return {"id": rec["id"], "enrolled": False, "reason": why}
    fields = {"enrolled_at": db.now()}
    note = ""
    if data is not None:
        fields.update(quality=result.quality, start_date=data.index.min().date().isoformat(),
                      end_date=data.index.max().date().isoformat(),
                      last_obs=data.index.max().date().isoformat(),
                      published_after=rec.get("published_after"),
                      lag_days=int(rec.get("lag_days") or 0))
        r = rights.narrowest(rec["display_rights"],
                             (_source(con, rec["source_id"]) or {})["display_rights"])
        if rights.may_show(r, "team"):
            con.execute("INSERT INTO previews (series_id, points, dirty) VALUES (?, ?, 1) ON "
                        "CONFLICT(series_id) DO UPDATE SET points = excluded.points, dirty = 1",
                        (rec["id"], json.dumps(checks.preview(data))))
    else:
        note = "enrolled; reaches the live feed when added to its pool list"
    for k, v in fields.items():
        rec[k] = v
    db.put(con, rec)
    db.set_status(con, rec["id"], "enrolled", note, kind="enrolled",
                  detail={"quality": fields.get("quality"),
                          **({"checks": result.checks} if result else {})})
    return {"id": rec["id"], "enrolled": True, "quality": fields.get("quality")}


def run(con: sqlite3.Connection, limit: int = 5, now: pd.Timestamp | None = None) -> list[dict]:
    """Try up to `limit` candidates that are due, best first."""
    now = now or pd.Timestamp.now(tz="UTC")
    todo = [r for r in db.all_series(con, status="candidate", origin="discovered")
            if _due(con, r, now)]
    out = []
    for rec in sorted(todo, key=_priority)[:limit]:
        try:
            with con:
                out.append(gate(con, rec, now))
        except Exception as exc:  # one bad candidate never stops the others
            out.append({"id": rec["id"], "enrolled": False,
                        "reason": f"gate error: {type(exc).__name__}"})
    return out
