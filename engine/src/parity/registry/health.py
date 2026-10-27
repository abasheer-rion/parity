"""Health around the clock (DEC-0064). Each registry cycle checks every enrolled series and
heals what it can. Nobody is paged; every change of state is an event, and the counts go to
the Data health page and the site's health line.

What is checked:
    freshness    age of the newest value against the cadence the latency page uses
                 (latency.cadence_hours): ok, late (past it), stale (past twice it)
    fetching     whether the last fetch worked, and the share of failed fetches over 7 days
    the values   gaps, outliers and flat stretches in the newest year (checks.sanity), and
                 schema drift: a key or column that vanished, or values that jump by 50x
    live feeds   message rate and lag from the fan-out's status; when nobody watches, the
                 venue's own public endpoint is probed instead

What it does about it:
    retry        a stale series that discovery added is fetched again, with a wait that
                 doubles after each failure (6 hours to 2 days). Curated series are already
                 retried by `latency.retry_stale` in the same service.
    backup       where a backup source exists (Fed currencies have ECB crosses, FRED
                 Treasury yields the Treasury's own curve), its freshness is checked and
                 named on the series. Strategies keep reading the primary, so results never
                 change without a code change.
    status       enrolled to live when fresh, live to degraded when stale or failing, and
                 back to live when it recovers
    retire       a series discovery added that has been dead for 14 days is retired.
                 Curated series are never retired here; they stay degraded.
"""

from __future__ import annotations

import sqlite3
import time
from datetime import UTC, datetime, timedelta

import pandas as pd

from .. import latency
from ..data import store
from . import checks, db, fetch, net

LIVE_STATUS = "https://paritytrading.app/live/status"
RETIRE_AFTER_DAYS = 14
RETRY_FIRST_HOURS = 6.0
RETRY_MAX_HOURS = 48.0
SCAN_EVERY_HOURS = 6.0
#: A live feed with viewers is down when its upstream sent nothing for this long.
LIVE_SILENT_MS = 120_000

#: Public endpoints that say whether a venue answers. Read-only, no key, one call a cycle.
PROBES = {
    "onchain": ("post", "https://base-rpc.publicnode.com",
                [{"jsonrpc": "2.0", "id": 1, "method": "eth_blockNumber", "params": []}]),
    "coingecko": ("get", "https://api.coingecko.com/api/v3/ping", None),
    "kraken": ("get", "https://api.kraken.com/0/public/Time", None),
    "coinbase": ("get", "https://api.exchange.coinbase.com/time", None),
    "gemini": ("get", "https://api.gemini.com/v1/pubticker/btcusd", None),
    "binanceus": ("get", "https://api.binance.us/api/v3/time", None),
    "hyperliquid": ("post", "https://api.hyperliquid.xyz/info", {"type": "allMids"}),
}
#: Feeds that need the owner's key on the site; without it they are idle by design.
KEYED_FEEDS = {"alpaca": "ALPACA_KEY_ID"}

STATE_ORDER = {"ok": 0, "idle": 0, "unknown": 1, "late": 2, "stale": 3, "dead": 4}


def _now() -> datetime:
    return datetime.now(UTC)


def _hours(a: datetime, b) -> float | None:
    if b is None:
        return None
    t = pd.Timestamp(b)
    t = t.tz_localize("UTC") if t.tzinfo is None else t.tz_convert("UTC")
    return (a - t.to_pydatetime()).total_seconds() / 3600


def fetch_stats(con: sqlite3.Connection, days: int = 7, now: datetime | None = None
                ) -> dict[str, dict]:
    """Per source and per series: attempts, failures and the last outcome."""
    since = ((now or _now()) - timedelta(days=days)).isoformat(timespec="seconds")
    out: dict[str, dict] = {}
    for at, src, sid, ok, err in con.execute(
            "SELECT at, source_id, series_id, ok, error FROM fetch_log WHERE at >= ? ORDER BY at",
            (since,)):
        for key in (f"source:{src}", f"series:{sid}"):
            s = out.setdefault(key, {"n": 0, "failed": 0, "last_ok": None, "last_at": None,
                                     "last_error": None, "fails_in_row": 0})
            s["n"] += 1
            s["last_at"] = at
            if ok:
                s["last_ok"] = at
                s["fails_in_row"] = 0
            else:
                s["failed"] += 1
                s["fails_in_row"] += 1
                s["last_error"] = (err or "").split(":")[0][:60]
    return out


def classify_error(err: str | None) -> str | None:
    """'schema' when a key, column or series vanished; 'upstream' for anything else."""
    if not err:
        return None
    e = err.lower()
    if any(w in e for w in ("keyerror", "not found", "no values", "column", "unknown pair")):
        return "schema"
    if "missingkey" in e or "not set" in e:
        return "no key"
    return "upstream"


def level_jump(data: pd.Series) -> float | None:
    """How many times the newest values sit above or below the year before them. A jump of
    50x or more is schema drift (new units, a rebased index), not a market move."""
    s = data.dropna()
    if len(s) < 60:
        return None
    new, old = s.tail(20).abs().median(), s.iloc[-270:-20].abs().median()
    if not old or not new:
        return None
    return float(max(new / old, old / new))


def judge(age: float | None, cadence: float, fetch_ok: bool | None) -> str:
    if age is None:
        return "unknown"
    if fetch_ok is False and age > cadence:
        return "stale" if age <= cadence * latency.STALE_FACTOR * 3 else "dead"
    if age > cadence * latency.STALE_FACTOR * 3:
        return "dead"
    if age > cadence * latency.STALE_FACTOR:
        return "stale"
    return "late" if age > cadence else "ok"


# ------------------------------------------------------------------ one series

def check_series(con: sqlite3.Connection, rec: dict, cov: dict[str, dict], stats: dict,
                 now: datetime, root=None) -> dict:
    """Health of one data series (not a live feed). Returns the new health fields."""
    root = root or store.DEFAULT_DIR
    detail = dict(rec.get("health_detail") or {})
    cadence = latency.cadence_hours(rec["source_id"], rec["frequency"], rec.get("code", ""),
                                    rec.get("published_after"), int(rec.get("lag_days") or 0))
    if rec["origin"] == "catalog":
        row = cov.get(rec["id"])
        if row is None:
            return {"health": "unknown", "health_detail": {"why": "not fetched on this machine "
                    "(a keyed source without its key, or never fetched)"}}
        last = row.get("last") or rec.get("last_obs")
        fetch_ok = bool(row.get("ok"))
        err_kind = classify_error(row.get("error")) if not fetch_ok else None
    else:
        st = stats.get(f"series:{rec['id']}", {})
        last = rec.get("last_obs")
        fetch_ok = None if not st else st["fails_in_row"] == 0
        err_kind = classify_error(st.get("last_error")) if st and not fetch_ok else None
    age = _hours(now, last)
    state = judge(age, cadence, fetch_ok)
    src = stats.get(f"source:{rec['source_id']}", {})
    detail.update({"age_hours": None if age is None else round(age, 1),
                   "cadence_hours": round(cadence, 1), "fetch_ok": fetch_ok,
                   "source_error_rate_7d": round(src["failed"] / src["n"], 3) if src.get("n")
                   else None})
    if err_kind:
        detail["error_kind"] = err_kind
    else:
        detail.pop("error_kind", None)
    # The values themselves, at most every few hours and only when the file changed.
    path = store._path(fetch.as_series(rec), root)
    if path.exists():
        mtime = round(path.stat().st_mtime)
        scanned = detail.get("scanned_at")
        if detail.get("file_mtime") != mtime or not scanned or \
                (_hours(now, scanned) or 0) > SCAN_EVERY_HOURS:
            data = pd.read_parquet(path).iloc[:, 0]
            recent = data[data.index >= data.index.max() - pd.DateOffset(years=1)]
            res = checks.sanity(recent, rec["frequency"], rec["asset_class"],
                                crypto=rec["source_id"] in ("kraken", "coinbase", "gemini"),
                                today=pd.Timestamp(now).tz_convert(None), full=False)
            jump = level_jump(data)
            detail.update({"file_mtime": mtime, "scanned_at": now.isoformat(timespec="seconds"),
                           "outliers_1y": res.checks.get("outliers"),
                           "long_gaps_1y": res.checks.get("long_gaps"),
                           "quality_1y": res.quality})
            if jump and jump >= 50:
                detail["error_kind"] = "schema"
                detail["level_jump"] = round(jump, 1)
            else:
                detail.pop("level_jump", None)
    out = {"health": state, "health_detail": detail}
    if last:
        out["last_obs"] = str(last)[:10]
    return out


# ------------------------------------------------------------------ live feeds

def live_status(get=None) -> dict[str, dict]:
    """The fan-out's public status: per source, line state, viewers, messages and lag."""
    try:
        body = (get or (lambda: net.get(LIVE_STATUS, pause=0.2).json()))()
    except Exception:
        return {}
    return {s.get("src"): s for s in body.get("sources", []) if s.get("src")}


def probe(src: str, call=None) -> tuple[bool, float | None]:
    """Whether a venue's public endpoint answers, and how long it took in milliseconds."""
    if src not in PROBES:
        return False, None
    how, url, body = PROBES[src]
    t0 = time.time()
    try:
        if call:
            call(src)
        elif how == "post":
            net.request(url, json=body, pause=0.2, retries=1)
        else:
            net.request(url, pause=0.2, retries=1)
        return True, round((time.time() - t0) * 1000, 1)
    except Exception:
        return False, None


def check_feed(rec: dict, status: dict[str, dict], now_ms: float, probe_fn=probe) -> dict:
    src = rec["code"]
    s = status.get(src)
    detail: dict = {}
    if src in KEYED_FEEDS and (s is None or s.get("error") or not (s.get("viewers") or 0)):
        return {"health": "idle", "health_detail": {"why": f"off until {KEYED_FEEDS[src]} is set "
                                                           "on the site"}}
    if s and not s.get("error"):
        up_secs = max((now_ms - float(s.get("started") or now_ms)) / 1000, 1.0)
        detail = {"viewers": s.get("viewers"), "upstream": s.get("upstream"),
                  "msgs_per_min": round(60 * float(s.get("upstreamMsgs") or 0) / up_secs, 2),
                  "last_msg_ago_s": None if s.get("lastUpstreamMsgAgoMs") is None
                  else round(s["lastUpstreamMsgAgoMs"] / 1000, 1),
                  "lag_p50_ms": (s.get("feedLagMs") or {}).get("p50"),
                  "lag_p95_ms": (s.get("feedLagMs") or {}).get("p95"),
                  "reconnects": s.get("reconnects")}
        if (s.get("viewers") or 0) > 0:
            silent = s.get("lastUpstreamMsgAgoMs")
            ok = s.get("upstream") == "up" and silent is not None and silent < LIVE_SILENT_MS
            return {"health": "ok" if ok else "stale", "health_detail": detail}
    ok, ms = probe_fn(src)
    detail.update({"probe_ok": ok, "probe_ms": ms,
                   "why": "nobody watching; the venue's public endpoint was probed"})
    return {"health": "idle" if ok else "stale", "health_detail": detail}


# ------------------------------------------------------------------ status, healing, uptime

def _next_status(rec: dict, health: str, dead_days: float | None) -> tuple[str, str]:
    st = rec["status"]
    if st in ("candidate", "retired"):
        return st, rec.get("reason", "")
    if health in ("ok", "late", "idle"):
        return "live", ""
    if health in ("stale", "dead"):
        if rec["origin"] == "discovered" and dead_days is not None \
                and dead_days >= RETIRE_AFTER_DAYS:
            return "retired", f"dead for {dead_days:.0f} days"
        return "degraded", f"health {health}"
    return st, rec.get("reason", "")


def _retry(con: sqlite3.Connection, rec: dict, stats: dict, now: datetime) -> dict | None:
    """Fetch a stale discovered series again, with a wait that doubles per failure."""
    if rec["origin"] != "discovered" or not fetch.has_fetcher(rec):
        return None
    st = stats.get(f"series:{rec['id']}", {})
    wait = min(RETRY_MAX_HOURS, RETRY_FIRST_HOURS * 2 ** max(0, st.get("fails_in_row", 0) - 1))
    last = st.get("last_at")
    if last and (_hours(now, last) or 0) < wait:
        return None
    try:
        data = fetch.history(con, rec, at=now.isoformat(timespec="seconds"))
        out = {"ok": True, "last": data.index.max().date().isoformat()}
    except Exception as exc:
        out = {"ok": False, "error": type(exc).__name__}
    db.add_event(con, "retry", series_id=rec["id"], source_id=rec["source_id"],
                 detail={**out, "waited_hours": wait})
    return out


def _bump(con: sqlite3.Connection, scope: str, sid: str, day: str, state: str) -> None:
    col = {"ok": "ok", "idle": "ok", "late": "late", "stale": "stale", "dead": "down"}.get(state)
    con.execute("INSERT INTO uptime (scope, id, day) VALUES (?, ?, ?) ON CONFLICT DO NOTHING",
                (scope, sid, day))
    con.execute("UPDATE uptime SET checks = checks + 1, dirty = 1"
                + (f", {col} = {col} + 1" if col else "")
                + " WHERE scope = ? AND id = ? AND day = ?", (scope, sid, day))


def source_state(states: list[str]) -> str:
    """A source is as healthy as most of its series: down when half are stale or dead, stale
    when a tenth are, late when any are late."""
    known = [s for s in states if s != "unknown"]
    if not known:
        return "unknown"
    bad = sum(s in ("stale", "dead") for s in known) / len(known)
    if bad >= 0.5:
        return "dead"
    if bad >= 0.1:
        return "stale"
    return "late" if any(s == "late" for s in known) or bad > 0 else "ok"


def run(con: sqlite3.Connection, now: datetime | None = None, status_get=None,
        probe_fn=probe, root=None) -> dict:
    """Check every enrolled series once. Returns counts by health and the changes made."""
    now = now or _now()
    root = root or store.DEFAULT_DIR
    cov = {r["key"]: r for r in store.coverage(root).get("series", [])}
    stats = fetch_stats(con, now=now)
    feeds = live_status(status_get) if any(
        r["origin"] == "live" for r in db.all_series(con, status=("enrolled", "live",
                                                                 "degraded"))) else {}
    now_ms = now.timestamp() * 1000
    day = now.date().isoformat()
    by_source: dict[str, list[str]] = {}
    counts: dict[str, int] = {}
    changes = []
    rows = db.all_series(con, status=("enrolled", "live", "degraded"))
    known = {r["id"]: r for r in rows}
    for rec in rows:
        try:
            if rec["origin"] == "live":
                new = check_feed(rec, feeds, now_ms, probe_fn)
            elif rec["intended_use"] == "feed":  # a pool waiting for the feed's pool list
                new = {"health": "idle", "health_detail": {"why": "not in the live feed yet"}}
            else:
                new = check_series(con, rec, cov, stats, now, root)
                if new["health"] in ("stale", "dead") and rec["origin"] == "discovered":
                    tried = _retry(con, rec, stats, now)
                    if tried and tried.get("ok"):
                        rec["last_obs"] = tried["last"]
                        new = check_series(con, rec, cov, fetch_stats(con, now=now), now,
                                           root)
        except Exception as exc:  # one broken check never stops the others
            new = {"health": "unknown", "health_detail": {"why": f"check failed: "
                                                                 f"{type(exc).__name__}"}}
        health = new["health"]
        counts[health] = counts.get(health, 0) + 1
        by_source.setdefault(rec["source_id"], []).append(health)
        _bump(con, "series", rec["id"], day, health)
        detail = new["health_detail"]
        # Backup: named, with its own health, when the primary is in trouble.
        b = rec.get("backup_id")
        if b and health in ("stale", "dead") and b in known:
            bh = known[b].get("health")
            detail["backup"] = {"id": b, "health": bh}
            if bh in ("ok", "late") and (rec.get("health_detail") or {}).get("backup", {}).get(
                    "health") not in ("ok", "late"):
                db.add_event(con, "failover", series_id=rec["id"], source_id=rec["source_id"],
                             to_state=b, detail={"backup": b, "backup_health": bh})
        else:
            detail.pop("backup", None)
        # Days dead: since the newest value went stale past three times its cadence.
        dead_since = (rec.get("health_detail") or {}).get("dead_since")
        if health == "dead":
            detail["dead_since"] = dead_since or now.isoformat(timespec="seconds")
        else:
            detail.pop("dead_since", None)
        dead_days = (_hours(now, detail["dead_since"]) or 0) / 24 if health == "dead" else None
        old_health = rec.get("health")
        stamp_due = not rec.get("health_checked_at") or \
            (_hours(now, rec["health_checked_at"]) or 0) >= 1
        if old_health != health or stamp_due or detail != (rec.get("health_detail") or {}):
            if old_health != health:
                db.add_event(con, "health", series_id=rec["id"], source_id=rec["source_id"],
                             from_state=old_health, to_state=health,
                             detail={k: v for k, v in detail.items() if k in (
                                 "age_hours", "cadence_hours", "fetch_ok", "error_kind",
                                 "level_jump", "probe_ok", "viewers", "why")})
            if detail.get("error_kind") == "schema" and \
                    (rec.get("health_detail") or {}).get("error_kind") != "schema":
                db.add_event(con, "schema", series_id=rec["id"], source_id=rec["source_id"],
                             detail={"level_jump": detail.get("level_jump")})
            rec.update(new, health_detail=detail, health_checked_at=now.isoformat(
                timespec="seconds"))
            db.put(con, rec)
        status, reason = _next_status(rec, health, dead_days)
        if status != rec["status"]:
            db.set_status(con, rec["id"], status, reason,
                          kind="retired" if status == "retired" else "status")
            changes.append((rec["id"], rec["status"], status))
    for src, states in by_source.items():
        _bump(con, "source", src, day, source_state(states))
    con.execute("DELETE FROM uptime WHERE day < date('now', '-400 days')")
    con.commit()
    return {"counts": counts, "changes": len(changes),
            "sources": {s: source_state(v) for s, v in by_source.items()}}


def report(con: sqlite3.Connection) -> str:
    """One line: how many series by health."""
    rows = db.all_series(con, status=("enrolled", "live", "degraded"))
    c: dict[str, int] = {}
    for r in rows:
        c[r["health"]] = c.get(r["health"], 0) + 1
    return ", ".join(f"{k} {v}" for k, v in sorted(c.items(), key=lambda kv: STATE_ORDER.get(
        kv[0], 9)))
