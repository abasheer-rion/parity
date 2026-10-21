"""Every series the engine knows how to fetch.

Keys follow a simple pattern so strategies can ask for data without knowing where
it comes from:

    fx.<CCY>     USD value of one unit of the foreign currency (higher = foreign stronger)
    rate.<CCY>   3-month interbank rate, percent per year (monthly, forward filled)
    cmd.<NAME>   commodity price in USD
    eq.<NAME>    equity index or ETF level
    risk.<NAME>  risk gauges such as the VIX

To add a series, add one line here and note it in docs/reference/0003-data-sources.md.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Series:
    key: str
    source: str  # "fred" or "yahoo"
    code: str
    description: str
    invert: bool = False  # True when the source quotes foreign units per USD
    frequency: str = "D"  # "D" daily, "M" monthly


G10 = ["EUR", "GBP", "JPY", "CHF", "CAD", "AUD", "NZD", "NOK", "SEK"]

_FX = [
    Series("fx.EUR", "fred", "DEXUSEU", "USD per EUR (Fed H.10)"),
    Series("fx.GBP", "fred", "DEXUSUK", "USD per GBP (Fed H.10)"),
    Series("fx.JPY", "fred", "DEXJPUS", "JPY per USD, inverted", invert=True),
    Series("fx.CHF", "fred", "DEXSZUS", "CHF per USD, inverted", invert=True),
    Series("fx.CAD", "fred", "DEXCAUS", "CAD per USD, inverted", invert=True),
    Series("fx.AUD", "fred", "DEXUSAL", "USD per AUD (Fed H.10)"),
    Series("fx.NZD", "fred", "DEXUSNZ", "USD per NZD (Fed H.10)"),
    Series("fx.NOK", "fred", "DEXNOUS", "NOK per USD, inverted", invert=True),
    Series("fx.SEK", "fred", "DEXSDUS", "SEK per USD, inverted", invert=True),
]

_RATE_CODES = {
    "USD": "US",
    "EUR": "EZ",
    "GBP": "GB",
    "JPY": "JP",
    "CHF": "CH",
    "CAD": "CA",
    "AUD": "AU",
    "NZD": "NZ",
    "NOK": "NO",
    "SEK": "SE",
}

_RATES = [
    Series(f"rate.{ccy}", "fred", f"IR3TIB01{cc}M156N", f"{ccy} 3-month interbank rate (OECD)",
           frequency="M")
    for ccy, cc in _RATE_CODES.items()
]

_OTHER = [
    Series("cmd.WTI", "fred", "DCOILWTICO", "WTI crude oil, USD per barrel"),
    Series("cmd.BRENT", "fred", "DCOILBRENTEU", "Brent crude oil, USD per barrel"),
    Series("cmd.HH_GAS", "fred", "DHHNGSP", "Henry Hub natural gas, USD per MMBtu"),
    Series("cmd.COPPER", "fred", "PCOPPUSDM", "Copper, USD per metric ton (IMF, monthly)",
           frequency="M"),
    Series("eq.SPY", "yahoo", "SPY", "SPY ETF, adjusted close (dividends reinvested)"),
    Series("eq.SPX", "fred", "SP500", "S&P 500 price index, last 10 years only, no dividends"),
    Series("risk.VIX", "fred", "VIXCLS", "CBOE VIX close"),
]

CATALOG: dict[str, Series] = {s.key: s for s in _FX + _RATES + _OTHER}


def get(key: str) -> Series:
    try:
        return CATALOG[key]
    except KeyError as exc:
        raise KeyError(f"Unknown series '{key}'. Add it to parity/data/catalog.py.") from exc
