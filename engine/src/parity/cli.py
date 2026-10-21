"""Command line entry point.

    parity fetch                 download every series in the catalog
    parity list                  show registered strategies
    parity run [names...]        backtest and write output/latest.json
    parity publish               send output/latest.json to Supabase
    parity official REG-0001     run a registered plan and record it in the ledger
    parity ledger verify         check the ledger's hash chain
    parity registration check    check every registration in registrations/
    parity currencies [--all]    every ISO 4217 currency, --all adds withdrawn ones
    parity market-size           BIS Triennial FX turnover by currency and instrument
    parity ticks PAIR --date D   stored ticks for one day (--import FILE to add a file)
    parity serve                 read-only JSON API on 127.0.0.1
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
    failed = [r for r in rows if not r["ok"] and r.get("required", True)]
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
    if names and "us_market_buy_hold" not in names:
        names = ["us_market_buy_hold", *names]
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


def _official(args) -> int:
    from .official import run_official

    run_official(args.registration, dry_run=args.dry_run)
    return 0


def _ledger(args) -> int:
    from . import ledger

    problems = ledger.verify()
    n = len(ledger.entries())
    if problems:
        print(f"Ledger BROKEN ({n} entries):")
        for p in problems:
            print(f"  - {p}")
        return 1
    print(f"Ledger intact: {n} entries, chain and detail files all match.")
    return 0


def _registration(args) -> int:
    from . import registration

    regs = [registration.load(args.id)] if args.id else registration.all_registrations()
    bad = 0
    for reg in regs:
        issues = registration.problems(reg, require_committed=args.committed)
        print(f"{reg.id}: {'ok' if not issues else '; '.join(issues)}")
        bad += bool(issues)
    return 1 if bad else 0


def _currencies(args) -> int:
    import pandas as pd

    from .data import currencies

    table = currencies.load(include_withdrawn=args.all, refresh_cache=args.refresh)
    if args.json:
        from .api import _records

        print(json.dumps(_records(table), indent=1))
        return 0
    for r in table.itertuples():
        units = "-" if pd.isna(r.minor_units) else r.minor_units
        extra = f"  withdrawn {r.withdrawn}" if r.status == "withdrawn" else ""
        fund = " (fund)" if r.is_fund else ""
        print(f"{r.code}  {r.numeric:>3}  {units!s:>2}  {r.name}{fund}{extra}  [{r.countries}]")
    n_cur = int((table["status"] == "current").sum())
    print(f"\n{len(table)} rows: {n_cur} current, {len(table) - n_cur} withdrawn. "
          "Source: ISO 4217 lists published by SIX Group.")
    return 0


def _market_size(args) -> int:
    from .data import market_size

    table = market_size.load(refresh_cache=args.refresh)
    rows = market_size.query(table, args.year, args.currency, args.instrument)
    if rows.empty:
        print("No rows for that filter.")
        return 1
    year = int(rows["year"].iloc[0])
    print(f"FX turnover, daily average in April {year}, USD billions (BIS Triennial Survey)")
    print("Shares add up to 200% because every trade has two currencies.\n")
    for r in rows.head(args.top).itertuples():
        print(f"{r.currency:<4} {r.instrument_name:<26} {r.turnover_usd_mn / 1000:>9,.1f}"
              f"  {r.share_pct:6.1f}%")
    print("\nSource: BIS Triennial Central Bank Survey, data.bis.org")
    return 0


def _ticks(args) -> int:
    from .data import ticks

    if args.import_file:
        for r in ticks.import_file(Path(args.import_file), args.pair, args.format):
            print(f"{r['pair']} {r['date']}: {r['rows']} ticks -> {r['path']}")
        return 0
    try:
        day = ticks.load(args.pair, args.date)
    except FileNotFoundError as exc:
        print(exc)
        return 1
    print(json.dumps(ticks.summary(day), indent=1))
    print(day.head(args.limit).to_string(index=False))
    return 0


def _serve(args) -> int:
    from . import api

    api.serve(args.port)
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
    r.add_argument("--start", default="1999-01-04")
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

    o = sub.add_parser("official", help="run a registered plan and record it in the ledger")
    o.add_argument("registration")
    o.add_argument("--dry-run", action="store_true")
    o.set_defaults(func=_official)

    lg = sub.add_parser("ledger", help="ledger tools")
    lg.add_argument("action", choices=["verify"])
    lg.set_defaults(func=_ledger)

    rg = sub.add_parser("registration", help="registration tools")
    rg.add_argument("action", choices=["check"])
    rg.add_argument("id", nargs="?")
    rg.add_argument("--committed", action="store_true",
                    help="also require the file to be committed and unchanged")
    rg.set_defaults(func=_registration)

    cu = sub.add_parser("currencies", help="list ISO 4217 currencies")
    cu.add_argument("--all", action="store_true", help="include withdrawn currencies")
    cu.add_argument("--refresh", action="store_true", help="download the lists again")
    cu.add_argument("--json", action="store_true")
    cu.set_defaults(func=_currencies)

    ms = sub.add_parser("market-size", help="BIS Triennial FX turnover")
    ms.add_argument("--year", type=int, default=None, help="survey year, default latest")
    ms.add_argument("--currency", default=None, help="e.g. EUR; TO1 is the market total")
    ms.add_argument("--instrument", default="A",
                    help="A total, B spot, E forwards, G NDFs, H FX swaps, I currency swaps, "
                         "R options, Z other")
    ms.add_argument("--top", type=int, default=25)
    ms.add_argument("--refresh", action="store_true", help="download from the BIS again")
    ms.set_defaults(func=_market_size)

    tk = sub.add_parser("ticks", help="FX ticks for one UTC day")
    tk.add_argument("pair", help="e.g. EURUSD")
    tk.add_argument("--date", help="YYYY-MM-DD (UTC)")
    tk.add_argument("--import", dest="import_file", metavar="FILE",
                    help="store a hand-downloaded HistData, TrueFX or ts_ns CSV (or zip)")
    tk.add_argument("--format", default="auto", choices=["auto", "histdata", "truefx", "csv"])
    tk.add_argument("--limit", type=int, default=10, help="rows to print")
    tk.set_defaults(func=_ticks)

    sv = sub.add_parser("serve", help="read-only JSON API on 127.0.0.1")
    sv.add_argument("--port", type=int, default=8765)
    sv.set_defaults(func=_serve)

    args = p.parse_args(argv)
    if args.cmd == "ticks" and not args.import_file and not args.date:
        p.error("ticks needs --date YYYY-MM-DD (or --import FILE)")
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
