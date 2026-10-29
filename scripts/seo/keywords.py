#!/usr/bin/env python3
"""Keyword choice from real Search Console queries (DEC-0073).

    python3 scripts/seo/keywords.py --gsc seo-report/search_console.json --out seo-report/keywords.json

Puts every query in one of the topic clusters in content/seo/keywords.toml (strategies,
backtesting, bots, verify, markets) by its seed words, then for each cluster:
  - clicks and impressions this period and the one before
  - the query with the most impressions, as the suggested keyword, and whether the cluster's
    pages already target it
  - "almost page one": queries at position 8 to 20 with impressions, the cheapest wins
Queries that match no cluster are listed too, as candidates for a new cluster or seed word.
Google Trends is not used: the only free client (pytrends) scrapes Google without permission
and is archived, and Google's own Trends API is in a closed alpha (see DEC-0073).
Part of the weekly job "seo_report" (kill switch and log in scripts/seo/automation.py).
Standard library only.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import tomllib
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from automation import enabled, log  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]


def load_plan(path: Path | None = None) -> list[dict]:
    return tomllib.loads((path or ROOT / "content/seo/keywords.toml").read_text()).get("cluster", [])


def cluster_of(query: str, plan: list[dict]) -> str | None:
    """The first cluster with a seed word in the query (whole words, any case)."""
    q = f" {re.sub(r'[^a-z0-9&]+', ' ', query.lower())} "
    for c in plan:
        for seed in c["seeds"]:
            if f" {seed.lower()} " in q or (len(seed) > 4 and f" {seed.lower()}" in q):
                return c["id"]
    return None


def analyse(gsc: dict, plan: list[dict]) -> dict:
    now = gsc.get("queries", {}).get("current", []) or gsc.get("top_queries", [])
    before = {r["query"]: r for r in gsc.get("queries", {}).get("previous", [])}
    out = {c["id"]: {"label": c["label"], "clicks": 0, "impressions": 0, "clicks_before": 0, "impressions_before": 0,
                     "queries": [], "targets": [p["keyword"] for p in c.get("page", [])]} for c in plan}
    unmatched = []
    for r in now:
        cid = cluster_of(r["query"], plan)
        if cid is None:
            unmatched.append(r)
            continue
        c = out[cid]
        c["clicks"] += r["clicks"]
        c["impressions"] += r["impressions"]
        prev = before.get(r["query"])
        c["queries"].append({**r, "position_before": prev["position"] if prev else None})
    for r in before.values():
        cid = cluster_of(r["query"], plan)
        if cid:
            out[cid]["clicks_before"] += r["clicks"]
            out[cid]["impressions_before"] += r["impressions"]
    for c in out.values():
        c["queries"].sort(key=lambda r: -r["impressions"])
        top = c["queries"][0]["query"] if c["queries"] else None
        c["suggested_keyword"] = top
        c["targeted"] = bool(top) and any(t.lower() in top.lower() or top.lower() in t.lower() for t in c["targets"])
        c["almost_page_one"] = [r for r in c["queries"] if 8 <= r["position"] <= 20 and r["impressions"] >= 5][:10]
        c["queries"] = c["queries"][:15]
    unmatched.sort(key=lambda r: -r["impressions"])
    return {"clusters": out, "unmatched": unmatched[:20]}


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--gsc", default="seo-report/search_console.json")
    ap.add_argument("--out", default="seo-report/keywords.json")
    args = ap.parse_args()
    ok, why = enabled("seo_report")
    if not ok:
        log("seo_report", "skipped", f"keywords: {why}")
        return 0
    path = Path(args.gsc)
    gsc = json.loads(path.read_text()) if path.exists() else {}
    result = analyse(gsc, load_plan())
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    Path(args.out).write_text(json.dumps(result, indent=2))
    for cid, c in result["clusters"].items():
        print(f"keywords: {cid}: {c['clicks']} clicks, {c['impressions']} impressions, suggested {c['suggested_keyword']!r}")
    log("seo_report", "keywords", f"{len(result['clusters'])} clusters, {len(result['unmatched'])} queries in no cluster")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
