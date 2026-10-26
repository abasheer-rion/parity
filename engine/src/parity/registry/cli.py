"""`parity registry ...` (DEC-0064)."""

from __future__ import annotations

import json
from collections import Counter


def add_parser(sub):
    p = sub.add_parser("registry", help="the data registry: every source and series, its "
                       "rights, status and health (DEC-0064)")
    p.add_argument("action", choices=["sync", "status", "sources", "series", "publish",
                                      "discover", "enrol", "candidates", "cycle", "backtest"])
    p.add_argument("--only", nargs="*", default=None, help="discover: only these discoverers")
    p.add_argument("--limit", type=int, default=5, help="enrol: candidates to try")
    p.add_argument("--status", default=None, help="series: only this status")
    p.add_argument("--source", default=None, help="series: only this source")
    p.add_argument("--tag", default=None, help="series: only series with this tag")
    p.add_argument("--json", action="store_true", help="print JSON")
    return p


def run(args) -> int:
    from . import db, publish, sync

    con = db.connect()
    if args.action == "sync":
        out = sync.sync(con)
        print(f"{out['sources']} sources changed, {out['added']} series added, "
              f"{out['updated']} updated, {out['retired']} retired"
              + ("; lineage changed" if out["lineage"] else ""))
        return 0
    if args.action == "publish":
        print(publish.try_publish(con))
        return 0
    if args.action == "discover":
        from . import discover

        report = discover.run(con, args.only)
        for name, r in report.items():
            what = (f"found {r['found']}, added {r['added']}" if "found" in r else
                    r.get("skipped") or r.get("error"))
            print(f"{name:<12} {what}")
        return 0
    if args.action == "enrol":
        from . import enrol

        for r in enrol.run(con, args.limit):
            print(f"{r['id']:<32} {'enrolled' if r['enrolled'] else 'waits'}"
                  f"  {r.get('reason') or ''}")
        return 0
    if args.action == "backtest":
        from . import battery

        for r in battery.run_due(con, args.limit):
            print(f"{r['id']:<32} " + (f"{r['tests']} tests, {r['new_trials']} new trials"
                                       if "tests" in r else r["error"]))
        return 0
    if args.action == "cycle":
        from . import cycle

        print(cycle.line(cycle.run(con)))
        return 0
    if args.action == "candidates":
        rows = db.all_series(con, status="candidate")
        for r in rows:
            print(f"{r['id']:<32} {r['discovered_by']:<11} {r['reason'][:80]}")
        print(f"\n{len(rows)} candidates")
        return 0
    if args.action == "sources":
        rows = db.sources(con)
        if args.json:
            print(json.dumps(rows, indent=1))
            return 0
        for r in rows:
            print(f"{r['id']:<17} {r['display_rights']:<9} {r['status']:<8} terms read "
                  f"{r['terms_read_on'] or 'n/a':<10} {r['name']}")
        print(f"\n{len(rows)} sources")
        return 0
    rows = db.all_series(con, status=args.status)
    rows = [r for r in rows if (not args.source or r["source_id"] == args.source)
            and (not args.tag or args.tag in r["tags"])]
    if args.action == "series":
        if args.json:
            print(json.dumps(rows, indent=1))
            return 0
        width = max((len(r["id"]) for r in rows), default=10)
        for r in rows:
            q = "n/a" if r["quality"] is None else f"{r['quality']:.2f}"
            print(f"{r['id']:<{width}}  {r['status']:<9} {r['health']:<7} {r['display_rights']:<8}"
                  f" q {q:<4}  {r['name'][:70]}")
        print(f"\n{len(rows)} series")
        return 0
    by_status = Counter(r["status"] for r in rows)
    by_health = Counter(r["health"] for r in rows)
    by_rights = Counter(r["display_rights"] for r in rows)
    print(f"{len(db.sources(con))} sources, {len(rows)} series")
    print("status: " + ", ".join(f"{k} {v}" for k, v in sorted(by_status.items())))
    print("health: " + ", ".join(f"{k} {v}" for k, v in sorted(by_health.items())))
    print("rights: " + ", ".join(f"{k} {v}" for k, v in sorted(by_rights.items())))
    print("newest events:")
    for e in db.events(con, limit=10):
        who = e["series_id"] or e["source_id"] or ""
        move = f"{e['from_state'] or ''} to {e['to_state']}" if e["to_state"] else ""
        print(f"  {e['at']}  {e['kind']:<10} {who:<24} {move}")
    return 0
