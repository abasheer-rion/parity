"""The registry rows the code already knows (DEC-0064): every provider, every curated catalog
series, every live feed, and where each series is used.

`parity registry sync` writes these into the registry. Fields that come from code (name,
code, frequency, look-ahead lag, display rights, tags) follow the code on every sync; fields
the services learn (status, health, quality, dates) are kept.
"""

from __future__ import annotations

import re

from ..data import catalog, providers
from . import rights, tags
from .model import Record, Source

#: The day each provider's terms were read for the record. Research providers were read for
#: REF-0015 (22 Oct 2026); live venues for DEC-0052 and DEC-0056 (25 Oct 2026); the on-chain
#: feed for DEC-0063 (26 Oct 2026).
REF_0015 = "2026-10-22"
LIVE_READ = "2026-10-25"
ONCHAIN_READ = "2026-10-26"

#: Display rights per provider, from the licence summaries in providers.py and REF-0015.
#: Planned providers we have no contract with are none, whatever a paid plan would allow.
SOURCE_RIGHTS = {
    "fred": "public", "french": "public", "yahoo": "none", "derived": "public", "ecb": "public",
    "treasury": "public", "bis": "public", "cftc": "public", "eia": "public",
    "alphavantage": "none", "twelvedata": "none", "tiingo": "internal", "massive": "none",
    "fmp": "none", "finnhub": "none", "nasdaqdatalink": "none", "databento": "internal",
    "oanda": "internal", "bls": "public", "bea": "public", "onchain": "public",
    "coingecko-live": "public", "sec-tickers": "public", "hyperliquid-live": "internal",
    "kraken-live": "internal", "coinbase-live": "internal", "gemini-live": "internal",
    "binanceus-live": "internal", "alpaca-live": "internal", "finnhub-live": "none",
    "exchanges-live": "none", "pyth": "none", "intrinio": "none", "massive-business": "none",
    "cboe-one": "none", "iex-tops": "none", "ecb_usd": "public", "oecd": "public",
    "eia_web": "public",
}

ACCESS = {
    "fred": "CSV download, or the FRED API with a free key", "french": "zip files from the data "
    "library", "yahoo": "unofficial chart endpoint, cross-check only", "derived": "built here "
    "from other series", "ecb": "SDMX REST API", "treasury": "CSV, one file per year",
    "bis": "SDMX REST API v2", "cftc": "Socrata API (CFTC Public Reporting)",
    "eia": "API v2 with a free key", "onchain": "log subscription to a public Base node",
    "coingecko-live": "REST, polled by our edge", "sec-tickers": "JSON file",
    "ecb_usd": "SDMX REST API, crossed to USD here", "oecd": "SDMX REST API (Data Explorer)",
    "eia_web": "XLS history pages, no key",
}

RATE_LIMITS = {
    "fred": "120 requests a minute with a key; we pause between requests",
    "ecb": "none published; we send one request per dataflow",
    "bis": "none published; we send one request per dataflow",
    "ecb_usd": "none published; we send one request per currency",
    "oecd": "none published; we send one request per dataflow",
    "eia_web": "none published; one file per product",
    "treasury": "we send one request a second", "cftc": "throttled without a token; we pause "
    "0.5 s", "eia": "about 5,000 requests an hour per key", "french": "none published",
    "onchain": "PublicNode free tier, limited per address",
    "coingecko-live": "about 30 calls a minute without a key",
    "kraken": "about 1 public request a second", "coinbase": "10 public requests a second",
    "gemini": "120 public requests a minute", "binanceus": "1,200 request weight a minute",
    "hyperliquid": "1,200 request weight a minute", "sec": "10 requests a second, with a "
    "contact in the user agent",
}

#: Sources the registry reads that providers.py does not list: the public instrument lists
#: of venues we already use (for discovery and daily history, team only like their live
#: feeds), the SEC's public fund lists, and the competitor collector's public posts.
EXTRA_SOURCES = [
    Source("kraken", "Kraken public REST", "internal", provider="Kraken",
           access_method="public REST: pair list and daily candles",
           licence="Use for your own benefit; no making content available to third parties",
           terms_url="https://www.kraken.com/legal/global-terms", terms_read_on=LIVE_READ,
           rate_limit=RATE_LIMITS["kraken"], status="team"),
    Source("coinbase", "Coinbase Exchange public REST", "internal", provider="Coinbase",
           access_method="public REST: product list", licence="No redistribution or display "
           "to third parties", terms_url="https://www.coinbase.com/legal/market_data",
           terms_read_on=LIVE_READ, rate_limit=RATE_LIMITS["coinbase"], status="team"),
    Source("gemini", "Gemini public REST", "internal", provider="Gemini",
           access_method="public REST: symbol list", licence="Personal and internal use "
           "allowed; redistribution needs an agreement",
           terms_url="https://www.gemini.com/legal/market-data-agreement",
           terms_read_on=LIVE_READ, rate_limit=RATE_LIMITS["gemini"], status="team"),
    Source("binanceus", "Binance.US public REST", "internal", provider="Binance.US",
           access_method="public REST: exchange info", licence="No public display",
           terms_url="https://www.binance.us/terms-of-use", terms_read_on=LIVE_READ,
           rate_limit=RATE_LIMITS["binanceus"], status="team"),
    Source("hyperliquid", "Hyperliquid public info API", "internal", provider="Hyperliquid",
           access_method="public REST: perp and spot lists", licence="Terms have no data "
           "clause; read for the team only (owner decision 25 Oct 2026)",
           terms_url="https://app.hyperliquid.xyz/terms", terms_read_on=LIVE_READ,
           rate_limit=RATE_LIMITS["hyperliquid"], status="team"),
    Source("sec", "SEC EDGAR data files", "public", provider="US Securities and Exchange "
           "Commission", access_method="yearly fund series and class list (CSV)",
           licence="Public information; cite the SEC",
           terms_url="https://www.sec.gov/privacy#dissemination", terms_read_on=REF_0015,
           rate_limit=RATE_LIMITS["sec"]),
    Source("competitors", "Competitor feedback collector", "none", provider="Public posts "
           "(CMP docs)", access_method="parity profiles collect, at most once a day",
           licence="Posts are read for counts by theme; no data series comes from them",
           terms_url="", note="requests for data people ask other products for"),
]

#: Live feeds (DEC-0052, DEC-0056, DEC-0063): one registry series per feed. The site's own
#: list is web/src/lib/live/sources.ts; a test checks the two agree.
LIVE_FEEDS = [
    ("onchain", "onchain", "Parity on-chain feed: 14 tokens on Base from every swap in the "
     "deepest pools", "crypto"),
    ("coingecko", "coingecko-live", "CoinGecko: the 100 largest coins, polled every 30 s",
     "crypto"),
    ("hyperliquid", "hyperliquid-live", "Hyperliquid trades, books and overview", "crypto"),
    ("kraken", "kraken-live", "Kraken trades, books and overview", "crypto"),
    ("coinbase", "coinbase-live", "Coinbase Exchange trades, books and overview", "crypto"),
    ("gemini", "gemini-live", "Gemini trades, books and overview", "crypto"),
    ("binanceus", "binanceus-live", "Binance.US trades, books and overview", "crypto"),
    ("alpaca", "alpaca-live", "Alpaca US stock and ETF trades (IEX on the free plan)", "equity"),
]
LIVE_PAGES = ("Parity Trade", "Parity Terminal", "Parity Workbench")


def _source_status(p: providers.Provider) -> str:
    st = providers.status(p)
    if st.startswith("on (team"):
        return "team"
    if "no key" in st:
        return "no key"
    if st.startswith("off") or st == "owner call":
        return "off"
    return "planned" if st == "planned" else "on"


def sources() -> list[Source]:
    out = []
    for p in providers.PROVIDERS:
        read = ONCHAIN_READ if p.id == "onchain" else LIVE_READ if p.live else REF_0015
        out.append(Source(
            p.id, p.name, SOURCE_RIGHTS.get(p.id, "none"), provider=p.name.split(",")[0],
            access_method=ACCESS.get(p.id, "WebSocket through our edge (web/live)" if p.live
                                     else "REST API (not built)" if p.planned else ""),
            licence=p.licence, terms_url=p.terms_url, terms_read_on=read if p.terms_url else None,
            cost=p.cost, rate_limit=RATE_LIMITS.get(p.id, ""), key_name=p.key_env,
            status=_source_status(p), note=p.note[:400]))
    return out + list(EXTRA_SOURCES)


def _backups() -> dict[str, str]:
    """A second source for the same thing, used when the first one dies (DEC-0064). Fed H.10
    currencies have ECB crosses; FRED Treasury yields have the Treasury's own curve."""
    out = {}
    for key in catalog.CATALOG:
        if key.startswith("fx.") and f"xfx.{key[3:]}" in catalog.CATALOG:
            out[key] = f"xfx.{key[3:]}"
    for a, b in (("bond.UST10Y", "curve.UST_10Y"), ("bond.UST2Y", "curve.UST_2Y"),
                 ("bond.UST30Y", "curve.UST_30Y"), ("rate.TBILL3M", "curve.UST_3M")):
        if a in catalog.CATALOG and b in catalog.CATALOG:
            out[a] = b
    return out


def catalog_records(coverage: dict | None = None) -> list[Record]:
    """One record per curated series, with dates from the last fetch when known."""
    from ..data import store
    from ..search import TRADABLE

    cov = {r["key"]: r for r in (coverage if coverage is not None else
                                 store.coverage()).get("series", [])}
    backups = _backups()
    out = []
    for s in catalog.CATALOG.values():
        tradable = s.key in TRADABLE
        lab = tags.label(s.key, s.description, s.frequency, tradable)
        extra = ("required",) if s.required else ()
        if s.published_after is not None or s.lag_days:
            extra += ("lagged",)
        if tradable:
            extra += ("tradable",)
        r = cov.get(s.key, {})
        right = rights.catalog_rights(s)
        out.append(Record(
            id=s.key, source_id=s.source, name=s.description[:400], frequency=s.frequency,
            status="enrolled", display_rights=right, code=s.code[:200],
            symbol=s.key.split(".", 1)[1][:60], asset_class=lab["asset_class"],
            region=lab["region"], units=lab["units"], start_date=r.get("first"),
            end_date=r.get("last"), published_after=s.published_after, lag_days=s.lag_days,
            tags=tags.tags_for(s.key, lab, extra), labels=_labels(lab), origin="catalog",
            intended_use="display" if s.site and right == "public" else "research",
            required=s.required, last_obs=r.get("last"), backup_id=backups.get(s.key)))
    return out


def _labels(lab: dict) -> dict:
    return {k: v for k, v in lab.items() if k not in ("asset_class", "region", "units")
            and v is not None}


def live_records() -> list[Record]:
    out = []
    for src, source_id, name, asset in LIVE_FEEDS:
        right = SOURCE_RIGHTS.get(source_id, "none")
        lab = {"asset_class": asset, "theme": "crypto" if asset == "crypto" else "equity",
               "frequency": "tick", "region": "global" if asset == "crypto" else "US"}
        out.append(Record(
            id=f"live.{src}", source_id=source_id, name=name, frequency="T", status="enrolled",
            display_rights=right, code=src, symbol=src, asset_class=asset,
            region=lab["region"], units="USD",
            tags=tags.tags_for(f"live.{src}", {**lab, "liquidity_tier": None},
                               ("live", "team" if right == "internal" else "public")),
            labels={"theme": lab["theme"], "frequency": "tick", "by": "rule"}, origin="live",
            intended_use="feed"))
    return out


def records(coverage: dict | None = None) -> list[Record]:
    return catalog_records(coverage) + live_records()


# ------------------------------------------------------------------ lineage

def lineage() -> list[tuple[str, str, str]]:
    """(series, kind, consumer) for every use the code makes of a series: strategies, the
    strategy search, site pages, derived series and live feeds."""
    from .. import strategies, terminal, world
    from ..scenarios import BASKET
    from ..search import GATE_SERIES, TRADABLE

    out: set[tuple[str, str, str]] = set()
    for name, cls in strategies.available().items():
        try:
            for key in cls().required():
                if key in catalog.CATALOG:
                    out.add((key, "strategy", name))
        except Exception:  # a strategy that needs arguments is skipped, never fatal
            continue
    for key in TRADABLE:
        if key in catalog.CATALOG:
            out.add((key, "search", "strategy search: asset"))
    for key in GATE_SERIES:
        out.add((key, "search", "strategy search: signal"))
    for s in catalog.CATALOG.values():
        out.add((s.key, "page", "Data page"))
        if terminal.allowed(s)[0]:
            out.add((s.key, "page", "Parity Terminal"))
        if s.source == "derived":
            for part in re.split(r"[+/]", s.code):
                if part in catalog.CATALOG:
                    out.add((part, "derived", s.key))
    world_keys = [c.key for c in world.CURRENCIES if c.key != "basket"] + list(BASKET)
    world_keys += [k for _, _, k in world.COMMODITIES + world.MONTHLY + world.PATH_EXTRAS]
    world_keys += [x[2] for x in world.PLAY_EXTRAS]
    for key in world_keys:
        if key in catalog.CATALOG:
            out.add((key, "page", "Sim World"))
    for src, *_ in LIVE_FEEDS:
        for page in LIVE_PAGES:
            out.add((f"live.{src}", "feed", page))
    return sorted(out)
