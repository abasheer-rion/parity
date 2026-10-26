"""Bot Battle: seven trading-bot archetypes raced on the same prices (DEC-0035).

The point is one lesson: a high win rate is not the same as making money. A bot that
wins 99 trades in 100 can still lose everything on the hundredth. Expectancy says why:

    expectancy per trade = win rate x average win - loss rate x average loss

Every bot is a short, plain rule on one series of daily closes. Each one decides at
the close of day t using closes up to day t only, and trades at that close, so a
position earns the move from t to t+1. tests/test_bots.py checks this by changing
every price after a day and asking that nothing up to that day changes.

Assumptions, all deliberate and all shown on the page:

* a hypothetical account of $10,000, no interest earned on cash or paid on borrowing;
* a cost of 2 basis points of the amount traded on every buy and sell;
* stops and take-profits are checked at each close only (no intraday prices);
* a margin call closes everything when the money borrowed passes 10 times the account,
  and a bot whose account falls under 1% of its start stops trading;
* trades still open on the last day are closed at the last close and counted.

Real series come from the data cache (US stocks from Kenneth French's total market
index, the euro, Brent oil). The synthetic mode draws daily paths with calm and
stressed spells and sudden crashes, so the same rules can be seen on many futures.
None of it is a forecast or advice.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import UTC, datetime

import numpy as np
import pandas as pd

START_CASH = 10_000.0
COST_BPS = 2.0
MAX_LEVERAGE = 10.0   # gross exposure over the account at which a margin call closes all
BLOWN = 0.01          # an account under 1% of its start stops trading

DISCLAIMER = ("Hypothetical and educational. Simple rules on past or simulated prices, "
              "with costs of 2 bp a side and no interest. Not investment advice.")


# ---------------------------------------------------------------- the account

@dataclass
class Lot:
    """One open position. `group` ties lots that open and close as one trade."""
    side: int            # +1 long, -1 short
    units: float
    entry: float
    opened: int
    group: int
    cost: float          # what opening it cost, charged to the trade when it closes
    # A sold put (the short-volatility bot): strike, premium per unit of notional, notional.
    put: tuple[float, float, float] | None = None

    def pnl(self, p: float) -> float:
        if self.put:
            strike, premium, notional = self.put
            return notional * (premium - max(0.0, strike - p) / self.entry)
        return self.side * self.units * (p - self.entry)

    def exposure(self, p: float) -> float:
        if self.put:
            return 0.0
        return abs(self.units * p)


@dataclass
class Trade:
    opened: int
    closed: int
    side: int
    pnl: float
    forced: bool = False      # closed by a margin call
    open_at_end: bool = False  # still open on the last day, closed at the last close


class Account:
    def __init__(self, cash: float = START_CASH, cost_bps: float = COST_BPS):
        self.cash = cash
        self.cost = cost_bps / 1e4
        self.lots: list[Lot] = []
        self.trades: list[Trade] = []
        self._group = 0
        self._group_pnl: dict[int, float] = {}
        self.stopped = False

    def new_group(self) -> int:
        self._group += 1
        return self._group

    def equity(self, p: float) -> float:
        return self.cash + sum(lot.pnl(p) for lot in self.lots)

    def exposure(self, p: float) -> float:
        return sum(lot.exposure(p) for lot in self.lots)

    def buy(self, notional: float, p: float, t: int, side: int = 1,
            group: int | None = None) -> Lot:
        fee = abs(notional) * self.cost
        self.cash -= fee
        lot = Lot(side, abs(notional) / p, p, t, group or self.new_group(), fee)
        self.lots.append(lot)
        return lot

    def sell_put(self, notional: float, strike: float, premium: float, p: float, t: int) -> Lot:
        fee = notional * self.cost
        self.cash -= fee
        lot = Lot(-1, 0.0, p, t, self.new_group(), fee, put=(strike, premium, notional))
        self.lots.append(lot)
        return lot

    def close(self, lot: Lot, p: float, t: int, forced: bool = False, at_end: bool = False):
        gain = lot.pnl(p)
        fee = 0.0 if lot.put else lot.units * p * self.cost
        self.cash += gain - fee
        self.lots.remove(lot)
        g = lot.group
        self._group_pnl[g] = self._group_pnl.get(g, 0.0) + gain - fee - lot.cost
        if not any(x.group == g for x in self.lots):
            self.trades.append(Trade(lot.opened, t, lot.side, self._group_pnl.pop(g),
                                     forced, at_end))

    def close_all(self, p: float, t: int, forced: bool = False, at_end: bool = False):
        for lot in sorted(self.lots, key=lambda x: (x.group, x.opened)):
            self.close(lot, p, t, forced, at_end)

    def risk_check(self, p: float, t: int) -> None:
        """Margin call at more than MAX_LEVERAGE times the account, and the stop rule."""
        eq = self.equity(p)
        if self.lots and (eq <= 0 or self.exposure(p) > MAX_LEVERAGE * eq):
            self.close_all(p, t, forced=True)
            eq = self.cash
        if eq < BLOWN * START_CASH:
            self.stopped = True


# ---------------------------------------------------------------- the bots

class Bot:
    id = "bot"
    name = "Bot"
    rule = ""
    style = ""

    def __init__(self, **params):
        for k, v in params.items():
            setattr(self, k, v)

    def params(self) -> dict:
        return {k: getattr(self, k) for k in getattr(self, "_params", ())}

    def reset(self) -> None:
        pass

    def on_close(self, t: int, hist: np.ndarray, acct: Account) -> None:
        """Called once per day with closes up to and including today."""
        raise NotImplementedError


class Martingale(Bot):
    id = "martingale"
    name = "Double down"
    style = "Martingale: averaging down, very high win rate"
    rule = ("Buy 5% of the account. Each time the price falls 2% below the last buy, buy "
            "again with twice the last amount. Sell everything when the whole position is "
            "up 1%. A margin call closes it all if borrowing passes 10 times the account.")
    base, step, target = 0.05, 0.02, 0.01
    _params = ("base", "step", "target")

    def reset(self):
        self._last = None
        self._size = 0.0

    def on_close(self, t, hist, acct):
        p = hist[-1]
        if acct.lots:
            cost = sum(lot.units * lot.entry for lot in acct.lots)
            value = sum(lot.units * p for lot in acct.lots)
            if value >= cost * (1 + self.target):
                acct.close_all(p, t)
                self._last = None
                return
            if p <= self._last * (1 - self.step):
                self._size *= 2
                acct.buy(self._size, p, t, group=acct.lots[0].group)
                self._last = p
            return
        self._size = self.base * acct.equity(p)
        acct.buy(self._size, p, t)
        self._last = p


class ShortVol(Bot):
    id = "short_vol"
    name = "Picking up pennies"
    style = "Short volatility: sells crash insurance every week"
    rule = ("Every 5 trading days, sell one week of crash insurance on twice the account: "
            "keep a small fee unless the price ends the week more than 3% lower, then pay "
            "the drop beyond 3%. The fee is the past year's average weekly payout plus 25%.")
    notional, strike, days, markup, floor = 2.0, 0.03, 5, 1.25, 0.0005
    _params = ("notional", "strike", "days", "markup", "floor")

    def on_close(self, t, hist, acct):
        p = hist[-1]
        for lot in list(acct.lots):
            if t - lot.opened >= self.days:
                acct.close(lot, p, t)
        if acct.lots or len(hist) < self.days + 1:
            return
        past = hist[-min(len(hist), 261):]
        week = past[self.days:] / past[:-self.days] - 1
        burn = np.maximum(0.0, -week - self.strike).mean() if len(week) else 0.0
        premium = max(self.floor, self.markup * burn)
        acct.sell_put(self.notional * acct.equity(p), p * (1 - self.strike), premium, p, t)


class Scalper(Bot):
    id = "scalper"
    name = "Quick scalper"
    style = "Tight take-profit, wide stop"
    rule = ("Buy three times the account. Sell as soon as the price closes 0.5% higher "
            "(take profit) or 4% lower (stop loss). Buy again at the next close.")
    leverage, take, stop = 3.0, 0.005, 0.04
    _params = ("leverage", "take", "stop")

    def on_close(self, t, hist, acct):
        p = hist[-1]
        if acct.lots:
            lot = acct.lots[0]
            move = p / lot.entry - 1
            if move >= self.take or move <= -self.stop:
                acct.close(lot, p, t)
            return
        acct.buy(self.leverage * acct.equity(p), p, t)


class Trend(Bot):
    id = "trend"
    name = "Trend follower"
    style = "Low win rate, big winners"
    rule = ("Buy when the price closes above its highest close of the past 50 days; sell "
            "short when it closes below the lowest. Get out of a long below the 20-day low "
            "and out of a short above the 20-day high. One times the account.")
    entry, exit = 50, 20
    _params = ("entry", "exit")

    def on_close(self, t, hist, acct):
        if len(hist) <= self.entry:
            return
        p = hist[-1]
        hi_in, lo_in = hist[-self.entry - 1:-1].max(), hist[-self.entry - 1:-1].min()
        hi_out, lo_out = hist[-self.exit - 1:-1].max(), hist[-self.exit - 1:-1].min()
        if acct.lots:
            lot = acct.lots[0]
            if (lot.side > 0 and p < lo_out) or (lot.side < 0 and p > hi_out):
                acct.close(lot, p, t)
        if not acct.lots:
            if p > hi_in:
                acct.buy(acct.equity(p), p, t, side=1)
            elif p < lo_in:
                acct.buy(acct.equity(p), p, t, side=-1)


class Grid(Bot):
    id = "grid"
    name = "Grid trader"
    style = "Buys every dip on a ladder, sells each 2% higher"
    rule = ("Set buy levels every 2% below a starting price. At each level buy 10% of the "
            "account and sell that piece 2% higher. At most 10 pieces at once. Move the "
            "ladder up when nothing is held and the price has risen past it.")
    spacing, lot, max_lots = 0.02, 0.10, 10
    _params = ("spacing", "lot", "max_lots")

    def reset(self):
        self._anchor = None
        self._levels: dict[int, Lot] = {}
        self._size = 0.0

    def on_close(self, t, hist, acct):
        p = hist[-1]
        if self._anchor is None or (not self._levels and p > self._anchor * (1 + self.spacing)):
            self._anchor = p
            self._size = self.lot * acct.equity(p)
        for k, lot in list(self._levels.items()):
            if p >= lot.entry * (1 + self.spacing):
                acct.close(lot, p, t)
                del self._levels[k]
        if self._size <= 0:
            return
        k = math.floor(math.log(p / self._anchor) / math.log(1 - self.spacing) + 1e-9)
        for level in range(1, k + 1):
            if level not in self._levels and len(self._levels) < self.max_lots:
                self._levels[level] = acct.buy(self._size, p, t)

    def after_margin_call(self):
        self._levels.clear()
        self._anchor = None


class MeanReversion(Bot):
    id = "mean_reversion"
    name = "Dip buyer"
    style = "Mean reversion: buys short sharp falls"
    rule = ("After three down days in a row that end below the 10-day average, buy one "
            "times the account. Sell when the price closes back above the 10-day average, "
            "or after 10 days.")
    window, downs, hold = 10, 3, 10
    _params = ("window", "downs", "hold")

    def on_close(self, t, hist, acct):
        if len(hist) <= max(self.window, self.downs + 1):
            return
        p = hist[-1]
        avg = hist[-self.window:].mean()
        if acct.lots:
            lot = acct.lots[0]
            if p > avg or t - lot.opened >= self.hold:
                acct.close(lot, p, t)
            return
        tail = hist[-self.downs - 1:]
        if np.all(np.diff(tail) < 0) and p < avg:
            acct.buy(acct.equity(p), p, t)


class BuyHold(Bot):
    id = "buy_hold"
    name = "Buy and hold"
    style = "The yardstick"
    rule = "Buy one times the account on the first day and never sell."

    def on_close(self, t, hist, acct):
        if not acct.lots and not acct.trades:
            acct.buy(acct.equity(hist[-1]), hist[-1], t)


BOTS: list[type[Bot]] = [Martingale, ShortVol, Scalper, Trend, Grid, MeanReversion, BuyHold]
BOT_BY_ID = {b.id: b for b in BOTS}


# ---------------------------------------------------------------- running a bot

@dataclass
class Run:
    bot: str
    equity: np.ndarray            # account value at each close
    trades: list[Trade]
    stopped_at: int | None = None  # day the account fell under 1% and stopped trading
    margin_calls: int = 0
    closed_out: float = START_CASH  # cash after the last day's closing trades and costs


def run_bot(bot: Bot, prices: np.ndarray, cost_bps: float = COST_BPS) -> Run:
    """Run one bot over daily closes. The bot sees `prices[: t + 1]` on day t, nothing
    more, and every open trade is closed at the last close."""
    px = np.asarray(prices, dtype=float)
    bot.reset()
    acct = Account(cost_bps=cost_bps)
    eq = np.empty(len(px))
    stopped_at, calls = None, 0
    for t in range(len(px)):
        p = px[t]
        if not acct.stopped:
            bot.on_close(t, px[: t + 1], acct)
            before = len(acct.trades)
            acct.risk_check(p, t)
            if any(tr.forced for tr in acct.trades[before:]):
                calls += 1
                if hasattr(bot, "after_margin_call"):
                    bot.after_margin_call()
            if acct.stopped and stopped_at is None:
                stopped_at = t
        eq[t] = max(0.0, acct.equity(p))
    if acct.lots:
        acct.close_all(px[-1], len(px) - 1, at_end=True)
    return Run(bot.id, eq, acct.trades, stopped_at, calls, acct.cash)


# ---------------------------------------------------------------- statistics

def drawdown_stats(equity: np.ndarray, dates: pd.DatetimeIndex | None = None) -> dict:
    """Worst fall from a peak, how long the account took to climb back to that peak
    (None if it never did) and the longest spell under a previous peak, in days."""
    eq = np.asarray(equity, dtype=float)
    peak = np.maximum.accumulate(eq)
    dd = np.where(peak > 0, eq / peak - 1, 0.0)
    trough = int(dd.argmin()) if len(dd) else 0
    start = int(np.flatnonzero(eq[: trough + 1] == peak[trough])[0]) if len(dd) else 0
    after = np.flatnonzero(eq[trough:] >= peak[trough])
    rec = trough + int(after[0]) if len(after) and dd[trough] < 0 else None
    if dates is not None:
        def days(a, b):
            return (dates[b] - dates[a]).days
    else:
        def days(a, b):  # trading days to calendar days, roughly
            return round((b - a) * 7 / 5)
    longest, run_start = 0, None
    for i, d in enumerate(dd):
        if d < 0 and run_start is None:
            run_start = i - 1 if i else 0
        elif d >= 0 and run_start is not None:
            longest = max(longest, days(run_start, i))
            run_start = None
    if run_start is not None:
        longest = max(longest, days(run_start, len(dd) - 1))
    return {
        "max_drawdown": float(dd.min()) if len(dd) else 0.0,
        "peak": start, "trough": trough, "recovered": rec,
        "days_to_recover": days(start, rec) if rec is not None else None,
        "longest_underwater_days": int(longest),
    }


def trade_stats(trades: list[Trade]) -> dict:
    pnl = np.array([t.pnl for t in trades], dtype=float)
    wins, losses = pnl[pnl > 0], pnl[pnl <= 0]
    n = len(pnl)
    win_rate = len(wins) / n if n else None
    avg_win = float(wins.mean()) if len(wins) else 0.0
    avg_loss = float(-losses.mean()) if len(losses) else 0.0
    gross_loss = float(-losses.sum())
    return {
        "trades": n,
        "wins": int(len(wins)),
        "win_rate": win_rate,
        "avg_win": avg_win,
        "avg_loss": avg_loss,
        "biggest_loss": float(-losses.min()) if len(losses) else 0.0,
        "profit_factor": float(wins.sum()) / gross_loss if gross_loss > 0 else None,
        # win rate x average win - loss rate x average loss, which is the mean trade.
        "expectancy": (win_rate * avg_win - (1 - win_rate) * avg_loss) if n else None,
    }


def summarize(run: Run, dates: pd.DatetimeIndex | None = None) -> dict:
    eq = run.equity
    out = {"bot": run.bot, **trade_stats(run.trades), **drawdown_stats(eq, dates)}
    out["final"] = float(eq[-1])
    out["pnl"] = float(eq[-1] - START_CASH)
    out["pnl_pct"] = float(eq[-1] / START_CASH - 1)
    out["blown"] = run.stopped_at is not None
    out["margin_calls"] = run.margin_calls
    if dates is not None:
        for k in ("peak", "trough", "recovered"):
            out[k] = None if out[k] is None else str(dates[out[k]].date())
        out["stopped_on"] = None if run.stopped_at is None else str(dates[run.stopped_at].date())
    return out


def running_drawdown(equity: np.ndarray, dates: pd.DatetimeIndex | None = None
                     ) -> tuple[np.ndarray, np.ndarray]:
    """For each day: the worst fall so far, and the longest spell under water so far in
    days (counting a spell still going on). For the replay's leaderboard."""
    eq = np.asarray(equity, dtype=float)
    peak = np.maximum.accumulate(eq)
    dd = np.where(peak > 0, eq / peak - 1, 0.0)
    worst = np.minimum.accumulate(dd)
    day = (dates.values.astype("datetime64[D]").astype(np.int64) if dates is not None
           else np.floor(np.arange(len(eq)) * 7 / 5).astype(np.int64))
    longest = np.zeros(len(eq), dtype=np.int64)
    best, start = 0, None
    for i, d in enumerate(dd):
        if d < 0:
            if start is None:
                start = i - 1 if i else 0
            cur = int(day[i] - day[start])
        else:
            start, cur = None, 0
        best = max(best, cur)
        longest[i] = best
    return worst, longest


# ---------------------------------------------------------------- markets and paths

MARKETS = {
    "stocks": ("US stocks", "stocks", "Kenneth R. French Data Library, US total market"),
    "EUR": ("Euro in US dollars", "EUR", "FRED, US dollars per euro"),
    "oil": ("Oil (Brent)", "brent", "FRED, Brent crude spot"),
}

# Starting dates offered for each real market in the replay.
STARTS = {"stocks": ["1928-01-03", "1990-01-02", "2007-01-03"], "EUR": ["1999-01-04"],
          "oil": ["1990-01-02", "2014-01-02"]}


def load_market(market: str, start: str | None = None, end: str | None = None) -> pd.Series:
    from . import world

    if market not in MARKETS:
        raise KeyError(f"unknown market {market}; known: {', '.join(MARKETS)}")
    levels = world.load_levels()
    key = MARKETS[market][1]
    if key not in levels:
        raise FileNotFoundError(f"no cached data for {market}; run `parity fetch` first")
    s = levels[key].astype(float)
    s = s[(s > 0) & np.isfinite(s)]
    return s.loc[start:end]


def synthetic_path(seed: int, years: int = 10, start: float = 100.0) -> dict:
    """A made-up daily price path with calm and stressed spells and sudden crashes.

    Calm days drift up about 10% a year with 13% volatility; stressed spells run at
    35%. Crashes arrive about once every seven years and take 15% to 40% off over one
    to three weeks, during a stressed spell. Returns the prices and the crash days."""
    g = np.random.default_rng(seed)
    n = years * 252
    vol = np.empty(n)
    rets = np.empty(n)
    stressed = False
    crashes: list[dict] = []
    i = 0
    while i < n:
        if g.random() < 0.15 / 252:
            depth = g.uniform(0.15, 0.40)
            length = int(g.integers(5, 16))
            length = min(length, n - i)
            shocks = g.dirichlet(np.ones(length)) * math.log(1 - depth)
            noise = g.normal(0, 0.35 / math.sqrt(252), length)
            rets[i: i + length] = shocks + noise - noise.mean()
            vol[i: i + length] = 0.35
            crashes.append({"day": i, "days": length, "depth": round(depth, 3)})
            i += length
            stressed = True
            continue
        if stressed and g.random() < 1 / 40:
            stressed = False
        elif not stressed and g.random() < 1 / 400:
            stressed = True
        v = (0.35 if stressed else 0.13) / math.sqrt(252)
        mu = 0.10 / 252 - v * v / 2
        rets[i] = mu + v * g.normal()
        vol[i] = v
        i += 1
    prices = start * np.exp(np.concatenate([[0.0], np.cumsum(rets)]))[:n]
    return {"seed": seed, "prices": prices, "crashes": crashes}


def make_bots(**overrides) -> list[Bot]:
    return [cls(**overrides.get(cls.id, {})) for cls in BOTS]


def battle(prices: np.ndarray, dates: pd.DatetimeIndex | None = None,
           cost_bps: float = COST_BPS) -> list[tuple[Run, dict]]:
    out = []
    for bot in make_bots():
        r = run_bot(bot, prices, cost_bps)
        out.append((r, summarize(r, dates)))
    return out


def synthetic_summary(n: int = 100, seed: int = 1, years: int = 10) -> dict:
    """Run every bot on `n` made-up paths: how often each was stopped out, the median
    final account, the median win rate and the share of paths it ended up ahead."""
    rows: dict[str, list[dict]] = {cls.id: [] for cls in BOTS}
    for k in range(n):
        path = synthetic_path(seed + k, years)
        for r, s in battle(path["prices"]):
            rows[r.bot].append(s)
    out = {}
    for bid, ss in rows.items():
        wr = [s["win_rate"] for s in ss if s["win_rate"] is not None]
        out[bid] = {
            "paths": n,
            "blown": sum(s["blown"] for s in ss),
            "ahead": sum(s["pnl"] > 0 for s in ss),
            "median_final": float(np.median([s["final"] for s in ss])),
            "median_win_rate": float(np.median(wr)) if wr else None,
            "median_max_drawdown": float(np.median([s["max_drawdown"] for s in ss])),
        }
    return out


# ---------------------------------------------------------------- export for the site

def _sig(v, digits: int = 5):
    if v is None:
        return None
    v = float(v)
    return None if not math.isfinite(v) else float(f"{v:.{digits}g}")


def _frames(dates: pd.DatetimeIndex) -> np.ndarray:
    """Index of the last trading day of each calendar week: the replay's frames."""
    week = pd.Series(np.arange(len(dates)), index=dates).groupby(
        dates.to_period("W-FRI")).max()
    return week.to_numpy()


def _replay(prices: np.ndarray, dates: pd.DatetimeIndex | None, labels: list[str]) -> dict:
    """Weekly frames of each bot's account, worst fall so far (percent) and longest spell
    under water so far (weeks), plus every trade as [frame it closed, profit in dollars]
    with a third item when it was closed by a margin call (1) or on the last day (2)."""
    frames = _frames(dates) if dates is not None else np.arange(4, len(prices), 5)
    if frames[-1] != len(prices) - 1:
        frames = np.append(frames, len(prices) - 1)
    runs = {}
    for r, s in battle(prices, dates):
        worst, longest = running_drawdown(r.equity, dates)
        pos = np.searchsorted(frames, [t.closed for t in r.trades])
        trades = []
        for f, t in zip(pos, r.trades, strict=True):
            flag = int(t.forced) + 2 * int(t.open_at_end)
            trades.append([int(f), _sig(t.pnl, 4)] + ([flag] if flag else []))
        runs[r.bot] = {
            "equity": [_sig(v, 4) for v in r.equity[frames]],
            "worst": [round(float(v) * 100, 1) for v in worst[frames]],
            "underwater": [round(int(v) / 7) for v in longest[frames]],
            "trades": trades,
            "stopped": None if r.stopped_at is None else int(np.searchsorted(frames, r.stopped_at)),
            "summary": {k: (_sig(v) if isinstance(v, float) else v) for k, v in s.items()},
        }
    return {"labels": labels, "price": [_sig(v, 5) for v in prices[frames]], "runs": runs}


def _brief(run: dict) -> dict:
    """What the index keeps of a run: everything but the frames."""
    keep = ("id", "kind", "market", "label", "source", "start", "end", "seed", "crashes")
    return {**{k: run[k] for k in keep if k in run},
            "frames": len(run["labels"]),
            "summary": {b: r["summary"] for b, r in run["runs"].items()}}


def export(n_paths: int = 12, summary_paths: int = 100, years: int = 10) -> tuple[dict, list[dict]]:
    """The Bot Battle page's files: a small index and one file per replay (real markets
    from a few starting dates, and made-up paths). Returns (index, runs)."""
    runs: list[dict] = []
    through = None
    for key, (label, _, source) in MARKETS.items():
        try:
            full = load_market(key)
        except (FileNotFoundError, KeyError):
            continue
        through = max(through or "", str(full.index[-1].date()))
        for start in STARTS[key]:
            s = full.loc[start:]
            if len(s) < 300:
                continue
            frames = _frames(s.index)
            labels = [str(s.index[i].date()) for i in frames]
            if frames[-1] != len(s) - 1:
                labels.append(str(s.index[-1].date()))
            rep = _replay(s.to_numpy(), s.index, labels)
            runs.append({"id": f"{key}-{start[:4]}", "kind": "market", "market": key,
                         "label": label, "source": source, "start": labels[0],
                         "end": labels[-1], **rep})
    for k in range(n_paths):
        path = synthetic_path(1000 + k, years)
        n = len(path["prices"])
        frames = np.arange(4, n, 5)
        if frames[-1] != n - 1:
            frames = np.append(frames, n - 1)
        labels = [f"{i / 252:.2f}" for i in frames]
        rep = _replay(path["prices"], None, labels)
        crashes = [{**c, "frame": int(np.searchsorted(frames, c["day"]))} for c in path["crashes"]]
        runs.append({"id": f"sim-{k + 1}", "kind": "synthetic", "label": f"Made-up path {k + 1}",
                     "source": "Simulated: calm and stressed spells with sudden crashes",
                     "seed": path["seed"], "start": "0", "end": str(years), "crashes": crashes,
                     **rep})
    index = {
        "generated_at": datetime.now(UTC).isoformat(timespec="seconds"),
        "data_through": through,
        "disclaimer": DISCLAIMER,
        "assumptions": {"start_cash": START_CASH, "cost_bps": COST_BPS,
                        "max_leverage": MAX_LEVERAGE, "blown_below": BLOWN},
        "bots": [{"id": cls.id, "name": cls.name, "style": cls.style, "rule": cls.rule,
                  "params": cls().params()} for cls in BOTS],
        "runs": [_brief(r) for r in runs],
        "synthetic": {"years": years, "paths": summary_paths,
                      "summary": (synthetic_summary(summary_paths, 1, years)
                                  if summary_paths else {})},
    }
    return index, runs
