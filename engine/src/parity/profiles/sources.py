"""Where the feedback collector looks, and the terms that let it look there.

Only official APIs and feeds whose terms allow automated reading are used, through
`net.Session`, which sends a user agent naming this project, pauses between requests
and obeys robots.txt. Nothing here logs in to a product, gets past a bot check or a
paywall, or reads review sites whose terms forbid it (G2, Trustpilot and Capterra web
pages are deliberately absent). A source that needs a key reads it by name from the
environment; `run.sh` fills the environment from the vault and never prints a value.

Fetching and parsing are separate: `fetch_*` touches the network and `parse_*` turns a
response body into items, which is what the tests exercise with saved fixtures.

Each item is a dict: id, product, source, kind, url, title, text, rating, published_at.
`kind` is 'feedback' (a review, post, comment, question or issue), 'release' or
'incident'. Only feedback is scored for praise and complaints.
"""

from __future__ import annotations

import hashlib
import os
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import UTC, datetime
from email.utils import parsedate_to_datetime

from .net import Blocked, Session
from .signals import clean


class Skipped(RuntimeError):
    """The source is off on this machine (no key, or its terms do not allow it)."""


@dataclass(frozen=True)
class Source:
    id: str
    name: str
    access: str          # how we read it
    terms_url: str
    terms: str           # the licence or terms note, as `parity data sources` shows it
    key_env: tuple[str, ...] = ()
    vault: tuple[str, ...] = ()
    off: str | None = None   # a fixed reason the source never runs


SOURCES: list[Source] = [
    Source("appstore-reviews", "Apple App Store customer reviews", "RSS feed, 50 newest per app",
           "https://www.apple.com/legal/internet-services/itunes/",
           "Apple's public RSS feed. itunes.apple.com/robots.txt disallows /*/rss/*, so the "
           "collector skips it while that rule stands and picks it up if Apple lifts it"),
    Source("appstore-ratings", "Apple App Store ratings", "iTunes Lookup API, one request a day",
           "https://performance-partners.apple.com/search-api",
           "Apple's public Search and Lookup API (about 20 calls a minute); average stars and "
           "rating count only, no review text"),
    Source("googleplay", "Google Play reviews", "none",
           "https://play.google.com/about/play-terms/",
           "Google offers no API for other developers' app reviews and its terms forbid "
           "scraping Play pages", off="no allowed route"),
    Source("reddit", "Reddit posts", "Reddit Data API with OAuth, app-only",
           "https://redditinc.com/policies/data-api-terms",
           "Reddit Data API terms: OAuth and a descriptive user agent required, free for "
           "non-commercial research at 100 queries a minute; the website itself disallows "
           "crawling, so only the API is used",
           key_env=("REDDIT_CLIENT_ID", "REDDIT_CLIENT_SECRET"),
           vault=("parity-reddit-client-id", "parity-reddit-client-secret")),
    Source("hn", "Hacker News stories and comments", "Algolia HN Search API",
           "https://hn.algolia.com/api",
           "Public API with no key, 10,000 requests an hour; Hacker News content belongs to "
           "its authors, so we keep short excerpts locally and publish counts only"),
    Source("stackexchange", "Stack Exchange questions and answers", "Stack Exchange API 2.3",
           "https://api.stackexchange.com/docs/throttle",
           "Official API, 300 requests a day without a key; content is CC BY-SA, and we "
           "publish counts only (sites: money, quant)"),
    Source("github-issues", "GitHub issues on official or open-source repos", "GitHub REST API",
           "https://docs.github.com/en/site-policy/github-terms/github-terms-of-service",
           "GitHub REST API, 60 requests an hour without a token; GITHUB_TOKEN is used when "
           "set. Pull requests are left out"),
    Source("github-releases", "GitHub releases of the same repos", "GitHub REST API",
           "https://docs.github.com/en/site-policy/github-terms/github-terms-of-service",
           "Release names and dates, to see how often each project ships"),
    Source("status", "Official status pages", "Statuspage history Atom feed",
           "https://support.atlassian.com/statuspage/docs/enable-rss-and-atom-feeds/",
           "Public incident feeds the products publish for subscribers; /api/ paths are "
           "disallowed by their robots.txt, so only /history.atom is read"),
    Source("changelog", "Product changelogs and release notes", "RSS or Atom feeds",
           "https://www.rssboard.org/rss-specification",
           "Feeds the products publish for readers, listed per product in "
           "docs/_system/competitors.json, each checked against robots.txt"),
]
BY_ID = {s.id: s for s in SOURCES}

SE_SITES = ("money", "quant")
APPSTORE_COUNTRY = "us"


def missing_keys(src: Source) -> list[str]:
    return [k for k in src.key_env if not os.environ.get(k)]


def status_of(src: Source) -> str:
    """'on', 'needs key' or 'off', for listing."""
    if src.off:
        return "off"
    if missing_keys(src):
        return "needs key"
    return "on"


def _id(*parts) -> str:
    return hashlib.sha1("|".join(str(p) for p in parts).encode()).hexdigest()[:20]


def _iso(ts: datetime | None) -> str | None:
    return None if ts is None else ts.astimezone(UTC).isoformat(timespec="seconds")


def _parse_date(raw: str | None) -> str | None:
    if not raw:
        return None
    try:
        return _iso(datetime.fromisoformat(raw.replace("Z", "+00:00")))
    except ValueError:
        try:
            return _iso(parsedate_to_datetime(raw))
        except (TypeError, ValueError):
            return None


def matches(text: str, queries: list[str]) -> bool:
    low = text.lower()
    return any(q.lower() in low for q in queries)


def _item(product: str, source: str, native: str, kind: str, url: str | None, title: str,
          text: str, published: str | None, rating: int | None = None) -> dict:
    return {"id": _id(source, native), "product": product, "source": source, "kind": kind,
            "url": url, "title": clean(title)[:300], "text": clean(text)[:1500],
            "rating": rating, "published_at": published}


# ------------------------------------------------------------------ parsers


def parse_appstore_reviews(doc: dict, product: str, app_id: int) -> list[dict]:
    out = []
    for e in doc.get("feed", {}).get("entry", []) or []:
        if "im:rating" not in e:
            continue  # the first entry of older feeds describes the app itself
        out.append(_item(product, "appstore-reviews", e["id"]["label"], "feedback",
                         f"https://apps.apple.com/app/id{app_id}", e["title"]["label"],
                         e["content"]["label"], _parse_date(e["updated"]["label"]),
                         int(e["im:rating"]["label"])))
    return out


def parse_appstore_lookup(doc: dict) -> dict[int, dict]:
    return {int(r["trackId"]): {"rating": r.get("averageUserRating"),
                                "count": r.get("userRatingCount"),
                                "version": r.get("version"), "name": r.get("trackName")}
            for r in doc.get("results", [])}


def parse_hn(doc: dict, product: str, queries: list[str]) -> list[dict]:
    out = []
    for h in doc.get("hits", []):
        title = h.get("title") or h.get("story_title") or ""
        text = h.get("comment_text") or h.get("story_text") or ""
        own = (h.get("title") or "") + " " + text  # the item's own words, not its thread's
        if not matches(own, queries):
            continue
        out.append(_item(product, "hn", h["objectID"], "feedback",
                         f"https://news.ycombinator.com/item?id={h['objectID']}", title,
                         text or (h.get("title") or ""), _parse_date(h.get("created_at"))))
    return out


def parse_stackexchange(doc: dict, product: str, queries: list[str], site: str) -> list[dict]:
    out = []
    for x in doc.get("items", []):
        text = x.get("body") or x.get("excerpt") or ""
        title = x.get("title") or ""
        if not matches(f"{title} {text}", queries):
            continue
        native = f"{site}:{x.get('item_type')}:{x.get('answer_id') or x.get('question_id')}"
        ts = x.get("creation_date")
        out.append(_item(product, "stackexchange", native, "feedback",
                         f"https://{site}.stackexchange.com/q/{x.get('question_id')}", title,
                         text, _iso(datetime.fromtimestamp(ts, UTC)) if ts else None))
    return out


def parse_github_issues(rows: list, product: str, repo: str) -> list[dict]:
    out = []
    for x in rows:
        if "pull_request" in x:
            continue
        labels = " ".join(lbl.get("name", "") for lbl in x.get("labels", []))
        out.append(_item(product, "github-issues", f"{repo}#{x['number']}", "feedback",
                         x.get("html_url"), x.get("title") or "",
                         f"{x.get('title') or ''}. {labels}. {(x.get('body') or '')[:1200]}",
                         _parse_date(x.get("created_at"))))
    return out


def parse_github_releases(rows: list, product: str, repo: str) -> list[dict]:
    return [_item(product, "github-releases", f"{repo}@{x.get('id')}", "release",
                  x.get("html_url"), x.get("name") or x.get("tag_name") or "",
                  (x.get("body") or "")[:600], _parse_date(x.get("published_at")))
            for x in rows if not x.get("draft")]


_ATOM = "{http://www.w3.org/2005/Atom}"


def parse_feed(body: bytes | str, product: str, source: str, kind: str) -> list[dict]:
    """RSS 2.0 or Atom entries as items."""
    root = ET.fromstring(body.strip() if isinstance(body, str) else body.strip())
    out = []
    for e in root.iter(f"{_ATOM}entry"):
        link = e.find(f"{_ATOM}link")
        native = (e.findtext(f"{_ATOM}id") or (link.get("href") if link is not None else "")
                  or e.findtext(f"{_ATOM}title") or "")
        out.append(_item(product, source, native, kind,
                         link.get("href") if link is not None else None,
                         e.findtext(f"{_ATOM}title") or "",
                         e.findtext(f"{_ATOM}content") or e.findtext(f"{_ATOM}summary") or "",
                         _parse_date(e.findtext(f"{_ATOM}published")
                                     or e.findtext(f"{_ATOM}updated"))))
    for e in root.iter("item"):
        native = e.findtext("guid") or e.findtext("link") or e.findtext("title") or ""
        out.append(_item(product, source, native, kind, e.findtext("link"),
                         e.findtext("title") or "", e.findtext("description") or "",
                         _parse_date(e.findtext("pubDate"))))
    return out


def parse_reddit(doc: dict, product: str, queries: list[str]) -> list[dict]:
    out = []
    for child in doc.get("data", {}).get("children", []):
        d = child.get("data", {})
        text = f"{d.get('title') or ''} {d.get('selftext') or ''}"
        if not matches(text, queries):
            continue
        ts = d.get("created_utc")
        out.append(_item(product, "reddit", d.get("name") or d.get("id"), "feedback",
                         f"https://www.reddit.com{d.get('permalink', '')}", d.get("title") or "",
                         d.get("selftext") or d.get("title") or "",
                         _iso(datetime.fromtimestamp(ts, UTC)) if ts else None))
    return out


# ------------------------------------------------------------------ fetchers
# Each takes the session, one product from the registry and a `since` mark (or None on
# the first pass), and returns (items, new mark). Marks keep later passes incremental.


def fetch_appstore_reviews(s: Session, p: dict, since: str | None) -> tuple[list, str | None]:
    out = []
    cc = p.get("appstore_country", APPSTORE_COUNTRY)
    for app in p.get("appstore", []):
        url = f"https://itunes.apple.com/{cc}/rss/customerreviews/page=1/id={app}/sortby=mostrecent/json"
        out += parse_appstore_reviews(s.get(url).json(), p["id"], app)
    return out, None


def fetch_hn(s: Session, p: dict, since: str | None) -> tuple[list, str | None]:
    after = int(since or 0)
    newest = after
    out = []
    for q in p["queries"]:
        pages = 1 if after else 3
        for page in range(pages):
            params = {"query": f'"{q}"', "tags": "(story,comment)", "hitsPerPage": 100,
                      "page": page}
            if after:
                params["numericFilters"] = f"created_at_i>{after}"
            doc = s.get("https://hn.algolia.com/api/v1/search_by_date", params=params).json()
            out += parse_hn(doc, p["id"], p["queries"])
            newest = max([newest] + [int(h.get("created_at_i", 0)) for h in doc["hits"]])
            if page + 1 >= doc.get("nbPages", 0):
                break
    return out, str(newest) if newest else since


def fetch_stackexchange(s: Session, p: dict, since: str | None) -> tuple[list, str | None]:
    after = int(since or 0)
    newest = after
    out = []
    for site in SE_SITES:
        for q in p["queries"][:2]:  # the daily quota is 300 requests across everything
            params = {"order": "desc", "sort": "creation", "q": f'"{q}"', "site": site,
                      "pagesize": 100, "filter": "default"}
            if after:
                params["fromdate"] = after + 1
            doc = s.get("https://api.stackexchange.com/2.3/search/excerpts",
                        params=params).json()
            out += parse_stackexchange(doc, p["id"], p["queries"], site)
            newest = max([newest] + [int(x.get("creation_date", 0)) for x in doc.get("items", [])])
            if doc.get("quota_remaining", 1) < 20:
                raise Blocked("Stack Exchange daily quota nearly used; the rest waits a day")
            if doc.get("backoff"):
                import time

                time.sleep(min(int(doc["backoff"]), 60))
    return out, str(newest) if newest else since


def _github_headers() -> dict:
    h = {"Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"}
    if os.environ.get("GITHUB_TOKEN"):
        h["Authorization"] = f"Bearer {os.environ['GITHUB_TOKEN']}"
    return h


def _github(s: Session, path: str, params: dict) -> list:
    r = s.get(f"https://api.github.com{path}", params=params, headers=_github_headers(),
              check_robots=False)  # api.github.com has no robots.txt; its API terms apply
    if int(r.headers.get("X-RateLimit-Remaining", "60")) < 5:
        raise Blocked("GitHub hourly limit nearly used; the rest waits for the next pass")
    return r.json()


def fetch_github_issues(s: Session, p: dict, since: str | None) -> tuple[list, str | None]:
    out = []
    for repo in p.get("github", []):
        params = {"state": "all", "sort": "created", "direction": "desc", "per_page": 100}
        if since:
            params["since"] = since
        out += parse_github_issues(_github(s, f"/repos/{repo}/issues", params), p["id"], repo)
    return out, datetime.now(UTC).isoformat(timespec="seconds")


def fetch_github_releases(s: Session, p: dict, since: str | None) -> tuple[list, str | None]:
    out = []
    for repo in p.get("github", []):
        out += parse_github_releases(_github(s, f"/repos/{repo}/releases", {"per_page": 30}),
                                     p["id"], repo)
    return out, None


def fetch_status(s: Session, p: dict, since: str | None) -> tuple[list, str | None]:
    if not p.get("status"):
        return [], None
    url = p["status"]  # a Statuspage site, or a full feed URL for other status services
    if not url.endswith((".atom", ".rss", ".xml")):
        url = url.rstrip("/") + "/history.atom"
    r = s.get(url)
    return parse_feed(r.content, p["id"], "status", "incident"), None


def fetch_changelog(s: Session, p: dict, since: str | None) -> tuple[list, str | None]:
    out = []
    for url in p.get("feeds", []):
        out += parse_feed(s.get(url).content, p["id"], "changelog", "release")
    return out, None


_reddit_token: dict = {}


def fetch_reddit(s: Session, p: dict, since: str | None) -> tuple[list, str | None]:
    import requests

    if "token" not in _reddit_token:
        agent = os.environ.get("REDDIT_USER_AGENT", s.http.headers["User-Agent"])
        r = requests.post("https://www.reddit.com/api/v1/access_token",
                          auth=(os.environ["REDDIT_CLIENT_ID"], os.environ["REDDIT_CLIENT_SECRET"]),
                          data={"grant_type": "client_credentials"},
                          headers={"User-Agent": agent}, timeout=30)
        r.raise_for_status()
        _reddit_token["token"] = r.json()["access_token"]
    out = []
    headers = {"Authorization": f"bearer {_reddit_token['token']}"}
    for q in p["queries"]:
        # The Data API terms, not the website's robots.txt, govern oauth.reddit.com.
        doc = s.get("https://oauth.reddit.com/search", params={"q": f'"{q}"', "sort": "new",
                    "limit": 100, "type": "link"}, headers=headers, check_robots=False).json()
        out += parse_reddit(doc, p["id"], p["queries"])
    return out, None


FETCHERS = {"appstore-reviews": fetch_appstore_reviews, "hn": fetch_hn,
            "stackexchange": fetch_stackexchange, "github-issues": fetch_github_issues,
            "github-releases": fetch_github_releases, "status": fetch_status,
            "changelog": fetch_changelog, "reddit": fetch_reddit}


def fetch_ratings(s: Session, products: list[dict]) -> dict[int, dict]:
    """Average stars and rating counts for every app, one Lookup request per store."""
    by_cc: dict[str, list[int]] = {}
    for p in products:
        cc = p.get("appstore_country", APPSTORE_COUNTRY)
        by_cc.setdefault(cc, []).extend(p.get("appstore", []))
    out: dict[int, dict] = {}
    for cc, ids in by_cc.items():
        if ids:
            r = s.get("https://itunes.apple.com/lookup",
                      params={"id": ",".join(map(str, ids)), "country": cc})
            out.update(parse_appstore_lookup(r.json()))
    return out
