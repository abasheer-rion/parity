"""The feedback collector's local store: engine/output/profiles.db (SQLite).

Rows are deduplicated by a hash of the source and the item's own id, so running a pass
twice adds nothing. Text is kept only locally, cut to 1,500 characters, and blanked
after RETAIN_TEXT_DAYS; the sentiment and themes computed from it stay, so trends keep
their history. Author names are never stored. Nothing here leaves the machine: the site
gets counts only (see collect.summary).
"""

from __future__ import annotations

import json
import sqlite3
from datetime import UTC, datetime, timedelta
from pathlib import Path

from . import signals

OUT = Path(__file__).resolve().parents[3] / "output"
DB = OUT / "profiles.db"
RETAIN_TEXT_DAYS = 400
RETAIN_ROWS_DAYS = 365 * 5
KEEP_PASSES = 400

SCHEMA = """
CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY, product TEXT NOT NULL, source TEXT NOT NULL, kind TEXT NOT NULL,
  url TEXT, title TEXT, text TEXT, rating INTEGER, published_at TEXT, fetched_at TEXT NOT NULL,
  score REAL NOT NULL, sentiment TEXT NOT NULL, themes TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS items_product ON items (product, kind, published_at);
CREATE TABLE IF NOT EXISTS ratings (
  app INTEGER NOT NULL, product TEXT NOT NULL, day TEXT NOT NULL, rating REAL, count INTEGER,
  PRIMARY KEY (app, day));
CREATE TABLE IF NOT EXISTS marks (source TEXT NOT NULL, product TEXT NOT NULL, mark TEXT,
  PRIMARY KEY (source, product));
CREATE TABLE IF NOT EXISTS passes (
  id INTEGER PRIMARY KEY, started_at TEXT NOT NULL, finished_at TEXT NOT NULL,
  added INTEGER NOT NULL, requests INTEGER NOT NULL, report TEXT NOT NULL)
"""


def connect(path: Path = DB) -> sqlite3.Connection:
    path.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(path, timeout=30)
    con.execute("PRAGMA journal_mode=WAL")
    con.executescript(SCHEMA)
    return con


def now() -> str:
    return datetime.now(UTC).isoformat(timespec="seconds")


def merge(con: sqlite3.Connection, items: list[dict]) -> int:
    """Add new items with their signals; returns how many were new."""
    before = con.execute("SELECT COUNT(*) FROM items").fetchone()[0]
    rows = []
    for it in items:
        text = f"{it.get('title') or ''}. {it.get('text') or ''}"
        score, label = signals.sentiment(text, it.get("rating"))
        rows.append((it["id"], it["product"], it["source"], it["kind"], it.get("url"),
                     it.get("title"), it.get("text"), it.get("rating"), it.get("published_at"),
                     now(), score, label, json.dumps(signals.themes(text))))
    with con:
        con.executemany("INSERT OR IGNORE INTO items VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)", rows)
    return con.execute("SELECT COUNT(*) FROM items").fetchone()[0] - before


def rescore(con: sqlite3.Connection) -> int:
    """Recompute sentiment and themes for every row that still has its text, so a change
    to the word lists reaches old rows too. Rows whose text has expired keep their labels."""
    rows = con.execute("SELECT id, title, text, rating FROM items WHERE text IS NOT NULL"
                       ).fetchall()
    out = []
    for id_, title, text, rating in rows:
        body = f"{title or ''}. {text or ''}"
        score, label = signals.sentiment(body, rating)
        out.append((score, label, json.dumps(signals.themes(body)), id_))
    with con:
        con.executemany("UPDATE items SET score = ?, sentiment = ?, themes = ? WHERE id = ?", out)
    return len(out)


def get_mark(con: sqlite3.Connection, source: str, product: str) -> str | None:
    row = con.execute("SELECT mark FROM marks WHERE source = ? AND product = ?",
                      (source, product)).fetchone()
    return row[0] if row else None


def set_mark(con: sqlite3.Connection, source: str, product: str, mark: str | None) -> None:
    if mark is None:
        return
    with con:
        con.execute("INSERT INTO marks VALUES (?, ?, ?) ON CONFLICT(source, product) DO UPDATE "
                    "SET mark = excluded.mark", (source, product, mark))


def save_ratings(con: sqlite3.Connection, app_product: dict[int, str], got: dict[int, dict]) -> int:
    day = now()[:10]
    rows = [(app, app_product[app], day, v.get("rating"), v.get("count"))
            for app, v in got.items() if app in app_product]
    with con:
        con.executemany("INSERT INTO ratings VALUES (?,?,?,?,?) ON CONFLICT(app, day) DO UPDATE "
                        "SET rating = excluded.rating, count = excluded.count", rows)
    return len(rows)


def prune(con: sqlite3.Connection) -> dict:
    """Blank old text and drop very old rows. Returns what it did."""
    text_cut = (datetime.now(UTC) - timedelta(days=RETAIN_TEXT_DAYS)).isoformat()
    row_cut = (datetime.now(UTC) - timedelta(days=RETAIN_ROWS_DAYS)).isoformat()
    with con:
        blanked = con.execute("UPDATE items SET text = NULL WHERE text IS NOT NULL AND "
                              "published_at < ?", (text_cut,)).rowcount
        dropped = con.execute("DELETE FROM items WHERE published_at < ?", (row_cut,)).rowcount
        con.execute("DELETE FROM passes WHERE id <= (SELECT MAX(id) FROM passes) - ?",
                    (KEEP_PASSES,))
    return {"blanked": blanked, "dropped": dropped}


def last_pass(con: sqlite3.Connection) -> tuple[str, dict] | None:
    row = con.execute("SELECT finished_at, report FROM passes ORDER BY id DESC LIMIT 1").fetchone()
    return (row[0], json.loads(row[1])) if row else None
