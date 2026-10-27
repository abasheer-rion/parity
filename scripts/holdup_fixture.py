"""Write the cross-check fixture for the web port of the "how it holds up" numbers.

Makes two made-up cases and records what engine/src/parity/metrics/holdup.py returns
for each, so web/tests/holdup.test.ts can check web/src/lib/holdup.ts against it:

  full   seven years of business days (2018 to 2024) with a benchmark, a stock index,
         a bond index and a 10-year rate, 40 strategies tried, Holm over two extra tests
  bare   about 400 days with nothing but the strategy's returns, 1 try

Every input value is rounded to 10 significant digits so both languages read the same
numbers. The bootstrap uses NumPy's random generator, which the browser cannot copy, so
the test compares its ranges within a tolerance and everything else exactly.

Usage: python3 scripts/holdup_fixture.py   (needs the engine installed: pip install -e engine)
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd
from parity.metrics.holdup import holdup

OUT = Path(__file__).resolve().parents[1] / "web/tests/fixtures/holdup-python.json"


def rounded(x: np.ndarray) -> np.ndarray:
    return np.array([float(f"{v:.10g}") for v in x])


def series(dates: pd.DatetimeIndex, values: np.ndarray) -> dict:
    return {"dates": [d.date().isoformat() for d in dates], "values": [float(v) for v in values]}


def full_case() -> dict:
    rng = np.random.default_rng(26)
    dates = pd.bdate_range("2018-01-02", "2024-12-31")
    n = len(dates)
    market = rng.normal(0.0004, 0.011, n)
    covid = (dates >= "2020-02-19") & (dates <= "2020-03-23")
    market[covid] -= 0.012
    bonds = rng.normal(0.0001, 0.004, n) - 0.15 * market
    strat = 0.0003 + 0.35 * market + rng.normal(0, 0.006, n)
    strat[covid] += 0.004
    cash = np.full(n, 0.00008)
    rates = 2.5 + np.cumsum(rng.normal(0, 0.03, n))
    m, b, s, c, rt = (rounded(v) for v in (market, bonds, strat, cash, rates))
    ex = rounded(s - c)
    # The benchmark starts a month later than the strategy, so joins are exercised.
    inputs = {
        "returns": series(dates, s),
        "excess": series(dates, ex),
        "benchmark": series(dates[21:], m[21:]),
        "stocks": series(dates, m),
        "bonds": series(dates, b),
        # Rates are a weekly level, as a slower data source would give.
        "rates": series(dates[::5], rt[::5]),
        "n_trials": 40,
        "test_p_values": {"placebo_timing": 0.03, "bootstrap_sharpe_above_zero": 0.01},
        "breakeven_bps": 42.5,
        "cost_bps": 5.0,
        "names": {"strategy": "fixture", "benchmark": "market", "stocks": "market",
                  "bonds": "bonds", "rates": "rate"},
    }
    return inputs


def bare_case() -> dict:
    rng = np.random.default_rng(27)
    dates = pd.bdate_range("2021-03-01", periods=400)
    s = rounded(rng.normal(0.0002, 0.009, len(dates)))
    return {"returns": series(dates, s), "n_trials": 1}


def run(inputs: dict) -> dict:
    def ser(key: str) -> pd.Series | None:
        v = inputs.get(key)
        return pd.Series(v["values"], index=pd.to_datetime(v["dates"])) if v else None

    return holdup(ser("returns"), ser("benchmark"), inputs["n_trials"], stocks=ser("stocks"),
                  bonds=ser("bonds"), rates=ser("rates"), excess=ser("excess"),
                  test_p_values=inputs.get("test_p_values"),
                  breakeven_bps=inputs.get("breakeven_bps"), cost_bps=inputs.get("cost_bps"),
                  names=inputs.get("names"))


def main() -> None:
    cases = {}
    for name, make in (("full", full_case), ("bare", bare_case)):
        inputs = make()
        cases[name] = {"inputs": inputs, "expected": run(inputs)}
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(cases, separators=(",", ":")) + "\n")
    print(f"wrote {OUT} ({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
