"""The wider search (DEC-0014): combinators build, never look ahead and never hold an
untradable series; saturated regions are drawn less; repeats are rejected before any
backtest; and every old spec keeps its id."""

from __future__ import annotations

import random

import numpy as np
import pandas as pd
import pytest
from test_factory import CUTS, PANEL

from parity import search
from parity.strategies import _blocks as B

PLAIN = [search._draw(fn, random.Random(i), None)
         for i, (fn, _) in enumerate(search.BASE_SAMPLERS * 8)]
CTX = search.Context(pool=PLAIN)


def _specs(fn, n: int) -> list[dict]:
    return [search._draw(fn, random.Random(1000 + i), CTX) for i in range(n)]


WRAPPED = {fn.__name__: _specs(fn, 12) for fn in search.WRAPPER_SAMPLERS}


def _cols(strat) -> list[str]:
    return sorted(set(strat.required()) | {"rate.USD", "rate.TBILL3M", "eq.US_TOTAL"})


@pytest.mark.parametrize("kind", sorted(WRAPPED))
def test_combinators_build_name_and_never_look_ahead(kind):
    for spec in WRAPPED[kind]:
        d = search.describe(spec)
        assert d["name"] and len(d["name"]) <= 70, d["name"]
        assert d["line"].endswith(".") and "—" not in d["line"]
        strat = search.build(spec)
        cols = _cols(strat)
        full = strat.weights(PANEL[cols])
        assert set(full.columns) <= set(strat.instruments())
        assert np.isfinite(full.values).all()
        for cut in CUTS[:2]:
            part = strat.weights(PANEL.loc[:cut, cols])
            a = full.loc[:cut].reindex(columns=part.columns)
            assert np.allclose(a.values, part.values, equal_nan=True, atol=1e-9), spec


def test_nothing_untradable_is_ever_held():
    r = random.Random(3)
    specs = [search.sample(r, CTX) for _ in range(400)]
    for spec in specs:
        held = set(search.build(spec).instruments())
        assert held <= search.TRADABLE, (held - search.TRADABLE, spec)
    for bad in ("cmd.COPPER", "cmd.HH_GAS", "cmd.WTI_MONTHLY", "rate.USD"):
        assert bad not in search.TRADABLE


def test_every_universe_and_kind_is_reachable():
    r = random.Random(5)
    specs = [search.sample(r, CTX) for _ in range(3000)]
    kinds = {s["kind"] for s in specs}
    assert kinds >= {"trend", "rank", "timing", "chart", "pair", "mix", "cot", "policy",
                     *search.WRAPPERS}
    unis = {s.get("universe") for s in specs}
    assert set(search.MORE_UNIVERSES) <= unis


# One real row per kind from the live search, with the id it was stored under.
OLD_ROWS = {
    "070d84924269": {"assets": ["factor.MOM", "factor.SMB"], "kind": "mix", "lookback": 252,
                     "scale": "fixed", "trend": True, "vol_target": None},
    "8bac6a63120b": {"fallback": "bond", "kind": "timing", "leverage": 1.0, "param": 252,
                     "rebalance": "D", "rule": "vix_below_average"},
    "fa3cb52f36e1": {"k": 2, "kind": "rank", "long_short": False, "lookback": 189,
                     "rank_on": "near_high", "rebalance": "W", "skip": 0, "universe": "ind"},
    "1af3b05023f7": {"kind": "trend", "long_only": False, "lookback": 378, "rebalance": "M",
                     "skip": 21, "universe": "oil"},
    "fe6070bd1531": {"indicator": "ichimoku", "kind": "chart", "long_only": True,
                     "rebalance": "W", "universe": "ind"},
    "b044047473e9": {"a": "fx.NZD", "b": "fx.JPY", "delay": 0, "entry": 2.5, "kind": "pair",
                     "window": 120},
    "4d03f7e3fb50": {"k": 1, "kind": "policy", "lookback": 0, "rank_on": "policy_gap",
                     "rebalance": "W", "stress_off": 0.0, "universe": "xg10"},
    "ee1376154b8e": {"entry": 1.5, "follow": False, "kind": "cot", "lookback": 260,
                     "mode": "extremes", "rebalance": "M"},
}


def test_old_universes_and_ids_are_unchanged():
    # The original universes keep their assets, so an old id builds what it built.
    assert search.UNIVERSES["fac"][1] == ["factor.SMB", "factor.HML", "factor.MOM",
                                          "factor.RMW", "factor.CMA", "factor.LTREV"]
    assert len(search.UNIVERSES["g10"][1]) == 9 and len(search.UNIVERSES["fx21"][1]) == 21
    for sid, spec in OLD_ROWS.items():
        assert search.spec_id(spec) == sid
        assert search.describe(spec)["name"]
        search.build(spec)


def test_blend_parts_are_sorted_so_order_does_not_matter():
    for spec in WRAPPED["_ensemble"]:
        ids = [search.spec_id(p) for p in spec["parts"]]
        assert ids == sorted(ids) and len(set(ids)) == len(ids) >= 2


def test_regime_filter_reads_yesterday_only():
    gate = {"series": "risk.VIX", "test": "above_avg", "window": 21}
    base = search.gate_on(PANEL, gate)
    bumped = PANEL.copy()
    day = PANEL.index[400]
    bumped.loc[day, "risk.VIX"] = 1e6
    after = search.gate_on(bumped, gate)
    assert after.loc[:day].equals(base.loc[:day])
    assert after.loc[PANEL.index[401]] == 1.0


def test_risk_target_scales_toward_the_target():
    spec = {"kind": "voltarget", "target": 0.05, "window": 63, "cap": 3.0, "rebalance": "D",
            "base": {"kind": "trend", "universe": "g10", "lookback": 126, "skip": 0,
                     "rebalance": "M", "long_only": False}}
    strat = search.build(spec)
    w = strat.weights(PANEL[_cols(strat)])
    rets = PANEL[list(w.columns)].pct_change(fill_method=None).fillna(0.0)
    port = (w.shift(1) * rets).sum(axis=1).iloc[600:]
    assert 0.03 < port.std() * np.sqrt(252) < 0.08
    assert w.abs().sum(axis=1).max() <= 3.0 + 1e-9


def test_saturated_samplers_are_drawn_less():
    r = random.Random(1)
    i = [fn for fn, _ in search.SAMPLERS].index(search._positioning)
    seen = {search.spec_id(search._positioning(r)) for _ in range(20000)}
    stats = search.novelty(random.Random(2), seen)
    assert stats[i][0] == 0
    fresh = [fn for fn, _ in search.SAMPLERS].index(search._gated)
    assert stats[fresh][0] >= stats[fresh][1] - 1


def test_repeats_are_rejected_before_backtesting_and_never_recounted(tmp_path, monkeypatch):
    monkeypatch.setattr(search, "_panel", lambda: (PANEL, "test", set(PANEL.columns)))
    calls = []
    real = search.evaluate

    def counting(spec, *a, **k):
        calls.append(search.spec_id(spec))
        return real(spec, *a, **k)

    monkeypatch.setattr(search, "evaluate", counting)
    # A tiny space of eight variations: the second batch runs out of new ones.
    eight = [{"kind": "pair", "a": "fx.EUR", "b": b, "window": 60, "entry": 2.0, "delay": 0}
             for b in ["fx.GBP", "fx.JPY", "fx.CHF", "fx.CAD", "fx.AUD", "fx.NZD", "fx.NOK",
                       "fx.SEK"]]
    monkeypatch.setattr(search, "SAMPLERS", [(lambda r: dict(r.choice(eight)), 1)])
    con = search.connect(tmp_path / "s.db")
    first = search.run_batch(6, seed=4, con=con)
    second = search.run_batch(6, seed=4, con=con)
    ids = [row[0] for row in con.execute("SELECT id FROM trials")]
    assert first["tried"] + first["failed"] == 6
    assert second["tried"] + second["failed"] == 2 and second["repeats"] > 0
    assert len(ids) == len(set(ids)) == 8 == len(calls) == len(set(calls))


def test_offset_moves_the_rebalance_day():
    base = {"kind": "trend", "universe": "g10", "lookback": 63, "skip": 0, "rebalance": "M",
            "long_only": False}
    plain = search.build(base)
    shifted = search.build({"kind": "offset", "base": base, "days": 3})
    wp = plain.weights(PANEL[_cols(plain)])
    ws = shifted.weights(PANEL[_cols(shifted)])
    change = lambda w: set(w.index[w.diff().abs().sum(axis=1) > 0])  # noqa: E731
    month_ends = set(PANEL.index.to_series().groupby(PANEL.index.to_period("M")).max())
    assert change(wp) <= month_ends
    assert not change(ws) & month_ends
    pos = {d: i for i, d in enumerate(PANEL.index)}
    assert all(PANEL.index[pos[d] - 3] in month_ends for d in change(ws))


def test_blend_of_funded_and_self_financing_books_keeps_its_capital():
    funded = {"kind": "trend", "universe": "mkt", "lookback": 126, "skip": 0,
              "rebalance": "M", "long_only": True}
    free = {"kind": "rank", "universe": "g10", "rank_on": "momentum", "lookback": 63,
            "skip": 0, "k": 2, "long_short": True, "rebalance": "M"}
    strat = search.build({"kind": "ensemble", "parts": sorted([funded, free],
                                                              key=search.spec_id)})
    assert strat.funded
    w = strat.weights(PANEL[_cols(strat)])
    paid = w[[B.MKT, B.CASH]].sum(axis=1).iloc[300:]
    assert np.allclose(paid, 1.0)
    assert isinstance(w, pd.DataFrame)
