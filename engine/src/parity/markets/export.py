"""Static JSON for the product side's Markets pages.

    markets/crypto.json     the 100 largest coins, a year of prices for the majors, stats
    markets/perps.json      every Hyperliquid perp: funding as a cost of holding, open interest
    markets/etfs.json       US-listed ETFs by theme, newest series first
    markets/discover.json   new fund filings and trending coins, newest first
    markets/private.json    private markets: Form D counts, BDC NAVs, FRED proxies and the
                            unsmoothing study (private_export.py, DEC-0029)

Every file carries its sources, their terms and the attribution the page must show.
Nothing here is ranked by return or by popularity: lists are ordered by market value,
by date, or alphabetically, because the product must not hype (DEC-0015).
"""

from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pandas as pd

from ..data.store import DEFAULT_DIR
from . import heatmap, private_export, sources, stats, store, themes

SHOW_FILING_DAYS = 90
FILING_KIND = {
    "N-1A": "new-company",
    "485APOS": "new-series",
    "S-1": "trust",
}


def _iso(v) -> str | None:
    if v is None or (isinstance(v, float) and v != v):
        return None
    try:
        return pd.Timestamp(v).isoformat()
    except (ValueError, TypeError):
        return str(v)


def _clean(v):
    if isinstance(v, float) and v != v:
        return None
    if hasattr(v, "item"):
        v = v.item()
    return round(v, 8) if isinstance(v, float) else v


def _sanitize(v):
    """Missing values from pandas (NaN, NaT, numpy numbers) as plain JSON values."""
    if isinstance(v, dict):
        return {k: _sanitize(x) for k, x in v.items()}
    if isinstance(v, (list, tuple)):
        return [_sanitize(x) for x in v]
    if v is None or isinstance(v, (str, bool)):
        return v
    try:
        if pd.isna(v):
            return None
    except (TypeError, ValueError):
        return v
    return _clean(v)


def source_list(ids: list[str], root: Path) -> list[dict]:
    st = store.state(root)
    out = []
    for i in ids:
        s = sources.BY_ID[i]
        out.append({"id": s.id, "name": s.name, "provider": s.provider, "what": s.what,
                    "terms_url": s.terms_url, "licence": s.licence, "display": s.display,
                    "attribution": s.attribution, "attribution_url": s.attribution_url,
                    "fetched_at": st.get(i, {}).get("ok_at"),
                    "error": st.get(i, {}).get("error")})
    return out


def crypto_doc(root: Path) -> dict:
    mk = store.load("crypto_markets", root)
    daily = store.load("crypto_daily", root)
    coins = []
    for r in (mk.sort_values("rank").to_dict("records") if not mk.empty else []):
        c = {k: _clean(r.get(k)) for k in ("id", "symbol", "name", "rank", "price_usd",
                                             "market_cap_usd", "volume_24h_usd", "change_24h_pct",
                                             "change_7d_pct", "change_30d_pct", "change_1y_pct",
                                             "ath_usd", "ath_change_pct", "ath_date",
                                             "circulating_supply", "max_supply")}
        c["major"] = r["id"] in sources.MAJORS
        coins.append(c)
    history = {}
    if not daily.empty:
        for coin, g in daily.groupby("coin"):
            g = g.sort_values("date").set_index("date")
            s = g["price_usd"]
            s.index = s.index.astype(str)
            history[coin] = {"stats": stats.price_stats(s),
                             "prices": [[d, _clean(v)] for d, v in s.items()]}
            # Daily traded volume in USD, for the Trade charts' volume, VWAP and OBV.
            if "volume_usd" in g:
                vol = g["volume_usd"]
                vol.index = vol.index.astype(str)
                history[coin]["volumes"] = [[d, _clean(v)] for d, v in vol.items()]
    fetched = mk["fetched_at"].max() if not mk.empty else None
    return {"fetched_at": _iso(fetched), "coins": coins, "history": history,
            "sources": source_list(["coingecko-markets", "coingecko-history"], root)}


def perps_doc(root: Path) -> dict:
    snaps = store.load("perps_snapshots", root)
    fund = store.load("perps_funding", root)
    perps = []
    if not snaps.empty:
        last = snaps["fetched_at"].max()
        cur = snaps[(snaps["fetched_at"] == last) & ~snaps["delisted"].astype(bool)]
        cur = cur.sort_values("open_interest_usd", ascending=False)
        for r in cur.to_dict("records"):
            lev = r.get("max_leverage")
            row = {k: _clean(r.get(k)) for k in ("coin", "max_leverage", "funding_hourly",
                                                 "funding_annual_pct", "open_interest_coins",
                                                 "open_interest_usd", "mark_px", "oracle_px",
                                                 "premium", "day_volume_usd", "change_24h_pct")}
            row["liquidation_move_at_max_pct"] = stats.liquidation_move_pct(lev) if lev else None
            g = fund[fund["coin"] == r["coin"]] if not fund.empty else fund
            row["funding"] = stats.funding_stats(g) if not g.empty else None
            row["funding_daily"] = stats.daily_funding(g) if not g.empty else []
            perps.append(row)
    fetched = snaps["fetched_at"].max() if not snaps.empty else None
    return {"fetched_at": _iso(fetched), "venue": "Hyperliquid", "perps": perps,
            "hours_per_year": sources.HOURS_PER_YEAR,
            "sources": source_list(["hyperliquid-perps", "hyperliquid-funding"], root)}


def etfs_doc(root: Path) -> dict:
    df = store.load("etfs", root)
    rows: list[list] = []
    issuers: list[str] = []
    where: dict[str, int] = {}
    if not df.empty:
        df = df.sort_values(["series_number", "ticker"], ascending=[False, True],
                            na_position="last")
        for r in df.to_dict("records"):
            issuer = r.get("issuer") or ""
            if issuer not in where:
                where[issuer] = len(issuers)
                issuers.append(issuer)
            sn = _clean(r.get("series_number"))
            rows.append([r["ticker"], r["name"], where[issuer], list(r.get("themes") or []),
                         r.get("structure"), bool(r.get("new_this_year")),
                         int(sn) if sn is not None else None, r.get("first_seen")])
    counts = {t.id: sum(t.id in r[3] for r in rows) for t in themes.THEMES}
    th = [{"id": t.id, "label": t.label, "what": t.what, "check": t.check,
           "glossary": t.glossary, "count": counts[t.id]} for t in themes.THEMES]
    fetched = df["fetched_at"].max() if not df.empty else None
    return {"fetched_at": _iso(fetched), "count": len(rows), "themes": th,
            "columns": ETF_COLUMNS, "issuers": issuers, "etfs": rows,
            "sources": source_list(["sec-funds"], root)}


#: Each ETF is a short list in this order, to keep the file small (about 5,000 rows).
ETF_COLUMNS = ["ticker", "name", "issuer", "themes", "structure", "new_this_year",
               "series_number", "first_seen"]


def etf_records(doc: dict) -> list[dict]:
    """The compact rows as dictionaries, with the issuer name filled in."""
    out = []
    for row in doc["etfs"]:
        d = dict(zip(doc["columns"], row, strict=True))
        d["issuer"] = doc["issuers"][d["issuer"]]
        out.append(d)
    return out


def discover_doc(root: Path, etfs: dict | None = None) -> dict:
    filings = store.load("fund_filings", root)
    items = []
    if not filings.empty:
        f = sources.keep_fund_filings(filings, set())
        newest = pd.Timestamp(f["filed"].max()) if not f.empty else pd.Timestamp.now()
        cutoff = (newest - timedelta(days=SHOW_FILING_DAYS)).date().isoformat()
        f = f[f["filed"] >= cutoff].sort_values(["filed", "adsh"], ascending=False)
        for r in f.to_dict("records"):
            root_form = r.get("root_form") or r.get("form")
            items.append({"adsh": r["adsh"], "form": r.get("form"), "root_form": root_form,
                          "kind": FILING_KIND.get(root_form, "other"),
                          "what": sources.FTS_FORMS.get(root_form, ""),
                          "filed": r.get("filed"), "name": r.get("name"), "cik": r.get("cik"),
                          "tickers": list(r.get("tickers") or []),
                          "description": r.get("description"), "url": r.get("url"),
                          "themes": themes.classify(r.get("name"))})
    trend = store.load("crypto_trending", root)
    coins = [{k: _clean(v) for k, v in r.items() if k != "fetched_at"}
             for r in (trend.sort_values("position").to_dict("records")
                       if not trend.empty else [])]
    newest = [e for e in etf_records(etfs or etfs_doc(root)) if e.get("series_number")][:60]
    return {"filings": items, "trending_coins": coins,
            "trending_fetched_at": _iso(trend["fetched_at"].max()) if not trend.empty else None,
            "newest_series": newest, "filing_days": sources.FILINGS_DAYS,
            "sources": source_list(["sec-filings", "sec-funds", "coingecko-trending"], root)}


def heatmap_export(root: Path) -> dict:
    """S&P 500 and Nasdaq-100 members sized by SEC public float (DEC-0075)."""
    members = store.load("index_members", root)
    floats = store.load("public_float", root)
    tick = store.load("sec_tickers", root)
    cik = dict(zip(tick["ticker"], tick["cik"], strict=True)) if not tick.empty else {}
    doc = heatmap.heatmap_doc(members, floats, cik)
    doc["fetched_at"] = store.state(root).get("sec-public-float", {}).get("ok_at")
    doc["sources"] = source_list(["wiki-index-members", "sec-public-float"], root)
    return doc


def build(out: Path, root: Path = DEFAULT_DIR, include_ask: bool = True) -> dict:
    """Write the four files. include_ask=False leaves out sources whose display rights
    are still an open question (Hyperliquid), writing an empty perps file instead."""
    out = Path(out) / "markets"
    out.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(UTC).isoformat(timespec="seconds")
    etfs = etfs_doc(root)
    perps = perps_doc(root)
    if not include_ask:
        perps = {**perps, "perps": [], "withheld": True}
    docs = {"crypto": crypto_doc(root), "perps": perps, "etfs": etfs,
            "discover": discover_doc(root, etfs),
            "private": private_export.private_doc(root, source_list),
            "heatmap": heatmap_export(root)}
    for name, doc in docs.items():
        body = _sanitize({"generated_at": stamp, **doc})
        (out / f"{name}.json").write_text(json.dumps(body, separators=(",", ":"),
                                                     allow_nan=False))
    return {"coins": len(docs["crypto"]["coins"]), "perps": len(docs["perps"]["perps"]),
            "etfs": docs["etfs"]["count"], "filings": len(docs["discover"]["filings"]),
            "trending": len(docs["discover"]["trending_coins"]),
            "private_series": len(docs["private"]["series"]),
            "formd_quarters": len((docs["private"]["formd"] or {}).get("quarters", [])),
            "bdcs": len((docs["private"]["bdc"] or {}).get("funds", [])),
            "heatmap": sum(len(i["rows"]) for i in docs["heatmap"]["indexes"].values())}
