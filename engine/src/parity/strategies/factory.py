"""The strategy factory (DEC-0014): many strategies as short recipes.

Each recipe names a building block from _blocks.py, the assets it trades, its
settings, and the labels people see. `make` turns a recipe into a registered strategy,
so it runs through the same backtest and gauntlet as a hand-written one.

Rules for adding one:
- It must be a real, named idea, ideally with a catalog entry or a paper. Do not add
  near-copies with a different lookback; put those in `param_grid` instead.
- Keep `param_grid` to at most four combinations: every combination is a trial.
- Say in the description what could make it fail.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from ..data.catalog import EM, FACTORS, G10, INDUSTRIES
from . import register
from ._blocks import (
    CASH,
    MKT,
    BreakoutBook,
    MixBook,
    OscillatorBook,
    PairBook,
    RankBook,
    TimingBook,
    TrendBook,
    past_return,
    tbill_over,
)

FX = [f"fx.{c}" for c in G10]
WIDE = FX + [f"fx.{c}" for c in EM]
IND = [f"ind.{k}" for k in INDUSTRIES]
FAC5 = ["factor.SMB", "factor.HML", "factor.MOM", "factor.RMW", "factor.CMA"]
BOND, SHORT_BOND = "bond.TR10", "bond.TR2"
assert set(FAC5) <= {f"factor.{k}" for k in FACTORS}


# Recipe settings that describe what the strategy is, not a tunable number. Everything
# else a recipe passes becomes a parameter, shown in reports and open to the gauntlet.
STRUCTURE = {"universe", "mix", "kind", "rank_on", "long_short", "long_only", "funded",
             "max_gross", "a", "b", "asset", "fallback", "leverage", "extra", "scale",
             "only_if_trending", "driver", "summary", "min_cost_bps", "cash_rate",
             "gate_level", "follow"}


def make(block, name, display_name, description, family, asset_class, style, horizon,
         reference="", grid=None, **attrs):
    """Build, label and register one strategy from a block."""
    defaults = {k: attrs.pop(k) for k in list(attrs) if k not in STRUCTURE}
    summary = attrs.pop("summary", description)
    cls = type(name, (block,), {
        "name": name, "display_name": display_name, "description": description,
        "summary": summary, "reference": reference, "param_grid": grid or {},
        "tags": {"family": family, "asset": asset_class, "style": style, "horizon": horizon},
        "defaults": {**block.defaults, **defaults}, "__module__": __name__, **attrs,
    })
    return register(cls)


# --- currencies: trend --------------------------------------------------------------

make(TrendBook, "fx_trend_3m", "Currency trend, 3-month",
     "Owns currencies that rose over the past three months and bets against those that fell. "
     "Faster than the one-year version, so it turns sooner but trades more.",
     "trend", "fx", "momentum", "monthly", "algorithms/0015-fx-time-series-momentum.md",
     universe=FX, lookback=63, grid={"lookback": [42, 63, 126]})

make(TrendBook, "fx_trend_1m", "Currency trend, 1-month",
     "Follows each currency's last month. Short trends in currencies are noisy; costs may "
     "eat the edge.", "trend", "fx", "momentum", "weekly",
     "algorithms/0015-fx-time-series-momentum.md", universe=FX, lookback=21, rebalance="W",
     grid={"lookback": [10, 21]})

make(BreakoutBook, "fx_donchian", "Currency breakout (Turtle)",
     "Buys a currency that breaks its 55-day high and sells one that breaks its 55-day low, "
     "exiting on a 20-day reversal, as the Turtle traders did. Breakouts often fail in "
     "sideways markets.", "trend", "fx", "breakout", "daily",
     "algorithms/0072-turtle-donchian-breakout.md", universe=FX,
     grid={"entry": [20, 55], "exit": [10, 20]})

make(OscillatorBook, "fx_macd", "Currency MACD",
     "Long a currency when its MACD line is above its signal line, short when below. A popular "
     "retail rule; it trades often and lags turns.", "trend", "fx", "chart indicator", "daily",
     "algorithms/0065-macd-crossover.md", universe=FX, kind="macd")

make(OscillatorBook, "fx_ichimoku", "Currency Ichimoku cloud",
     "Long a currency trading above its Ichimoku cloud, short below, flat inside. Popular in "
     "FX forums; rarely tested after costs.", "trend", "fx", "chart indicator", "daily",
     "algorithms/0062-ichimoku-cloud.md", universe=FX, kind="ichimoku")

make(OscillatorBook, "fx_bollinger_fade", "Currency Bollinger fade",
     "Bets a currency snaps back after moving more than two standard deviations from its "
     "20-day average. Loses when a move keeps going.", "value", "fx", "mean reversion", "daily",
     "algorithms/0055-bollinger-band-reversion-breakout.md", universe=FX, kind="bollinger",
     grid={"band": [1.5, 2.0, 2.5]})


class _DollarTrend(TrendBook):
    """All currencies on the same side, following the trend of the average currency."""

    def signal(self, panel):
        basket = np.log(panel[self.universe]).diff().mean(axis=1).cumsum()
        trend = np.sign(basket - basket.shift(self.lookback))
        return pd.DataFrame({c: trend for c in self.universe})

    def weights(self, panel):
        from ._util import hold_between_rebalances
        w = self.signal(panel).div(len(self.universe))
        return hold_between_rebalances(w.where(panel[self.universe].notna().values, 0.0),
                                       self.rebalance)


make(_DollarTrend, "fx_dollar_trend", "Dollar trend",
     "Bets on or against the dollar as a whole, following its trend over the past three "
     "months. One bet, so it can be wrong for long stretches.", "trend", "fx", "momentum",
     "monthly", "algorithms/0015-fx-time-series-momentum.md", universe=FX, lookback=63,
     grid={"lookback": [63, 126, 252]})

# --- currencies: ranking ------------------------------------------------------------

make(RankBook, "fx_momentum_1m", "Currency winners, 1-month",
     "Owns the three currencies that rose most last month and bets against the three that "
     "fell most. Short-term momentum is weak in currencies.", "trend", "fx", "momentum",
     "monthly", "algorithms/0005-fx-cross-sectional-momentum.md", universe=FX, lookback=21,
     skip=0, grid={"k": [2, 3]})

make(RankBook, "fx_reversal_1w", "Currency losers bounce, 1-week",
     "Owns last week's three weakest currencies and bets against the three strongest, "
     "expecting a bounce. Pays the most in trading costs of any currency rule here.",
     "value", "fx", "mean reversion", "weekly", "algorithms/0080-fx-low-volume-reversal.md",
     universe=FX, rank_on="reversal", lookback=5, skip=0, rebalance="W", grid={"k": [2, 3]})

make(RankBook, "fx_value_5y", "Currency five-year value",
     "Owns the currencies that fell most over five years and bets against those that rose "
     "most, a simple stand-in for purchasing power parity. Value can take years to pay.",
     "value", "fx", "mean reversion", "multi-month", "algorithms/0017-fx-value-ppp.md",
     universe=FX, rank_on="reversal", lookback=1260, skip=21, grid={"k": [2, 3]})

make(RankBook, "fx_carry_top1", "Currency carry, one pair",
     "Owns the single highest-interest currency against the single lowest. Concentrated, so "
     "one crash can wipe out years.", "carry", "fx", "risk premium", "monthly",
     "algorithms/0073-fx-static-carry.md", universe=FX, rank_on="carry", k=1)

make(RankBook, "fx_carry_top2", "Currency carry, two pairs",
     "Owns the two highest-interest currencies against the two lowest.", "carry", "fx",
     "risk premium", "monthly", "algorithms/0001-fx-carry-g10.md", universe=FX,
     rank_on="carry", k=2)


class _CarryCalm(RankBook):
    """Carry, switched off while fear (the VIX) is in the top fifth of its past year."""

    extra = ["risk.VIX"]

    def gate(self, panel):
        vix = panel["risk.VIX"]
        high = vix.rolling(252, min_periods=126).quantile(self.quantile)
        return (vix <= high).astype(float)


make(_CarryCalm, "fx_carry_calm", "Currency carry, calm markets only",
     "Currency carry that steps aside when the VIX fear gauge is unusually high, since carry "
     "crashes come in panics. The filter can miss the first day of a crash.", "carry", "fx",
     "risk premium", "monthly", "algorithms/0002-fx-carry-volatility-timing.md", universe=FX,
     rank_on="carry", rebalance="W", quantile=0.8, grid={"quantile": [0.7, 0.8, 0.9]})

make(RankBook, "fx_carry_momentum", "Currency carry plus momentum",
     "Ranks currencies on interest rate and three-month trend together, owning the best "
     "three and betting against the worst three.", "mixed", "fx", "multi-factor", "monthly",
     "algorithms/0051-trend-plus-carry-combined.md", universe=FX, rank_on="carry_and_momentum",
     lookback=63, skip=0)

make(RankBook, "fx_rate_momentum", "Rising rates",
     "Owns the currencies whose interest rates rose most over six months and bets against "
     "those that fell most, following central banks. Rates are monthly data.", "trend", "fx",
     "macro momentum", "monthly", "algorithms/0007-fx-economic-momentum.md", universe=FX,
     rank_on="rate_change", lookback=126, grid={"lookback": [63, 126, 252]})

make(RankBook, "fx_calm_currencies", "Calm currencies",
     "Owns the three steadiest currencies and bets against the three most volatile. A test "
     "of the low-volatility idea in currencies.", "volatility", "fx", "low volatility",
     "monthly", "algorithms/0037-betting-against-beta.md", universe=FX, rank_on="low_vol",
     lookback=63, grid={"lookback": [63, 252]})

make(RankBook, "fx_near_high", "Currencies near their high",
     "Owns the currencies closest to their one-year high and bets against those furthest "
     "below, an anchoring effect found in stocks.", "trend", "fx", "anchoring", "monthly",
     "algorithms/0005-fx-cross-sectional-momentum.md", universe=FX, rank_on="near_high")

make(RankBook, "fx_wide_momentum", "Wide currency winners",
     "Currency winners across 21 currencies, including emerging ones like the peso and rand. "
     "Emerging currencies earn interest we do not count, which hurts the short side less "
     "than the long.", "trend", "fx", "momentum", "monthly",
     "algorithms/0005-fx-cross-sectional-momentum.md", universe=WIDE, k=4,
     grid={"k": [3, 4, 5]})

make(RankBook, "fx_wide_reversal", "Wide currency losers bounce",
     "Owns last month's weakest of 21 currencies and bets against the strongest.", "value",
     "fx", "mean reversion", "monthly", "algorithms/0080-fx-low-volume-reversal.md",
     universe=WIDE, rank_on="reversal", lookback=21, skip=0, k=4)

make(TrendBook, "fx_wide_trend", "Wide currency trend",
     "Follows each of 21 currencies' one-year trend. Many emerging currencies are managed by "
     "their central banks, which can break trends overnight.", "trend", "fx", "momentum",
     "monthly", "algorithms/0015-fx-time-series-momentum.md", universe=WIDE)

# --- currencies: macro links and pairs -----------------------------------------------


class _Linked(TrendBook):
    """One currency follows the trend of something its economy sells."""

    driver = ""

    def required(self):
        return self.universe + [self.driver]

    def signal(self, panel):
        side = np.sign(past_return(panel[self.driver], self.lookback))
        return pd.DataFrame({c: side for c in self.universe})

    def weights(self, panel):
        from ._util import hold_between_rebalances
        w = self.signal(panel).div(len(self.universe)).fillna(0.0)
        return hold_between_rebalances(w, self.rebalance)


make(_Linked, "fx_oil_cad", "Oil to Canadian dollar",
     "Owns the Canadian dollar while oil has risen over the past three months, and bets "
     "against it while oil has fallen. The link has weakened since 2015.", "value", "fx",
     "commodity link", "weekly", "algorithms/0012-fx-oil-cad-daily.md", universe=["fx.CAD"],
     driver="cmd.WTI", lookback=63, rebalance="W", grid={"lookback": [21, 63, 126]})

make(_Linked, "fx_oil_nok", "Oil to Norwegian krone",
     "Owns the krone while oil is in an uptrend over three months, otherwise bets against "
     "it.", "value", "fx", "commodity link", "weekly",
     "algorithms/0004-fx-commodity-terms-of-trade.md",
     universe=["fx.NOK"], driver="cmd.BRENT", lookback=63, rebalance="W",
     grid={"lookback": [21, 63, 126]})

make(_Linked, "fx_copper_aud", "Copper to Australian dollar",
     "Owns the Australian dollar while copper has risen over six months. Copper is monthly "
     "data, so the signal is slow.", "value", "fx", "commodity link", "monthly",
     "algorithms/0004-fx-commodity-terms-of-trade.md", universe=["fx.AUD"], driver="cmd.COPPER",
     lookback=126, grid={"lookback": [63, 126]})


class _SafeHaven(TrendBook):
    """When fear is high, own the yen and franc against the Aussie and Kiwi dollars."""

    def required(self):
        return self.universe + ["risk.VIX"]

    def weights(self, panel):
        from ._util import hold_between_rebalances
        on = (panel["risk.VIX"] > self.level).astype(float)
        w = pd.DataFrame({"fx.JPY": on / 4, "fx.CHF": on / 4, "fx.AUD": -on / 4,
                          "fx.NZD": -on / 4}, index=panel.index)
        return hold_between_rebalances(w, self.rebalance)


make(_SafeHaven, "fx_safe_haven", "Safe havens in a panic",
     "When the VIX is above 25, owns the yen and Swiss franc against the Australian and New "
     "Zealand dollars, the classic flight to safety. Idle the rest of the time.", "volatility",
     "fx", "risk off", "daily", "algorithms/0002-fx-carry-volatility-timing.md",
     universe=["fx.JPY", "fx.CHF", "fx.AUD", "fx.NZD"], rebalance="D", level=25,
     grid={"level": [20, 25, 30]})

make(MixBook, "fx_short_dollar", "Short the dollar",
     "Owns every major currency against the dollar in equal parts, always. A plain baseline "
     "for the other currency rules.", "mixed", "fx", "baseline", "monthly",
     "algorithms/0006-fx-dollar-carry.md", mix={c: 1 / len(FX) for c in FX})

make(PairBook, "fx_pair_nok_sek", "Krone against krona",
     "Trades the Norwegian krone against the Swedish krona when their ratio stretches far "
     "from its average, betting it comes back. Close neighbours, but oil can pull them apart.",
     "value", "fx", "pairs", "daily", "algorithms/0045-pairs-trading-distance.md",
     a="fx.NOK", b="fx.SEK", grid={"window": [60, 120, 250]})

make(PairBook, "fx_pair_aud_nzd", "Aussie against Kiwi",
     "Trades the Australian dollar against the New Zealand dollar when their ratio stretches "
     "far from normal.", "value", "fx", "pairs", "daily",
     "algorithms/0045-pairs-trading-distance.md", a="fx.AUD", b="fx.NZD",
     grid={"window": [60, 120, 250]})

make(PairBook, "fx_pair_eur_chf", "Euro against franc",
     "Trades the euro against the Swiss franc when their ratio stretches. Includes January "
     "2015, when the Swiss central bank dropped its floor and the franc jumped 20% in "
     "minutes.", "value", "fx", "pairs", "daily", "algorithms/0045-pairs-trading-distance.md",
     a="fx.EUR", b="fx.CHF", grid={"window": [60, 120, 250]})

# --- US stocks: in or out -----------------------------------------------------------


def _timing(name, display, description, style, horizon, reference, rule, extra=(),
            grid=None, asset_class="stocks", **attrs):
    def invested(self, panel):
        return rule(self, panel)
    block = type(f"_{name}", (TimingBook,), {"invested": invested, "extra": list(extra),
                                              "__module__": __name__})
    family = next((f for f in ("trend", "volatility", "calendar") if f in style), "mixed")
    return make(block, name, display, description, family, asset_class, style, horizon,
                reference, grid, **attrs)


def _sma(s, n):
    return s.rolling(n, min_periods=n).mean()


_timing("stocks_absolute_momentum", "Stock absolute momentum",
        "Holds US stocks while they beat T-bills over the past year, otherwise cash "
        "(Antonacci). Late to re-enter after sharp V-shaped recoveries.", "trend timing",
        "monthly", "algorithms/0040-dual-momentum.md",
        lambda s, p: past_return(p[MKT], s.lookback) > tbill_over(p, s.lookback),
        extra=["rate.TBILL3M"], lookback=252, grid={"lookback": [126, 252]})

_timing("stocks_trend_100d_daily", "Stock trend, checked daily",
        "Holds US stocks while they are above their 100-day average, checked every day. Reacts "
        "fast but gets whipsawed in choppy markets.", "trend timing", "daily",
        "algorithms/0043-managed-futures-trend-following.md",
        lambda s, p: p[MKT] > _sma(p[MKT], s.days), days=100, rebalance="D",
        grid={"days": [50, 100, 200]})

_timing("stocks_vix_calm", "Stocks when fear is low",
        "Holds US stocks while the VIX is below its one-year average, otherwise cash. Fear "
        "spikes often come after the fall.", "volatility timing", "daily",
        "algorithms/0054-volatility-managed-portfolios.md",
        lambda s, p: p["risk.VIX"] < _sma(p["risk.VIX"], s.window), extra=["risk.VIX"],
        window=252, rebalance="D", grid={"window": [63, 252]})

_timing("stocks_vix_below_30", "Stocks unless panic",
        "Holds US stocks unless the VIX is above 30. Out only in real panics, which are also "
        "when the best rebound days happen.", "volatility timing", "daily",
        "algorithms/0054-volatility-managed-portfolios.md",
        lambda s, p: p["risk.VIX"] < s.level, extra=["risk.VIX"], level=30, rebalance="D",
        grid={"level": [25, 30, 40]})

_timing("stocks_yield_curve", "Stocks unless the yield curve inverts",
        "Holds US stocks unless 2-year Treasury yields are above 10-year yields, a classic "
        "recession warning. Inversions come years early and rarely.", "macro timing", "monthly",
        "algorithms/0074-fx-output-gap-business-cycle.md",
        lambda s, p: (p["bond.UST10Y"] - p["bond.UST2Y"]) > 0,
        extra=["bond.UST10Y", "bond.UST2Y"])

_timing("stocks_yield_curve_3m", "Stocks unless 10-year below T-bill",
        "Holds US stocks unless the 10-year Treasury yield is below the 3-month T-bill rate, "
        "the curve measure the New York Fed watches.", "macro timing", "monthly",
        "algorithms/0074-fx-output-gap-business-cycle.md",
        lambda s, p: (p["bond.UST10Y"] - p["rate.TBILL3M"]) > 0,
        extra=["bond.UST10Y", "rate.TBILL3M"])


def _drawdown_stop(s, p):
    px = p[MKT]
    dd = px / px.rolling(252, min_periods=20).max() - 1
    state = pd.Series(np.nan, index=px.index)
    state[px > _sma(px, 210)] = 1.0
    state[dd < -s.stop] = 0.0
    return state.ffill().fillna(1.0)


_timing("stocks_drawdown_stop", "Stocks with a stop loss",
        "Holds US stocks but sells after a fall of 15% from the one-year high, buying back "
        "once they are above their 10-month average. Selling low is the risk.", "trend timing",
        "daily", "algorithms/0043-managed-futures-trend-following.md", _drawdown_stop,
        stop=0.15, rebalance="D", grid={"stop": [0.1, 0.15, 0.2]})

_timing("stocks_oil_shock", "Stocks unless oil spikes",
        "Holds US stocks unless oil has risen more than 50% in three months, which preceded "
        "several recessions. Rare signal, so few chances to prove itself.", "macro timing",
        "monthly", "algorithms/0004-fx-commodity-terms-of-trade.md",
        lambda s, p: past_return(p["cmd.WTI"], 63) < s.spike, extra=["cmd.WTI"], spike=0.5,
        grid={"spike": [0.3, 0.5]})

_timing("stocks_falling_rates", "Stocks while rates fall",
        "Holds US stocks while the 10-year Treasury yield is below its one-year average.",
        "macro timing", "monthly", "algorithms/0074-fx-output-gap-business-cycle.md",
        lambda s, p: p["bond.UST10Y"] < _sma(p["bond.UST10Y"], 252), extra=["bond.UST10Y"])

_timing("stocks_copper_up", "Stocks while copper rises",
        "Holds US stocks while copper, a gauge of world growth, is up over six months.",
        "macro timing", "monthly", "algorithms/0004-fx-commodity-terms-of-trade.md",
        lambda s, p: past_return(p["cmd.COPPER"], 126) > 0, extra=["cmd.COPPER"])

_timing("stocks_skip_weekend", "Stocks without the weekend",
        "Holds US stocks every night except over the weekend, testing the old weekend effect "
        "(Monday returns were once negative). It trades twice a week.", "calendar timing",
        "daily", "algorithms/0052-turn-of-the-month.md",
        lambda s, p: pd.Series(p.index.dayofweek != 4, index=p.index), rebalance="D")


def _rsi(px, n):
    d = px.diff()
    up = d.clip(lower=0).ewm(alpha=1 / n, adjust=False).mean()
    down = (-d.clip(upper=0)).ewm(alpha=1 / n, adjust=False).mean()
    return 100 - 100 / (1 + up / down.replace(0.0, np.nan))


def _rsi2_dip(s, p):
    px = p[MKT]
    state = pd.Series(np.nan, index=px.index)
    state[px > _sma(px, 5)] = 0.0
    state[(_rsi(px, 2) < s.level) & (px > _sma(px, 200))] = 1.0
    return state.ffill().fillna(0.0)


_timing("stocks_rsi2_dip", "Stock RSI(2) dip buying",
        "Buys US stocks after a short, sharp dip (two-day RSI below 10) in an uptrend and "
        "sells once price is back above its five-day average (Connors). Rarely invested.",
        "mean reversion timing", "daily", "algorithms/0070-rsi-overbought-oversold.md",
        _rsi2_dip, level=10, rebalance="D", grid={"level": [5, 10, 20]})

_timing("stocks_trend_leveraged", "Stock trend with leverage",
        "Holds US stocks at 1.5 times while above their 10-month average, otherwise cash. "
        "Borrowing costs the T-bill plus 0.5%.", "trend timing", "monthly",
        "algorithms/0043-managed-futures-trend-following.md",
        lambda s, p: p[MKT] > _sma(p[MKT], 210), leverage=1.5, max_gross=1.5)

_timing("stocks_trend_or_bonds", "Stock trend, else bonds",
        "Holds US stocks while above their 10-month average, otherwise 10-year Treasuries "
        "instead of cash. Fails when stocks and bonds fall together, as in 2022.",
        "trend timing", "monthly", "algorithms/0040-dual-momentum.md",
        lambda s, p: p[MKT] > _sma(p[MKT], 210), fallback=BOND, asset_class="mixed")

_timing("stocks_dual_momentum", "Dual momentum, stocks or bonds",
        "Holds US stocks while they beat T-bills over a year, otherwise bonds (Antonacci's "
        "dual momentum, US only).", "trend timing", "monthly", "algorithms/0040-dual-momentum.md",
        lambda s, p: past_return(p[MKT], 252) > tbill_over(p, 252), fallback=BOND,
        extra=["rate.TBILL3M"], asset_class="mixed")

_timing("stocks_flight_to_bonds", "Bonds in a panic",
        "Holds US stocks, switching to 10-year Treasuries while the VIX is above 25.",
        "volatility timing", "daily", "algorithms/0054-volatility-managed-portfolios.md",
        lambda s, p: p["risk.VIX"] < s.level, fallback=BOND, extra=["risk.VIX"], level=25,
        rebalance="D", grid={"level": [20, 25, 30]}, asset_class="mixed")

make(BreakoutBook, "stocks_donchian", "Stock breakout (Turtle)",
     "Buys US stocks after a 55-day high and moves to cash after a 20-day low. Long or "
     "cash only, as most stock traders run it.", "trend", "stocks", "breakout", "daily",
     "algorithms/0072-turtle-donchian-breakout.md", universe=[MKT], long_only=True,
     funded=True, grid={"entry": [55, 100]})

make(OscillatorBook, "stocks_macd", "Stock MACD",
     "Holds US stocks when MACD is above its signal line, otherwise cash.", "trend", "stocks",
     "chart indicator", "daily", "algorithms/0065-macd-crossover.md", universe=[MKT],
     kind="macd", long_only=True, funded=True)

# --- stocks and bonds together ------------------------------------------------------

make(MixBook, "sixty_forty", "60/40 stocks and bonds",
     "60% US stocks and 40% 10-year Treasuries, rebalanced monthly. The classic balanced "
     "portfolio; its weak spot is inflation, when both fall.", "mixed", "mixed", "balanced",
     "monthly", "algorithms/0048-sixty-forty-portfolio.md", mix={MKT: 0.6, BOND: 0.4},
     funded=True)

make(MixBook, "risk_parity_stocks_bonds", "Risk parity, stocks and bonds",
     "Splits money between US stocks and Treasuries so each carries the same risk, then "
     "scales to 10% volatility with borrowing. Leans heavily on bonds.", "volatility", "mixed",
     "risk parity", "monthly", "algorithms/0046-risk-parity.md", mix={MKT: 0.5, BOND: 0.5},
     scale="inverse_vol", vol_target=0.10, funded=True, max_gross=2.0,
     grid={"vol_target": [0.08, 0.10, 0.12]})

make(MixBook, "stocks_bonds_trend", "Stocks and bonds, each with a trend filter",
     "Half in US stocks and half in Treasuries, but each half goes to cash while its asset "
     "is down over the past year.", "trend", "mixed", "trend timing", "monthly",
     "algorithms/0043-managed-futures-trend-following.md", mix={MKT: 0.5, BOND: 0.5},
     only_if_trending=True, funded=True, grid={"lookback": [126, 252]})

make(MixBook, "thirds", "Stocks, bonds and cash in thirds",
     "A third each in US stocks, 10-year Treasuries and T-bills, rebalanced monthly. Dull on "
     "purpose: a check on whether fancier mixes add anything.", "mixed", "mixed", "balanced",
     "monthly", "algorithms/0048-sixty-forty-portfolio.md", mix={MKT: 1 / 3, BOND: 1 / 3},
     funded=True)

_timing("bonds_trend", "Treasury trend",
        "Holds 10-year Treasuries while they are above their 10-month average, otherwise "
        "T-bills.", "trend timing", "monthly", "algorithms/0043-managed-futures-trend-following.md",
        lambda s, p: p[BOND] > _sma(p[BOND], 210), asset=BOND, asset_class="mixed")

_timing("bonds_term_premium", "Long bonds when the curve is steep",
        "Holds 10-year Treasuries when they yield at least one point more than 2-year notes, "
        "otherwise 2-year notes.", "macro timing", "monthly",
        "algorithms/0073-fx-static-carry.md",
        lambda s, p: (p["bond.UST10Y"] - p["bond.UST2Y"]) > s.gap, asset=BOND,
        fallback=SHORT_BOND, extra=["bond.UST10Y", "bond.UST2Y"], gap=1.0, asset_class="mixed",
        grid={"gap": [0.5, 1.0, 1.5]})

# --- US industries ------------------------------------------------------------------

make(RankBook, "industry_momentum", "Industry momentum",
     "Owns the three US industries that rose most over the past year (skipping the last "
     "month), rebalanced monthly (Moskowitz and Grinblatt).", "trend", "stocks", "momentum",
     "monthly", "algorithms/0042-equity-cross-sectional-momentum.md", universe=IND,
     long_short=False, funded=True, grid={"lookback": [126, 252], "k": [2, 3]})

make(RankBook, "industry_momentum_ls", "Industry momentum, long and short",
     "Owns the three strongest US industries and shorts the three weakest. Momentum crashes "
     "hit the short side in sharp rebounds, as in 2009.", "trend", "stocks", "momentum",
     "monthly", "algorithms/0042-equity-cross-sectional-momentum.md", universe=IND)

make(RankBook, "industry_reversal", "Industry losers bounce",
     "Owns last month's three weakest US industries and shorts the three strongest.",
     "value", "stocks", "mean reversion", "monthly", "algorithms/0080-fx-low-volume-reversal.md",
     universe=IND, rank_on="reversal", lookback=21, skip=0)

make(RankBook, "industry_low_vol", "Calm industries",
     "Owns the four US industries with the steadiest prices over the past year. Low "
     "volatility stocks have done about as well as risky ones, at less risk.", "volatility",
     "stocks", "low volatility", "monthly", "algorithms/0037-betting-against-beta.md",
     universe=IND, rank_on="low_vol", long_short=False, k=4, funded=True,
     grid={"k": [3, 4, 6]})

make(RankBook, "industry_long_reversal", "Industry five-year losers",
     "Owns the three US industries that fell furthest behind over five years, betting on a "
     "comeback (De Bondt and Thaler).", "value", "stocks", "mean reversion", "multi-month",
     "algorithms/0053-value-hml.md", universe=IND, rank_on="reversal", lookback=1260, skip=252,
     long_short=False, funded=True)

make(RankBook, "industry_seasonal", "Industry seasonality",
     "Owns the three US industries that did best in the coming calendar month in past years "
     "(Heston and Sadka). Ten years of history per month is a thin sample.", "calendar",
     "stocks", "seasonal", "monthly", "algorithms/0047-sell-in-may-halloween.md", universe=IND,
     rank_on="same_month", lookback=10, long_short=False, funded=True)

make(RankBook, "industry_near_high", "Industries near their high",
     "Owns the three US industries closest to their 52-week high (George and Hwang).",
     "trend", "stocks", "anchoring", "monthly",
     "algorithms/0042-equity-cross-sectional-momentum.md", universe=IND, rank_on="near_high",
     long_short=False, funded=True)

make(TrendBook, "industry_trend", "Industries, each with a trend filter",
     "An equal slice in each of 12 US industries, each slice in cash while its industry is "
     "down over the past year.", "trend", "stocks", "trend timing", "monthly",
     "algorithms/0043-managed-futures-trend-following.md", universe=IND, long_only=True,
     funded=True, grid={"lookback": [126, 252]})

make(MixBook, "industry_equal", "Equal-weight industries",
     "An equal share in each of 12 US industries, rebalanced monthly. Naive 1/N often beats "
     "clever weighting out of sample (DeMiguel and others).", "mixed", "stocks", "baseline",
     "monthly", "algorithms/0046-risk-parity.md", mix={c: 1 / len(IND) for c in IND},
     funded=True)

make(MixBook, "industry_risk_parity", "Industries weighted by calm",
     "Weights the 12 US industries by the inverse of their volatility, so steady ones get "
     "more money.", "volatility", "stocks", "risk parity", "monthly",
     "algorithms/0046-risk-parity.md", mix={c: 1 / len(IND) for c in IND},
     scale="inverse_vol", funded=True)


class _Defensive(TimingBook):
    """Defensive industries when fear is high, the whole market otherwise."""

    def instruments(self):
        return [MKT, "ind.NoDur", "ind.Utils", "ind.Hlth", CASH]

    def required(self):
        return [MKT, "ind.NoDur", "ind.Utils", "ind.Hlth", "risk.VIX", "rate.USD"]

    def weights(self, panel):
        from ._util import hold_between_rebalances
        fear = (panel["risk.VIX"] > self.level).astype(float)
        w = pd.DataFrame({MKT: 1 - fear, "ind.NoDur": fear / 3, "ind.Utils": fear / 3,
                          "ind.Hlth": fear / 3, CASH: 0.0}, index=panel.index)
        return hold_between_rebalances(w, self.rebalance)


make(_Defensive, "industry_defensive_in_fear", "Defensive industries in a panic",
     "Holds the US market, switching to consumer staples, utilities and health care while "
     "the VIX is above 25.", "volatility", "stocks", "sector rotation", "daily",
     "algorithms/0054-volatility-managed-portfolios.md", rebalance="D", level=25,
     grid={"level": [20, 25, 30]})


class _CurveRotation(_Defensive):
    """Cyclical industries when the yield curve is steep, defensive when it is flat."""

    def instruments(self):
        return ["ind.Durbl", "ind.Manuf", "ind.Money", "ind.NoDur", "ind.Utils", "ind.Hlth"]

    def required(self):
        return self.instruments() + ["bond.UST10Y", "bond.UST2Y"]

    def weights(self, panel):
        from ._util import hold_between_rebalances
        steep = ((panel["bond.UST10Y"] - panel["bond.UST2Y"]) > self.gap).astype(float)
        w = pd.DataFrame({c: steep / 3 for c in ["ind.Durbl", "ind.Manuf", "ind.Money"]}
                         | {c: (1 - steep) / 3 for c in ["ind.NoDur", "ind.Utils", "ind.Hlth"]},
                         index=panel.index)
        return hold_between_rebalances(w, "M")


make(_CurveRotation, "industry_curve_rotation", "Cyclicals or defensives by the yield curve",
     "Owns cyclical industries (cars, manufacturing, banks) while the yield curve is steep "
     "and defensive ones while it is flat or inverted.", "mixed", "stocks", "sector rotation",
     "monthly", "algorithms/0074-fx-output-gap-business-cycle.md", gap=1.0,
     grid={"gap": [0.5, 1.0]})


class _EnergyTilt(_Defensive):
    """The market, plus extra energy stocks while oil is rising."""

    def instruments(self):
        return [MKT, "ind.Enrgy", CASH]

    def required(self):
        return [MKT, "ind.Enrgy", "cmd.WTI", "rate.USD"]

    def weights(self, panel):
        from ._util import hold_between_rebalances
        up = (past_return(panel["cmd.WTI"], self.lookback) > 0).astype(float)
        w = pd.DataFrame({MKT: 1 - 0.5 * up, "ind.Enrgy": 0.5 * up, CASH: 0.0},
                         index=panel.index)
        return hold_between_rebalances(w, "M")


make(_EnergyTilt, "industry_energy_on_oil", "Energy stocks while oil rises",
     "Holds the US market, moving half into energy stocks while oil is up over three months.",
     "trend", "stocks", "sector rotation", "monthly",
     "algorithms/0039-commodity-time-series-momentum.md", lookback=63,
     grid={"lookback": [63, 126]})

# --- research factors ---------------------------------------------------------------

_FAC_DESC = {
    "SMB": ("Size factor", "Owns small companies against large ones. The size premium has "
            "been weak since it was published in 1981.", "algorithms/0053-value-hml.md"),
    "HML": ("Value factor", "Owns cheap companies (high book value for their price) against "
            "expensive ones. Value lost for most of 2007 to 2020.", "algorithms/0053-value-hml.md"),
    "MOM": ("Stock momentum factor", "Owns the past year's winning stocks against the losers. "
            "Strong on average, with rare deep crashes.",
            "algorithms/0042-equity-cross-sectional-momentum.md"),
    "RMW": ("Profitability factor", "Owns highly profitable companies against weak ones "
            "(Novy-Marx).", "algorithms/0053-value-hml.md"),
    "CMA": ("Investment factor", "Owns companies that invest conservatively against those "
            "growing their assets fast.", "algorithms/0053-value-hml.md"),
    "LTREV": ("Long-term losers factor", "Owns stocks that fell most over five years against "
              "those that rose most.", "algorithms/0053-value-hml.md"),
    "STREV": ("Short-term losers factor", "Owns last month's losing stocks against last "
              "month's winners. Very high trading costs; charged 10% a year here.",
              "algorithms/0080-fx-low-volume-reversal.md"),
}

for _k, (_display, _desc, _ref) in _FAC_DESC.items():
    make(MixBook, f"factor_{_k.lower()}", _display,
         _desc + " Paper returns from Kenneth French's library, after an estimated cost.",
         "value" if _k in ("HML", "LTREV", "STREV") else "trend" if _k == "MOM" else "mixed",
         "stocks", "factor", "monthly", _ref, mix={f"factor.{_k}": 1.0})

make(MixBook, "factor_five_equal", "Five factors together",
     "Equal parts size, value, momentum, profitability and investment. Spreading across "
     "factors smooths their separate droughts.", "mixed", "stocks", "multi-factor", "monthly",
     "algorithms/0053-value-hml.md", mix={c: 1 / 5 for c in FAC5})

make(MixBook, "factor_value_momentum", "Value and momentum",
     "Half value, half momentum. They tend to win at different times (Asness, Moskowitz and "
     "Pedersen).", "mixed", "stocks", "multi-factor", "monthly",
     "algorithms/0051-trend-plus-carry-combined.md", mix={"factor.HML": 0.5, "factor.MOM": 0.5})

make(MixBook, "factor_quality", "Quality factors",
     "Half profitability, half conservative investment: companies that earn well and do not "
     "overspend.", "mixed", "stocks", "multi-factor", "monthly", "algorithms/0053-value-hml.md",
     mix={"factor.RMW": 0.5, "factor.CMA": 0.5})

make(MixBook, "factor_risk_parity", "Factors weighted by calm",
     "The five factors weighted so each carries the same risk.", "volatility", "stocks",
     "risk parity", "monthly", "algorithms/0046-risk-parity.md", mix={c: 1 / 5 for c in FAC5},
     scale="inverse_vol")

make(MixBook, "factor_momentum", "Factor momentum",
     "Holds each of the five factors only while it is up over the past year (Ehsani and "
     "Linnainmaa).", "trend", "stocks", "factor timing", "monthly",
     "algorithms/0043-managed-futures-trend-following.md", mix={c: 1 / 5 for c in FAC5},
     only_if_trending=True, grid={"lookback": [126, 252]})

make(MixBook, "factor_momentum_vol_managed", "Momentum factor, volatility managed",
     "The stock momentum factor, scaled down when it has been volatile and up when calm, "
     "aiming at 12% a year (Barroso and Santa-Clara). Cuts its worst crashes.", "volatility",
     "stocks", "risk scaling", "monthly", "algorithms/0054-volatility-managed-portfolios.md",
     mix={"factor.MOM": 1.0}, vol_target=0.12, max_gross=2.0,
     grid={"vol_target": [0.10, 0.12, 0.15]})

make(MixBook, "factor_value_vol_managed", "Value factor, volatility managed",
     "The value factor scaled to 10% volatility (Moreira and Muir).", "volatility", "stocks",
     "risk scaling", "monthly", "algorithms/0054-volatility-managed-portfolios.md",
     mix={"factor.HML": 1.0}, vol_target=0.10, max_gross=2.0)


class _JanuarySize(MixBook):
    def weights(self, panel):
        nxt = (panel.index + pd.offsets.BDay(1)).month
        on = pd.Series((nxt == 1).astype(float), index=panel.index)
        return pd.DataFrame({"factor.SMB": on}, index=panel.index)


make(_JanuarySize, "factor_january_size", "Small stocks in January",
     "Owns small against large companies only in January, the old January effect. Largely "
     "gone since it became famous.", "calendar", "stocks", "seasonal", "monthly",
     "algorithms/0047-sell-in-may-halloween.md", mix={"factor.SMB": 1.0}, rebalance="D")


class _MomentumCrashGuard(MixBook):
    def required(self):
        return ["factor.MOM", MKT]

    def weights(self, panel):
        from ._util import hold_between_rebalances
        bear = past_return(panel[MKT], 504) < 0
        return hold_between_rebalances(pd.DataFrame({"factor.MOM": (~bear).astype(float)},
                                                    index=panel.index), "M")


make(_MomentumCrashGuard, "factor_momentum_crash_guard", "Momentum, off after bear markets",
     "The stock momentum factor, switched off while the market is down over two years, when "
     "momentum crashes happen (Daniel and Moskowitz).", "trend", "stocks", "factor timing",
     "monthly", "algorithms/0042-equity-cross-sectional-momentum.md", mix={"factor.MOM": 1.0})

make(MixBook, "market_plus_factors", "Market plus factors",
     "The US stock market with half a unit of the five-factor mix on top. Adds risk; the "
     "question is whether it adds more return.", "mixed", "stocks", "multi-factor", "monthly",
     "algorithms/0053-value-hml.md", mix={MKT: 1.0} | {c: 0.1 for c in FAC5}, funded=True,
     max_gross=1.5)

# --- commodities --------------------------------------------------------------------

make(PairBook, "oil_brent_wti", "Brent against WTI",
     "Trades the gap between the two main oil prices when it stretches from normal, a day "
     "late, because Brent closes in London hours before WTI in New York and acting the same "
     "day fakes an edge. The gap moved for years when US shale changed the market in 2011.",
     "value", "commodities", "pairs", "daily", "algorithms/0045-pairs-trading-distance.md",
     a="cmd.BRENT", b="cmd.WTI", funded=False, delay=1, grid={"window": [60, 120, 250]})

class _Reversal(TrendBook):
    def signal(self, panel):
        return -past_return(panel[self.universe], self.lookback)


make(_Reversal, "oil_reversal", "Oil snaps back",
     "Bets against oil's last month: owns it after a fall, shorts it after a rise. Spot "
     "prices, not futures, so roll costs are ignored.", "value", "commodities", "mean reversion",
     "weekly", "algorithms/0039-commodity-time-series-momentum.md", universe=["cmd.WTI"],
     lookback=21, rebalance="W", grid={"lookback": [10, 21, 63]})


# No natural gas recipe: the only gas price we have is Henry Hub spot, which jumps
# 85% in a day in cold snaps (January 2024, January 2026). Futures, the thing people
# actually trade, move far less. Holding spot gas faked a +2,600% "Natural gas into
# winter" (removed 2026-10-22). Gas stays a signal only until we have futures data.

# Copper is a monthly average, not a price anyone could trade at: averaging makes it look
# trendier than it is. It is used only as a signal (fx_copper_aud, stocks_copper_up).
make(TrendBook, "oil_trend", "Oil trend",
     "Owns Brent crude while it is up over six months, otherwise cash. Spot prices; futures "
     "holders also pay or earn a roll this ignores.", "trend", "commodities", "momentum",
     "monthly", "algorithms/0039-commodity-time-series-momentum.md", universe=["cmd.BRENT"],
     long_only=True, lookback=126, funded=True, grid={"lookback": [63, 126, 252]})

# CASH is re-exported so recipes in other modules can use it.
__all__ = ["make", "CASH"]
