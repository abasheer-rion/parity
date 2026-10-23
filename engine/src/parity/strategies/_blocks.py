"""Building blocks for the strategy factory (DEC-0014).

Most trading ideas are one of a few shapes: follow each asset's trend, rank assets and
hold the best, step in and out of one market on a rule, hold a fixed mix, or trade the
gap between two related prices. Each shape is one class here. A strategy in
factory.py is a recipe: a shape, a universe, its settings and its labels.

Every block decides weights at the close of day t from data up to t. The look-ahead
test in tests/test_factory.py checks this for every registered strategy.
"""

from __future__ import annotations

from collections.abc import Callable

import numpy as np
import pandas as pd

from ._util import hold_between_rebalances, normalise_gross
from .base import Strategy

CASH = "cash.USD"
MKT = "eq.US_TOTAL"
ZERO_COST = ("fx.", "xfx.", "factor.")


def past_return(px: pd.DataFrame | pd.Series, lookback: int, skip: int = 0):
    """Return from `lookback` days ago to `skip` days ago."""
    return px.shift(skip) / px.shift(lookback) - 1


def realised_vol(px: pd.DataFrame | pd.Series, window: int):
    return np.log(px).diff().rolling(window, min_periods=window // 2).std() * np.sqrt(252)


def tbill_over(panel: pd.DataFrame, days: int) -> pd.Series:
    """What the T-bill earned over the past `days`, roughly, for absolute momentum."""
    return panel["rate.TBILL3M"] / 100 * days / 252


class Block(Strategy):
    """Shared plumbing: recipes set `defaults`; any of them can be overridden."""

    defaults: dict = {}

    def __init__(self, **params):
        for k, v in {**self.defaults, **params}.items():
            setattr(self, k, v)

    def params(self) -> dict:
        return {k: v for k, v in vars(self).items() if not k.startswith("_")}


# --- follow each asset's own trend -------------------------------------------------

class TrendBook(Block):
    """Long each asset whose past return is positive, short (or cash, if long only)
    when negative, each sized by inverse volatility."""

    universe: list[str] = []
    long_only = False
    defaults = {"lookback": 252, "skip": 0, "rebalance": "M", "vol_window": 60}

    def instruments(self):
        return self.universe + ([CASH] if self.long_only else [])

    def required(self):
        return self.universe + (["rate.USD"] if self.long_only else [])

    def signal(self, panel):
        return past_return(panel[self.universe], self.lookback, self.skip)

    def weights(self, panel):
        px = panel[self.universe]
        side = np.sign(self.signal(panel))
        if self.long_only:
            # Each asset owns an equal slice of capital; a slice in a downtrend sits in cash.
            avail = px.notna().sum(axis=1).replace(0, np.nan)
            w = side.clip(lower=0).div(avail, axis=0).fillna(0.0)
            w[CASH] = 1 - w.sum(axis=1)
            return hold_between_rebalances(w, self.rebalance)
        inv = side / realised_vol(px, self.vol_window).replace(0.0, np.nan)
        return hold_between_rebalances(normalise_gross(inv.fillna(0.0)), self.rebalance)


def _finish(book, side: pd.DataFrame, px: pd.DataFrame) -> pd.DataFrame:
    """Turn a per-asset side (+1, 0, -1) into weights. Long only: an equal slice per
    asset, long or in cash. Otherwise: inverse-volatility sizing, gross 1."""
    if getattr(book, "long_only", False):
        avail = px.notna().sum(axis=1).replace(0, np.nan)
        w = side.clip(lower=0).div(avail, axis=0).fillna(0.0)
        w[CASH] = 1 - w.sum(axis=1)
        return hold_between_rebalances(w, book.rebalance)
    inv = side / realised_vol(px, 60).replace(0.0, np.nan)
    return hold_between_rebalances(normalise_gross(inv.fillna(0.0)), book.rebalance)


class _PerAsset(Block):
    universe: list[str] = []
    long_only = False

    def instruments(self):
        return self.universe + ([CASH] if self.long_only else [])

    def required(self):
        return self.universe + (["rate.USD"] if self.long_only else [])


class BreakoutBook(_PerAsset):
    """Donchian channel breakout per asset (the Turtles): long on a close above the
    `entry`-day high, short below the `entry`-day low, flat after crossing the
    `exit`-day channel the other way."""

    defaults = {"entry": 55, "exit": 20, "rebalance": "D"}

    def weights(self, panel):
        px = panel[self.universe]
        hi_e, lo_e = px.rolling(self.entry).max().shift(1), px.rolling(self.entry).min().shift(1)
        hi_x, lo_x = px.rolling(self.exit).max().shift(1), px.rolling(self.exit).min().shift(1)
        out = pd.DataFrame(0.0, index=px.index, columns=px.columns)
        for c in px.columns:
            p, state, col = px[c].values, 0.0, np.zeros(len(px))
            for i in range(len(p)):
                if np.isnan(p[i]):
                    state = 0.0
                elif state <= 0 and p[i] > hi_e[c].iat[i]:
                    state = 1.0
                elif state >= 0 and p[i] < lo_e[c].iat[i]:
                    state = -1.0
                elif state > 0 and p[i] < lo_x[c].iat[i]:
                    state = 0.0
                elif state < 0 and p[i] > hi_x[c].iat[i]:
                    state = 0.0
                col[i] = state
            out[c] = col
        return _finish(self, out, px)


class OscillatorBook(_PerAsset):
    """A chart indicator per asset. kind="macd": long when MACD is above its signal
    line. kind="bollinger": fade moves beyond `band` standard deviations of the
    `window`-day average until price returns to it. kind="ichimoku": long above
    the cloud, short below, flat inside."""

    kind = "macd"
    defaults = {"window": 20, "band": 2.0, "rebalance": "D"}

    def signal(self, panel):
        px = panel[self.universe]
        if self.kind == "macd":
            macd = px.ewm(span=12, adjust=False).mean() - px.ewm(span=26, adjust=False).mean()
            return np.sign(macd - macd.ewm(span=9, adjust=False).mean())
        if self.kind == "bollinger":
            z = (px - px.rolling(self.window).mean()) / px.rolling(self.window).std()
            entry = (-np.sign(z)).where(z.abs() > self.band)
            exit_ = pd.DataFrame(np.where(np.sign(z) != np.sign(z.shift(1)), 0.0, np.nan),
                                 index=px.index, columns=px.columns)
            return entry.combine_first(exit_).ffill().fillna(0.0)
        if self.kind == "ichimoku":
            conv = (px.rolling(9).max() + px.rolling(9).min()) / 2
            base = (px.rolling(26).max() + px.rolling(26).min()) / 2
            span_a = ((conv + base) / 2).shift(26)
            span_b = ((px.rolling(52).max() + px.rolling(52).min()) / 2).shift(26)
            top, bottom = np.maximum(span_a, span_b), np.minimum(span_a, span_b)
            return (px > top).astype(float) - (px < bottom).astype(float)
        raise ValueError(self.kind)

    def weights(self, panel):
        return _finish(self, self.signal(panel), panel[self.universe])


# --- rank assets against each other ------------------------------------------------

def _rank_weights(sig: pd.DataFrame, k: int, long_short: bool) -> pd.DataFrame:
    ranks = sig.rank(axis=1, ascending=False, method="first")  # ties never add a k+1th
    n = sig.notna().sum(axis=1)
    top = ranks.le(k).astype(float)
    if not long_short:
        w = top.div(top.sum(axis=1).replace(0, np.nan), axis=0)
        w[n < k] = 0.0
        return w.fillna(0.0)
    bottom = (ranks.gt(n.sub(k), axis=0) & sig.notna()).astype(float)
    w = top / (2 * k) - bottom / (2 * k)
    w[n < 2 * k] = 0.0
    return w


SIGNALS: dict[str, Callable] = {}


def signal(name: str):
    def deco(fn):
        SIGNALS[name] = fn
        return fn
    return deco


@signal("momentum")
def _momentum(b, panel):
    return past_return(panel[b.universe], b.lookback, b.skip)


@signal("reversal")
def _reversal(b, panel):
    return -past_return(panel[b.universe], b.lookback, b.skip)


@signal("low_vol")
def _low_vol(b, panel):
    return -realised_vol(panel[b.universe], b.lookback)


@signal("near_high")
def _near_high(b, panel):
    px = panel[b.universe]
    return px / px.rolling(b.lookback, min_periods=b.lookback // 2).max()


@signal("carry")
def _carry(b, panel):
    return pd.DataFrame({c: panel["rate." + c.split(".", 1)[1]] - panel["rate.USD"]
                         for c in b.universe})


@signal("rate_change")
def _rate_change(b, panel):
    return pd.DataFrame({c: panel["rate." + c.split(".", 1)[1]].diff(b.lookback)
                         for c in b.universe})


@signal("carry_and_momentum")
def _carry_mom(b, panel):
    return _carry(b, panel).rank(axis=1) + _momentum(b, panel).rank(axis=1)


@signal("same_month")
def _same_month(b, panel):
    """Average return of the coming calendar month in past years (Heston and Sadka)."""
    px = panel[b.universe]
    last_day = px.index.to_series().groupby(px.index.to_period("M")).max()
    month_end = px.loc[last_day.values]
    mret = month_end.pct_change(fill_method=None)
    out = pd.DataFrame(np.nan, index=month_end.index, columns=px.columns)
    for i, d in enumerate(month_end.index):
        nxt = d.month % 12 + 1
        past = mret.iloc[:i + 1]
        same = past[past.index.month == nxt].tail(b.lookback)
        if len(same) >= 5:
            out.iloc[i] = same.mean()
    return out.reindex(px.index, method="ffill")


class RankBook(Block):
    """Rank the universe on a signal each period. Long the top `k` (and short the
    bottom `k` if long_short)."""

    universe: list[str] = []
    rank_on = "momentum"
    long_short = True
    extra: list[str] = []
    defaults = {"lookback": 252, "skip": 21, "k": 3, "rebalance": "M"}

    def instruments(self):
        return self.universe

    def required(self):
        needs = list(self.universe) + list(self.extra)
        if self.rank_on in ("carry", "rate_change", "carry_and_momentum"):
            needs += ["rate." + c.split(".", 1)[1] for c in self.universe] + ["rate.USD"]
        return list(dict.fromkeys(needs))

    def signal(self, panel):
        return SIGNALS[self.rank_on](self, panel)

    def gate(self, panel) -> pd.Series | None:
        """Optional: a 0 or 1 series that switches the whole book off."""
        return None

    def weights(self, panel):
        w = _rank_weights(self.signal(panel), self.k, self.long_short)
        g = self.gate(panel)
        if g is not None:
            w = w.mul(g.reindex(w.index).fillna(0.0), axis=0)
        return hold_between_rebalances(w, self.rebalance)


# --- step in and out of one market -------------------------------------------------

class TimingBook(Block):
    """Hold `asset` (times `leverage`) while `invested(panel)` is true, otherwise
    `fallback` (cash by default, or another asset)."""

    asset = MKT
    fallback = CASH
    leverage = 1.0
    extra: list[str] = []
    funded = True
    defaults = {"rebalance": "M"}

    def invested(self, panel) -> pd.Series:
        raise NotImplementedError

    def instruments(self):
        return list(dict.fromkeys([self.asset, self.fallback, CASH]))

    def required(self):
        need = [self.asset, "rate.USD"] + list(self.extra)
        if self.fallback != CASH:
            need.append(self.fallback)
        return list(dict.fromkeys(need))

    def weights(self, panel):
        inv = self.invested(panel).astype(float).fillna(0.0)
        w = pd.DataFrame(0.0, index=panel.index, columns=self.instruments())
        w[self.asset] = inv * self.leverage
        # Leverage above 1 is borrowed; the backtester charges the T-bill plus a spread.
        w[self.fallback] = w[self.fallback] + (1 - inv)
        return hold_between_rebalances(w, self.rebalance)


# --- hold a fixed or simply adjusted mix ------------------------------------------

class MixBook(Block):
    """Hold `mix` (instrument: weight), rebalanced each period. Optional extras:
    scale="inverse_vol" weights by inverse volatility instead; vol_target scales the
    whole book to a target volatility; only_if_trending keeps a position only while
    its own past `lookback` return is positive."""

    mix: dict[str, float] = {}
    scale = "fixed"
    only_if_trending = False
    defaults = {"rebalance": "M", "vol_target": None, "lookback": 252, "vol_window": 63,
                "cap": 2.0}

    def instruments(self):
        return list(self.mix) + ([CASH] if self.funded else [])

    def required(self):
        return list(self.mix) + (["rate.USD"] if self.funded else [])

    def weights(self, panel):
        cols = list(self.mix)
        px = panel[cols]
        base = pd.DataFrame({c: self.mix[c] for c in cols}, index=panel.index)
        base = base.where(px.notna(), 0.0)
        if self.scale == "inverse_vol":
            inv = (1 / realised_vol(px, self.vol_window)).where(base > 0)
            base = inv.div(inv.sum(axis=1), axis=0).fillna(0.0) * sum(self.mix.values())
        if self.only_if_trending:
            base = base.where(past_return(px, self.lookback) > 0, 0.0)
        if self.vol_target:
            port = (base.shift(1) * px.pct_change(fill_method=None)).sum(axis=1)
            realised = port.rolling(self.vol_window, min_periods=20).std() * np.sqrt(252)
            scale = (self.vol_target / realised.replace(0.0, np.nan)).clip(upper=self.cap)
            base = base.mul(scale.fillna(0.0), axis=0)
        if self.funded:
            # Zero-cost books (currencies, factors) need no capital of their own.
            paid = [c for c in cols if not c.startswith(ZERO_COST)]
            base[CASH] = (1 - base[paid].sum(axis=1)).clip(lower=0.0)
        return hold_between_rebalances(base, self.rebalance)


# --- trade the gap between two related prices -------------------------------------

class PairBook(Block):
    """Long `a` and short `b` when a has fallen unusually far relative to b (z-score
    of the log price ratio over `window` days beyond `entry`), and the reverse;
    close when the ratio crosses back through its average."""

    a = ""
    b = ""
    defaults = {"window": 120, "entry": 2.0, "rebalance": "D", "delay": 0}

    def instruments(self):
        return [self.a, self.b]

    def zscore(self, panel):
        ratio = np.log(panel[self.a] / panel[self.b])
        return (ratio - ratio.rolling(self.window).mean()) / ratio.rolling(self.window).std()

    def weights(self, panel):
        # delay > 0 acts on yesterday's prices: needed when the two prices close at
        # different times of day, or the pair seems to predict itself.
        z = self.zscore(panel).shift(self.delay)
        entry = (-np.sign(z)).where(z.abs() > self.entry)
        cross = pd.Series(np.where(np.sign(z) != np.sign(z.shift(1)), 0.0, np.nan), index=z.index)
        side = entry.combine_first(cross).ffill().fillna(0.0)
        w = pd.DataFrame({self.a: side * 0.5, self.b: -side * 0.5}, index=panel.index)
        return hold_between_rebalances(w, self.rebalance)
