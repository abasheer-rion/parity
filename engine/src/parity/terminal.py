"""Parity Terminal: every series we may show, as small static files for a market monitor.

``parity terminal export`` writes ``<out>/terminal/index.json`` (one row per series with
its latest value, changes, volatility, a z-score, where it sits in its past year and a
weekly sparkline) and ``<out>/terminal/s/<key>.json`` (the history of one series, loaded
when a person opens it). The contract is in the Parity Terminal decision.

Only sources whose terms allow showing the data on the site are exported (REF-0010,
REF-0014, REF-0015, DEC-0019). ``TERMS`` below holds the source, the licence in plain
words and whether the site may show it, for every source the catalog uses. A series is
also left out when the catalog marks it ``site=False`` or ``EXCLUDED`` names it.

History is weekly (the last close of each week, dated the Friday) before 2016 and daily
from 2016 on. Monthly and weekly series stay as they are, each value dated the day it
could first be read (monthly averages after the month ends, COT on its release day).
"""

from __future__ import annotations

import json
import math
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from pathlib import Path

import numpy as np
import pandas as pd

from .data import catalog, store

DAILY_FROM = pd.Timestamp("2016-01-01")
SPARK_WEEKS = 52

# ---------------------------------------------------------------- sources and licences

#: Every source the terminal can meet: (source, licence in plain words, may the site show it).
#: The keys are catalog providers, with FRED split by the agency behind each series.
TERMS: dict[str, tuple[str, str, bool]] = {
    "fred.h10": ("FRED (Federal Reserve H.10)", "Public domain, US government data", True),
    "fred.h15": ("FRED (Federal Reserve H.15)", "Public domain, US government data", True),
    "fred.fed": ("FRED (Federal Reserve)", "Public domain, US government data", True),
    "fred.treasury": ("FRED (US Treasury)", "Public domain, US government data", True),
    "fred.eia": ("FRED (US Energy Information Administration)",
                 "Public domain, US government data; EIA names Refinitiv as the source of "
                 "its spot prices", True),
    "fred.oecd": ("FRED (OECD)", "Free to reuse with the OECD named", True),
    "fred.bis": ("FRED (BIS)", "Free to reuse with the BIS named", True),
    "fred.cboe": ("FRED (Cboe)", "Shown with citation; Cboe reprints it on FRED with "
                  "permission", True),
    "fred.chicagofed": ("FRED (Chicago Fed)", "Free to reuse with the source named", True),
    "fred.stlfed": ("FRED (St. Louis Fed)", "Free to reuse with the source named", True),
    "fred.nyfed": ("FRED (New York Fed)", "Free to reuse with the source named", True),
    "fred.labor": ("FRED (US Labor Department)", "Public domain, US government data", True),
    "fred.imf": ("FRED (IMF)", "The IMF asks permission before commercial reuse, so not "
                 "shown", False),
    "fred.sp": ("FRED (S&P Dow Jones Indices)", "The owner forbids redistribution, so not "
                "shown", False),
    "french": ("Kenneth French data library", "Free for research use, Kenneth French data "
               "library named", True),
    "derived.bonds": ("Parity, from FRED Treasury yields", "Built from public domain US "
                      "government data", True),
    "derived.sp": ("Parity, French plus S&P 500", "Uses S&P 500 price returns, whose owner "
                   "forbids redistribution, so not shown", False),
    "yahoo": ("Yahoo Finance", "Cross-check only; Yahoo's terms do not allow automated "
              "collection, so not shown", False),
    "ecb": ("European Central Bank", "Free to reuse with the ECB named", True),
    "treasury": ("US Treasury", "Public domain, US government data", True),
    "bis": ("BIS", "Free to reuse with the BIS named, without implying endorsement", True),
    "cftc": ("CFTC Commitments of Traders", "Public domain, US government data", True),
    "eia": ("US Energy Information Administration", "Public domain, US government data",
            True),
    "coingecko": ("CoinGecko", "Free to show with the line \"Data provided by CoinGecko\"; "
                  "no resale", True),
    "hyperliquid": ("Hyperliquid", "Display rights still an open question (DEC-0018), so "
                    "not shown", False),
    "coinbase": ("Coinbase", "Terms forbid showing it, so not shown", False),
}

#: FRED series by the agency behind them: an exact key first, then the key's prefix.
_FRED_AGENCY = {
    "fx": "fred.h10", "rate": "fred.oecd", "rate.TBILL3M": "fred.h15", "bond": "fred.h15",
    "cmd": "fred.imf", "cmd.WTI": "fred.eia", "cmd.BRENT": "fred.eia",
    "cmd.HH_GAS": "fred.eia", "eq.SPX": "fred.sp", "risk.VIX": "fred.cboe",
    "reer": "fred.bis", "spread": "fred.treasury", "infl": "fred.treasury",
    "credit": "fred.treasury", "usd": "fred.fed", "money": "fred.fed",
    "risk.NFCI": "fred.chicagofed", "risk.STLFSI": "fred.stlfed",
    "macro.CLAIMS": "fred.labor", "macro.WEI": "fred.nyfed",
}

#: Series left out even though their source is allowed, with the reason.
EXCLUDED = {
    "eq.US_TOTAL": "derived.sp",
}


def terms_for(s: catalog.Series) -> str:
    """The TERMS key for a catalog series."""
    if s.key in EXCLUDED:
        return EXCLUDED[s.key]
    if s.source == "fred":
        prefix = s.key.split(".", 1)[0]
        return _FRED_AGENCY.get(s.key) or _FRED_AGENCY.get(prefix, "fred.fed")
    if s.source == "derived":
        return "derived.bonds" if s.key in catalog.BOND_DURATION else "derived.sp"
    return s.source


def allowed(s: catalog.Series) -> tuple[bool, str]:
    """May the site show this series, and if not, why."""
    if not s.site:
        return False, "catalog keeps it off the site"
    term = TERMS.get(terms_for(s))
    if term is None:
        return False, f"no terms recorded for source {terms_for(s)}"
    return term[2], term[1]


# ---------------------------------------------------------------- groups and names

GROUPS = [
    ("fx_g10", "FX: G10", "fx"),
    ("fx_wider", "FX: wider", "fx"),
    ("ecb", "FX: ECB reference rates", "fx"),
    ("fx_index", "FX: dollar and real effective indexes", "fx"),
    ("ust_curve", "Rates: US Treasury curve", "rates"),
    ("euro_curve", "Rates: euro curve", "rates"),
    ("policy", "Rates: policy and money markets", "rates"),
    ("commodities", "Commodities", "commodities"),
    ("us_equities", "US equities", "equities"),
    ("industries", "US industries", "equities"),
    ("factors", "US factors", "equities"),
    ("crypto", "Crypto", "crypto"),
    ("perps", "Perpetual futures", "crypto"),
    ("positioning", "Positioning (CFTC)", "positioning"),
    ("macro", "Macro", "macro"),
]
_GROUP_CLASS = {g: c for g, _, c in GROUPS}

CCY_NAMES = {
    "USD": "US dollar", "EUR": "Euro", "GBP": "British pound", "JPY": "Japanese yen",
    "CHF": "Swiss franc", "CAD": "Canadian dollar", "AUD": "Australian dollar",
    "NZD": "New Zealand dollar", "NOK": "Norwegian krone", "SEK": "Swedish krona",
    "DKK": "Danish krone", "CZK": "Czech koruna", "HUF": "Hungarian forint",
    "PLN": "Polish zloty", "RON": "Romanian leu", "ISK": "Icelandic krona",
    "TRY": "Turkish lira", "BRL": "Brazilian real", "CNY": "Chinese yuan",
    "HKD": "Hong Kong dollar", "IDR": "Indonesian rupiah", "ILS": "Israeli shekel",
    "INR": "Indian rupee", "KRW": "South Korean won", "MXN": "Mexican peso",
    "MYR": "Malaysian ringgit", "PHP": "Philippine peso", "SGD": "Singapore dollar",
    "THB": "Thai baht", "ZAR": "South African rand", "TWD": "Taiwan dollar",
    "CLP": "Chilean peso", "COP": "Colombian peso", "PEN": "Peruvian sol",
    "SAR": "Saudi riyal",
}
INDUSTRY_NAMES = {"NoDur": "Consumer staples", "Durbl": "Consumer durables",
                  "Manuf": "Manufacturing", "Enrgy": "Energy", "Chems": "Chemicals",
                  "BusEq": "Business equipment (tech)", "Telcm": "Telecoms",
                  "Utils": "Utilities", "Shops": "Retail", "Hlth": "Health care",
                  "Money": "Finance", "Other": "Other industries"}
FACTOR_NAMES = {"SMB": "Size (small minus big)", "HML": "Value (cheap minus dear)",
                "MOM": "Momentum (winners minus losers)", "RMW": "Profitability",
                "CMA": "Investment (careful minus aggressive)", "STREV": "Short-term reversal",
                "LTREV": "Long-term reversal"}
#: CoinGecko id: (symbol, name). The coins with a year of daily history (markets.sources).
COINS = {"bitcoin": ("BTC", "Bitcoin"), "ethereum": ("ETH", "Ether"),
         "solana": ("SOL", "Solana"), "ripple": ("XRP", "XRP"),
         "binancecoin": ("BNB", "BNB"), "dogecoin": ("DOGE", "Dogecoin"),
         "cardano": ("ADA", "Cardano"), "tron": ("TRX", "Tron"),
         "chainlink": ("LINK", "Chainlink"), "avalanche-2": ("AVAX", "Avalanche"),
         "sui": ("SUI", "Sui"), "hyperliquid": ("HYPE", "Hyperliquid")}
COINGECKO_ATTRIBUTION = ("Data provided by CoinGecko", "https://www.coingecko.com")

#: Plain names, short codes and units for the series the rules below do not cover.
_FIXED = {
    # key: (label, short, unit, kind, group)
    "rate.TBILL3M": ("US 3-month Treasury bill", "TBILL", "%", "level", "ust_curve"),
    "bond.UST2Y": ("US 2-year Treasury yield", "UST2Y", "%", "level", "ust_curve"),
    "bond.UST10Y": ("US 10-year Treasury yield", "UST10Y", "%", "level", "ust_curve"),
    "bond.UST30Y": ("US 30-year Treasury yield", "UST30Y", "%", "level", "ust_curve"),
    "bond.TR2": ("US 2-year Treasuries, total return", "UST2TR", "index", "price",
                 "ust_curve"),
    "bond.TR10": ("US 10-year Treasuries, total return", "UST10TR", "index", "price",
                  "ust_curve"),
    "bond.TIPS5Y": ("US 5-year real yield (TIPS)", "TIPS5Y", "%", "level", "ust_curve"),
    "bond.TIPS10Y": ("US 10-year real yield (TIPS)", "TIPS10Y", "%", "level", "ust_curve"),
    "spread.UST_2S10S": ("US 10-year minus 2-year yield", "2S10S", "percentage points",
                         "level", "ust_curve"),
    "spread.UST_3M10Y": ("US 10-year minus 3-month yield", "3M10Y", "percentage points",
                         "level", "ust_curve"),
    "infl.BE5Y": ("US 5-year breakeven inflation", "BE5Y", "%", "level", "ust_curve"),
    "infl.BE10Y": ("US 10-year breakeven inflation", "BE10Y", "%", "level", "ust_curve"),
    "infl.FWD5Y5Y": ("US 5y5y forward inflation", "FWD5Y5Y", "%", "level", "ust_curve"),
    "credit.HQM10Y": ("US 10-year high quality corporate yield", "HQM10Y", "%", "level",
                      "ust_curve"),
    "money.EFFR": ("Effective federal funds rate", "EFFR", "%", "level", "policy"),
    "money.ESTR": ("Euro short-term rate (€STR)", "ESTR", "%", "level", "euro_curve"),
    "money.CP3M_FIN": ("3-month financial commercial paper", "CPFIN", "%", "level",
                       "policy"),
    "money.CP3M_NONFIN": ("3-month nonfinancial commercial paper", "CPNONFIN", "%", "level",
                          "policy"),
    "usd.BROAD": ("US dollar, broad index (Fed)", "USDBROAD", "index", "price", "fx_index"),
    "usd.AFE": ("US dollar against advanced economies (Fed)", "USDAFE", "index", "price",
                "fx_index"),
    "usd.EME": ("US dollar against emerging economies (Fed)", "USDEME", "index", "price",
                "fx_index"),
    "cmd.WTI": ("Oil, WTI", "WTI", "USD per barrel", "price", "commodities"),
    "cmd.BRENT": ("Oil, Brent", "BRENT", "USD per barrel", "price", "commodities"),
    "cmd.HH_GAS": ("US natural gas, Henry Hub", "GAS", "USD per MMBtu", "price",
                   "commodities"),
    "cmd.COPPER": ("Copper", "COPPER", "USD per metric ton", "price", "commodities"),
    "eq.US_MKT": ("US stock market, total return (all US stocks)", "USMKT", "index",
                  "price", "us_equities"),
    "eq.SPX": ("S&P 500", "SPX", "index", "price", "us_equities"),
    "eq.SPY": ("SPY ETF", "SPY", "USD", "price", "us_equities"),
    "eq.US_TOTAL": ("US stocks, total return, extended", "USTOTAL", "index", "price",
                    "us_equities"),
    "risk.VIX": ("VIX (fear gauge)", "VIX", "index", "level", "us_equities"),
    "risk.NFCI": ("Chicago Fed financial conditions", "NFCI", "index", "level", "macro"),
    "risk.STLFSI": ("St. Louis Fed financial stress", "STLFSI", "index", "level", "macro"),
    "macro.CLAIMS": ("US initial jobless claims", "CLAIMS", "claims", "level", "macro"),
    "macro.WEI": ("NY Fed weekly economic index", "WEI", "index", "level", "macro"),
    "eia.CRUDE_STOCKS": ("US crude oil stocks", "CRUDESTK", "thousand barrels", "level",
                         "commodities"),
    "eia.CUSHING": ("Crude stocks at Cushing", "CUSHING", "thousand barrels", "level",
                    "commodities"),
    "eia.GASOLINE_STOCKS": ("US gasoline stocks", "GASOLSTK", "thousand barrels", "level",
                            "commodities"),
    "eia.DISTILLATE_STOCKS": ("US distillate stocks", "DISTSTK", "thousand barrels",
                              "level", "commodities"),
    "eia.SPR": ("US Strategic Petroleum Reserve", "SPR", "thousand barrels", "level",
                "commodities"),
    "eia.REFINERY_UTIL": ("US refinery utilisation", "REFUTIL", "%", "level",
                          "commodities"),
    "eia.CRUDE_OUTPUT": ("US crude oil output", "CRUDEOUT", "thousand barrels a day",
                         "level", "commodities"),
    "eia.GAS_STORAGE": ("US natural gas in storage", "GASSTOR", "billion cubic feet",
                        "level", "commodities"),
}


@dataclass(frozen=True)
class Entry:
    key: str
    label: str
    short: str
    group: str
    cls: str
    source: str
    licence: str
    kind: str  # "price" or "level"
    unit: str
    freq: str
    published_after: int | None = None
    lag_days: int = 0
    attribution: str | None = None
    attribution_url: str | None = None


def _describe(s: catalog.Series) -> tuple[str, str, str, str, str]:
    """(label, short, unit, kind, group) for a catalog series."""
    if s.key in _FIXED:
        return _FIXED[s.key]
    prefix, name = s.key.split(".", 1)
    ccy = CCY_NAMES.get(name, name)
    if prefix == "fx":
        group = "fx_g10" if name in catalog.G10 else "fx_wider"
        return ccy, name, f"USD per {name}", "price", group
    if prefix == "ecb":
        return f"{ccy} per euro (ECB)", f"ECB{name}", f"{name} per EUR", "price", "ecb"
    if prefix == "reer":
        return f"{ccy}, real effective rate (BIS)", f"REER{name}", "index", "price", \
            "fx_index"
    if prefix == "rate":
        return f"{ccy} 3-month interbank rate", f"{name}3M", "%", "level", "policy"
    if prefix == "policy":
        return f"{ccy} policy rate", f"POL{name}", "%", "level", "policy"
    if prefix == "curve":
        area, tenor = name.rsplit("_", 1)
        if area == "UST":
            return f"US Treasury {tenor} par yield", f"PAR{tenor}", "%", "level", "ust_curve"
        return f"Euro area AAA {tenor} yield", f"EA{tenor}", "%", "level", "euro_curve"
    if prefix == "ind":
        return f"US {INDUSTRY_NAMES.get(name, name).lower()}", name.upper(), "index", \
            "price", "industries"
    if prefix == "factor":
        return FACTOR_NAMES.get(name, name), name, "index", "price", "factors"
    if prefix == "cot":
        pct = name.endswith("_PCT")
        base = name.removesuffix("_PCT")
        what = catalog.COT_CONTRACTS.get(base, ("", base))[1]
        return (f"Speculators' net position: {what}", f"COT{base}" + ("" if pct else "N"),
                "% of open interest" if pct else "contracts", "level", "positioning")
    if prefix == "cmd":
        return name.replace("_", " ").title(), name.replace("_", ""), "USD per metric ton", \
            "price", "commodities"
    return s.description, name.replace("_", "").upper(), "", "level", "macro"


def entries() -> tuple[list[Entry], list[dict]]:
    """Catalog series the site may show, in monitor order, and those left out with why."""
    order = {g: i for i, (g, _, _) in enumerate(GROUPS)}
    keep, dropped = [], []
    for s in catalog.CATALOG.values():
        ok, why = allowed(s)
        if not ok:
            dropped.append({"key": s.key, "reason": why})
            continue
        label, short, unit, kind, group = _describe(s)
        source, licence, _ = TERMS[terms_for(s)]
        keep.append(Entry(s.key, label, short, group, _GROUP_CLASS[group], source, licence,
                          kind, unit, s.frequency, s.published_after, s.lag_days))
    keep.sort(key=lambda e: order[e.group])  # stable: catalog order inside a group
    return keep, dropped


def crypto_entry(coin: str) -> Entry | None:
    if coin not in COINS:
        return None
    symbol, name = COINS[coin]
    source, licence, _ = TERMS["coingecko"]
    return Entry(f"crypto.{symbol}", name, symbol, "crypto", "crypto", source, licence,
                 "price", "USD", "D", attribution=COINGECKO_ATTRIBUTION[0],
                 attribution_url=COINGECKO_ATTRIBUTION[1])


# ---------------------------------------------------------------- loading

def _clean(s: pd.Series) -> pd.Series:
    s = pd.to_numeric(s, errors="coerce")
    s.index = pd.DatetimeIndex(s.index).tz_localize(None).normalize()
    s = s[~s.index.duplicated(keep="last")].sort_index()
    return s[np.isfinite(s.to_numpy(float))]


def readable(s: pd.Series, e: Entry) -> pd.Series:
    """Each value dated the day it could first be read, as the backtests see it."""
    s = _clean(s)
    if e.published_after is not None:
        s.index = s.index + pd.offsets.MonthEnd(0) + pd.offsets.BDay(e.published_after)
        s = s[~s.index.duplicated(keep="last")]
    if e.lag_days:
        s.index = s.index + pd.offsets.BDay(e.lag_days)
        s = s[~s.index.duplicated(keep="last")]
    return s


def load_crypto(root: Path = store.DEFAULT_DIR,
                markets: Path | None = None) -> dict[str, pd.Series]:
    """Daily coin prices by CoinGecko id: from an exported markets file when `markets`
    is given (``<markets>/markets/crypto.json``), else from the local markets cache.
    Empty when neither exists."""
    out: dict[str, pd.Series] = {}
    if markets is not None:
        path = Path(markets) / "markets" / "crypto.json"
        if not path.exists():
            return out
        doc = json.loads(path.read_text())
        for coin, h in (doc.get("history") or {}).items():
            pts = [(d, v) for d, v in h.get("prices", []) if v is not None]
            if pts:
                out[coin] = pd.Series([v for _, v in pts],
                                      index=pd.to_datetime([d for d, _ in pts]))
        return out
    from .markets import store as mstore

    daily = mstore.load("crypto_daily", root)
    if daily.empty:
        return out
    for coin, g in daily.groupby("coin"):
        out[str(coin)] = g.set_index(pd.to_datetime(g["date"]))["price_usd"]
    return out


def load(root: Path = store.DEFAULT_DIR, markets: Path | None = None
         ) -> tuple[list[tuple[Entry, pd.Series]], list[dict]]:
    """Every allowed series with cached data, readable-dated. Missing cache files are
    skipped and listed with the licence exclusions."""
    keep, dropped = entries()
    items = []
    for e in keep:
        try:
            s = readable(store.load(e.key, root), e)
        except FileNotFoundError:
            dropped.append({"key": e.key, "reason": "no cached data"})
            continue
        if not s.empty:
            items.append((e, s))
    for coin, s in load_crypto(root, markets).items():
        e = crypto_entry(coin)
        if e is not None and not (s := readable(s, e)).empty:
            items.append((e, s))
    order = {g: i for i, (g, _, _) in enumerate(GROUPS)}
    items.sort(key=lambda it: order[it[0].group])
    return items, dropped


# ---------------------------------------------------------------- maths

def sig(v, digits: int = 6) -> float | None:
    """A number to `digits` significant digits; None for NaN, infinity or None."""
    if v is None:
        return None
    v = float(v)
    return float(f"{v:.{digits}g}") if math.isfinite(v) else None


def points(s: pd.Series, freq: str) -> list[list]:
    """[date, value] pairs: weekly (last close of each week, dated the Friday) before
    2016 and daily from 2016 for daily series; other series as they are."""
    s = s.dropna()
    if freq == "D":
        old = s[s.index < DAILY_FROM]
        weekly = old.resample("W-FRI").last().dropna() if not old.empty else old
        weekly = weekly[weekly.index < DAILY_FROM]  # a week straddling 1 Jan stays daily
        old_tail = old[old.index > weekly.index.max()] if not weekly.empty else old
        s = pd.concat([weekly, old_tail, s[s.index >= DAILY_FROM]])
    return [[d.date().isoformat(), sig(v)] for d, v in s.items()]


def _at(s: pd.Series, when: pd.Timestamp) -> float | None:
    """The last value on or before a date."""
    before = s[s.index <= when]
    return float(before.iloc[-1]) if not before.empty else None


def change(last: float, ref: float | None, kind: str) -> float | None:
    if ref is None:
        return None
    if kind == "price":
        return (last / ref - 1) * 100 if ref else None
    return last - ref


def stats(s: pd.Series, kind: str, freq: str) -> dict:
    """Latest value, changes, volatility, z-score, past-year percentile and sparkline."""
    s = s.dropna()
    asof, last = s.index[-1], float(s.iloc[-1])
    prev = float(s.iloc[-2]) if len(s) > 1 else None
    chg = {
        "d1": change(last, prev, kind) if freq == "D" else None,
        "w1": change(last, _at(s, asof - pd.Timedelta(days=7)), kind)
        if freq in ("D", "W") else None,
        "m1": change(last, _at(s, asof - pd.DateOffset(months=1)), kind)
        if freq in ("D", "W") else (change(last, prev, kind) if freq == "M" else None),
        "ytd": change(last, _at(s, pd.Timestamp(asof.year - 1, 12, 31)), kind),
    }
    year = s[s.index > asof - pd.Timedelta(days=365)]
    vol = None
    if kind == "price" and freq in ("D", "W") and (year > 0).all():
        r = np.log(year).diff().dropna()
        if len(r) >= 20:
            vol = float(r.std(ddof=1) * math.sqrt(len(r)) * 100)
    z = None
    if freq in ("D", "W") and chg["w1"] is not None:
        weeks = s[s.index > asof - pd.Timedelta(days=3 * 365)].resample("W-FRI").last().dropna()
        moves = (weeks.pct_change() * 100) if kind == "price" else weeks.diff()
        moves = moves.replace([np.inf, -np.inf], np.nan).dropna()
        sd = float(moves.std(ddof=1)) if len(moves) >= 26 else 0.0
        z = chg["w1"] / sd if sd > 0 else None
    pct1y = float((year <= last).mean() * 100) if len(year) >= 2 else None
    spark = s[s.index > asof - pd.Timedelta(weeks=SPARK_WEEKS)].resample("W-FRI").last()
    spark = spark.ffill().dropna().tail(SPARK_WEEKS)
    return {
        "first": s.index[0].date().isoformat(), "asof": asof.date().isoformat(),
        "last": sig(last), "chg": {k: sig(v) for k, v in chg.items()}, "vol": sig(vol, 4),
        "z": sig(z, 4), "pct1y": sig(pct1y, 4), "spark": [sig(v) for v in spark],
    }


# ---------------------------------------------------------------- export

def row(e: Entry, s: pd.Series) -> dict:
    out = {"key": e.key, "label": e.label, "short": e.short, "group": e.group,
           "class": e.cls, "source": e.source, "licence": e.licence, "kind": e.kind,
           "unit": e.unit, "freq": e.freq, **stats(s, e.kind, e.freq),
           "file": f"s/{e.key}.json"}
    if e.attribution:
        out["attribution"], out["attribution_url"] = e.attribution, e.attribution_url
    return out


def build(items: list[tuple[Entry, pd.Series]]) -> tuple[dict, dict[str, dict]]:
    """The index document and each series' file, by key."""
    shorts = [e.short for e, _ in items]
    dupes = sorted({x for x in shorts if shorts.count(x) > 1})
    if dupes:
        raise ValueError(f"short codes must be unique: {dupes}")
    rows = [row(e, s) for e, s in items]
    present = {e.group for e, _ in items}
    index = {
        "generated_at": datetime.now(UTC).isoformat(timespec="seconds"),
        "data_through": max((r["asof"] for r in rows), default=None),
        "groups": [{"id": g, "label": label, "class": c} for g, label, c in GROUPS
                   if g in present],
        "series": rows,
    }
    files = {e.key: {"key": e.key, "points": points(s, e.freq)} for e, s in items}
    return index, files


def dumps(doc: dict) -> str:
    return json.dumps(doc, separators=(",", ":"), allow_nan=False, ensure_ascii=False)


def write(out: Path, index: dict, files: dict[str, dict]) -> Path:
    """Write <out>/terminal/index.json and <out>/terminal/s/<key>.json."""
    base = Path(out) / "terminal"
    (base / "s").mkdir(parents=True, exist_ok=True)
    for key, doc in files.items():
        (base / "s" / f"{key}.json").write_text(dumps(doc))
    (base / "index.json").write_text(dumps(index))
    return base


def export(out: Path, root: Path = store.DEFAULT_DIR, markets: Path | None = None) -> dict:
    """Load, build and write. Returns a summary for the command line."""
    items, dropped = load(root, markets)
    index, files = build(items)
    base = write(out, index, files)
    return {"dir": str(base), "series": len(index["series"]), "groups": len(index["groups"]),
            "data_through": index["data_through"], "dropped": dropped,
            "entries": [asdict(e) for e, _ in items]}
