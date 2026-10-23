"""News sources we are allowed to use, and how to read each one.

Only sources whose terms allow automated access are listed. Robinhood, the Wall Street
Journal and most news sites forbid scraping, so they are not here and must not be added.
Each source's licence, limits and display rights are recorded in catalog/datasets/*.json
and summarised in docs/reference (news sources and market impact).

Fetching and parsing are separate: `fetch_*` touches the network, `parse_*` turns a
response body into Articles and is what the tests exercise with saved fixtures.

Keys are read by name from the environment and never stored:
    ALPHAVANTAGE_API_KEY, FINNHUB_API_KEY, MARKETAUX_API_TOKEN
SEC and BLS ask callers to say who they are, so those two run only when
PARITY_CONTACT (an email or URL, not a secret) is set. It is added to our own user agent;
we never pretend to be a browser.

`display` says whether the shared dashboard may show a source. The keyed news APIs
license their free plans for personal use only, so they can be fetched for one person's
own research but are left out of the site export.
"""

from __future__ import annotations

import os
import re
import time
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from datetime import UTC, datetime
from email.utils import parsedate_to_datetime

import pandas as pd
import requests

from .schema import Article
from .tagging import tag

USER_AGENT = "parity-research/0.1 (private research project)"
TIMEOUT = 30


@dataclass(frozen=True)
class Source:
    id: str
    name: str
    kind: str  # "rss", "gdelt", "alphavantage", "finnhub", "marketaux"
    url: str
    terms_url: str
    licence: str
    store_summary: bool  # False: headline and link only
    category: str | None = None
    regions: tuple[str, ...] = ()
    currencies: tuple[str, ...] = ()
    key_env: str | None = None
    needs_contact: bool = False
    catalog: str = ""  # slug in catalog/datasets
    params: dict = field(default_factory=dict)
    display: str = "yes"  # may the shared site show it: "yes", "no" (personal use only), "ask"


SOURCES: list[Source] = [
    Source("fed", "Federal Reserve press releases", "rss",
           "https://www.federalreserve.gov/feeds/press_all.xml",
           "https://www.federalreserve.gov/disclaimer.htm", "US government work, public domain",
           True, "central-bank", ("US",), ("USD",), catalog="federal-reserve-press"),
    Source("ecb", "ECB press releases", "rss", "https://www.ecb.europa.eu/rss/press.html",
           "https://www.ecb.europa.eu/services/disclaimer/html/index.en.html",
           "ECB copyright, reuse allowed with the source named", True, "central-bank",
           ("Euro area",), ("EUR",), catalog="ecb-press"),
    Source("boe", "Bank of England news", "rss", "https://www.bankofengland.co.uk/rss/news",
           "https://www.bankofengland.co.uk/legal", "Bank of England copyright; reuse of "
           "headlines not spelled out", True, "central-bank", ("UK",), ("GBP",), display="ask",
           catalog="bank-of-england-news"),
    Source("boj", "Bank of Japan what's new", "rss", "https://www.boj.or.jp/en/rss/whatsnew.xml",
           "https://www.boj.or.jp/en/about/copyright.htm", "Bank of Japan, reuse with the source "
           "named", True, "central-bank", ("Japan",), ("JPY",), catalog="bank-of-japan-news"),
    Source("eia", "EIA Today in Energy", "rss", "https://www.eia.gov/rss/todayinenergy.xml",
           "https://www.eia.gov/about/copyrights_reuse.php", "US government work, public domain",
           True, "energy", ("US",), (), catalog="eia"),
    Source("eia-press", "EIA press releases", "rss", "https://www.eia.gov/rss/press_rss.xml",
           "https://www.eia.gov/about/copyrights_reuse.php", "US government work, public domain",
           True, "energy", ("US",), (), catalog="eia"),
    Source("bls", "BLS latest releases", "rss", "https://www.bls.gov/feed/bls_latest.rss",
           "https://www.bls.gov/bls/linksite.htm", "US government work, public domain", True,
           "macro-data", ("US",), ("USD",), needs_contact=True, catalog="bls"),
    Source("bea", "BEA news releases", "rss", "https://apps.bea.gov/rss/rss.xml",
           "https://www.bea.gov/help/guidelines-for-citing-bea", "US government work, public "
           "domain", True, "macro-data", ("US",), ("USD",), catalog="bea"),
    Source("sec", "SEC press releases", "rss", "https://www.sec.gov/news/pressreleases.rss",
           "https://www.sec.gov/search-filings/edgar-search-assistance/accessing-edgar-data",
           "US government work, public domain", True, "regulation", ("US",), (),
           needs_contact=True, catalog="sec-press"),
    Source("cftc", "CFTC press releases", "rss",
           "https://www.cftc.gov/RSS/RSSGP/rssgp.xml", "https://www.cftc.gov/WebPolicy/index.htm",
           "US government work, public domain", True, "regulation", ("US",), (),
           catalog="cftc-press"),
    Source("gdelt", "GDELT news index", "gdelt",
           "https://api.gdeltproject.org/api/v2/doc/doc",
           "https://www.gdeltproject.org/about.html#termsofuse",
           "GDELT data free and open with citation; the headlines belong to each outlet",
           False, None, catalog="gdelt",
           params={"query": '("central bank" OR "interest rates" OR "oil prices" OR '
                            '"stock market" OR "exchange rate" OR "bond yields" OR inflation) '
                            'sourcelang:english',
                   "mode": "artlist", "format": "json", "sort": "datedesc",
                   "maxrecords": "75", "timespan": "1d"}),
    # Archive only: read by `parity news backfill` (backfill.py), never by the hourly fetch.
    Source("events", "Parity market event catalog", "backfill",
           "catalog/events", "https://github.com/abasheer-rion/parity",
           "Our own descriptions, each linking to its source", True, "geopolitics"),
    Source("sec8k", "SEC 8-K filings (EDGAR)", "backfill",
           "https://data.sec.gov/submissions/",
           "https://www.sec.gov/search-filings/edgar-search-assistance/accessing-edgar-data",
           "US government work, public domain", True, "earnings", ("US",), (),
           needs_contact=True, catalog="sec-press"),
    Source("alphavantage", "Alpha Vantage news and sentiment", "alphavantage",
           "https://www.alphavantage.co/query", "https://www.alphavantage.co/terms_of_service/",
           "Alpha Vantage terms: personal, non-commercial use; free key 25 requests a day", False,
           display="no", key_env="ALPHAVANTAGE_API_KEY", catalog="alpha-vantage",
           params={"function": "NEWS_SENTIMENT", "tickers": "FOREX:USD", "limit": "50",
                   "sort": "LATEST"}),
    Source("finnhub", "Finnhub market news", "finnhub", "https://finnhub.io/api/v1/news",
           "https://finnhub.io/terms-of-service",
           "Finnhub terms: free plan strictly personal, no sharing", False, display="no",
           key_env="FINNHUB_API_KEY", catalog="finnhub", params={"category": "forex"}),
    Source("marketaux", "Marketaux financial news", "marketaux",
           "https://api.marketaux.com/v1/news/all", "https://www.marketaux.com/tos",
           "Marketaux terms: personal, non-commercial use; 100 requests a day", False,
           display="no", key_env="MARKETAUX_API_TOKEN", catalog="marketaux",
           params={"language": "en", "filter_entities": "true", "limit": "3"}),
]

BY_ID = {s.id: s for s in SOURCES}


# ------------------------------------------------------------------ network


def contact() -> str | None:
    return os.environ.get("PARITY_CONTACT") or None


def user_agent(src: Source | None = None) -> str:
    """Our own honest user agent. Sources that ask for contact details get them added."""
    c = contact()
    return f"{USER_AGENT[:-1]}; {c})" if c and (src is None or src.needs_contact) else USER_AGENT


def _get(url: str, src: Source, params: dict | None = None, retries: int = 2) -> requests.Response:
    last: Exception | None = None
    for attempt in range(retries):
        try:
            resp = requests.get(url, params=params, timeout=TIMEOUT,
                                headers={"User-Agent": user_agent(src)})
            resp.raise_for_status()
            return resp
        except requests.HTTPError as exc:
            if exc.response is not None and exc.response.status_code in (401, 403, 429):
                raise RuntimeError(f"{src.id}: HTTP {exc.response.status_code}, skipped") from exc
            last = exc
        except requests.RequestException as exc:
            last = exc
        time.sleep(2 ** attempt)
    raise RuntimeError(f"{src.id}: failed to fetch {url}: {last}")


class Skipped(Exception):
    """A source that cannot run here, for example because its key is not set."""


def fetch(src: Source) -> list[Article]:
    if src.key_env and not os.environ.get(src.key_env):
        raise Skipped(f"{src.key_env} is not set")
    if src.needs_contact and not contact():
        raise Skipped("PARITY_CONTACT is not set (this source asks callers to identify)")
    params = dict(src.params)
    if src.kind == "backfill":
        raise Skipped("archive only, run `parity news backfill`")
    if src.kind == "rss":
        return parse_rss(_get(src.url, src).content, src)
    if src.kind == "gdelt":
        return relevant(parse_gdelt(_get(src.url, src, params).json(), src))
    if src.kind == "alphavantage":
        params["apikey"] = os.environ[src.key_env]
        return parse_alphavantage(_get(src.url, src, params).json(), src)
    if src.kind == "finnhub":
        params["token"] = os.environ[src.key_env]
        return parse_finnhub(_get(src.url, src, params).json(), src)
    if src.kind == "marketaux":
        params["api_token"] = os.environ[src.key_env]
        return parse_marketaux(_get(src.url, src, params).json(), src)
    raise KeyError(f"Unknown source kind {src.kind}")


def gdelt_day(day: str, query: str, max_records: int = 10) -> list[Article]:
    """Headlines GDELT saw on one UTC day, for explaining a big market day.

    GDELT asks for at most one request every five seconds; callers must pace themselves.
    """
    src = BY_ID["gdelt"]
    d = pd.Timestamp(day)
    params = {"query": query, "mode": "artlist", "format": "json", "sort": "hybridrel",
              "maxrecords": str(max_records),
              "startdatetime": d.strftime("%Y%m%d000000"),
              "enddatetime": (d + pd.Timedelta(days=1)).strftime("%Y%m%d000000")}
    return parse_gdelt(_get(src.url, src, params).json(), src)


# ------------------------------------------------------------------ parsers


def _local(tag_name: str) -> str:
    return tag_name.rsplit("}", 1)[-1].lower()


def _child(el: ET.Element, *names: str) -> ET.Element | None:
    for c in el:
        if _local(c.tag) in names:
            return c
    return None


def _text(el: ET.Element, *names: str) -> str:
    c = _child(el, *names)
    return (c.text or "").strip() if c is not None else ""


def parse_date(value: str) -> datetime | None:
    if not value:
        return None
    try:
        return parsedate_to_datetime(value).astimezone(UTC)  # RFC 822, used by RSS 2.0
    except (TypeError, ValueError):
        pass
    try:
        ts = pd.Timestamp(value)  # ISO 8601, used by Atom and Dublin Core
    except ValueError:
        return None
    return (ts.tz_localize("UTC") if ts.tzinfo is None else ts.tz_convert("UTC")).to_pydatetime()


def _make(src: Source, title: str, url: str, published: datetime, summary: str = "",
          publisher: str = "", tickers: list[str] | None = None,
          currencies: list[str] | None = None) -> Article:
    text = f"{title}. {summary}"
    tags = tag(text, default_category=src.category, regions=list(src.regions),
               currencies=list(src.currencies) + list(currencies or []))
    return Article(source=src.id, published_at=published, title=title, url=url,
                   summary=summary if src.store_summary else "", publisher=publisher,
                   tickers=tickers or [], **tags)


def parse_rss(body: str | bytes, src: Source) -> list[Article]:
    """RSS 2.0, RSS 1.0 (RDF) and Atom, read by local tag name so namespaces do not matter."""
    raw = body.encode() if isinstance(body, str) else body
    root = ET.fromstring(raw.removeprefix(b"\xef\xbb\xbf").lstrip())  # some feeds start with a BOM
    items = [el for el in root.iter() if _local(el.tag) in ("item", "entry")]
    out = []
    for it in items:
        title = _text(it, "title")
        link = _text(it, "link")
        if not link:
            ln = _child(it, "link")
            link = ln.get("href", "") if ln is not None else ""
        when = parse_date(_text(it, "pubdate", "published", "updated", "date"))
        if not title or not link or when is None:
            continue
        summary = _text(it, "description", "summary", "content")
        out.append(_make(src, title, link, when, summary))
    return out


def relevant(articles: list[Article]) -> list[Article]:
    """Keep items that name a currency or commodity, or are clearly about policy, data or
    energy. GDELT's keyword search also returns local news that only mentions a word."""
    return [a for a in articles if a.currencies or a.commodities or a.category != "markets"]


_SPACED = re.compile(r"\s+([.,:;?!%)])|([($])\s+")


def parse_gdelt(payload: dict, src: Source) -> list[Article]:
    out = []
    for a in payload.get("articles", []) or []:
        when = pd.to_datetime(a.get("seendate", ""), format="%Y%m%dT%H%M%SZ", utc=True,
                              errors="coerce")
        if pd.isna(when) or not a.get("url") or not a.get("title"):
            continue
        title = _SPACED.sub(lambda m: m.group(1) or m.group(2), a["title"])  # "off ." to "off."
        out.append(_make(src, title, a["url"], when.to_pydatetime(),
                         publisher=a.get("domain", "")))
    return out


def parse_alphavantage(payload: dict, src: Source) -> list[Article]:
    """Alpha Vantage gives times as YYYYMMDDTHHMMSS without a zone. Its docs do not say
    which zone; we read them as US Eastern, which matches the examples we checked."""
    out = []
    for a in payload.get("feed", []) or []:
        when = pd.to_datetime(a.get("time_published", ""), format="%Y%m%dT%H%M%S",
                              errors="coerce")
        if pd.isna(when) or not a.get("url"):
            continue
        when = when.tz_localize("America/New_York").tz_convert("UTC")
        tickers = [t["ticker"] for t in a.get("ticker_sentiment", []) if t.get("ticker")]
        ccy = [t.split(":", 1)[1] for t in tickers if t.startswith("FOREX:")]
        out.append(_make(src, a.get("title", ""), a["url"], when.to_pydatetime(),
                         a.get("summary", ""), a.get("source", ""),
                         [t for t in tickers if not t.startswith("FOREX:")], ccy))
    return out


def parse_finnhub(payload: list, src: Source) -> list[Article]:
    out = []
    for a in payload or []:
        if not a.get("url") or not a.get("headline") or not a.get("datetime"):
            continue
        when = datetime.fromtimestamp(int(a["datetime"]), tz=UTC)
        related = [t for t in (a.get("related") or "").split(",") if t]
        out.append(_make(src, a["headline"], a["url"], when, a.get("summary", ""),
                         a.get("source", ""), related))
    return out


def parse_marketaux(payload: dict, src: Source) -> list[Article]:
    out = []
    for a in payload.get("data", []) or []:
        when = parse_date(a.get("published_at", ""))
        if when is None or not a.get("url"):
            continue
        tickers = [e["symbol"] for e in a.get("entities", []) or [] if e.get("symbol")]
        out.append(_make(src, a.get("title", ""), a["url"], when, a.get("description", ""),
                         a.get("source", ""), tickers))
    return out
