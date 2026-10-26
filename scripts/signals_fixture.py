"""Write web/tests/fixtures/signals.json: the engine's own per-bar sides for every
single-series rule that the Trade chart draws (web/src/lib/signals.ts), on fixed made-up
prices. The web test compares its port against these, so the chart and the research
engine cannot quietly disagree (DEC-0052).

Run from the repo root with the engine installed:
    engine/.venv/bin/python scripts/signals_fixture.py
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd
from parity.strategies import _blocks as B

OUT = Path(__file__).resolve().parents[1] / "web" / "tests" / "fixtures" / "signals.json"


def prices(n: int = 420, seed: int = 7) -> pd.Series:
    rng = np.random.default_rng(seed)
    # A walk with a slow wave in it, so trends, breakouts and reversals all happen.
    steps = rng.normal(0, 0.012, n) + 0.004 * np.sin(np.arange(n) / 25)
    return pd.Series(100 * np.exp(np.cumsum(steps)), index=pd.bdate_range("2020-01-01", periods=n))


def per_bar(px: pd.Series) -> dict[str, list[int]]:
    panel = pd.DataFrame({"x": px})
    out: dict[str, list[int]] = {}

    def side(frame: pd.DataFrame) -> list[int]:
        return [int(v) for v in np.sign(frame["x"].fillna(0.0)).values]

    for lookback in (21, 63, 126, 252):
        out[f"trend:{lookback}"] = side(np.sign(B.past_return(panel, lookback)))

    class Osc(B.OscillatorBook):
        universe = ["x"]

    for kind in ("macd", "ichimoku"):
        b = Osc()
        b.kind = kind
        out[kind] = side(b.signal(panel))
    b = Osc(kind="bollinger", window=20, band=2.0)
    out["bollinger:20:2"] = side(b.signal(panel))

    class Brk(B.BreakoutBook):
        universe = ["x"]

    b = Brk(entry=55, exit=20)
    # weights() sizes by volatility; the sign is the Turtle state.
    out["breakout:55:20"] = side(b.weights(panel))
    return out


def main() -> None:
    px = prices()
    doc = {"closes": [round(float(v), 10) for v in px.values], "sides": per_bar(px)}
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(doc, separators=(",", ":")) + "\n")
    print(f"wrote {OUT.relative_to(OUT.parents[2])}: {len(px)} bars, {len(doc['sides'])} rules")


if __name__ == "__main__":
    main()
