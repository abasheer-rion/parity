#!/usr/bin/env python3
"""Verifies the site's address in Google Search Console with the HTML meta tag method (DEC-0073).

    python3 scripts/seo/site_verify.py token    # prints the meta tag's content value, for the build
    python3 scripts/seo/site_verify.py verify   # after a deploy: verify, add to Search Console, share

Uses Google's Site Verification API as the Search Console service account (the GitHub secret
GSC_SERVICE_ACCOUNT_JSON, read from the environment only, never printed). The steps:
  token   asks Google for the META token for the URL-prefix property https://<site>/. The token
          is public by design: it ends up in the front page's <head> as google-site-verification.
          The deploy writes it into the build when the GSC_VERIFICATION variable is empty.
  verify  asks Google to check the live front page for the tag. When it passes, the service
          account owns the property; it adds the property to its Search Console list and adds
          every address in GSC_OWNER_EMAILS (a comma list, a repository variable) as an owner,
          so they see it in their own Search Console.
No DNS record is needed for a URL-prefix property. A Domain property (sc-domain:) needs a DNS
TXT record, which only the owner adds (see the SEO guide).

Both steps belong to the job "gsc_verify" in content/seo/automation.toml: switched off there
(or by the SEO_AUTOMATION variable) they do nothing, and each run logs one line saying what it
did (scripts/seo/automation.py). In token mode the log goes to stderr, so stdout holds only
the token.
It always exits 0 and prints one line saying what happened, so a deploy never fails on it.
Needs `pip install google-auth requests`.
"""
from __future__ import annotations

import contextlib
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
API = "https://www.googleapis.com/siteVerification/v1"
SCOPES = ["https://www.googleapis.com/auth/siteverification", "https://www.googleapis.com/auth/webmasters"]


def session():
    raw = os.environ.get("GSC_SERVICE_ACCOUNT_JSON", "").strip()
    if not raw:
        return None, "GSC_SERVICE_ACCOUNT_JSON is not set"
    try:
        from google.auth.transport.requests import AuthorizedSession
        from google.oauth2 import service_account
    except ImportError:
        return None, "pip install google-auth requests"
    try:
        creds = service_account.Credentials.from_service_account_info(json.loads(raw), scopes=SCOPES)
    except (ValueError, KeyError):
        return None, "GSC_SERVICE_ACCOUNT_JSON is not a valid service account key (value not shown)"
    return AuthorizedSession(creds), ""


def site() -> dict:
    return {"type": "SITE", "identifier": f"{SITE}/"}


def token(s) -> str:
    r = s.post(f"{API}/token", json={"site": site(), "verificationMethod": "META"}, timeout=30)
    if r.status_code == 403:
        raise RuntimeError("the Site Verification API is not enabled on the service account's Google Cloud project")
    r.raise_for_status()
    m = re.search(r'content="([^"]+)"', r.json().get("token", ""))
    if not m:
        raise RuntimeError("Google returned no META token")
    return m.group(1)


def verify(s) -> str:
    r = s.post(f"{API}/webResource", params={"verificationMethod": "META"}, json={"site": site()}, timeout=60)
    if not r.ok:
        return f"not verified yet (HTTP {r.status_code}); the tag may not be live on {SITE}/ yet"
    resource = r.json()
    owners = set(resource.get("owners", []))
    wanted = {e.strip() for e in os.environ.get("GSC_OWNER_EMAILS", "").split(",") if "@" in e}
    if wanted - owners:
        rid = urllib.parse.quote(resource["id"], safe="")
        u = s.put(f"{API}/webResource/{rid}", json={**resource, "owners": sorted(owners | wanted)}, timeout=30)
        shared = "shared with GSC_OWNER_EMAILS" if u.ok else f"sharing failed (HTTP {u.status_code})"
    else:
        shared = "no one new to share with"
    enc = urllib.parse.quote(f"{SITE}/", safe="")
    a = s.put(f"https://www.googleapis.com/webmasters/v3/sites/{enc}", timeout=30)
    listed = "added to Search Console" if a.status_code in (200, 204) else f"Search Console add HTTP {a.status_code}"
    return f"verified {SITE}/, {listed}, {shared}"


def note(mode: str, action: str, detail: str) -> None:
    """One log line for the job; to stderr in token mode, where stdout is the token."""
    with contextlib.redirect_stdout(sys.stderr if mode == "token" else sys.stdout):
        log("gsc_verify", action, f"{mode}: {detail}")


def main() -> int:
    mode = sys.argv[1] if len(sys.argv) > 1 else ""
    if mode not in ("token", "verify"):
        print(__doc__)
        return 0
    ok, why = enabled("gsc_verify")
    if not ok:
        note(mode, "skipped", why)
        return 0
    s, why = session()
    if s is None:
        note(mode, "skipped", why)
        return 0
    try:
        if mode == "token":
            value = token(s)
            note(mode, "token", "fetched the META token for the build")
            print(value)  # the public meta tag value, nothing secret
        else:
            result = verify(s)
            note(mode, "verified" if result.startswith("verified") else "not_verified", result)
    except Exception as err:  # noqa: BLE001  never fail a deploy on this
        note(mode, "error", f"{type(err).__name__}: {str(err)[:160]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
