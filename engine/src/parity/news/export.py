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
from . import archive, history, impact, sources, store, study, tagging

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
        "topics": tagging.topics(f"{a['title']}. {a.get('summary') or ''}"),
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
    n_arch = build_archive(out, root, stamp)
    n_imp = build_impact(out, root, stamp)
    return {"articles": len(doc["articles"]), "records": len(recs_doc["records"]),
            "prices_through": last, "archive": n_arch, "impact": n_imp}


# ------------------------------------------------------------------ archive and impact

ARCHIVE_FIELDS = ["id", "published_at", "source", "publisher", "title", "url", "category",
                  "topics", "assets", "currencies", "commodities", "regions"]


def _dump(path: Path, doc) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(doc, separators=(",", ":")))


def build_archive(out: Path, root: Path = DEFAULT_DIR, stamp: str = "") -> int:
    """news/archive/index.json plus one news/archive/<year>.json per year: every archived
    headline the site may show, as rows of ARCHIVE_FIELDS."""
    years, total = [], 0
    for y in archive.years(root):
        df = shown(archive.load(str(y), str(y), root))
        if df.empty:
            continue
        rows = [[r["id"], pd.Timestamp(r["published_at"]).isoformat(), r["source"],
                 r.get("publisher") or "", r["title"], r["url"], r["category"],
                 list(r["topics"]), list(r["assets"]), list(r["currencies"]),
                 list(r["commodities"]), list(r["regions"])] for r in df.to_dict("records")]
        _dump(out / "archive" / f"{y}.json", {"year": y, "fields": ARCHIVE_FIELDS, "rows": rows})
        years.append({"year": y, "count": len(rows)})
        total += len(rows)
    _dump(out / "archive" / "index.json", {
        "generated_at": stamp, "years": years, "total": total, "fields": ARCHIVE_FIELDS,
        "topics": [{"id": k, "label": v} for k, v in tagging.TOPIC_LABEL.items()],
        "sources": source_list()})
    return total


def _compact_study(st: dict, n_events: int = 8) -> dict:
    keep = ("n_headlines", "n_events", "n_overlapping", "n_non_overlapping", "first", "last",
            "horizons", "path", "warnings")
    if (st.get("n_events") or 0) < 5:  # nothing worth drawing; keep the counts only
        return {k: st.get(k) for k in ("n_headlines", "n_events", "warnings")}
    return {**{k: st.get(k) for k in keep},
            "events": [{**{k: e[k] for k in e if k != "items"},
                        "items": [[i["title"], i["url"], i["source"]] for i in e["items"][:2]]}
                       for e in st.get("events", [])[:n_events]]}


def build_impact(out: Path, root: Path = DEFAULT_DIR, stamp: str = "",
                 assets: list[str] | None = None, topics: list[str] | None = None,
                 draws: int = 300, max_days: int = 300) -> int:
    """news/impact.json: precomputed event studies (topic x asset), rankings both ways and,
    per asset, the news days followed by the biggest unusual moves, for the Impact tab."""
    items = shown(archive.load(root=root))
    prepared = {}
    for k in assets or study.DEFAULT_ASSETS:
        try:
            prepared[k] = study.prepare(k, root=root)
        except (FileNotFoundError, KeyError):
            continue
    topics = topics or list(tagging.TOPICS)
    doc = {"generated_at": stamp, "horizons": list(study.HORIZONS), "pre": study.PRE,
           "post": study.POST, "min_events": study.MIN_EVENTS, "n_items": int(len(items)),
           "assets": [{"key": k, "label": p.label, "unit": p.unit,
                       "first": p.dates[0].date().isoformat(),
                       "last": p.dates[-1].date().isoformat()} for k, p in prepared.items()],
           "topics": [], "studies": {}, "by_topic": {}, "by_asset": {}, "moves": {}}
    if items.empty or not prepared:
        _dump(out / "impact.json", doc)
        return 0
    rows_by_asset: dict[str, list] = {k: [] for k in prepared}
    for t in topics:
        sub = study.matching(items, t)
        doc["topics"].append({"id": t, "label": tagging.TOPIC_LABEL[t], "n_headlines": len(sub)})
        doc["studies"][t] = {}
        rows = []
        for k, p in prepared.items():
            st = study.event_study(k, sub, p=p, draws=draws, keep_events=8)
            doc["studies"][t][k] = _compact_study(st)
            row = study._rank_row(st, "5d", asset=k, label=p.label)
            rows.append(row)
            rows_by_asset[k].append({**row, "topic": t, "label": tagging.TOPIC_LABEL[t]})
        doc["by_topic"][t] = study._ranked([dict(r) for r in rows], f"assets after {t}", "5d")
    for k, rows in rows_by_asset.items():
        doc["by_asset"][k] = study._ranked(rows, f"topics for {k}", "5d")
    for k, p in prepared.items():
        tm = study.top_moves(k, items, horizon="1d", n=max_days, p=p)
        per_year: dict[str, int] = {}
        rel = items[items["assets"].apply(lambda a, k=k: k in a)]
        if not rel.empty:
            days = study.headline_days(p, rel)
            if not days.empty:
                per_year = days["event_date"].dropna().str[:4].value_counts().sort_index().to_dict()
        doc["moves"][k] = {"share_all_days_z2": tm.get("share_all_days_z2"),
                           "days_per_year": {y: int(v) for y, v in per_year.items()},
                           "days": [{**{c: d[c] for c in d if c != "items"},
                                     "items": [[i["title"], i["url"], i["source"]]
                                               for i in d["items"][:3]]} for d in tm["days"]]}
    _dump(out / "impact.json", doc)
    return len(doc["topics"]) * len(prepared)
