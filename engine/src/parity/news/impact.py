"""How markets moved after a piece of news, compared with how much they normally move.

For each article we take the last close before it was published and measure the change
1 day, 1 week (5 trading days) and 1 month (21 trading days) later in the series it is
tagged with. Dividing by normal day to day volatility gives a z-score: 1 is an ordinary
move, 3 is rare. One hour moves are measured only when an intraday series is supplied;
the engine has none today, so that column stays empty.

This measures what happened after, not what the news caused. Many things happen on the
same day, and big days attract stories written to explain them.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np
import pandas as pd

from ..data import store as data_store

HORIZONS = {"1d": 1, "1w": 5, "1m": 21}
VOL_WINDOW = 250  # trading days of history used for normal volatility
MIN_VOL_OBS = 60
CLOSE_HOUR_NY = 16  # US close; FRED FX is a noon rate, so this is a simplification


@dataclass(frozen=True)
class Target:
    key: str
    label: str
    unit: str  # "pct": percent change; "pp": change in percentage points; "pt": points


TARGETS: dict[str, Target] = {t.key: t for t in [
    Target("eq.US_TOTAL", "US stocks", "pct"),
    Target("usd.BASKET", "US dollar vs G10", "pct"),
    *[Target(f"fx.{c}", f"{c} vs USD", "pct")
      for c in ["EUR", "GBP", "JPY", "CHF", "CAD", "AUD", "NZD", "NOK", "SEK"]],
    Target("cmd.WTI", "WTI oil", "pct"),
    Target("cmd.BRENT", "Brent oil", "pct"),
    Target("cmd.HH_GAS", "US natural gas", "pct"),
    Target("bond.UST10Y", "US 10 year yield", "pp"),
    Target("rate.TBILL3M", "US 3 month bill", "pp"),
    Target("risk.VIX", "VIX", "pt"),
]}

COMMODITY_TARGET = {"oil": "cmd.WTI", "gas": "cmd.HH_GAS"}  # no free daily gold or copper yet
G10 = ["EUR", "GBP", "JPY", "CHF", "CAD", "AUD", "NZD", "NOK", "SEK"]


def load_panel(root=data_store.DEFAULT_DIR) -> pd.DataFrame:
    """Every impact series we have in the cache, on business days, plus a US dollar basket.

    Not forward filled: a day with no new price stays empty, so a stale price is never
    read as "no move". Each series is measured on its own trading days.
    """
    frames = {}
    for k in TARGETS:
        if k == "usd.BASKET":
            continue
        try:
            s = data_store.load(k, root)
        except FileNotFoundError:
            continue
        frames[k] = s[~s.index.duplicated(keep="last")].sort_index()
    if not frames:
        raise FileNotFoundError("No cached prices. Run `parity fetch` first.")
    start = min(s.index.min() for s in frames.values())
    end = max(s.index.max() for s in frames.values())
    index = pd.bdate_range(start, end)
    panel = pd.DataFrame({k: s.reindex(index) for k, s in frames.items()}, index=index)
    return add_usd_basket(panel)


def add_usd_basket(panel: pd.DataFrame) -> pd.DataFrame:
    """USD against an equal weight of the G10 currencies: up means the dollar is stronger."""
    fx = [f"fx.{c}" for c in G10 if f"fx.{c}" in panel]
    if len(fx) >= 3:
        have = panel[fx].notna().sum(axis=1) >= len(fx) / 2
        rows = panel.loc[have, fx].ffill()
        logret = np.log(rows).diff().mean(axis=1, skipna=True)
        basket = np.exp((-logret).fillna(0).cumsum()) * 100
        panel = panel.assign(**{"usd.BASKET": basket.reindex(panel.index)})
    return panel


def targets_for(currencies, commodities, category: str | None = None) -> list[str]:
    """The series an article is about, most specific first. US stocks always come last."""
    out: list[str] = []
    for c in currencies or []:
        out.append("usd.BASKET" if c == "USD" else f"fx.{c}")
    for c in commodities or []:
        if c in COMMODITY_TARGET:
            out.append(COMMODITY_TARGET[c])
    if category in ("central-bank", "macro-data") and "bond.UST10Y" not in out:
        out.append("bond.UST10Y")
    out.append("eq.US_TOTAL")
    return list(dict.fromkeys(out))


def change(a: float, b: float, unit: str) -> float:
    """Change from a to b: percent for prices, plain difference for rates and points."""
    if unit == "pct":
        ok = a > 0 and b > 0  # prices at or below zero (WTI in April 2020) have no percent move
        return (b / a - 1) * 100 if ok else float("nan")
    return b - a


def daily_changes(s: pd.Series, unit: str) -> pd.Series:
    if unit == "pct":
        pos = s.where(s > 0)
        return pos.pct_change(fill_method=None) * 100
    return s.diff()


def event_day(index: pd.DatetimeIndex, published_at: pd.Timestamp) -> int | None:
    """Position of the first trading day whose close comes after publication."""
    ts = pd.Timestamp(published_at)
    ts = ts.tz_localize("UTC") if ts.tzinfo is None else ts
    ny = ts.tz_convert("America/New_York")
    day = pd.Timestamp(ny.date())
    if ny.hour >= CLOSE_HOUR_NY:
        day += pd.Timedelta(days=1)
    pos = int(index.searchsorted(day))
    return pos if pos < len(index) else None


def _anchor(panel: pd.DataFrame, key: str, published_at) -> tuple[pd.Series, int] | None:
    """The series' own trading days and the position of the last close before the event."""
    s = panel[key].dropna()
    t0 = event_day(panel.index, published_at)
    if s.empty:
        return None
    day = panel.index[t0] if t0 is not None else panel.index[-1] + pd.Timedelta(days=1)
    base = int(s.index.searchsorted(day)) - 1
    return (s, base) if base >= 0 else None


def measure(panel: pd.DataFrame, key: str, published_at,
            intraday: dict[str, pd.Series] | None = None) -> dict | None:
    """Moves in one series after one moment, counted in that series' own trading days.
    None when the series is missing; a horizon is None until its day has a price."""
    if key not in panel or key not in TARGETS:
        return None
    found = _anchor(panel, key, published_at)
    if found is None:
        return None
    s, base = found
    unit = TARGETS[key].unit
    if base == len(s) - 1 and event_day(panel.index, published_at) is None:
        return None  # newer than every price we have
    base_val = s.iloc[base]
    hist = daily_changes(s.iloc[max(0, base - VOL_WINDOW):base + 1], unit).dropna()
    sigma = float(hist.std()) if len(hist) >= MIN_VOL_OBS else float("nan")
    out = {"series": key, "unit": unit, "base_date": s.index[base].date().isoformat(),
           "sigma_daily": sigma}
    for name, h in HORIZONS.items():
        end = base + h
        if end >= len(s):
            out[name] = None
            continue
        move = change(base_val, s.iloc[end], unit)
        z = move / (sigma * math.sqrt(h)) if sigma and not math.isnan(sigma) else None
        out[name] = {"move": _r(move), "z": _r(z), "end_date": s.index[end].date().isoformat()}
    out["1h"] = measure_intraday(intraday.get(key) if intraday else None, published_at, unit)
    return out


def measure_intraday(s: pd.Series | None, published_at, unit: str) -> dict | None:
    """One hour move from the last tick before publication, against the last 30 days of
    one hour moves. Needs a UTC indexed intraday series; returns None without one."""
    if s is None or s.empty:
        return None
    ts = pd.Timestamp(published_at)
    before = s.loc[:ts]
    after = s.loc[ts + pd.Timedelta(hours=1):]
    if before.empty or after.empty:
        return None
    hourly = s.resample("1h").last().dropna()
    hist = daily_changes(hourly.loc[ts - pd.Timedelta(days=30):ts], unit).dropna()
    move = change(before.iloc[-1], after.iloc[0], unit)
    sigma = float(hist.std()) if len(hist) > 50 else float("nan")
    return {"move": _r(move), "z": _r(move / sigma) if sigma and not math.isnan(sigma) else None}


def path(panel: pd.DataFrame, key: str, published_at, before: int = 10,
         after: int = 21) -> list[list]:
    """The series around the event, as change from the last close before it."""
    if key not in panel:
        return []
    found = _anchor(panel, key, published_at)
    if found is None:
        return []
    s, base = found
    unit = TARGETS[key].unit
    b = s.iloc[base]
    window = s.iloc[max(0, base - before):min(len(s), base + after + 1)]
    pts = [[d.date().isoformat(), _r(change(b, v, unit))] for d, v in window.items()]
    return [p for p in pts if p[1] is not None]


def impacts(articles: pd.DataFrame, panel: pd.DataFrame) -> pd.DataFrame:
    """One row per article, series and horizon."""
    rows = []
    for a in articles.itertuples(index=False):
        for key in targets_for(a.currencies, a.commodities, a.category):
            m = measure(panel, key, a.published_at)
            if not m:
                continue
            for h in ["1h", *HORIZONS]:
                v = m.get(h)
                rows.append({"article_id": a.id, "series": key, "horizon": h,
                             "base_date": m["base_date"],
                             "end_date": v.get("end_date") if v else None,
                             "move": v["move"] if v else None, "z": v["z"] if v else None,
                             "unit": m["unit"]})
    return pd.DataFrame(rows, columns=["article_id", "series", "horizon", "base_date",
                                       "end_date", "move", "z", "unit"])


def records(panel: pd.DataFrame, key: str, since: str = "1999-01-01", n: int = 25) -> pd.DataFrame:
    """The n biggest one day moves in a series since `since`, largest first, with each
    move's z-score against the year before it."""
    if key not in panel:
        return pd.DataFrame()
    unit = TARGETS[key].unit
    s = panel[key].dropna()
    s = s[~s.index.duplicated()]
    ch = daily_changes(s, unit)
    real = ch.where(ch != 0)
    sigma = real.rolling(VOL_WINDOW, min_periods=MIN_VOL_OBS).std().shift(1)
    df = pd.DataFrame({"move": ch, "z": ch / sigma}).loc[since:].dropna(subset=["move"])
    df = df.reindex(df["move"].abs().sort_values(ascending=False).index).head(n)
    df.insert(0, "series", key)
    df["unit"] = unit
    df["rank"] = range(1, len(df) + 1)
    df.index.name = "date"
    return df.reset_index()


def _r(v, digits: int = 4):
    if v is None:
        return None
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return None if math.isnan(f) or math.isinf(f) else round(f, digits)
