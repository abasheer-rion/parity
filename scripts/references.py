#!/usr/bin/env python3
"""Builds docs/_system/references.json: one record for every source the project relies on.

    python3 scripts/references.py [--offline] [--refresh]

Sources are collected from:

  * catalog/algorithms/*.json  (origin, reported_results, implementations, any other URL)
  * catalog/datasets/*.json    (url, api_docs_url, sources, any other URL)
  * catalog/events/*.json      (sources[].url, cited by the source title and publisher)
  * every http(s) link in docs/**/*.md
  * the papers and books listed in docs/research/0001-reading-list.md
  * [@key] citations in docs (adds the citing page to that key's used_in)

Papers are enriched from Crossref (by DOI, or by a strict title search when no DOI is
known) and from the arXiv API. Records that share a DOI, an arXiv id or a normalised URL
are merged. Keys and first-seen dates from the previous file are kept, so reruns are
stable. Metadata already fetched is reused unless --refresh is given; --offline skips the
network entirely. Verification status comes from catalog/verification/sources.json when
that file exists.

Standard library only. docs.py imports the URL helpers from here, so importing this module
must not touch the network.
"""

from __future__ import annotations

import argparse
import datetime as dt
import difflib
import hashlib
import html
import json
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
CATALOG = ROOT / "catalog"
OUT = DOCS / "_system" / "references.json"
VERIFICATION = CATALOG / "verification" / "sources.json"
READING_LIST = DOCS / "research" / "0001-reading-list.md"
GENERATED_PAGE = DOCS / "REFERENCES.md"
MAILTO = "parity-research@example.invalid"
USER_AGENT = f"parity-references/1.0 (mailto:{MAILTO})"

TYPES = ["paper", "preprint", "book", "dataset", "software", "web-page", "forum-post",
         "regulator", "news"]
KEY_RE = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
CITE_RE = re.compile(r"\[@([a-z0-9-]+(?:\s*;\s*@[a-z0-9-]+)*)\]")

# A URL may contain one level of balanced parentheses, as some DOIs do.
URL_RE = re.compile(r"https?://[^\s<>()\[\]\"'`|]+(?:\([^\s()<>]*\)[^\s<>()\[\]\"'`|]*)*")
IGNORED_HOSTS = {"localhost", "127.0.0.1", "0.0.0.0", "example.com", "example.org",
                 "example.invalid"}

STYLE_FIXES = {"\u2014": "-", "\u2013": "-", "\u2012": "-", "\u2010": "-", "\u2011": "-",
               "\u2018": "'", "\u2019": "'", "\u201a": "'", "\u201c": '"', "\u201d": '"',
               "\u201e": '"', "\u2026": "...", "\u00a0": " ", "\u2009": " ", "\u202f": " ",
               "\u2212": "-"}


# ---------------------------------------------------------------- URL helpers (shared)


def clean_url(u: str) -> str:
    """Trim punctuation that ends a sentence rather than the URL."""
    while u and u[-1] in ".,;:!?*_'\"":
        u = u[:-1]
    while u.endswith(")") and u.count("(") < u.count(")"):
        u = u[:-1]
    return u


def extract_urls(text: str) -> list[str]:
    out = []
    for m in URL_RE.finditer(text):
        u = clean_url(m.group(0))
        if u and not ignored(u):
            out.append(u)
    return out


def ignored(u: str) -> bool:
    """Local addresses and this project's own repository are not outside sources."""
    host = urllib.parse.urlsplit(u).hostname or ""
    return host in IGNORED_HOSTS or host.endswith(".invalid") or host.endswith(".local") or \
        bool(re.search(r"github\.com/[^/]+/parity(\.git)?(/|$)", u))


def normalise_url(u: str) -> str:
    """Same page, same string: https, no www, no default port, no trailing slash,
    no fragment, no tracking parameters, DOIs in lower case."""
    p = urllib.parse.urlsplit(u.strip())
    host = (p.hostname or "").lower()
    if host.startswith("www."):
        host = host[4:]
    path = urllib.parse.unquote(p.path).rstrip("/")
    query = "&".join(sorted(q for q in p.query.split("&")
                            if q and not q.lower().startswith(("utm_", "fbclid", "gclid"))))
    if host in ("doi.org", "dx.doi.org"):
        return "doi.org" + path.lower()
    return host + path + (f"?{query}" if query else "")


def ids_from_url(u: str) -> dict:
    """DOI or arXiv id a URL points at. 'explicit' means the URL is the DOI itself."""
    p = urllib.parse.urlsplit(u)
    host = (p.hostname or "").lower().removeprefix("www.")
    path = urllib.parse.unquote(p.path)
    out: dict = {}
    if host in ("doi.org", "dx.doi.org") and path.startswith("/10."):
        out["doi"], out["doi_explicit"] = path[1:].rstrip("/").lower(), True
    elif m := re.match(r"^/doi/(?:abs/|full/|pdf/|epdf/)?(10\.\d{4,}/[^?#]+)", path):
        out["doi"], out["doi_explicit"] = m.group(1).rstrip("/").lower(), True
    elif host.endswith("arxiv.org") and (m := re.match(r"^/(?:abs|pdf|html)/(\d{4}\.\d{4,5})", path)):
        out["arxiv"] = m.group(1)
    elif host.endswith("nber.org") and (m := re.search(r"/w(\d{3,6})(?:\.|/|$)", path)):
        out["doi"], out["doi_explicit"] = f"10.3386/w{m.group(1)}", False
    elif "ssrn.com" in host:
        m = re.search(r"abstract(?:_id)?=(\d+)", u) or re.search(r"abstract=(\d+)", path)
        if m:
            out["doi"], out["doi_explicit"] = f"10.2139/ssrn.{m.group(1)}", False
    if "doi" not in out and (m := re.search(r"SSRN-id(\d+)\.pdf", u)):
        out["doi"], out["doi_explicit"] = f"10.2139/ssrn.{m.group(1)}", False
    return out


def plain(text) -> str | None:
    """Strip markup and fix characters the docs style rules do not allow."""
    if text is None:
        return None
    s = html.unescape(re.sub(r"<[^>]+>", "", str(text)))
    for bad, good in STYLE_FIXES.items():
        s = s.replace(bad, good)
    s = re.sub(r"\s+", " ", s).strip()
    return s or None


# ---------------------------------------------------------------- classification

SOFTWARE_HOSTS = ("github.com", "gitlab.com", "raw.githubusercontent.com", "pypi.org",
                  "bitbucket.org", "huggingface.co", "cran.r-project.org")
FORUM_HOSTS = ("reddit.com", "news.ycombinator.com", "elitetrader.com", "stackexchange.com",
               "stackoverflow.com", "forexfactory.com", "babypips.com", "trustpilot.com",
               "tradingview.com/script", "forum.", "community.", "quant.stackexchange.com")
REGULATOR_HOSTS = ("cftc.gov", "sec.gov", "ftc.gov", "fca.org.uk", "finra.org", "nfa.futures.org",
                   "esma.europa.eu", "asic.gov.au", "consumerfinance.gov", "federalregister.gov",
                   "ecfr.gov", "bafin.de", "amf-france.org", "cysec.gov.cy")
NEWS_HOSTS = ("reuters.com", "bloomberg.com", "ft.com", "wsj.com", "cnbc.com", "coindesk.com",
              "theguardian.com", "nytimes.com", "forbes.com", "businessinsider.com",
              "marketwatch.com", "bbc.co.uk", "bbc.com", "economist.com", "cointelegraph.com",
              "theblock.co", "decrypt.co", "techcrunch.com", "axios.com", "fortune.com")
PAPER_HOSTS = ("ideas.repec.org", "econpapers.repec.org", "openaccess.city.ac.uk",
               "onlinelibrary.wiley.com", "academic.oup.com", "sciencedirect.com", "jstor.org",
               "tandfonline.com", "link.springer.com", "researchonline.lse.ac.uk", "ijcb.org",
               "journals.uchicago.edu", "pubsonline.informs.org", "cambridge.org/core",
               "aeaweb.org", "nowpublishers.com", "mdpi.com", "econstor.eu", "eprints.",
               "repository.", "dspace.")
PREPRINT_HOSTS = ("arxiv.org", "ssrn.com", "nber.org", "cepr.org", "researchgate.net")


def host_of(u: str) -> str:
    return (urllib.parse.urlsplit(u).hostname or "").lower().removeprefix("www.")


def _host_match(u: str, hosts) -> bool:
    h, full = host_of(u), normalise_url(u)
    return any(h == x or h.endswith("." + x) or full.startswith(x) or
               (x.endswith(".") and h.startswith(x)) for x in hosts)


def classify(url: str | None, hint: str | None, scholarly: bool) -> str:
    if hint in TYPES:
        return hint
    if not url:
        return "paper" if scholarly else "web-page"
    ids = ids_from_url(url)
    if ids.get("arxiv") or (ids.get("doi") or "").startswith(("10.2139/", "10.3386/", "10.48550/")):
        return "preprint"
    if ids.get("doi"):
        return "paper"
    if _host_match(url, SOFTWARE_HOSTS):
        return "software"
    if _host_match(url, FORUM_HOSTS):
        return "forum-post"
    if _host_match(url, REGULATOR_HOSTS):
        return "regulator"
    if _host_match(url, NEWS_HOSTS):
        return "news"
    if _host_match(url, PREPRINT_HOSTS):
        return "preprint"
    if _host_match(url, PAPER_HOSTS):
        return "paper"
    path = urllib.parse.urlsplit(url).path.lower()
    if re.search(r"\.(csv|zip|xlsx?|parquet|json|txt)$", path) or "kaggle.com/datasets" in url:
        return "dataset"
    if scholarly and not re.search(r"blog|medium\.com|substack|wordpress", url):
        return "paper"
    return "web-page"


# ---------------------------------------------------------------- authors


def split_authors(s: str | None) -> list[str]:
    """'Menkhoff, Sarno, Schmeling and Schrimpf' -> four names. 'X et al.' keeps 'et al.'."""
    if not s:
        return []
    s = plain(s) or ""
    etal = bool(re.search(r"\bet al\.?", s))
    s = re.sub(r",?\s*\bet al\.?", "", s)
    parts = [p.strip() for p in re.split(r",\s*|\s+and\s+|\s*&\s*", s) if p.strip()]
    return parts + (["et al."] if etal else [])


def surname(name: str) -> str:
    """Fetched names are stored 'Family, Given'; names typed in the repo are surnames."""
    name = name.strip().split(",")[0]
    ascii_ = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z]", "", ascii_.lower())


def norm_title(t: str | None) -> str:
    t = unicodedata.normalize("NFKD", plain(t) or "").encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", " ", t).strip()


# ---------------------------------------------------------------- collection

PRIORITY = {"reading-list": 0, "catalog-origin": 1, "dataset": 1, "implementation": 1,
            "reported-result": 2, "event": 2, "link": 3, "url": 4}


class Mention(dict):
    """One place in the repo that points at a source, with whatever it says about it."""


def mention(url, path, source, **hints) -> Mention:
    m = Mention(url=url, path=path, source=source, also_at=[])
    m.update({k: v for k, v in hints.items() if v not in (None, "", [])})
    return m


def rel(p: Path) -> str:
    return p.relative_to(ROOT).as_posix()


def strip_trailing_period(s: str | None) -> str | None:
    s = plain(s)
    return s.rstrip(".").strip() if s else s


def parse_reading_list() -> list[Mention]:
    if not READING_LIST.exists():
        return []
    path, out = rel(READING_LIST), []
    section = ""
    for line in READING_LIST.read_text(encoding="utf-8").splitlines():
        if line.startswith("## "):
            section = line[3:].strip()
        # "**Authors (2017). "Title." Venue.** url (open copy: url)"
        m = re.search(r"\*\*(?P<a>[^*]+?) \((?P<y>\d{4})[a-z]?\)\.\s+\"(?P<t>[^\"]+)\"\s*"
                      r"(?P<v>[^*]*)\*\*(?P<rest>.*)$", line)
        if m:
            urls = extract_urls(m.group("rest"))
            out.append(mention(urls[0] if urls else None, path, "reading-list",
                               authors=split_authors(m.group("a")), year=int(m.group("y")),
                               title=strip_trailing_period(m.group("t")),
                               venue=strip_trailing_period(m.group("v")),
                               also_at=urls[1:], scholarly=True))
            continue
        if not line.startswith("|") or line.startswith("|---") or line.startswith("| ---"):
            continue
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        first = cells[0]
        # Foundations table: Authors (1984), "Title", *Venue*. [doi:..](url)
        m = re.match(r"^(?P<a>.+?) \((?P<y>\d{4})\),\s+\"(?P<t>[^\"]+?)\",?\s+\*(?P<v>[^*]+)\*",
                     first)
        if m:
            urls = extract_urls(first)
            doi = re.search(r"doi:(10\.[^\]\s]+)", first)
            out.append(mention(urls[0] if urls else None, path, "reading-list",
                               authors=split_authors(m.group("a")), year=int(m.group("y")),
                               title=strip_trailing_period(m.group("t")),
                               venue=strip_trailing_period(m.group("v")),
                               doi=doi.group(1).lower() if doi else None,
                               also_at=urls[1:], scholarly=True))
            continue
        if section.startswith("Books") and len(cells) >= 4 and first not in ("Item",):
            urls = extract_urls(cells[-1])
            bm = re.match(r"^(?P<a>[^,*]+), \*(?P<t>[^*]+)\*(?P<rest>.*)$", first)
            if bm:
                rest = bm.group("rest")
                yr = re.search(r"(\d{4})\)", rest)
                pub = re.search(r"\(([^()]*?),\s*\d{4}\)", rest)
                ed = re.search(r"(\d+(?:st|nd|rd|th) ed\.)", rest)
                title = plain(bm.group("t")) + (f", {ed.group(1)}" if ed else "")
                url = urls[0] if urls else None
                # a book is a book even if the link is a code repository for it
                kind = "book" if pub else None
                out.append(mention(url, path, "reading-list", authors=split_authors(bm.group("a")),
                                   year=int(yr.group(1)) if yr else None, title=title,
                                   venue=plain(pub.group(1)) if pub else None, type=kind,
                                   note=plain(cells[1]) if len(cells) > 1 else None,
                                   scholarly=kind == "book"))
                for u in urls[1:]:
                    out.append(mention(u, path, "reading-list"))
            else:
                title = plain(re.sub(r"\*", "", first))
                for i, u in enumerate(urls):
                    out.append(mention(u, path, "reading-list", title=title if i == 0 else None,
                                       note=plain(cells[1]) if i == 0 else None))
    return out


def walk_strings(obj, prefix=""):
    if isinstance(obj, dict):
        for k, v in obj.items():
            yield from walk_strings(v, f"{prefix}.{k}" if prefix else k)
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            yield from walk_strings(v, f"{prefix}[{i}]")
    elif isinstance(obj, str):
        yield prefix, obj


def split_source_title(t: str | None) -> tuple[str | None, str | None]:
    """'Carry (NBER WP 19325; JFE 2018)' -> ('Carry', 'NBER WP 19325; JFE 2018')."""
    t = plain(t)
    if not t:
        return None, None
    m = re.match(r"^(.*?)\s*\(([^()]*(?:\([^()]*\)[^()]*)*)\)$", t)
    return (m.group(1).strip(), m.group(2).strip()) if m and m.group(1).strip() else (t, None)


def parse_label(label: str | None) -> dict:
    """'Menkhoff, Sarno, Schmeling, Schrimpf (2012), Journal of Finance, Table I'."""
    label = plain(label)
    if not label:
        return {}
    m = re.match(r"^(?P<a>[A-Z][^()]{1,120}?) \((?P<y>\d{4})[a-z]?\)[,.:]?\s*(?P<rest>.*)$", label)
    if not m:
        return {"cited_as": label}
    rest = re.split(r"(?:^|,\s*)(?:Tables?|Figures?|Fig\.|Exhibit|p\.|pp\.|Sections?|abstract)\b",
                    m.group("rest"))[0]
    rest = rest.strip(" ,.")
    venue_like = r"Journal|Review|Econom|Financ|Studies|Letters|Quarterly|Notices|Annals|PLOS|" \
                 r"Management|Science|\bWP\b|[Ww]orking [Pp]aper|NBER|SSRN|arXiv|Bank|Univers|" \
                 r"Discussion|Proceedings|Research"
    return {"authors": split_authors(m.group("a")), "year": int(m.group("y")),
            "venue_hint": rest if re.search(venue_like, rest) else None, "cited_as": label}


def collect_catalog() -> list[Mention]:
    out: list[Mention] = []
    for p in sorted((CATALOG / "algorithms").glob("*.json")):
        e, path = json.loads(p.read_text()), rel(p)
        seen = set()
        o = e.get("origin", {})
        if o.get("source_url") and not ignored(o["source_url"]):
            title, venue = split_source_title(o.get("source_title"))
            if title and re.match(r"^no (dated )?primary source", title, re.I):
                title, venue = venue, None
            academic = o.get("type") == "academic"
            cited_as = None
            if title and ";" in title:  # several works in one line: keep it as a note
                cited_as, title, venue = plain(o.get("source_title")), None, None
            out.append(mention(o["source_url"], path, "catalog-origin", cited_as=cited_as,
                               authors=split_authors((o.get("authors") or "").split(";")[0])
                               if academic else None,
                               year=o.get("first_published") if academic else None,
                               title=title, venue_hint=venue, scholarly=academic,
                               origin_type=o.get("type")))
            seen.add(o["source_url"])
        for r in e.get("reported_results", []):
            u = r.get("source_url")
            if u and re.match(r"^https?://", u) and not ignored(u):
                lab = parse_label(r.get("source"))
                out.append(mention(u, path, "reported-result", scholarly="authors" in lab, **lab))
                seen.add(u)
        for impl in e.get("implementations", []):
            u = impl.get("url")
            if u and re.match(r"^https?://", u) and not ignored(u):
                out.append(mention(u, path, "implementation", type=None,
                                   language=impl.get("language"), license=impl.get("license")))
                seen.add(u)
        for _k, s in walk_strings(e):
            for u in extract_urls(s):
                if u not in seen:
                    out.append(mention(u, path, "url"))
                    seen.add(u)
    for p in sorted((CATALOG / "datasets").glob("*.json")):
        e, path = json.loads(p.read_text()), rel(p)
        seen = set()
        if e.get("url"):
            out.append(mention(e["url"], path, "dataset", type="dataset", title=plain(e.get("name")),
                               venue=plain(e.get("provider"))))
            seen.add(e["url"])
        if e.get("api_docs_url") and e["api_docs_url"] not in seen:
            out.append(mention(e["api_docs_url"], path, "dataset", type="web-page",
                               title=f"{plain(e.get('name'))}: API documentation",
                               venue=plain(e.get("provider"))))
            seen.add(e["api_docs_url"])
        for u in e.get("sources", []):
            if u not in seen and re.match(r"^https?://", u):
                out.append(mention(u, path, "url", venue=plain(e.get("provider"))))
                seen.add(u)
        for _k, s in walk_strings(e):
            for u in extract_urls(s):
                if u not in seen:
                    out.append(mention(u, path, "url", venue=plain(e.get("provider"))))
                    seen.add(u)
    for p in sorted((CATALOG / "events").glob("*.json")):
        e, path = json.loads(p.read_text()), rel(p)
        seen = set()
        for src in e.get("sources", []):
            u = src.get("url")
            if u and u not in seen and re.match(r"^https?://", u) and not ignored(u):
                out.append(mention(u, path, "event", cited_as=plain(src.get("title")),
                                   venue=plain(src.get("publisher"))))
                seen.add(u)
        for _k, s in walk_strings(e):
            for u in extract_urls(s):
                if u not in seen:
                    out.append(mention(u, path, "url"))
                    seen.add(u)
    return out


MD_LINK_RE = re.compile(r"\[([^\]]+)\]\((https?://[^)\s]+(?:\([^)\s]*\)[^)\s]*)?)\)")


def doc_files() -> list[Path]:
    return sorted(p for p in DOCS.rglob("*.md")
                  if p != GENERATED_PAGE and "_system" not in p.parts)


def collect_docs() -> tuple[list[Mention], dict[str, set[str]]]:
    out: list[Mention] = []
    cites: dict[str, set[str]] = {}
    for p in doc_files():
        text, path = p.read_text(encoding="utf-8"), rel(p)
        labels = {}
        for lab, u in MD_LINK_RE.findall(text):
            lab = plain(lab.strip("*_` "))
            if lab and not re.match(r"^(https?:|doi:|www\.)", lab) and len(lab.split()) >= 2:
                labels.setdefault(clean_url(u), lab)
        for u in dict.fromkeys(extract_urls(text)):
            out.append(mention(u, path, "link" if u in labels else "url", label=labels.get(u)))
        for m in CITE_RE.finditer(text):
            for k in re.findall(r"@([a-z0-9-]+)", m.group(0)):
                cites.setdefault(k, set()).add(path)
    return out, cites


# ---------------------------------------------------------------- merging


class DSU:
    def __init__(self):
        self.parent: dict = {}

    def find(self, x):
        self.parent.setdefault(x, x)
        while self.parent[x] != x:
            self.parent[x] = self.parent[self.parent[x]]
            x = self.parent[x]
        return x

    def union(self, a, b):
        self.parent[self.find(a)] = self.find(b)


def mention_ids(m: Mention) -> list[str]:
    ids = []
    for u in [m.get("url")] + list(m.get("also_at", [])):
        if not u:
            continue
        ids.append("url:" + normalise_url(u))
    if m.get("url"):
        x = ids_from_url(m["url"])
        if x.get("doi"):
            ids.append("doi:" + x["doi"])
        if x.get("arxiv"):
            ids.append("arxiv:" + x["arxiv"])
    if m.get("doi"):
        ids.append("doi:" + m["doi"])
    if not ids:  # a book with no link: identify it by author, year and title
        ids.append("work:" + "|".join([surname((m.get("authors") or ["x"])[0]),
                                        str(m.get("year")), norm_title(m.get("title"))]))
    return ids


def group(mentions: list[Mention]) -> list[list[Mention]]:
    dsu = DSU()
    for i, m in enumerate(mentions):
        dsu.find(("m", i))
        for x in mention_ids(m):
            dsu.union(("m", i), x)
    groups: dict = {}
    for i, m in enumerate(mentions):
        groups.setdefault(dsu.find(("m", i)), []).append(m)
    return list(groups.values())


def build_record(ms: list[Mention]) -> dict:
    ms = sorted(ms, key=lambda m: PRIORITY.get(m["source"], 9))

    def first(k):
        return next((m[k] for m in ms if m.get(k) not in (None, "", [])), None)

    url = first("url")
    urls = []
    for m in ms:
        for u in [m.get("url")] + list(m.get("also_at", [])):
            if u and normalise_url(u) not in {normalise_url(x) for x in urls}:
                urls.append(u)
    doi = explicit = None
    for m in ms:
        if m.get("doi"):
            doi, explicit = m["doi"], True
            break
    if not doi:
        for u in urls:
            x = ids_from_url(u)
            if x.get("doi") and x.get("doi_explicit"):
                doi, explicit = x["doi"], True
                break
    if not doi and url:
        x = ids_from_url(url)
        if x.get("doi"):
            doi, explicit = x["doi"], False
    arxiv = next((ids_from_url(u).get("arxiv") for u in urls if ids_from_url(u).get("arxiv")), None)
    scholarly = any(m.get("scholarly") for m in ms) or bool(doi or arxiv)
    title = first("title")
    venue = first("venue")
    rtype = classify(url, first("type"), scholarly)
    working = r"working paper|\bWP\b|NBER|SSRN|arXiv|discussion paper|preprint|\bw\d{4}"
    if rtype == "preprint" and any(m["source"] == "reading-list" and m.get("venue") for m in ms) \
            and venue and not re.search(working, venue, re.I):
        rtype = "paper"  # the reading list cites the journal version
    rec = {
        "key": None,
        "type": rtype,
        "authors": first("authors") or [],
        "year": first("year"),
        "title": title,
        "venue": venue,
        "doi": doi,
        "arxiv": arxiv,
        "url": url,
        "also_at": [u for u in urls if u != url],
        "accessed": None,
        "verification": "not checked",
        "used_in": sorted({m["path"] for m in ms}),
        "metadata": {"source": "repo", "doi_explicit": bool(explicit)},
        "_label": first("label"),
        "_cited_as": first("cited_as"),
        "_authors_from": next((m["source"] for m in ms if m.get("authors")), None),
        "_venue_hint": first("venue_hint"),
    }
    if first("note"):
        rec["note"] = first("note")
    if first("license") or first("language"):
        rec["software"] = {k: first(k) for k in ("language", "license") if first(k)}
    if rec["type"] == "software" and not rec["title"] and url:
        parts = urllib.parse.urlsplit(url).path.strip("/").split("/")
        if host_of(url) == "github.com" and len(parts) >= 2:
            rec["title"] = "/".join(parts[:2]) + ("/" + "/".join(parts[2:]) if len(parts) > 2
                                                  else "")
            rec["venue"] = rec["venue"] or "GitHub"
    return rec


# ---------------------------------------------------------------- network


class Fetcher:
    def __init__(self, offline: bool):
        self.offline = offline
        self.last = 0.0
        self.calls = 0

    def get(self, url: str) -> bytes | None:
        if self.offline:
            return None
        wait = 1.05 - (time.time() - self.last)
        if wait > 0:
            time.sleep(wait)
        self.last = time.time()
        self.calls += 1
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        for attempt in range(3):
            try:
                with urllib.request.urlopen(req, timeout=30) as r:
                    return r.read()
            except urllib.error.HTTPError as e:
                if e.code == 404:
                    return b""
                if e.code in (429, 500, 502, 503, 504) and attempt < 2:
                    time.sleep(3 * (attempt + 1))
                    continue
                return None
            except (urllib.error.URLError, TimeoutError, OSError):
                if attempt < 2:
                    time.sleep(3 * (attempt + 1))
                    continue
                return None
        return None


def crossref_work(f: Fetcher, doi: str) -> dict | None | bool:
    """The Crossref record, False if Crossref does not know the DOI, None on failure."""
    url = (f"https://api.crossref.org/works/{urllib.parse.quote(doi, safe='/')}"
           f"?mailto={MAILTO}")
    raw = f.get(url)
    if raw is None:
        return None
    if raw == b"":
        return False
    try:
        return json.loads(raw)["message"]
    except (ValueError, KeyError):
        return None


def crossref_search(f: Fetcher, title: str, author: str | None) -> list[dict]:
    q = {"query.bibliographic": title, "rows": "5", "mailto": MAILTO}
    if author:
        q["query.author"] = author
    raw = f.get("https://api.crossref.org/works?" + urllib.parse.urlencode(q))
    if not raw:
        return []
    try:
        return json.loads(raw)["message"]["items"]
    except (ValueError, KeyError):
        return []


def arxiv_batch(f: Fetcher, ids: list[str]) -> dict[str, dict]:
    out = {}
    ns = {"a": "http://www.w3.org/2005/Atom", "x": "http://arxiv.org/schemas/atom"}
    for i in range(0, len(ids), 50):
        chunk = ids[i:i + 50]
        raw = f.get("http://export.arxiv.org/api/query?" + urllib.parse.urlencode(
            {"id_list": ",".join(chunk), "max_results": str(len(chunk))}))
        if not raw:
            continue
        try:
            root = ET.fromstring(raw)
        except ET.ParseError:
            continue
        for entry in root.findall("a:entry", ns):
            eid = entry.findtext("a:id", default="", namespaces=ns)
            m = re.search(r"(\d{4}\.\d{4,5})", eid)
            if not m or entry.findtext("a:title", namespaces=ns) in (None, "Error"):
                continue
            out[m.group(1)] = {
                "title": plain(entry.findtext("a:title", namespaces=ns)),
                "authors": [family_first(plain(a.findtext("a:name", namespaces=ns)))
                            for a in entry.findall("a:author", ns)],
                "year": int(entry.findtext("a:published", default="0", namespaces=ns)[:4] or 0)
                or None,
                "doi": (entry.findtext("x:doi", namespaces=ns) or "").lower() or None,
                "journal_ref": plain(entry.findtext("x:journal_ref", namespaces=ns)),
            }
    return out


def tidy_name(name: str | None) -> str | None:
    """Crossref sometimes stores names in capitals: 'ASNESS, CLIFFORD S.' -> 'Asness, Clifford S.'"""
    if not name:
        return name
    letters = [c for c in name if c.isalpha()]
    if letters and all(c.isupper() for c in letters) and len(letters) > 3:
        name = re.sub(r"[^\W\d_]+", lambda m: m.group(0)[0] + m.group(0)[1:].lower()
                      if len(m.group(0)) > 1 else m.group(0), name)
        name = re.sub(r"\bMc([a-z])", lambda m: "Mc" + m.group(1).upper(), name)
    return name


def venue_match(hint: str | None, container: str | None) -> bool:
    h, c = norm_title(hint), re.sub(r"^the ", "", norm_title(container))
    return bool(h and c) and (c in h or re.sub(r"^the ", "", h) in c)


def family_first(name: str | None) -> str | None:
    """'Lukas Menkhoff' -> 'Menkhoff, Lukas', keeping particles like 'de' with the family name."""
    if not name or "," in name:
        return name
    parts = name.split()
    i = len(parts) - 1
    while i > 1 and parts[i - 1].lower() in ("de", "da", "di", "del", "della", "van", "von",
                                             "der", "du", "le", "la", "dos", "ter"):
        i -= 1
    return " ".join(parts[i:]) + (", " + " ".join(parts[:i]) if i else "")


def crossref_fields(msg: dict) -> dict:
    authors = []
    for a in msg.get("author", []) or []:
        name = ", ".join(x for x in (a.get("family"), a.get("given")) if x) or a.get("name")
        if name:
            authors.append(tidy_name(plain(name)))
    if not authors:
        authors = [plain(a.get("name")) for a in msg.get("editor", []) or [] if a.get("name")]
    year = None
    for k in ("issued", "published-print", "published-online", "created"):
        parts = (msg.get(k) or {}).get("date-parts") or [[None]]
        if parts and parts[0] and parts[0][0]:
            year = int(parts[0][0])
            break
    title = plain((msg.get("title") or [None])[0])
    sub = plain((msg.get("subtitle") or [None])[0])
    if title and sub and sub.lower() not in title.lower():
        title = f"{title}: {sub}"
    ctype = msg.get("type", "")
    container = plain((msg.get("container-title") or [None])[0])
    publisher = plain(msg.get("publisher"))
    venue = container
    if venue:
        if msg.get("volume"):
            venue += f" {msg['volume']}"
            if msg.get("issue"):
                venue += f"({msg['issue']})"
        if msg.get("page"):
            venue += f", {plain(msg['page'])}"
    elif (msg.get("DOI") or "").lower().startswith("10.3386/w"):
        venue = "NBER Working Paper " + msg["DOI"].split("/", 1)[1]
    elif ctype == "posted-content":
        venue = plain(msg.get("group-title")) or publisher
        venue = f"{venue} working paper" if venue == "SSRN" else venue
    elif ctype in ("report", "report-component", "working-paper"):
        inst = plain(((msg.get("institution") or [{}])[0]).get("name")) or publisher
        num = msg.get("number") or ""
        venue = " ".join(x for x in (inst, "working paper" if ctype != "posted-content" else
                                     plain(msg.get("group-title")), num) if x) or publisher
    else:
        venue = publisher
    kind = {"journal-article": "paper", "proceedings-article": "paper", "book-chapter": "paper",
            "posted-content": "preprint", "report": "preprint", "working-paper": "preprint",
            "book": "book", "monograph": "book", "edited-book": "book", "reference-book": "book",
            "dataset": "dataset"}.get(ctype)
    if container and "ssrn" in container.lower():
        kind = "preprint"
    return {"authors": authors, "year": year, "title": title, "venue": venue, "type": kind,
            "doi": (msg.get("DOI") or "").lower() or None}


def title_match(a: str | None, b: str | None) -> bool:
    na, nb = norm_title(a), norm_title(b)
    if not na or not nb:
        return False
    if na == nb:
        return True
    short, long_ = sorted((na, nb), key=len)
    if len(short) >= 25 and long_.startswith(short):  # title vs title plus subtitle
        return True
    return difflib.SequenceMatcher(None, na, nb).ratio() >= 0.93


def apply_metadata(rec: dict, md: dict, mode: str, source: str):
    """Fill the record from fetched metadata.

    mode 'all': the DOI or arXiv id is the source itself, so the fetched record wins.
    mode 'work': the DOI was worked out from a working paper URL (NBER, SSRN). Names and title
    are the same work, but the repo may cite the journal year and venue, so those only fill gaps.
    """
    replace = {"all": ("authors", "year", "title", "venue", "type"),
               "work": ("authors", "title")}[mode]
    for k in ("authors", "year", "title", "venue", "type"):
        v = md.get(k)
        if v in (None, "", []):
            continue
        if k == "type" and rec["type"] == "book" and v == "paper":
            continue
        empty = rec.get(k) in (None, "", []) or (k == "type" and rec[k] == "web-page")
        if k in replace or empty or \
                (k == "authors" and "et al." in rec.get("authors", []) and len(v) > 1):
            rec[k] = v
    rec["metadata"]["source"] = source


def enrich(records: list[dict], old_by_key: dict, f: Fetcher, refresh: bool) -> None:
    # 1. arXiv
    want = sorted({r["arxiv"] for r in records if r.get("arxiv")})
    cached = {}
    for r in records:
        o = old_by_key.get(r.get("_old"))
        if not refresh and o and o.get("arxiv") == r.get("arxiv") and \
                o.get("metadata", {}).get("source") in ("arxiv", "crossref"):
            cached[r["arxiv"]] = o
    fetched = arxiv_batch(f, [a for a in want if a not in cached])
    for r in records:
        a = r.get("arxiv")
        if not a:
            continue
        if a in fetched:
            md = fetched[a]
            apply_metadata(r, {**md, "type": "preprint",
                               "venue": md.get("journal_ref") or f"arXiv preprint arXiv:{a}"},
                           "all", "arxiv")
            if md.get("doi") and not r.get("doi"):
                r["doi"], r["metadata"]["doi_explicit"] = md["doi"], True
                r["metadata"]["journal_doi_from"] = "arxiv"
        elif a in cached:
            copy_cached(r, cached[a])

    # 2. Crossref by DOI
    for r in records:
        doi = r.get("doi")
        if not doi:
            continue
        o = old_by_key.get(r.get("_old"))
        if not refresh and o and o.get("doi") == doi and \
                o.get("metadata", {}).get("source") in ("crossref", "crossref-search",
                                                        "crossref-not-found"):
            copy_cached(r, o)
            continue
        msg = crossref_work(f, doi)
        if msg is False:
            r["metadata"]["crossref"] = "not found"
            if r["metadata"]["source"] == "repo":
                r["metadata"]["source"] = "crossref-not-found"
            continue
        if not msg:
            continue
        md = crossref_fields(msg)
        apply_metadata(r, md, "all" if r["metadata"].get("doi_explicit") else "work", "crossref")

    # 3. Crossref title search for scholarly records with a title and author but no DOI
    for r in records:
        if r.get("doi") or r.get("arxiv") or r["type"] not in ("paper", "preprint", "book"):
            continue
        if not r.get("title") or not r.get("authors") or not r.get("year"):
            continue
        o = old_by_key.get(r.get("_old"))
        if not refresh and o and (o.get("metadata", {}).get("searched") or o.get("doi")):
            copy_cached(r, o)
            continue
        r["metadata"]["searched"] = True
        first_author = r["authors"][0]
        for item in crossref_search(f, r["title"], first_author):
            md = crossref_fields(item)
            fam = [surname(x) for x in md["authors"]]
            if not title_match(r["title"], md["title"]) or surname(first_author) not in fam:
                continue
            if not md["year"] or abs(md["year"] - int(r["year"])) > 1:
                continue
            cont = (item.get("container-title") or [None])[0]
            working = re.search(r"working paper|\bWP\b|NBER|SSRN|discussion paper|preprint",
                                r.get("venue") or r.get("_venue_hint") or "", re.I)
            if (r.get("venue") or r.get("_venue_hint")) and not working and \
                    not venue_match(r.get("venue") or r.get("_venue_hint"), cont):
                continue
            r["doi"] = md["doi"]
            # keep the year and venue the repo cites, take names and title from Crossref
            apply_metadata(r, md, "work", "crossref-search")
            r["metadata"]["doi_explicit"] = False
            break

    # 4. no title, only "Authors (year), Journal, Table 2": search, and accept only a
    # result whose authors, year and journal all agree
    for r in records:
        if r.get("doi") or r.get("arxiv") or r.get("title") or r["type"] not in ("paper",
                                                                                 "preprint"):
            continue
        real = [a for a in r.get("authors") or [] if a != "et al."]
        hint = r.get("_venue_hint") or r.get("venue")
        if not real or not r.get("year") or not hint:
            continue
        o = old_by_key.get(r.get("_old"))
        if not refresh and o and (o.get("metadata", {}).get("searched") or o.get("doi")):
            copy_cached(r, o)
            continue
        r["metadata"]["searched"] = True
        hits = []
        for item in crossref_search(f, f"{hint} {r['year']}", " ".join(real)):
            md = crossref_fields(item)
            fam = {surname(x) for x in md["authors"]}
            if not all(surname(a) in fam for a in real):
                continue
            if "et al." not in r["authors"] and len(fam) != len(real):
                continue
            if not md["year"] or abs(md["year"] - int(r["year"])) > 1:
                continue
            cont = (item.get("container-title") or [None])[0]
            if not venue_match(hint, cont):
                continue
            hits.append(md)
        if len({h["doi"] for h in hits}) == 1:
            r["doi"] = hits[0]["doi"]
            apply_metadata(r, hits[0], "work", "crossref-search")
            r["metadata"]["doi_explicit"] = False


def richness(r: dict) -> int:
    return (2 if r["metadata"].get("source") not in ("repo", "crossref-not-found") else 0) + \
        (1 if r.get("doi") else 0)


def copy_cached(r: dict, o: dict):
    for k in ("authors", "year", "title", "venue", "type", "doi", "arxiv"):
        if o.get(k) not in (None, "", []):
            r[k] = o[k]
    r["metadata"] = dict(o.get("metadata", {}))


# ---------------------------------------------------------------- keys, verification


def key_for(rec: dict) -> str:
    real = [a for a in rec.get("authors") or [] if a != "et al."]
    if rec["type"] in ("paper", "preprint", "book") and real and rec.get("year"):
        base = surname(real[0]) + str(rec["year"])
        if re.fullmatch(r"[a-z]+\d{4}", base):
            return base
    ident = ("doi:" + rec["doi"]) if rec.get("doi") else normalise_url(rec["url"]) if rec.get("url") \
        else norm_title(rec.get("title"))
    return "url-" + hashlib.sha1(ident.encode()).hexdigest()[:8]


def record_ids(r: dict) -> set[str]:
    out = {"url:" + normalise_url(u) for u in [r.get("url")] + list(r.get("also_at") or []) if u}
    if r.get("doi"):
        out.add("doi:" + r["doi"])
    if r.get("arxiv"):
        out.add("arxiv:" + r["arxiv"])
    if not out:
        a = r.get("authors") or ["x"]
        out.add("work:" + "|".join([surname(a[0]), str(r.get("year")), norm_title(r.get("title"))]))
    return out


def load_verification() -> dict[str, dict]:
    """Map normalised URL (or 'key:<key>') to {status, title, checked}. Accepts a list of
    records, a dict of records under 'records', 'sources' or 'results', or {url: status}."""
    if not VERIFICATION.exists():
        return {}
    try:
        data = json.loads(VERIFICATION.read_text())
    except ValueError:
        return {}
    items = data
    if isinstance(data, dict):
        for k in ("records", "sources", "results", "items", "urls"):
            if k in data:
                items = data[k]
                break
    out = {}

    def status_of(v):
        if isinstance(v, str):
            return v
        if isinstance(v, dict):
            for k in ("status", "verdict", "result", "state"):
                if isinstance(v.get(k), str):
                    return v[k]
        return None

    def info(v, s):
        d = v if isinstance(v, dict) else {}
        return {"status": s, "title": plain(d.get("title")),
                "checked": str(d.get("checked_at") or d.get("checked") or "")[:10] or None}

    if isinstance(items, dict):
        for k, v in items.items():
            s = status_of(v)
            if s:
                out[("url:" + normalise_url(k)) if re.match(r"^https?://", k) else "key:" + k] = \
                    info(v, s)
    elif isinstance(items, list):
        for v in items:
            if not isinstance(v, dict):
                continue
            s = status_of(v)
            if not s:
                continue
            if v.get("url"):
                out["url:" + normalise_url(v["url"])] = info(v, s)
            if v.get("key"):
                out["key:" + v["key"]] = info(v, s)
    return out


# ---------------------------------------------------------------- main


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--offline", action="store_true", help="do not call Crossref or arXiv")
    ap.add_argument("--refresh", action="store_true", help="refetch metadata already stored")
    args = ap.parse_args()
    today = dt.date.today().isoformat()

    old = json.loads(OUT.read_text())["references"] if OUT.exists() else []
    old_by_key = {r["key"]: r for r in old}
    old_index: dict[str, str] = {}
    for r in old:
        for i in record_ids(r):
            old_index.setdefault(i, r["key"])

    mentions = parse_reading_list() + collect_catalog()
    doc_mentions, cites = collect_docs()
    mentions += doc_mentions
    records = [build_record(g) for g in group(mentions)]

    # reuse old keys so cached metadata can be found
    taken: set[str] = set()
    for r in records:
        olds = [old_index[i] for i in sorted(record_ids(r)) if i in old_index]
        r["_old"] = olds[0] if olds else None  # where to find metadata fetched last time
        for k in olds:
            if k not in taken:
                r["key"] = k
                taken.add(k)
                break

    f = Fetcher(args.offline)
    enrich(records, old_by_key, f, args.refresh)

    # second merge: the same DOI or arXiv id, then the same first author, year and title
    def merge_on(records: list[dict], ident_of) -> list[dict]:
        kept: dict = {}
        order = []
        for r in records:
            ident = ident_of(r)
            if ident is None:
                order.append(r)
                continue
            if ident not in kept:
                kept[ident] = r
                order.append(r)
                continue
            a = kept[ident]
            base, other = (a, r) if richness(a) >= richness(r) else (r, a)
            base["used_in"] = sorted(set(a["used_in"]) | set(r["used_in"]))
            for u in [other["url"]] + other["also_at"]:
                if u and normalise_url(u) not in {normalise_url(x) for x in
                                                  [base["url"]] + base["also_at"] if x}:
                    base["also_at"].append(u)
            base["doi"] = base.get("doi") or other.get("doi")
            base["key"] = base["key"] or other["key"]
            if base is r:
                order[order.index(a)] = r
                kept[ident] = r
        return order

    def work_id(r):
        real = [a for a in r.get("authors") or [] if a != "et al."]
        if not (r.get("title") and real and r["type"] in ("paper", "preprint", "book")):
            return None
        return "|".join([surname(real[0]), str(r.get("year")), norm_title(r.get("title"))])

    records = merge_on(records, lambda r: ("doi:" + r["doi"]) if r.get("doi") else
                       ("arxiv:" + r["arxiv"]) if r.get("arxiv") else None)
    records = merge_on(records, work_id)

    for r in records:
        scholarly = r["type"] in ("paper", "preprint", "book")
        if not scholarly and r.get("_authors_from") == "reported-result":
            r["authors"], r["year"] = [], None  # a label like "Carver blog (2015)" is not a byline
        if not r.get("title"):
            label = r.get("_cited_as") or r.get("_label")
            if scholarly and label:
                r["note"] = r.get("note") or f"Cited in this repo as: {label}"
            else:
                r["title"], r["_title_is_label"] = label, True
        for k in ("_cited_as", "_authors_from"):
            r.pop(k, None)
        r["venue"] = r.get("venue") or r.get("_venue_hint")
        if not r["venue"] and r.get("url") and r["type"] not in ("paper", "preprint", "book"):
            r["venue"] = host_of(r["url"])
        r.pop("_label", None)
        r.pop("_old", None)
        r.pop("_venue_hint", None)

    # keys: keep old ones, give new ones, never collide
    taken = {r["key"] for r in records if r.get("key")}
    for r in sorted((r for r in records if not r.get("key")),
                    key=lambda r: (r.get("doi") or "", r.get("url") or "", r.get("title") or "")):
        base = key_for(r)
        k, n = base, 0
        while k in taken:
            n += 1
            k = base + "abcdefghijklmnopqrstuvwxyz"[n - 1] if n <= 26 else f"{base}-{n}"
        r["key"] = k
        taken.add(k)

    verification = load_verification()
    for r in records:
        o = old_by_key.get(r["key"])
        r["accessed"] = (o or {}).get("accessed") or today
        found = verification.get("key:" + r["key"])
        for u in [r["url"]] + r["also_at"]:
            if not found and u:
                found = verification.get("url:" + normalise_url(u))
        r["verification"] = found["status"] if found else "not checked"
        if found and found.get("checked"):
            r["verification_checked"] = found["checked"]
        page_title = (verification.get("url:" + normalise_url(r["url"])) or {}).get("title") \
            if r.get("url") else None
        generic = r"^(just a moment|access denied|attention required|forbidden|403|404|page not " \
                  r"found|not found|reddit - dive into anything|log ?in|sign ?in|error|untitled|" \
                  r"home|redirecting|loading)\b"
        good = page_title and len(page_title) > 8 and not re.match(generic, page_title, re.I)
        if good and (not r.get("title") or r.get("_title_is_label")):
            if r.get("_title_is_label") and r["title"] != page_title:
                r["note"] = r.get("note") or f"Linked in this repo as: {r['title']}"
            r["title"] = page_title
            r.setdefault("metadata", {})["title_from"] = "page title found by verify_sources.py"
        r.pop("_title_is_label", None)
        r["used_in"] = sorted(set(r["used_in"]) | cites.get(r["key"], set()))
        for k in ("title", "venue", "note"):
            if r.get(k):
                r[k] = plain(r[k])
        r["authors"] = [plain(a) for a in r["authors"] if plain(a)]
        r["year"] = int(r["year"]) if r.get("year") else None

    order = ["key", "type", "authors", "year", "title", "venue", "doi", "arxiv", "url", "also_at",
             "accessed", "verification", "verification_checked", "used_in", "note", "software",
             "metadata"]
    records = [{k: r[k] for k in order if k in r} for r in sorted(records, key=lambda r: r["key"])]
    data = {
        "about": "Every source the project relies on, one record each. Built by "
                 "scripts/references.py from the catalog, the docs and the reading list; rerun it "
                 "after adding a source, then run scripts/docs.py index. Cite a record in prose "
                 "with [@key]. docs/REFERENCES.md is generated from this file.",
        "types": TYPES,
        "references": records,
    }
    OUT.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    by_type = {t: sum(1 for r in records if r["type"] == t) for t in TYPES}
    full = sum(1 for r in records if r["metadata"].get("source") in ("crossref", "crossref-search",
                                                                        "arxiv"))
    bare = sum(1 for r in records if not r["authors"] or not r["year"])
    print(f"{len(records)} references from {len(mentions)} mentions, {f.calls} network calls")
    print("by type: " + ", ".join(f"{t} {n}" for t, n in by_type.items() if n))
    print(f"full metadata from Crossref or arXiv: {full}; missing author or year: {bare}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
