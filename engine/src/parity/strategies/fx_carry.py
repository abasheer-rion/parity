"""Currency carry: lend in high-rate currencies, borrow in low-rate ones.

Uncovered interest parity says the rate gap should be eaten by the high-rate
currency weakening. Decades of data say it mostly is not (Fama 1984), which is
why carry has paid on average. It also crashes in risk-off episodes
(Brunnermeier, Nagel and Pedersen 2008). We expect a positive but lumpy result.
"""

from __future__ import annotations

import pandas as pd

from ..data.catalog import G10
from . import register
from ._util import hold_between_rebalances
from .base import Strategy


@register
class FxCarry(Strategy):
    name = "fx_carry"
    summary = "Long the 3 highest-rate G10 currencies, short the 3 lowest, rebalance monthly."
    reference = "hypotheses/0001-carry-still-pays-after-costs.md"
    param_grid = {"k": [2, 3, 4], "rebalance": ["W", "M"]}

    def __init__(self, k: int = 3, rebalance: str = "M"):
        self.k = k
        self.rebalance = rebalance

    def instruments(self) -> list[str]:
        return [f"fx.{c}" for c in G10]

    def required(self) -> list[str]:
        return self.instruments() + [f"rate.{c}" for c in G10] + ["rate.USD"]

    def signal(self, panel: pd.DataFrame) -> pd.DataFrame:
        diff = pd.DataFrame({f"fx.{c}": panel[f"rate.{c}"] - panel["rate.USD"] for c in G10})
        return diff.where(panel[self.instruments()].notna().values)

    def weights(self, panel: pd.DataFrame) -> pd.DataFrame:
        sig = self.signal(panel)
        ranks = sig.rank(axis=1, ascending=False)
        n = sig.notna().sum(axis=1)
        k = self.k
        longs = ranks.le(k)
        shorts = ranks.gt(n.sub(k), axis=0) & sig.notna()
        w = longs.astype(float) / (2 * k) - shorts.astype(float) / (2 * k)
        w[n < 2 * k] = 0.0
        return hold_between_rebalances(w, self.rebalance)
