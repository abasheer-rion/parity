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
from .compare import SOURCE_PAIRS, source_checks, strategy_comparison
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
            data_dir: Path = store.DEFAULT_DIR, gauntlet: bool = True,
            specs: list[dict] | None = None, n_trials: int | None = None,
            kind: str = "exploratory") -> dict:
    """Run strategies and their gauntlets. `specs` ([{"name", "params"}]) pins exact
    parameters, as official runs do; otherwise every registered strategy runs with
    its defaults. `n_trials` overrides the trial count used for deflated Sharpe."""
    config = config or BacktestConfig()
    registry = strategies.available()
    if specs:
        instances = {s["name"]: strategies.get(s["name"], **s.get("params", {})) for s in specs}
        if "us_market_buy_hold" not in instances:
            instances = {"us_market_buy_hold": strategies.get("us_market_buy_hold"), **instances}
    else:
        names = names or list(registry)
        instances = {n: strategies.get(n) for n in names}

    needed = {k for s in instances.values() for k in s.required()}
    keys = sorted(needed | {"eq.US_TOTAL", "rate.USD", "rate.TBILL3M"})
    panel = store.panel(keys, data_dir)

    bench_cfg = BacktestConfig(**{**config.to_dict(), "target_vol": None, "cost_bps": 0.0})
    bench_res = run(strategies.get("us_market_buy_hold"), panel, bench_cfg)
    bench, bench_ex = bench_res.returns, bench_res.excess_returns
    if n_trials is None:
        n_trials = sum(1 for s in instances.values() if not s.is_benchmark)

    runs, all_returns = [], {}
    for name, strat in instances.items():
        cfg = bench_cfg if strat.is_benchmark else config
        res = run(strat, panel, cfg)
        metrics = performance.summary(res.returns, res.gross_returns,
                                      None if strat.is_benchmark else res.turnover,
                                      None if strat.is_benchmark else bench,
                                      n_trials=1 if strat.is_benchmark else n_trials,
                                      excess=res.excess_returns,
                                      benchmark_excess=None if strat.is_benchmark else bench_ex)
        all_returns[name] = res.excess_returns
        sig = strat.signal(panel)
        runs.append({
            "strategy": name,
            **type(strat).label(),
            "summary": strat.summary,
            "reference": strat.reference,
            "is_benchmark": strat.is_benchmark,
            "params": strat.params(),
            "config": cfg.to_dict(),
            "metrics": metrics,
            "yearly": performance.yearly_returns(res.returns),
            "equity": _weekly(res.equity),
            "drawdown": _weekly(performance.drawdown(res.returns), 4),
            "ic_decay": signal.ic_decay(sig, panel[[c for c in sig.columns if c in panel]])
            if sig is not None else [],
            "exposure": {k: round(float(v), 4) for k, v in res.weights.iloc[-1].items()}
            if len(res.weights) else {},
            "gauntlet": run_gauntlet(strat, panel, bench, cfg, n_trials, bench_ex)
            if gauntlet and not strat.is_benchmark else None,
        })

    check_keys = sorted({k for a, b, _ in SOURCE_PAIRS
                         for k in (a, b)})
    try:
        checks = source_checks(store.panel(check_keys, data_dir))
    except FileNotFoundError:
        checks = []
    return {
        "comparison": strategy_comparison(all_returns),
        "source_checks": checks,
        "series": market_series(data_dir),
        "schema_version": SCHEMA_VERSION,
        "kind": kind,
        "generated_at": datetime.now(UTC).isoformat(timespec="seconds"),
        "git_sha": _git_sha(),
        "n_trials": n_trials,
        "config": config.to_dict(),
        "coverage": store.coverage(data_dir),
        "runs": runs,
    }


def market_series(data_dir: Path = store.DEFAULT_DIR, start: str = "2000-01-01") -> dict:
    """Weekly levels of every cached series, for the dashboard's data explorer."""
    from .data import catalog

    out = {}
    for key, spec in catalog.CATALOG.items():
        try:
            s = store.load(key, data_dir)
        except FileNotFoundError:
            continue
        s = s[s.index >= start].resample("W-FRI").last().dropna()
        out[key] = {"description": spec.description, "source": spec.source, "code": spec.code,
                    "frequency": spec.frequency,
                    "points": [[d.date().isoformat(), float(f"{v:.6g}")] for d, v in s.items()]}
    return out


def write(doc: dict, out_dir: Path) -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / "latest.json"
    path.write_text(json.dumps(doc, separators=(",", ":"), default=str))
    return path
