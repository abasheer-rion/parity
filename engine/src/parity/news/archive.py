"""The news archive: every headline we have ever ingested, kept forever, one file a year.

    <data dir>/news/archive/2019.parquet
    <data dir>/news/archive/2020.parquet ...

Each row is an Article (schema.py) plus two lists worked out when it is added:
`topics` (tagging.TOPICS, what it is about in market terms) and `assets` (the catalog
series it is about, from its tags). The hourly fetch adds to it through store.merge, and
`parity news backfill` fills older years from sources whose terms allow it.

Search reads only the years it needs, so a query for 2015 to 2016 opens two files.
"""

from __future__ import annotations

import re
from pathlib import Path

import pandas as pd

from ..data.store import DEFAULT_DIR
from . import tagging
from .schema import COLUMNS, Article, to_frame

ARCHIVE_COLUMNS = COLUMNS + ["topics", "assets"]
LISTS = ("currencies", "commodities", "regions", "tickers", "topics", "assets")

# Which catalog series an item is about, from its tags. US stocks and the VIX are the
# market as a whole, so every item counts for them.
CURRENCY_ASSETS = {"USD": ["usd.BASKET", "usd.BROAD"]}
COMMODITY_ASSETS = {"oil": ["cmd.WTI", "cmd.BRENT"], "gas": ["cmd.HH_GAS"],
                    "gold": ["cot.GOLD_PCT"], "copper": ["cmd.COPPER"]}
CATEGORY_ASSETS = {"central-bank": ["bond.UST10Y", "curve.UST_2Y", "rate.TBILL3M"],
                   "macro-data": ["bond.UST10Y", "curve.UST_2Y"],
                   "energy": ["cmd.WTI", "cmd.BRENT"],
                   "geopolitics": ["cmd.BRENT"]}
TOPIC_ASSETS = {"opec": ["cmd.WTI", "cmd.BRENT"], "oil-supply": ["cmd.WTI", "cmd.BRENT"],
                "war": ["cmd.BRENT"], "rate-hike": ["bond.UST10Y", "curve.UST_2Y"],
                "rate-cut": ["bond.UST10Y", "curve.UST_2Y"], "inflation": ["bond.UST10Y"],
                "bank-failure": ["ind.Money"], "pandemic": ["cmd.BRENT"]}
MARKET = ["eq.US_TOTAL", "risk.VIX"]


def assets_for(currencies, commodities, category, topics) -> list[str]:
    out: list[str] = []
    for c in currencies or []:
        out += CURRENCY_ASSETS.get(c, [f"fx.{c}", f"ecb.{c}"] if c != "EUR" else ["fx.EUR"])
    for c in commodities or []:
        out += COMMODITY_ASSETS.get(c, [])
    out += CATEGORY_ASSETS.get(category, [])
    for t in topics or []:
        out += TOPIC_ASSETS.get(t, [])
    return list(dict.fromkeys(out + MARKET))


def enrich(df: pd.DataFrame) -> pd.DataFrame:
    """Add `topics` and `assets` to rows that lack them."""
    df = df.copy()
    for col in ("currencies", "commodities", "regions", "tickers"):
        df[col] = df[col].apply(_as_list)
    text = df["title"].fillna("") + ". " + df["summary"].fillna("")
    if "topics" not in df or df["topics"].isna().any():
        df["topics"] = [tagging.topics(t) for t in text]
    else:
        df["topics"] = df["topics"].apply(_as_list)
    df["assets"] = [assets_for(r.currencies, r.commodities, r.category, r.topics)
                    for r in df.itertuples()]
    return df


def archive_dir(root: Path = DEFAULT_DIR) -> Path:
    return root / "news" / "archive"


def shard_path(year: int, root: Path = DEFAULT_DIR) -> Path:
    return archive_dir(root) / f"{year}.parquet"


def years(root: Path = DEFAULT_DIR) -> list[int]:
    d = archive_dir(root)
    return sorted(int(p.stem) for p in d.glob("*.parquet") if p.stem.isdigit()) \
        if d.exists() else []


def _as_list(v) -> list:
    if v is None or (isinstance(v, float) and pd.isna(v)):
        return []
    return [str(x) for x in v]


def _read(path: Path) -> pd.DataFrame:
    df = pd.read_parquet(path)
    for col in LISTS:
        if col in df:
            df[col] = df[col].apply(_as_list)
    return df


def add(items: list[Article] | pd.DataFrame, root: Path = DEFAULT_DIR) -> int:
    """Add items to their year's shard. The first copy of an id wins. Returns how many
    were new."""
    new = to_frame(items) if isinstance(items, list) else items.copy()
    if new.empty:
        return 0
    new["published_at"] = pd.to_datetime(new["published_at"], utc=True)
    new = enrich(new)[ARCHIVE_COLUMNS]
    added = 0
    for year, part in new.groupby(new["published_at"].dt.year):
        path = shard_path(int(year), root)
        old = _read(path) if path.exists() else pd.DataFrame(columns=ARCHIVE_COLUMNS)
        fresh = part[~part["id"].isin(old["id"])].drop_duplicates("id")
        if fresh.empty:
            continue
        added += len(fresh)
        both = fresh if old.empty else pd.concat([old, fresh], ignore_index=True)
        both = both.sort_values("published_at", ascending=False).reset_index(drop=True)
        path.parent.mkdir(parents=True, exist_ok=True)
        both.to_parquet(path, index=False)
    return added


def load(start=None, end=None, root: Path = DEFAULT_DIR) -> pd.DataFrame:
    """Every archived item published between start and end (inclusive), newest first."""
    lo, hi = _bounds(start, end)
    want = [y for y in years(root) if (lo is None or y >= lo.year) and (hi is None or y <= hi.year)]
    frames = [_read(shard_path(y, root)) for y in want]
    frames = [f for f in frames if not f.empty]
    if not frames:
        return pd.DataFrame(columns=ARCHIVE_COLUMNS)
    df = pd.concat(frames, ignore_index=True)
    df["published_at"] = pd.to_datetime(df["published_at"], utc=True)
    if lo is not None:
        df = df[df["published_at"] >= lo]
    if hi is not None:
        df = df[df["published_at"] < hi]
    return df.sort_values("published_at", ascending=False).reset_index(drop=True)


def _bounds(start, end) -> tuple[pd.Timestamp | None, pd.Timestamp | None]:
    """`2010` means 1 January 2010; an end of `2024` means up to the end of 2024."""
    def ts(v, is_end):
        if v in (None, ""):
            return None
        s = str(v)
        t = pd.Timestamp(s)
        t = t.tz_localize("UTC") if t.tzinfo is None else t.tz_convert("UTC")
        if is_end:  # exclusive upper bound just past the named period
            t = t + (pd.DateOffset(years=1) if len(s) == 4 else
                     pd.DateOffset(months=1) if len(s) == 7 else pd.Timedelta(days=1))
        return t
    return ts(start, False), ts(end, True)


def topic_ids(query: str) -> list[str]:
    """Topic ids a query names, by id or by label, case blind."""
    q = (query or "").strip().lower()
    return [k for k, v in tagging.TOPICS.items() if q in (k, v[0].lower())]


def matches(df: pd.DataFrame, query: str | None) -> pd.Series:
    """Rows a topic or keyword query matches.

    A topic name ("OPEC", "rate hike", "war") matches the topic tag. Anything else is
    keywords: every word must appear, and "quoted phrases" must appear as written.
    """
    if not query or df.empty:
        return pd.Series(True, index=df.index)
    ids = topic_ids(query)
    if ids:
        return df["topics"].apply(lambda ts: any(t in ts for t in ids))
    text = (df["title"].fillna("") + " " + df["summary"].fillna("")).str.lower()
    terms = re.findall(r'"([^"]+)"|(\S+)', query.lower())
    ok = pd.Series(True, index=df.index)
    for phrase, word in terms:
        term = phrase or word
        ok &= text.str.contains(r"\b" + re.escape(term), regex=True)
    return ok


def search(text: str | None = None, start=None, end=None, asset: str | None = None,
           topic: str | None = None, source: str | list[str] | None = None,
           limit: int | None = 100, root: Path = DEFAULT_DIR) -> pd.DataFrame:
    """Archive search: words, a date range, an asset, a topic and sources, all optional."""
    df = load(start, end, root)
    if df.empty:
        return df
    keep = matches(df, text)
    if topic:
        keep &= matches(df, topic)
    if asset:
        keep &= df["assets"].apply(lambda a: asset in a)
    if source:
        keep &= df["source"].isin([source] if isinstance(source, str) else source)
    out = df[keep]
    return out.head(limit) if limit else out
