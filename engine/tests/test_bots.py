"""Bot Battle (DEC-0035): every bot decides from closes up to today only, the account
arithmetic adds up, and the statistics mean what the page says they mean."""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from parity import bots


def walk(n: int = 1500, seed: int = 3, vol: float = 0.012, drift: float = 0.0003) -> np.ndarray:
    rng = np.random.default_rng(seed)
    return 100 * np.exp(np.cumsum(rng.normal(drift, vol, n)))


@pytest.mark.parametrize("cls", bots.BOTS, ids=lambda c: c.id)
def test_no_look_ahead(cls):
    """Change every price after day t: the account up to day t and every trade closed by
    then must stay exactly the same."""
    px = bots.synthetic_path(7, years=6)["prices"]
    full = bots.run_bot(cls(), px)
    rng = np.random.default_rng(0)
    for t in range(60, len(px) - 1, 37):
        future = px.copy()
        future[t + 1:] = px[t] * np.exp(np.cumsum(rng.normal(0, 0.05, len(px) - t - 1)))
        other = bots.run_bot(cls(), future)
        np.testing.assert_array_equal(full.equity[: t + 1], other.equity[: t + 1])
        def done(r, t=t):
            return [(x.opened, x.closed, x.pnl) for x in r.trades
                    if x.closed <= t and not x.open_at_end]
        assert done(full) == done(other)


@pytest.mark.parametrize("cls", bots.BOTS, ids=lambda c: c.id)
def test_cut_short_matches(cls):
    """Running on the first t days gives the same account as the full run up to t."""
    px = walk()
    full = bots.run_bot(cls(), px)
    short = bots.run_bot(cls(), px[:900])
    np.testing.assert_array_equal(full.equity[:900], short.equity)


@pytest.mark.parametrize("cls", bots.BOTS, ids=lambda c: c.id)
def test_trades_add_up_to_the_account(cls):
    """With every trade closed at the end, the trades' profits sum to the cash left
    minus the start (costs are inside the trades), and the last day's account differs
    from that only by the cost of those last sales."""
    px = walk(seed=11)
    r = bots.run_bot(cls(), px)
    if r.stopped_at is None:
        total = sum(t.pnl for t in r.trades)
        assert total == pytest.approx(r.closed_out - bots.START_CASH, rel=1e-9, abs=1e-6)
        assert abs(r.equity[-1] - r.closed_out) <= 11 * r.equity[-1] * bots.COST_BPS / 1e4
    assert (r.equity >= 0).all()


def test_expectancy_is_the_mean_trade():
    trades = [bots.Trade(0, 1, 1, p) for p in (10, 10, 10, -25, 4, -1)]
    s = bots.trade_stats(trades)
    assert s["trades"] == 6 and s["wins"] == 4
    assert s["win_rate"] == pytest.approx(4 / 6)
    assert s["avg_win"] == pytest.approx(8.5)
    assert s["avg_loss"] == pytest.approx(13)
    assert s["profit_factor"] == pytest.approx(34 / 26)
    assert s["expectancy"] == pytest.approx(np.mean([10, 10, 10, -25, 4, -1]))


def test_drawdown_and_recovery():
    eq = np.array([100, 120, 90, 60, 80, 121, 110], dtype=float)
    dates = pd.bdate_range("2020-01-01", periods=len(eq))
    d = bots.drawdown_stats(eq, dates)
    assert d["max_drawdown"] == pytest.approx(-0.5)
    assert (d["peak"], d["trough"], d["recovered"]) == (1, 3, 5)
    assert d["days_to_recover"] == (dates[5] - dates[1]).days
    worst, longest = bots.running_drawdown(eq, dates)
    assert worst[-1] == pytest.approx(-0.5)
    assert longest[4] == (dates[4] - dates[1]).days
    never = bots.drawdown_stats(np.array([100, 80, 90.0]))
    assert never["recovered"] is None and never["days_to_recover"] is None


def test_martingale_wins_often_and_a_crash_forces_a_margin_call():
    """Long slow drift up, then a straight 40% fall: lots of small wins, then a margin
    call that loses more than all of them together."""
    up = 100 * np.cumprod(np.r_[1, np.tile([1.012, 0.995, 1.004], 200)])
    down = up[-1] * np.cumprod(np.full(60, 0.991))
    r = bots.run_bot(bots.Martingale(), np.r_[up, down])
    s = bots.summarize(r)
    assert s["win_rate"] > 0.95
    assert r.margin_calls >= 1
    assert s["pnl"] < 0
    assert any(t.forced for t in r.trades)


def test_short_vol_pays_the_drop_beyond_the_strike():
    px = np.r_[np.full(300, 100.0), [100, 99, 98, 95, 90, 90]]
    bot = bots.ShortVol()
    r = bots.run_bot(bot, px)
    last = r.trades[-2] if r.trades[-1].open_at_end else r.trades[-1]
    # Flat prices for a year: the premium sits on its floor of 0.05% of the notional.
    assert r.trades[0].pnl == pytest.approx(2 * bots.START_CASH * 0.0005
                                            - 2 * bots.START_CASH * bots.COST_BPS / 1e4, rel=0.01)
    assert last.pnl < 0  # a 10% fall pays 7% of twice the account


def test_trend_follower_has_a_low_win_rate_on_noise_with_trends():
    px = bots.synthetic_path(5, years=10)["prices"]
    s = bots.summarize(bots.run_bot(bots.Trend(), px))
    assert s["win_rate"] < 0.55
    assert s["avg_win"] > s["avg_loss"]


def test_synthetic_paths_are_seeded_and_have_crashes():
    a, b = bots.synthetic_path(42), bots.synthetic_path(42)
    np.testing.assert_array_equal(a["prices"], b["prices"])
    assert len(a["prices"]) == 2520 and (a["prices"] > 0).all()
    crashes = sum(len(bots.synthetic_path(s)["crashes"]) for s in range(20))
    assert crashes > 5


def test_export_shapes(monkeypatch):
    px = pd.Series(walk(800), index=pd.bdate_range("2000-01-03", periods=800))
    monkeypatch.setattr(bots, "load_market", lambda key, start=None, end=None: px.loc[start:end])
    monkeypatch.setattr(bots, "STARTS", {"stocks": ["2000-01-03"], "EUR": [], "oil": []})
    index, runs = bots.export(n_paths=2, summary_paths=3, years=2)
    assert [r["id"] for r in runs] == ["stocks-2000", "sim-1", "sim-2"]
    assert {b["id"] for b in index["bots"]} == {c.id for c in bots.BOTS}
    for run in runs:
        n = len(run["labels"])
        assert len(run["price"]) == n
        for r in run["runs"].values():
            assert len(r["equity"]) == len(r["worst"]) == len(r["underwater"]) == n
            assert all(0 <= t[0] < n for t in r["trades"])
            assert r["summary"]["trades"] == len(r["trades"])
    assert "Not investment advice" in index["disclaimer"]
    assert set(index["synthetic"]["summary"]) == {c.id for c in bots.BOTS}
