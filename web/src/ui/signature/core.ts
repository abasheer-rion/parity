// The small pieces every signature chart uses: maths, easing, number formats, SVG text and
// the frame context that turns a continuous position `s` into "which step, how far along".
//
// Position `s`: whole numbers are the finished step frames (0 is the first step). Fractions
// are the in-between frames of a move. From -1 to 0 the first step draws itself in, so a
// player can start from an empty chart; stills and reduced motion only ever use whole steps.
import { layout, THEMES, toneColor, viewport, type Layout, type SizeName, type Theme, type ThemeName, type Tone, type Viewport } from "./theme.ts";

export const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const r1 = (v: number) => Math.round(v * 10) / 10;
export const r2 = (v: number) => Math.round(v * 100) / 100;
export const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOut = (t: number) => 1 - Math.pow(1 - clamp(t), 3);

/** A seeded random number generator, so every visitor sees the same made-up paths. */
export function rng(seed: number) {
  let a = (seed * 2654435761) >>> 0 || 1;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const normal = () => Math.sqrt(-2 * Math.log(Math.max(next(), 1e-9))) * Math.cos(2 * Math.PI * next());
  return { next, normal };
}

/** A random walk of `n` steps with a drift and a bumpiness per step, starting at `start`. */
export function walk(n: number, drift: number, vol: number, seed: number, start = 100): number[] {
  const g = rng(seed);
  const out = [start];
  for (let i = 1; i < n; i++) out.push(out[i - 1] * Math.exp(drift - (vol * vol) / 2 + vol * g.normal()));
  return out;
}

// ------------------------------------------------------------------ number formats

export type Fmt = (v: number) => string;

function digits(a: number): string {
  if (a < 1e-9) return "0";
  if (a >= 1e6) return `${(a / 1e6).toFixed(a >= 1e7 ? 0 : 1)}m`;
  if (a >= 1000) return Math.round(a).toLocaleString("en-US");
  if (a >= 10) return a.toFixed(0);
  if (a >= 1) return a.toFixed(1);
  return a.toFixed(2);
}

/** Money: $1,745, -$12, $0.45. */
export const money: Fmt = (v) => `${v < 0 && Math.abs(v) >= 1e-9 ? "-" : ""}$${digits(Math.abs(v))}`;
/** Money with a sign: +$645, -$1,200. */
export const moneySigned: Fmt = (v) => `${v >= 0 ? "+" : "-"}$${digits(Math.abs(v))}`;
/** A share as a percent: 0.072 is 7.2%, -0.33 is -33%. */
export const pct = (dp = 0): Fmt => (v) => `${v < 0 && Math.abs(v * 100) >= 0.5 * Math.pow(10, -dp) ? "-" : ""}${Math.abs(v * 100).toFixed(dp)}%`;
export const pctSigned = (dp = 0): Fmt => (v) => `${v >= 0 ? "+" : "-"}${Math.abs(v * 100).toFixed(dp)}%`;
/** A plain number in its unit: 8%, 1.5x, 3.2. */
export const unit = (u = "", dp?: number): Fmt => (v) => {
  if (u === "$") return money(v);
  const a = Math.abs(v);
  const d = dp ?? (a >= 100 ? 0 : a >= 10 ? (Math.abs(v - Math.round(v)) < 0.05 ? 0 : 1) : a >= 1 ? 1 : 2);
  return `${v < 0 && a >= 0.5 * Math.pow(10, -d) ? "-" : ""}${a.toFixed(d)}${u}`;
};

/** Rounds a ticking number so it settles on its final value instead of flickering digits. */
export function ticker(from: number, to: number, t: number): number {
  return lerp(from, to, clamp(t));
}

// ------------------------------------------------------------------ SVG pieces

export interface TextOpts {
  size?: number; fill?: string; anchor?: "start" | "middle" | "end"; weight?: number; opacity?: number;
  /** A stroke in the background colour behind the letters, so text stays readable over lines. */
  halo?: boolean; track?: number; mono?: boolean; tabular?: boolean;
}

export function text(F: Frame, x: number, y: number, t: string, o: TextOpts = {}): string {
  if (o.opacity != null && o.opacity < 0.01) return "";
  const op = o.opacity != null && o.opacity < 0.995 ? ` opacity="${r2(clamp(o.opacity))}"` : "";
  const halo = o.halo === false ? "" : ` stroke="${F.th.halo}" stroke-width="${r1(3 * F.u)}" stroke-linejoin="round" paint-order="stroke"`;
  const track = o.track ? ` letter-spacing="${r2(o.track)}"` : "";
  const tab = o.tabular !== false ? ` style="font-variant-numeric:tabular-nums"` : "";
  return `<text x="${r1(x)}" y="${r1(y)}" font-size="${r1(o.size ?? 11 * F.u)}" fill="${o.fill ?? F.th.muted}" text-anchor="${o.anchor ?? "start"}"${o.weight ? ` font-weight="${o.weight}"` : ""}${track}${op}${halo}${tab} font-family="${o.mono ? F.th.mono : F.th.font}">${esc(t)}</text>`;
}

/** A rough width of a line of text, for placing labels (Inter averages about 0.56 em). */
export function textWidth(t: string, size: number, weight = 400): number {
  let w = 0;
  for (const ch of t) w += /[0-9$%+\-.,]/.test(ch) ? 0.58 : /[ il1|.,:;']/.test(ch) ? 0.3 : /[MW@m]/.test(ch) ? 0.85 : /[A-Z]/.test(ch) ? 0.66 : 0.54;
  return w * size * (weight >= 600 ? 1.05 : 1);
}

export function path(pts: [number, number][]): string {
  let d = "";
  for (let i = 0; i < pts.length; i++) d += `${i ? "L" : "M"}${r1(pts[i][0])} ${r1(pts[i][1])}`;
  return d;
}

export function rect(x: number, y: number, w: number, h: number, o: { fill?: string; rx?: number; opacity?: number; stroke?: string; sw?: number } = {}): string {
  if (w <= 0 || h <= 0) return "";
  return `<rect x="${r1(x)}" y="${r1(y)}" width="${r1(w)}" height="${r1(h)}"${o.rx ? ` rx="${r1(o.rx)}"` : ""} fill="${o.fill ?? "none"}"${o.stroke ? ` stroke="${o.stroke}" stroke-width="${r1(o.sw ?? 1)}"` : ""}${o.opacity != null && o.opacity < 0.995 ? ` opacity="${r2(clamp(o.opacity))}"` : ""}/>`;
}

export function line(x1: number, y1: number, x2: number, y2: number, o: { stroke: string; sw?: number; dash?: string; opacity?: number; cap?: string }): string {
  return `<line x1="${r1(x1)}" y1="${r1(y1)}" x2="${r1(x2)}" y2="${r1(y2)}" stroke="${o.stroke}" stroke-width="${r1(o.sw ?? 1)}"${o.dash ? ` stroke-dasharray="${o.dash}"` : ""}${o.cap ? ` stroke-linecap="${o.cap}"` : ""}${o.opacity != null && o.opacity < 0.995 ? ` opacity="${r2(clamp(o.opacity))}"` : ""}/>`;
}

export function circle(x: number, y: number, r: number, fill: string, opacity?: number): string {
  return `<circle cx="${r1(x)}" cy="${r1(y)}" r="${r1(r)}" fill="${fill}"${opacity != null && opacity < 0.995 ? ` opacity="${r2(clamp(opacity))}"` : ""}/>`;
}

export function group(inner: string, opacity: number): string {
  if (opacity < 0.01 || !inner) return "";
  return opacity >= 0.995 ? inner : `<g opacity="${r2(opacity)}">${inner}</g>`;
}

// ------------------------------------------------------------------ the frame

export interface FrameOptions {
  size?: SizeName | Viewport;
  theme?: ThemeName | Theme;
  /** Reserve room on the right of the plot for value pills (default true). */
  pills?: boolean;
  /** Reserve the head band for the big number (default true). */
  head?: boolean;
  xAxis?: boolean;
}

/** Everything a scene needs to draw one moment. */
export interface Frame {
  /** The position, from -1 (empty, before the first step) to the last step. */
  s: number;
  last: number;
  /** The step being left (floor) and the step being reached (ceil). */
  i: number;
  j: number;
  /** How far along the move from i to j: raw, eased in and out, and eased out (for cameras). */
  f: number;
  e: number;
  eo: number;
  /** The step whose words and labels show now (the nearer one). */
  k: number;
  vp: Viewport;
  th: Theme;
  u: number;
  L: Layout;
  w: number;
  h: number;
  color: (t: Tone | undefined) => string;
}

export function frame(s: number, last: number, o: FrameOptions = {}): Frame {
  const vp = viewport(o.size);
  const th = typeof o.theme === "object" ? o.theme : THEMES[o.theme ?? "dark"];
  const sc = clamp(Number.isFinite(s) ? s : 0, -1, Math.max(0, last));
  const i = Math.floor(sc), j = Math.min(Math.ceil(sc), last);
  const f = sc - i;
  return {
    s: sc, last, i, j, f, e: easeInOut(f), eo: easeOut(f), k: Math.round(sc),
    vp, th, u: vp.u, w: vp.w, h: vp.h, L: layout(vp, o),
    color: (t) => toneColor(th, t),
  };
}

// ------------------------------------------------------------------ step settings

export type StepData = Record<string, unknown>;

export function num(v: unknown, d: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : d;
}

export function nums(v: unknown): number[] | undefined {
  return Array.isArray(v) && v.length > 0 && v.every((x) => typeof x === "number" && Number.isFinite(x)) ? (v as number[]) : undefined;
}

/** A step setting as of step i: carried forward from the last step that set it. */
export function valueAt(steps: StepData[], i: number, key: string): unknown {
  for (let k = Math.min(i, steps.length - 1); k >= 0; k--) if (steps[k][key] !== undefined) return steps[k][key];
  return undefined;
}

/**
 * A number setting at the frame's position, eased between the two steps around it. Before
 * the first step (s below 0) it moves from `intro` (default: the first step's value).
 */
export function track(F: Frame, steps: StepData[], key: string, d: number, intro?: number): number {
  const b = num(valueAt(steps, Math.max(0, F.j), key), d);
  const a = F.i < 0 ? intro ?? num(valueAt(steps, 0, key), d) : num(valueAt(steps, F.i, key), d);
  return lerp(a, b, F.e);
}

/** A list-of-numbers setting, eased item by item. */
export function trackArr(F: Frame, steps: StepData[], key: string, d: number[]): number[] {
  const b = nums(valueAt(steps, Math.max(0, F.j), key)) ?? d;
  const a = F.i < 0 ? b : nums(valueAt(steps, F.i, key)) ?? b;
  return b.map((v, k) => lerp(a[k] ?? v, v, F.e));
}

/** A text setting for the step that shows now. */
export function word(F: Frame, steps: StepData[], key: string): string {
  const v = valueAt(steps, Math.max(0, F.k), key);
  return typeof v === "string" ? v : "";
}

/**
 * How visible something is that first appears at step `k`: 0 before, 1 from step k on,
 * fading in over the last part of the move into step k (from `start`, 0 to 1, of that move).
 */
export function appear(F: Frame, k: number, start = 0.55): number {
  if (F.s >= k) return 1;
  if (F.s <= k - 1) return 0;
  return easeOut((F.s - (k - 1) - start) / Math.max(0.05, 1 - start));
}

/** Visible only around step k: fades in on the way to it and out on the way past it. */
export function around(F: Frame, k: number): number {
  return clamp(1 - Math.abs(F.s - k) * 1.6);
}

/** Crossfade weight for the step that shows now (1 at whole steps, dipping mid-move). */
export function settle(F: Frame): number {
  return clamp(Math.abs(F.s - F.k) < 1e-6 ? 1 : 1 - Math.sin(Math.PI * F.f) * 0.85);
}

/**
 * Fewer points for long lines, so a frame stays cheap: fixed buckets in data order, each
 * keeping its lowest and highest point, so the shape does not shimmer as a line grows.
 */
export function decimate(pts: [number, number][], max = 240): [number, number][] {
  if (pts.length <= max) return pts;
  const size = Math.ceil(pts.length / (max / 2));
  const out: [number, number][] = [pts[0]];
  for (let b = 1; b < pts.length - 1; b += size) {
    let lo = b, hi = b;
    const end = Math.min(pts.length - 1, b + size);
    for (let i = b; i < end; i++) { if (pts[i][1] < pts[lo][1]) lo = i; if (pts[i][1] > pts[hi][1]) hi = i; }
    if (lo === hi) out.push(pts[lo]);
    else if (lo < hi) out.push(pts[lo], pts[hi]);
    else out.push(pts[hi], pts[lo]);
  }
  out.push(pts[pts.length - 1]);
  return out;
}
