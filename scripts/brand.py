"""Draw the Parity starburst mark and every version of it as SVG.

The mark is a 16-point starburst: each spike is split down its length into a lit
half and a shaded half, so it reads as faceted, around a round core. Long and short
spikes alternate. Change the numbers below and rerun to make a new dated set:

    python3 scripts/brand.py web/public/brand/2026-10-21-starburst

PNG sizes are rendered from these SVGs in a browser (see the brand page).
"""

from __future__ import annotations

import math
import sys
from pathlib import Path

POINTS = 16
LONG, SHORT = 30.0, 23.5      # spike lengths on a 64 grid, from the centre
HALF_WIDTH = 2.6              # half the spike width where it meets the core
CORE = 5.2                    # core radius
C = 32.0                      # centre

PALETTES = {
    # lit half, shaded half, core inner, core outer
    "colour": ("#3fb3f0", "#14233a", "#5cc2f5", "#1f78c8"),
    "light": ("#2a8fd6", "#9fdcf7", "#ffffff", "#ffffff"),
    "white": ("#ffffff", "#ffffff", "#ffffff", "#ffffff"),
    "black": ("#10101a", "#10101a", "#10101a", "#10101a"),
}


def spikes(lit: str, shade: str, mono: bool, hw: float = 0, long_: float = 0, short: float = 0) -> str:
    hw, long_, short = hw or HALF_WIDTH, long_ or LONG, short or SHORT
    out = []
    for i in range(POINTS):
        a = math.radians(i * 360 / POINTS - 90)
        r = long_ if i % 2 == 0 else short
        tip = (C + r * math.cos(a), C + r * math.sin(a))
        nx, ny = -math.sin(a), math.cos(a)   # unit normal to the spike
        base_l = (C + hw * nx, C + hw * ny)
        base_r = (C - hw * nx, C - hw * ny)
        f = lambda p: f"{p[0]:.2f},{p[1]:.2f}"
        op = "" if not mono else ' fill-opacity="0.75"'
        out.append(f'<polygon points="{C},{C} {f(base_l)} {f(tip)}" fill="{lit}"/>')
        out.append(f'<polygon points="{C},{C} {f(tip)} {f(base_r)}" fill="{shade}"{op}/>')
    return "".join(out)


def mark(palette: str, gid: str = "core", bold: bool = False) -> str:
    lit, shade, c_in, c_out = PALETTES[palette]
    mono = palette in ("white", "black")
    core = (
        f'<defs><radialGradient id="{gid}" cx="45%" cy="40%" r="65%">'
        f'<stop offset="0" stop-color="{c_in}"/><stop offset="1" stop-color="{c_out}"/></radialGradient></defs>'
    )
    if bold:  # small sizes: wider, slightly shorter spikes and a bigger core
        return core + spikes(lit, shade, mono, hw=4.4, long_=30, short=26) + f'<circle cx="{C}" cy="{C}" r="8.5" fill="url(#{gid})"/>'
    return core + spikes(lit, shade, mono) + f'<circle cx="{C}" cy="{C}" r="{CORE}" fill="url(#{gid})"/>'


def svg(body: str, size: int = 64, w: int = 64, h: int = 64) -> str:
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{size if w == 64 else w}" height="{size if h == 64 else h}" '
            f'viewBox="0 0 {w} {h}" role="img" aria-label="Parity"><title>Parity</title>{body}</svg>\n')


def tile(bg: str, palette: str, border: str = "") -> str:
    inner = f'<g transform="translate(4 4) scale(.875)">{mark(palette, "core-" + palette)}</g>'
    edge = f'<rect x=".5" y=".5" width="63" height="63" rx="13.5" fill="none" stroke="{border}"/>' if border else ""
    return f"{bg}{edge}{inner}"


def build(out: Path) -> list[str]:
    out.mkdir(parents=True, exist_ok=True)
    gradient = ('<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="0">'
                '<stop offset="0" stop-color="#ccffde"/><stop offset="1" stop-color="#99bbff"/></linearGradient></defs>'
                '<rect width="64" height="64" rx="14" fill="url(#bg)"/>')
    files = {
        "parity-mark.svg": svg(mark("colour")),
        "parity-mark-light.svg": svg(mark("light")),
        "parity-mark-white.svg": svg(mark("white")),
        "parity-mark-black.svg": svg(mark("black")),
        "parity-icon-dark.svg": svg(tile('<rect width="64" height="64" rx="14" fill="#10101a"/>', "colour")),
        "parity-icon-light.svg": svg(tile('<rect width="64" height="64" rx="14" fill="#ffffff"/>', "colour", "#70739329")),
        "parity-icon-gradient.svg": svg(tile(gradient, "light")),
        "favicon.svg": svg(mark("colour", bold=True), size=32),
        "favicon-on-dark.svg": svg(mark("light", "core-fd", bold=True), size=32),
    }
    word = ('<text x="74" y="43" font-family="Inter, system-ui, -apple-system, Segoe UI, sans-serif" font-size="32" '
            'font-weight="500" letter-spacing="-0.5" fill="{c}">Parity</text>')
    for name, colour in (("parity-wordmark-on-dark.svg", "#fbfcfd"), ("parity-wordmark-on-light.svg", "#1e1e2a")):
        files[name] = svg(mark("colour", "core-w") + word.format(c=colour), w=200, h=64)
    for name, body in files.items():
        (out / name).write_text(body)
    return sorted(files)


if __name__ == "__main__":
    print("\n".join(build(Path(sys.argv[1] if len(sys.argv) > 1 else "web/public/brand/new"))))
