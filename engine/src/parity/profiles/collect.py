"""One collection pass, the summary the site shows, and the daily hook for the sims service.

    parity profiles collect          one pass now over every source that is on
    parity profiles sources          every source: on or off, key needed, terms
    parity profiles status           when it last ran and what it holds
    parity profiles export           engine/output/profiles.json (counts only)

The sims service (DEC-0037) calls `collect_if_due` each cycle; it runs a pass at most
once every PASS_HOURS, so the sources see one visit a day.
"""

from __future__ import annotations

import json
import math
import sqlite3
from collections import Counter
from datetime import UTC, datetime, timedelta
from pathlib import Path

from . import signals, sources, store
from .net import Blocked, Session

ROOT = Path(__file__).resolve().parents[4]
REGISTRY = ROOT / "docs" / "_system" / "competitors.json"
PASS_HOURS = 20
TOP = 5
TREND_MONTHS = 12


def registry() -> dict:
    return json.loads(REGISTRY.read_text())


def products(only: list[str] | None = None) -> list[dict]:
    ps = registry()["products"]
    return [p for p in ps if not only or p["id"] in only]


def run_pass(con: sqlite3.Connection | None = None, only_products: list[str] | None = None,
             only_sources: list[str] | None = None, session: Session | None = None,
             echo=None) -> dict:
    """Visit every source that is on for every product. A source that fails or is
    blocked is recorded and the rest still run. Returns the pass report."""
    con = con or store.connect()
    s = session or Session()
    say = echo or (lambda _line: None)
    started = store.now()
    chosen = products(only_products)
    report: dict[str, dict] = {}
    added = 0
    for src in sources.SOURCES:
        if only_sources and src.id not in only_sources:
            continue
        r = report.setdefault(src.id, {"status": "ok", "items": 0, "new": 0, "errors": 0})
        if src.off:
            r.update(status="off", note=src.off)
            continue
        if sources.missing_keys(src):
            r.update(status="needs key", note="vault: " + ", ".join(src.vault))
            continue
        if src.id == "appstore-ratings":
            try:
                got = sources.fetch_ratings(s, chosen)
                apps = {a: p["id"] for p in chosen for a in p.get("appstore", [])}
                r["items"] = r["new"] = store.save_ratings(con, apps, got)
            except Blocked as exc:
                r.update(status="skipped", note=str(exc))
            except Exception as exc:  # one dead source should not stop the others
                r.update(status="error", note=f"{type(exc).__name__}: {str(exc)[:120]}",
                         errors=1)
            say(f"{src.id:<17} {r['status']:<9} {r['items']} apps")
            continue
        fetch = sources.FETCHERS[src.id]
        for p in chosen:
            try:
                items, mark = fetch(s, p, store.get_mark(con, src.id, p["id"]))
            except Blocked as exc:
                r.update(status="skipped", note=str(exc))
                break  # robots.txt or a rate limit applies to the whole source
            except Exception as exc:
                r["errors"] += 1
                r["note"] = f"{p['id']}: {type(exc).__name__}: {str(exc)[:100]}"
                continue
            new = store.merge(con, items)
            store.set_mark(con, src.id, p["id"], mark)
            r["items"] += len(items)
            r["new"] += new
            added += new
        if r["errors"] and r["status"] == "ok":
            r["status"] = "partial"
        say(f"{src.id:<17} {r['status']:<9} {r['items']} items, {r['new']} new"
            + (f"  ({r['note']})" if r.get("note") else ""))
    pruned = store.prune(con)
    store.rescore(con)
    finished = store.now()
    with con:
        con.execute("INSERT INTO passes (started_at, finished_at, added, requests, report) "
                    "VALUES (?, ?, ?, ?, ?)", (started, finished, added, s.requests,
                                               json.dumps(report)))
    return {"started_at": started, "finished_at": finished, "added": added,
            "requests": s.requests, "sources": report, "pruned": pruned}


# ------------------------------------------------------------------ reading it back


def _month(iso: str) -> str:
    return iso[:7]


def summary(con: sqlite3.Connection | None = None) -> dict:
    """Per product: counts of praise and complaints by theme, a monthly trend, release
    and incident counts, and App Store ratings. Counts only, never review text."""
    con = con or store.connect()
    reg = registry()
    today = datetime.now(UTC)
    d30, d60, d90 = ((today - timedelta(days=n)).isoformat() for n in (30, 60, 90))
    now_m = today.year * 12 + today.month - 1
    months = [f"{(now_m - i) // 12:04d}-{(now_m - i) % 12 + 1:02d}"
              for i in range(TREND_MONTHS)][::-1]
    out = {}
    praise_all: Counter = Counter()
    complain_all: Counter = Counter()
    praised_in: Counter = Counter()
    for p in reg["products"]:
        rows = con.execute("SELECT source, sentiment, score, themes, published_at FROM items "
                           "WHERE product = ? AND kind = 'feedback'", (p["id"],)).fetchall()
        praise: Counter = Counter()
        complain: Counter = Counter()
        mention: Counter = Counter()
        by_source: Counter = Counter()
        sent = Counter()
        trend = {m: [0, 0, 0] for m in months}  # items, positive, negative
        recent = [[], []]  # scores in the last 30 days, and the 30 before
        for source, label, score, th, pub in rows:
            by_source[source] += 1
            sent[label] += 1
            for t in json.loads(th):
                mention[t] += 1
                praise[t] += label == "positive"
                complain[t] += label == "negative"
            if pub:
                m = _month(pub)
                if m in trend:
                    trend[m][0] += 1
                    trend[m][1] += label == "positive"
                    trend[m][2] += label == "negative"
                if pub >= d30:
                    recent[0].append(score)
                elif pub >= d60:
                    recent[1].append(score)
        praise_all.update(praise)
        complain_all.update(complain)
        top_p = [t for t, n in praise.most_common(TOP) if n]
        praised_in.update(top_p)

        def mean(xs):
            return None if not xs else round(sum(xs) / len(xs), 3)

        kinds = dict(con.execute(
            "SELECT kind, COUNT(*) FROM items WHERE product = ? AND kind != 'feedback' AND "
            "published_at >= ? GROUP BY kind", (p["id"], d90)).fetchall())
        last_inc = con.execute("SELECT title, published_at FROM items WHERE product = ? AND "
                               "kind = 'incident' ORDER BY published_at DESC LIMIT 1",
                               (p["id"],)).fetchone()
        apps = []
        for app in p.get("appstore", []):
            hist = con.execute("SELECT day, rating, count FROM ratings WHERE app = ? ORDER BY day",
                               (app,)).fetchall()
            if hist:
                apps.append({"app": app, "rating": _r(hist[-1][1], 2), "count": hist[-1][2],
                             "since": hist[0][0], "rating_then": _r(hist[0][1], 2),
                             "count_then": hist[0][2]})
        out[p["id"]] = {
            "name": p["name"], "doc": p["doc"], "group": p["group"],
            "feedback": len(rows), "positive": sent["positive"], "negative": sent["negative"],
            "neutral": sent["neutral"], "by_source": dict(by_source),
            "praised": [{"theme": t, "label": signals.label(t), "count": praise[t]}
                        for t in top_p],
            "complaints": [{"theme": t, "label": signals.label(t), "count": n}
                           for t, n in complain.most_common(TOP) if n],
            "mentions": dict(mention.most_common()),
            "trend": [{"month": m, "items": v[0], "positive": v[1], "negative": v[2]}
                      for m, v in trend.items()],
            "net_30d": mean(recent[0]), "net_prev_30d": mean(recent[1]),
            "releases_90d": kinds.get("release", 0), "incidents_90d": kinds.get("incident", 0),
            "last_incident": None if not last_inc else {"title": last_inc[0], "at": last_inc[1]},
            "apps": apps,
        }
    last = store.last_pass(con)
    total = con.execute("SELECT COUNT(*) FROM items").fetchone()[0]
    patterns = sorted(({"theme": t, "label": signals.label(t), "praise": praise_all[t],
                        "complaints": complain_all[t], "products_praised": praised_in[t]}
                       for t in signals.THEMES), key=lambda x: (-x["praise"], x["theme"]))
    return {
        "generated_at": store.now(),
        "last_pass_at": last[0] if last else None,
        "sources": _latest_sources(con),
        "items": total,
        "products": out,
        "patterns": patterns,
        "method": "Rule-based: a fixed word list for sentiment (star ratings decide when "
                  "present) and fixed keyword lists for themes. Counts of public items, "
                  "not a survey.",
    }


def _latest_sources(con: sqlite3.Connection) -> dict:
    """Each source's status from the newest pass that tried it (a pass can be limited to
    a few sources by hand), with how many items it holds in all."""
    out: dict[str, dict] = {}
    for (report,) in con.execute("SELECT report FROM passes ORDER BY id DESC LIMIT 60"):
        for k, v in json.loads(report).items():
            out.setdefault(k, {"status": v["status"], "note": v.get("note")})
    held = dict(con.execute("SELECT source, COUNT(*) FROM items GROUP BY source").fetchall())
    held["appstore-ratings"] = con.execute("SELECT COUNT(DISTINCT app) FROM ratings").fetchone()[0]
    for k, v in out.items():
        v["items"] = held.get(k, 0)
    return out


def _r(v, d: int = 3):
    return None if v is None or not math.isfinite(v) else round(float(v), d)


def export(con: sqlite3.Connection | None = None, path: Path | None = None) -> dict:
    doc = summary(con)
    path = path or store.OUT / "profiles.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(doc, separators=(",", ":")))
    return doc


def publish(doc: dict) -> None:
    """Counts only to Supabase (profile_snapshots); the deploy job copies the newest."""
    from ..publish.supabase import publish_profiles

    publish_profiles(doc)


# ------------------------------------------------------------------ the daily hook


def due(con: sqlite3.Connection, hours: float = PASS_HOURS) -> bool:
    last = store.last_pass(con)
    if not last:
        return True
    age = datetime.now(UTC) - datetime.fromisoformat(last[0])
    return age >= timedelta(hours=hours)


def collect_if_due(hours: float = PASS_HOURS) -> dict:
    """For the sims cycle: a pass if the last one is older than `hours`, else a note."""
    con = store.connect()
    if not due(con, hours):
        last = store.last_pass(con)
        return {"skipped": f"last pass {last[0]}" if last else "not due"}
    out = run_pass(con)
    doc = export(con)
    published = False
    try:
        publish(doc)
        published = True
    except Exception as exc:  # NotConfigured, or the table is not migrated yet
        if type(exc).__name__ != "NotConfigured":
            print(f"profiles publish failed: {type(exc).__name__}", flush=True)
    ok = [k for k, v in out["sources"].items() if v["status"] in ("ok", "partial")]
    print(f"{out['finished_at']} profiles pass: {out['added']} new items, "
          f"{out['requests']} requests, sources on: {', '.join(ok) or 'none'}", flush=True)
    return {"new": out["added"], "requests": out["requests"], "items": doc["items"],
            "published": published}


def health(path: Path = store.DB) -> str:
    if not path.exists():
        return "profiles: not collected on this machine yet"
    con = store.connect(path)
    last = store.last_pass(con)
    total = con.execute("SELECT COUNT(*) FROM items").fetchone()[0]
    from ..sims import _ago

    return f"profiles: {total:,} feedback items, last pass {_ago(last[0] if last else None)}"
