"""The self-widening search (DEC-0037): when most draws are repeats it opens new ground
by fixed rules, level 0 still draws exactly what it always drew, widened variations
build, never look ahead and never hold an untradable series, and every one of them is
counted in the luck check."""

from __future__ import annotations

import hashlib
import random

import numpy as np
import pandas as pd
import pytest
from test_factory import CUTS, PANEL

from parity import search

PLAIN = [search._draw(fn, random.Random(i), None)
         for i, (fn, _) in enumerate(search.BASE_SAMPLERS * 8)]


def _ctx(level: int) -> search.Context:
    return search.Context(pool=PLAIN, level=level)


def test_level_zero_draws_exactly_what_the_search_always_drew():
    # Pinned from the search as it was before widening existed: the same seed must give
    # the same 500 variations, so nothing already tried is drawn differently.
    r = random.Random(7)
    ids = [search.spec_id(search.sample(r, _ctx(0))) for _ in range(500)]
    assert hashlib.sha1(",".join(ids).encode()).hexdigest()[:16] == "595cad9894f9cf50"
    assert search.refine(search.LOOKBACKS, 0) is search.LOOKBACKS


def test_refine_makes_grids_finer_and_wider_within_bounds():
    base = [21, 63, 126, 252]
    one = search.refine(base, 1, geo=True, lo=10, hi=504)
    assert set(base) < set(one)
    assert min(one) < 21 and max(one) > 252
    assert all(isinstance(v, int) and 10 <= v <= 504 for v in one)
    two = search.refine(base, 2, geo=True, lo=10, hi=504)
    assert set(one) <= set(two) and len(two) > len(one)
    signed = search.refine([-0.5, 0.0, 0.5], 1, integer=False, lo=-0.75, hi=0.75)
    assert signed == [-0.75, -0.5, -0.25, 0.0, 0.25, 0.5, 0.75]
    assert len(search._lookbacks(_ctx(1))) > len(search.LOOKBACKS)
    assert min(search._lookbacks(_ctx(2))) < 5 and max(search._lookbacks(_ctx(2))) > 756


def _draws(level: int, n: int, seed: int = 11) -> list[dict]:
    r = random.Random(seed)
    return [search.sample(r, _ctx(level)) for _ in range(n)]


def _parts(spec: dict):
    yield spec
    for p in spec.get("parts", []):
        yield from _parts(p)
    if "base" in spec:
        yield from _parts(spec["base"])


def test_each_level_opens_new_ground():
    l0 = {search.spec_id(s) for s in _draws(0, 600)}
    l1 = _draws(1, 600)
    l3 = _draws(3, 1500)
    assert any("subset" in p for s in l1 for p in _parts(s))
    assert not any("subset" in p for s in _draws(0, 600) for p in _parts(s))
    assert len({search.spec_id(s) for s in l1} - l0) > 400
    # A region worked through at level 0 has room again at level 1.
    r = random.Random(1)
    seen = {search.spec_id(search._positioning(r)) for _ in range(20000)}
    i = [fn for fn, _ in search.SAMPLERS].index(search._positioning)
    assert search.novelty(random.Random(2), seen, _ctx(0))[i][0] == 0
    assert search.novelty(random.Random(2), seen, _ctx(1))[i][0] > 10
    sizes = {len(p["parts"]) for s in l3 for p in _parts(s) if p["kind"] == "ensemble"}
    assert {4, 5} <= sizes
    assert [search._max_depth(_ctx(lv)) for lv in range(5)] == [3, 3, 4, 5, 5]


def _cols(strat) -> list[str]:
    return sorted(set(strat.required()) | {"rate.USD", "rate.TBILL3M", "eq.US_TOTAL"})


@pytest.mark.parametrize("level", [1, 2, 3])
def test_widened_variations_build_hold_only_tradables_and_never_look_ahead(level):
    specs = _draws(level, 400, seed=20 + level)
    for spec in specs:
        d = search.describe(spec)
        assert d["name"] and len(d["name"]) <= 70, d["name"]
        assert d["line"].endswith(".") and "\u2014" not in d["line"] + d["name"]
        held = set(search.build(spec).instruments())
        assert held <= search.TRADABLE, (held - search.TRADABLE, spec)
    # Look-ahead on a sample that includes subsets and the finest grids.
    picked = [s for s in specs if any("subset" in p for p in _parts(s))][:4] + specs[:6]
    for spec in picked:
        strat = search.build(spec)
        cols = _cols(strat)
        if not set(cols) <= set(PANEL.columns):
            continue
        full = strat.weights(PANEL[cols])
        assert np.isfinite(full.values).all()
        part = strat.weights(PANEL.loc[:CUTS[0], cols])
        a = full.loc[:CUTS[0]].reindex(columns=part.columns)
        assert np.allclose(a.values, part.values, equal_nan=True, atol=1e-9), spec


def test_a_subset_book_trades_only_its_subset():
    spec = {"kind": "rank", "universe": "g10", "rank_on": "momentum", "lookback": 63,
            "skip": 0, "k": 1, "long_short": True, "rebalance": "M",
            "subset": ["fx.AUD", "fx.EUR", "fx.JPY", "fx.NZD"]}
    strat = search.build(spec)
    w = strat.weights(PANEL[_cols(strat)])
    busy = [c for c in w.columns if w[c].abs().sum() > 0]
    assert set(busy) <= set(spec["subset"])
    assert "(4 of 9)" in search.describe(spec)["name"]


def _batches(con, rows):
    con.executemany("INSERT INTO batches (at, tried, failed, repeats, level) "
                    "VALUES ('t', ?, ?, ?, 0)", rows)
    con.commit()


def test_widens_only_after_a_full_window_of_mostly_repeats(tmp_path):
    con = search.connect(tmp_path / "s.db")
    _batches(con, [(20, 0, 30)] * (search.WIDEN_WINDOW - 1))
    assert search.maybe_widen(con) is None and search.widen_level(con) == 0
    _batches(con, [(20, 0, 30)])
    line = search.maybe_widen(con)
    assert line and line.startswith("widened the search to level 1: 60% of draws")
    assert "\u2014" not in line and search.widen_level(con) == 1
    # The window starts again after a widening.
    assert search.maybe_widen(con) is None
    _batches(con, [(45, 1, 4)] * search.WIDEN_WINDOW)
    assert search.maybe_widen(con) is None and search.widen_level(con) == 1
    _batches(con, [(10, 0, 40)] * search.WIDEN_WINDOW)
    assert search.maybe_widen(con).startswith("widened the search to level 2")


def test_widening_stops_at_the_last_level(tmp_path):
    con = search.connect(tmp_path / "s.db")
    for _ in range(search.MAX_LEVEL + 2):
        _batches(con, [(5, 0, 45)] * search.WIDEN_WINDOW)
        search.maybe_widen(con)
    assert search.widen_level(con) == search.MAX_LEVEL


def test_run_batch_records_its_draws_and_uses_the_level(tmp_path, monkeypatch):
    monkeypatch.setattr(search, "_panel", lambda: (PANEL, "test", set(PANEL.columns)))
    seen_levels = []
    original = search._draw

    def spy(fn, r, ctx):
        seen_levels.append(ctx.level)
        return original(fn, r, ctx)

    con = search.connect(tmp_path / "s.db")
    con.execute("INSERT INTO widenings VALUES (2, 't', 0.6, 0, 'x')")
    con.commit()
    monkeypatch.setattr(search, "_draw", spy)
    out = search.run_batch(3, seed=1, con=con)
    assert out["level"] == 2 and set(seen_levels) == {2}
    row = con.execute("SELECT tried, failed, repeats, level FROM batches").fetchone()
    assert row[0] + row[1] == 3 and row[3] == 2


def test_every_try_counts_in_the_luck_check():
    rng = np.random.default_rng(0)
    df = pd.DataFrame({"sr_daily": rng.normal(0, 0.02, 200), "n_days": 5000,
                       "skew": 0.0, "kurt": 3.0})
    few = search.deflate(df)
    more = search.deflate(df, 5000)
    assert (more <= few).all() and (more < few).any()
