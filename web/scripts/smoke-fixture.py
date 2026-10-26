"""Builds the small results files the CI smoke test serves (web/tests/fixtures/smoke/).

A full nightly run is about 14 MB. This keeps 8 strategies, every 8th chart point and a
few raw series, so every page that reads a run has real-shaped data in CI.

    python3 web/scripts/smoke-fixture.py engine/output web/tests/fixtures/smoke
"""

import json
import sys
from pathlib import Path

KEEP = ["us_market_buy_hold", "fx_carry", "fx_commodity_gap", "fx_rsi_reversion", "stocks_rsi2_dip",
        "stocks_trend_10m", "stocks_trend_or_bonds", "stocks_trend_leveraged"]
SERIES = ["fx.EUR", "fx.JPY", "fx.AUD", "fx.CAD", "cmd.WTI", "cmd.BRENT", "eq.US_TOTAL", "eq.SPY", "rate.USD", "bond.UST10Y"]
STEP = 8


def thin(points):
    return points[::STEP] + ([points[-1]] if points and (len(points) - 1) % STEP else [])


def main(src: Path, out: Path) -> None:
    out.mkdir(parents=True, exist_ok=True)
    d = json.loads((src / "latest.json").read_text())
    runs = [r for r in d["runs"] if r["strategy"] in KEEP]
    for r in runs:
        r["equity"] = thin(r["equity"])
        r["drawdown"] = thin(r["drawdown"])
        sens = (r.get("gauntlet") or {}).get("sensitivity")
        if isinstance(sens, dict) and "variants" in sens:
            sens["variants"] = [{**v, "equity": thin(v["equity"])} if "equity" in v else v for v in sens["variants"][:4]]
    d["runs"] = runs
    names = d["comparison"]["names"]
    idx = [names.index(s) for s in KEEP if s in names]
    d["comparison"]["names"] = [names[i] for i in idx]
    d["comparison"]["correlation"] = [[row[j] for j in idx] for row in (d["comparison"]["correlation"][i] for i in idx)]
    for c in d["comparison"]["crises"]:
        c["returns"] = {k: v for k, v in c["returns"].items() if k in KEEP}
    d["series"] = {k: {**v, "points": thin(v["points"])} for k, v in d["series"].items() if k in SERIES}
    (out / "latest.json").write_text(json.dumps(d, separators=(",", ":")))

    s = json.loads((src / "search.json").read_text())
    s["rows"] = s["rows"][:40]
    (out / "search.json").write_text(json.dumps(s, separators=(",", ":")))
    for f in ("latest.json", "search.json"):
        print(f, (out / f).stat().st_size // 1024, "kB")


if __name__ == "__main__":
    main(Path(sys.argv[1]), Path(sys.argv[2]))
