"""One registry cycle (DEC-0064), run as a step of the always-on sims service:

    1. sync         the catalog, providers and live feeds into the registry
    2. discover     every discoverer, at most once a day
    3. enrol        up to 5 candidates through the gate
    4. publish      every change to the site's database, when a writer URL is set

Each part has its own try, so one that fails is recorded and the rest still run.
"""

from __future__ import annotations

import time

from . import db, discover, enrol, publish, sync

ENROL_PER_CYCLE = 5


def run(con=None, discovery: bool = True, send: bool = True) -> dict:
    con = con or db.connect()
    out: dict = {"parts": {}}

    def part(name: str, fn):
        t0 = time.time()
        try:
            out["parts"][name] = {"ok": True, "result": fn(),
                                  "seconds": round(time.time() - t0, 1)}
        except Exception as exc:  # recorded; the rest of the cycle still runs
            out["parts"][name] = {"ok": False, "error": type(exc).__name__,
                                  "seconds": round(time.time() - t0, 1)}

    part("sync", lambda: sync.sync(con))
    if discovery:
        part("discover", lambda: discover.discover_if_due(con))
    part("enrol", lambda: enrol.run(con, ENROL_PER_CYCLE))
    if send:
        part("publish", lambda: publish.try_publish(con))
    out["summary"] = summary(con)
    return out


def summary(con) -> dict:
    """Counts for the service's heartbeat and log line."""
    rows = db.all_series(con)
    by = {}
    for r in rows:
        by[r["status"]] = by.get(r["status"], 0) + 1
    return {"series": len(rows), "sources": len(db.sources(con)), **by,
            "health_bad": sum(r["health"] in ("stale", "dead") for r in rows
                              if r["status"] != "retired")}


def line(out: dict) -> str:
    """One short line for the sims log."""
    s = out["summary"]
    bad = [k for k, v in out["parts"].items() if not v["ok"]]
    found = (out["parts"].get("discover") or {}).get("result")
    added = sum(v.get("added", 0) for v in found.values()) if isinstance(found, dict) else None
    enrolled = sum(r.get("enrolled", False) for r in
                   (out["parts"].get("enrol") or {}).get("result") or [])
    return (f"registry: {s['series']} series ({s.get('live', 0)} live, "
            f"{s.get('enrolled', 0)} enrolled, {s.get('candidate', 0)} candidates, "
            f"{s.get('degraded', 0)} degraded)"
            + (f", discovery added {added}" if added is not None else "")
            + (f", enrolled {enrolled}" if enrolled else "")
            + (f"; failed: {', '.join(bad)}" if bad else ""))
