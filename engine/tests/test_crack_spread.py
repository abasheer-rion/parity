"""Crack spread reversion (ALG-0099): the 3:2:1 spread is built right, the trade points the
right way, enters beyond the threshold, exits at the mean, and holds legs in 3:2:1 barrels."""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from parity import strategies

LEGS = ["fut.RB", "fut.HO", "fut.CL"]


def _with_crack(panel, crack: np.ndarray) -> pd.DataFrame:
    """Crude at 60 and heating oil at 2.50; gasoline set so the spread equals `crack`."""
    p = panel.copy()
    for c in LEGS:
        p[c] = 1.0
    p["curve.CL2"] = 60.0
    p["curve.HO2"] = 2.5
    p["curve.RB2"] = (3 * crack - 42 * 2.5 + 3 * 60.0) / (2 * 42)
    return p


def _noisy(n: int, seed: int = 3) -> np.ndarray:
    return 20 + np.random.default_rng(seed).normal(0, 1.0, n)


def _with_z(strat, z):
    strat.zscore = lambda panel: pd.Series(z, index=panel.index[: len(z)])
    return strat


def test_crack_is_two_gasoline_plus_one_heating_oil_minus_three_crude_per_barrel(panel):
    p = panel.copy()
    p["curve.RB2"], p["curve.HO2"], p["curve.CL2"] = 2.0, 2.5, 60.0
    crack = strategies.get("crack_spread_reversion").crack(p)
    assert crack.iloc[-1] == pytest.approx((2 * 84 + 105 - 180) / 3)  # 31 dollars a barrel


def test_unusually_wide_spread_is_sold(panel):
    c = _noisy(len(panel))
    c[-10:] = 40.0  # far above its usual 20
    w = strategies.get("crack_spread_reversion", rebalance="D").weights(_with_crack(panel, c))
    last = w.iloc[-1]
    assert last["fut.RB"] < 0 and last["fut.HO"] < 0 and last["fut.CL"] > 0


def test_unusually_narrow_spread_is_bought(panel):
    c = _noisy(len(panel))
    c[-10:] = 5.0
    w = strategies.get("crack_spread_reversion", rebalance="D").weights(_with_crack(panel, c))
    last = w.iloc[-1]
    assert last["fut.RB"] > 0 and last["fut.HO"] > 0 and last["fut.CL"] < 0


def test_legs_hold_three_two_one_barrels_by_dollar_value(panel):
    c = _noisy(len(panel))
    c[-10:] = 5.0
    p = _with_crack(panel, c)
    last = strategies.get("crack_spread_reversion", rebalance="D").weights(p).iloc[-1]
    rb = p["curve.RB2"].iloc[-1]
    dollars = pd.Series({"fut.RB": 2 * 42 * rb, "fut.HO": 42 * 2.5, "fut.CL": -3 * 60.0})
    expected = dollars / dollars.abs().sum()
    pd.testing.assert_series_equal(last[LEGS], expected[LEGS], check_names=False)


def test_enters_only_beyond_the_threshold_and_exits_at_the_mean(panel):
    strat = _with_z(strategies.get("crack_spread_reversion"), [
        -1.9, -2.1, -1.0, -0.1, 0.0, -2.5, 1.0,   # long from -2.1 until z reaches 0
        1.9, 2.1, 0.5, 0.0, 3.0, -0.5])          # short from 2.1 until z reaches 0
    side = strat.side(panel.iloc[:13]).tolist()
    assert side == [0, 1, 1, 1, 0, 1, 0, 0, -1, -1, 0, -1, 0]


def test_a_missing_signal_closes_the_position(panel):
    strat = _with_z(strategies.get("crack_spread_reversion"), [-3.0, -1.0, np.nan, -1.0])
    assert strat.side(panel.iloc[:4]).tolist() == [1, 1, 0, 0]


def test_nothing_is_held_until_a_full_window_of_history(panel):
    c = _noisy(len(panel))
    c[100:110] = 5.0  # extreme early on, before a full window exists to compare with
    w = strategies.get("crack_spread_reversion", rebalance="D").weights(_with_crack(panel, c))
    assert w.iloc[:251].abs().sum().sum() == 0.0


@pytest.mark.parametrize("col", ["curve.RB2", "fut.HO"])
def test_nothing_is_held_when_a_leg_is_missing(panel, col):
    c = _noisy(len(panel))
    c[-10:] = 5.0
    p = _with_crack(panel, c)
    p.loc[p.index[-5:], col] = np.nan
    w = strategies.get("crack_spread_reversion", rebalance="D").weights(p)
    assert w.iloc[-1].abs().sum() == 0.0 and w.iloc[-6].abs().sum() > 0


def test_non_positive_prices_are_not_used(panel):
    c = _noisy(len(panel))
    c[-10:] = 5.0
    p = _with_crack(panel, c)
    p.loc[p.index[-1], "curve.CL2"] = -5.0
    strat = strategies.get("crack_spread_reversion", rebalance="D")
    assert np.isnan(strat.crack(p).iloc[-1])
    assert strat.weights(p).iloc[-1].abs().sum() == 0.0


def test_weights_change_only_at_the_end_of_each_week(panel):
    c = _noisy(len(panel))
    c[-40:] = 5.0
    w = strategies.get("crack_spread_reversion").weights(_with_crack(panel, c))
    changes = w.diff().abs().sum(axis=1) > 0
    week_last = w.index.to_series().groupby(w.index.to_period("W-FRI")).transform("max")
    assert changes.any()
    assert (w.index[changes] == week_last[changes]).all()


def test_signal_points_each_leg_the_way_it_is_traded(panel):
    c = _noisy(len(panel))
    c[-10:] = 5.0  # narrow: gasoline and heating oil expected to rise, crude to fall
    sig = strategies.get("crack_spread_reversion").signal(_with_crack(panel, c)).iloc[-1]
    assert sig["fut.RB"] > 0 and sig["fut.HO"] > 0 and sig["fut.CL"] < 0
    assert sig["fut.RB"] == sig["fut.HO"] == -sig["fut.CL"]


def test_gross_is_one_while_in_a_trade(panel):
    c = _noisy(len(panel))
    c[-10:] = 40.0
    w = strategies.get("crack_spread_reversion", rebalance="D").weights(_with_crack(panel, c))
    assert w.iloc[-1].abs().sum() == pytest.approx(1.0)
