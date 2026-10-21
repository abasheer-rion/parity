import numpy as np
import pandas as pd
import pytest

from parity.data import catalog, sources
from parity.metrics import performance, signal


def _returns(values):
    return pd.Series(values, index=pd.bdate_range("2020-01-01", periods=len(values)))


def test_max_drawdown():
    r = _returns([0.10, -0.50, 0.20])
    assert performance.max_drawdown(r) == pytest.approx(-0.5)


def test_cagr_of_flat_growth():
    r = _returns([0.0] * 252)
    assert performance.cagr(r) == pytest.approx(0.0)


def test_deflated_sharpe_falls_as_trials_rise():
    rng = np.random.default_rng(1)
    r = _returns(rng.normal(0.0005, 0.01, 1500))
    one = performance.deflated_sharpe(r, n_trials=1)
    many = performance.deflated_sharpe(r, n_trials=100)
    assert 0 <= many < one <= 1


def test_summary_has_no_nans():
    r = _returns(np.random.default_rng(2).normal(0, 0.01, 300))
    out = performance.summary(r, benchmark=r * 0.5)
    assert all(v is None or v == v for v in out.values())


def test_perfect_signal_has_ic_of_one():
    rng = np.random.default_rng(3)
    idx = pd.bdate_range("2020-01-01", periods=300)
    px = pd.DataFrame(np.exp(np.cumsum(rng.normal(0, 0.01, (300, 5)), axis=0)), index=idx)
    perfect = signal.forward_returns(px, 5)
    ic = signal.information_coefficient(perfect, signal.forward_returns(px, 5))
    assert ic.mean() == pytest.approx(1.0)


def test_parse_fred_csv_inverts_and_skips_missing():
    text = "observation_date,DEXJPUS\n2024-01-02,100\n2024-01-03,.\n2024-01-04,125\n"
    s = sources.parse_fred_csv(text, catalog.get("fx.JPY"))
    assert list(s.values) == [0.01, 0.008]
