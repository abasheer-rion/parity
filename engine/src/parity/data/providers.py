"""Every data provider we use or plan to use, with its key, licence and status.

`parity data sources` prints this list. A provider is "on" when it has a fetcher and
either needs no key or has its key set. "planned" providers have no fetcher yet; they
are listed so the owner can see what each key would add (REF-0015).

Keys are read by name from the environment, never stored in the repo, and never
printed. The owner fills them from the macOS Keychain, for example:

    export EIA_API_KEY=$(security find-generic-password -s EIA_API_KEY -w)

A keyed fetcher calls `sources.api_key(ENV)`, which raises `sources.MissingKey` when
the variable is empty. `parity fetch` then reports the series as skipped, not failed,
and leaves it out of coverage.json.
"""

from __future__ import annotations

import os
from dataclasses import dataclass

from . import catalog, sources


@dataclass(frozen=True)
class Provider:
    id: str  # matches Series.source for providers with a fetcher
    name: str
    licence: str  # short summary; the full terms are in REF-0015
    terms_url: str
    key_env: str | None = None  # environment variable holding the key, if any
    key_required: bool = False  # False: the key only raises limits (FRED)
    planned: bool = False  # no fetcher yet
    cost: str = "free"
    note: str = ""
    # Live data (DEC-0052): how fresh it reaches a screen, and whether it is switched on in the
    # site's fan-out (web/live/). "live" sources are not fetched by the engine at all.
    # feed: "real-time", "delayed about N min" or "end of day"; empty for research series.
    # live: "on", "team" (terms allow internal use only: team members only, DEC-0053), "ask"
    # (terms unclear, the owner decides) or "off" (forbidden or contract).
    feed: str = ""
    live: str = ""


PROVIDERS: list[Provider] = [
    Provider("fred", "FRED, St. Louis Fed", "Free; third-party series keep their owners' "
             "copyright, so check each series' tag", "https://fred.stlouisfed.org/legal/",
             key_env="FRED_API_KEY",
             note="works without a key through the CSV link, but FRED's terms prefer the "
                  "API, so a free key is the first one to get"),
    Provider("french", "Kenneth French data library", "Free for research use",
             "https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/data_library.html"),
    Provider("yahoo", "Yahoo chart endpoint", "Terms forbid automated collection; "
             "cross-check only, never in results", "https://legal.yahoo.com/us/en/yahoo/terms/"
             "otos/index.html"),
    Provider("derived", "Built from other series", "Inherits its inputs' terms", ""),
    Provider("ecb", "ECB Data Portal", "Reuse allowed with the ECB named as the source",
             "https://www.ecb.europa.eu/services/disclaimer/html/index.en.html"),
    Provider("treasury", "US Treasury daily par yield curve", "US government work, "
             "public domain", "https://home.treasury.gov/policy-issues/financing-the-"
             "government/interest-rate-statistics"),
    Provider("bis", "BIS data portal", "Reuse allowed with the BIS named; not misleading, "
             "no endorsement implied", "https://data.bis.org/help/legal"),
    Provider("cftc", "CFTC Commitments of Traders", "US government work, public domain",
             "https://www.cftc.gov/WebPolicy/index.htm"),
    Provider("eia", "EIA API v2", "US government work, public domain",
             "https://www.eia.gov/about/copyrights_reuse.php", key_env="EIA_API_KEY",
             key_required=True, note="free key from eia.gov/opendata"),
    # Planned: keyed providers we may add. Prices and terms are in REF-0015.
    Provider("alphavantage", "Alpha Vantage", "Free plan for personal use; display needs a "
             "licence", "https://www.alphavantage.co/terms_of_service/",
             key_env="ALPHAVANTAGE_API_KEY", key_required=True, planned=True,
             cost="free (25 calls a day) or paid"),
    Provider("twelvedata", "Twelve Data", "Free plan for personal use; display needs a "
             "business plan", "https://twelvedata.com/terms", key_env="TWELVEDATA_API_KEY",
             key_required=True, planned=True, cost="free (800 calls a day) or paid"),
    Provider("tiingo", "Tiingo", "Internal use only; showing the data needs a "
             "redistribution licence from 250 USD a month",
             "https://www.tiingo.com/documentation/general/overview",
             key_env="TIINGO_API_KEY", key_required=True, planned=True,
             cost="free (1,000 calls a day) or 30 USD a month"),
    Provider("massive", "Massive (formerly Polygon.io)", "Individual plans are for "
             "personal, non-display use",
             "https://massive.com/legal/individuals-terms-of-service",
             key_env="MASSIVE_API_KEY", key_required=True, planned=True,
             cost="free (5 calls a minute) or paid"),
    Provider("fmp", "Financial Modeling Prep", "Personal use on individual plans; display "
             "needs a data display licence", "https://site.financialmodelingprep.com/terms-"
             "of-service", key_env="FMP_API_KEY", key_required=True, planned=True,
             cost="free (250 calls a day) or paid"),
    Provider("finnhub", "Finnhub", "Personal use only on every listed plan",
             "https://finnhub.io/terms-of-service", key_env="FINNHUB_API_KEY",
             key_required=True, planned=True, cost="free (60 calls a minute) or paid"),
    Provider("nasdaqdatalink", "Nasdaq Data Link", "Per dataset; most premium data is "
             "personal use only", "https://data.nasdaq.com/",
             key_env="NASDAQ_DATA_LINK_API_KEY", key_required=True, planned=True,
             cost="free datasets or per dataset"),
    Provider("databento", "Databento (CME futures and options)", "Licensed per dataset; "
             "display needs a separate licence", "https://databento.com/pricing",
             key_env="DATABENTO_API_KEY", key_required=True, planned=True,
             cost="125 USD credit, then usage or plans"),
    Provider("oanda", "OANDA v20 practice account", "API licence bans showing rates to "
             "anyone else", "https://legal.oanda.com/oc/api_license_agreement_oc/en",
             key_env="OANDA_API_TOKEN", key_required=True, planned=True,
             cost="free practice account"),
    Provider("bls", "BLS API v2", "US government work, public domain",
             "https://www.bls.gov/developers/termsOfService.htm", key_env="BLS_API_KEY",
             planned=True, note="works without a key at lower limits"),
    Provider("bea", "BEA API", "US government work, public domain",
             "https://apps.bea.gov/API/signup/", key_env="BEA_API_KEY", key_required=True,
             planned=True),
    # Live data for Trade, the Terminal and the Workbench (DEC-0052). Terms read 25 Oct 2026;
    # the site's copy of this list is web/src/lib/live/sources.ts.
    Provider("coingecko-live", "CoinGecko, streamed through our edge", "Display allowed with "
             "\"Data provided by CoinGecko\" linked next to the data",
             "https://www.coingecko.com/en/api_terms", feed="delayed about 1 min", live="on",
             note="the 100 largest coins, polled every 30 seconds while anyone watches"),
    Provider("sec-tickers", "SEC company tickers", "Public information; cite the SEC",
             "https://www.sec.gov/privacy", feed="end of day", live="on",
             note="every US-listed symbol for search, no prices"),
    # Team only (DEC-0053): terms allow internal use, so these stream only to team members.
    Provider("hyperliquid-live", "Hyperliquid trades, books and overview, every perp and spot pair",
             "Terms have no data clause; read for the team only, never shown to the public",
             "https://app.hyperliquid.xyz/terms", feed="real-time", live="team",
             note="team only; owner decision 25 Oct 2026"),
    Provider("kraken-live", "Kraken trades, books and overview, every spot and fiat pair",
             "Use for your own benefit; no making content available to third parties",
             "https://www.kraken.com/legal/global-terms", feed="real-time", live="team",
             note="team only; public display needs written consent"),
    Provider("coinbase-live", "Coinbase Exchange trades, books and overview", "No redistribution "
             "or display to third parties", "https://www.coinbase.com/legal/market_data",
             feed="real-time", live="team", note="team only"),
    Provider("gemini-live", "Gemini trades, books and overview", "Personal and internal use "
             "allowed; redistribution needs an agreement",
             "https://www.gemini.com/legal/market-data-agreement", feed="real-time", live="team",
             note="team only"),
    Provider("binanceus-live", "Binance.US trades, books and overview", "No public display",
             "https://www.binance.us/terms-of-use", feed="real-time", live="team",
             note="team only"),
    Provider("alpaca-live", "Alpaca Market Data, US stocks and ETFs (IEX free, SIP paid)",
             "The account holder's own subscription, team only", "https://alpaca.markets/data",
             key_env="ALPACA_KEY_ID", key_required=True, feed="real-time", live="team",
             cost="free (IEX, 30 symbols) or 99 USD a month (Algo Trader Plus, every exchange)",
             note="also needs ALPACA_SECRET_KEY; set both as Pages and worker secrets"),
    Provider("finnhub-live", "Finnhub US stock trades", "Free plan is personal use only; "
             "business use needs a paid plan or written approval",
             "https://finnhub.io/terms-of-service", key_env="FINNHUB_TOKEN", key_required=True,
             feed="real-time", live="team", note="only with a plan that allows business use"),
    Provider("exchanges-live", "Bitstamp, Bitfinex, Binance, OKX, Bybit, Deribit and others",
             "Each forbids display, is personal use only, or bars the US",
             "https://www.bitstamp.net/terms-of-use/", feed="real-time", live="off"),
    Provider("pyth", "Pyth Network", "Every request needs a key since 26 Aug 2026; display "
             "rights on paid plans", "https://www.pyth.network/pricing", key_env="PYTH_API_KEY",
             key_required=True, planned=True, feed="real-time", live="off",
             cost="500 USD a month (crypto) or 2,500 USD (all assets, limited redistribution)"),
    Provider("intrinio", "Intrinio Startup (Cboe One, 15 min delayed)", "Display included, no "
             "exchange paperwork", "https://intrinio.com/pricing", key_env="INTRINIO_API_KEY",
             key_required=True, planned=True, feed="delayed 15 min", live="off",
             cost="333 USD a month for 6 months, 666 for the next 6, then 999"),
    Provider("massive-business", "Massive Stocks Business", "Business plan with display rights",
             "https://massive.com/business", key_env="VENDOR_KEY", key_required=True,
             planned=True, feed="real-time or delayed 15 min", live="off",
             cost="2,499 USD a month plus 499 (delayed) or 1,999 (real-time)"),
    Provider("cboe-one", "Cboe One direct", "External distribution licence",
             "https://www.cboe.com/market_data_services/us/equities/cboe_one/", planned=True,
             feed="real-time", live="off", cost="5,000 USD a month plus 0.25 per user"),
    Provider("iex-tops", "IEX TOPS", "Delayed free through a vendor; real-time licensed",
             "https://iextrading.com/trading/market-data/", planned=True,
             feed="real-time (IEX trades only)", live="off", cost="1,000 USD a month real-time"),
]

BY_ID = {p.id: p for p in PROVIDERS}


def has_key(p: Provider) -> bool:
    """Whether the key variable is set. Never returns or prints the value."""
    return bool(p.key_env and os.environ.get(p.key_env, "").strip())


def status(p: Provider) -> str:
    if p.live and not p.planned:
        if p.live == "team" and p.key_required and not has_key(p):
            return "team, no key"
        return {"on": "on (live)", "team": "on (team only)", "ask": "owner call",
                "off": "off (terms)"}.get(p.live, p.live)
    if p.planned or p.id not in sources.FETCHERS and p.id != "derived":
        return "planned"
    if p.key_required and not has_key(p):
        return "off (no key)"
    return "on"


def rows() -> list[dict]:
    counts: dict[str, int] = {}
    for s in catalog.CATALOG.values():
        counts[s.source] = counts.get(s.source, 0) + 1
    out = []
    for p in PROVIDERS:
        key = "-" if not p.key_env else (
            f"{p.key_env} ({'set' if has_key(p) else 'not set'}"
            f"{'' if p.key_required else ', optional'})")
        out.append({"id": p.id, "name": p.name, "status": status(p),
                    "series": counts.get(p.id, 0), "key": key, "cost": p.cost,
                    "licence": p.licence, "terms_url": p.terms_url, "note": p.note,
                    "feed": p.feed, "live": p.live})
    return out
