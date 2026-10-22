"""Synthetic market data so tests never touch the network."""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from parity.data import catalog


@pytest.fixture
def panel() -> pd.DataFrame:
    rng = np.random.default_rng(7)
    idx = pd.bdate_range("2010-01-01", "2016-12-31")
    n = len(idx)
    data = {}
    for ccy in catalog.G10:
        data[f"fx.{ccy}"] = np.exp(np.cumsum(rng.normal(0, 0.006, n)))
    for i, ccy in enumerate(["USD", *catalog.G10]):
        data[f"rate.{ccy}"] = np.full(n, 0.5 + i * 0.4)
    oil = np.exp(np.cumsum(rng.normal(0, 0.02, n))) * 60
    data["cmd.WTI"] = oil
    data["cmd.BRENT"] = oil * 1.05
    data["eq.SPY"] = np.exp(np.cumsum(rng.normal(0.0004, 0.011, n))) * 100
    data["eq.US_TOTAL"] = data["eq.SPY"]
    data["cmd.HH_GAS"] = np.exp(np.cumsum(rng.normal(0, 0.03, n))) * 3
    for ccy in ["USD", *catalog.G10]:
        data[f"reer.{ccy}"] = 100 * np.exp(np.cumsum(rng.normal(0, 0.003, n)))
    # Everything else in the catalog (factory data, DEC-0014): plain random walks, or
    # levels for yields and the VIX.
    for key in catalog.CATALOG:
        if key in data:
            continue
        if key.startswith("bond.UST"):
            data[key] = 3 + np.cumsum(rng.normal(0, 0.03, n))
        elif key == "risk.VIX":
            data[key] = 20 * np.exp(np.cumsum(rng.normal(0, 0.01, n)))
        elif key == "rate.TBILL3M":
            data[key] = data["rate.USD"]  # same as the US rate, so cash tests still hold
        else:
            data[key] = np.exp(np.cumsum(rng.normal(0.0002, 0.008, n))) * 100
    return pd.DataFrame(data, index=idx)
