// Parity's signature chart look: colours, sizes and layout boxes. Plain values from the
// generated tokens, because these charts are SVG strings that are also drawn at build time
// (public lesson pages) and in Node (the clip renderer), where no CSS variables exist.
//
// Colour is semantic only. Gains are positive green, losses negative red, one accent picks
// out the thing being taught, and everything else is a neutral grey from the tokens.
//
// Node can load this file with `node --experimental-strip-types`: one import with its .ts
// extension, and only type syntax that can be stripped.
import { RAW } from "../tokens.gen.ts";

export type ThemeName = "dark" | "light";
export type Tone = "pos" | "neg" | "accent" | "warn" | "alt" | "text" | "muted" | "faint";

export interface Theme {
  name: ThemeName;
  /** Clip background and the lighter middle of its vignette. Lesson frames are transparent. */
  bg: string;
  bgGlow: string;
  /** Card fill behind pills, verdicts and labels, and the halo stroke behind text. */
  panel: string;
  halo: string;
  /** Strong text (the big number), body text, secondary, faint. */
  ink: string;
  text: string;
  muted: string;
  faint: string;
  /** Grid lines are drawn in `grid` at `gridOpacity`, so one value works on any background. */
  grid: string;
  gridOpacity: number;
  /** The dashed par line (benchmark or zero). */
  par: string;
  pos: string;
  neg: string;
  accent: string;
  warn: string;
  /** A second hue for two-sided scales (negative correlation). Not good or bad. */
  alt: string;
  /** Text drawn on a filled pill of each tone. */
  onFill: string;
  font: string;
  mono: string;
}

const font = (v: string) => v.replace(/"/g, "'");

export const THEMES: Record<ThemeName, Theme> = {
  dark: {
    name: "dark",
    bg: RAW["color-canvas"], bgGlow: RAW["color-surface"], panel: RAW["color-surface-overlay"], halo: RAW["color-surface"],
    ink: RAW["color-text"], text: RAW["color-text-body"], muted: RAW["color-text-muted"], faint: RAW["color-text-faint"],
    grid: RAW["palette-white"], gridOpacity: 0.08, par: RAW["color-benchmark"],
    pos: RAW["color-positive"], neg: RAW["color-negative"], accent: RAW["palette-cyan-400"], warn: RAW["color-warning"], alt: RAW["palette-violet-400"],
    onFill: RAW["palette-ink-0"], font: font(RAW["font-text"]), mono: font(RAW["font-mono"]),
  },
  light: {
    name: "light",
    bg: RAW["palette-grey-100"], bgGlow: RAW["palette-white"], panel: RAW["palette-white"], halo: RAW["palette-grey-100"],
    ink: RAW["palette-ink-1"], text: RAW["palette-ink-5"], muted: RAW["palette-grey-500"], faint: RAW["palette-grey-500"],
    grid: RAW["palette-ink-0"], gridOpacity: 0.1, par: RAW["palette-grey-500"],
    pos: RAW["series-6"], neg: RAW["palette-red-600"], accent: RAW["palette-blue-500"], warn: RAW["palette-amber-600"], alt: RAW["palette-violet-400"],
    onFill: RAW["palette-white"], font: font(RAW["font-text"]), mono: font(RAW["font-mono"]),
  },
};

export function toneColor(th: Theme, t: Tone | undefined): string {
  switch (t) {
    case "pos": return th.pos;
    case "neg": return th.neg;
    case "accent": return th.accent;
    case "warn": return th.warn;
    case "alt": return th.alt;
    case "muted": return th.muted;
    case "faint": return th.faint;
    default: return th.text;
  }
}

/** A named canvas size. `u` scales every text size, stroke and gap, so 1 is the lesson size. */
export interface Viewport { name: string; w: number; h: number; u: number }

export type SizeName = "lesson" | "compact" | "square" | "vertical";

export const SIZES: Record<SizeName, Viewport> = {
  // The Academy lesson picture, 16:9 (the public pages draw this size too).
  lesson: { name: "lesson", w: 480, h: 270, u: 1 },
  // Phones: a taller box drawn close to one unit per screen pixel, so the text stays readable.
  compact: { name: "compact", w: 360, h: 300, u: 1 },
  // Clips (web/scripts/content): 1:1 and 9:16.
  square: { name: "square", w: 1080, h: 1080, u: 2.4 },
  vertical: { name: "vertical", w: 1080, h: 1920, u: 2.6 },
};

export function viewport(size: SizeName | Viewport | undefined): Viewport {
  if (!size) return SIZES.lesson;
  return typeof size === "string" ? SIZES[size] ?? SIZES.lesson : size;
}

export interface Box { x0: number; y0: number; x1: number; y1: number }

export interface Layout {
  /** The big number and its label. */
  head: Box;
  /** The chart itself. Lines end at plot.x1; value pills ride to the right of it, inside `right`. */
  plot: Box;
  /** Room on the right of the plot for the value pills at the line tips. */
  right: number;
  /** Where burned-in captions go on clips (empty on lessons, where the page shows captions). */
  foot: Box;
  /** A band of its own for the verdict card (9:16 clips only; elsewhere it shares the head or plot). */
  verdict?: Box;
}

/** The boxes for a canvas. `pills` reserves room on the right for value pills. */
export function layout(vp: Viewport, o: { pills?: boolean; head?: boolean; xAxis?: boolean } = {}): Layout {
  const { w, h, u } = vp;
  const pad = 16 * u;
  const right = o.pills === false ? 0 : 62 * u;
  const xAxis = o.xAxis === false ? 0 : 18 * u;
  if (h > w * 1.4) {
    // 9:16 clip: the number in the top quarter, the chart in the middle, captions below.
    const head: Box = { x0: pad * 2, y0: h * 0.09, x1: w - pad * 2, y1: h * 0.22 };
    const plot: Box = { x0: pad * 2, y0: h * 0.25, x1: w - pad * 2 - right, y1: h * 0.63 - xAxis };
    const verdict: Box = { x0: pad * 2, y0: h * 0.655, x1: w - pad * 2, y1: h * 0.76 };
    return { head, plot, right, verdict, foot: { x0: pad * 2, y0: h * 0.79, x1: w - pad * 2, y1: h * 0.93 } };
  }
  if (h >= w * 0.8) {
    // Square clip or the phone box: a taller head band and a chart below it.
    const clip = w > 600;
    const headH = o.head === false ? 0 : (clip ? 0.2 : 0.22) * h;
    const head: Box = { x0: pad, y0: pad * (clip ? 2 : 0.6), x1: w - pad, y1: pad * (clip ? 2 : 0.6) + headH };
    const footH = clip ? h * 0.14 : 0;
    const plot: Box = { x0: pad, y0: head.y1 + 10 * u, x1: w - pad - right, y1: h - pad * 0.8 - xAxis - footH };
    return { head, plot, right, foot: { x0: pad, y0: h - footH - pad, x1: w - pad, y1: h - pad } };
  }
  // 16:9 lesson.
  const headH = o.head === false ? 0 : 58 * u;
  const head: Box = { x0: pad, y0: 8 * u, x1: w - pad, y1: 8 * u + headH };
  const plot: Box = { x0: pad, y0: head.y1 + 8 * u, x1: w - pad - right, y1: h - 8 * u - xAxis };
  return { head, plot, right, foot: { x0: pad, y0: h, x1: w - pad, y1: h } };
}
