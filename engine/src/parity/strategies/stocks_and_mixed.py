"""Stock market timing rules, a commodity trend rule and the stocks plus FX overlay,
so currency ideas can be compared with what equity traders use. All hold cash.USD
(earning the US 3-month rate) when out of the market."""

from __future__ import annotations

import numpy as np
import pandas as pd

from . import register
from ._util import hold_between_rebalances, normalise_gross
from .base import Strategy
from .fx_momentum import FxTimeSeriesMomentum

MKT, CASH = "eq.US_TOTAL", "cash.USD"


class _InOrOut(Strategy):
    """Base for rules that are either fully in the stock market or fully in cash."""

    funded = True

    def instruments(self) -> list[str]:
        return [MKT, CASH]

    def required(self) -> list[str]:
        return [MKT, "rate.USD"]

    def invested(self, panel: pd.DataFrame) -> pd.Series:
        raise NotImplementedError

    def weights(self, panel):
        inv = self.invested(panel).astype(float).fillna(0.0)
        return pd.DataFrame({MKT: inv, CASH: 1 - inv}, index=panel.index)


@register
class StocksTrend(_InOrOut):
    name = "stocks_trend_10m"
    summary = ("Hold US stocks when they are above their 10-month average, otherwise hold "
               "cash (Faber).")
    reference = "algorithms/0043-managed-futures-trend-following.md"
    param_grid = {"days": [105, 210, 315]}

    def __init__(self, days: int = 210):
        self.days = days

    def invested(self, panel):
        px = panel[MKT]
        inv = px > px.rolling(self.days).mean()
        return hold_between_rebalances(inv.astype(float).to_frame(), "M").iloc[:, 0]


@register
class StocksGoldenCross(_InOrOut):
    name = "stocks_golden_cross"
    summary = ("Retail favourite: hold US stocks when the 50-day average is above the "
               "200-day average, otherwise cash.")
    reference = "algorithms/0036-technical-indicator-trading-bots.md"
    param_grid = {"fast": [20, 50], "slow": [150, 200]}

    def __init__(self, fast: int = 50, slow: int = 200):
        self.fast, self.slow = fast, slow

    def invested(self, panel):
        px = panel[MKT]
        return px.rolling(self.fast).mean() > px.rolling(self.slow).mean()


@register
class StocksTurnOfMonth(_InOrOut):
    name = "stocks_turn_of_month"
    summary = ("Hold US stocks only from the last trading day of each month to the third "
               "day of the next.")
    reference = "algorithms/0052-turn-of-the-month.md"
    param_grid = {"days_after": [2, 3, 4]}

    def __init__(self, days_after: int = 3):
        self.days_after = days_after

    def invested(self, panel):
        idx = panel.index
        month = idx.to_period("M")
        pos = pd.Series(range(len(idx)), index=idx).groupby(month).cumcount()
        size = pd.Series(1, index=idx).groupby(month).transform("size")
        # decided at the close: be invested on the last day and the first few days
        hold = (pos >= size - 2) | (pos < self.days_after - 1)
        return hold


@register
class StocksSellInMay(_InOrOut):
    name = "stocks_sell_in_may"
    summary = "Hold US stocks from November to April and cash from May to October."
    reference = "algorithms/0047-sell-in-may-halloween.md"

    def invested(self, panel):
        m = pd.Series(panel.index.month, index=panel.index)
        return (m >= 11) | (m <= 4)


@register
class StocksVolManaged(Strategy):
    name = "stocks_vol_managed"
    summary = ("Hold more US stock market when it has been calm and less when it has been "
               "wild (Moreira and Muir).")
    reference = "algorithms/0054-volatility-managed-portfolios.md"
    param_grid = {"window": [21, 63]}
    max_gross = 2.0
    funded = True

    def __init__(self, window: int = 21, target: float = 0.16, cap: float = 2.0):
        self.window, self.target, self.cap = window, target, cap

    def instruments(self):
        return [MKT, CASH]

    def required(self):
        return [MKT, "rate.USD"]

    def weights(self, panel):
        vol = panel[MKT].pct_change().rolling(self.window).std() * np.sqrt(252)
        w = (self.target / vol).clip(upper=self.cap)
        w = hold_between_rebalances(w.to_frame(), "M").iloc[:, 0]
        return pd.DataFrame({MKT: w, CASH: (1 - w).clip(lower=0)}, index=panel.index).fillna(0.0)


@register
class CommodityTrend(Strategy):
    name = "commodity_tsmom"
    summary = ("Long Brent oil and US natural gas when they rose over the past year, short "
               "when they fell (spot prices).")
    reference = "algorithms/0039-commodity-time-series-momentum.md"
    param_grid = {"lookback": [126, 252]}

    def __init__(self, lookback: int = 252):
        self.lookback = lookback

    def instruments(self):
        # WTI is left out: it settled below zero in April 2020, so its returns are undefined.
        return ["cmd.BRENT", "cmd.HH_GAS"]

    def signal(self, panel):
        px = panel[self.instruments()]
        return np.log(px / px.shift(self.lookback))

    def weights(self, panel):
        px = panel[self.instruments()]
        vol = np.log(px).diff().rolling(60).std()
        raw = np.sign(self.signal(panel)) / vol.replace(0, np.nan)
        return hold_between_rebalances(normalise_gross(raw.fillna(0.0)), "M")


@register
class StocksPlusFxTrend(Strategy):
    name = "stocks_plus_fx_trend"
    summary = ("Half the risk in US stocks, half in currency trend, so the trend can "
               "cushion stock crashes.")
    reference = "hypotheses/0007-sp-500-plus-fx-beats-sp-500-alone.md"
    max_gross = 4.5
    funded = True

    def instruments(self):
        return [MKT, CASH] + FxTimeSeriesMomentum().instruments()

    def required(self):
        return [MKT, "rate.USD"] + FxTimeSeriesMomentum().required()

    def weights(self, panel):
        fx = FxTimeSeriesMomentum().weights(panel)
        fx_rets = (fx.shift(1) * panel[fx.columns].pct_change()).sum(axis=1)
        mkt_vol = panel[MKT].pct_change().rolling(252, min_periods=126).std()
        fx_vol = fx_rets.rolling(252, min_periods=126).std().replace(0, np.nan)
        scale = (mkt_vol / fx_vol).clip(upper=6).fillna(0.0)
        scale = hold_between_rebalances(scale.to_frame(), "M").iloc[:, 0]
        out = fx.mul(0.5 * scale, axis=0)
        out[MKT] = 0.5
        out[CASH] = 0.5  # the half not in stocks sits in cash and earns the T-bill
        return out[self.instruments()].fillna(0.0)
