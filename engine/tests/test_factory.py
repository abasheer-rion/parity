"""Every registered strategy, hand-written or from the factory (DEC-0014), must decide
today's weights from data up to today only, and must follow the plugin contract."""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from parity.data import catalog
from parity.strategies import available, get
from parity.strategies.base import ASSETS, FAMILIES, TAG_KEYS


def full_panel() -> pd.DataFrame:
    """Random but sensible values for every series in the catalog."""
    rng = np.random.default_rng(11)
    idx = pd.bdate_range("1998-01-01", "2012-12-31")
    n = len(idx)
    walk = lambda vol, drift=0.0, start=100.0: start * np.exp(np.cumsum(rng.normal(drift, vol, n)))  # noqa: E731
    data = {}
    for key in catalog.CATALOG:
        kind = key.split(".")[0]
        if kind == "rate":
            # Monthly series: change once a month, like the real ones.
            monthly = pd.Series(rng.normal(3, 1.5, n), index=idx).resample("ME").first()
            data[key] = monthly.reindex(idx, method="ffill").bfill().values
        elif kind == "bond" and key.startswith("bond.UST"):
            data[key] = 3 + np.cumsum(rng.normal(0, 0.05, n))
        elif key in ("risk.STLFSI", "risk.NFCI"):
            # Stress indexes sit around zero (zero is average stress).
            data[key] = np.cumsum(rng.normal(0, 0.05, n)) * 0.3
        elif key == "risk.VIX":
            data[key] = 20 * np.exp(np.cumsum(rng.normal(0, 0.05, n)) * 0.2)
        elif kind == "factor":
            data[key] = walk(0.006, 0.0002, 1.0)
        else:
            data[key] = walk(0.01, 0.0002)
    return pd.DataFrame(data, index=idx)


PANEL = full_panel()
# Cuts fall on month ends that are also Fridays, so monthly and weekly rebalance dates
# are the same in the cut run and the full run.
MONTH_ENDS = PANEL.index.to_series().groupby(PANEL.index.to_period("M")).max()
FRIDAYS = MONTH_ENDS[MONTH_ENDS.dt.day_of_week == 4]
CUTS = [FRIDAYS.iloc[i] for i in (5, 12, 20)]


@pytest.mark.parametrize("name", sorted(available()))
def test_no_look_ahead(name):
    """Weights up to a cut date must not change when later data is removed."""
    strat = get(name)
    cols = sorted(set(strat.required()) | {"rate.USD", "rate.TBILL3M", "eq.US_TOTAL"})
    full = strat.weights(PANEL[cols])
    for cut in CUTS:
        part = strat.weights(PANEL.loc[:cut, cols])
        a = full.loc[:cut].reindex(columns=part.columns)
        assert np.allclose(a.values, part.values, equal_nan=True, atol=1e-9), \
            f"{name} weights before {cut.date()} change when later data is removed"


@pytest.mark.parametrize("name", sorted(available()))
def test_contract(name):
    cls = available()[name]
    strat = get(name)
    assert cls.display_name and cls.summary, f"{name} needs a display name and summary"
    assert set(cls.tags) == set(TAG_KEYS)
    assert cls.tags["family"] in FAMILIES and cls.tags["asset"] in ASSETS
    combos = int(np.prod([len(v) for v in cls.param_grid.values()])) if cls.param_grid else 0
    assert combos <= 9, f"{name} grid has {combos} combinations; keep it small"
    for key in cls.param_grid:
        assert key in strat.params(), f"{name}: grid key {key} is not a parameter"
    for key in strat.required():
        assert key in catalog.CATALOG or key == "cash.USD", f"{name} needs unknown series {key}"
    w = strat.weights(PANEL[sorted(set(strat.required()) | {"rate.USD"})])
    assert set(w.columns) <= set(strat.instruments())
    gross = w.abs().sum(axis=1).max()
    assert gross <= cls.max_gross * 2 + 1e-9, f"{name} holds {gross:.2f} gross"


def test_factory_reaches_one_hundred():
    assert sum(1 for c in available().values() if not c.is_benchmark) >= 100
