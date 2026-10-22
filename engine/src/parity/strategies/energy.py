"""Energy futures strategies on rolled NYMEX contracts (docs/research/0012).

They trade fut.CL, fut.HO, fut.RB and fut.NG, excess return indices of holding the second
contract (data/futures.py), and vrp.OIL, a marked short variance swap on crude oil. The EIA
stopped publishing the prices on 5 April 2024, so official runs end there.

Contracts start at different dates (gasoline in October 2005), so each rule uses whatever
is available on the day.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from ..data.catalog import ENERGY
from . import register
from ._util import hold_between_rebalances, normalise_gross
from .base import Strategy

FUT = [f"fut.{s}" for s in ENERGY]
CARRY = [f"carry.{s}" for s in ENERGY]
COMMODITY_FX = ["fx.AUD", "fx.CAD", "fx.NZD", "fx.ZAR"]


def _inverse_vol(panel: pd.DataFrame, cols: list[str], window: int = 60) -> pd.DataFrame:
    vol = np.log(panel[cols]).diff().rolling(window, min_periods=window // 2).std()
    return 1 / vol.replace(0.0, np.nan)


@register
class EnergyTrend(Strategy):
    name = "energy_tsmom"
    display_name = "Energy futures trend"
    description = ("Owns oil, heating oil, gasoline and gas futures that rose over the past "
                   "year and bets against those that fell.")
    tags = {"family": "trend", "asset": "commodities", "style": "momentum",
            "horizon": "monthly"}
    summary = ("Long rolled NYMEX energy futures whose 12-month return is positive, short if "
               "negative, inverse volatility weights; monthly. The fair retest of "
               "commodity_tsmom, which used spot prices.")
    reference = "hypotheses/0012-energy-futures-trend-pays-on-tradable-prices.md"
    param_grid = {"lookback": [126, 504]}

    def __init__(self, lookback: int = 252, rebalance: str = "M"):
        self.lookback = lookback
        self.rebalance = rebalance

    def instruments(self) -> list[str]:
        return FUT

    def signal(self, panel: pd.DataFrame) -> pd.DataFrame:
        px = panel[FUT]
        return np.log(px / px.shift(self.lookback))

    def weights(self, panel: pd.DataFrame) -> pd.DataFrame:
        raw = np.sign(self.signal(panel)) * _inverse_vol(panel, FUT)
        return hold_between_rebalances(normalise_gross(raw.fillna(0.0)), self.rebalance)


@register
class EnergyCarry(Strategy):
    name = "energy_carry"
    display_name = "Energy futures carry"
    description = ("Owns the energy futures where delivery soon costs more than delivery "
                   "later, and bets against those where it costs less.")
    tags = {"family": "carry", "asset": "commodities", "style": "risk premium",
            "horizon": "monthly"}
    summary = ("Long energy futures with carry above the cross-sectional median, short "
               "below, using 12 * ln(C2 / C3) averaged over `smooth` days; inverse "
               "volatility weights; monthly.")
    reference = "hypotheses/0013-energy-futures-carry-pays.md"
    param_grid = {"smooth": [21, 63]}

    def __init__(self, smooth: int = 1, rebalance: str = "M"):
        self.smooth = smooth
        self.rebalance = rebalance

    def instruments(self) -> list[str]:
        return FUT

    def required(self) -> list[str]:
        return FUT + CARRY

    def signal(self, panel: pd.DataFrame) -> pd.DataFrame:
        carry = panel[CARRY].rolling(self.smooth, min_periods=1).mean()
        carry.columns = FUT
        return carry.where(panel[FUT].notna().values)

    def weights(self, panel: pd.DataFrame) -> pd.DataFrame:
        sig = self.signal(panel)
        side = np.sign(sig.sub(sig.median(axis=1), axis=0))
        raw = side * _inverse_vol(panel, FUT)
        raw[sig.notna().sum(axis=1) < 2] = 0.0
        return hold_between_rebalances(normalise_gross(raw.fillna(0.0)), self.rebalance)


@register
class OilVarianceShort(Strategy):
    name = "oil_variance_short"
    display_name = "Selling oil volatility"
    description = ("Sells insurance against big oil price swings each month by shorting a "
                   "variance swap, and keeps the premium unless a large swing comes.")
    tags = {"family": "volatility", "asset": "commodities", "style": "risk premium",
            "horizon": "monthly"}
    summary = ("Short a 30-day crude oil variance swap struck at OVX squared each month, "
               "optionally standing aside when OVX is above max_ovx. No trading costs in the "
               "index, so results are an upper bound.")
    reference = "hypotheses/0014-selling-oil-volatility-pays-a-premium.md"
    param_grid = {"max_ovx": [60.0, 80.0]}

    def __init__(self, max_ovx: float | None = None):
        self.max_ovx = max_ovx

    def instruments(self) -> list[str]:
        return ["vrp.OIL"]

    def required(self) -> list[str]:
        return ["vrp.OIL", "risk.OVX"]

    def signal(self, panel: pd.DataFrame) -> pd.DataFrame:
        """Implied variance at the strike, the premium the seller collects."""
        return (panel[["risk.OVX"]] ** 2).set_axis(["vrp.OIL"], axis=1)

    def weights(self, panel: pd.DataFrame) -> pd.DataFrame:
        on = panel["vrp.OIL"].notna() & panel["risk.OVX"].notna()
        if self.max_ovx is not None:
            on &= panel["risk.OVX"] <= self.max_ovx
        w = on.astype(float).to_frame("vrp.OIL")
        # The index re-strikes at each month's last trading day, so decide on the same day.
        return hold_between_rebalances(w, "M")


@register
class CommodityFxLeadsEnergy(Strategy):
    name = "commodity_fx_leads_energy"
    display_name = "Commodity currencies lead energy"
    description = ("Owns energy futures after the Australian, Canadian, New Zealand and South "
                   "African currencies have risen, and bets against them after they fell.")
    tags = {"family": "mixed", "asset": "commodities", "style": "lead-lag",
            "horizon": "monthly"}
    summary = ("Average 3-month log change of AUD, CAD, NZD and ZAR against USD; long all "
               "energy futures when positive, short when negative, inverse volatility "
               "weights; monthly (Chen, Rogoff and Rossi, 2010, turned into a trade).")
    reference = "hypotheses/0015-commodity-currencies-lead-energy-futures.md"
    param_grid = {"lookback": [21, 126]}

    def __init__(self, lookback: int = 63, rebalance: str = "M"):
        self.lookback = lookback
        self.rebalance = rebalance

    def instruments(self) -> list[str]:
        return FUT

    def required(self) -> list[str]:
        return FUT + COMMODITY_FX

    def signal(self, panel: pd.DataFrame) -> pd.DataFrame:
        fx = panel[COMMODITY_FX]
        lead = np.log(fx / fx.shift(self.lookback)).mean(axis=1, skipna=False)
        return pd.DataFrame({c: lead for c in FUT}).where(panel[FUT].notna().values)

    def weights(self, panel: pd.DataFrame) -> pd.DataFrame:
        raw = np.sign(self.signal(panel)) * _inverse_vol(panel, FUT)
        return hold_between_rebalances(normalise_gross(raw.fillna(0.0)), self.rebalance)
