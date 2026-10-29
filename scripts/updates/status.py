#!/usr/bin/env python3
"""Collects the warnings the status page and the site banner show (DEC-0073).

    python3 scripts/updates/status.py --probe probe.json --out status-auto.json
    python3 scripts/updates/status.py --probe probe.json --out status-auto.json --compare-live

Three sources, merged into one small JSON file:
  - the data health checks: the service_heartbeats table, read with the database address in
    SITE_DATA_DB_URL (read-only SELECT). A service that has not reported for two hours, and
    degraded data series, become warnings. Without SITE_DATA_DB_URL this part is skipped and
    the file says so.
  - the live feed probe (web/scripts/live-probe.mjs): its JSON line, given with --probe. A
    failed probe is an outage warning. --carry takes an earlier output file and keeps its
    probe warning when that file is under 90 minutes old (the deploy uses this, since it does
    not run the probe itself).
  - manual entries in content/updates/status.toml that are active now.

The output holds ids, levels, short titles and counts only: no addresses, keys or logs.
--compare-live reads the live site's /status.json (origin from web/src/lib/site.json) and
writes changed=true or changed=false to GITHUB_OUTPUT when the set of warning ids differs.
Kill switch: the job "status_probe" in content/seo/automation.toml. Every run logs one line.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import sys
import tomllib
import urllib.error
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(ROOT / "scripts/seo"))

import automation  # noqa: E402  the shared kill switch and log

JOB = "status_probe"
MANUAL = ROOT / "content/updates/status.toml"
# Where build.py looks for this script's output unless UPDATES_STATUS_JSON says otherwise.
DEFAULT_OUT = HERE / ".out/status.json"
LEVELS = ("info", "warning", "outage")
STALE_AFTER = dt.timedelta(hours=2)  # the same two hours as web/src/lib/health.ts
CARRY_FOR = dt.timedelta(minutes=90)
MAX_FIRST_MS = 5_000  # the probe's own limit (web/scripts/live-probe.mjs)
SERVICES = {"search": "The strategy search", "sims": "The simulations"}


def now_utc() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


def iso(t: dt.datetime) -> str:
    return t.astimezone(dt.timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def parse_time(v) -> dt.datetime | None:
    """A TOML datetime or date, or an ISO string, as an aware UTC time. None when unreadable."""
    if v is None or v == "":
        return None
    if isinstance(v, dt.datetime):
        return v if v.tzinfo else v.replace(tzinfo=dt.timezone.utc)
    if isinstance(v, dt.date):
        return dt.datetime.combine(v, dt.time(0), dt.timezone.utc)
    try:
        t = dt.datetime.fromisoformat(str(v).replace("Z", "+00:00"))
    except ValueError:
        return None
    return t if t.tzinfo else t.replace(tzinfo=dt.timezone.utc)


def hours(delta: dt.timedelta) -> str:
    h = delta.total_seconds() / 3600
    return f"{h:.0f} hours" if h >= 10 else f"{h:.1f} hours"


# ---------------------------------------------------------------- manual entries

def load_manual(path: Path | None = None) -> list[dict]:
    """Entries from status.toml, each checked. A broken entry raises ValueError naming it."""
    p = path or MANUAL
    if not p.exists():
        return []
    raw = tomllib.loads(p.read_text())
    out = []
    for i, ent in enumerate(raw.get("entry", [])):
        where = f"{p.name} entry {i + 1}"
        for field in ("id", "level", "title", "detail", "start"):
            if not ent.get(field):
                raise ValueError(f"{where}: {field} is missing")
        if ent["level"] not in LEVELS:
            raise ValueError(f"{where}: level must be one of {', '.join(LEVELS)}")
        start, end = parse_time(ent["start"]), parse_time(ent.get("end"))
        if start is None or (ent.get("end") and end is None):
            raise ValueError(f"{where}: start and end must be dates or date-times")
        out.append({"id": str(ent["id"]), "level": ent["level"], "title": str(ent["title"]),
                    "detail": str(ent["detail"]), "start": iso(start), "end": iso(end) if end else "",
                    "link": str(ent.get("link", "")), "source": "manual"})
    ids = [e["id"] for e in out]
    dup = {i for i in ids if ids.count(i) > 1}
    if dup:
        raise ValueError(f"{p.name}: ids used twice: {', '.join(sorted(dup))}")
    return out


def is_active(ent: dict, now: dt.datetime) -> bool:
    start, end = parse_time(ent.get("start")), parse_time(ent.get("end"))
    return bool(start and start <= now and (end is None or end > now))


# ---------------------------------------------------------------- data health

def heartbeat_warnings(rows: list[dict], now: dt.datetime) -> list[dict]:
    """Warnings from service_heartbeats rows (service, reported_at, summary)."""
    out = []
    by = {r.get("service"): r for r in rows}
    for svc, name in SERVICES.items():
        row = by.get(svc)
        if not row:
            out.append({"id": f"stale-{svc}", "level": "warning", "title": f"{name} has not reported yet",
                        "detail": f"{name} has sent no health report, so its numbers on the site may be old.",
                        "start": iso(now), "link": "/status/", "source": "health"})
            continue
        at = parse_time(row.get("reported_at"))
        if at is None or now - at > STALE_AFTER:
            gap = hours(now - at) if at else "a long time"
            out.append({"id": f"stale-{svc}", "level": "warning", "title": f"{name} has not reported for {gap}",
                        "detail": f"{name} usually reports every few minutes. Its numbers on the site may be old until it is back.",
                        "start": iso(at + STALE_AFTER) if at else iso(now), "link": "/status/", "source": "health"})
    sims = by.get("sims") or {}
    summary = sims.get("summary") or {}
    if isinstance(summary, str):
        try:
            summary = json.loads(summary)
        except ValueError:
            summary = {}
    data = summary.get("data") if isinstance(summary, dict) else None
    if isinstance(data, dict):
        bad = int(data.get("degraded") or 0)
        total = int(data.get("series") or 0)
        if bad > 0:
            of = f" of {total:,}" if total else ""
            # The id stays the same while the count moves, so a new count alone never redeploys.
            out.append({"id": "data-degraded", "level": "info", "title": "Some data series are behind",
                        "detail": f"{bad:,}{of} data series are late or failing their checks. Numbers built from them may be out of date.",
                        "start": iso(parse_time(sims.get("reported_at")) or now), "link": "/status/", "source": "health"})
    return out


def read_heartbeats(db_url: str) -> list[dict]:
    import psycopg  # noqa: PLC0415  only the CI job that has a database needs it

    with psycopg.connect(db_url, connect_timeout=15) as con:
        con.read_only = True
        with con.cursor() as cur:
            cur.execute("select service, reported_at, summary from public.service_heartbeats")
            return [{"service": s, "reported_at": t.isoformat() if hasattr(t, "isoformat") else t, "summary": m}
                    for s, t, m in cur.fetchall()]


# ---------------------------------------------------------------- live feed probe

def probe_warnings(probe: dict | None, now: dt.datetime) -> list[dict]:
    """An outage warning when the probe's JSON line says it failed. None or {} means no result."""
    if not probe:
        return []
    first, live = probe.get("firstPriceMs"), probe.get("live") or 0
    if first is not None and first <= MAX_FIRST_MS and live > 0:
        return []
    why = ("no price arrived" if first is None else
           f"the first price took {first / 1000:.1f} seconds" if first > MAX_FIRST_MS else "no live updates arrived")
    return [{"id": "live-feed-down", "level": "outage", "title": "Live prices are not updating",
             "detail": f"Our check of the public live price feed failed: {why}. Charts may show old prices.",
             "start": iso(now), "link": "/status/", "source": "probe"}]


def load_probe(path: str | None) -> dict | None:
    """The probe's JSON line. None when there is no file or it does not parse (the probe did not run)."""
    if not path:
        return None
    try:
        text = Path(path).read_text().strip()
    except OSError:
        return None
    for line in reversed(text.splitlines()):
        try:
            v = json.loads(line)
        except ValueError:
            continue
        if isinstance(v, dict):
            return v
    return None


def carried(path: str | None, now: dt.datetime) -> tuple[list[dict], str]:
    """Probe warnings from an earlier output file, when it is fresh enough."""
    if not path:
        return [], ""
    try:
        doc = json.loads(Path(path).read_text())
    except (OSError, ValueError):
        return [], "no earlier probe result"
    made = parse_time(doc.get("generated"))
    if made is None or now - made > CARRY_FOR:
        return [], "the earlier probe result is too old"
    return [w for w in doc.get("warnings", []) if w.get("source") == "probe"], "carried from the last probe run"


# ---------------------------------------------------------------- run

def collect(*, rows: list[dict] | None, probe: dict | None, manual: list[dict], now: dt.datetime,
            carry: list[dict] | None = None, notes: dict | None = None) -> dict:
    warns = (heartbeat_warnings(rows, now) if rows is not None else []) + probe_warnings(probe, now)
    if probe is None and carry:
        warns += carry
    seen = {w["id"] for w in warns}
    warns += [m for m in manual if is_active(m, now) and m["id"] not in seen]
    order = {lvl: i for i, lvl in enumerate(reversed(LEVELS))}
    warns.sort(key=lambda w: (order.get(w["level"], 9), w["id"]))
    return {"generated": iso(now), "sources": notes or {}, "warnings": warns}


def public_doc(doc: dict) -> dict:
    """The small /status.json the banner reads."""
    keep = ("id", "level", "title", "detail", "link", "start")
    return {"generated": doc.get("generated", ""), "warnings": [{k: w.get(k, "") for k in keep} for w in doc.get("warnings", [])]}


def site_origin() -> str:
    site = json.loads((ROOT / "web/src/lib/site.json").read_text())
    return os.environ.get("SITE_URL", site["origin"]).rstrip("/")


def live_ids(origin: str) -> set[str] | None:
    """Warning ids on the live site's /status.json; an empty set when it has none yet. None when unreachable."""
    req = urllib.request.Request(f"{origin}/status.json", headers={"User-Agent": "parity-status-check", "Cache-Control": "no-cache"})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            doc = json.loads(r.read().decode())
    except urllib.error.HTTPError as err:
        return set() if err.code == 404 else None
    except (OSError, ValueError):
        return None
    return {str(w.get("id")) for w in doc.get("warnings", []) if isinstance(w, dict)}


def write_output(name: str, value: str) -> None:
    out = os.environ.get("GITHUB_OUTPUT")
    if out:
        with open(out, "a") as f:
            f.write(f"{name}={value}\n")


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--probe", help="the live probe's JSON output (optional)")
    ap.add_argument("--carry", help="an earlier output file whose probe warning is kept when under 90 minutes old")
    ap.add_argument("--out", default=os.environ.get("UPDATES_STATUS_JSON") or str(DEFAULT_OUT))
    ap.add_argument("--compare-live", action="store_true", help="say whether the live /status.json has other warning ids")
    args = ap.parse_args(argv)

    ok, why = automation.enabled(JOB)
    if not ok:
        automation.log(JOB, "skipped", why)
        write_output("changed", "false")
        return 0
    now = now_utc()
    notes = {}
    try:
        manual = load_manual()
    except (ValueError, tomllib.TOMLDecodeError) as err:
        automation.log(JOB, "failed", f"content/updates/status.toml: {err}")
        return 1
    rows = None
    db = os.environ.get("SITE_DATA_DB_URL", "")
    if db:
        try:
            rows = read_heartbeats(db)
            notes["health"] = f"read {len(rows)} service reports"
        except Exception as err:  # noqa: BLE001  a database outage must not stop the probe alert
            notes["health"] = f"could not read the service reports ({type(err).__name__})"
    else:
        notes["health"] = "skipped: SITE_DATA_DB_URL is not set"
    probe = load_probe(args.probe)
    carry, carry_note = ([], "") if probe is not None else carried(args.carry, now)
    notes["probe"] = ("ran" if probe is not None else carry_note or "no probe result")
    doc = collect(rows=rows, probe=probe, manual=manual, now=now, carry=carry, notes=notes)
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(doc, indent=1, sort_keys=True) + "\n")
    ids = sorted(w["id"] for w in doc["warnings"])
    detail = f"{len(ids)} warnings ({', '.join(ids) or 'none'}); health {notes['health']}; probe {notes['probe']}"
    if args.compare_live:
        origin = site_origin()
        live = live_ids(origin)
        if live is None:
            changed = False
            detail += "; the live /status.json could not be read, so no redeploy"
        else:
            changed = live != set(ids)
            detail += f"; live site has {len(live)}, {'different, redeploy' if changed else 'same, no redeploy'}"
        write_output("changed", "true" if changed else "false")
    automation.log(JOB, "collected", detail)
    return 0


if __name__ == "__main__":
    sys.exit(main())
