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
    parity scenario --type military_strike --region middle_east --severity 4
                                 what markets did after past events like a scenario
    parity scenario export       write output/scenarios.json for the dashboard
    parity world export          write output/world.json for Sim World's map
    parity world paths --asset EUR --asset oil --weeks 26
                                 simulated paths from blocks of real weekly returns (CSV)
    parity new-strategy "Name" --family F --asset A
                                 create the files for a new strategy
    parity analyse NAME          strengths and weaknesses report for one strategy

    parity news fetch            fetch headlines from sources whose terms allow it
    parity news list             show the newest stored headlines
    parity news impact           how markets moved after each stored headline
    parity news records          biggest market days since 1999 (--explain asks GDELT)
    parity news export DIR       write the News page's JSON into DIR/news
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


def _world(args) -> int:
    import pandas as pd

    from . import scenarios as sc
    from . import world

    levels = world.load_levels()
    if args.action == "export":
        doc = world.export(levels, world.load_rates(), sc.load_events())
        out = Path(args.out or DEFAULT_OUT / "world.json")
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(doc, separators=(",", ":")))
        print(f"Wrote {out}: {len(doc['assets'])} series, {len(doc['events'])} events, "
              f"data through {doc['data_through']}")
        return 0
    assets = args.asset or ["EUR", "JPY", "oil", "stocks"]
    missing = [a for a in assets if a not in levels]
    if missing:
        print(f"No data for {', '.join(missing)}. Known: {', '.join(sorted(levels))}",
              file=sys.stderr)
        return 1
    weekly = pd.concat({a: levels[a].resample("W-FRI").last() for a in assets}, axis=1)
    rets = world.weekly_returns(weekly)
    pool = None
    if args.pool == "analogues":
        spec = sc.Spec(type=args.type, regions=args.region, actors=args.actor,
                       severity=args.severity, commodities=args.commodity)
        picked = sc.match(sc.load_events(), spec)
        if not picked:
            print("No past event is close enough to draw analogue weeks from.", file=sys.stderr)
            return 1
        pool = world.analogue_mask(rets.index, [ev["date"] for _, ev in picked])
        print(f"Drawing from the {world.ANALOGUE_WEEKS} weeks after {len(picked)} past events",
              file=sys.stderr)
    sim = world.bootstrap_paths(rets, args.weeks, args.n, args.block, args.seed, pool)
    text = world.paths_csv(sim, assets)
    out = args.out or "paths.csv"
    if out == "-":
        sys.stdout.write(text)
    else:
        Path(out).write_text(text)
        print(f"Wrote {out}: {args.n} paths of {args.weeks} weeks, blocks of "
              f"{sim['block']} weeks from {sim['pool_weeks']} weeks of history", file=sys.stderr)
    finals = [(a, sim["levels"][:, -1, i]) for i, a in enumerate(assets)]
    for name, final in [*finals, ("basket", sim["basket"][:, -1])]:
        r = world.risk(final, args.loss_at)
        print(f"{name:<8} median {r['median']:+.1%}  worst 5% {r['worst5']:+.1%}  "
              f"chance of losing more than {args.loss_at:g}% {r['p_loss_gt']:.0%}",
              file=sys.stderr)
    print("Simulated from history, not a forecast.", file=sys.stderr)
    return 0


def _serve(args) -> int:
    from . import api

    api.serve(args.port)
    return 0


def _scenario(args) -> int:
    from . import scenarios as sc

    events = sc.load_events()
    problems = sc.validate(events)
    if problems:
        print("\n".join(problems), file=sys.stderr)
        return 1
    prices = sc.load_prices()
    if args.action == "export":
        doc = sc.export(events, prices)
        out = Path(args.out)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(doc, separators=(",", ":")))
        print(f"Wrote {out}: {len(doc['events'])} events, data through {doc['data_through']}")
        return 0
    spec = sc.Spec(type=args.type, regions=args.region, actors=args.actor,
                   severity=args.severity, commodities=args.commodity)
    studied = sc.event_study(events, prices)
    picked = sc.match(studied, spec, min_score=args.min_score, limit=args.limit)
    if not picked:
        print("No past event is close enough. Loosen the scenario or lower --min-score.")
        return 0
    print(f"{len(picked)} analogues (history, not a forecast)\n")
    for s, ev in picked:
        print(f"  {s:4.2f}  {ev['date']}  {ev['name']}")
    assets = args.asset or ["oil", "usd", "jpy", "chf", "sp500", "vix", "ust10y"]
    agg = sc.aggregate([ev for _, ev in picked], assets)
    units = {a.key: {"pct": "%", "bp": " bp", "points": " pt"}[a.measure] for a in sc.ASSETS}
    print(f"\n{'asset':<8}{'horizon':>8}{'n':>4}{'median':>11}{'middle half':>24}{'up':>7}")
    for key, per in agg.items():
        u = units[key]
        for h, v in per.items():
            mid = f"{v['q25']:+.1f}{u} to {v['q75']:+.1f}{u}"
            med = f"{v['median']:+.1f}{u}"
            print(f"{key:<8}{h:>8}{v['n']:>4}{med:>11}{mid:>24}"
                  f"{v['up'] * 100:>6.0f}%")
    print("\nSmall samples, changing regimes and events priced in beforehand all limit this.")
def _new_strategy(args) -> int:
    from .scaffold import REPO_ROOT, ScaffoldError, scaffold

    try:
        out = scaffold(args.name, args.family, args.asset, style=args.style,
                       horizon=args.horizon, sid=args.id, description=args.description,
                       root=Path(args.root) if args.root else REPO_ROOT, dry_run=args.dry_run)
    except ScaffoldError as exc:
        print(f"Refused: {exc}")
        return 1
    verb = "Would create" if out["dry_run"] else "Created"
    print(f"{verb} strategy {out['id']} ({out['catalog_id']}):")
    for f in out["files"]:
        print(f"  {f}")
    if not out["dry_run"] and out["doc"] != "built":
        print(f"  catalog page: {out['doc']}. Run `python3 scripts/docs.py index`.")
    print("\nNext steps:")
    for i, step in enumerate(out["next_steps"], 1):
        print(f"  {i}. {step}")
    return 0


def _search(args) -> int:
    from . import search

    if args.action == "run":
        if args.forever:
            search.run_forever(batch=args.batch, max_hours=args.hours)
            return 0
        out = search.run_batch(args.n, seed=args.seed)
        print(f"tried {out['tried']}, failed {out['failed']}")
    doc = search.export() if args.action in ("run", "export") else None
    df = search.load()
    good = df[df["error"].isna()].copy()
    if not len(good):
        print("nothing tried yet")
        return 0
    good["deflated"] = search.deflate(good)
    print(f"{len(df)} variations tried, {len(good)} ran, "
          f"{int(good['beats_market'].sum())} beat the market's Sharpe, "
          f"{int((good['deflated'] >= 0.95).sum())} pass the luck check")
    for _, r in good.sort_values("deflated", ascending=False).head(10).iterrows():
        print(f"  {r['deflated']:.2f}  Sharpe {r['sharpe']:.2f}  {r['cagr']:6.1%}  {r['name']}")
    if doc:
        print(f"wrote {len(doc['rows'])} rows to engine/output/search.json")
    return 0


def _analyse(args) -> int:
    from .analysis import analyse_strategy, to_markdown
    from .data import store

    data_dir = Path(args.data_dir) if args.data_dir else store.DEFAULT_DIR
    if not (data_dir / "raw").exists():
        print(f"No data in {data_dir}. Run `parity fetch` or pass --data-dir.")
        return 1
    cfg = BacktestConfig(start=args.start, end=args.end, cost_bps=args.cost_bps)
    try:
        a = analyse_strategy(args.name, cfg, data_dir, n_trials=args.trials)
    except KeyError as exc:
        print(exc.args[0])
        return 1
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    md, js = out / f"{args.name}.md", out / f"{args.name}.json"
    md.write_text(to_markdown(a))
    js.write_text(json.dumps(a, indent=2, default=str) + "\n")
    print(f"Wrote {md}\nWrote {js}\n")
    if a["verdict"]:
        print(a["verdict"])
    print("Strengths:")
    for x in a["strengths"] or ["none found"]:
        print(f"  + {x}")
    print("Weaknesses:")
    for x in a["weaknesses"] or ["none found"]:
        print(f"  - {x}")
    return 0
def _news(args) -> int:
    from .news import cli as news_cli

    return news_cli.run(args)


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

    sc = sub.add_parser("scenario", help="historical analogues for a made-up event")
    sc.add_argument("action", nargs="?", choices=["show", "export"], default="show")
    sc.add_argument("--type", help="e.g. military_strike, war, oil_supply_shock")
    sc.add_argument("--region", action="append", default=[], help="repeatable")
    sc.add_argument("--actor", action="append", default=[], help="repeatable, e.g. iran")
    sc.add_argument("--severity", type=int, choices=range(1, 6))
    sc.add_argument("--commodity", action="append", default=[], help="oil, gas, metals, grains")
    sc.add_argument("--asset", action="append", default=[], help="asset keys to show")
    sc.add_argument("--min-score", type=float, default=0.35)
    sc.add_argument("--limit", type=int, default=12)
    sc.add_argument("--out", default=str(DEFAULT_OUT / "scenarios.json"))
    sc.set_defaults(func=_scenario)

    wd = sub.add_parser("world", help="Sim World's map file and simulated paths (DEC-0016)")
    wd.add_argument("action", choices=["export", "paths"])
    wd.add_argument("--out", default=None,
                    help="export: default output/world.json; paths: a CSV file, or - for stdout")
    wd.add_argument("--asset", action="append", default=[], help="EUR, oil, stocks, ...")
    wd.add_argument("--weeks", type=int, default=26)
    wd.add_argument("--n", type=int, default=1000, help="number of paths")
    wd.add_argument("--block", type=int, default=4, help="weeks per block")
    wd.add_argument("--seed", type=int, default=None)
    wd.add_argument("--loss-at", type=float, default=10.0, help="percent loss to count")
    wd.add_argument("--pool", choices=["all", "analogues"], default="all")
    wd.add_argument("--type", help="analogues: kind of event")
    wd.add_argument("--region", action="append", default=[])
    wd.add_argument("--actor", action="append", default=[])
    wd.add_argument("--severity", type=int, choices=range(1, 6))
    wd.add_argument("--commodity", action="append", default=[])
    wd.set_defaults(func=_world)
    from .strategies.base import ASSETS, FAMILIES

    ns = sub.add_parser("new-strategy", help="create the files for a new strategy")
    ns.add_argument("name", help='human name, e.g. "Currency carry"')
    ns.add_argument("--family", required=True, choices=FAMILIES)
    ns.add_argument("--asset", required=True, choices=ASSETS)
    ns.add_argument("--style", default=None, help='short phrase, e.g. "momentum"')
    ns.add_argument("--horizon", default=None, help='e.g. "daily", "monthly", "multi-month"')
    ns.add_argument("--id", default=None, help="snake_case id; default comes from the name")
    ns.add_argument("--description", default=None, help="one short plain sentence")
    ns.add_argument("--root", default=None, help="repo root to write into (for tests)")
    ns.add_argument("--dry-run", action="store_true", help="show what would be created")
    ns.set_defaults(func=_new_strategy)

    an = sub.add_parser("analyse", help="strengths and weaknesses report for one strategy")
    an.add_argument("name")
    an.add_argument("--data-dir", default=None,
                    help="data folder; default is engine/data or $PARITY_DATA_DIR")
    an.add_argument("--start", default="1999-01-04")
    an.add_argument("--end", default=None)
    an.add_argument("--cost-bps", type=float, default=1.0)
    an.add_argument("--trials", type=int, default=None,
                    help="trial count for deflated Sharpe; default is every strategy")
    an.add_argument("--out", default=str(DEFAULT_OUT / "analysis"))
    an.set_defaults(func=_analyse)

    se = sub.add_parser("search", help="the always-on strategy search (DEC-0014)")
    se.add_argument("action", choices=["run", "status", "export"])
    se.add_argument("--n", type=int, default=200, help="variations to try (run)")
    se.add_argument("--forever", action="store_true", help="keep going; for the service")
    se.add_argument("--batch", type=int, default=50, help="variations per batch (forever)")
    se.add_argument("--seed", type=int, default=None)
    se.add_argument("--hours", type=float, default=None,
                    help="with --forever, exit after this long so the service can restart")
    se.set_defaults(func=_search)

    from .news import cli as news_cli

    news_cli.add_parser(sub).set_defaults(func=_news)

    args = p.parse_args(argv)
    if args.cmd == "ticks" and not args.import_file and not args.date:
        p.error("ticks needs --date YYYY-MM-DD (or --import FILE)")
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
