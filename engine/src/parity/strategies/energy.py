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

from ..data import futures
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


def _rank_score(sig: pd.DataFrame) -> pd.DataFrame:
    """Cross-sectional rank mapped to -1 (lowest) .. +1 (highest); NaN where fewer than 2."""
    n = sig.notna().sum(axis=1)
    return (sig.rank(axis=1) - 1).div((n - 1).replace(0, np.nan), axis=0) * 2 - 1


@register
class EnergyBook(Strategy):
    name = "energy_book"
    display_name = "Energy book"
    description = ("Scores oil, heating oil, gasoline and gas futures on four published "
                   "signals (carry, basis-momentum, five-year value and trend), averages the "
                   "scores with equal weights, and holds each contract in proportion.")
    tags = {"family": "mixed", "asset": "commodities", "style": "multi-style",
            "horizon": "monthly"}
    summary = ("Per contract, the equal-weight average of four scores: ranks of carry "
               "12 * ln(C2 / C3), of basis-momentum (12-month return of holding contract 2 "
               "minus holding contract 3) and of value (minus ln of C2 over its average 4.5 "
               "to 5.5 years ago), each mapped to -1..+1, and the sign of the 12-month return. "
               "Inverse volatility weights; monthly (RES-0016, ALG-0098).")
    reference = "hypotheses/0016-an-equal-weight-energy-book-pays-after-2014.md"
    param_grid = {"lookback": [126, 504]}

    def __init__(self, lookback: int = 252, rebalance: str = "M"):
        self.lookback = lookback
        self.rebalance = rebalance

    def instruments(self) -> list[str]:
        return FUT

    def required(self) -> list[str]:
        curves = [f"curve.{s}{n}" for s in ENERGY for n in (2, 3)]
        return FUT + CARRY + curves

    def _third(self, panel: pd.DataFrame, sym: str) -> pd.Series:
        """Excess return index of holding contract 3, built like fut.<X> holds contract 2."""
        start = futures.INDEX_START.get(sym)
        c2, c3 = (panel[f"curve.{sym}{n}"].dropna().loc[start:] for n in (2, 3))
        if min(len(c2), len(c3)) < 2:
            return pd.Series(np.nan, index=panel.index)
        idx = futures.rolled_index(c2, c3, futures.EXPIRY_RULES[sym], roll_cost_bps=0.0)
        return idx.reindex(panel.index).ffill()

    def scores(self, panel: pd.DataFrame) -> dict[str, pd.DataFrame]:
        n = self.lookback
        fut = panel[FUT]
        carry = panel[CARRY].set_axis(FUT, axis=1)
        third = pd.DataFrame({f"fut.{s}": self._third(panel, s) for s in ENERGY})
        basis_mom = np.log(fut / fut.shift(n)) - np.log(third / third.shift(n))
        c2 = panel[[f"curve.{s}2" for s in ENERGY]].set_axis(FUT, axis=1)
        c2 = c2.where(c2 > 0)
        past = c2.shift(1134).rolling(253).mean()  # 4.5 to 5.5 years ago
        value = -np.log(c2 / past)
        trend = np.sign(np.log(fut / fut.shift(n)))
        sigs = {"carry": carry, "basis_momentum": basis_mom, "value": value, "trend": trend}
        live = fut.notna()
        for s in sigs.values():
            live &= s.notna()
        return {"carry": _rank_score(carry.where(live)),
                "basis_momentum": _rank_score(basis_mom.where(live)),
                "value": _rank_score(value.where(live)),
                "trend": trend.where(live)}

    def signal(self, panel: pd.DataFrame) -> pd.DataFrame:
        s = self.scores(panel)
        return (s["carry"] + s["basis_momentum"] + s["value"] + s["trend"]) / 4

    def weights(self, panel: pd.DataFrame) -> pd.DataFrame:
        raw = self.signal(panel) * _inverse_vol(panel, FUT)
        return hold_between_rebalances(normalise_gross(raw.fillna(0.0)), self.rebalance)
