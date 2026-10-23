"""`parity markets ...` commands."""

from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path

from ..data.store import DEFAULT_DIR
from . import export, sources, store


def add_parser(sub):
    m = sub.add_parser("markets", help="crypto, perps, ETFs, new fund filings and private "
                       "markets (product side)")
    m.add_argument("action", choices=["fetch", "status", "export"])
    m.add_argument("out", nargs="?", help="export: output folder, e.g. web/dist/data")
    m.add_argument("--source", action="append", help="fetch: only these source ids")
    m.add_argument("--force", action="store_true", help="fetch: ignore how fresh a source is")
    m.add_argument("--strict", action="store_true", help="fetch: exit 1 if any source fails")
    m.add_argument("--no-ask", action="store_true",
                   help="export: leave out sources whose display rights are still undecided")
    return m


def run(args) -> int:
    return {"fetch": _fetch, "status": _status, "export": _export}[args.action](args)


def _fetch(args) -> int:
    chosen = [sources.BY_ID[s] for s in args.source] if args.source else sources.SOURCES
    failed = 0
    for src in chosen:
        if not args.force and store.is_fresh(src.id, src.max_age_hours):
            print(f"{src.id:<20} fresh (younger than {src.max_age_hours:g} h)")
            continue
        kwargs = {}
        if src.id == "sec-filings":
            etfs = store.load("etfs")
            kwargs["fund_ciks"] = set(etfs["cik"].astype(str)) if not etfs.empty else set()
        if src.id == "sec-formd":
            have = store.load("formd")
            kwargs["have"] = set(have["quarter"]) if not have.empty else set()
        try:
            tables = sources.fetch(src, **kwargs)
            rows = {}
            for name, df in tables.items():
                store.merge(name, df)
                rows[name] = len(df)
            store.record(src.id, {"ok_at": datetime.now(UTC).isoformat(timespec="seconds"),
                                  "rows": rows, "error": None})
            print(f"{src.id:<20} ok    " + ", ".join(f"{n} {r}" for n, r in rows.items()))
        except sources.Skipped as exc:
            print(f"{src.id:<20} skip  {exc}")
        except Exception as exc:  # one dead source should not stop the others
            failed += 1
            store.record(src.id, {"error": str(exc)[:300],
                                  "error_at": datetime.now(UTC).isoformat(timespec="seconds")})
            print(f"{src.id:<20} ERR   {exc}")
    return 1 if failed and args.strict else 0


def _status(args) -> int:
    st = store.state()
    for src in sources.SOURCES:
        e = st.get(src.id, {})
        print(f"{src.id:<20} last ok {e.get('ok_at') or 'never':<26} display {src.display:<4} "
              f"{('error: ' + e['error'][:60]) if e.get('error') else ''}")
    return 0


def _export(args) -> int:
    out = Path(args.out or "web/dist/data")
    info = export.build(out, DEFAULT_DIR, include_ask=not args.no_ask)
    counts = ", ".join(f"{k} {v}" for k, v in info.items())
    print(f"Wrote markets files to {out}/markets: {counts}")
    return 0
