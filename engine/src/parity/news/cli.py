"""`parity news ...` commands."""

from __future__ import annotations

from pathlib import Path

import pandas as pd

from ..data.store import DEFAULT_DIR
from . import export, history, impact, sources, store


def add_parser(sub):
    n = sub.add_parser("news", help="news headlines and how markets moved after them")
    n.add_argument("action", choices=["fetch", "list", "impact", "records", "export"])
    n.add_argument("out", nargs="?", help="export: output folder, e.g. web/dist/data")
    n.add_argument("--source", action="append", help="limit to these source ids")
    n.add_argument("--limit", type=int, default=20, help="list/records: rows to show")
    n.add_argument("--currency", help="list: only items tagged with this currency")
    n.add_argument("--category", help="list: only this category")
    n.add_argument("--explain", type=int, default=0, metavar="N",
                   help="records: look up headlines for up to N record days on GDELT")
    n.add_argument("--strict", action="store_true", help="fetch: exit 1 if any source fails")
    return n


def run(args) -> int:
    return {"fetch": _fetch, "list": _list, "impact": _impact, "records": _records,
            "export": _export}[args.action](args)


def _fetch(args) -> int:
    chosen = [sources.BY_ID[s] for s in args.source] if args.source else sources.SOURCES
    collected, failed = [], 0
    for src in chosen:
        try:
            got = sources.fetch(src)
            collected += got
            print(f"{src.id:<13} ok    {len(got)} items")
        except sources.Skipped as exc:
            print(f"{src.id:<13} skip  {exc}")
        except Exception as exc:  # one dead feed should not stop the others
            failed += 1
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
