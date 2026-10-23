"""Older news for the archive, from sources whose terms allow automated reuse.

Checked on 2026-10-23 (see the decision record and REF-0013):

| Source  | What                                          | From  | Terms                       |
| ------- | --------------------------------------------- | ----- | --------------------------- |
| fed     | Every Federal Reserve press release (JSON)    | 2016  | US government, public domain |
| ecb     | Every ECB press release, one page per year    | 1997  | Reuse allowed, ECB named     |
| boj     | Bank of Japan monetary policy releases        | 1998  | Reuse allowed, BoJ named     |
| events  | Our own catalog of 76 market events           | 1971  | Our text, links to sources   |
| gdelt   | GDELT headline index, by month and topic      | 2017  | Free, cited; headline+link   |
| sec8k   | SEC 8-K filings and their item numbers        | ~2004 | Public domain; needs contact |

Not used: OPEC's site refuses automated requests (HTTP 403) and its press releases carry
no reuse grant. EIA's press archive page refuses bots too, so EIA history is only what
its RSS feeds still hold. The Bank of England stays out until it confirms headline reuse.

Like sources.py, `fetch_*` touches the network and `parse_*` reads a saved body, which
is what the tests use.
"""

from __future__ import annotations

import html
import json
import re
import time
from datetime import UTC, datetime
from pathlib import Path

import pandas as pd

from ..data.store import DEFAULT_DIR
from . import archive, sources
from .schema import Article
from .tagging import tag

REPO = Path(__file__).resolve().parents[4]
EVENTS_DIR = REPO / "catalog" / "events"

FED_JSON = "https://www.federalreserve.gov/json/ne-press.json"
FED_BASE = "https://www.federalreserve.gov"
ECB_YEAR = "https://www.ecb.europa.eu/press/pr/date/{year}/html/index_include.en.html"
ECB_BASE = "https://www.ecb.europa.eu"
BOJ_YEAR = "https://www.boj.or.jp/en/mopo/mpmdeci/state_{year}/index.htm"
BOJ_BASE = "https://www.boj.or.jp"
SEC_SUBMISSIONS = "https://data.sec.gov/submissions/CIK{cik:010d}.json"

# Big US banks, energy majors and the largest companies. SVB is here for "bank failure".
SEC_COMPANIES = {19617: "JPMorgan Chase", 70858: "Bank of America", 831001: "Citigroup",
                 72971: "Wells Fargo", 886982: "Goldman Sachs", 895421: "Morgan Stanley",
                 719739: "SVB Financial", 34088: "Exxon Mobil", 93410: "Chevron",
                 320193: "Apple", 789019: "Microsoft", 1045810: "Nvidia", 1018724: "Amazon"}
SEC_TICKERS = {19617: "JPM", 70858: "BAC", 831001: "C", 72971: "WFC", 886982: "GS",
               895421: "MS", 719739: "SIVB", 34088: "XOM", 93410: "CVX", 320193: "AAPL",
               789019: "MSFT", 1045810: "NVDA", 1018724: "AMZN"}
# 8-K items worth a headline. Routine ones (9.01 exhibits, 7.01 Reg FD) are dropped
# unless nothing else is in the filing.
ITEMS = {"1.01": "material agreement", "1.03": "bankruptcy or receivership",
         "2.01": "acquisition or sale completed", "2.02": "results of operations",
         "2.03": "new debt", "2.05": "costs of exit or restructuring",
         "2.06": "material impairment", "3.01": "delisting notice",
         "4.02": "past financials no longer reliable", "5.02": "executive or director change",
         "8.01": "other events", "7.01": "Regulation FD disclosure", "9.01": "exhibits"}
ROUTINE = {"7.01", "9.01"}

# GDELT backfill: one query per topic, one month at a time.
GDELT_FROM = 2017
GDELT_QUERIES = {
    "opec": "OPEC (cut OR output OR production) sourcelang:english",
    "rates": '("rate hike" OR "rate cut" OR "raises rates" OR "cuts rates") '
             '("federal reserve" OR ECB OR "central bank") sourcelang:english',
    "inflation": '(inflation OR CPI) ("consumer prices" OR "inflation report") '
                 'sourcelang:english',
    "war": '(war OR invasion OR missile OR airstrike) (oil OR markets OR stocks) '
           'sourcelang:english',
    "banks": '("bank failure" OR "bank collapse" OR "bank run" OR receivership) '
             'sourcelang:english',
    "trade": "(tariffs OR \"trade war\") (stocks OR markets) sourcelang:english",
}


def _src(sid: str) -> sources.Source:
    return sources.BY_ID[sid]


def _article(src: sources.Source, title: str, url: str, when, summary: str = "",
             tickers: list[str] | None = None, publisher: str = "",
             extra_commodities: list[str] | None = None) -> Article:
    tags = tag(f"{title}. {summary}", default_category=src.category, regions=list(src.regions),
               currencies=list(src.currencies))
    if extra_commodities:
        tags["commodities"] = sorted(set(tags["commodities"]) | set(extra_commodities))
    return Article(source=src.id, published_at=when, title=title, url=url,
                   summary=summary if src.store_summary else "", tickers=tickers or [],
                   publisher=publisher, **tags)


# ------------------------------------------------------------------ Federal Reserve


def parse_fed(body: str | bytes) -> list[Article]:
    """The Fed's press release list: {"d": "1/6/2016 2:00:00 PM", "t": title, "l": link}.
    Times are Washington time."""
    text = body.decode("utf-8-sig") if isinstance(body, bytes) else body.lstrip("﻿")
    src = _src("fed")
    out = []
    for x in json.loads(text):
        if not x.get("d") or not x.get("t") or not x.get("l"):
            continue
        when = pd.to_datetime(x["d"], format="%m/%d/%Y %I:%M:%S %p", errors="coerce")
        if pd.isna(when):
            continue
        when = when.tz_localize("America/New_York").tz_convert("UTC")
        out.append(_article(src, html.unescape(x["t"]), FED_BASE + x["l"], when,
                            summary=x.get("pt", "")))
    return out


def fetch_fed() -> list[Article]:
    return parse_fed(sources._get(FED_JSON, _src("fed")).content)


# ------------------------------------------------------------------ ECB

_ECB_ITEM = re.compile(r'<dt isoDate="(\d{4}-\d{2}-\d{2})">.*?<div class="title"><a href="([^"]+)"'
                       r'[^>]*>(.*?)</a>', re.S)


def parse_ecb_year(body: str) -> list[Article]:
    """One year of ECB press releases. The page gives the date only; we stamp items at
    13:00 Frankfurt time (12:00 UTC in winter), before the US close, which is when the
    ECB's own rate decisions come out (13:15 or 14:15 CET)."""
    src = _src("ecb")
    out = []
    for day, href, title in _ECB_ITEM.findall(body):
        when = pd.Timestamp(day + " 13:00").tz_localize("Europe/Berlin").tz_convert("UTC")
        url = href if href.startswith("http") else ECB_BASE + href
        out.append(_article(src, html.unescape(re.sub(r"<[^>]+>", "", title)), url, when))
    return out


def fetch_ecb_year(year: int) -> list[Article]:
    return parse_ecb_year(sources._get(ECB_YEAR.format(year=year), _src("ecb")).text)


# ------------------------------------------------------------------ Bank of Japan

_BOJ_ROW = re.compile(r"<td>([^<]+)</td>\s*<td><a href=\"([^\"]+)\"[^>]*>(.*?)</a>", re.S)
_MONTHS = {m: i for i, m in enumerate(["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug",
                                       "sep", "oct", "nov", "dec"], 1)}


def parse_boj_year(body: str) -> list[Article]:
    """A year of BoJ monetary policy releases. Dates like "Sept. 21, 2016"; decisions come
    out around noon in Tokyo, so items are stamped 12:00 Tokyo time."""
    src = _src("boj")
    out = []
    for when_text, href, title in _BOJ_ROW.findall(body):
        t = html.unescape(when_text).replace("\xa0", " ")
        m = re.match(r"\s*([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2}),\s*(\d{4})", t)
        if not m or m.group(1).lower() not in _MONTHS:
            continue
        day = datetime(int(m.group(3)), _MONTHS[m.group(1).lower()], int(m.group(2)), 12)
        when = pd.Timestamp(day).tz_localize("Asia/Tokyo").tz_convert("UTC")
        name = html.unescape(re.sub(r"<[^>]+>", "", title)).replace("\xa0", " ")
        name = re.sub(r"\s*\[PDF[^\]]*\]\s*$", "", name).strip()
        url = href if href.startswith("http") else BOJ_BASE + href
        out.append(_article(src, name, url, when))
    return out


def fetch_boj_year(year: int) -> list[Article]:
    return parse_boj_year(sources._get(BOJ_YEAR.format(year=year), _src("boj")).text)


# ------------------------------------------------------------------ our event catalog

EVENT_TYPE_WORDS = {"military_strike": "military strike", "war": "war", "invasion": "invasion",
                    "terror_attack": "terror attack", "pandemic": "pandemic",
                    "natural_disaster": "natural disaster", "bank_failure": "bank failure",
                    "sanctions": "sanctions", "election": "election"}


def parse_events(folder: Path = EVENTS_DIR) -> list[Article]:
    """catalog/events/*.json: the market events Sim World uses, each with a date, our own
    one paragraph description and a link to its source."""
    src = _src("events")
    out = []
    for p in sorted(folder.glob("*.json")):
        e = json.loads(p.read_text())
        link = (e.get("sources") or [{}])[0]
        url = link.get("url") or f"https://github.com/abasheer-rion/parity/blob/main/catalog/events/{p.name}"
        kind = EVENT_TYPE_WORDS.get(e.get("type", ""), e.get("type", "").replace("_", " "))
        when = pd.Timestamp(e["date"] + " 12:00").tz_localize("UTC")
        out.append(_article(src, e["name"], url, when,
                            summary=f"{kind.capitalize()}. {e.get('description', '')}",
                            publisher=link.get("publisher", ""),
                            extra_commodities=[c for c in e.get("commodities", [])
                                               if c in ("oil", "gas", "gold", "copper")]))
    return out


# ------------------------------------------------------------------ GDELT


def fetch_gdelt_month(year: int, month: int, query: str, max_records: int = 250) -> list[Article]:
    src = _src("gdelt")
    start = pd.Timestamp(year=year, month=month, day=1)
    end = start + pd.DateOffset(months=1)
    params = {"query": query, "mode": "artlist", "format": "json", "sort": "hybridrel",
              "maxrecords": str(max_records), "startdatetime": start.strftime("%Y%m%d%H%M%S"),
              "enddatetime": end.strftime("%Y%m%d%H%M%S")}
    return sources.relevant(sources.parse_gdelt(sources._get(src.url, src, params).json(), src))


# ------------------------------------------------------------------ SEC 8-K


def parse_sec_8k(payload: dict, cik: int) -> list[Article]:
    """8-K filings from a company's EDGAR submissions file, titled by their item numbers."""
    src = _src("sec8k")
    name = SEC_COMPANIES.get(cik) or payload.get("name", str(cik))
    rec = (payload.get("filings") or {}).get("recent") or {}
    out = []
    for i, form in enumerate(rec.get("form", [])):
        if form not in ("8-K", "8-K/A"):
            continue
        raw_items = (rec.get("items") or [""] * (i + 1))[i] or ""
        items = [x.strip() for x in raw_items.split(",") if x.strip()]
        shown = [x for x in items if x not in ROUTINE] or items
        what = "; ".join(f"item {x} {ITEMS.get(x, '')}".strip() for x in shown) or "filing"
        acc = rec["accessionNumber"][i]
        when = pd.to_datetime(rec.get("acceptanceDateTime", [None] * (i + 1))[i] or
                              rec["filingDate"][i], utc=True)
        url = (f"https://www.sec.gov/Archives/edgar/data/{cik}/{acc.replace('-', '')}/"
               f"{rec['primaryDocument'][i]}")
        out.append(_article(src, f"{name} {form}: {what}", url, when,
                            tickers=[SEC_TICKERS[cik]] if cik in SEC_TICKERS else []))
    return out


def fetch_sec_8k(cik: int) -> list[Article]:
    src = _src("sec8k")
    if src.needs_contact and not sources.contact():
        raise sources.Skipped("PARITY_CONTACT is not set (the SEC asks callers to identify)")
    return parse_sec_8k(sources._get(SEC_SUBMISSIONS.format(cik=cik), src).json(), cik)


# ------------------------------------------------------------------ the run


def state_path(root: Path = DEFAULT_DIR) -> Path:
    return archive.archive_dir(root) / "backfill.json"


def _state(root: Path) -> dict:
    p = state_path(root)
    return json.loads(p.read_text()) if p.exists() else {}


def _save_state(state: dict, root: Path) -> None:
    p = state_path(root)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(state, indent=1, sort_keys=True))


def run(which: list[str], start: int, end: int, root: Path = DEFAULT_DIR, gdelt_limit: int = 2,
        pause: float = 1.0, gdelt_pause: float = 8.0, log=print) -> dict[str, int]:
    """Backfill the archive. Remembers what it has done, so running it every hour only
    re-reads the current year and asks GDELT for a couple of new months.
    Returns how many new items each source added."""
    state = _state(root)
    this_year = datetime.now(UTC).year
    added: dict[str, int] = {}

    def done(key: str) -> bool:
        return key in state and not key.endswith(str(this_year))

    def mark(key: str, n: int) -> None:
        state[key] = datetime.now(UTC).isoformat(timespec="seconds")
        added[key.split(":")[0]] = added.get(key.split(":")[0], 0) + n

    for sid in which:
        try:
            if sid == "fed":
                n = archive.add(fetch_fed(), root)
                mark("fed:all", n)
            elif sid == "events":
                mark("events:all", archive.add(parse_events(), root))
            elif sid in ("ecb", "boj"):
                first = {"ecb": 1997, "boj": 1998}[sid]
                fetch = fetch_ecb_year if sid == "ecb" else fetch_boj_year
                for y in range(max(start, first), min(end, this_year) + 1):
                    key = f"{sid}:{y}"
                    if done(key):
                        continue
                    try:  # the ECB has no year page for 2025 on; its RSS covers those
                        mark(key, archive.add(fetch(y), root))
                    except RuntimeError as exc:
                        log(f"{sid:<8} {y}  {str(exc)[:80]}")
                    time.sleep(pause)
            elif sid == "sec8k":
                for cik in SEC_COMPANIES:
                    mark(f"sec8k:{cik}", archive.add(fetch_sec_8k(cik), root))
                    time.sleep(pause)  # the SEC allows 10 requests a second; we use 1
            elif sid == "gdelt":
                asked = 0
                months = [(y, m) for y in range(max(start, GDELT_FROM), min(end, this_year) + 1)
                          for m in range(1, 13)]
                now = pd.Timestamp.now()
                months = [(y, m) for y, m in months if pd.Timestamp(year=y, month=m, day=1) < now]
                for (y, m) in reversed(months):  # newest first
                    for q, query in GDELT_QUERIES.items():
                        key = f"gdelt:{q}:{y}-{m:02d}"
                        current = (y, m) == (now.year, now.month)
                        if key in state and not current:
                            continue
                        if asked >= gdelt_limit:
                            raise StopIteration
                        if asked:
                            time.sleep(gdelt_pause)
                        asked += 1
                        mark(key, archive.add(fetch_gdelt_month(y, m, query), root))
            else:
                raise KeyError(f"unknown backfill source {sid}")
        except StopIteration:
            pass
        except sources.Skipped as exc:
            log(f"{sid:<8} skip  {exc}")
        except Exception as exc:  # one dead source should not stop the others
            log(f"{sid:<8} ERR   {exc}")
        finally:
            _save_state(state, root)
    return added
