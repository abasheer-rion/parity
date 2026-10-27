"""Markets data on disk, under <data dir>/markets/, ignored by git like the price cache.

Each table keeps the dates it was fetched or observed. How a new fetch is merged depends
on what the source's terms allow:

    replace   CoinGecko tables. Its terms discourage storing data, so each fetch
              overwrites the last and nothing older than the latest fetch is kept.
    append    Hyperliquid snapshots and funding, SEC filings: new rows are added, the
              same row is never stored twice, and rows older than a year are dropped.
    etfs      replaced, except each ticker keeps the first date we saw it listed.
    quarters  Form D counts: a fetched quarter replaces that quarter's rows; others stay.

state.json records when each source was last fetched, so `parity markets fetch` can skip
sources that are still fresh.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pandas as pd

from ..data.store import DEFAULT_DIR

POLICY: dict[str, tuple[str, list[str], int | None]] = {
    # table: (policy, unique key, days kept)
    "crypto_markets": ("replace", [], None),
    "crypto_daily": ("replace", [], None),
    "crypto_trending": ("replace", [], None),
    "perps_snapshots": ("append", ["fetched_at", "coin"], 90),
    "perps_funding": ("append", ["coin", "time"], 365),
    "etfs": ("etfs", ["ticker"], None),
    "fund_filings": ("append", ["adsh"], 365),
    # Private markets (DEC-0029). Form D counts replace whole quarters; BDC NAVs replace all.
    "formd": ("quarters", ["quarter"], None),
    "bdc_nav": ("replace", [], None),
    "index_members": ("replace", [], None),
    "public_float": ("replace", [], None),
    "sec_tickers": ("replace", [], None),
}
TIME_COL = {"perps_snapshots": "fetched_at", "perps_funding": "time", "fund_filings": "fetched_at"}
LIST_COLS = ("tickers", "themes")


def markets_dir(root: Path = DEFAULT_DIR) -> Path:
    return root / "markets"


def path(table: str, root: Path = DEFAULT_DIR) -> Path:
    return markets_dir(root) / f"{table}.parquet"


def load(table: str, root: Path = DEFAULT_DIR) -> pd.DataFrame:
    p = path(table, root)
    if not p.exists():
        return pd.DataFrame()
    df = pd.read_parquet(p)
    for col in LIST_COLS:
        if col in df:
            df[col] = df[col].apply(lambda v: list(v) if v is not None else [])
    return df


def merge(table: str, new: pd.DataFrame, root: Path = DEFAULT_DIR,
          today: datetime | None = None) -> pd.DataFrame:
    """Merge a fresh fetch into the stored table and save it. Returns the stored table."""
    policy, key, days = POLICY[table]
    today = today or datetime.now(UTC)
    old = load(table, root)
    if policy == "replace" or old.empty:
        out = new.copy()
        if policy == "etfs":
            out["first_seen"] = today.date().isoformat()
    elif policy == "quarters":
        out = pd.concat([old[~old["quarter"].isin(set(new["quarter"]))], new],
                        ignore_index=True).sort_values(["quarter"], kind="stable")
    elif policy == "etfs":
        out = new.copy()
        seen = old.set_index("ticker")["first_seen"].to_dict() if "first_seen" in old else {}
        out["first_seen"] = [seen.get(t, today.date().isoformat()) for t in out["ticker"]]
    else:
        out = pd.concat([old, new], ignore_index=True)
        out = out.drop_duplicates(key, keep="last")
    if days and table in TIME_COL and not out.empty:
        stamps = pd.to_datetime(out[TIME_COL[table]], utc=True)
        out = out[stamps >= pd.Timestamp(today) - timedelta(days=days)]
    out = out.reset_index(drop=True)
    p = path(table, root)
    p.parent.mkdir(parents=True, exist_ok=True)
    out.to_parquet(p, index=False)
    return out


def state_path(root: Path = DEFAULT_DIR) -> Path:
    return markets_dir(root) / "state.json"


def state(root: Path = DEFAULT_DIR) -> dict:
    p = state_path(root)
    return json.loads(p.read_text()) if p.exists() else {}


def record(source_id: str, entry: dict, root: Path = DEFAULT_DIR) -> None:
    doc = state(root)
    doc[source_id] = {**doc.get(source_id, {}), **entry}
    state_path(root).parent.mkdir(parents=True, exist_ok=True)
    state_path(root).write_text(json.dumps(doc, indent=2))


def is_fresh(source_id: str, max_age_hours: float, root: Path = DEFAULT_DIR,
             now: datetime | None = None) -> bool:
    last = state(root).get(source_id, {}).get("ok_at")
    if not last:
        return False
    age = (now or datetime.now(UTC)) - datetime.fromisoformat(last)
    return age < timedelta(hours=max_age_hours)
