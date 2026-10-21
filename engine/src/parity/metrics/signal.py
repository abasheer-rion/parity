"""Does the signal predict anything? These are the leading indicators in
docs/reference/0002-kpis.md#leading-indicators: they say whether a forecast has information
before costs, sizing and portfolio rules get in the way."""

from __future__ import annotations

import numpy as np
import pandas as pd

HORIZONS = (1, 5, 21, 63)


def forward_returns(prices: pd.DataFrame, horizon: int) -> pd.DataFrame:
    """Return from the close of t to the close of t+horizon, aligned to t."""
    return prices.shift(-horizon) / prices - 1


def information_coefficient(signal: pd.DataFrame, fwd: pd.DataFrame) -> pd.Series:
    """Rank correlation between signal and forward return, one value per date.

    With fewer than three instruments a cross-sectional rank means little, so we
    pool all instruments and report one rank correlation per calendar year.

    Forward returns over several days overlap, which makes the t-stat in
    ic_decay look better than it is for horizons above one day.
    """
    sig, ret = signal.align(fwd, join="inner")
    if sig.shape[1] < 3:
        flat_s = sig.stack()
        flat_r = ret.stack()
        both = pd.concat([flat_s, flat_r], axis=1).dropna()
        both.columns = ["s", "r"]
        dates = both.index.get_level_values(0)
        ranked = both.groupby(dates.year).apply(
            lambda g: g["s"].rank().corr(g["r"].rank()) if len(g) > 20 else np.nan)
        return ranked
    return sig.rank(axis=1).corrwith(ret.rank(axis=1), axis=1, method="pearson").dropna()


def ic_decay(signal: pd.DataFrame, prices: pd.DataFrame, horizons=HORIZONS) -> list[dict]:
    rows = []
    for h in horizons:
        ic = information_coefficient(signal, forward_returns(prices, h))
        n = int(ic.notna().sum())
        mean = float(ic.mean()) if n else float("nan")
        sd = float(ic.std()) if n > 1 else float("nan")
        rows.append({
            "horizon_days": h,
            "mean_ic": None if np.isnan(mean) else mean,
            "ic_tstat": None if not n or not sd or np.isnan(sd) else mean / sd * np.sqrt(n),
            "observations": n,
        })
    return rows
