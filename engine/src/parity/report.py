"""Runs every registered strategy and writes one JSON file the dashboard can read.

The same document is what `parity publish` sends to Supabase, so the local
dashboard and the hosted one always show the same shape of data.
"""

from __future__ import annotations

import json
import subprocess
from datetime import UTC, datetime
from pathlib import Path

import pandas as pd

from . import strategies
from .backtest import BacktestConfig, run
from .data import store
from .gauntlet import run_gauntlet
from .metrics import performance, signal

SCHEMA_VERSION = 1


def _git_sha() -> str | None:
    try:
        return subprocess.check_output(["git", "rev-parse", "--short", "HEAD"], text=True,
                                       stderr=subprocess.DEVNULL).strip()
    except (OSError, subprocess.CalledProcessError):
        return None


def _weekly(series: pd.Series, digits: int = 5) -> list[list]:
    """Downsample to weekly points so the payload stays small."""
    s = series.resample("W-FRI").last().dropna()
    return [[d.date().isoformat(), round(float(v), digits)] for d, v in s.items()]


def run_all(names: list[str] | None = None, config: BacktestConfig | None = None,
            data_dir: Path = store.DEFAULT_DIR, gauntlet: bool = True) -> dict:
    config = config or BacktestConfig()
    registry = strategies.available()
    names = names or list(registry)
    instances = {n: strategies.get(n) for n in names}

    keys = sorted({k for s in instances.values() for k in s.required()} | {"eq.SPY"})
    panel = store.panel(keys, data_dir)

    bench_cfg = BacktestConfig(**{**config.to_dict(), "target_vol": None, "cost_bps": 0.0})
    bench = run(strategies.get("spy_buy_hold"), panel, bench_cfg).returns
    n_trials = sum(1 for s in instances.values() if not s.is_benchmark)

    runs = []
    for name, strat in instances.items():
        cfg = bench_cfg if strat.is_benchmark else config
        res = run(strat, panel, cfg)
        metrics = performance.summary(res.returns, res.gross_returns,
                                      None if strat.is_benchmark else res.turnover,
                                      None if strat.is_benchmark else bench,
                                      n_trials=1 if strat.is_benchmark else n_trials)
        sig = strat.signal(panel)
        runs.append({
            "strategy": name,
            "summary": strat.summary,
            "reference": strat.reference,
            "is_benchmark": strat.is_benchmark,
            "params": strat.params(),
            "config": cfg.to_dict(),
            "metrics": metrics,
            "yearly": performance.yearly_returns(res.returns),
            "equity": _weekly(res.equity),
            "drawdown": _weekly(performance.drawdown(res.returns), 4),
            "ic_decay": signal.ic_decay(sig, panel[strat.instruments()]) if sig is not None
            else [],
            "exposure": {k: round(float(v), 4) for k, v in res.weights.iloc[-1].items()}
            if len(res.weights) else {},
            "gauntlet": run_gauntlet(strat, panel, bench, cfg, n_trials)
            if gauntlet and not strat.is_benchmark else None,
        })

    return {
        "schema_version": SCHEMA_VERSION,
        "generated_at": datetime.now(UTC).isoformat(timespec="seconds"),
        "git_sha": _git_sha(),
        "n_trials": n_trials,
        "config": config.to_dict(),
        "coverage": store.coverage(data_dir),
        "runs": runs,
    }


def write(doc: dict, out_dir: Path) -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / "latest.json"
    path.write_text(json.dumps(doc, indent=1, default=str))
    return path
