#!/usr/bin/env python3
"""Submits the sitemap to Google Search Console and saves how the site does in Google search.

    python3 scripts/seo/search_console.py --out seo-report/search_console.json [--days 28]

Needs the service account key as JSON text in GSC_SERVICE_ACCOUNT_JSON (a GitHub secret; see
docs/guides "Google Search Console and the SEO pipeline"). The key is read from the environment
only and never printed or written anywhere. Needs `pip install google-auth requests`.

Which Search Console property to use: the URL-prefix property for the site's address
(web/src/lib/site.json, DEC-0038), then its Domain property, then any in GSC_SITE_URLS (a comma
list). For a Domain property the numbers are filtered to pages under the site's address.

What it does (DEC-0073):
  - submits /sitemap.xml (the index of the section sitemaps); --submit-only stops there
  - pulls clicks, impressions, CTR and position by query and by page for the last N days and
    the N days before, so the report can show ranking changes
  - inspects up to --inspect URLs from the sitemap with the URL Inspection API (index status,
    coverage state, last crawl), section front pages first, then a sample that changes each week
Google's Indexing API is not used: Google allows it only for job postings and live streams.

Kill switch and log (scripts/seo/automation.py): with --submit-only this is the job
"gsc_submit" (after each deploy); otherwise it is the weekly "seo_report", which also skips the
sitemap submit when "gsc_submit" is off. Each run logs one line saying what it did.

It always exits 0 and always writes the report, with "status" saying what happened:
  ok           the sitemap was submitted and the numbers were pulled
  no_key       GSC_SERVICE_ACCOUNT_JSON is not set
  no_library   google-auth or requests is not installed
  no_access    no listed property is verified, or the service account is not a user on it
  error        anything else (the message says what)
  off          the job is switched off (content/seo/automation.toml or SEO_AUTOMATION)
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import re
import sys
import urllib.parse
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from automation import enabled, log  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
SITE = os.environ.get("SITE_URL", json.loads((ROOT / "web/src/lib/site.json").read_text())["origin"]).rstrip("/")
API = "https://www.googleapis.com/webmasters/v3"
INSPECT = "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect"
SCOPE = "https://www.googleapis.com/auth/webmasters"


def properties() -> list[str]:
    """The properties to try, in order: the URL-prefix property https://<site>/ from
    web/src/lib/site.json, its Domain property, then any listed in GSC_SITE_URLS."""
    host = SITE.split("://", 1)[1]
    extra = [s.strip() for s in os.environ.get("GSC_SITE_URLS", "").split(",") if s.strip()]
    out = []
    for prop in [f"{SITE}/", f"sc-domain:{host}", *extra]:
        if prop not in out:
            out.append(prop)
    return out


def sitemap_urls(site_dir: Path | None) -> list[str]:
    """Every URL in the built sitemaps, or none when the site was not built."""
    if not site_dir or not (site_dir / "sitemaps").is_dir():
        return []
    urls = []
    for f in sorted((site_dir / "sitemaps").glob("*.xml")):
        urls += re.findall(r"<loc>([^<]+)</loc>", f.read_text())
    return urls


def inspect_sample(urls: list[str], limit: int) -> list[str]:
    """Section front pages first, then a slice of the rest that moves on each ISO week."""
    fronts = [u for u in urls if u.rstrip("/").count("/") <= 3]
    rest = [u for u in urls if u not in fronts]
    week = dt.date.today().isocalendar()[1]
    n = max(0, limit - len(fronts))
    start = (week * n) % len(rest) if rest and n else 0
    return (fronts + (rest[start:] + rest[:start])[:n])[:limit]


def perf(session, enc: str, base: dict, dims: list[str], limit: int) -> list[dict]:
    r = session.post(f"{API}/sites/{enc}/searchAnalytics/query", json={**base, "dimensions": dims, "rowLimit": limit}, timeout=60)
    r.raise_for_status()
    return [{**{d: row["keys"][i] for i, d in enumerate(dims)}, "clicks": row["clicks"], "impressions": row["impressions"],
             "ctr": round(row["ctr"], 4), "position": round(row["position"], 1)} for row in r.json().get("rows", [])]


def write(out: Path, report: dict, job: str = "seo_report") -> int:
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, indent=2))
    log(job, report["status"], report["message"])
    return 0


def session_from_env():
    """The AuthorizedSession, or a (status, message) pair saying why there is none."""
    raw = os.environ.get("GSC_SERVICE_ACCOUNT_JSON", "").strip()
    if not raw:
        return ("no_key", "GSC_SERVICE_ACCOUNT_JSON is not set, so Google was skipped. See the SEO guide.")
    try:
        from google.auth.transport.requests import AuthorizedSession
        from google.oauth2 import service_account
    except ImportError:
        return ("no_library", "pip install google-auth requests, then run again.")
    try:
        info = json.loads(raw)
        creds = service_account.Credentials.from_service_account_info(info, scopes=[SCOPE])
    except (ValueError, KeyError):
        # Never echo the value: it is the private key.
        return ("error", "GSC_SERVICE_ACCOUNT_JSON is not a valid service account key (value not shown).")
    return AuthorizedSession(creds), info.get("client_email", "")


def pick_property(session, wanted: list[str]) -> tuple[str | None, list[str]]:
    res = session.get(f"{API}/sites", timeout=30)
    res.raise_for_status()
    usable = {s["siteUrl"]: s["permissionLevel"] for s in res.json().get("siteEntry", [])
              if s.get("permissionLevel") != "siteUnverifiedUser"}
    for site in wanted:
        if site in usable:
            return site, sorted(usable)
    return None, sorted(usable)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", default="seo-report/search_console.json")
    ap.add_argument("--days", type=int, default=28)
    ap.add_argument("--no-submit", action="store_true", help="only read numbers, do not (re)submit the sitemap")
    ap.add_argument("--submit-only", action="store_true", help="submit the sitemap and stop (after a deploy)")
    ap.add_argument("--site-dir", help="the built site, for the URLs to inspect")
    ap.add_argument("--inspect", type=int, default=40, help="how many URLs to inspect (the API allows 2,000 a day)")
    args = ap.parse_args()
    out = Path(args.out)
    wanted = properties()
    report: dict = {"generated": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"), "properties_tried": wanted}
    job = "gsc_submit" if args.submit_only else "seo_report"
    ok, why = enabled(job)
    if not ok:
        return write(out, {**report, "status": "off", "message": why}, job)
    if not args.no_submit and not args.submit_only:
        submit_ok, submit_why = enabled("gsc_submit")
        if not submit_ok:
            log("gsc_submit", "skipped", submit_why)
            args.no_submit = True

    got = session_from_env()
    if isinstance(got[0], str):
        return write(out, {**report, "status": got[0], "message": got[1]}, job)
    session, email = got
    report["service_account"] = email
    try:
        prop, visible = pick_property(session, wanted)
        report["properties_visible"] = visible
        if not prop:
            return write(out, {**report, "status": "no_access", "message":
                               f"None of {', '.join(wanted)} is verified with {email} added as a user. See the SEO guide."}, job)
        report["property"] = prop
        enc = urllib.parse.quote(prop, safe="")
        sitemap = f"{SITE}/sitemap.xml"
        if not args.no_submit:
            r = session.put(f"{API}/sites/{enc}/sitemaps/{urllib.parse.quote(sitemap, safe='')}", timeout=30)
            report["sitemap_submitted"] = r.status_code in (200, 204)
            if not report["sitemap_submitted"]:
                report["sitemap_error"] = f"HTTP {r.status_code}"
        if args.submit_only:
            return write(out, {**report, "status": "ok" if report.get("sitemap_submitted") else "error",
                               "message": f"{prop}: sitemap {'submitted' if report.get('sitemap_submitted') else 'not accepted'}"},
                         job)
        r = session.get(f"{API}/sites/{enc}/sitemaps", timeout=30)
        report["sitemaps"] = [
            {"path": s.get("path"), "last_downloaded": s.get("lastDownloaded"), "errors": s.get("errors"),
             "warnings": s.get("warnings"), "pending": s.get("isPending"),
             "contents": [{"type": c.get("type"), "submitted": c.get("submitted"), "indexed": c.get("indexed")}
                          for c in s.get("contents", [])]}
            for s in r.json().get("sitemap", [])] if r.ok else []

        end = dt.date.today() - dt.timedelta(days=2)  # Search Console data lags about two days
        start = end - dt.timedelta(days=args.days - 1)
        pstart, pend = start - dt.timedelta(days=args.days), start - dt.timedelta(days=1)
        filt = {"dimensionFilterGroups": [{"filters": [{"dimension": "page", "operator": "contains", "expression": f"{SITE}/"}]}]} \
            if prop.startswith("sc-domain:") else {}
        cur = {"startDate": start.isoformat(), "endDate": end.isoformat(), **filt}
        prev = {"startDate": pstart.isoformat(), "endDate": pend.isoformat(), **filt}
        totals = {}
        for name, base in (("current", cur), ("previous", prev)):
            r = session.post(f"{API}/sites/{enc}/searchAnalytics/query", json=base, timeout=60)
            r.raise_for_status()
            row = (r.json().get("rows") or [{}])[0]
            totals[name] = {"clicks": row.get("clicks", 0), "impressions": row.get("impressions", 0)}
        queries = {"current": perf(session, enc, cur, ["query"], 250), "previous": perf(session, enc, prev, ["query"], 250)}
        pages = {"current": perf(session, enc, cur, ["page"], 250), "previous": perf(session, enc, prev, ["page"], 250)}
        pairs = perf(session, enc, cur, ["query", "page"], 500)
        inspected = []
        for url in inspect_sample(sitemap_urls(Path(args.site_dir) if args.site_dir else None), args.inspect):
            r = session.post(INSPECT, json={"inspectionUrl": url, "siteUrl": prop}, timeout=60)
            if not r.ok:
                inspected.append({"url": url, "error": f"HTTP {r.status_code}"})
                if r.status_code == 429:
                    break
                continue
            res = r.json().get("inspectionResult", {}).get("indexStatusResult", {})
            inspected.append({"url": url, "verdict": res.get("verdict"), "coverage": res.get("coverageState"),
                              "indexing": res.get("indexingState"), "last_crawl": res.get("lastCrawlTime"),
                              "google_canonical": res.get("googleCanonical")})
        report.update({"period": {"start": start.isoformat(), "end": end.isoformat()},
                       "previous_period": {"start": pstart.isoformat(), "end": pend.isoformat()},
                       "totals": totals["current"], "totals_previous": totals["previous"],
                       "queries": queries, "pages": pages, "query_pages": pairs, "inspected": inspected,
                       "top_queries": queries["current"][:25], "top_pages": pages["current"][:25]})
        return write(out, {**report, "status": "ok", "message": f"{prop}: {report['totals']['clicks']} clicks, "
                                                                f"{report['totals']['impressions']} impressions in {args.days} days"})
    except Exception as err:  # noqa: BLE001  report, never crash the job
        status = getattr(getattr(err, "response", None), "status_code", None)
        kind = "no_access" if status in (401, 403, 404) else "error"
        return write(out, {**report, "status": kind, "message": f"{type(err).__name__}" + (f" (HTTP {status})" if status else "")},
                     job)


if __name__ == "__main__":
    sys.exit(main())
