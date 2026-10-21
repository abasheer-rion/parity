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
    return pd.DataFrame(data, index=idx)
