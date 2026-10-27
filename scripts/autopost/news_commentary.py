"""News commentary (DEC-0073): the new headlines that came on the days with the most unusual
market moves, from Parity's impact data (<data>/news/impact.json, `parity news export`).

Each headline is cited by its title and link only. Nothing else from the article is used.
The numbers are ours: the move on the day, how far it was from that market's usual day, and how
often a move that large happens at all. A headline sharing a day with a big move does not mean
it caused the move, and the post says so.

With a Parity-owned language model key (PARITY_ANTHROPIC_API_KEY or PARITY_OPENAI_API_KEY) the
body may be redrafted by the model (llm.py). The redraft must pass the same fact checks, or it is
saved as a draft for a person and never published.
"""
from __future__ import annotations

import datetime as dt
import json
from pathlib import Path

from .common import AUTO_NOTE, Draft, clean, fingerprint, long_date, signed

MAX_DAYS = 3
WINDOW = 7


def move_text(move: float, unit: str) -> tuple[str, float]:
    if unit in ("%", "pct", "percent"):
        v = round(move, 2)
        return f"{signed(v, 2)}%", v
    if unit in ("bp",):
        v = round(move)
        return f"{signed(v, 0)} bp", float(v)
    v = round(move, 2)
    return f"{signed(v, 2)} {unit}".strip(), v


def picks(impact: dict, today: dt.date) -> list[dict]:
    labels = {a["key"]: a for a in impact.get("assets", [])}
    since = today - dt.timedelta(days=WINDOW)
    out = []
    for key, m in (impact.get("moves") or {}).items():
        for d in m.get("days") or []:
            try:
                day = dt.date.fromisoformat(str(d.get("event_date"))[:10])
            except ValueError:
                continue
            if day < since or d.get("z_1d") is None or d.get("move_1d") is None or not d.get("items"):
                continue
            out.append({**d, "asset": key, "label": labels.get(key, {}).get("label", key),
                        "unit": labels.get(key, {}).get("unit", ""), "day": day})
    out.sort(key=lambda d: abs(float(d["z_1d"])), reverse=True)
    chosen, seen_days = [], set()
    for d in out:
        if abs(float(d["z_1d"])) < 2 or (d["day"], d["asset"]) in seen_days:
            continue
        seen_days.add((d["day"], d["asset"]))
        chosen.append(d)
        if len(chosen) == MAX_DAYS:
            break
    return chosen


def build(impact: dict, today: dt.date) -> Draft | None:
    chosen = picks(impact, today)
    if not chosen:
        return None
    truth: list[float] = []
    urls: set[str] = set()
    strip: list[str] = []
    sources = []
    lines = [f"These are the days in the week to {long_date(today)} when a market we track moved far more than usual, "
             "and the headlines our news feed carried that day. The moves are measured by Parity. "
             "The headlines are listed by title and link, and the reporting belongs to their publishers.", "",
             "A headline on the same day as a big move does not prove it caused the move. "
             "Several stories often break on one day, and markets also move on no news at all.", ""]
    for i, d in enumerate(chosen, 1):
        mtxt, mval = move_text(float(d["move_1d"]), d["unit"])
        z = round(float(d["z_1d"]), 1)
        truth += [mval, z]
        lines.append(f"## {d['label']}, {long_date(d['day'])}")
        lines.append("")
        rare = ""
        if d.get("share_of_days_as_big") is not None:
            share = round(float(d["share_of_days_as_big"]) * 100, 1)
            truth.append(share)
            rare = f" A day that large came on {share}% of all days in our history for this market."
        lines.append(f"{d['label']} moved {mtxt} over the next trading day, {signed(z, 1)} times its usual daily move.{rare}")
        lines.append("")
        lines.append("Headlines that day:")
        lines.append("")
        for title, url, source in d["items"][:3]:
            title = clean(str(title)).replace("[", "(").replace("]", ")")
            sid = f"h{len(sources) + 1}"
            sources.append({"id": sid, "title": title, "url": url, "publisher": str(source)})
            urls.add(url)
            strip.append(title)
            lines.append(f"- [{title}]({url}) ({source})[^{sid}]")
        lines.append("")
        truth.append(float(len(d["items"][:3])))
    lines += ["## How this is measured", "",
              "A move is the change from the last close before the news to the close one trading day later. "
              "The usual daily move is that market's spread of daily moves over its history, so a reading of 3 "
              "means a move about three times as large as a typical day. "
              "Our [event studies](/app/#/news) look at many past headlines on the same topic, which says more "
              "than any single day.", "",
              "This is a report of what happened, not advice and not a forecast.", "", AUTO_NOTE]
    truth.append(float(len(chosen)))
    meta = {
        "title": f"Unusual market days in the week to {long_date(today)}",
        "dek": f"{len(chosen)} days when a market moved far more than usual, the size of each move, and the headlines that day.",
        "slug": f"unusual-market-days-{today.isoformat()}", "date": today, "type": "News",
        "stance": "Fact-based reporting", "status": "published", "authors": ["parity-markets-desk"],
        "tags": ["markets", "news-impact"], "auto": "news_commentary",
        "auto_data": fingerprint([[d["asset"], str(d["day"]), d["move_1d"]] for d in chosen]),
        "sources": sources,
    }
    strip += sorted({d["label"] for d in chosen}, key=len, reverse=True)
    return Draft(job="news_commentary", meta=meta, body="\n".join(lines), truth=truth, urls=urls, strip=strip)


def load(data: Path) -> dict | None:
    f = Path(data) / "news" / "impact.json"
    return json.loads(f.read_text()) if f.is_file() else None
