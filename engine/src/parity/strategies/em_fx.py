"""Emerging market currency strategies (docs/research/0011-emerging-market-currencies.md).

All three hold EM currencies against the US dollar, so the backtester credits each
currency's interest rate gap to the dollar (the carry) as for G10. A currency with no
price for more than a few days drops out of the panel and its position closes at the last
price it had. For the ruble, which the ECB stopped quoting on 1 March 2022, that is kinder
than reality, where holders could not sell at all; the experiment docs say so.

Every published test of these ideas ends by 2010, so official runs start in 2010.
"""

from __future__ import annotations

import math

import numpy as np
import pandas as pd

from ..data.catalog import EM_RATED as EM
from . import register
from ._util import hold_between_rebalances
from .base import Strategy

FX = [f"fx.{c}" for c in EM]
RATES = [f"rate.{c}" for c in EM]


def _carry(panel: pd.DataFrame) -> pd.DataFrame:
    """Interest rate gap to the dollar in percentage points, only where the currency has
    a price that day."""
    gap = pd.DataFrame({f"fx.{c}": panel[f"rate.{c}"] - panel["rate.USD"] for c in EM})
    return gap.where(panel[FX].notna().values)


def _top_fraction(sig: pd.DataFrame, fraction: float) -> pd.DataFrame:
    """Boolean mask of the top `fraction` of available currencies each day (at least one)."""
    n = sig.notna().sum(axis=1)
    k = np.ceil(n * fraction).clip(lower=1)
    return sig.rank(axis=1, ascending=False, method="first").le(k, axis=0) & sig.notna()


def _bottom_fraction(sig: pd.DataFrame, fraction: float) -> pd.DataFrame:
    n = sig.notna().sum(axis=1)
    k = np.ceil(n * fraction).clip(lower=1)
    return sig.rank(axis=1, ascending=True, method="first").le(k, axis=0) & sig.notna()


@register
class EmFxCarry(Strategy):
    name = "em_fx_carry"
    display_name = "Emerging market carry"
    description = ("Owns the emerging market currencies paying the most interest over the "
                   "dollar, skipping any whose extra interest is too small to cover costs.")
    tags = {"family": "carry", "asset": "fx", "style": "risk premium", "horizon": "monthly"}
    summary = ("Long the top third of EM currencies by interest rate gap to USD, equal "
               "weights, only where the gap is at least min_carry points; monthly.")
    reference = "hypotheses/0009-emerging-market-carry-pays-after-costs.md"
    param_grid = {"fraction": [0.25, 0.5], "min_carry": [0.0, 2.0]}

    def __init__(self, fraction: float = 1 / 3, min_carry: float = 1.0, rebalance: str = "M",
                 min_currencies: int = 6):
        self.fraction = fraction
        self.min_carry = min_carry
        self.rebalance = rebalance
        self.min_currencies = min_currencies

    def instruments(self) -> list[str]:
        return FX

    def required(self) -> list[str]:
        return FX + RATES + ["rate.USD"]

    def signal(self, panel: pd.DataFrame) -> pd.DataFrame:
        return _carry(panel)

    def weights(self, panel: pd.DataFrame) -> pd.DataFrame:
        sig = self.signal(panel)
        enough = sig.notna().sum(axis=1) >= self.min_currencies
        pick = _top_fraction(sig, self.fraction) & sig.ge(self.min_carry)
        w = pick.astype(float).div(pick.sum(axis=1).replace(0, np.nan), axis=0)
        w = w.where(enough, 0.0).fillna(0.0)
        return hold_between_rebalances(w, self.rebalance)


@register
class EmFxBasket(Strategy):
    name = "em_fx_basket"
    display_name = "Emerging market basket"
    description = ("Owns an equal slice of every emerging market currency against the "
                   "dollar and collects their interest.")
    tags = {"family": "carry", "asset": "fx", "style": "risk premium", "horizon": "monthly"}
    summary = ("Equal-weight long every EM currency with a price and a rate, against USD, "
               "rebalanced monthly (Gilmore and Hayashi's passive basket).")
    reference = "hypotheses/0010-emerging-market-basket-kept-paying-after-2008.md"
    param_grid = {"rebalance": ["W", "M"]}

    def __init__(self, rebalance: str = "M", min_currencies: int = 6):
        self.rebalance = rebalance
        self.min_currencies = min_currencies

    def instruments(self) -> list[str]:
        return FX

    def required(self) -> list[str]:
        return FX + RATES + ["rate.USD"]

    def signal(self, panel: pd.DataFrame) -> pd.DataFrame:
        return _carry(panel)

    def weights(self, panel: pd.DataFrame) -> pd.DataFrame:
        live = self.signal(panel).notna()
        n = live.sum(axis=1)
        w = live.astype(float).div(n.replace(0, np.nan), axis=0)
        w = w.where(n >= self.min_currencies, 0.0).fillna(0.0)
        return hold_between_rebalances(w, self.rebalance)


@register
class EmFxMomentum(Strategy):
    name = "em_fx_momentum"
    display_name = "Emerging market momentum"
    description = ("Owns the emerging market currencies that earned most over the past few "
                   "months, interest included, and bets against those that earned least.")
    tags = {"family": "trend", "asset": "fx", "style": "momentum", "horizon": "monthly"}
    summary = ("Long the top third of EM currencies by past excess return (spot change plus "
               "interest gap), short the bottom third, equal weights; monthly.")
    reference = "hypotheses/0011-emerging-market-momentum-survives-costs.md"
    param_grid = {"lookback": [21, 126]}

    def __init__(self, lookback: int = 63, fraction: float = 1 / 3, rebalance: str = "M",
                 min_currencies: int = 6):
        self.lookback = lookback
        self.fraction = fraction
        self.rebalance = rebalance
        self.min_currencies = min_currencies

    def instruments(self) -> list[str]:
        return FX

    def required(self) -> list[str]:
        return FX + RATES + ["rate.USD"]

    def signal(self, panel: pd.DataFrame) -> pd.DataFrame:
        """Past excess return: log spot change plus the interest gap earned meanwhile."""
        px = panel[FX]
        spot = np.log(px / px.shift(self.lookback))
        carry = _carry(panel).rolling(self.lookback, min_periods=self.lookback // 2).mean()
        return spot + carry / 100 * self.lookback / 252

    def weights(self, panel: pd.DataFrame) -> pd.DataFrame:
        sig = self.signal(panel)
        n = sig.notna().sum(axis=1)
        longs, shorts = _top_fraction(sig, self.fraction), _bottom_fraction(sig, self.fraction)
        k = np.ceil(n * self.fraction).clip(lower=1)
        w = longs.astype(float).div(2 * k, axis=0) - shorts.astype(float).div(2 * k, axis=0)
        w = w.where(n >= max(self.min_currencies, math.ceil(2 / self.fraction)), 0.0)
        return hold_between_rebalances(w.fillna(0.0), self.rebalance)
