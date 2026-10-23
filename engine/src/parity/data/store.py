"""Local cache of raw series and the daily panel that strategies read.

Raw downloads are saved as parquet under data/raw/<source>/<code>.parquet so a
backtest never depends on the network once the cache is warm. The data folder is
ignored by git; the scheduled research run keeps its own copy in the Actions cache.
"""

from __future__ import annotations

import hashlib
import json
import os
from datetime import UTC, datetime
from pathlib import Path

import pandas as pd

from . import catalog, futures, sources

DEFAULT_DIR = Path(os.environ.get("PARITY_DATA_DIR", Path(__file__).resolve().parents[3] / "data"))


def _path(series: catalog.Series, root: Path) -> Path:
    return root / "raw" / series.source / f"{series.code}.parquet"


def refresh(keys: list[str] | None = None, root: Path = DEFAULT_DIR) -> list[dict]:
    """Download each series and overwrite its cache file. Returns a coverage report."""
    keys = keys or list(catalog.CATALOG)
    report = []
    # Derived series are built after the raw ones, and vrp.* after the fut.* it reads.
    derived = sorted((k for k in keys if catalog.get(k).source == "derived"),
                     key=lambda k: k.startswith("vrp."))
    for key in [k for k in keys if k not in derived] + derived:
        series = catalog.get(key)
        entry = {"key": key, "source": series.source, "code": series.code}
        entry["required"] = series.required
        entry["frequency"] = series.frequency
        try:
            data = build_derived(series, root) if series.source == "derived" else \
                sources.fetch(series)
            path = _path(series, root)
            path.parent.mkdir(parents=True, exist_ok=True)
            data.to_frame().to_parquet(path)
            entry.update(_describe(data), ok=True, sha256=content_hash(data))
        except sources.MissingKey as exc:  # a keyed source with no key: skipped, not broken
            entry.update(ok=False, skipped=True, error=str(exc))
        except Exception as exc:  # keep going; one dead source should not stop the run
            entry.update(ok=False, error=str(exc))
        report.append(entry)
    # Skipped series stay out of coverage.json, so the Data page and the snapshot only
    # describe what this machine could fetch. The caller still sees them.
    shown = report
    report = [r for r in report if not r.get("skipped")]
    root.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(UTC).isoformat(timespec="seconds")
    if len(report) < len(catalog.CATALOG):  # partial fetch: keep the other series' entries
        fresh = {r["key"] for r in report}
        report = report + [r for r in coverage(root).get("series", [])
                           if r["key"] not in fresh and r["key"] in catalog.CATALOG]
    doc = {"fetched_at": stamp, "snapshot": snapshot_id(report), "series": report}
    (root / "coverage.json").write_text(json.dumps(doc, indent=2))
    return shown


def build_derived(series: catalog.Series, root: Path) -> pd.Series:
    """Series computed from other cached series. fut.<X>, carry.<X> and vrp.OIL are
    described in data/futures.py; bond.TR* in bond_total_return; eq.US_TOTAL below."""
    group, name = series.key.split(".", 1)
    if group == "fut":
        start = futures.INDEX_START.get(name)
        c1, c2 = (load(f"curve.{name}{n}", root).loc[start:] for n in (1, 2))
        return futures.rolled_index(c1, c2, futures.EXPIRY_RULES[name]).rename(series.key)
    if group == "carry":
        start = futures.INDEX_START.get(name)
        return futures.curve_carry(load(f"curve.{name}2", root).loc[start:],
                                   load(f"curve.{name}3", root).loc[start:]).rename(series.key)
    if series.key == "vrp.OIL":
        return futures.variance_swap_index(load("risk.OVX", root),
                                           load("fut.CL", root)).rename(series.key)
    if series.key.startswith("xfx."):  # USD per unit, crossed through the euro
        usd = load("ecb.USD", root)
        if series.code == "ecb.USD":
            return usd.rename(series.key)
        other = load(series.code.split("/", 1)[1], root)
        return (usd / other).dropna().rename(series.key)
    if series.key in catalog.BOND_DURATION:
        return bond_total_return(load(series.code, root), catalog.BOND_DURATION[series.key]) \
            .rename(series.key)
    if series.key != "eq.US_TOTAL":
        raise KeyError(f"No recipe for derived series {series.key}")
    return _us_total(series, root)


def _us_total(series: catalog.Series, root: Path) -> pd.Series:
    """eq.US_TOTAL: the Fama and French total return index, then S&P 500 price returns
    plus a daily dividend accrual for the days French has not published yet. The
    dividend accrual is the gap between the two over the last year they overlap."""
    mkt = load("eq.US_MKT", root)
    spx = load("eq.SPX", root).dropna()
    last = mkt.index.max()
    year = spx.loc[last - pd.DateOffset(years=1):last]
    if len(year) > 200:
        mkt_year = mkt.loc[year.index[0]:last]
        gap = (mkt_year.iloc[-1] / mkt_year.iloc[0]) / (year.iloc[-1] / year.iloc[0]) - 1
    else:
        gap = 0.015  # typical S&P 500 dividend yield, used only if the overlap is too short
    daily_div = max(gap, 0.0) / 252
    after = spx.loc[spx.index[spx.index <= last].max():]
    ext = (1 + after.pct_change().dropna() + daily_div).cumprod() * mkt.iloc[-1]
    return pd.concat([mkt, ext]).rename(series.key)


def bond_total_return(yield_pct: pd.Series, duration: float) -> pd.Series:
    """Index from a daily constant-maturity yield: carry plus price change from the move."""
    y = yield_pct.dropna() / 100
    days = y.index.to_series().diff().dt.days.fillna(1)
    ret = y.shift(1) * days / 365 - duration * y.diff()
    return (1 + ret.fillna(0.0)).cumprod()


def content_hash(data: pd.Series) -> str:
    """Fingerprint of a series' values, independent of file format, so the same
    numbers always give the same hash."""
    text = "\n".join(f"{d.date().isoformat()},{v:.10g}" for d, v in data.items())
    return hashlib.sha256(text.encode()).hexdigest()


def snapshot_id(report: list[dict]) -> str:
    """One fingerprint for the whole data set: changes if any series changes."""
    parts = sorted(f"{r['key']}:{r.get('sha256', 'missing')}" for r in report)
    return hashlib.sha256("\n".join(parts).encode()).hexdigest()


def _describe(data: pd.Series) -> dict:
    return {
        "first": data.index.min().date().isoformat(),
        "last": data.index.max().date().isoformat(),
        "rows": int(data.size),
    }


def load(key: str, root: Path = DEFAULT_DIR) -> pd.Series:
    series = catalog.get(key)
    path = _path(series, root)
    if not path.exists():
        raise FileNotFoundError(f"No cached data for {key}. Run `parity fetch` first.")
    return pd.read_parquet(path).iloc[:, 0].rename(key)


def panel(keys: list[str], root: Path = DEFAULT_DIR, ffill_limit: int = 5) -> pd.DataFrame:
    """Align series on business days.

    Daily series are forward filled for a few days to cover holidays. Monthly series
    (rates, copper) are forward filled without limit because they only change once
    a month; their staleness shows up on the Data page instead.
    """
    frames = {k: load(k, root) for k in keys}
    start = min(s.index.min() for s in frames.values())
    end = max(s.index.max() for s in frames.values())
    index = pd.bdate_range(start, end)
    out = {}
    for key, s in frames.items():
        s = s[~s.index.duplicated(keep="last")].sort_index()
        spec = catalog.get(key)
        lag = spec.published_after
        if lag is not None:
            s.index = s.index + pd.offsets.MonthEnd(0) + pd.offsets.BDay(lag)
            s = s[~s.index.duplicated(keep="last")]
        if spec.lag_days:  # known only some business days after its date (COT, EIA)
            s.index = s.index + pd.offsets.BDay(spec.lag_days)
            s = s[~s.index.duplicated(keep="last")]
        aligned = s.reindex(index.union(s.index)).sort_index()
        # Monthly series fill without limit; weekly ones fill up to two weeks, so one
        # late release does not leave a hole.
        limit = {"M": None, "W": 2 * ffill_limit}.get(spec.frequency, ffill_limit)
        out[key] = aligned.ffill(limit=limit).reindex(index)
    return pd.DataFrame(out, index=index)


def coverage(root: Path = DEFAULT_DIR) -> dict:
    path = root / "coverage.json"
    return json.loads(path.read_text()) if path.exists() else {"fetched_at": None, "series": []}
