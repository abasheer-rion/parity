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
    source: str  # "fred", "yahoo", "french" or "derived"
    code: str
    description: str
    invert: bool = False  # True when the source quotes foreign units per USD
    frequency: str = "D"  # "D" daily, "M" monthly
    required: bool = True  # official runs fail if a required series cannot be fetched
    #: Monthly averages dated the 1st are only known after the month ends. When set, the
    #: panel moves each value to the month's end plus this many business days, the day it
    #: could first be read. None keeps the source's own dates.
    published_after: int | None = None


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
    Series("cmd.COPPER", "fred", "PCOPPUSDM", "Copper, USD per metric ton (IMF, monthly "
           "average, used from a week after the month ends)", frequency="M", published_after=5),
    Series("eq.US_MKT", "french", "F-F_Research_Data_Factors_daily",
           "US stock market total return index (Fama and French, all US stocks, dividends "
           "included), 1926 on, updated monthly with a lag of about two months"),
    Series("eq.SPX", "fred", "SP500", "S&P 500 price index, last 10 years only, no dividends"),
    Series("eq.US_TOTAL", "derived", "eq.US_MKT+eq.SPX",
           "Benchmark: Fama and French US market total return, extended to the latest day "
           "with S&P 500 price returns plus the recent dividend yield. See DEC-0008."),
    Series("eq.SPY", "yahoo", "SPY", "SPY ETF, adjusted close; cross-check only, not used in "
           "results (Yahoo's terms do not allow automated collection)", required=False),
    Series("risk.VIX", "fred", "VIXCLS", "CBOE VIX close"),
    Series("bond.UST10Y", "fred", "DGS10", "US 10-year Treasury yield, percent"),
    Series("rate.TBILL3M", "fred", "DTB3", "US 3-month Treasury bill rate, percent"),
]

_REER = [
    Series(f"reer.{ccy}", "fred", f"RB{cc}BIS", f"{ccy} real broad effective exchange rate (BIS), "
           "monthly, released with a lag of about six weeks", frequency="M")
    for ccy, cc in {"USD": "US", "EUR": "XM", "JPY": "JP", "GBP": "GB", "CHF": "CH",
                    "CAD": "CA", "AUD": "AU", "NZD": "NZ", "NOK": "NO", "SEK": "SE"}.items()
]

# More currencies from the Fed's H.10 release, for strategies that need a wider
# universe. No matching interbank rates, so the backtester books no carry on them.
# Optional: an official run does not fail if one is missing.
EM = ["MXN", "BRL", "KRW", "INR", "ZAR", "SGD", "CNY", "HKD", "DKK", "THB", "TWD", "MYR"]
_EM_CODES = {"MXN": "DEXMXUS", "BRL": "DEXBZUS", "KRW": "DEXKOUS", "INR": "DEXINUS",
             "ZAR": "DEXSFUS", "SGD": "DEXSIUS", "CNY": "DEXCHUS", "HKD": "DEXHKUS",
             "DKK": "DEXDNUS", "THB": "DEXTHUS", "TWD": "DEXTAUS", "MYR": "DEXMAUS"}
_FX_WIDE = [Series(f"fx.{c}", "fred", code, f"{c} per USD (Fed H.10), inverted", invert=True,
                   required=False) for c, code in _EM_CODES.items()]

_YIELDS = [
    Series("bond.UST2Y", "fred", "DGS2", "US 2-year Treasury yield, percent", required=False),
    Series("bond.UST30Y", "fred", "DGS30", "US 30-year Treasury yield, percent (gap 2002-2006)",
           required=False),
]

# Kenneth French's data library, free for research use. Each factor is a long-short,
# zero-cost portfolio turned into an index from its daily returns; each industry is a
# value-weighted total return index. The code is "<file>#<column>".
FACTORS = {"SMB": "F-F_Research_Data_Factors_daily", "HML": "F-F_Research_Data_Factors_daily",
           "MOM": "F-F_Momentum_Factor_daily", "RMW": "F-F_Research_Data_5_Factors_2x3_daily",
           "CMA": "F-F_Research_Data_5_Factors_2x3_daily", "STREV": "F-F_ST_Reversal_Factor_daily",
           "LTREV": "F-F_LT_Reversal_Factor_daily"}
_FACTOR_COLS = {"SMB": "SMB", "HML": "HML", "MOM": "Mom", "RMW": "RMW", "CMA": "CMA",
                "STREV": "ST_Rev", "LTREV": "LT_Rev"}
_FACTOR_NAMES = {"SMB": "small minus big (size)", "HML": "high minus low book to market (value)",
                 "MOM": "winners minus losers (momentum)", "RMW": "robust minus weak profitability",
                 "CMA": "conservative minus aggressive investment",
                 "STREV": "short-term reversal", "LTREV": "long-term reversal"}
_FACTORS = [Series(f"factor.{k}", "french", f"{FACTORS[k]}#{_FACTOR_COLS[k]}",
                   f"US {_FACTOR_NAMES[k]} factor, daily long-short return index (French)",
                   required=False) for k in FACTORS]

INDUSTRIES = ["NoDur", "Durbl", "Manuf", "Enrgy", "Chems", "BusEq", "Telcm", "Utils", "Shops",
              "Hlth", "Money", "Other"]
_INDUSTRIES = [Series(f"ind.{k}", "french", f"12_Industry_Portfolios_daily#{k}",
                      f"US {k} industry, value-weighted total return index (French 12 industries)",
                      required=False) for k in INDUSTRIES]

# Treasury total return indexes rebuilt from constant-maturity yields: each day earns
# the yield plus duration times the yield change. A standard approximation, good to a
# few tenths of a percent a year; real bond funds differ.
_BOND_TR = [
    Series("bond.TR10", "derived", "bond.UST10Y", "US 10-year Treasury total return index, "
           "approximated from the yield with a modified duration of 8", required=False),
    Series("bond.TR2", "derived", "bond.UST2Y", "US 2-year Treasury total return index, "
           "approximated from the yield with a modified duration of 1.9", required=False),
]
BOND_DURATION = {"bond.TR10": 8.0, "bond.TR2": 1.9}

CATALOG: dict[str, Series] = {s.key: s for s in _FX + _RATES + _OTHER + _REER + _FX_WIDE
                              + _YIELDS + _FACTORS + _INDUSTRIES + _BOND_TR}


def get(key: str) -> Series:
    try:
        return CATALOG[key]
    except KeyError as exc:
        raise KeyError(f"Unknown series '{key}'. Add it to parity/data/catalog.py.") from exc
