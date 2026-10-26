"""`parity profiles ...` commands."""

from __future__ import annotations

import json

from . import collect, sources, store


def add_parser(sub):
    p = sub.add_parser("profiles", help="public feedback on the trading products we profile: "
                       "collect it, list the sources and their terms, export counts")
    p.add_argument("action", choices=["collect", "sources", "status", "export"])
    p.add_argument("--product", action="append", help="collect: only these product ids")
    p.add_argument("--source", action="append", help="collect: only these source ids")
    p.add_argument("--json", action="store_true", help="sources/status: print JSON")
    p.add_argument("--publish", action="store_true",
                   help="collect/export: also send the counts to Supabase when configured")
    return p


def run(args) -> int:
    if args.action == "sources":
        return _sources(args)
    con = store.connect()
    if args.action == "collect":
        out = collect.run_pass(con, args.product, args.source, echo=print)
        print(f"\n{out['added']} new items, {out['requests']} requests")
    if args.action in ("collect", "export"):
        doc = collect.export(con)
        print(f"wrote engine/output/profiles.json: {doc['items']:,} items for "
              f"{len(doc['products'])} products")
        if args.publish:
            try:
                collect.publish(doc)
                print("published the counts to Supabase")
            except Exception as exc:  # only the type: errors can quote the connection string
                print(f"not published: {type(exc).__name__}")
        return 0
    doc = collect.summary(con)
    if args.json:
        print(json.dumps(doc, indent=1))
        return 0
    print(collect.health())
    for p in doc["products"].values():
        top = ", ".join(f"{x['label']} {x['count']}" for x in p["praised"][:3]) or "n/a"
        bad = ", ".join(f"{x['label']} {x['count']}" for x in p["complaints"][:3]) or "n/a"
        print(f"  {p['name']:<20} {p['feedback']:>5} items  praised: {top}  complaints: {bad}")
    return 0


def _sources(args) -> int:
    rows = [{"id": s.id, "name": s.name, "status": sources.status_of(s), "access": s.access,
             "terms": s.terms, "terms_url": s.terms_url,
             "key": ", ".join(s.vault) if s.vault else "none", "off": s.off}
            for s in sources.SOURCES]
    if args.json:
        print(json.dumps(rows, indent=1))
        return 0
    for r in rows:
        print(f"{r['id']:<17} {r['status']:<10} {r['access']}; key: {r['key']}")
        print(f"{'':<17} {r['name']}. {r['terms']}.")
    on = sum(r["status"] == "on" for r in rows)
    print(f"\n{on} of {len(rows)} sources on. Keys are read from the environment by name and "
          "never printed. A source can still be skipped at run time by robots.txt.")
    return 0
