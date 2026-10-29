// Colour contrast of every text and control colour on every surface it can sit on
// (WCAG 2.2 AA, DEC-0061): 4.5:1 for text, 3:1 for the parts of a control and the focus
// ring. The surfaces include the worst case on the public pages: frosted glass over the
// brightest point of the red glow behind it. A token change that drops a pair below the
// bar fails here before anyone sees it.
import { describe, expect, it } from "vitest";
import { RAW } from "../src/ui/tokens.gen";

type RGBA = [number, number, number, number];

function parse(c: string): RGBA {
  const s = c.trim();
  const hex = s.match(/^#([0-9a-f]{6}|[0-9a-f]{3})$/i);
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].split("").map((x) => x + x).join("") : hex[1];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 1];
  }
  const fn = s.match(/^rgba?\(([^)]+)\)$/);
  if (fn) {
    const [r, g, b, a = "1"] = fn[1].split(/[\s,/]+/).filter(Boolean);
    return [Number(r), Number(g), Number(b), Number(a)];
  }
  throw new Error(`cannot read colour ${c}`);
}
const tok = (name: string) => parse((RAW as Record<string, string>)[name] ?? name);
/** Paint `top` over an opaque `under`. */
const over = (top: RGBA, under: RGBA): RGBA => {
  const a = top[3];
  return [top[0] * a + under[0] * (1 - a), top[1] * a + under[1] * (1 - a), top[2] * a + under[2] * (1 - a), 1];
};
const lum = ([r, g, b]: RGBA) => {
  const ch = (v: number) => {
    const x = v / 255;
    return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
};
const ratio = (fg: RGBA, bg: RGBA) => {
  const a = lum(over(fg, bg));
  const b = lum(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};

// The red glow at its brightest: the front page's orbs paint the glow colour at 55% and
// the orb at 50% opacity (27.5%); 35% leaves room for two orbs crossing.
const canvas = tok("color-canvas");
const glowPeak = over([...tok("color-glow").slice(0, 3), 0.35] as RGBA, canvas);
const BACKDROPS: Record<string, RGBA> = {
  canvas,
  bar: tok("color-bar"),
  surface: tok("color-surface"),
  "surface-raised": tok("color-surface-raised"),
  "surface-overlay": tok("color-surface-overlay"),
  "surface-inverted": tok("color-surface-inverted"),
  "the red glow at its peak": glowPeak,
  "glass over the glow": over(tok("color-glass"), glowPeak),
  "strong glass over the glow": over(tok("color-glass-strong"), glowPeak),
  "a field over the glow": over(tok("color-input"), glowPeak),
  "a hovered row on a raised card": over(tok("color-hover"), tok("color-surface-raised")),
  "a pressed control on a card": over(tok("color-pressed"), tok("color-surface")),
  "a selected row": over(tok("color-selected"), tok("color-surface")),
  "a table header row": tok("color-table-head"),
  "a hovered table row": over(tok("color-row-hover"), tok("color-surface")),
  "a hovered table row on the canvas": over(tok("color-row-hover"), canvas),
  "the accent badge": over(tok("color-accent-soft"), tok("color-surface")),
};

const TEXT = ["color-text", "color-text-body", "color-text-muted", "color-text-faint", "color-link", "color-accent-text", "color-table-head-text",
  "color-positive", "color-negative", "color-warning", "color-info"];
// The parts of a control that show what it is and what state it is in.
const CONTROL = ["color-focus", "color-accent", "color-border-control", "color-positive", "color-negative"];

describe("text on every surface is at least 4.5:1", () => {
  for (const t of TEXT) {
    for (const [where, bg] of Object.entries(BACKDROPS)) {
      it(`${t} on ${where}`, () => expect(ratio(tok(t), bg)).toBeGreaterThanOrEqual(4.5));
    }
  }
});

describe("control parts and the focus ring are at least 3:1", () => {
  for (const t of CONTROL) {
    for (const [where, bg] of Object.entries(BACKDROPS)) {
      it(`${t} on ${where}`, () => expect(ratio(tok(t), bg)).toBeGreaterThanOrEqual(3));
    }
  }
});

describe("text on filled buttons and badges is at least 4.5:1", () => {
  const pairs: [string, string, RGBA][] = [
    ["primary button", "color-on-primary", tok("color-primary")],
    ["primary button, hovered", "color-on-primary", tok("color-primary-hover")],
    ["accent button", "color-on-accent", tok("color-accent-hover")],
    ["green badge", "color-positive", over(tok("color-positive-soft"), tok("color-surface"))],
    ["coral badge", "color-negative", over(tok("color-negative-soft"), tok("color-surface"))],
    ["amber badge", "color-warning", over(tok("color-warning-soft"), tok("color-surface"))],
    ["blue badge", "color-info", over(tok("color-info-soft"), tok("color-surface"))],
    ["green badge on glass", "color-positive", over(tok("color-positive-soft"), BACKDROPS["glass over the glow"])],
    ["coral badge on glass", "color-negative", over(tok("color-negative-soft"), BACKDROPS["glass over the glow"])],
  ];
  for (const [what, fg, bg] of pairs) it(what, () => expect(ratio(tok(fg), bg)).toBeGreaterThanOrEqual(4.5));
});

describe("Parity Terminal's colours on its panels", () => {
  const panels = ["palette-black", "palette-term-0", "palette-term-1", "palette-term-2"].map(tok);
  const text = ["palette-paper", "palette-term-dim", "palette-term-faint", "palette-amber-400", "palette-cyan-400", "palette-term-down", "palette-green-400"];
  for (const t of text) {
    it(`${t} is at least 4.5:1 on every panel`, () => {
      for (const p of panels) expect(ratio(tok(t), p)).toBeGreaterThanOrEqual(4.5);
    });
  }
  it("the focus ring (amber) is at least 3:1 on every panel", () => {
    for (const p of panels) expect(ratio(tok("palette-amber-400"), p)).toBeGreaterThanOrEqual(3);
  });
});
