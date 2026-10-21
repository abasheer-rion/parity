"""Command line entry point.

    parity fetch                 download every series in the catalog
    parity list                  show registered strategies
    parity run [names...]        backtest and write output/latest.json
    parity publish               send output/latest.json to Supabase
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from . import report, strategies
from .backtest import BacktestConfig
from .data import store

DEFAULT_OUT = Path(__file__).resolve().parents[2] / "output"


def _fetch(args) -> int:
    rows = store.refresh(args.keys or None)
    width = max(len(r["key"]) for r in rows)
    for r in rows:
        status = f"{r['first']} to {r['last']} ({r['rows']} rows)" if r["ok"] else r["error"]
        print(f"{r['key']:<{width}}  {'ok ' if r['ok'] else 'ERR'}  {status}")
    failed = [r for r in rows if not r["ok"]]
    return 1 if failed and args.strict else 0


def _list(_args) -> int:
    for name, cls in strategies.available().items():
        tag = " (benchmark)" if cls.is_benchmark else ""
        print(f"{name}{tag}\n    {cls.summary}")
    return 0


def _run(args) -> int:
    cfg = BacktestConfig(start=args.start, end=args.end, cost_bps=args.cost_bps,
                         target_vol=args.target_vol, include_carry=not args.no_carry)
    names = args.names or None
    if names and "spy_buy_hold" not in names:
        names = ["spy_buy_hold", *names]
    doc = report.run_all(names, cfg, gauntlet=not args.quick)
    path = report.write(doc, Path(args.out))
    print(f"Wrote {path}\n")
    print(f"{'strategy':<20}{'CAGR':>8}{'vol':>8}{'Sharpe':>8}{'maxDD':>8}{'DSR':>7}{'vs SPY':>9}")
    for r in doc["runs"]:
        m = r["metrics"]

        def pct(v):
            return "   n/a" if v is None else f"{v * 100:7.1f}%"

        def num(v, w=8):
            return " " * (w - 3) + "n/a" if v is None else f"{v:{w}.2f}"

        print(f"{r['strategy']:<20}{pct(m['cagr'])}{pct(m['ann_vol'])}{num(m['sharpe'])}"
              f"{pct(m['max_drawdown'])}{num(m['deflated_sharpe'], 7)}"
              f"{pct(m.get('excess_cagr')) if not r['is_benchmark'] else '        -'}")
    gauntlets = [r for r in doc["runs"] if r.get("gauntlet")]
    if gauntlets:
        print("\nGauntlet (A = beats the S&P 500, B = is it real)")
        for r in gauntlets:
            g = r["gauntlet"]
            def mark(t):
                return "pass" if t["passed"] else "FAIL" if t["passed"] is False else "n/a"

            marks = " ".join(f"{t['id']}:{mark(t)}" for t in g["tests"])
            print(f"  {r['strategy']:<18} {g['passed']}/{g['total']}  {marks}")
            print(f"  {'':<18} {g['verdict']}")
    return 0


def _publish(args) -> int:
    from .publish import supabase

    doc = json.loads(Path(args.file).read_text())
    try:
        batch_id = supabase.publish(doc)
    except supabase.NotConfigured as exc:
        print(f"Skipped publish: {exc}")
        return 0 if args.allow_missing else 1
    print(f"Published batch {batch_id}")
    return 0


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="parity", description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)

    f = sub.add_parser("fetch", help="download data into the local cache")
    f.add_argument("keys", nargs="*", help="catalog keys; default is everything")
    f.add_argument("--strict", action="store_true", help="exit non-zero if any source fails")
    f.set_defaults(func=_fetch)

    sub.add_parser("list", help="list strategies").set_defaults(func=_list)

    r = sub.add_parser("run", help="backtest strategies")
    r.add_argument("names", nargs="*")
    r.add_argument("--start", default="2000-01-01")
    r.add_argument("--end", default=None)
    r.add_argument("--cost-bps", type=float, default=1.0)
    r.add_argument("--target-vol", type=float, default=None,
                   help="annualised vol target, e.g. 0.15 to match the S&P 500")
    r.add_argument("--no-carry", action="store_true")
    r.add_argument("--quick", action="store_true", help="skip the gauntlet tests")
    r.add_argument("--out", default=str(DEFAULT_OUT))
    r.set_defaults(func=_run)

    pub = sub.add_parser("publish", help="send a run to Supabase")
    pub.add_argument("--file", default=str(DEFAULT_OUT / "latest.json"))
    pub.add_argument("--allow-missing", action="store_true",
                     help="exit 0 when Supabase credentials are not configured")
    pub.set_defaults(func=_publish)

    args = p.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
