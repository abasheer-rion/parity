from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from parity import strategies
from parity.backtest import BacktestConfig, run
from parity.strategies.base import Strategy


class _Fixed(Strategy):
    name = "_fixed"
    summary = "test helper"

    def __init__(self, w):
        self.w = w

    def instruments(self):
        return ["eq.US_TOTAL"]

    def weights(self, panel):
        return pd.DataFrame(self.w, index=panel.index, columns=["eq.US_TOTAL"])


def test_weights_are_held_from_the_next_day(panel):
    """A position decided on day t must not earn day t's return."""
    res = run(_Fixed(1.0), panel, BacktestConfig(start=None, cost_bps=0))
    spy = panel["eq.US_TOTAL"].pct_change()
    # First active day is the day after the first weight, so returns line up with t+1.
    pd.testing.assert_series_equal(res.returns.iloc[1:], spy.loc[res.returns.index[1:]],
                                   check_names=False)


def test_costs_reduce_returns_by_turnover(panel):
    free = run(_Fixed(1.0), panel, BacktestConfig(start=None, cost_bps=0))
    paid = run(_Fixed(1.0), panel, BacktestConfig(start=None, cost_bps=10))
    # One unit traded on entry and nothing after, so the gap is 10 bps once.
    assert (free.returns - paid.returns).sum() == pytest.approx(10 / 1e4)


def test_vol_target_lands_near_target(panel):
    res = run(_Fixed(1.0), panel, BacktestConfig(start=None, cost_bps=0, target_vol=0.10))
    realised = res.returns.iloc[120:].std() * np.sqrt(252)
    assert 0.08 < realised < 0.12


def test_carry_is_credited_for_fx_longs(panel):
    flat = panel.copy()
    flat["fx.AUD"] = 1.0  # no price moves, so any return is carry

    class LongAud(_Fixed):
        def instruments(self):
            return ["fx.AUD"]

        def weights(self, p):
            return pd.DataFrame(1.0, index=p.index, columns=["fx.AUD"])

    res = run(LongAud(1.0), flat, BacktestConfig(start=None, cost_bps=0))
    expected = (flat["rate.AUD"] - flat["rate.USD"]).iloc[0] / 100 / 252
    assert res.returns.iloc[5] == pytest.approx(expected)


@pytest.mark.parametrize("name", list(strategies.available()))
def test_every_registered_strategy_runs(panel, name):
    strat = strategies.get(name)
    assert set(strat.required()) <= set(panel.columns)
    res = run(strat, panel, BacktestConfig(start=None))
    assert len(res.returns) > 100
    assert np.isfinite(res.returns).all()
    assert res.weights.abs().sum(axis=1).max() <= strat.max_gross + 1e-9


DOCS = Path(__file__).resolve().parents[2] / "docs"


@pytest.mark.parametrize("name", list(strategies.available()))
def test_every_strategy_links_to_a_doc_that_exists(name):
    cls = strategies.available()[name]
    path, _, anchor = cls.reference.partition("#")
    assert path, f"{name} has no reference"
    target = DOCS / path
    assert target.exists(), f"{name} points at missing doc {path}"
    if anchor:
        text = target.read_text().lower()
        assert f"# {anchor.replace('-', ' ')}" in text, f"{name}: no heading for #{anchor}"
