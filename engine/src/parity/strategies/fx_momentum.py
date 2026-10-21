"""Time-series momentum on currencies.

Each currency is held long if it rose against the dollar over the past year and
short if it fell, sized so every currency contributes about the same risk.
Follows Moskowitz, Ooi and Pedersen (2012). Currency momentum has been weaker
since the 2000s than in the original samples, so a flat result would not
surprise us.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from ..data.catalog import G10
from . import register
from ._util import hold_between_rebalances, normalise_gross
from .base import Strategy


@register
class FxTimeSeriesMomentum(Strategy):
    name = "fx_tsmom"
    display_name = "Currency trend"
    description = "Owns currencies that rose over the past year and bets against those that fell."
    tags = {"family": "trend", "asset": "fx", "style": "momentum",
            "horizon": "monthly"}
    summary = "Long G10 currencies that rose over the past 12 months, short those that fell."
    reference = "hypotheses/0002-currency-trends-persist.md"
    param_grid = {"lookback": [126, 252, 504], "rebalance": ["W", "M"]}

    def __init__(self, lookback: int = 252, vol_window: int = 60, rebalance: str = "M"):
        self.lookback = lookback
        self.vol_window = vol_window
        self.rebalance = rebalance

    def instruments(self) -> list[str]:
        return [f"fx.{c}" for c in G10]

    def signal(self, panel: pd.DataFrame) -> pd.DataFrame:
        px = panel[self.instruments()]
        return np.log(px / px.shift(self.lookback))

    def weights(self, panel: pd.DataFrame) -> pd.DataFrame:
        px = panel[self.instruments()]
        vol = np.log(px).diff().rolling(self.vol_window).std()
        raw = np.sign(self.signal(panel)) / vol.replace(0.0, np.nan)
        return hold_between_rebalances(normalise_gross(raw.fillna(0.0)), self.rebalance)
