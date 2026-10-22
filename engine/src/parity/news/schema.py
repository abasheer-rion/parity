"""The one shape every news item takes once it is fetched.

Whatever the source (a central bank RSS feed, GDELT, a keyed API), an item becomes an
Article with the same fields. Sources that do not license their full text only ever
give us a headline, a link and, when their terms allow it, a short summary.
"""

from __future__ import annotations

import hashlib
import html
import re
from dataclasses import asdict, dataclass, field
from datetime import UTC, datetime

import pandas as pd

SUMMARY_MAX = 280  # characters; a teaser, never the article

COLUMNS = ["id", "source", "publisher", "published_at", "title", "url", "summary", "currencies",
           "commodities", "regions", "category", "tickers", "fetched_at"]


@dataclass
class Article:
    source: str
    published_at: datetime  # always UTC
    title: str
    url: str
    summary: str = ""
    currencies: list[str] = field(default_factory=list)
    commodities: list[str] = field(default_factory=list)
    regions: list[str] = field(default_factory=list)
    category: str = "markets"
    tickers: list[str] = field(default_factory=list)
    publisher: str = ""  # who wrote it, when that differs from the source (GDELT, APIs)
    fetched_at: datetime | None = None
    id: str = ""

    def __post_init__(self):
        self.title = clean_text(self.title)
        self.summary = short_summary(self.summary)
        self.published_at = to_utc(self.published_at)
        if not self.id:
            self.id = make_id(self.source, self.url, self.title)

    def row(self) -> dict:
        d = asdict(self)
        d["fetched_at"] = d["fetched_at"] or datetime.now(UTC)
        return {k: d[k] for k in COLUMNS}


def make_id(source: str, url: str, title: str = "") -> str:
    """Stable id: the same link from the same source always gets the same id."""
    key = f"{source}|{url.strip() or title.strip().lower()}"
    return hashlib.sha1(key.encode()).hexdigest()[:16]


_TAG = re.compile(r"<[^>]+>")
_SPACE = re.compile(r"\s+")


def clean_text(text: str | None) -> str:
    """Drop HTML tags and entities, squash whitespace."""
    if not text:
        return ""
    return _SPACE.sub(" ", html.unescape(_TAG.sub(" ", text))).strip()


def short_summary(text: str | None, limit: int = SUMMARY_MAX) -> str:
    """At most `limit` characters, cut at a word boundary, with an ellipsis if cut."""
    text = clean_text(text)
    if len(text) <= limit:
        return text
    cut = text[:limit].rsplit(" ", 1)[0].rstrip(",.;:")
    return cut + "..."


def to_utc(value) -> datetime:
    ts = pd.Timestamp(value)
    if ts.tzinfo is None:
        ts = ts.tz_localize("UTC")
    return ts.tz_convert("UTC").to_pydatetime()


def to_frame(articles: list[Article]) -> pd.DataFrame:
    df = pd.DataFrame([a.row() for a in articles], columns=COLUMNS)
    if not df.empty:
        df["published_at"] = pd.to_datetime(df["published_at"], utc=True)
        df["fetched_at"] = pd.to_datetime(df["fetched_at"], utc=True)
    return df
