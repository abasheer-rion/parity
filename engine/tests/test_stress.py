"""Monte Carlo stress tests (DEC-0066) on made-up weekly prices."""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from parity import stress


def _levels(weeks: int = 600, seed: int = 3) -> dict[str, pd.Series]:
    rng = np.random.default_rng(seed)
    idx = pd.date_range("1990-01-05", periods=weeks, freq="W-FRI")
    return {k: pd.Series(100 * np.exp(np.cumsum(rng.normal(mu, sd, weeks))), index=idx)
            for k, mu, sd in [("stocks", 0.002, 0.02), ("bonds10", 0.001, 0.008)]}


def test_simulate_shape_and_start():
    rets = stress.weekly_simple(_levels(), ["stocks", "bonds10"])
    v = stress.simulate(rets, {"stocks": 60, "bonds10": 40}, 52, 200, seed=1)
    assert v.shape == (200, 53)
    assert np.all(v[:, 0] == 1)


def test_same_seed_same_paths_and_crash_is_spliced():
    rets = stress.weekly_simple(_levels(), ["stocks", "bonds10"])
    w = {"stocks": 100}
    a = stress.simulate(rets, w, 30, 50, seed=4)
    assert np.array_equal(a, stress.simulate(rets, w, 30, 50, seed=4))
    crash = (rets.index[100].date().isoformat(), rets.index[109].date().isoformat())
    c = stress.simulate(rets, w, 30, 50, seed=4, crash=crash, crash_at=5)
    want = np.cumprod(1 + rets["stocks"].iloc[100:110].to_numpy())
    # Every path has the same ten crash weeks from week 5.
    np.testing.assert_allclose(c[:, 15] / c[:, 5], want[-1])


def test_drawdown_and_recovery_by_hand():
    v = np.array([[1.0, 1.2, 0.9, 1.0, 1.25, 1.3],     # peak 1.2 at 1, low at 2, back at 4
                  [1.0, 1.1, 1.2, 1.3, 1.4, 1.5],      # never falls
                  [1.0, 0.8, 0.7, 0.75, 0.8, 0.9]])    # never makes it back
    d = stress.drawdown_stats(v)
    assert d["worst"] == pytest.approx([0.9 / 1.2 - 1, 0.0, -0.3])
    assert list(d["recover"]) == [3, 0, -1]


def test_export_runs_every_preset_it_has_data_for():
    doc = stress.export(_levels(), n=100)
    ids = [m["id"] for m in doc["mixes"]]
    assert ids == ["sixty_forty", "all_stocks", "bonds_heavy"]  # others need missing data
    run = doc["mixes"][0]["runs"]["52"]["none"]
    assert run["n"] == 100 and len(run["final"]) == 5 and run["final"] == sorted(run["final"])
    assert set(doc["mixes"][0]["runs"]["520"]) == {"none", *(c[0] for c in stress.CRASHES)}
