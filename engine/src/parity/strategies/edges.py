"""New edge families from the wider data (DEC-0025): positioning, the yield curve,
policy rates, stress regimes and the FOMC calendar.

Each recipe tests one documented idea (RES-0011). Publication lags come from the
catalog; the signals in _signals.py add a day where a release lands after the price we
trade at. Strategies that step into cash earn the T-bill there, so a day in cash scores
no excess return, and wide currency books pay at least 5 basis points a trade.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from . import _signals as S
from ._blocks import CASH, Block, RankBook, TimingBook, _finish, _PerAsset
from ._util import hold_between_rebalances
from .factory import make

BOND10, BOND5, BOND2 = "bond.TR10", "bond.TR5", "bond.TR2"
COT_UNIVERSE = [f"fx.{c}" for c in S.COT_FX]
WIDE_COST = 5.0  # basis points a trade for emerging market currencies, a rough floor


# --- positioning: CFTC Commitments of Traders ---------------------------------------

class _CotRank(RankBook):
    """Rank currencies on how far speculators lean against them: long the most
    crowded shorts, short the most crowded longs."""

    def required(self):
        return list(self.universe) + S.cot_keys([S.ccy(c) for c in self.universe])

    def signal(self, panel):
        z = S.cot_z(panel, [S.ccy(c) for c in self.universe], self.lookback)
        z.columns = self.universe
        return -z.where(panel[self.universe].notna().values)


make(_CotRank, "cot_fx_contrarian", "Currencies against the crowd",
     "Each week, owns the two currencies speculators are most short of in futures, compared "
     "with their own past three years, and bets against the two they are most long. Uses the "
     "CFTC report from the Monday after its Friday release. Crowds can stay crowded, and "
     "trend followers are the crowd.", "value", "fx", "positioning", "weekly",
     "research/0011-where-market-edges-come-from-and-which-survive.md",
     universe=COT_UNIVERSE, lookback=780, k=2, rebalance="W",
     grid={"lookback": [260, 780], "k": [2, 3]})


class _CotExtremes(_PerAsset):
    """Per currency: short when speculators are unusually long, long when unusually
    short, flat otherwise."""

    defaults = {"lookback": 780, "entry": 1.5, "rebalance": "W"}

    def required(self):
        return list(self.universe) + S.cot_keys([S.ccy(c) for c in self.universe])

    def signal(self, panel):
        z = S.cot_z(panel, [S.ccy(c) for c in self.universe], self.lookback)
        z.columns = self.universe
        side = pd.DataFrame(0.0, index=panel.index, columns=self.universe)
        return side.mask(z > self.entry, -1.0).mask(z < -self.entry, 1.0)

    def weights(self, panel):
        return _finish(self, self.signal(panel), panel[self.universe])


make(_CotExtremes, "cot_fx_extremes", "Currencies at positioning extremes",
     "Bets against a currency only when speculators' futures position is more than 1.5 "
     "standard deviations from its three-year average, and stays flat otherwise. Extremes "
     "are rare, so there are few bets to judge it on.", "value", "fx", "positioning",
     "weekly", "research/0011-where-market-edges-come-from-and-which-survive.md",
     universe=COT_UNIVERSE, grid={"entry": [1.0, 1.5, 2.0]})


def _timing(name, display, description, family, asset_class, style, horizon, rule,
            extra, grid=None, **attrs):
    """A TimingBook whose cash earns the T-bill, from a rule on the panel."""
    def invested(self, panel):
        return rule(self, panel)
    block = type(f"_{name}", (TimingBook,), {
        "invested": invested, "extra": list(extra) + [S.TBILL], "cash_rate": S.TBILL,
        "__module__": __name__})
    return make(block, name, display, description, family, asset_class, style, horizon,
                "research/0011-where-market-edges-come-from-and-which-survive.md", grid,
                **attrs)


_timing("cot_stocks_not_crowded", "Stocks unless speculators crowd in",
        "Holds US stocks unless speculators' net long in S&P 500 futures is unusually high "
        "against its past three years, then cash. Tests whether a crowded long warns of a "
        "fall. Crowded longs often come in strong markets.", "value", "stocks", "positioning",
        "weekly", lambda s, p: ~(S.cot_z(p, ["SPX_EMINI"], s.lookback)["SPX_EMINI"]
                                 > s.entry), ["cot.SPX_EMINI_PCT"], lookback=780,
        entry=1.5, rebalance="W", grid={"entry": [1.0, 1.5, 2.0]})

_timing("cot_bonds_not_crowded", "Long bonds unless speculators crowd in",
        "Holds 10-year Treasuries, moving to 2-year notes while speculators' net long in "
        "10-year futures is unusually high. Bond futures positions are bent by hedging "
        "and basis trades, which may drown the signal.", "value", "mixed", "positioning",
        "weekly", lambda s, p: ~(S.cot_z(p, ["UST10Y"], s.lookback)["UST10Y"] > s.entry),
        ["cot.UST10Y_PCT"], asset=BOND10, fallback=BOND2, lookback=780, entry=1.5,
        rebalance="W", grid={"entry": [1.0, 1.5, 2.0]})


# --- the yield curve -------------------------------------------------------------------

_timing("bonds_steep_curve", "Long bonds when the curve is steep",
        "Holds 10-year Treasuries while the gap between 10-year and 3-month yields is above "
        "its five-year median, otherwise 2-year notes. A steep curve has predicted higher "
        "bond returns (Fama and Bliss; Campbell and Shiller), but the effect is slow and "
        "noisy.", "carry", "mixed", "term premium", "monthly",
        lambda s, p: (S.curve(p, "10Y") - S.curve(p, "3M"))
        > (S.curve(p, "10Y") - S.curve(p, "3M")).rolling(s.window, min_periods=250).median(),
        ["curve.UST_10Y", "curve.UST_3M"], asset=BOND10, fallback=BOND2, window=1260,
        grid={"window": [756, 1260]})


class _Butterfly(Block):
    """A duration-neutral Treasury butterfly: long the 5-year against the 2-year and
    10-year when the 5-year yield sits unusually high on the curve, and the reverse
    when it sits unusually low; closed when curvature crosses back through its average.
    Cash balances the book so its net weight is zero."""

    cash_rate = S.TBILL
    funded = False  # a self-financing book: its capital sits in T-bills
    defaults = {"window": 756, "entry": 1.5, "rebalance": "W"}

    def instruments(self):
        return [BOND5, BOND2, BOND10, CASH]

    def required(self):
        return [BOND5, BOND2, BOND10, "curve.UST_2Y", "curve.UST_5Y", "curve.UST_10Y",
                S.TBILL, "rate.USD"]

    def signal(self, panel):
        from ._util import zscore
        return zscore(S.butterfly(panel), self.window).to_frame(BOND5)

    def weights(self, panel):
        z = self.signal(panel)[BOND5]
        entry = np.sign(z).where(z.abs() > self.entry)
        cross = pd.Series(np.where(np.sign(z) != np.sign(z.shift(1)), 0.0, np.nan),
                          index=z.index)
        side = entry.combine_first(cross).ffill().fillna(0.0)
        # Half the 5-year's duration risk against each wing, so a parallel move nets out.
        legs = {BOND5: 1.0, BOND2: -0.5 * 4.5 / 1.9, BOND10: -0.5 * 4.5 / 8.0}
        gross = sum(abs(v) for v in legs.values())
        w = pd.DataFrame({c: side * v / gross for c, v in legs.items()}, index=panel.index)
        w[CASH] = -w.sum(axis=1)
        return hold_between_rebalances(w, self.rebalance)


make(_Butterfly, "bonds_curve_butterfly", "Treasury butterfly",
     "Buys 5-year Treasuries against 2-year and 10-year ones when the 5-year yield is "
     "unusually high relative to them, and the reverse, sized so a parallel move in "
     "yields does nothing. Curvature can drift for years when the Fed is moving.",
     "value", "mixed", "curve relative value", "weekly",
     "research/0011-where-market-edges-come-from-and-which-survive.md", window=756,
     entry=1.5, rebalance="W", max_gross=2.0, grid={"entry": [1.0, 1.5, 2.0]})


class _EuroCurve(Block):
    """Long the euro while euro area 2-year yields rise against US 2-year yields over
    `lookback` days, short while they fall."""

    defaults = {"lookback": 63, "rebalance": "W"}

    def instruments(self):
        return ["fx.EUR"]

    def required(self):
        return ["fx.EUR", "curve.EA_AAA_2Y", "curve.UST_2Y"]

    def signal(self, panel):
        gap = panel["curve.EA_AAA_2Y"] - panel["curve.UST_2Y"]
        return np.sign(gap - gap.shift(self.lookback)).to_frame("fx.EUR")

    def weights(self, panel):
        return hold_between_rebalances(self.signal(panel).fillna(0.0), self.rebalance)


make(_EuroCurve, "fx_euro_vs_us_curve", "Euro on the euro against US 2-year gap",
     "Owns the euro while euro area 2-year yields gain on US 2-year yields over the past "
     "three months, and bets against it while they lose. The euro curve is used the day "
     "after the ECB publishes it. One currency pair, so one bet at a time.", "mixed", "fx",
     "rate gap momentum", "weekly",
     "research/0011-where-market-edges-come-from-and-which-survive.md", lookback=63,
     rebalance="W", grid={"lookback": [21, 63, 126]})


# --- policy rates: BIS, 27 currencies priced from ECB reference rates -------------------

class _PolicyRank(RankBook):
    """Rank currencies priced from ECB reference rates on a BIS policy-rate signal."""

    rank_on = "policy_gap"
    gate_level = None

    def required(self):
        need = list(self.universe) + S.policy_keys(self.universe)
        return need + (["risk.STLFSI"] if self.gate_level is not None else [])

    def signal(self, panel):
        if self.rank_on == "policy_change":
            sig = S.policy_change(panel, self.universe, self.lookback)
        else:
            sig = S.policy_gap(panel, self.universe)
        return sig.where(panel[self.universe].notna().values)

    def gate(self, panel):
        if self.gate_level is None:
            return None
        return (panel["risk.STLFSI"] < self.level).astype(float)


make(_PolicyRank, "xfx_policy_carry_g10", "G10 carry on policy rates",
     "Owns the three G10 currencies with the highest central bank policy rates against "
     "the dollar and bets against the three lowest, priced from ECB reference rates and "
     "earning the policy rate gap. A daily, never-late version of currency carry. Carry "
     "crashes in panics.", "carry", "fx", "risk premium", "monthly",
     "research/0011-where-market-edges-come-from-and-which-survive.md", universe=S.XG10,
     k=3, grid={"k": [2, 3]})

make(_PolicyRank, "xfx_policy_carry_wide", "Wide carry on policy rates",
     "Owns the five currencies with the highest policy rates among 27 priced from ECB "
     "reference rates, and bets against the five lowest. Each trade pays at least 5 "
     "basis points. High-rate emerging currencies can fall hard and fast, and some are "
     "managed or hard to trade.", "carry", "fx", "risk premium", "monthly",
     "research/0011-where-market-edges-come-from-and-which-survive.md", universe=S.XWIDE,
     k=5, min_cost_bps=WIDE_COST, grid={"k": [3, 5]})

make(_PolicyRank, "xfx_policy_momentum_wide", "Hiking central banks",
     "Owns the five currencies whose central banks raised rates most over the past six "
     "months and bets against the five that cut most. Hikes are announced, so markets "
     "may price them before the move. Each trade pays at least 5 basis points.",
     "trend", "fx", "policy momentum", "monthly",
     "research/0011-where-market-edges-come-from-and-which-survive.md", universe=S.XWIDE,
     rank_on="policy_change", lookback=126, k=5, min_cost_bps=WIDE_COST,
     grid={"lookback": [63, 126, 252]})

make(_PolicyRank, "xfx_policy_carry_calm", "Wide carry, off in financial stress",
     "Wide policy-rate carry, switched to cash while the St. Louis Fed stress index is "
     "above zero (more stress than average). Carry crashes cluster in stress, but the "
     "index is revised, so its history is cleaner than what was known at the time.",
     "carry", "fx", "risk premium", "monthly",
     "research/0011-where-market-edges-come-from-and-which-survive.md", universe=S.XWIDE,
     k=5, min_cost_bps=WIDE_COST, gate_level=0.0, level=0.0,
     grid={"level": [0.0, 1.0]})


# --- financial stress and the economy ------------------------------------------------

_timing("stocks_low_stress", "Stocks while stress is low",
        "Holds US stocks while the St. Louis Fed financial stress index is below a level "
        "(zero is average), otherwise cash. Uses each weekly value from its release day. "
        "The index is revised, so the test is kinder than real time.", "volatility",
        "stocks", "macro regime", "weekly",
        lambda s, p: p["risk.STLFSI"] < s.level, ["risk.STLFSI"], level=0.0,
        rebalance="W", grid={"level": [0.0, 1.0]})

_timing("stocks_conditions_easing", "Stocks while financial conditions ease",
        "Holds US stocks while the Chicago Fed financial conditions index is lower than a "
        "quarter ago, otherwise cash. Conditions tighten as prices fall, so the signal can "
        "be late. The index is revised every week.", "volatility", "stocks", "macro regime",
        "weekly", lambda s, p: p["risk.NFCI"] <= p["risk.NFCI"].shift(s.lookback),
        ["risk.NFCI"], lookback=65, rebalance="W", grid={"lookback": [65, 130]})

_timing("stocks_claims_calm", "Stocks unless layoffs climb",
        "Holds US stocks unless the four-week average of initial jobless claims is more than "
        "20% above its low of the past year, a sign the job market is turning. Each week's "
        "claims count from its Thursday release. Fast recessions beat it.", "mixed",
        "stocks", "macro regime", "weekly",
        lambda s, p: p["macro.CLAIMS"].rolling(20, min_periods=15).mean()
        / p["macro.CLAIMS"].rolling(260, min_periods=200).min() - 1 < s.rise,
        ["macro.CLAIMS"], rise=0.2, rebalance="W", grid={"rise": [0.15, 0.2, 0.3]})


# --- the FOMC calendar ---------------------------------------------------------------

_timing("stocks_pre_fomc", "Stocks before Fed announcements",
        "Holds US stocks only over scheduled Fed announcement days, otherwise cash (Lucca "
        "and Moench's pre-FOMC drift, close to close). Eight days a year, and the effect "
        "has been weaker since it was published in 2015.", "calendar", "stocks",
        "event drift", "daily", lambda s, p: S.pre_fomc(p.index), [], rebalance="D")

_timing("stocks_fomc_even_weeks", "Stocks in even FOMC weeks",
        "Holds US stocks in weeks 0, 2, 4 and 6 of the Fed meeting cycle and cash in the odd "
        "weeks, after Cieslak, Morse and Vissing-Jorgensen. Rests on the Fed's informal "
        "rhythm between meetings, which can change.", "calendar", "stocks", "event cycle",
        "daily", lambda s, p: (S.fomc_week(p.index) % 2 == 0), [], rebalance="D")

_timing("stocks_turn_of_year", "Stocks over the turn of the year",
        "Holds US stocks over the last five trading days of December and the first five of "
        "January, otherwise cash. Ten days a year; the effect is strongest in small stocks, "
        "not the market.", "calendar", "stocks", "seasonal", "daily",
        lambda s, p: S.turn_of_year(p.index, s.days), [], days=5, rebalance="D",
        grid={"days": [3, 5, 8]})
