"""Biggest market days since 1999, and the news we are allowed to show for them.

Explanations come from three places, in this order:
  1. articles already in our store published that day or the day before,
  2. GDELT's news search for that day (headline and link only, 2017 on),
  3. nothing: older days without a usable source say so instead of guessing.
"""

from __future__ import annotations

import time
from pathlib import Path

import pandas as pd

from ..data.store import DEFAULT_DIR
from . import impact, sources
from .schema import to_frame
from .store import news_dir

RECORD_SERIES = ["eq.US_TOTAL", "usd.BASKET", "fx.EUR", "fx.JPY", "cmd.WTI", "bond.UST10Y"]
GDELT_FROM = "2017-01-01"  # the DOC API searches from here on
GDELT_PAUSE = 8.0  # GDELT asks for at most one request every 5 seconds; it throttles harder

QUERIES = {
    "eq.US_TOTAL": '("stock market" OR stocks OR "wall street" OR "S&P 500") sourcelang:english',
    "usd.BASKET": '(dollar OR "federal reserve" OR treasury) sourcelang:english',
    "fx.EUR": '(euro OR ECB OR eurozone) sourcelang:english',
    "fx.JPY": '(yen OR "bank of japan") sourcelang:english',
    "cmd.WTI": '("oil prices" OR crude OR OPEC) sourcelang:english',
    "bond.UST10Y": '("treasury yields" OR "bond market" OR "federal reserve") sourcelang:english',
}


def explanations_path(root: Path = DEFAULT_DIR) -> Path:
    return news_dir(root) / "explanations.parquet"


def load_explanations(root: Path = DEFAULT_DIR) -> pd.DataFrame:
    p = explanations_path(root)
    return pd.read_parquet(p) if p.exists() else pd.DataFrame()


def all_records(panel: pd.DataFrame, n: int = 25, since: str = "1999-01-01") -> pd.DataFrame:
    frames = [impact.records(panel, k, since, n) for k in RECORD_SERIES if k in panel]
    frames = [f for f in frames if not f.empty]
    return pd.concat(frames, ignore_index=True) if frames else pd.DataFrame()


def explain_with_gdelt(recs: pd.DataFrame, root: Path = DEFAULT_DIR, limit: int = 40,
                       per_day: int = 5, fetch=sources.gdelt_day, pause: float = GDELT_PAUSE,
                       log=print) -> int:
    """Ask GDELT for headlines on record days we have not asked about yet. Returns how
    many days were looked up. Polite by default: one request every 8 seconds."""
    old = load_explanations(root)
    done = set(zip(old["date"], old["series"], strict=True)) if not old.empty else set()
    todo = [(str(pd.Timestamp(r.date).date()), r.series) for r in recs.itertuples()
            if str(pd.Timestamp(r.date).date()) >= GDELT_FROM and r.series in QUERIES]
    todo = [t for t in dict.fromkeys(todo) if t not in done][:limit]
    rows = []
    for i, (day, series) in enumerate(todo):
        if i:
            time.sleep(pause)
        try:
            arts = fetch(day, QUERIES[series], per_day)
        except Exception as exc:
            log(f"  {day} {series}: {exc}")
            if "429" in str(exc):  # told to slow down: stop and try the rest another time
                todo = todo[:i]
                break
            arts = []
        df = to_frame(arts)
        if df.empty:  # remember we asked, so we do not ask again
            df = pd.DataFrame([{"id": "", "source": "gdelt", "title": ""}])
        df["date"], df["series"] = day, series
        rows.append(df)
    if rows:
        new = pd.concat([old, *rows], ignore_index=True) if not old.empty else \
            pd.concat(rows, ignore_index=True)
        p = explanations_path(root)
        p.parent.mkdir(parents=True, exist_ok=True)
        new.to_parquet(p, index=False)
    return len(todo)


def explain(recs: pd.DataFrame, articles: pd.DataFrame, explanations: pd.DataFrame,
            per_day: int = 5) -> list[dict]:
    """Attach up to `per_day` headlines to each record day."""
    out = []
    arts = articles.copy()
    if not arts.empty:
        arts["day"] = pd.to_datetime(arts["published_at"], utc=True).dt.tz_convert(
            "America/New_York").dt.date.astype(str)
    for r in recs.itertuples():
        day = str(pd.Timestamp(r.date).date())
        prev = str((pd.Timestamp(r.date) - pd.tseries.offsets.BDay(1)).date())
        items = []
        if not arts.empty:
            hit = arts[arts["day"].isin([day, prev])]
            keep = [r.series in impact.targets_for(a["currencies"], a["commodities"],
                                                   a["category"])
                    for a in hit.to_dict("records")]
            hit = hit[keep] if len(hit) else hit
            items += [_brief(a) for a in hit.head(per_day).to_dict("records")]
        if not explanations.empty and len(items) < per_day:
            ex = explanations[(explanations["date"] == day) & (explanations["series"] == r.series)
                              & (explanations["title"].fillna("") != "")]
            items += [_brief(a) for a in ex.head(per_day - len(items)).to_dict("records")]
        if items:
            note = None
        elif day < GDELT_FROM:
            note = "No news source we are allowed to show covers this day yet."
        else:
            note = "No headlines found for this day yet."
        out.append({"date": day, "series": r.series, "label": impact.TARGETS[r.series].label,
                    "unit": r.unit, "move": impact._r(r.move), "z": impact._r(r.z),
                    "rank": int(r.rank), "news": items, "note": note})
    return out


def _brief(a: dict) -> dict:
    ts = pd.Timestamp(a.get("published_at")) if a.get("published_at") is not None else None
    return {"title": a.get("title", ""), "url": a.get("url", ""), "source": a.get("source", ""),
            "publisher": a.get("publisher", "") or "",
            "published_at": ts.isoformat() if ts is not None and not pd.isna(ts) else None}
