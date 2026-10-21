"""Static JSON for the dashboard's News page.

    news/articles.json   newest articles, each with its market moves and a price path
    news/records.json    the biggest market days since 1999 and the news for each

The site is static behind Cloudflare Access, so the deploy job runs `parity news export`
and ships these files next to the page.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path

import pandas as pd

from ..data.store import DEFAULT_DIR
from . import history, impact, sources, store

MAX_ARTICLES = 400


def source_list() -> list[dict]:
    return [{"id": s.id, "name": s.name, "licence": s.licence, "terms_url": s.terms_url,
             "summary_stored": s.store_summary, "key_env": s.key_env,
             "needs_contact": s.needs_contact, "display": s.display} for s in sources.SOURCES]


def shown(df: pd.DataFrame) -> pd.DataFrame:
    """Only sources whose terms let the shared site show them."""
    ok = {s.id for s in sources.SOURCES if s.display == "yes"}
    return df[df["source"].isin(ok)] if not df.empty else df


def article_json(a: dict, panel: pd.DataFrame | None) -> dict:
    ts = pd.Timestamp(a["published_at"])
    keys = impact.targets_for(a["currencies"], a["commodities"], a["category"])
    moves = {}
    if panel is not None:
        for k in keys:
            m = impact.measure(panel, k, ts)
            if m:
                moves[k] = {"label": impact.TARGETS[k].label, "unit": m["unit"],
                            "base_date": m["base_date"],
                            **{h: m.get(h) for h in ["1h", *impact.HORIZONS]}}
            elif k in panel and impact.event_day(panel.index, ts) is None:  # pending
                moves[k] = {"label": impact.TARGETS[k].label, "unit": impact.TARGETS[k].unit,
                            "base_date": None, **{h: None for h in ["1h", *impact.HORIZONS]}}
    primary = next(iter(moves), None)
    return {
        "id": a["id"], "source": a["source"], "publisher": a.get("publisher") or "",
        "published_at": ts.isoformat(), "title": a["title"], "url": a["url"],
        "summary": a.get("summary") or "", "currencies": list(a["currencies"]),
        "commodities": list(a["commodities"]), "regions": list(a["regions"]),
        "category": a["category"], "tickers": list(a.get("tickers") or []),
        "primary": primary, "impacts": moves,
        "path": impact.path(panel, primary, ts) if panel is not None and primary else [],
    }


def build(out: Path, root: Path = DEFAULT_DIR, panel: pd.DataFrame | None = None,
          max_articles: int = MAX_ARTICLES) -> dict:
    out = Path(out) / "news"
    out.mkdir(parents=True, exist_ok=True)
    if panel is None:
        try:
            panel = impact.load_panel(root)
        except FileNotFoundError:
            panel = None
    arts = shown(store.load(root))
    rows = arts.head(max_articles).to_dict("records") if not arts.empty else []
    stamp = datetime.now(UTC).isoformat(timespec="seconds")
    last = panel.dropna(how="all").index.max().date().isoformat() if panel is not None else None
    doc = {"generated_at": stamp, "prices_through": last, "sources": source_list(),
           "horizons": ["1h", *impact.HORIZONS],
           "articles": [article_json(a, panel) for a in rows]}
    (out / "articles.json").write_text(json.dumps(doc, separators=(",", ":")))
    recs_doc = {"generated_at": stamp, "prices_through": last, "series": [], "records": []}
    if panel is not None:
        recs = history.all_records(panel)
        recs_doc["series"] = [{"key": k, "label": impact.TARGETS[k].label,
                               "unit": impact.TARGETS[k].unit}
                              for k in history.RECORD_SERIES if k in panel]
        recs_doc["records"] = history.explain(recs, arts, history.load_explanations(root))
    (out / "records.json").write_text(json.dumps(recs_doc, separators=(",", ":")))
    return {"articles": len(doc["articles"]), "records": len(recs_doc["records"]),
            "prices_through": last}
