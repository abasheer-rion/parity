"""News on disk: one parquet file of articles, one of market impacts.

Lives under <data dir>/news/, next to the price cache and, like it, ignored by git.
New fetches are merged in by article id, so running fetch twice never duplicates.
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd

from ..data.store import DEFAULT_DIR
from .schema import COLUMNS, Article, to_frame


def news_dir(root: Path = DEFAULT_DIR) -> Path:
    return root / "news"


def articles_path(root: Path = DEFAULT_DIR) -> Path:
    return news_dir(root) / "articles.parquet"


def impacts_path(root: Path = DEFAULT_DIR) -> Path:
    return news_dir(root) / "impacts.parquet"


def load(root: Path = DEFAULT_DIR) -> pd.DataFrame:
    path = articles_path(root)
    if not path.exists():
        return pd.DataFrame(columns=COLUMNS)
    df = pd.read_parquet(path)
    for col in ("currencies", "commodities", "regions", "tickers"):
        df[col] = df[col].apply(lambda v: list(v) if v is not None else [])
    return df


def merge(articles: list[Article], root: Path = DEFAULT_DIR) -> tuple[pd.DataFrame, int]:
    """Add articles to the store. Returns the whole table and how many were new."""
    old = load(root)
    new = to_frame(articles)
    if new.empty:
        return old, 0
    added = int((~new["id"].isin(old["id"])).sum())
    both = new if old.empty else pd.concat([old, new], ignore_index=True)
    both = both.drop_duplicates("id", keep="first")  # the first time we saw it wins
    both = both.sort_values("published_at", ascending=False).reset_index(drop=True)
    save(both, root)
    return both, added


def save(df: pd.DataFrame, root: Path = DEFAULT_DIR) -> Path:
    path = articles_path(root)
    path.parent.mkdir(parents=True, exist_ok=True)
    df.to_parquet(path, index=False)
    return path
