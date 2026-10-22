"""Draw the Parity lockup chosen on 2026-10-22: the starburst, a thin divider, PARITY
in Roman capitals and SYSTEMATIC RESEARCH beneath, the version on the light blue
background (bottom left of the sheet the team picked from).

Letters are turned into SVG paths so the files need no font. The face is Cinzel
(SIL Open Font License, https://github.com/NDISCOVER/Cinzel); fontTools is needed to
run this, the output is plain SVG:

    pip install fonttools
    python3 scripts/brand_wordmark.py path/to/Cinzel.ttf web/public/brand/2026-10-22-wordmark
"""

from __future__ import annotations

import sys
from pathlib import Path

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

sys.path.insert(0, str(Path(__file__).parent))
from brand import mark  # noqa: E402

NAVY, WHITE = "#0d1a3a", "#f4f7ff"
BLUE_BG = ('<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="0.3">'
           '<stop offset="0" stop-color="#d6f5e9"/><stop offset="0.45" stop-color="#cfe6fb"/>'
           '<stop offset="1" stop-color="#a9bff7"/></linearGradient></defs>')


def text_path(font: TTFont, text: str, x: float, baseline: float, size: float, tracking: float,
              weight: int = 500) -> tuple[str, float]:
    """SVG path data for `text`, and the x where it ends."""
    gs = font.getGlyphSet(location={"wght": weight} if "fvar" in font else None)
    cmap = font.getBestCmap()
    scale = size / font["head"].unitsPerEm
    out = []
    for ch in text:
        if ch == " ":
            x += size * 0.32 + tracking
            continue
        name = cmap[ord(ch)]
        pen = SVGPathPen(gs)
        gs[name].draw(TransformPen(pen, (scale, 0, 0, -scale, x, baseline)))
        out.append(pen.getCommands())
        x += gs[name].width * scale + tracking
    return " ".join(out), x - tracking


def lockup(font: TTFont, ink: str, palette: str, background: str = "", subtitle: bool = True) -> str:
    big, b_end = text_path(font, "PARITY", 92, 44 if subtitle else 46, 34, 9, weight=620)
    parts = [f'<g transform="translate(4 6) scale(.81)">{mark(palette, "core-lk")}</g>',
             f'<rect x="76" y="12" width="1" height="{44 if subtitle else 36}" fill="{ink}" opacity=".35"/>',
             f'<path d="{big}" fill="{ink}"/>']
    width = b_end
    if subtitle:
        small, s_end = text_path(font, "SYSTEMATIC RESEARCH", 93, 62, 10.5, 4.2, weight=700)
        parts.append(f'<path d="{small}" fill="{ink}" opacity=".85"/>')
        width = max(width, s_end)
    w, h = int(width + 16), 74 if subtitle else 64
    bg = f'{BLUE_BG}<rect width="{w}" height="{h}" rx="12" fill="url(#bg)"/>' if background == "blue" else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" '
            f'role="img" aria-label="Parity, systematic research"><title>Parity</title>{bg}{"".join(parts)}</svg>\n')


def letters(font: TTFont, ink: str) -> str:
    """PARITY alone, for tight spaces next to a separate mark (the app sidebar)."""
    d, end = text_path(font, "PARITY", 0, 26, 30, 7, weight=620)
    w = int(end + 1)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="32" viewBox="0 0 {w} 32" '
            f'role="img" aria-label="Parity"><title>Parity</title><path d="{d}" fill="{ink}"/></svg>\n')


def build(font_path: str, out: Path) -> list[str]:
    font = TTFont(font_path)
    out.mkdir(parents=True, exist_ok=True)
    files = {
        "parity-lockup-on-blue.svg": lockup(font, NAVY, "light", background="blue"),
        "parity-lockup-on-light.svg": lockup(font, NAVY, "light"),
        "parity-lockup-on-dark.svg": lockup(font, WHITE, "light"),
        "parity-wordmark-on-light.svg": lockup(font, NAVY, "light", subtitle=False),
        "parity-wordmark-on-dark.svg": lockup(font, WHITE, "light", subtitle=False),
        "parity-letters-on-light.svg": letters(font, NAVY),
        "parity-letters-on-dark.svg": letters(font, WHITE),
    }
    for name, body in files.items():
        (out / name).write_text(body)
    return sorted(files)


if __name__ == "__main__":
    print("\n".join(build(sys.argv[1], Path(sys.argv[2]))))
