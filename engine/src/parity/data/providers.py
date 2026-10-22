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
    Provider("ecb_usd", "ECB Data Portal, crossed to USD", "Reuse allowed with the ECB named "
             "as the source", "https://www.ecb.europa.eu/services/disclaimer/html/index.en.html",
             note="USD per currency, from the euro reference rates (em_fx strategies)"),
    Provider("oecd", "OECD Data Explorer", "Free reuse with the OECD named (CC BY 4.0)",
             "https://www.oecd.org/en/about/terms-conditions.html",
             note="3-month interbank rates for emerging markets"),
    Provider("eia_web", "EIA history pages (no key)", "US government work, public domain",
             "https://www.eia.gov/about/copyrights_reuse.php",
             note="NYMEX energy futures contracts 1 to 3, published to 5 April 2024"),
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
]

BY_ID = {p.id: p for p in PROVIDERS}


def has_key(p: Provider) -> bool:
    """Whether the key variable is set. Never returns or prints the value."""
    return bool(p.key_env and os.environ.get(p.key_env, "").strip())


def status(p: Provider) -> str:
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
                    "licence": p.licence, "terms_url": p.terms_url, "note": p.note})
    return out
