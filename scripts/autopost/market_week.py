"""The weekly market comparison (DEC-0073): one week's change across a fixed set of markets,
from Parity Terminal's export (<data>/terminal/index.json, written by `parity terminal export`).

The set is fixed and listed in the same order every week, by asset class, never by return
(DEC-0015). Only series whose terms allow reuse are shown: public domain or free to reuse with
the source named, and CoinGecko with its attribution. Each move is compared with that market's
own usual weekly move (the z score in the export), which is how the post decides what to call
large. Nothing in the post is a forecast.
"""
from __future__ import annotations

import datetime as dt
import json
from pathlib import Path

from .common import AUTO_NOTE, Draft, fingerprint, long_date, signed, site_origin

# Groups in the order they are shown, and how many series each may contribute.
GROUPS = [("us_equities", 3), ("ust_curve", 4), ("fx_index", 1), ("fx_g10", 6), ("commodities", 4), ("crypto", 2)]
PREFER = ["bond.UST2Y", "bond.UST10Y", "bond.UST30Y", "rate.TBILL3M", "usd.BROAD", "cmd.WTI", "cmd.BRENT"]
OK_LICENCE = ("public domain", "free to reuse", "coingecko", "with citation")
CLASS_WORD = {"us_equities": "Stocks", "ust_curve": "US Treasury yields", "fx_index": "The dollar",
              "fx_g10": "Currencies", "commodities": "Commodities", "crypto": "Crypto"}


def allowed(row: dict) -> bool:
    text = f"{row.get('licence', '')} {row.get('source', '')} {row.get('attribution', '')}".lower()
    return any(k in text for k in OK_LICENCE)


def basket(index: dict) -> list[dict]:
    rows = [r for r in index.get("series", []) if allowed(r) and (r.get("chg") or {}).get("w1") is not None
            and r.get("freq") in ("D", "B", "W", None)]
    out = []
    for group, n in GROUPS:
        g = [r for r in rows if r.get("group") == group]
        g.sort(key=lambda r: (PREFER.index(r["key"]) if r["key"] in PREFER else len(PREFER), r["key"]))
        if group == "ust_curve":
            g = [r for r in g if r.get("kind") == "level" and r.get("unit") == "%"]
        out += g[:n]
    return out


def move_text(r: dict) -> tuple[str, float]:
    """The week's move as printed, and the number printed."""
    w1 = float(r["chg"]["w1"])
    if r.get("kind") == "price":
        v = round(w1, 2)
        return f"{signed(v, 2)}%", v
    pts = round(w1 * 100) if r.get("unit") == "%" else round(w1, 2)
    if r.get("unit") == "%":
        return f"{signed(pts, 0)} bp", float(pts)
    return f"{signed(pts, 2)} {r.get('unit', '')}".strip(), pts


def build(index: dict, today: dt.date) -> Draft | None:
    rows = basket(index)
    if len(rows) < 6:
        return None
    asof = max(r["asof"] for r in rows)
    end = dt.date.fromisoformat(asof)
    slug = f"markets-week-to-{end.isoformat()}"
    truth: list[float] = []
    table = ["| Market | Class | Last | Week's move | Move against its usual week |", "| --- | --- | --- | --- | --- |"]
    chart_rows = []
    for r in rows:
        mtxt, mval = move_text(r)
        truth.append(mval)
        last = round(float(r["last"]), 2)
        truth.append(last)
        z = r.get("z")
        ztxt = "not enough history"
        if z is not None:
            zr = round(float(z), 1)
            truth.append(zr)
            ztxt = f"{signed(zr, 1)} times"
        table.append(f"| {r['label']} | {CLASS_WORD.get(r['group'], r['group'])} | {last:,.2f} | {mtxt} | {ztxt} |")
        chart_rows.append([r.get("short") or r["label"], float(z) if z is not None else 0.0, mtxt])
    unusual = [r for r in rows if r.get("z") is not None and abs(float(r["z"])) >= 2]
    calm = [r for r in rows if r.get("z") is not None and abs(float(r["z"])) < 0.5]
    biggest = max((r for r in rows if r.get("z") is not None), key=lambda r: abs(float(r["z"])), default=None)

    lines = [f"This is how {len(rows)} markets moved in the week to {long_date(end)}, from the data behind Parity Terminal. "
             "The list is the same every week and is ordered by asset class, not by return.", "",
             "Each move is also shown against that market's usual weekly move over the last three years. "
             "A reading of 2 means the week moved about twice as far as a typical week. "
             "That is how this post decides what to call large.", ""]
    lines += ["## The week in one table", ""] + table + [""]
    lines += ["## What stood out", ""]
    if biggest is not None:
        t, _ = move_text(biggest)
        lines.append(f"- The largest move against its own history was {biggest['label']}, at {t}, "
                     f"{signed(round(float(biggest['z']), 1), 1)} times its usual week.")
    if unusual:
        lines.append(f"- {len(unusual)} of the {len(rows)} markets moved more than twice their usual week: "
                     + ", ".join(r["label"] for r in unusual) + ".")
        truth.append(float(len(unusual)))
    else:
        lines.append(f"- None of the {len(rows)} markets moved more than twice its usual week.")
    if calm:
        lines.append(f"- {len(calm)} moved less than half their usual week: " + ", ".join(r["label"] for r in calm) + ".")
        truth.append(float(len(calm)))
    truth.append(float(len(rows)))
    lines += ["", "## How to read this", "",
              "Yields are shown in basis points, where 100 basis points is one percentage point. "
              "Prices and indexes are shown in percent. A week is the last value against the value seven days earlier. "
              "Markets that do not trade every day use their newest value, so a few rows can end a day or two before the others.",
              "",
              "One week says little about the next. These numbers describe what happened. They are not a forecast "
              "and not a reason to trade.", "",
              f"The same series, with longer history, are in [Parity Terminal](/terminal/). How each source may be used "
              "is listed on the [data catalog](/app/#/registry).", "", AUTO_NOTE]
    sources = []
    seen = set()
    for r in rows:
        src = r.get("attribution") or r.get("source") or ""
        if src and src not in seen:
            seen.add(src)
            sources.append(src)
    meta = {
        "title": f"Markets in the week to {long_date(end)}",
        "dek": f"How {len(rows)} markets moved, each against its own usual week, from the data behind Parity Terminal.",
        "slug": slug, "date": today, "type": "Analysis", "stance": "Analysis", "status": "published",
        "authors": ["parity-markets-desk"], "tags": ["markets", "weekly"], "markets": sorted({CLASS_WORD[g] for g, _ in GROUPS}),
        "auto": "market_week", "auto_data": fingerprint([[r["key"], r["asof"], r["last"]] for r in rows]),
        "hero": {"kind": "chart", "chart": slug, "alt": f"Bars for {len(rows)} markets showing each week's move against "
                 f"its usual week; the largest is {biggest['label'] if biggest else 'none'}."},
        "sources": [{"id": "terminal", "title": "Parity Terminal data export", "url": "/terminal/", "publisher": "Parity"}]
        + [{"id": f"src{i + 1}", "title": s, "url": "/app/#/registry", "publisher": s} for i, s in enumerate(sources)],
    }
    body = "\n".join(lines).replace("from the data behind Parity Terminal. ", "from the data behind Parity Terminal[^terminal]. ", 1)
    chart = {"chart": {"title": f"Markets in the week to {long_date(end)}",
                       "sub": "Each week's move against that market's usual weekly move (z score)",
                       "foot": f"Source: Parity Terminal export, {', '.join(sources)[:120]}",
                       "source": "Parity Terminal export", "rows": chart_rows}}
    truth.append(100.0)  # "100 basis points is one percentage point"
    strip = sorted({r["label"] for r in rows} | {r.get("short") or "" for r in rows} - {""}, key=len, reverse=True)
    return Draft(job="market_week", meta=meta, body=body, truth=truth, urls=set(), strip=strip,
                 files={f"data/{slug}.json": json.dumps(chart, indent=1) + "\n"})


def load(data: Path) -> dict | None:
    f = Path(data) / "terminal" / "index.json"
    return json.loads(f.read_text()) if f.is_file() else None


__all__ = ["build", "load", "basket", "site_origin"]
