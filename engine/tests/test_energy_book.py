"""The equal-weight energy book (RES-0017): each ingredient points the right way, the four
scores are averaged with equal weights, and contracts missing an ingredient are not held."""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from parity import strategies
from parity.data import catalog

FUT = [f"fut.{s}" for s in catalog.ENERGY]


@pytest.fixture
def flat(panel) -> pd.DataFrame:
    """Every energy input flat, so each test sets only the ingredient it checks."""
    p = panel.copy()
    for s in catalog.ENERGY:
        p[f"fut.{s}"] = 1.0
        p[f"carry.{s}"] = 0.0
        p[f"curve.{s}2"] = 50.0
        p[f"curve.{s}3"] = 50.0
    return p


def _drift(p, col, rates):
    t = np.arange(len(p))
    for c, r in zip(col, rates, strict=True):
        p[c] = np.exp(r * t)


def _last(strat, p):
    return strat.scores(p), strat.weights(p).iloc[-1]


def test_carry_score_ranks_backwardation_highest(flat):
    p = flat.copy()
    for s, c in zip(catalog.ENERGY, [0.3, 0.1, -0.1, -0.3], strict=True):
        p[f"carry.{s}"] = c
    scores, _ = _last(strategies.get("energy_book"), p)
    assert scores["carry"].iloc[-1].tolist() == pytest.approx([1.0, 1 / 3, -1 / 3, -1.0])


def test_basis_momentum_is_contract_two_beating_contract_three(flat):
    p = flat.copy()
    # Contract 2 gains most on CL and least on NG; contract 3 is flat for all four.
    _drift(p, FUT, [0.002, 0.001, -0.001, -0.002])
    scores, _ = _last(strategies.get("energy_book"), p)
    assert scores["basis_momentum"].iloc[-1].tolist() == pytest.approx([1.0, 1 / 3, -1 / 3, -1.0])
    # Holding contract 3 of crude gaining while contract 2 stands still is the worst
    # basis-momentum, even though crude's own trend is flat.
    q = flat.copy()
    _drift(q, ["curve.CL2", "curve.CL3"], [0.002, 0.002])
    bm = strategies.get("energy_book").scores(q)["basis_momentum"].iloc[-1]
    assert bm.tolist() == pytest.approx([-1.0, 1 / 3, 1 / 3, 1 / 3])


def test_value_buys_what_fell_over_five_years(flat):
    p = flat.copy()
    # Contract 2 prices fall steadily on CL and rise on NG: CL is cheap, NG dear.
    _drift(p, [f"curve.{s}2" for s in catalog.ENERGY], [-0.0004, -0.0001, 0.0001, 0.0004])
    scores, _ = _last(strategies.get("energy_book"), p)
    assert scores["value"].iloc[-1].tolist() == pytest.approx([1.0, 1 / 3, -1 / 3, -1.0])


def test_trend_is_the_sign_of_the_past_year(flat):
    p = flat.copy()
    _drift(p, FUT, [0.001, 0.001, -0.001, -0.001])
    scores, _ = _last(strategies.get("energy_book"), p)
    assert scores["trend"].iloc[-1].tolist() == [1.0, 1.0, -1.0, -1.0]


def test_the_four_scores_get_equal_weights(panel):
    strat = strategies.get("energy_book")
    s = strat.scores(panel)
    expected = (s["carry"] + s["basis_momentum"] + s["value"] + s["trend"]) / 4
    sig = strat.signal(panel)
    assert sig.notna().any().any()
    pd.testing.assert_frame_equal(sig, expected)


def test_when_all_four_agree_the_book_is_long_cl_and_short_ng(flat):
    p = flat.copy()
    for s, c in zip(catalog.ENERGY, [0.3, 0.1, -0.1, -0.3], strict=True):
        p[f"carry.{s}"] = c
    _drift(p, FUT, [0.002, 0.001, -0.001, -0.002])
    _drift(p, [f"curve.{s}2" for s in catalog.ENERGY], [-0.0004, -0.0001, 0.0001, 0.0004])
    # Noise so volatility weights are defined.
    rng = np.random.default_rng(3)
    for c in FUT:
        p[c] = p[c] * np.exp(rng.normal(0, 0.001, len(p)))
    _, last = _last(strategies.get("energy_book"), p)
    assert last["fut.CL"] > 0 > last["fut.NG"]
    assert last.abs().sum() == pytest.approx(1.0)


def test_a_contract_missing_any_ingredient_is_not_held(panel):
    p = panel.copy()
    # Gasoline has less than five years of contract 2 prices before the last date.
    p.loc[: p.index[-1000], "curve.RB2"] = np.nan
    w = strategies.get("energy_book").weights(p)
    assert (w["fut.RB"].iloc[-200:] == 0).all()
    assert w[["fut.CL", "fut.HO", "fut.NG"]].iloc[-1].abs().sum() == pytest.approx(1.0)


def test_nothing_is_held_before_five_and_a_half_years_of_prices(panel):
    w = strategies.get("energy_book").weights(panel)
    first = w.abs().sum(axis=1).gt(0).idxmax()
    assert (first - panel.index[0]).days > 5 * 365


def test_contract_three_pays_its_own_roll_losses(flat):
    p = flat.copy()
    # A steady contango on crude: contract 3 costs 10% more than contract 2, prices never
    # move. Holding contract 3 loses at every roll, so contract 2 beats it.
    p["curve.CL3"] = 55.0
    bm = strategies.get("energy_book").scores(p)["basis_momentum"].iloc[-1]
    assert bm.tolist() == pytest.approx([1.0, -1 / 3, -1 / 3, -1 / 3])


def test_ranks_are_taken_only_among_contracts_with_every_ingredient(flat):
    p = flat.copy()
    for s, c in zip(catalog.ENERGY, [0.3, 0.1, -0.1, -0.3], strict=True):
        p[f"carry.{s}"] = c
    p["curve.RB2"] = np.nan  # gasoline has no value signal
    carry = strategies.get("energy_book").scores(p)["carry"].iloc[-1]
    assert np.isnan(carry["fut.RB"])
    assert carry[["fut.CL", "fut.HO", "fut.NG"]].tolist() == pytest.approx([1.0, 0.0, -1.0])


def test_one_contract_alone_is_not_traded(panel):
    p = panel.copy()
    for s in ["HO", "RB", "NG"]:
        p[f"curve.{s}2"] = np.nan
    assert strategies.get("energy_book").weights(p).abs().sum().sum() == 0.0


def test_the_more_volatile_contract_gets_the_smaller_weight(flat):
    p = flat.copy()
    for s, c in zip(catalog.ENERGY, [0.3, 0.3, -0.3, -0.3], strict=True):
        p[f"carry.{s}"] = c
    rng = np.random.default_rng(5)
    for c, vol in zip(FUT, [0.01, 0.04, 0.01, 0.04], strict=True):
        p[c] = np.exp(np.cumsum(rng.normal(0, vol, len(p))))
    strat = strategies.get("energy_book")
    day = p.index[p.index.to_series().dt.is_month_end][-1]  # a rebalance day
    sig, w = strat.signal(p).loc[day], strat.weights(p).loc[day]
    assert sig[["fut.CL", "fut.HO"]].abs().min() > 0
    # Weight per unit of score: HO swings four times as much as CL, so it gets about a
    # quarter of the weight.
    per_unit = w / sig
    assert per_unit["fut.HO"] < per_unit["fut.CL"] / 2
