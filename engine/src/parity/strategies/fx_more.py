"""More currency strategies from the catalog, so they can be compared on the same data.
Each one points at its catalog report, where its origin and evidence are recorded."""

from __future__ import annotations

import numpy as np
import pandas as pd

from ..data.catalog import G10
from . import register
from ._util import hold_between_rebalances, normalise_gross
from .base import Strategy
from .fx_carry import FxCarry
from .fx_momentum import FxTimeSeriesMomentum

FX = [f"fx.{c}" for c in G10]


def _rank_long_short(sig: pd.DataFrame, k: int) -> pd.DataFrame:
    ranks = sig.rank(axis=1, ascending=False)
    n = sig.notna().sum(axis=1)
    w = ranks.le(k).astype(float) / (2 * k) - (ranks.gt(n.sub(k), axis=0) & sig.notna()) \
        .astype(float) / (2 * k)
    w[n < 2 * k] = 0.0
    return w


@register
class FxDollarCarry(Strategy):
    name = "fx_dollar_carry"
    display_name = "Dollar carry"
    description = ("Owns the other major currencies against the dollar when they pay more "
                   "interest than the dollar, and the reverse.")
    tags = {"family": "carry", "asset": "fx", "style": "risk premium",
            "horizon": "monthly"}
    summary = ("Long all G10 currencies against the dollar when their average rate is above "
               "the US rate, short when below.")
    reference = "hypotheses/0005-dollar-carry-beats-pair-carry.md"
    param_grid = {"rebalance": ["W", "M"]}

    def __init__(self, rebalance: str = "M"):
        self.rebalance = rebalance

    def instruments(self) -> list[str]:
        return FX

    def required(self) -> list[str]:
        return FX + [f"rate.{c}" for c in G10] + ["rate.USD"]

    def signal(self, panel):
        gap = pd.concat([panel[f"rate.{c}"] for c in G10], axis=1).mean(axis=1) - panel["rate.USD"]
        return pd.DataFrame({c: gap for c in FX})

    def weights(self, panel):
        side = np.sign(self.signal(panel)) / len(FX)
        return hold_between_rebalances(side.where(panel[FX].notna().values, 0.0), self.rebalance)


@register
class FxCrossSectionalMomentum(Strategy):
    name = "fx_xs_momentum"
    display_name = "Currency momentum ranking"
    description = ("Owns the three currencies that rose most over the past year and bets "
                   "against the three weakest.")
    tags = {"family": "trend", "asset": "fx", "style": "momentum",
            "horizon": "monthly"}
    summary = ("Long the 3 G10 currencies that rose most over the past year (skipping the "
               "last month), short the 3 weakest.")
    reference = "algorithms/0005-fx-cross-sectional-momentum.md"
    param_grid = {"lookback": [126, 252], "k": [2, 3, 4]}

    def __init__(self, lookback: int = 252, skip: int = 21, k: int = 3, rebalance: str = "M"):
        self.lookback, self.skip, self.k, self.rebalance = lookback, skip, k, rebalance

    def instruments(self) -> list[str]:
        return FX

    def signal(self, panel):
        px = panel[FX]
        return np.log(px.shift(self.skip) / px.shift(self.lookback))

    def weights(self, panel):
        return hold_between_rebalances(_rank_long_short(self.signal(panel), self.k), self.rebalance)


@register
class FxValueReer(Strategy):
    name = "fx_value_reer"
    display_name = "Currency value"
    description = ("Owns currencies that look cheap against their own long-run average and"
                   " bets against the dear ones.")
    tags = {"family": "value", "asset": "fx", "style": "mean reversion",
            "horizon": "monthly"}
    summary = ("Long the 3 G10 currencies that are cheapest against their own 5-year "
               "average real exchange rate, short the 3 dearest.")
    reference = "algorithms/0017-fx-value-ppp.md"
    param_grid = {"window_months": [36, 60, 120], "k": [2, 3]}

    def __init__(self, window_months: int = 60, k: int = 3, rebalance: str = "M"):
        self.window_months, self.k, self.rebalance = window_months, k, rebalance

    def instruments(self) -> list[str]:
        return FX

    def required(self) -> list[str]:
        return FX + [f"reer.{c}" for c in G10] + ["reer.USD"]

    def signal(self, panel):
        days = self.window_months * 21
        # BIS publishes about six weeks late, so only use values at least two months old.
        lag = 42
        dev = {}
        usd = panel["reer.USD"].shift(lag)
        usd_dev = usd / usd.rolling(days, min_periods=days // 2).mean() - 1
        for c in G10:
            r = panel[f"reer.{c}"].shift(lag)
            dev[f"fx.{c}"] = -((r / r.rolling(days, min_periods=days // 2).mean() - 1) - usd_dev)
        return pd.DataFrame(dev)

    def weights(self, panel):
        return hold_between_rebalances(_rank_long_short(self.signal(panel), self.k), self.rebalance)


@register
class FxCarryTrendValue(Strategy):
    name = "fx_carry_trend_value"
    display_name = "Currency carry, trend and value"
    description = "Splits the money equally between currency carry, trend and value."
    tags = {"family": "mixed", "asset": "fx", "style": "blend",
            "horizon": "monthly"}
    summary = "Equal parts carry, trend and value in G10 currencies, rebalanced monthly."
    reference = "algorithms/0051-trend-plus-carry-combined.md"

    def instruments(self) -> list[str]:
        return FX

    def required(self) -> list[str]:
        return sorted(set(FxCarry().required() + FxValueReer().required()))

    def weights(self, panel):
        parts = [FxCarry().weights(panel), FxTimeSeriesMomentum().weights(panel),
                 FxValueReer().weights(panel)]
        return normalise_gross(sum(p.reindex(columns=FX).fillna(0.0) for p in parts) / 3)


def _rsi(px: pd.DataFrame, n: int) -> pd.DataFrame:
    d = px.diff()
    up = d.clip(lower=0).ewm(alpha=1 / n, adjust=False).mean()
    dn = (-d.clip(upper=0)).ewm(alpha=1 / n, adjust=False).mean()
    return 100 - 100 / (1 + up / dn.replace(0, np.nan))


@register
class FxRsiReversion(Strategy):
    name = "fx_rsi_reversion"
    display_name = "Currency RSI bounce"
    description = ("Buys a currency after a sharp fall and sells after a sharp rise, using"
                   " the 14-day RSI.")
    tags = {"family": "value", "asset": "fx", "style": "mean reversion",
            "horizon": "daily"}
    summary = ("Retail favourite: buy a currency when its 14-day RSI is below 30, sell when "
               "above 70.")
    reference = "algorithms/0014-fx-technical-trading-rules.md"
    param_grid = {"n": [7, 14, 21], "band": [20, 30]}

    def __init__(self, n: int = 14, band: int = 30):
        self.n, self.band = n, band

    def instruments(self) -> list[str]:
        return FX

    def signal(self, panel):
        return 50 - _rsi(panel[FX], self.n)

    def weights(self, panel):
        r = _rsi(panel[FX], self.n)
        raw = (r < self.band).astype(float) - (r > 100 - self.band).astype(float)
        return raw / len(FX)


@register
class FxMovingAverageCross(Strategy):
    name = "fx_ma_cross"
    display_name = "Currency moving average cross"
    description = ("Owns a currency while its 50-day average is above its 200-day average,"
                   " and bets against it when below.")
    tags = {"family": "trend", "asset": "fx", "style": "momentum",
            "horizon": "daily"}
    summary = ("Retail favourite: long a currency when its 50-day average is above its "
               "200-day average, short when below.")
    reference = "algorithms/0014-fx-technical-trading-rules.md"
    param_grid = {"fast": [20, 50], "slow": [100, 200]}

    def __init__(self, fast: int = 50, slow: int = 200):
        self.fast, self.slow = fast, slow

    def instruments(self) -> list[str]:
        return FX

    def signal(self, panel):
        px = panel[FX]
        return px.rolling(self.fast).mean() / px.rolling(self.slow).mean() - 1

    def weights(self, panel):
        return np.sign(self.signal(panel)).fillna(0.0) / len(FX)
