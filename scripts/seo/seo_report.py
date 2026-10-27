#!/usr/bin/env python3
"""Writes the weekly SEO summary as short markdown (DEC-0023, DEC-0073).

    python3 scripts/seo/seo_report.py --site-dir web/dist --gsc seo-report/search_console.json \\
        --keywords seo-report/keywords.json --meta seo-report/meta.json --out seo-report/summary.md

Reads the built sitemaps (how many public pages exist, by section), the Search Console report
from search_console.py (index coverage, clicks, impressions, queries and ranking changes), the
keyword clusters from keywords.py and the page checks from meta_check.py (with its internal
link suggestions). The job "seo_report" in content/seo/automation.toml switches it off; each run
logs one line (scripts/seo/automation.py). Standard library only.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from automation import enabled, log  # noqa: E402


def load(path: str) -> dict:
    p = Path(path)
    return json.loads(p.read_text()) if path and p.exists() else {}


def sitemap_counts(site_dir: Path) -> Counter:
    counts: Counter = Counter()
    for f in sorted((site_dir / "sitemaps").glob("*.xml")) if (site_dir / "sitemaps").is_dir() else []:
        counts[f.stem] = len(re.findall(r"<loc>", f.read_text()))
    if not counts and (site_dir / "sitemap.xml").exists():
        counts["all"] = len(re.findall(r"<url>", (site_dir / "sitemap.xml").read_text()))
    return counts


def delta(now: float, before: float) -> str:
    if not before:
        return "new" if now else "0"
    pct = (now - before) / before * 100
    return f"{pct:+.0f}%"


def ranking_changes(gsc: dict, n: int = 8) -> tuple[list, list]:
    before = {r["query"]: r for r in gsc.get("queries", {}).get("previous", [])}
    moves = []
    for r in gsc.get("queries", {}).get("current", []):
        prev = before.get(r["query"])
        if prev and r["impressions"] >= 5:
            moves.append((prev["position"] - r["position"], r, prev))
    moves.sort(key=lambda m: -m[0])
    gains = [m for m in moves if m[0] >= 1][:n]
    losses = [m for m in reversed(moves) if m[0] <= -1][:n]
    return gains, losses


def page_changes(gsc: dict, n: int = 10) -> list[tuple[dict, dict | None]]:
    """The top pages by clicks now, each with its row from the period before (or None)."""
    before = {r["page"]: r for r in gsc.get("pages", {}).get("previous", [])}
    rows = gsc.get("pages", {}).get("current", [])[:n] or gsc.get("top_pages", [])[:n]
    return [(r, before.get(r["page"])) for r in rows]


def keyword_suggestions(kw: dict) -> list[str]:
    """One line per cluster whose most searched query is not yet in its pages' keywords."""
    out = []
    for c in kw.get("clusters", {}).values():
        if c.get("suggested_keyword") and not c.get("targeted"):
            pages = ", ".join(c.get("targets") or []) or "no keyword yet"
            out.append(f"- {c['label']}: people search for \"{c['suggested_keyword']}\". "
                       f"The cluster's pages target: {pages}. Consider using it in a title or description "
                       f"(content/seo/keywords.toml).")
    return out


def link_lines(meta: dict, n: int = 15) -> list[str]:
    sugg = meta.get("link_suggestions") or [{"page": p, "link_from": ""} for p in meta.get("orphans", [])]
    return [f"- {s['page']}" + (f": link to it from {s['link_from']}" if s.get("link_from") else "") for s in sugg[:n]]


def render(site_dir: Path, gsc: dict, kw: dict, meta: dict) -> str:
    counts = sitemap_counts(site_dir)
    lines = ["# Parity SEO report", "",
             f"- Public pages in the sitemaps: **{sum(counts.values())}** ({', '.join(f'{k} {v}' for k, v in sorted(counts.items()))})"]
    if meta:
        lines.append(f"- Page checks (titles, descriptions, canonical links, JSON-LD): "
                     f"{sum(len(v) for v in meta.get('problems', {}).values())} problem(s); "
                     f"{len(meta.get('orphans', []))} page(s) no other page links to")
    if gsc.get("status") != "ok":
        lines += [f"- Google: not connected yet ({gsc.get('status', 'missing')}: {gsc.get('message', 'no Search Console report')})"]
    else:
        lines += google_sections(gsc)

    if kw.get("clusters"):
        lines += ["", "## Keyword clusters", "", "| Cluster | Clicks | Impressions | Change | Suggested keyword | Already targeted |",
                  "|---|---|---|---|---|---|"]
        for c in kw["clusters"].values():
            lines.append(f"| {c['label']} | {c['clicks']} | {c['impressions']} | {delta(c['impressions'], c['impressions_before'])} | "
                         f"{c['suggested_keyword'] or 'none yet'} | {'yes' if c['targeted'] else 'no' if c['suggested_keyword'] else ''} |")
        sugg = keyword_suggestions(kw)
        if sugg:
            lines += ["", "## Keyword suggestions", ""] + sugg
        near = [(c["label"], r) for c in kw["clusters"].values() for r in c["almost_page_one"]][:10]
        if near:
            lines += ["", "Almost on page one (position 8 to 20):", ""] + [
                f"- {r['query']} ({label}): position {r['position']}, {r['impressions']} impressions" for label, r in near]
        if kw.get("unmatched"):
            lines += ["", "Queries in no cluster:", ""] + [f"- {r['query']} ({r['impressions']} impressions)" for r in kw["unmatched"][:8]]

    links = link_lines(meta)
    if links:
        lines += ["", "## Internal link suggestions", "", "Public pages no other public page links to:", ""] + links
    problems = {k: v for k, v in meta.get("problems", {}).items() if v}
    if problems:
        lines += ["", "## Page check problems", ""] + [f"- {p}: {items[0]}" for p, items in sorted(problems.items())[:15]]
    return "\n".join(lines) + "\n"


def google_sections(gsc: dict) -> list[str]:
    lines = []
    t, tp, p = gsc.get("totals", {}), gsc.get("totals_previous", {}), gsc.get("period", {})
    lines += [f"- Google ({gsc['property']}, {p.get('start')} to {p.get('end')}): **{t.get('clicks', 0)}** clicks "
              f"({delta(t.get('clicks', 0), tp.get('clicks', 0))} on the period before), **{t.get('impressions', 0)}** impressions "
              f"({delta(t.get('impressions', 0), tp.get('impressions', 0))})"]
    submitted = sum(int(c.get("submitted") or 0) for s in gsc.get("sitemaps", []) for c in s.get("contents", []))
    indexed = [c.get("indexed") for s in gsc.get("sitemaps", []) for c in s.get("contents", []) if c.get("indexed") is not None]
    lines.append(f"- Sitemaps: {submitted or 'unknown'} URLs submitted, "
                 f"{sum(map(int, indexed)) if indexed else 'indexed count not reported by Google'} indexed")

    inspected = gsc.get("inspected", [])
    if inspected:
        verdicts = Counter(i.get("verdict") or "error" for i in inspected)
        states = Counter(i.get("coverage") or i.get("error", "unknown") for i in inspected)
        lines += ["", "## Index coverage (URL Inspection sample)", "",
                  f"{len(inspected)} URLs inspected: " + ", ".join(f"{k} {v}" for k, v in verdicts.most_common()), ""]
        lines += ["| Coverage | URLs |", "|---|---|"] + [f"| {k} | {v} |" for k, v in states.most_common()]
        not_indexed = [i for i in inspected if i.get("verdict") not in ("PASS", None) or i.get("error")][:10]
        if not_indexed:
            lines += ["", "Not indexed yet:", ""] + [f"- {i['url']}: {i.get('coverage') or i.get('error')}" for i in not_indexed]

    rows = gsc.get("queries", {}).get("current", [])[:10] or gsc.get("top_queries", [])[:10]
    lines += ["", "## Top queries", ""]
    lines += (["| Query | Clicks | Impressions | Position |", "|---|---|---|---|"]
              + [f"| {r['query']} | {r['clicks']} | {r['impressions']} | {r['position']} |" for r in rows]) if rows else ["No queries yet."]

    pages = page_changes(gsc)
    if pages:
        lines += ["", "## Top pages", "", "| Page | Clicks | Change | Impressions | Position | Position before |", "|---|---|---|---|---|---|"]
        lines += [f"| {r['page']} | {r['clicks']} | {delta(r['clicks'], prev['clicks'] if prev else 0)} | {r['impressions']} | "
                  f"{r['position']} | {prev['position'] if prev else 'new'} |" for r, prev in pages]

    gains, losses = ranking_changes(gsc)
    if gains or losses:
        lines += ["", "## Ranking changes", "", "| Query | Position before | Position now |", "|---|---|---|"]
        lines += [f"| {r['query']} | {prev['position']} | {r['position']} |" for _, r, prev in gains + losses]
    return lines


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--site-dir", default="web/dist")
    ap.add_argument("--gsc", default="seo-report/search_console.json")
    ap.add_argument("--keywords", default="seo-report/keywords.json")
    ap.add_argument("--meta", default="seo-report/meta.json")
    ap.add_argument("--out", default="seo-report/summary.md")
    args = ap.parse_args()
    ok, why = enabled("seo_report")
    if not ok:
        log("seo_report", "skipped", why)
        return 0
    text = render(Path(args.site_dir), load(args.gsc) or {"status": "missing"}, load(args.keywords), load(args.meta))
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(text)
    print(text)
    gsc = load(args.gsc)
    log("seo_report", "written", f"{out}; Google status {gsc.get('status', 'missing')}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
