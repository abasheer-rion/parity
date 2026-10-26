#!/usr/bin/env python3
"""Submits the sitemap to Google Search Console and saves how the site does in Google search.

    python3 scripts/seo/search_console.py --out seo-report/search_console.json [--days 28]

Needs the service account key as JSON text in GSC_SERVICE_ACCOUNT_JSON (a GitHub secret; see
docs/guides "Google Search Console and the SEO pipeline"). The key is read from the environment
only and never printed or written anywhere. Needs `pip install google-auth requests`.

Which Search Console property to use: GSC_SITE_URLS, a comma list tried in order. The default is
the Domain property for paritytrading.app, then the URL-prefix property for the Parity address:
    sc-domain:paritytrading.app,https://paritytrading.app/
For a Domain property the numbers are filtered to pages under https://paritytrading.app/.

It always exits 0 and always writes the report, with "status" saying what happened:
  ok           the sitemap was submitted and the numbers were pulled
  no_key       GSC_SERVICE_ACCOUNT_JSON is not set
  no_library   google-auth or requests is not installed
  no_access    no listed property is verified, or the service account is not a user on it
  error        anything else (the message says what)
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import sys
import urllib.parse
from pathlib import Path

SITE = os.environ.get("SITE_URL", "https://paritytrading.app").rstrip("/")
API = "https://www.googleapis.com/webmasters/v3"
SCOPE = "https://www.googleapis.com/auth/webmasters"
DEFAULT_PROPERTIES = f"sc-domain:paritytrading.app,{SITE}/"


def write(out: Path, report: dict) -> int:
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, indent=2))
    print(f"search_console: {report['status']}: {report['message']}")
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
    args = ap.parse_args()
    out = Path(args.out)
    wanted = [s.strip() for s in os.environ.get("GSC_SITE_URLS", DEFAULT_PROPERTIES).split(",") if s.strip()]
    report: dict = {"generated": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"), "properties_tried": wanted}

    got = session_from_env()
    if isinstance(got[0], str):
        return write(out, {**report, "status": got[0], "message": got[1]})
    session, email = got
    report["service_account"] = email
    try:
        prop, visible = pick_property(session, wanted)
        report["properties_visible"] = visible
        if not prop:
            return write(out, {**report, "status": "no_access", "message":
                               f"None of {', '.join(wanted)} is verified with {email} added as a user. See the SEO guide."})
        report["property"] = prop
        enc = urllib.parse.quote(prop, safe="")
        sitemap = f"{SITE}/sitemap.xml"
        if not args.no_submit:
            r = session.put(f"{API}/sites/{enc}/sitemaps/{urllib.parse.quote(sitemap, safe='')}", timeout=30)
            report["sitemap_submitted"] = r.status_code in (200, 204)
            if not report["sitemap_submitted"]:
                report["sitemap_error"] = f"HTTP {r.status_code}"
        r = session.get(f"{API}/sites/{enc}/sitemaps", timeout=30)
        report["sitemaps"] = [
            {"path": s.get("path"), "last_downloaded": s.get("lastDownloaded"), "errors": s.get("errors"),
             "warnings": s.get("warnings"), "pending": s.get("isPending"),
             "contents": [{"type": c.get("type"), "submitted": c.get("submitted"), "indexed": c.get("indexed")}
                          for c in s.get("contents", [])]}
            for s in r.json().get("sitemap", [])] if r.ok else []

        end = dt.date.today() - dt.timedelta(days=2)  # Search Console data lags about two days
        start = end - dt.timedelta(days=args.days - 1)
        base = {"startDate": start.isoformat(), "endDate": end.isoformat(), "rowLimit": 25}
        if prop.startswith("sc-domain:"):
            base["dimensionFilterGroups"] = [{"filters": [
                {"dimension": "page", "operator": "contains", "expression": f"{SITE}/"}]}]
        perf = {}
        for dim in ("query", "page"):
            r = session.post(f"{API}/sites/{enc}/searchAnalytics/query", json={**base, "dimensions": [dim]}, timeout=60)
            r.raise_for_status()
            perf[dim] = [{dim: row["keys"][0], "clicks": row["clicks"], "impressions": row["impressions"],
                          "ctr": round(row["ctr"], 4), "position": round(row["position"], 1)} for row in r.json().get("rows", [])]
        r = session.post(f"{API}/sites/{enc}/searchAnalytics/query", json={k: v for k, v in base.items() if k != "rowLimit"}, timeout=60)
        r.raise_for_status()
        total = (r.json().get("rows") or [{}])[0]
        report.update({"period": {"start": start.isoformat(), "end": end.isoformat()},
                       "totals": {"clicks": total.get("clicks", 0), "impressions": total.get("impressions", 0)},
                       "top_queries": perf["query"], "top_pages": perf["page"]})
        return write(out, {**report, "status": "ok", "message": f"{prop}: {report['totals']['clicks']} clicks, "
                                                                f"{report['totals']['impressions']} impressions in {args.days} days"})
    except Exception as err:  # noqa: BLE001  report, never crash the job
        status = getattr(getattr(err, "response", None), "status_code", None)
        kind = "no_access" if status in (401, 403, 404) else "error"
        return write(out, {**report, "status": kind, "message": f"{type(err).__name__}" + (f" (HTTP {status})" if status else "")})


if __name__ == "__main__":
    sys.exit(main())
