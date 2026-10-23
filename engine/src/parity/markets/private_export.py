"""markets/private.json: the data behind the Private markets pages (DEC-0029).

The product page (/app/#/markets/private) and the research page (/research/#/private)
both read this one file:

    formd         new Form D notices per quarter, by kind of issuer, size and exemption
    bdc           NAV per share of large BDCs, with how far and how often it fell
    series        FRED proxies the site may show: property prices, bank lending, standards
    unsmoothing   how much calmer smoothing makes three property indexes look (unsmooth.py)

Nothing is ranked by return. Series whose terms keep them off the site (the Fed's CoStar
based commercial property index) appear only as summary numbers, never as a chart.
"""

from __future__ import annotations

import math
from pathlib import Path

import pandas as pd

from .. import terminal, unsmooth
from ..data import catalog
from ..data import store as data_store
from . import private, store

PM_KEYS = [k for k in catalog.CATALOG if k.startswith("pm.")]
MARKET_KEY = "eq.US_MKT"
#: A NAV per share moving more than this in one quarter is treated as a split or merger.
SPLIT_JUMP = 0.4
#: Volatility and autocorrelation need at least this many true quarterly changes.
MIN_CHANGES = 8

#: (id, label, catalog key, study options, plain note)
STUDIES = [
    ("cre-appraisal", "US commercial property, appraisal era (1960 to 1995)", "pm.CRE_PRICE",
     {"start": "1960-01-01", "end": "1995-12-31"},
     "Before 1996 the Fed's index averages appraisal-based price series. Appraisers start "
     "from last year's value, so the index trails real prices."),
    ("cre-sales", "US commercial property, repeat-sale era (1996 on)", "pm.CRE_PRICE",
     {"start": "1996-01-01"},
     "From 1996 the Fed chains the index to a repeat-sale index built from real deals. "
     "Deals still take months to close and are averaged over a quarter, so some smoothing "
     "remains."),
    ("houses", "US house prices, all transactions (FHFA)", "pm.HOUSE_FHFA",
     {"seasonal": True},
     "FHFA's all-transactions index mixes sale prices with appraisals made for refinancing. "
     "It is not seasonally adjusted, so the spring pattern is removed first."),
]

FRED_SOURCE = {
    "id": "fred-private", "name": "FRED property and lending series",
    "provider": "Federal Reserve Bank of St. Louis (FRED)",
    "what": "Commercial property prices (Federal Reserve and BIS), house prices (FHFA), bank "
            "loans to property, businesses and nonbank lenders, loan officer surveys and "
            "property loan delinquencies",
    "terms_url": "https://fred.stlouisfed.org/legal/",
    "licence": "Public domain US government data or reuse with the source named; the Fed's "
               "commercial property index is built from CoStar data, so it is shown only as "
               "summary numbers",
    "display": "yes", "attribution": "Source: FRED, Federal Reserve Bank of St. Louis",
    "attribution_url": "https://fred.stlouisfed.org/",
}


def _num(v, digits: int = 6):
    if v is None:
        return None
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return None if math.isnan(f) or math.isinf(f) else round(f, digits)


# ---------------------------------------------------------------- Form D


def formd_doc(root: Path) -> dict | None:
    df = store.load("formd", root)
    if df.empty:
        return None
    quarters = sorted(df["quarter"].unique())
    by_quarter = []
    for q in quarters:
        g = df[df["quarter"] == q]
        by_quarter.append({
            "quarter": q,
            "filings": int(g["filings"].sum()),
            "amount_sold_usd": _num(g["amount_sold_usd"].sum(), 0),
            "nonaccredited": int(g["nonaccredited"].sum()),
            "indefinite": int(g["indefinite"].sum()),
            "by_kind": {k: int(v) for k, v in g.groupby("kind")["filings"].sum().items()},
            "amount_by_kind": {k: _num(v, 0) for k, v in
                               g.groupby("kind")["amount_sold_usd"].sum().items()},
            "by_size": {k: int(v) for k, v in g.groupby("size")["filings"].sum().items()},
            "by_exemption": {k: int(v) for k, v in
                             g.groupby("exemption")["filings"].sum().items()},
        })
    last = df[df["quarter"] == quarters[-1]]
    groups = []
    for (kind, group), g in last.groupby(["kind", "group"]):
        groups.append({"kind": kind, "group": group, "filings": int(g["filings"].sum()),
                       "amount_sold_usd": _num(g["amount_sold_usd"].sum(), 0),
                       "by_size": {k: int(v) for k, v in
                                   g.groupby("size")["filings"].sum().items()}})
    groups.sort(key=lambda r: (-r["filings"], r["group"]))
    return {
        "quarters": quarters, "kinds": private.KINDS,
        "sizes": [{"id": s, "label": label} for s, label, _, _ in private.SIZES],
        "exemptions": [{"id": k, "label": v} for k, v in private.EXEMPTIONS.items()],
        "by_quarter": by_quarter, "latest": {"quarter": quarters[-1], "groups": groups},
    }


# ---------------------------------------------------------------- BDCs


def nav_stats(nav: pd.Series) -> dict:
    """How a NAV per share moved: last value, change over a year, worst quarter, deepest
    fall from a peak and quarterly volatility. NAV per share ignores dividends, which for
    a BDC are most of the return, so these describe the marks, not what holders earned."""
    nav = nav.dropna().sort_index()
    q = nav.resample("QE").last().dropna()
    # Older filings often give NAV only at year end. A "quarterly" change is counted only
    # between two quarter ends one quarter apart, so yearly gaps never pose as quarters.
    gap = q.index.to_series().diff().dt.days
    r = q.pct_change()[(gap > 80) & (gap < 100)].dropna()
    # A move this large in one quarter is a share split or merger, not a mark.
    jumps = r[r.abs() > SPLIT_JUMP]
    r = r.drop(jumps.index)
    year_ago = q[q.index <= q.index[-1] - pd.DateOffset(months=12)]
    since = q[q.index >= jumps.index.max()] if len(jumps) else q
    peak = since.cummax()
    worst = r.idxmin() if len(r) else None
    return {
        "last": _num(q.iloc[-1], 4), "last_date": q.index[-1].date().isoformat(),
        "first_date": q.index[0].date().isoformat(), "point_count": int(len(q)),
        "quarterly_changes": int(len(r)),
        "change_1y_pct": _num((q.iloc[-1] / year_ago.iloc[-1] - 1) * 100, 2)
        if len(year_ago) and not len(jumps[jumps.index > year_ago.index[-1]]) else None,
        "worst_quarter_pct": _num(r.min() * 100, 2) if len(r) else None,
        "worst_quarter_date": worst.date().isoformat() if worst is not None else None,
        "max_drawdown_pct": _num((since / peak - 1).min() * 100, 2),
        "quarter_vol_pct": _num(r.std(ddof=1) * 200, 2) if len(r) >= MIN_CHANGES else None,
        "ac1": _num(unsmooth.ac(r, 1), 3) if len(r) >= MIN_CHANGES else None,
        "split_like_jumps": [d.date().isoformat() for d in jumps.index],
    }


def bdc_doc(root: Path) -> dict | None:
    df = store.load("bdc_nav", root)
    if not df.empty:
        df = df[df["cik"].isin({c for c, *_ in private.BDCS})]  # funds since dropped
    if df.empty:
        return None
    funds = []
    for cik, g in df.groupby("cik"):
        nav = pd.Series(g["nav"].astype(float).to_numpy(), index=pd.to_datetime(g["end"]))
        nav = nav[~nav.index.duplicated(keep="last")].sort_index()
        first = g.iloc[0]
        funds.append({"cik": cik, "name": first["name"], "ticker": first["ticker"] or None,
                      "listed": bool(first["listed"]),
                      "points": [[d.date().isoformat(), _num(v, 4)] for d, v in nav.items()],
                      **nav_stats(nav)})
    funds.sort(key=lambda f: (not f["listed"], f["name"]))
    return {"funds": funds, "fetched_at": df["fetched_at"].max()}


# ---------------------------------------------------------------- FRED series


def series_doc(root: Path) -> list[dict]:
    out = []
    for key in PM_KEYS:
        spec = catalog.get(key)
        ok, _ = terminal.allowed(spec)
        if not ok:
            continue
        try:
            s = data_store.load(key, root).dropna()
        except FileNotFoundError:
            continue
        label, short, unit, _, _ = terminal._describe(spec)
        source, licence, _ = terminal.TERMS[terminal.terms_for(spec)]
        out.append({"key": key, "label": label, "short": short, "unit": unit,
                    "freq": spec.frequency, "description": spec.description,
                    "source": source, "licence": licence,
                    "points": [[d.date().isoformat(), _num(v, 4)] for d, v in s.items()]})
    return out


# ---------------------------------------------------------------- unsmoothing


def _stats_pct(d: dict) -> dict:
    """Fractions to percent for the page, keeping other fields."""
    pct = {"vol", "max_drawdown", "worst_quarter", "growth", "vol_implied"}
    return {k: (_num(v * 100, 3) if k in pct and v is not None else v) for k, v in d.items()}


def unsmoothing_doc(root: Path) -> list[dict]:
    try:
        market = data_store.load(MARKET_KEY, root)
    except FileNotFoundError:
        market = None
    out = []
    for sid, label, key, opts, note in STUDIES:
        try:
            level = data_store.load(key, root)
        except FileNotFoundError:
            continue
        res = unsmooth.study(level, market, **opts)
        series = res.pop("series")
        site, _ = terminal.allowed(catalog.get(key))
        row = {"id": sid, "label": label, "key": key, "note": note, "site": site,
               **{k: (_stats_pct(v) if k in ("raw", "geltner", "glm", "stocks") else v)
                  for k, v in res.items()}}
        if site:
            raw_i = unsmooth.index_from(series["raw"])
            gel_i = unsmooth.index_from(series["geltner"]).reindex(raw_i.index)
            row["chart"] = [[d.date().isoformat(), _num(a, 3), _num(b, 3)]
                            for d, a, b in zip(raw_i.index, raw_i, gel_i, strict=True)]
        out.append(row)
    return out


def coverage_time(root: Path) -> str | None:
    return data_store.coverage(root).get("fetched_at")


def private_doc(root: Path, source_list) -> dict:
    fred = {**FRED_SOURCE, "fetched_at": coverage_time(root), "error": None}
    return {
        "sources": source_list(["sec-formd", "sec-bdc"], root) + [fred],
        "formd": formd_doc(root), "bdc": bdc_doc(root), "series": series_doc(root),
        "unsmoothing": unsmoothing_doc(root),
    }
