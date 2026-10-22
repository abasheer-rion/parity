"""Plain statistics for the Markets pages: how much a coin swings, its worst fall, and
what holding a perp has cost in funding. Descriptive only: none of this predicts."""

from __future__ import annotations

import math

import pandas as pd

from .sources import HOURS_PER_YEAR


def price_stats(prices: pd.Series) -> dict:
    """prices: daily closes indexed by date, oldest first. Crypto trades every day, so a
    year is 365 days."""
    p = prices.dropna().astype(float)
    if len(p) < 3:
        return {}
    ret = p.pct_change().dropna()
    last30 = ret.tail(30)
    peak = p.cummax()
    dd = p / peak - 1
    trough = dd.idxmin()
    worst, best = ret.idxmin(), ret.idxmax()
    return {
        "days": int(len(p)),
        "first_date": str(p.index[0]),
        "return_period_pct": round((p.iloc[-1] / p.iloc[0] - 1) * 100, 2),
        "vol_30d_pct": round(float(last30.std() * math.sqrt(365) * 100), 1)
        if len(last30) > 5 else None,
        "vol_period_pct": round(float(ret.std() * math.sqrt(365) * 100), 1),
        "max_drawdown_pct": round(float(dd.min() * 100), 1),
        "max_drawdown_date": str(trough),
        "below_peak_pct": round(float(dd.iloc[-1] * 100), 1),
        "worst_day_pct": round(float(ret.min() * 100), 1), "worst_day": str(worst),
        "best_day_pct": round(float(ret.max() * 100), 1), "best_day": str(best),
        "big_days": int((ret.abs() >= 0.10).sum()),
        "down_days_share": round(float((ret < 0).mean()), 3),
    }


def funding_stats(funding: pd.DataFrame, now: pd.Timestamp | None = None) -> dict:
    """funding: rows of time (UTC) and hourly funding_rate for one coin. Averages are
    shown as a yearly percentage: what a long position would have paid (positive) or
    received (negative) per year at that pace, before price moves."""
    if funding.empty:
        return {}
    f = funding.sort_values("time")
    now = now or f["time"].max()

    def avg(days: int) -> float | None:
        w = f[f["time"] > now - pd.Timedelta(days=days)]["funding_rate"].dropna()
        return round(float(w.mean() * HOURS_PER_YEAR * 100), 2) if len(w) else None

    last30 = f[f["time"] > now - pd.Timedelta(days=30)]["funding_rate"].dropna()
    return {
        "avg_1d_annual_pct": avg(1), "avg_7d_annual_pct": avg(7), "avg_30d_annual_pct": avg(30),
        "positive_share_30d": round(float((last30 > 0).mean()), 3) if len(last30) else None,
        "max_hour_annual_pct": round(float(last30.max() * HOURS_PER_YEAR * 100), 1)
        if len(last30) else None,
        "min_hour_annual_pct": round(float(last30.min() * HOURS_PER_YEAR * 100), 1)
        if len(last30) else None,
        "hours": int(len(last30)),
    }


def daily_funding(funding: pd.DataFrame) -> list[list]:
    """Daily average funding as a yearly percentage, for a small chart."""
    if funding.empty:
        return []
    f = funding.copy()
    f["day"] = pd.to_datetime(f["time"], utc=True).dt.date.astype(str)
    g = f.groupby("day")["funding_rate"].mean() * HOURS_PER_YEAR * 100
    return [[d, round(float(v), 2)] for d, v in g.items()]


def liquidation_move_pct(leverage: float, maintenance_share: float = 0.5) -> float:
    """Roughly how far the price can move against a position opened at this leverage
    before it is liquidated. With L times leverage your deposit is 1/L of the position;
    liquidation comes before all of it is gone, when only the maintenance margin is left.
    On Hyperliquid maintenance is half the initial margin at maximum leverage."""
    return round(100 / leverage * (1 - maintenance_share), 2)
