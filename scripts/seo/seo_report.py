#!/usr/bin/env python3
"""Writes the weekly SEO summary as short markdown.

    python3 scripts/seo/seo_report.py --site-dir web/dist --gsc seo-report/search_console.json --out seo-report/summary.md

Reads the built sitemap (how many public pages exist) and the Search Console report from
search_console.py (indexed count and top queries, once Google access is set up). Standard library only.
"""
from __future__ import annotations

import argparse
import json
import re
from collections import Counter
from pathlib import Path


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--site-dir", default="web/dist")
    ap.add_argument("--gsc", default="seo-report/search_console.json")
    ap.add_argument("--out", default="seo-report/summary.md")
    args = ap.parse_args()

    locs = re.findall(r"<loc>https?://[^/]+(/[^<]*)</loc>", (Path(args.site_dir) / "sitemap.xml").read_text())
    sections = Counter(p.strip("/").split("/")[0] or "front page" for p in locs)
    gsc_path = Path(args.gsc)
    gsc = json.loads(gsc_path.read_text()) if gsc_path.exists() else {"status": "missing", "message": "no Search Console report"}

    lines = ["# Parity SEO report", "", f"- Public pages in the sitemap: **{len(locs)}** "
             f"({', '.join(f'{k} {v}' for k, v in sorted(sections.items()))})"]
    if gsc.get("status") == "ok":
        indexed = [c.get("indexed") for s in gsc.get("sitemaps", []) for c in s.get("contents", []) if c.get("indexed") is not None]
        submitted = [c.get("submitted") for s in gsc.get("sitemaps", []) for c in s.get("contents", []) if c.get("submitted") is not None]
        t = gsc.get("totals", {})
        p = gsc.get("period", {})
        lines += [f"- Google ({gsc['property']}, {p.get('start')} to {p.get('end')}): "
                  f"**{t.get('clicks', 0)}** clicks, **{t.get('impressions', 0)}** impressions",
                  f"- Sitemap: {sum(map(int, submitted)) if submitted else 'unknown'} submitted, "
                  f"{sum(map(int, indexed)) if indexed else 'not reported by Google'} indexed", "",
                  "## Top queries", ""]
        rows = gsc.get("top_queries", [])[:10]
        lines += ["| Query | Clicks | Impressions | Position |", "|---|---|---|---|"] + [
            f"| {r['query']} | {r['clicks']} | {r['impressions']} | {r['position']} |" for r in rows] if rows else ["No queries yet."]
    else:
        lines += [f"- Google: not connected yet ({gsc.get('status')}: {gsc.get('message')})"]
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("\n".join(lines) + "\n")
    print(out.read_text())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
