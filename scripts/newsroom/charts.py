"""Hero and inline charts for newsroom posts, drawn from data already in this repository.

A post asks for one by name (`[hero] kind = "chart"`, `chart = "<name>"`). Each chart reads
its data when the site builds, so the numbers on the picture are always the current ones and
can be checked against the file named in the caption. Charts only read public material
(the catalog and docs), never results, the ledger or /data/ (DEC-0015).

Each function returns a Chart: the SVG, a line saying where the data came from, and the
numbers themselves (for the alt text check and the tests).
"""
from __future__ import annotations

import html
import json
from collections import Counter
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
W, H = 1600, 900
FONT = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
e = html.escape


@dataclass
class Chart:
    svg: str
    source: str
    data: list[tuple[str, int]]


def _frame(title: str, sub: str, body: str, foot: str) -> str:
    grid = "".join(f"M{x} 0V{H}" for x in range(80, W, 80)) + "".join(f"M0 {y}H{W}" for y in range(80, H, 80))
    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" role="img" aria-label="{e(title)}">
<defs><radialGradient id="g" cx="88%" cy="6%" r="80%"><stop offset="0" stop-color="#1b2a6b"/><stop offset=".6" stop-color="#07080d" stop-opacity="0"/></radialGradient></defs>
<rect width="{W}" height="{H}" fill="#07080d"/><rect width="{W}" height="{H}" fill="url(#g)"/>
<path d="{grid}" stroke="#85a8ff" stroke-opacity=".045"/>
<g font-family="{FONT}">
<text x="96" y="128" font-size="52" font-weight="600" fill="#f1f3f9" letter-spacing="-1">{e(title)}</text>
<text x="96" y="182" font-size="28" fill="#a3a8b9">{e(sub)}</text>
{body}
<text x="96" y="{H - 56}" font-size="22" fill="#8a8fa2">{e(foot)}</text>
</g></svg>"""


def _hbars(rows: list[tuple[str, int]], top: int = 250, accent: str = "#4f7cff") -> str:
    """Horizontal bars with the count printed at the end of each bar."""
    biggest = max((v for _, v in rows), default=1) or 1
    left, right = 420, W - 200
    step = min(96, (H - top - 140) // max(1, len(rows)))
    bar = int(step * 0.62)
    out = []
    for i, (label, v) in enumerate(rows):
        y = top + i * step
        w = max(4, round((right - left) * v / biggest))
        fill = accent if i == 0 else "#2e3b66"
        out.append(f'<text x="{left - 24}" y="{y + bar * 0.68:.0f}" font-size="30" fill="#dfe2ec" text-anchor="end">{e(label)}</text>')
        out.append(f'<rect x="{left}" y="{y}" width="{w}" height="{bar}" rx="6" fill="{fill}"/>')
        out.append(f'<text x="{left + w + 18}" y="{y + bar * 0.68:.0f}" font-size="30" font-weight="600" fill="#f1f3f9">{v}</text>')
    return "\n".join(out)


def _vbars(rows: list[tuple[str, int]], top: int = 250) -> str:
    biggest = max((v for _, v in rows), default=1) or 1
    left, right, base = 120, W - 96, H - 150
    slot = (right - left) / max(1, len(rows))
    bar = slot * 0.64
    out = [f'<path d="M{left} {base}H{right}" stroke="#a9b6ff" stroke-opacity=".25"/>']
    for i, (label, v) in enumerate(rows):
        x = left + i * slot + (slot - bar) / 2
        h = max(3, (base - top - 40) * v / biggest)
        out.append(f'<rect x="{x:.0f}" y="{base - h:.0f}" width="{bar:.0f}" height="{h:.0f}" rx="5" fill="#4f7cff"/>')
        out.append(f'<text x="{x + bar / 2:.0f}" y="{base - h - 14:.0f}" font-size="26" font-weight="600" fill="#f1f3f9" text-anchor="middle">{v}</text>')
        out.append(f'<text x="{x + bar / 2:.0f}" y="{base + 40:.0f}" font-size="24" fill="#a3a8b9" text-anchor="middle">{e(label)}</text>')
    return "\n".join(out)


def _catalog() -> list[dict]:
    return [json.loads(p.read_text()) for p in sorted((ROOT / "catalog/algorithms").glob("*.json"))]


EVIDENCE_LABELS = {"backtest": "Backtest", "live": "Live trading", "index": "Index", "competition": "Competition",
                   "paper-trading": "Paper trading", "paper_trading": "Paper trading"}


def catalog_evidence() -> Chart:
    """Every result reported for the ideas in our catalog, by the kind of evidence behind it."""
    ideas = _catalog()
    c = Counter((r.get("evidence_type") or "not stated") for a in ideas for r in a.get("reported_results") or [])
    rows = [(EVIDENCE_LABELS.get(k, k.replace("-", " ").replace("_", " ").capitalize()), v) for k, v in c.most_common()]
    total = sum(v for _, v in rows)
    svg = _frame("Reported results, by kind of evidence",
                 f"{total} results reported for the {len(ideas)} trading ideas in the Parity catalog",
                 _hbars(rows), "Source: Parity catalog, catalog/algorithms/*.json, field reported_results.evidence_type")
    return Chart(svg, f"Parity catalog, {len(ideas)} ideas, {total} reported results", rows)


def catalog_decades() -> Chart:
    """The ideas in our catalog by the decade they were first published."""
    ideas = _catalog()
    c = Counter()
    for a in ideas:
        y = str((a.get("origin") or {}).get("first_published") or "")[:4]
        if y.isdigit():
            c[f"{y[:3]}0s"] += 1
    rows = sorted(c.items())
    dated = sum(v for _, v in rows)
    svg = _frame("Catalog ideas, by decade first published",
                 f"{dated} of the {len(ideas)} ideas in the Parity catalog have a known first publication date",
                 _vbars(rows), "Source: Parity catalog, catalog/algorithms/*.json, field origin.first_published")
    return Chart(svg, f"Parity catalog, {dated} dated ideas", rows)


CHARTS = {
    "catalog-evidence": catalog_evidence,
    "catalog-decades": catalog_decades,
}


def draw(name: str) -> Chart:
    if name not in CHARTS:
        raise KeyError(f"no chart named {name!r}; known charts: {', '.join(sorted(CHARTS))}")
    return CHARTS[name]()
