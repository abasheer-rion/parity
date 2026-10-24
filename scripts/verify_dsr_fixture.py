"""Write the cross-check fixture for Verify's TypeScript luck check (REF-0016, test 7).

Makes 20 random return series (normal, fat tailed, skewed, with rare crashes; 40 to 900
days each), rounds each value to 10 significant digits so both languages read the same
numbers, and records the engine's deflated_sharpe() for tries from 1 to 10,000. The
TypeScript port (web/src/lib/verify/dsr.ts) must match every value to 3 decimal places
(web/tests/verify/dsr.test.ts).

Usage: python3 scripts/verify_dsr_fixture.py   (needs the engine installed: pip install -e engine)
"""

from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np
import pandas as pd
from parity.metrics.performance import deflated_sharpe

OUT = Path(__file__).resolve().parents[1] / "web/tests/fixtures/verify/dsr-python.json"
TRIES = [1, 2, 3, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000]


def series(rng: np.random.Generator, i: int) -> np.ndarray:
    n = int(rng.integers(40, 900))
    drift = float(rng.uniform(-0.0005, 0.0025))
    vol = float(rng.uniform(0.003, 0.02))
    kind = i % 4
    if kind == 0:
        x = rng.normal(drift, vol, n)
    elif kind == 1:
        x = drift + vol * rng.standard_t(3, n) / math.sqrt(3)
    elif kind == 2:
        x = drift + vol * (rng.lognormal(0, 0.6, n) - math.exp(0.18)) * -1
    else:
        x = rng.normal(drift, vol, n)
        crash = rng.random(n) < 0.01
        x[crash] -= rng.uniform(0.03, 0.15, int(crash.sum()))
    return np.array([float(f"{v:.10g}") for v in x])


def main() -> None:
    rng = np.random.default_rng(16)
    out = []
    for i in range(20):
        x = series(rng, i)
        r = pd.Series(x)
        expected = {str(n): round(deflated_sharpe(r, n), 6) for n in TRIES}
        out.append({"returns": x.tolist(), "expected": expected})
    OUT.parent.mkdir(parents=True, exist_ok=True)
    doc = {"generator": "scripts/verify_dsr_fixture.py",
           "function": "parity.metrics.performance.deflated_sharpe", "tries": TRIES, "series": out}
    OUT.write_text(json.dumps(doc, separators=(",", ":")) + "\n")
    print(f"wrote {OUT} ({len(out)} series)")


if __name__ == "__main__":
    main()
