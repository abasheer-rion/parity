"""`parity news ...` commands."""

from __future__ import annotations

from pathlib import Path

import pandas as pd

from .. import latency
from ..data.store import DEFAULT_DIR
from . import archive, backfill, export, history, impact, sources, store, study


def add_parser(sub):
    n = sub.add_parser("news", help="news headlines and how markets moved after them")
    n.add_argument("action", choices=["fetch", "list", "impact", "records", "export",
                                      "backfill", "search"])
    n.add_argument("out", nargs="?", help="export: output folder, e.g. web/dist/data")
    n.add_argument("--source", action="append", help="limit to these source ids")
    n.add_argument("--limit", type=int, default=20, help="list/records: rows to show")
    n.add_argument("--currency", help="list: only items tagged with this currency")
    n.add_argument("--category", help="list: only this category")
    n.add_argument("--explain", type=int, default=0, metavar="N",
                   help="records: look up headlines for up to N record days on GDELT")
    n.add_argument("--strict", action="store_true", help="fetch: exit 1 if any source fails")
    n.add_argument("--asset", help="impact/search: a catalog series, e.g. cmd.BRENT")
    n.add_argument("--topic", help="impact/search: a topic (OPEC, rate hike, war) or keywords")
    n.add_argument("--text", help="search: words that must appear")
    n.add_argument("--from", dest="start", help="first year or date, e.g. 2010 or 2010-06")
    n.add_argument("--to", dest="end", help="last year or date, inclusive")
    n.add_argument("--horizon", default=None, choices=list(study.HORIZONS),
                   help="impact: 1d, 5d or 20d (default 1d for moves, 5d for rankings)")
    n.add_argument("--rank", choices=["assets", "topics"],
                   help="impact: rank assets for --topic, or topics for --asset")
    n.add_argument("--backfill-source", action="append", dest="bsource",
                   choices=["fed", "ecb", "boj", "events", "gdelt", "sec8k"],
                   help="backfill: limit to these (default: all)")
    n.add_argument("--gdelt-limit", type=int, default=2,
                   help="backfill: GDELT requests this run (it allows one per 5 seconds)")
    return n


def run(args) -> int:
    return {"fetch": _fetch, "list": _list, "impact": _impact, "records": _records,
            "export": _export, "backfill": _backfill, "search": _search}[args.action](args)


def _fetch(args) -> int:
    chosen = [sources.BY_ID[s] for s in args.source] if args.source else \
        [s for s in sources.SOURCES if s.kind != "backfill"]
    collected, failed = [], 0
    for src in chosen:
        try:
            got = sources.fetch(src)
            collected += got
            latency.record_news(src.id, True, len(got))
            print(f"{src.id:<13} ok    {len(got)} items")
        except sources.Skipped as exc:
            print(f"{src.id:<13} skip  {exc}")
        except Exception as exc:  # one dead feed should not stop the others
            failed += 1
            latency.record_news(src.id, False, error=str(exc))
            print(f"{src.id:<13} ERR   {exc}")
    df, added = store.merge(collected)
    print(f"\n{added} new, {len(df)} stored in {store.articles_path()}")
    return 1 if failed and args.strict else 0


def _filtered(args) -> pd.DataFrame:
    df = store.load()
    if args.source:
        df = df[df["source"].isin(args.source)]
    if args.currency:
        df = df[df["currencies"].apply(lambda c: args.currency.upper() in c)]
    if args.category:
        df = df[df["category"] == args.category]
    return df


def _list(args) -> int:
    df = _filtered(args).head(args.limit)
    if df.empty:
        print("No stored headlines. Run `parity news fetch` first.")
        return 0
    for a in df.itertuples():
        when = pd.Timestamp(a.published_at).strftime("%Y-%m-%d %H:%M")
        tags = ",".join([*a.currencies, *a.commodities])
        print(f"{when}Z  {a.source:<10} {a.category:<13} {tags:<14} {a.title[:90]}")
    return 0


def _impact(args) -> int:
    if getattr(args, "asset", None) or getattr(args, "topic", None):
        return _study(args)
    panel = impact.load_panel()
    df = _filtered(args)
    table = impact.impacts(df, panel)
    path = store.impacts_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    table.to_parquet(path, index=False)
    print(f"{len(table)} rows for {df['id'].nunique() if len(df) else 0} articles in {path}")
    day = table[(table["horizon"] == "1d") & table["z"].notna()]
    if not day.empty:
        top = day.reindex(day["z"].abs().sort_values(ascending=False).index).head(args.limit)
        titles = df.set_index("id")["title"]
        print("\nBiggest next day moves after a headline (z = move / normal daily move)")
        for r in top.itertuples():
            unit = "%" if r.unit == "pct" else " pp" if r.unit == "pp" else " pt"
            print(f"  {r.series:<12} {r.move:+7.2f}{unit:<3} z {r.z:+5.1f}  "
                  f"{titles.get(r.article_id, '')[:70]}")
    return 0


def _records(args) -> int:
    panel = impact.load_panel()
    recs = history.all_records(panel, n=args.limit)
    if args.explain:
        n = history.explain_with_gdelt(recs, limit=args.explain)
        print(f"Looked up {n} days on GDELT\n")
    rows = history.explain(recs, store.load(), history.load_explanations())
    for r in rows:
        unit = "%" if r["unit"] == "pct" else " pp"
        head = r["news"][0]["title"][:60] if r["news"] else (r["note"] or "")
        z = f"{r['z']:+5.1f}" if r["z"] is not None else "  n/a"
        print(f"{r['label']:<18} #{r['rank']:<3}{r['date']}  {r['move']:+7.2f}{unit:<3} "
              f"z {z}  {head}")
    return 0


def _export(args) -> int:
    out = Path(args.out or "web/dist/data")
    info = export.build(out, DEFAULT_DIR)
    print(f"Wrote {info['articles']} articles and {info['records']} record days to {out}/news "
          f"(prices through {info['prices_through']})")
    return 0


def _backfill(args) -> int:
    which = args.bsource or ["fed", "ecb", "boj", "events", "sec8k", "gdelt"]
    start = int(str(args.start or 1971)[:4])
    end = int(str(args.end or 2100)[:4])
    added = backfill.run(which, start, end, gdelt_limit=args.gdelt_limit)
    for k, v in added.items():
        print(f"{k:<8} +{v}")
    years = archive.years()
    print(f"Archive: {len(years)} years ({years[0] if years else '-'} to "
          f"{years[-1] if years else '-'}) in {archive.archive_dir()}")
    return 0


def _search(args) -> int:
    df = archive.search(args.text, args.start, args.end, args.asset, args.topic, args.source,
                        limit=args.limit)
    if df.empty:
        print("Nothing found. Run `parity news backfill` to fill the archive.")
        return 0
    for a in df.itertuples():
        when = pd.Timestamp(a.published_at).strftime("%Y-%m-%d")
        print(f"{when}  {a.source:<7} {','.join(a.topics)[:24]:<24} {a.title[:90]}")
    return 0


def _num(v) -> str:
    return "  n/a" if v is None else f"{v:.3f}"


def _unit(u: str) -> str:
    return "%" if u == "pct" else " pp" if u == "pp" else " pt"


def _study(args) -> int:
    items = archive.load(args.start, args.end)
    if items.empty:
        print("The archive is empty for this range. Run `parity news backfill` first.")
        return 0
    if args.rank == "assets" or (args.topic and not args.asset):
        h = args.horizon or "5d"
        res = study.rank_assets(args.topic, items, horizon=h)
        print(f"Which assets moved most unusually {h} after '{args.topic}' "
              f"({args.start or 'start'} to {args.end or 'now'})\n")
        _print_rank(res, "label")
        return 0
    if args.rank == "topics":
        h = args.horizon or "5d"
        res = study.rank_topics(args.asset, items, horizon=h)
        print(f"Which topics came before the most unusual {h} moves in {args.asset}\n")
        _print_rank(res, "label")
        return 0
    if args.topic:  # one asset, one topic: the event study
        res = study.event_study(args.asset, study.matching(items, args.topic))
        print(f"Event study: {res['label']} after '{args.topic}', {res['n_headlines']} "
              f"headlines on {res['n_events']} event days "
              f"({res.get('n_overlapping', 0)} overlap another)\n")
        print("  horizon      N  mean z  95% band        median z  mean move  hit rate "
              "(random)  p vs random  q")
        for h, v in res["horizons"].items():
            band = f"[{v['ci_lo']:+.2f}, {v['ci_hi']:+.2f}]" if v["ci_lo"] is not None else "n/a"
            print(f"  {h:<8} {v['n']:>5}  {v['mean_z'] or 0:+6.2f}  {band:<15} "
                  f"{v['median_z'] or 0:+7.2f}  {v['mean_move'] or 0:+8.2f}{_unit(res['unit'])} "
                  f"{(v['hit_rate'] or 0):6.0%}   ({(v['random_hit_rate'] or 0):.0%})   "
                  f"{_num(v['p_random'])}       {_num(v['q'])}")
        print("\nBiggest 5 day moves among the events:")
        for e in res["events"][:10]:
            mark = " (overlaps)" if e["overlaps"] else ""
            title = e["items"][0]["title"][:70] if e["items"] else ""
            print(f"  {e['event_date']}  z5 {e['z_5d'] or 0:+5.1f}{mark:<11} {title}")
        for w in res["warnings"]:
            print(f"! {w}")
        return 0
    h = args.horizon or "1d"
    res = study.top_moves(args.asset, items, horizon=h, n=args.limit)
    print(f"News days followed by the biggest unusual {h} moves in {res['label']} "
          f"({res['n_items']} headlines, {res['n_days']} days)\n")
    for d in res["days"]:
        title = d["items"][0]["title"][:70] if d["items"] else ""
        print(f"  {d['event_date']}  {d[f'move_{h}'] or 0:+7.2f}{_unit(res['unit']):<3} "
              f"z {d[f'z_{h}'] or 0:+5.1f}  ({d['n_headlines']} items)  {title}")
    for w in res["warnings"]:
        print(f"! {w}")
    return 0


def _print_rank(res: dict, name: str) -> None:
    print("  rank  what                          N  mean z  hit rate (random)  p      q")
    for i, r in enumerate(res["rows"], 1):
        if r["mean_z"] is None:
            continue
        thin = "  few events" if r["thin"] else ""
        p = f"{r['p_random']:.3f}" if r["p_random"] is not None else "  n/a"
        q = f"{r['q']:.3f}" if r["q"] is not None else "  n/a"
        print(f"  {i:>4}  {r[name][:26]:<26} {r['n_events']:>5}  {r['mean_z']:+6.2f}  "
              f"{(r['hit_rate'] or 0):6.0%}   ({(r['random_hit_rate'] or 0):.0%})   {p}  {q}{thin}")
    for w in res["warnings"]:
        print(f"! {w}")
