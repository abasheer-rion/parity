"""The bar we are trying to clear. See docs/decisions/0008-benchmark-data-without-yahoo.md."""

from __future__ import annotations

import pandas as pd

from . import register
from .base import Strategy


@register
class UsMarketBuyAndHold(Strategy):
    name = "us_market_buy_hold"
    summary = "Hold the whole US stock market (dividends reinvested) and never trade."
    reference = "reference/0002-kpis.md#the-benchmark"
    is_benchmark = True

    def instruments(self) -> list[str]:
        return ["eq.US_TOTAL"]

    def weights(self, panel: pd.DataFrame) -> pd.DataFrame:
        w = pd.DataFrame(1.0, index=panel.index, columns=["eq.US_TOTAL"])
        return w.where(panel["eq.US_TOTAL"].notna(), 0.0)
