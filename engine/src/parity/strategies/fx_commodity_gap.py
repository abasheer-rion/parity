"""Commodity currencies versus the commodities behind them.

Canada and Norway export oil, so the Canadian dollar and Norwegian krone tend to
move with crude. When oil moves and the currency has not followed yet, this bets
that the currency catches up.

We are honest that the literature cuts both ways. Ferraro, Rogoff and Rossi (2015)
find a strong same-day link between oil and CAD but little that lasts at lower
frequencies, and Chen, Rogoff and Rossi (2010) find the currency often leads the
commodity rather than the other way round. So this is the experiment we most
expect to fail, and the one we would learn the most from if it does not.
See hypotheses/0003-commodity-currencies-catch-up.md.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from . import register
from ._util import hold_between_rebalances, zscore
from .base import Strategy

DEFAULT_MAP = {"fx.CAD": "cmd.WTI", "fx.NOK": "cmd.BRENT"}


@register
class FxCommodityGap(Strategy):
    name = "fx_commodity_gap"
    summary = "Buy CAD or NOK when oil has moved more than the currency, and the reverse."
    reference = "hypotheses/0003-commodity-currencies-catch-up.md"
    param_grid = {"gap_window": [10, 20, 40], "rebalance": ["W", "M"]}

    def __init__(self, mapping: dict[str, str] | None = None, beta_window: int = 250,
                 gap_window: int = 20, z_window: int = 250, rebalance: str = "W"):
        self.mapping = dict(mapping or DEFAULT_MAP)
        self.beta_window = beta_window
        self.gap_window = gap_window
        self.z_window = z_window
        self.rebalance = rebalance

    def instruments(self) -> list[str]:
        return list(self.mapping)

    def required(self) -> list[str]:
        return self.instruments() + sorted(set(self.mapping.values()))

    def signal(self, panel: pd.DataFrame) -> pd.DataFrame:
        out = {}
        for fx, cmd in self.mapping.items():
            r_fx = np.log(panel[fx]).diff()
            # WTI settled at -$37 on 2020-04-20. A log return is undefined there, so
            # non-positive prices are treated as missing for that day.
            r_cmd = np.log(panel[cmd].where(panel[cmd] > 0)).diff()
            cov = r_fx.rolling(self.beta_window).cov(r_cmd)
            var = r_cmd.rolling(self.beta_window).var()
            beta = (cov / var).shift(1)  # estimated on data before today
            residual = r_fx - beta * r_cmd
            gap = residual.rolling(self.gap_window).sum()
            out[fx] = -zscore(gap, self.z_window)  # currency lagging its commodity => buy
        return pd.DataFrame(out)

    def weights(self, panel: pd.DataFrame) -> pd.DataFrame:
        sig = self.signal(panel)
        w = (sig / 2).clip(-1, 1) / len(self.mapping)
        return hold_between_rebalances(w.fillna(0.0), self.rebalance)
