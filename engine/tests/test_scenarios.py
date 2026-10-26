"""Scenario analogues on synthetic prices, so the numbers can be checked by hand."""

from __future__ import annotations

import json
import math

import numpy as np
import pandas as pd
import pytest

from parity import scenarios as sc


def _event(eid, date, type_="military_strike", regions=("middle_east",), actors=("iran",),
           severity=4, commodities=("oil",)):
    return {"id": eid, "name": eid, "date": date, "type": type_, "regions": list(regions),
            "actors": list(actors), "severity": severity, "commodities": list(commodities),
            "description": "test", "sources": [{"title": "t", "publisher": "p",
                                                "url": "https://example.org"}]}


@pytest.fixture
def flat_then_jump() -> pd.Series:
    """100 every day, then 110 from 2020-03-02 on (a Monday)."""
    idx = pd.bdate_range("2019-01-01", "2020-12-31")
    s = pd.Series(100.0, index=idx)
    s[s.index >= "2020-03-02"] = 110.0
    return s


def test_reaction_uses_last_close_before_event(flat_then_jump):
    r = sc.event_reaction(flat_then_jump, "2020-03-02", "pct")
    assert r["path"][0] == 0.0
    assert r["horizons"]["1d"]["change"] == pytest.approx(10.0)
    assert r["horizons"]["3m"]["change"] == pytest.approx(10.0)
    assert len(r["path"]) == sc.PATH_DAYS + 1
    # no variation before the event: no volatility, so no z-score
    assert r["horizons"]["1d"]["z"] is None


def test_weekend_event_measured_from_friday_close(flat_then_jump):
    # Saturday 2020-02-29: base is Friday's 100, first close after is Monday's 110
    r = sc.event_reaction(flat_then_jump, "2020-02-29", "pct")
    assert r["horizons"]["1d"]["change"] == pytest.approx(10.0)


def test_market_closure_skips_missing_days():
    idx = pd.bdate_range("2001-01-01", "2001-12-31")
    s = pd.Series(np.linspace(100, 120, len(idx)), index=idx)
    s = s.drop(pd.bdate_range("2001-09-11", "2001-09-14"))  # shut after 9/11
    r = sc.event_reaction(s, "2001-09-11", "pct")
    base = s[s.index < "2001-09-11"].iloc[-1]
    first = s[s.index >= "2001-09-11"].iloc[0]
    assert r["horizons"]["1d"]["change"] == pytest.approx((first / base - 1) * 100, abs=1e-3)


def test_no_data_before_event_gives_none(flat_then_jump):
    assert sc.event_reaction(flat_then_jump, "1990-08-02", "pct") is None


def test_recent_event_has_only_short_horizons(flat_then_jump):
    r = sc.event_reaction(flat_then_jump, "2020-12-21", "pct")
    assert set(r["horizons"]) == {"1d", "1w"}


def test_bp_and_points_measures():
    idx = pd.bdate_range("2019-01-01", "2019-12-31")
    s = pd.Series(2.0, index=idx)
    s[s.index >= "2019-06-03"] = 2.25
    assert sc.event_reaction(s, "2019-06-03", "bp")["horizons"]["1d"]["change"] == 25.0
    assert sc.event_reaction(s, "2019-06-03", "points")["horizons"]["1d"]["change"] == 0.25


def test_z_score_scales_by_prior_volatility():
    rng = np.random.default_rng(1)
    idx = pd.bdate_range("2015-01-01", "2016-12-31")
    rets = rng.normal(0, 0.01, len(idx))
    when = pd.Timestamp("2016-06-01")
    k = idx.get_loc(when)
    rets[k] = 0.05  # a five sigma day
    s = pd.Series(100 * np.exp(np.cumsum(rets)), index=idx)
    z = sc.event_reaction(s, when, "pct")["horizons"]["1d"]["z"]
    assert 4.0 < z < 6.5


def test_dollar_basket_rises_when_foreign_currencies_fall():
    idx = pd.bdate_range("2020-01-01", periods=10)
    fx = pd.DataFrame({c: np.full(10, 1.0) for c in sc.BASKET}, index=idx)
    fx.iloc[5:] = 0.9  # every currency loses 10% against the dollar
    usd = sc.dollar_basket(fx)
    assert usd.iloc[0] == pytest.approx(1.0)
    assert usd.iloc[-1] == pytest.approx(1 / 0.9)


def test_score_prefers_same_type_region_and_actors():
    spec = sc.Spec(type="military_strike", regions=["middle_east"], actors=["iran"],
                   severity=4, commodities=["oil"])
    exact = sc.score(_event("a", "2020-01-03"), spec)
    other_region = sc.score(_event("b", "2020-01-03", regions=("europe",), actors=("x",)), spec)
    same_family = sc.score(_event("c", "2020-01-03", type_="war"), spec)
    assert exact == pytest.approx(1.0)
    assert same_family < exact
    assert other_region < same_family
    assert sc.score(_event("d", "2020-01-03", type_="pandemic"), spec) is None


def test_severity_distance_lowers_score():
    spec = sc.Spec(severity=5)
    assert sc.score(_event("a", "2020-01-01", severity=5), spec) == 1.0
    assert sc.score(_event("a", "2020-01-01", severity=1), spec) == 0.0


def test_match_orders_and_limits():
    events = [_event("old", "1990-08-02"), _event("new", "2020-01-03"),
              _event("far", "2010-01-01", type_="war", regions=("europe",), actors=("x",),
                     commodities=())]
    picked = sc.match(events, sc.Spec(type="military_strike", regions=["middle_east"]),
                      limit=2)
    assert [ev["id"] for _, ev in picked] == ["new", "old"]


def test_aggregate_median_iqr_and_hit_rate():
    analogues = []
    for change in [-2.0, 1.0, 3.0, 5.0, 10.0]:
        analogues.append({"reactions": {"oil": {"1m": {"change": change, "z": change / 2}}}})
    agg = sc.aggregate(analogues, ["oil", "usd"])
    m = agg["oil"]["1m"]
    assert m["n"] == 5 and m["median"] == 3.0
    assert m["q25"] == 1.0 and m["q75"] == 5.0
    assert m["up"] == pytest.approx(0.8)
    assert m["median_z"] == 1.5
    assert "usd" not in agg


def test_export_shape(flat_then_jump):
    prices = {"oil": flat_then_jump, "usd": flat_then_jump / 100}
    doc = sc.export([_event("e", "2020-03-02")], prices)
    json.dumps(doc)  # must be serialisable
    ev = doc["events"][0]
    assert set(ev["reactions"]) == {"oil", "usd"}
    assert math.isclose(ev["paths"]["oil"][1], 10.0)
    assert doc["matcher"]["families"]["war"] == "conflict"
    assert {h["key"] for h in doc["horizons"]} == {"1d", "1w", "1m", "3m"}


def test_validate_flags_bad_entries():
    bad = _event("x", "2020-01-01", type_="alien_invasion", severity=9)
    bad["regions"] = ["mars"]
    problems = sc.validate([bad, _event("x", "2020-01-02")])
    text = " ".join(problems)
    for word in ("unknown type", "unknown region", "severity", "duplicate"):
        assert word in text


def test_catalog_events_are_valid():
    events = sc.load_events()
    if not events:
        pytest.skip("no catalog events yet")
    assert sc.validate(events) == []


def test_median_interval_order_statistics():
    # Below 5 values no symmetric pair reaches 90% coverage.
    assert sc.median_interval([1.0, 2.0, 3.0, 4.0]) is None
    # 5 values: min to max covers 1 - 2/32 = 93.75%.
    assert sc.median_interval([5.0, 1.0, 4.0, 2.0, 3.0]) == (1.0, 5.0)
    # 12 values: the 3rd and 10th smallest (coverage 96%; the 4th and 9th give 85%).
    assert sc.median_interval([float(i) for i in range(12)]) == (2.0, 9.0)


def test_confidence_words():
    assert [sc.confidence_word(n) for n in (2, 5, 12, 30)] == ["too few", "thin", "fair", "solid"]


def test_library_groups_by_type_and_family(flat_then_jump):
    prices = {"oil": flat_then_jump}
    events = [_event(f"d{i}", f"2020-0{i + 2}-0{i + 1}", type_="sovereign_default")
              for i in range(3)]
    events.append(_event("b", "2020-03-02", type_="bank_run"))
    doc = sc.export(events, prices)
    lib = doc["library"]
    assert lib["types"]["sovereign_default"]["count"] == 3
    assert lib["types"]["bank_run"]["count"] == 1
    assert "war" not in lib["types"]  # types with no events are left out
    assert lib["families"]["financial"]["count"] == 4
    cell = lib["types"]["bank_run"]["assets"]["oil"]["1d"]
    assert cell["n"] == 1 and cell["confidence"] == "too few" and cell["ci"] is None
    assert cell["held"] is None


def test_library_direction_held_when_interval_clears_zero():
    idx = pd.bdate_range("2018-01-01", "2020-12-31")
    events, s = [], pd.Series(100.0, index=idx)
    for i, d in enumerate(pd.bdate_range("2019-01-07", periods=6, freq="8W-MON")):
        s[s.index >= d] *= 1.02  # every event: a 2% jump
        events.append(_event(f"e{i}", d.date().isoformat(), type_="crypto_crash"))
    lib = sc.library(sc.event_study(events, {"oil": s}))
    cell = lib["types"]["crypto_crash"]["assets"]["oil"]["1d"]
    assert cell["n"] == 6 and cell["held"] == "up" and cell["confidence"] == "thin"
