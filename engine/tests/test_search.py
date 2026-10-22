"""The always-on search (DEC-0014): every sampled variation builds, names itself, never
looks ahead, and more trials make the luck check stricter, never looser."""

from __future__ import annotations

import random

import numpy as np
import pandas as pd
from test_factory import CUTS, PANEL

from parity import search

SPECS = [search.sample(random.Random(i)) for i in range(120)]


def test_every_sampled_spec_builds_and_has_a_short_name():
    for spec in SPECS:
        d = search.describe(spec)
        assert d["name"] and len(d["name"]) <= 70, d["name"]
        assert d["line"].endswith(".")
        strat = search.build(spec)
        w = strat.weights(PANEL[sorted(set(strat.required()) | {"rate.USD"})])
        assert set(w.columns) <= set(strat.instruments())
        assert np.isfinite(w.values).all()


def test_sampled_specs_never_look_ahead():
    for spec in SPECS[:60]:
        strat = search.build(spec)
        cols = sorted(set(strat.required()) | {"rate.USD", "rate.TBILL3M", "eq.US_TOTAL"})
        full = strat.weights(PANEL[cols])
        cut = CUTS[1]
        part = strat.weights(PANEL.loc[:cut, cols])
        a = full.loc[:cut].reindex(columns=part.columns)
        assert np.allclose(a.values, part.values, equal_nan=True, atol=1e-9), spec


def test_spec_id_is_stable_and_order_free():
    a = {"kind": "pair", "a": "fx.EUR", "b": "fx.CHF", "window": 60, "entry": 2.0, "delay": 0}
    b = dict(reversed(list(a.items())))
    assert search.spec_id(a) == search.spec_id(b)


def test_more_trials_raise_the_bar():
    rng = np.random.default_rng(0)
    rows = pd.DataFrame({"sr_daily": rng.normal(0.01, 0.02, 2000), "n_days": 6000,
                         "skew": 0.0, "kurt": 3.0})
    few = search.deflate(rows.head(20))
    many = search.deflate(rows)
    assert many.head(20).mean() < few.mean()
