from __future__ import annotations

import pytest
from test_factory import PANEL

from parity.backtest import BacktestConfig
from parity.backtest.engine import run
from parity.holdout import HOLDOUT_START, RESEARCH_CUTOFF, clamp_config, forward_start
from parity.strategies import get


def test_research_config_is_capped_at_sealed_date():
    assert clamp_config(BacktestConfig()).end == RESEARCH_CUTOFF
    assert clamp_config(BacktestConfig(end="2030-01-01")).end == RESEARCH_CUTOFF
    assert clamp_config(BacktestConfig(end="2020-01-01")).end == "2020-01-01"
    with pytest.raises(ValueError, match="research start"):
        clamp_config(BacktestConfig(start="2027-01-01"))


def test_forward_evaluation_starts_after_seal_and_registration():
    assert forward_start("2020-01-01T00:00:00+00:00") == HOLDOUT_START
    assert forward_start("2026-10-30T00:00:00+00:00") == "2026-11-02"


def test_backtest_engine_enforces_boundary_and_official_can_score_forward():
    strategy = get("us_market_buy_hold")
    ordinary = run(strategy, PANEL, BacktestConfig(start="1999-01-04", end="2030-01-01"))
    assert ordinary.config.end == RESEARCH_CUTOFF
    explicit = run(strategy, PANEL, BacktestConfig(start="2026-10-30"),
                    _allow_holdout=True)
    assert explicit.config.start == "2026-10-30" and explicit.config.end is None
