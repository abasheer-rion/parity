#!/usr/bin/env python3
"""Tells search engines (Bing, Yandex and others, through IndexNow) which public pages changed.

    python3 scripts/seo/indexnow.py --manifest web/dist/seo-manifest.json --previous prev.json [--dry-run]

The site build writes seo-manifest.json (URL -> content hash). The deploy job saves the live
copy before it deploys (--previous) and runs this after, so only new or changed URLs are sent.
With no previous manifest (first run), every URL is sent. Standard library only.

The IndexNow key is public by design: it is the name and the content of a text file at the
site root (web/public/<key>.txt), which proves we own the site. It is not a secret.
Google does not use IndexNow; it reads sitemap.xml (see scripts/seo/search_console.py).
The job "indexnow" in content/seo/automation.toml (or the SEO_AUTOMATION variable) switches it
off, and every run logs one line saying what it did (scripts/seo/automation.py, DEC-0073).
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from automation import enabled, log  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
ENDPOINT = "https://api.indexnow.org/indexnow"


def find_key() -> str:
    for p in (ROOT / "web/public").glob("*.txt"):
        if re.fullmatch(r"[0-9a-f]{32}", p.stem) and p.read_text().strip() == p.stem:
            return p.stem
    raise SystemExit("indexnow: no key file (web/public/<32 hex>.txt) found")


def load(path: str | None) -> dict[str, str]:
    if not path or not Path(path).exists():
        return {}
    try:
        return json.loads(Path(path).read_text()).get("urls", {})
    except (json.JSONDecodeError, AttributeError):
        return {}  # a missing or HTML 404 page saved by curl counts as no previous manifest


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--manifest", required=True)
    ap.add_argument("--previous")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    ok, why = enabled("indexnow")
    if not ok:
        log("indexnow", "skipped", why)
        return 0
    data = json.loads(Path(args.manifest).read_text())
    site, now, before = data["site"].rstrip("/"), data["urls"], load(args.previous)
    changed = sorted(p for p, h in now.items() if before.get(p) != h)
    if not changed:
        log("indexnow", "nothing_changed", f"0 of {len(now)} URLs changed, nothing sent")
        return 0
    key = find_key()
    host = site.split("://", 1)[1]
    urls = [site + p for p in changed][:10000]
    print(f"indexnow: {len(urls)} changed URL(s) of {len(now)}" + (" (dry run)" if args.dry_run else ""))
    for u in urls[:10]:
        print("  " + u)
    if args.dry_run:
        log("indexnow", "dry_run", f"{len(urls)} URLs would be sent")
        return 0
    body = json.dumps({"host": host, "key": key, "keyLocation": f"{site}/{key}.txt", "urlList": urls}).encode()
    req = urllib.request.Request(ENDPOINT, data=body, headers={"Content-Type": "application/json; charset=utf-8"})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=30) as res:
                log("indexnow", "sent", f"{len(urls)} URLs accepted (HTTP {res.status})")
                return 0
        except urllib.error.HTTPError as err:
            # 403 right after a deploy = the key file is not live yet, so wait and retry.
            # 422 = URLs not on this host, 429 = too often. Never fail the deploy.
            if err.code == 403 and attempt < 3:
                time.sleep(30)
                continue
            log("indexnow", "not_accepted", f"HTTP {err.code} for {len(urls)} URLs; skipped this time")
        except urllib.error.URLError as err:
            log("indexnow", "unreachable", f"could not reach IndexNow ({err.reason}); skipped this time")
        return 0
    return 0


if __name__ == "__main__":
    sys.exit(main())
