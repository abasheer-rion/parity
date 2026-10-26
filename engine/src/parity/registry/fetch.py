"""History for registry series (DEC-0064): one fetcher per source, each returning a pandas
Series indexed by date, and a cache file in the same place the store uses, so `store.load`
and the panel read it like a catalog series.

Curated catalog series keep their own fetch path (`parity fetch`, the search's daily
refresh). These fetchers serve series discovery found. Each fetch is logged with its time
and outcome; the health check reads that log for error rates.
"""

from __future__ import annotations

import io
import sqlite3
import time

import pandas as pd

from ..data import catalog, sources, store
from . import db, net

ECB_API = sources.ECB_API
BIS_API = sources.BIS_API
KRAKEN_OHLC = "https://api.kraken.com/0/public/OHLC"


class NoFetcher(Exception):
    """A source with no history fetcher here."""


def as_series(rec: dict) -> catalog.Series:
    return catalog.Series(rec["id"], rec["source_id"], rec["code"], rec["name"],
                          frequency=rec["frequency"], required=False,
                          published_after=rec.get("published_after"),
                          lag_days=int(rec.get("lag_days") or 0), site=False)


def _sdmx(rec: dict) -> pd.Series:
    flow, key = rec["code"].split("/", 1)
    if rec["source_id"] == "ecb":
        text = net.get(f"{ECB_API}/{flow}/{key}", {"format": "csvdata",
                                                   "detail": "dataonly"}).text
    else:
        text = net.get(f"{BIS_API}/{flow}/1.0/{key}", {"format": "csv",
                                                       "detail": "dataonly"}).text
    table = sources.split_sdmx_csv(text)
    if key not in table or table[key].empty:
        raise KeyError(f"{rec['code']} has no values in the response")
    return table[key].rename(rec["id"])


def _kraken(rec: dict) -> pd.Series:
    """Kraken's daily candles: the last 720 days, close prices, dated the candle's day."""
    payload = net.get(KRAKEN_OHLC, {"pair": rec["code"], "interval": 1440}, pause=1.0).json()
    if payload.get("error"):
        raise KeyError(f"Kraken: {', '.join(payload['error'])[:120]}")
    rows = next(v for k, v in payload["result"].items() if k != "last")
    idx = pd.to_datetime([int(r[0]) for r in rows], unit="s").normalize()
    out = pd.Series([float(r[4]) for r in rows], index=idx, name=rec["id"])
    # The newest candle is still forming; it is not a close yet.
    return out.iloc[:-1] if len(out) > 1 else out


def _fred(rec: dict) -> pd.Series:
    return sources.fetch_fred(as_series(rec))


def _treasury(rec: dict) -> pd.Series:
    return sources.curve_column(sources.treasury_curve(), as_series(rec))


def _cftc(rec: dict) -> pd.Series:
    return sources.fetch_cftc(as_series(rec))


FETCHERS = {"fred": _fred, "ecb": _sdmx, "bis": _sdmx, "treasury": _treasury, "cftc": _cftc,
            "kraken": _kraken}


def has_fetcher(rec: dict) -> bool:
    return rec["source_id"] in FETCHERS and bool(rec.get("code"))


def history(con: sqlite3.Connection, rec: dict, save: bool = True,
            root=None) -> pd.Series:
    """Fetch a series' full history, log the attempt, and save it where the store reads."""
    if not has_fetcher(rec):
        raise NoFetcher(f"no history fetcher for source {rec['source_id']}")
    t0 = time.time()
    try:
        data = FETCHERS[rec["source_id"]](rec)
        data = data[~data.index.duplicated(keep="last")].sort_index().astype(float).dropna()
        log(con, rec["source_id"], rec["id"], True, time.time() - t0)
    except Exception as exc:
        log(con, rec["source_id"], rec["id"], False, time.time() - t0,
            f"{type(exc).__name__}: {exc}"[:200])
        raise
    if save:
        path = store._path(as_series(rec), root or store.DEFAULT_DIR)
        path.parent.mkdir(parents=True, exist_ok=True)
        data.to_frame().to_parquet(path)
    return data


def cached(rec: dict, root=None) -> pd.Series | None:
    """The saved history, or None."""
    path = store._path(as_series(rec), root or store.DEFAULT_DIR)
    if not path.exists():
        return None
    return pd.read_parquet(path).iloc[:, 0].rename(rec["id"])


def log(con: sqlite3.Connection, source_id: str, series_id: str | None, ok: bool,
        seconds: float, error: str | None = None) -> None:
    con.execute("INSERT INTO fetch_log (at, source_id, series_id, ok, seconds, error) VALUES "
                "(?, ?, ?, ?, ?, ?)", (db.now(), source_id, series_id, int(ok),
                                       round(seconds, 2), error))
    con.execute("DELETE FROM fetch_log WHERE at < datetime('now', '-30 days')")


def csv_text(df: pd.DataFrame) -> str:
    buf = io.StringIO()
    df.to_csv(buf)
    return buf.getvalue()
