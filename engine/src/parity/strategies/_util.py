"""Small helpers shared by strategies."""

from __future__ import annotations

import numpy as np
import pandas as pd


def rebalance_dates(index: pd.DatetimeIndex, freq: str) -> pd.Series:
    """Boolean mask, True on the last available day of each period.

    freq: "D" daily, "W" weekly (last day of the week), "M" monthly.
    """
    if freq == "D":
        return pd.Series(True, index=index)
    period = index.to_period("W-FRI" if freq == "W" else "M")
    last = pd.Series(index, index=index).groupby(period).transform("max")
    return pd.Series(index == last.values, index=index)


def hold_between_rebalances(weights: pd.DataFrame, freq: str) -> pd.DataFrame:
    """Keep weights fixed between rebalance dates."""
    mask = rebalance_dates(weights.index, freq)
    return weights.where(mask, np.nan).ffill().fillna(0.0)


def normalise_gross(weights: pd.DataFrame, gross: float = 1.0) -> pd.DataFrame:
    """Scale each row so the absolute weights add up to `gross`."""
    total = weights.abs().sum(axis=1).replace(0.0, np.nan)
    return weights.div(total, axis=0).mul(gross).fillna(0.0)


def zscore(df: pd.DataFrame | pd.Series, window: int):
    mean = df.rolling(window, min_periods=window // 2).mean()
    std = df.rolling(window, min_periods=window // 2).std()
    return (df - mean) / std.replace(0.0, np.nan)
