"""The bar we are trying to clear."""

from __future__ import annotations

import pandas as pd

from . import register
from .base import Strategy


@register
class SpyBuyAndHold(Strategy):
    name = "spy_buy_hold"
    summary = "Hold the S&P 500 (SPY, dividends reinvested) and never trade."
    reference = "reference/0002-kpis.md#the-benchmark"
    is_benchmark = True

    def instruments(self) -> list[str]:
        return ["eq.SPY"]

    def weights(self, panel: pd.DataFrame) -> pd.DataFrame:
        w = pd.DataFrame(1.0, index=panel.index, columns=["eq.SPY"])
        return w.where(panel["eq.SPY"].notna(), 0.0)
