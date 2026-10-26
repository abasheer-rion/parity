// Parity Academy's moving pictures (DEC-0028). Every visual is a pure function of the
// lesson's settings and a position `s` between 0 and the last step: whole numbers are
// the step frames, fractions are the in-between frames of a move. The app tweens `s`
// to animate; the public pages draw the last frame as a still picture at build time
// (web/scripts/academy-frames.ts, run by scripts/seo/build_public.py).
//
// One import (the generated token values, with its .ts extension) and only type syntax
// Node can strip, so the build script can load this file with
// `node --experimental-strip-types`. Output is SVG markup for a 480 x 270 box. Colours
// are plain values from the tokens because the public pages draw these at build time.

import { RAW } from "../ui/tokens.gen.ts";

export interface Step { caption: string; [key: string]: unknown }
export interface Visual { kind: string; alt: string; params?: Record<string, unknown>; steps: Step[] }

export const W = 480;
export const H = 270;

// Plain colour values from the tokens: these pictures are SVG strings, drawn on the page and
// rendered to frames at build time, so they cannot read CSS variables.
const C = {
  blue: RAW["palette-blue-300"], deep: RAW["palette-blue-500"], good: RAW["color-positive"], bad: RAW["color-negative"], warn: RAW["color-warning"],
  text: RAW["color-text"], muted: RAW["color-text-muted"], faint: RAW["color-text-faint"], grid: RAW["color-border-strong"], panel: RAW["color-surface-raised"],
};
const PALETTE = [C.blue, C.good, C.warn, C.bad, RAW["palette-violet-400"], RAW["palette-cyan-400"]];

// ------------------------------------------------------------------ small helpers

const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const r1 = (v: number) => Math.round(v * 10) / 10;
const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** A seeded random number generator, so every visitor sees the same paths. */
function rng(seed: number) {
  let a = (seed * 2654435761) >>> 0 || 1;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const normal = () => {
    const u = Math.max(next(), 1e-9);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * next());
  };
  return { next, normal };
}

/** A random walk of `n` steps with a drift and a bumpiness per step, starting at `start`. */
function walk(n: number, drift: number, vol: number, seed: number, start = 100): number[] {
  const g = rng(seed);
  const out = [start];
  for (let i = 1; i < n; i++) out.push(out[i - 1] * Math.exp(drift - (vol * vol) / 2 + vol * g.normal()));
  return out;
}

function num(v: unknown, d: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : d;
}

function arr(v: unknown): number[] | undefined {
  return Array.isArray(v) && v.every((x) => typeof x === "number") ? (v as number[]) : undefined;
}

/** The value of a step setting at position s: carried forward from the last step that set it. */
function valueAt(steps: Step[], i: number, key: string): unknown {
  for (let k = Math.min(i, steps.length - 1); k >= 0; k--) if (steps[k][key] !== undefined) return steps[k][key];
  return undefined;
}

/** A number setting, eased between the two steps around s. */
function at(steps: Step[], s: number, key: string, d: number): number {
  const i = Math.floor(s), j = Math.min(Math.ceil(s), steps.length - 1);
  return lerp(num(valueAt(steps, i, key), d), num(valueAt(steps, j, key), d), s - i);
}

/** A list-of-numbers setting, eased item by item between the two steps around s. */
function atArr(steps: Step[], s: number, key: string, d: number[]): number[] {
  const i = Math.floor(s), j = Math.min(Math.ceil(s), steps.length - 1);
  const a = arr(valueAt(steps, i, key)) ?? d, b = arr(valueAt(steps, j, key)) ?? a;
  return a.map((v, k) => lerp(v, b[k] ?? v, s - i));
}

function str(steps: Step[], s: number, key: string): string {
  const v = valueAt(steps, Math.round(s), key);
  return typeof v === "string" ? v : "";
}

interface Box { x0: number; x1: number; y0: number; y1: number }
const PLOT: Box = { x0: 52, x1: 462, y0: 22, y1: 236 };

function scale(d0: number, d1: number, r0: number, r1: number) {
  const k = d1 === d0 ? 0 : (r1 - r0) / (d1 - d0);
  return (v: number) => r0 + (v - d0) * k;
}

function line(pts: [number, number][]): string {
  return pts.map(([x, y], i) => `${i ? "L" : "M"}${r1(x)} ${r1(y)}`).join("");
}

function text(x: number, y: number, t: string, o: { size?: number; fill?: string; anchor?: string; weight?: number; opacity?: number } = {}): string {
  const op = o.opacity != null ? ` opacity="${r1(clamp(o.opacity) * 100) / 100}"` : "";
  // A dark halo behind each label keeps it readable where a line or band passes under it (WCAG 1.4.3).
  return `<text x="${r1(x)}" y="${r1(y)}" font-size="${o.size ?? 13}" fill="${o.fill ?? C.muted}" text-anchor="${o.anchor ?? "start"}"${o.weight ? ` font-weight="${o.weight}"` : ""}${op} stroke="${C.panel}" stroke-width="3" stroke-linejoin="round" paint-order="stroke" font-family="Inter,system-ui,sans-serif">${esc(t)}</text>`;
}

function niceTicks(lo: number, hi: number, count = 4): number[] {
  const span = hi - lo || 1;
  const raw = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((m) => span / m <= count + 0.5) ?? raw;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(Math.round(v / step) * step);
  return out;
}

function fmt(v: number, unit = ""): string {
  const a = Math.abs(v);
  const s = a < 1e-9 ? "0" : a >= 1000 ? Math.round(a).toLocaleString("en-US") : a >= 10 ? a.toFixed(0) : a >= 1 ? a.toFixed(1) : a.toFixed(2);
  const sign = v < 0 && a >= 1e-9 ? "-" : "";
  return unit === "$" ? `${sign}$${s}` : `${sign}${s}${unit}`;
}

/** Moves labels apart vertically so each is at least `gap` from the next, keeping their order
 *  and staying between `top` and `bottom`. Used for line-end labels that start bunched. */
export function spreadLabels<T extends { y: number }>(items: T[], gap: number, top: number, bottom: number): T[] {
  const out = items.map((it) => ({ ...it })).sort((a, b) => a.y - b.y);
  for (let i = 0; i < out.length; i++) out[i].y = Math.max(out[i].y, i ? out[i - 1].y + gap : top);
  // If the stack ran past the bottom, push it back up as a block.
  const over = out.length ? out[out.length - 1].y - bottom : 0;
  if (over > 0) for (let i = out.length - 1; i >= 0; i--) out[i].y = Math.max(top + i * gap, Math.min(out[i].y - over, i < out.length - 1 ? out[i + 1].y - gap : bottom));
  return out;
}

/** Horizontal grid lines with labels on the left, and a baseline. */
function yAxis(lo: number, hi: number, y: (v: number) => number, unit = "", box = PLOT): string {
  return niceTicks(lo, hi).map((v) =>
    `<line x1="${box.x0}" x2="${box.x1}" y1="${r1(y(v))}" y2="${r1(y(v))}" stroke="${C.grid}"/>` +
    text(box.x0 - 8, y(v) + 4, fmt(v, unit), { size: 11, anchor: "end", fill: C.muted })).join("");
}

function xLabels(labels: string[], box = PLOT): string {
  if (!labels.length) return "";
  const x = scale(0, labels.length - 1, box.x0, box.x1);
  return labels.map((l, i) => text(x(i), box.y1 + 20, l, { size: 11, fill: C.muted, anchor: i === 0 ? "start" : i === labels.length - 1 ? "end" : "middle" })).join("");
}

function dot(x: number, y: number, fill: string, r = 4): string {
  return `<circle cx="${r1(x)}" cy="${r1(y)}" r="${r}" fill="${fill}"/>`;
}

function poly(pts: [number, number][], stroke: string, o: { width?: number; opacity?: number; dash?: string } = {}): string {
  if (pts.length < 2) return "";
  return `<path d="${line(pts)}" fill="none" stroke="${stroke}" stroke-width="${o.width ?? 2}" stroke-linejoin="round" stroke-linecap="round"${o.opacity != null ? ` opacity="${r1(o.opacity * 100) / 100}"` : ""}${o.dash ? ` stroke-dasharray="${o.dash}"` : ""}/>`;
}

function revealed(n: number, frac: number): number {
  return Math.max(2, Math.round(clamp(frac) * (n - 1)) + 1);
}

// ------------------------------------------------------------------ the kinds

type P = Record<string, unknown>;
type Render = (p: P, steps: Step[], s: number) => string;

/** Money growing at several rates per year, drawn left to right. */
const growth: Render = (p, steps, s) => {
  const years = num(p.years, 30), start = num(p.start, 100);
  const series = (p.series as { label: string; rate: number; vol?: number; seed?: number }[]) ?? [];
  const reveal = at(steps, s, "reveal", 1);
  const n = years * 12 + 1;
  const curves = series.map((c, k) => {
    const vol = num(c.vol, 0) / Math.sqrt(12);
    const g = rng(num(c.seed, k + 1));
    const pts = [start];
    for (let i = 1; i < n; i++) pts.push(pts[i - 1] * Math.exp(Math.log(1 + c.rate) / 12 + vol * g.normal()));
    return pts;
  });
  const hi = Math.max(...curves.flat(), start) * 1.05;
  const x = scale(0, n - 1, PLOT.x0, PLOT.x1), y = scale(0, hi, PLOT.y1, PLOT.y0);
  const m = revealed(n, reveal);
  let out = yAxis(0, hi, y, "$") + xLabels(["Year 0", `Year ${Math.round(years / 2)}`, `Year ${years}`]);
  const ends: { k: number; x: number; y: number; col: string }[] = [];
  curves.forEach((c, k) => {
    const col = PALETTE[k % PALETTE.length];
    const pts = c.slice(0, m).map((v, i) => [x(i), y(v)] as [number, number]);
    out += poly(pts, col, { width: 2.5 });
    const last = pts[pts.length - 1];
    out += dot(last[0], last[1], col);
    ends.push({ k, x: Math.min(last[0], PLOT.x1 - 4) - 6, y: last[1] - 8, col });
  });
  // End labels never sit on top of each other: early on the lines start together, so the
  // labels are spread to at least one line of text apart, top to bottom.
  for (const e of spreadLabels(ends, 15, PLOT.y0 + 12, PLOT.y1 - 4)) {
    const label = `${series[e.k].label}: ${fmt(curves[e.k][m - 1], "$")}`;
    // Early on the lines are short: a label ending at the line would run into the axis
    // labels on the left, so it goes to the right of the line's end instead.
    const left = e.x - label.length * 7.2 < PLOT.x0 + 4;
    out += text(left ? e.x + 14 : e.x, e.y, label, { anchor: left ? "start" : "end", fill: e.col, size: 12, weight: 600 });
  }
  return out;
};

/** Random paths: one or a few named ones, or a fan of many, with the best one picked out. */
const paths: Render = (p, steps, s) => {
  const days = num(p.days, 250);
  const named = p.series as { label?: string; drift: number; vol: number; seed?: number }[] | undefined;
  const count = named ? named.length : num(p.n, 40);
  const shown = named ? count : Math.max(1, Math.round(at(steps, s, "n", count)));
  const reveal = at(steps, s, "reveal", 1);
  const best = at(steps, s, "best", 0), band = at(steps, s, "band", 0);
  const all = Array.from({ length: count }, (_, k) => named
    ? walk(days, named[k].drift, named[k].vol, num(named[k].seed, k + 3))
    : walk(days, num(p.drift, 0), num(p.vol, 0.012), k + num(p.seed, 7)));
  const vis = all.slice(0, shown);
  const flat = (named ? all : vis).flat();
  const lo = Math.min(...flat, 100) * 0.97, hi = Math.max(...flat, 100) * 1.03;
  const x = scale(0, days - 1, PLOT.x0, PLOT.x1), y = scale(lo, hi, PLOT.y1, PLOT.y0);
  const m = revealed(days, reveal);
  let out = yAxis(lo, hi, y, "$") + xLabels(p.xLabels as string[] ?? ["Start", "End"]);
  if (band > 0.01) {
    const vol = num(p.vol, named ? named[0].vol : 0.012), drift = num(p.drift, named ? named[0].drift : 0);
    const up: [number, number][] = [], dn: [number, number][] = [];
    for (let i = 0; i < m; i++) {
      up.push([x(i), y(100 * Math.exp(drift * i + 1.645 * vol * Math.sqrt(i)))]);
      dn.push([x(i), y(100 * Math.exp(drift * i - 1.645 * vol * Math.sqrt(i)))]);
    }
    out += `<path d="${line([...up, ...dn.reverse()])}Z" fill="${C.blue}" opacity="${r1(0.12 * band * 100) / 100}"/>`;
  }
  let bi = 0;
  vis.forEach((w, k) => { if (w[m - 1] > vis[bi][m - 1]) bi = k; });
  const show = named ? atArr(steps, s, "show", named.map(() => 1)) : [];
  vis.forEach((w, k) => {
    const isBest = k === bi && best > 0.01;
    const col = named ? PALETTE[k % PALETTE.length] : isBest ? C.warn : C.blue;
    const op = named ? clamp(show[k] ?? 1) : isBest ? 1 : lerp(count > 12 ? 0.35 : 0.7, 0.18, best);
    if (op < 0.02) return;
    out += poly(w.slice(0, m).map((v, i) => [x(i), y(v)]), col, { width: named || isBest ? 2.2 : 1.2, opacity: op });
    if (named && named[k].label) out += text(x(m - 1) - 4, y(w[m - 1]) - 8, named[k].label!, { anchor: "end", fill: col, size: 12, weight: 600, opacity: op });
  });
  if (best > 0.01 && !named) {
    const w = vis[bi];
    out += dot(x(m - 1), y(w[m - 1]), C.warn);
    out += text(x(m - 1) - 8, y(w[m - 1]) - 10, str(steps, s, "bestLabel") || "Best by luck", { anchor: "end", fill: C.warn, size: 12, weight: 600 });
  }
  out += `<line x1="${PLOT.x0}" x2="${PLOT.x1}" y1="${r1(y(100))}" y2="${r1(y(100))}" stroke="${C.faint}" stroke-dasharray="3 4" opacity=".6"/>`;
  return out;
};

/** An account value with its running peak, and the fall from the peak filling below. */
const drawdown: Render = (p, steps, s) => {
  const days = num(p.days, 300);
  const base = walk(days, num(p.drift, 0.0009), num(p.vol, 0.009), num(p.seed, 11));
  const at0 = num(p.crashAt, 0.4), depth = num(p.crashDepth, 0.35), back = num(p.recover, 0.35);
  const eq = base.map((v, i) => {
    const t = i / (days - 1);
    const fall = t < at0 ? 0 : t < at0 + 0.08 ? (t - at0) / 0.08 : Math.max(0, 1 - (t - at0 - 0.08) / back);
    return v * (1 - depth * fall);
  });
  const peak: number[] = [];
  eq.forEach((v, i) => peak.push(Math.max(v, peak[i - 1] ?? v)));
  const dd = eq.map((v, i) => v / peak[i] - 1);
  const reveal = at(steps, s, "reveal", 1), showPeak = at(steps, s, "peak", 0), fill = at(steps, s, "fill", 0), mark = at(steps, s, "mark", 0);
  const m = revealed(days, reveal);
  const top: Box = { x0: 52, x1: 462, y0: 18, y1: 150 }, bot: Box = { x0: 52, x1: 462, y0: 170, y1: 240 };
  const x = scale(0, days - 1, top.x0, top.x1);
  const lo = Math.min(...eq) * 0.95, hi = Math.max(...eq) * 1.05;
  const y = scale(lo, hi, top.y1, top.y0);
  const minDD = Math.min(...dd);
  const yd = scale(Math.min(-0.05, minDD * 1.1), 0, bot.y1, bot.y0);
  let out = yAxis(lo, hi, y, "$", top);
  out += text(top.x0, top.y0 - 4, "Account value", { size: 11, fill: C.muted });
  out += `<line x1="${bot.x0}" x2="${bot.x1}" y1="${bot.y0}" y2="${bot.y0}" stroke="${C.faint}" opacity=".5"/>` + text(bot.x0 - 8, bot.y0 + 4, "0%", { size: 11, anchor: "end", fill: C.muted });
  out += text(bot.x0 - 8, yd(minDD) + 4, `${Math.round(minDD * 100)}%`, { size: 11, anchor: "end", fill: C.muted });
  out += text(bot.x0, bot.y1 + 22, "Fall from the highest point so far", { size: 11, fill: C.muted });
  if (showPeak > 0.01) out += poly(peak.slice(0, m).map((v, i) => [x(i), y(v)]), C.good, { width: 1.4, opacity: showPeak, dash: "4 4" });
  out += poly(eq.slice(0, m).map((v, i) => [x(i), y(v)]), C.blue, { width: 2.2 });
  if (fill > 0.01) {
    const pts = dd.slice(0, m).map((v, i) => [x(i), yd(v * fill)] as [number, number]);
    out += `<path d="${line([[x(0), bot.y0], ...pts, [x(m - 1), bot.y0]])}Z" fill="${C.bad}" opacity=".45"/>` + poly(pts, C.bad, { width: 1.4 });
  }
  if (mark > 0.01) {
    const i = dd.indexOf(minDD);
    if (i < m) {
      out += dot(x(i), yd(minDD * fill), C.bad) + dot(x(i), y(eq[i]), C.bad);
      out += text(x(i) + 8, yd(minDD * fill) + 4, `Max drawdown ${Math.round(minDD * 100)}%`, { fill: C.bad, size: 12, weight: 600 });
      const need = 1 / (1 + minDD) - 1;
      out += text(x(i) + 8, y(eq[i]) + 18, `Needs +${Math.round(need * 100)}% to get back`, { fill: C.text, size: 12, opacity: mark });
    }
  }
  return out;
};

/** The same strategy before and after trading costs, as the cost per trade rises. */
const costs: Render = (p, steps, s) => {
  const years = num(p.years, 10), gross = num(p.gross, 0.08), turnover = num(p.turnover, 20);
  const cost = at(steps, s, "cost", 0);
  const n = years * 12 + 1;
  const g = rng(num(p.seed, 5));
  const noise = Array.from({ length: n }, () => g.normal() * 0.025);
  const curve = (rate: number) => { const out = [100]; for (let i = 1; i < n; i++) out.push(out[i - 1] * (1 + rate / 12 + noise[i])); return out; };
  const net = gross - (turnover * cost) / 10000;
  const a = curve(gross), b = curve(net);
  const hi = Math.max(...a, ...curve(gross)) * 1.05, lo = Math.min(...curve(gross - (turnover * 40) / 10000), 60) * 0.95;
  const x = scale(0, n - 1, PLOT.x0, PLOT.x1), y = scale(lo, hi, PLOT.y1, PLOT.y0);
  let out = yAxis(lo, hi, y, "$") + xLabels(["Year 0", `Year ${years}`]);
  out += poly(a.map((v, i) => [x(i), y(v)]), C.faint, { width: 1.6, dash: "5 4" });
  out += text(PLOT.x1 - 4, y(a[n - 1]) - 8, `Before costs: ${fmt(a[n - 1], "$")}`, { anchor: "end", fill: C.muted, size: 12 });
  const col = net > 0.005 ? C.good : net > -0.005 ? C.warn : C.bad;
  out += poly(b.map((v, i) => [x(i), y(v)]), col, { width: 2.5 });
  out += text(PLOT.x1 - 4, y(b[n - 1]) + 18, `After costs: ${fmt(b[n - 1], "$")}`, { anchor: "end", fill: col, size: 12, weight: 600 });
  out += text(PLOT.x0 + 6, PLOT.y0 + 6, `Cost per trade: ${cost.toFixed(1)} basis points`, { fill: C.text, size: 12, weight: 600 });
  out += text(PLOT.x0 + 6, PLOT.y0 + 24, `Trades its whole size ${turnover} times a year`, { fill: C.muted, size: 11 });
  return out;
};

/** The best Sharpe ratio among many strategies that have no skill at all. */
const maxof: Render = (p, steps, s) => {
  const years = num(p.years, 10), sd = num(p.sd, 1 / Math.sqrt(years));
  const total = num(p.max, 1000);
  // Eased on a log scale, so going from 10 to 1,000 tries looks even.
  const i0 = Math.floor(s), j0 = Math.min(Math.ceil(s), steps.length - 1);
  const na = Math.max(1, num(valueAt(steps, i0, "n"), 1)), nb = Math.max(1, num(valueAt(steps, j0, "n"), na));
  const n = Math.max(1, Math.round(Math.exp(lerp(Math.log(na), Math.log(nb), s - i0))));
  const hurdle = at(steps, s, "hurdle", 0);
  const g = rng(num(p.seed, 3));
  const all = Array.from({ length: total }, () => g.normal() * sd);
  const vis = all.slice(0, Math.min(n, total));
  const range = num(p.range, 1.5);
  const bins = 30, lo = -range, hi = range, bw = (hi - lo) / bins;
  const counts = new Array(bins).fill(0);
  vis.forEach((v) => { counts[clamp(Math.floor((v - lo) / bw), 0, bins - 1)]++; });
  const top = Math.max(4, ...counts);
  const x = scale(lo, hi, PLOT.x0, PLOT.x1), y = scale(0, top * 1.15, PLOT.y1, PLOT.y0 + 20);
  let out = `<line x1="${PLOT.x0}" x2="${PLOT.x1}" y1="${PLOT.y1}" y2="${PLOT.y1}" stroke="${C.faint}" opacity=".6"/>`;
  [-1, -0.5, 0, 0.5, 1].forEach((f) => { const v = f * range * (2 / 3); out += text(x(v), PLOT.y1 + 18, v.toFixed(1), { size: 11, anchor: "middle", fill: C.muted }); });
  out += text(PLOT.x1, PLOT.y1 + 32, (p.xLabel as string) ?? "Sharpe ratio", { size: 11, anchor: "end", fill: C.muted });
  counts.forEach((c, i) => {
    if (!c) return;
    out += `<rect x="${r1(x(lo + i * bw) + 1)}" y="${r1(y(c))}" width="${r1(x(lo + bw) - x(lo) - 2)}" height="${r1(PLOT.y1 - y(c))}" rx="2" fill="${C.blue}" opacity=".55"/>`;
  });
  const mx = Math.max(...vis);
  out += `<line x1="${r1(x(mx))}" x2="${r1(x(mx))}" y1="${PLOT.y0 + 26}" y2="${PLOT.y1}" stroke="${C.warn}" stroke-width="2"/>`;
  out += text(clamp(x(mx), PLOT.x0 + 60, PLOT.x1 - 60), PLOT.y0 + 18, `Best of ${n.toLocaleString("en-US")}: ${mx.toFixed(2)}`, { anchor: "middle", fill: C.warn, size: 13, weight: 600 });
  if (hurdle > 0.01) {
    // Expected best of n unskilled tries, about sd * sqrt(2 ln n) (an approximation).
    const h = sd * Math.sqrt(2 * Math.log(Math.max(n, 2)));
    out += `<line x1="${r1(x(h))}" x2="${r1(x(h))}" y1="${PLOT.y0 + 40}" y2="${PLOT.y1}" stroke="${C.bad}" stroke-width="2" stroke-dasharray="5 4" opacity="${r1(hurdle * 100) / 100}"/>`;
    out += text(x(h) - 6, PLOT.y0 + 52, `Luck alone reaches about ${h.toFixed(2)}`, { anchor: "end", fill: C.bad, size: 12 });
  }
  out += text(PLOT.x0, PLOT.y0 + 4, (p.note as string) ?? `Every bar counts strategies with zero real skill, ${years} years each`, { size: 11, fill: C.muted });
  return out;
};

/** The gauntlet's eleven tests as gates, lighting up one by one. */
const gauntlet: Render = (p, steps, s) => {
  const tests = (p.tests as { id: string; label: string; pass: boolean }[]) ?? [];
  const upto = at(steps, s, "upto", tests.length);
  const rows = [tests.filter((t) => t.id.startsWith("A")), tests.filter((t) => t.id.startsWith("B"))];
  let out = "";
  const titles = ["A. Does it beat the S&P 500?", "B. Is there anything real here?"];
  let k = 0;
  rows.forEach((row, ri) => {
    const y0 = 34 + ri * 112;
    out += text(20, y0, titles[ri], { fill: C.text, size: 13, weight: 600 });
    const w = (W - 40 - (6 - 1) * 8) / 6;
    row.forEach((t, i) => {
      const x0 = 20 + i * (w + 8);
      const shown = clamp(upto - k);
      const col = shown < 0.5 ? C.faint : t.pass ? C.good : C.bad;
      out += `<rect x="${r1(x0)}" y="${y0 + 12}" width="${r1(w)}" height="64" rx="10" fill="${C.panel}" stroke="${col}" stroke-width="${shown > 0.5 ? 2 : 1}" opacity="${r1((0.45 + 0.55 * shown) * 100) / 100}"/>`;
      out += text(x0 + w / 2, y0 + 34, t.id, { anchor: "middle", fill: shown > 0.5 ? col : C.faint, size: 13, weight: 700 });
      out += text(x0 + w / 2, y0 + 52, shown > 0.5 ? (t.pass ? "pass" : "fail") : "...", { anchor: "middle", fill: shown > 0.5 ? col : C.faint, size: 12 });
      out += text(x0 + w / 2, y0 + 68, t.label, { anchor: "middle", fill: C.muted, size: 10 });
      k++;
    });
  });
  const verdict = str(steps, s, "verdict");
  if (verdict) out += text(W / 2, 258, verdict, { anchor: "middle", fill: C.text, size: 13, weight: 600 });
  return out;
};

/** Smooth line through points (Catmull-Rom turned into cubic curves). */
function smooth(pts: [number, number][]): string {
  if (pts.length < 3) return line(pts);
  let d = `M${r1(pts[0][0])} ${r1(pts[0][1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${r1(c1[0])} ${r1(c1[1])} ${r1(c2[0])} ${r1(c2[1])} ${r1(p2[0])} ${r1(p2[1])}`;
  }
  return d;
}

/** A yield curve: yield by how long the loan lasts, twisting from one shape to the next. */
const curve: Render = (p, steps, s) => {
  const labels = (p.labels as string[]) ?? ["3m", "2y", "5y", "10y", "30y"];
  const first = arr(valueAt(steps, 0, "yields")) ?? labels.map(() => 3);
  const ys = atArr(steps, s, "yields", first);
  const all = steps.flatMap((st) => arr(st.yields) ?? []);
  const lo = Math.max(0, Math.floor(Math.min(...all) - 0.5)), hi = Math.ceil(Math.max(...all) + 0.5);
  const x = scale(0, labels.length - 1, PLOT.x0 + 10, PLOT.x1 - 10), y = scale(lo, hi, PLOT.y1, PLOT.y0 + 14);
  let out = yAxis(lo, hi, y, "%") + labels.map((l, i) => text(x(i), PLOT.y1 + 20, l, { size: 12, anchor: "middle", fill: C.muted })).join("");
  out += text(PLOT.x1, PLOT.y0 + 4, "Yield by how long the loan lasts", { size: 11, anchor: "end", fill: C.muted });
  if (at(steps, s, "ghost", 0) > 0.01) out += `<path d="${smooth(first.map((v, i) => [x(i), y(v)]))}" fill="none" stroke="${C.faint}" stroke-width="1.5" stroke-dasharray="4 4" opacity=".7"/>`;
  const slope = ys[ys.length - 1] - ys[0];
  const col = slope > 0.25 ? C.blue : slope < -0.25 ? C.bad : C.warn;
  out += `<path d="${smooth(ys.map((v, i) => [x(i), y(v)]))}" fill="none" stroke="${col}" stroke-width="3" stroke-linecap="round"/>`;
  ys.forEach((v, i) => { out += dot(x(i), y(v), col, 4.5) + text(x(i), y(v) - 12, `${v.toFixed(1)}%`, { size: 12, anchor: "middle", fill: C.text }); });
  const label = str(steps, s, "label");
  if (label) out += text(PLOT.x0 + 4, PLOT.y0 + 4, label, { fill: col, size: 13, weight: 600 });
  return out;
};

/** Bars that grow and shrink from step to step. Negative values hang below zero. */
const bars: Render = (p, steps, s) => {
  const labels = (p.labels as string[]) ?? [];
  const unit = str(steps, s, "unit") || ((p.unit as string) ?? "");
  const vals = atArr(steps, s, "values", labels.map(() => 0));
  const all = steps.flatMap((st) => arr(st.values) ?? []);
  const lo = Math.min(0, num(p.min, Math.min(...all))), hi = Math.max(0, num(p.max, Math.max(...all)));
  const pad = (hi - lo) * 0.12 || 1;
  const y = scale(lo - (lo < 0 ? pad : 0), hi + pad, PLOT.y1, PLOT.y0 + 14);
  const n = labels.length, gap = 18, bw = (PLOT.x1 - PLOT.x0 - gap * (n + 1)) / n;
  const colors = (p.colors as string[]) ?? [];
  let out = p.axis === false ? "" : yAxis(lo, hi, y, unit === "$" ? "$" : unit);
  out += `<line x1="${PLOT.x0}" x2="${PLOT.x1}" y1="${r1(y(0))}" y2="${r1(y(0))}" stroke="${C.faint}"/>`;
  vals.forEach((v, i) => {
    const x0 = PLOT.x0 + gap + i * (bw + gap);
    const col = colors[i] ? (C as Record<string, string>)[colors[i]] ?? colors[i] : v >= 0 ? C.blue : C.bad;
    const top = Math.min(y(v), y(0)), h = Math.abs(y(v) - y(0));
    out += `<rect x="${r1(x0)}" y="${r1(top)}" width="${r1(bw)}" height="${r1(Math.max(h, 0.5))}" rx="4" fill="${col}" opacity=".85"/>`;
    if (Math.abs(v) > (hi - lo) * 0.004) out += text(x0 + bw / 2, v >= 0 ? top - 6 : top + h + 15, unit === "$" ? fmt(v, "$") : `${v.toFixed(Math.abs(v) < 10 ? 1 : 0)}${unit}`, { anchor: "middle", fill: C.text, size: 12, weight: 600 });
    out += text(x0 + bw / 2, PLOT.y1 + 20, labels[i], { anchor: "middle", fill: C.muted, size: 11 });
  });
  const label = str(steps, s, "label");
  if (label) out += text(PLOT.x0 + 4, PLOT.y0 + 2, label, { fill: C.text, size: 13, weight: 600 });
  return out;
};

/** Named lines from points, or from a random walk, or as a smoothed copy of another line. */
const lines: Render = (p, steps, s) => {
  const defs = (p.series as { label: string; color?: string; points?: number[]; walk?: { drift: number; vol: number; seed: number; n: number }; smoothOf?: number; lag?: number }[]) ?? [];
  const built: number[][] = [];
  defs.forEach((d) => {
    if (d.points) built.push(d.points);
    else if (d.walk) built.push(walk(d.walk.n, d.walk.drift, d.walk.vol, d.walk.seed));
    else if (d.smoothOf != null) {
      // Appraisal smoothing: each value moves only part of the way toward the market.
      const src = built[d.smoothOf], k = num(d.lag, 0.2);
      const out = [src[0]];
      for (let i = 1; i < src.length; i++) out.push(out[i - 1] + k * (src[i] - out[i - 1]));
      built.push(out);
    } else built.push([0, 0]);
  });
  const n = Math.max(...built.map((b) => b.length));
  const reveal = at(steps, s, "reveal", 1);
  const show = atArr(steps, s, "show", defs.map(() => 1));
  const flat = built.flat();
  const lo = Math.min(...flat), hi = Math.max(...flat), pad = (hi - lo) * 0.08 || 1;
  const x = scale(0, n - 1, PLOT.x0, PLOT.x1), y = scale(lo - pad, hi + pad, PLOT.y1, PLOT.y0 + 14);
  const unit = (p.unit as string) ?? "";
  let out = yAxis(lo - pad, hi + pad, y, unit) + xLabels((p.xLabels as string[]) ?? []);
  if (lo < 0 && hi > 0) out += `<line x1="${PLOT.x0}" x2="${PLOT.x1}" y1="${r1(y(0))}" y2="${r1(y(0))}" stroke="${C.faint}" opacity=".7"/>`;
  const m = revealed(n, reveal);
  built.forEach((b, k) => {
    const op = clamp(show[k] ?? 1);
    if (op < 0.02) return;
    const col = defs[k].color ? (C as Record<string, string>)[defs[k].color!] ?? defs[k].color! : PALETTE[k % PALETTE.length];
    const mm = Math.min(m, b.length);
    out += poly(b.slice(0, mm).map((v, i) => [x(i), y(v)]), col, { width: 2.3, opacity: op });
    out += text(x(mm - 1) - 4, y(b[mm - 1]) + (k % 2 ? 18 : -8), defs[k].label, { anchor: "end", fill: col, size: 12, weight: 600 });
  });
  const label = str(steps, s, "label");
  if (label) out += text(PLOT.x0 + 4, PLOT.y0 + 2, label, { fill: C.text, size: 13, weight: 600 });
  return out;
};

/** An event study: moves around many news days, their average, and what random days do. */
const event: Render = (p, steps, s) => {
  const win = num(p.window, 10), total = num(p.events, 40), effect = num(p.effect, 1), vol = num(p.vol, 1);
  const g = rng(num(p.seed, 21));
  const len = win * 2 + 1;
  const mk = (eff: number) => {
    const out: number[] = [];
    let c = 0;
    for (let i = 0; i < len; i++) {
      const d = i - win;
      c += vol * g.normal() * 0.35 + (d > 0 ? eff / win : 0) + (d === 0 ? eff * 0.3 : 0);
      out.push(c);
    }
    const base = out[win - 1];
    return out.map((v) => v - base);
  };
  const evs = Array.from({ length: total }, () => mk(effect));
  const n = Math.max(1, Math.round(at(steps, s, "n", total)));
  const avg = at(steps, s, "avg", 0), band = at(steps, s, "band", 0);
  const vis = evs.slice(0, n);
  const mean = Array.from({ length: len }, (_, i) => vis.reduce((a, e) => a + e[i], 0) / vis.length);
  const lo = Math.min(...evs.flat(), -3), hi = Math.max(...evs.flat(), 3);
  const x = scale(-win, win, PLOT.x0, PLOT.x1), y = scale(lo, hi, PLOT.y1, PLOT.y0 + 14);
  let out = yAxis(lo, hi, y, "") + `<line x1="${PLOT.x0}" x2="${PLOT.x1}" y1="${r1(y(0))}" y2="${r1(y(0))}" stroke="${C.faint}" opacity=".6"/>`;
  out += `<line x1="${r1(x(0))}" x2="${r1(x(0))}" y1="${PLOT.y0 + 10}" y2="${PLOT.y1}" stroke="${C.warn}" stroke-dasharray="3 3"/>` + text(x(0) + 6, PLOT.y0 + 20, "News day", { fill: C.warn, size: 12 });
  out += text(PLOT.x0, PLOT.y1 + 20, `${win} days before`, { size: 11, fill: C.muted }) + text(PLOT.x1, PLOT.y1 + 20, `${win} days after`, { size: 11, fill: C.muted, anchor: "end" });
  out += text(PLOT.x0 - 8, PLOT.y0 + 8, "moves", { size: 10, fill: C.muted, anchor: "end" });
  if (band > 0.01) {
    // Random days: no effect, so their average stays near zero within a band that narrows with more events.
    const w = (1.96 * vol * 0.35) / Math.sqrt(n);
    const up: [number, number][] = [], dn: [number, number][] = [];
    for (let i = 0; i < len; i++) { const d = Math.abs(i - win + 0.5); up.push([x(i - win), y(w * Math.sqrt(d + 1))]); dn.push([x(i - win), y(-w * Math.sqrt(d + 1))]); }
    out += `<path d="${line([...up, ...dn.reverse()])}Z" fill="${C.faint}" opacity="${r1(0.3 * band * 100) / 100}"/>`;
    out += text(PLOT.x0 + 6, y(0) + 16, "Random days", { size: 11, fill: C.muted, opacity: band });
  }
  vis.forEach((e) => { out += poly(e.map((v, i) => [x(i - win), y(v)]), C.blue, { width: 1, opacity: lerp(0.5, 0.15, avg) }); });
  if (avg > 0.01) {
    out += poly(mean.map((v, i) => [x(i - win), y(v)]), C.good, { width: 3, opacity: avg });
    out += text(PLOT.x1 - 4, y(mean[len - 1]) - 10, `Average of ${n}`, { anchor: "end", fill: C.good, size: 12, weight: 600 });
  }
  return out;
};

/** A leveraged bet: the price at which the money put up is gone moves closer as leverage grows. */
const leverage: Render = (p, steps, s) => {
  const days = num(p.days, 120);
  const price = walk(days, num(p.drift, 0.001), num(p.vol, 0.03), num(p.seed, 9));
  const lev = at(steps, s, "lev", 1);
  const liq = 100 * (1 - 1 / lev);
  const lo = Math.min(...price, 60) * 0.95, hi = Math.max(...price) * 1.04;
  const x = scale(0, days - 1, PLOT.x0, PLOT.x1), y = scale(lo, hi, PLOT.y1, PLOT.y0 + 16);
  let out = yAxis(lo, hi, y, "$") + xLabels(["Day 1", `Day ${days}`]);
  out += `<line x1="${PLOT.x0}" x2="${PLOT.x1}" y1="${r1(y(100))}" y2="${r1(y(100))}" stroke="${C.faint}" stroke-dasharray="3 4"/>` + text(PLOT.x0 + 4, y(100) - 6, "Bought at $100", { size: 11, fill: C.muted });
  const hit = liq > lo ? price.findIndex((v) => v <= liq) : -1;
  const end = hit >= 0 ? hit + 1 : days;
  out += poly(price.slice(0, end).map((v, i) => [x(i), y(v)]), C.blue, { width: 2.2 });
  if (hit >= 0) out += poly(price.slice(hit).map((v, i) => [x(i + hit), y(v)]), C.faint, { width: 1.4, opacity: 0.4, dash: "2 3" });
  if (liq > lo) {
    out += `<line x1="${PLOT.x0}" x2="${PLOT.x1}" y1="${r1(y(liq))}" y2="${r1(y(liq))}" stroke="${C.bad}" stroke-width="2"/>`;
    out += text(PLOT.x1 - 4, y(liq) + 16, `Margin gone at $${liq.toFixed(0)}`, { anchor: "end", fill: C.bad, size: 12, weight: 600 });
  }
  if (hit >= 0) {
    out += `<g stroke="${C.bad}" stroke-width="3"><line x1="${r1(x(hit) - 6)}" y1="${r1(y(price[hit]) - 6)}" x2="${r1(x(hit) + 6)}" y2="${r1(y(price[hit]) + 6)}"/><line x1="${r1(x(hit) - 6)}" y1="${r1(y(price[hit]) + 6)}" x2="${r1(x(hit) + 6)}" y2="${r1(y(price[hit]) - 6)}"/></g>`;
    out += text(x(hit) + 10, y(price[hit]) + 20, "Closed by the exchange", { fill: C.bad, size: 12 });
  }
  out += text(PLOT.x0 + 4, PLOT.y0 + 4, `Leverage ${lev.toFixed(Math.abs(lev - Math.round(lev)) > 0.05 ? 1 : 0)}x: a ${(100 / lev).toFixed(lev > 10 && 100 % lev ? 1 : 0)}% fall wipes out the margin`, { fill: C.text, size: 13, weight: 600 });
  return out;
};

/** Private fund cash flows by year: money called, money paid back, and what is still held. */
const jcurve: Render = (p, steps, s) => {
  const calls = arr(p.calls) ?? [], dists = arr(p.dists) ?? [], nav = arr(p.nav) ?? [];
  const n = calls.length;
  const reveal = at(steps, s, "reveal", 1), showNav = at(steps, s, "nav", 0);
  const m = clamp(reveal * n, 1, n);
  const net = calls.map((c, i) => dists[i] - c);
  const cum: number[] = [];
  net.forEach((v, i) => cum.push(v + (cum[i - 1] ?? 0)));
  const lo = Math.min(...cum, ...net.map((v) => Math.min(0, v))) * 1.15, hi = Math.max(...cum, ...dists, ...nav) * 1.1;
  const y = scale(lo, hi, PLOT.y1, PLOT.y0 + 30);
  const gap = 10, bw = (PLOT.x1 - PLOT.x0 - gap * (n + 1)) / n;
  const cx = (i: number) => PLOT.x0 + gap + i * (bw + gap) + bw / 2;
  let out = yAxis(lo, hi, y, "$") + `<line x1="${PLOT.x0}" x2="${PLOT.x1}" y1="${r1(y(0))}" y2="${r1(y(0))}" stroke="${C.faint}"/>`;
  for (let i = 0; i < n; i++) {
    const grow = clamp(m - i);
    if (grow <= 0) continue;
    if (calls[i]) out += `<rect x="${r1(cx(i) - bw / 2)}" y="${r1(y(0))}" width="${r1(bw)}" height="${r1(y(-calls[i] * grow) - y(0))}" rx="3" fill="${C.bad}" opacity=".75"/>`;
    if (dists[i]) out += `<rect x="${r1(cx(i) - bw / 2)}" y="${r1(y(dists[i] * grow))}" width="${r1(bw)}" height="${r1(y(0) - y(dists[i] * grow))}" rx="3" fill="${C.good}" opacity=".75"/>`;
    out += text(cx(i), PLOT.y1 + 20, `Y${i + 1}`, { anchor: "middle", size: 11, fill: C.muted });
  }
  const k = Math.max(1, Math.floor(m));
  out += poly(cum.slice(0, k).map((v, i) => [cx(i), y(v)]), C.warn, { width: 2.5 });
  out += dot(cx(k - 1), y(cum[k - 1]), C.warn);
  const paid = calls.slice(0, k).reduce((a, b) => a + b, 0), back = dists.slice(0, k).reduce((a, b) => a + b, 0);
  const dpi = paid ? back / paid : 0, tvpi = paid ? (back + (nav[k - 1] ?? 0)) / paid : 0;
  out += text(PLOT.x0 + 4, PLOT.y0 + 4, `Year ${k}: paid in $${paid.toFixed(0)}, paid back $${back.toFixed(0)}, DPI ${dpi.toFixed(2)}x`, { fill: C.text, size: 12, weight: 600 });
  if (showNav > 0.01 && nav.length) {
    out += poly(nav.slice(0, k).map((v, i) => [cx(i), y(v)]), C.blue, { width: 2, opacity: showNav, dash: "5 4" });
    out += text(PLOT.x0 + 4, PLOT.y0 + 22, `Still held (NAV) $${(nav[k - 1] ?? 0).toFixed(0)}, TVPI ${tvpi.toFixed(2)}x`, { fill: C.blue, size: 12, opacity: showNav });
  }
  out += text(PLOT.x1, PLOT.y0 + 4, "Running total", { anchor: "end", fill: C.warn, size: 11 });
  return out;
};

/** Two currencies on a seesaw: the side that gains value rises. */
const seesaw: Render = (p, steps, s) => {
  const base = (p.base as string) ?? "EUR", quote = (p.quote as string) ?? "USD";
  const rate = at(steps, s, "rate", 1.1), mid = num(p.mid, rate);
  const tilt = clamp((rate - mid) / num(p.span, 0.2), -1, 1) * 14;
  const cx = W / 2, cy = 170, half = 170;
  const rad = (tilt * Math.PI) / 180;
  const lx = cx - half * Math.cos(rad), ly = cy - half * Math.sin(rad) * -1;
  const rx = cx + half * Math.cos(rad), ry = cy + half * Math.sin(rad) * -1;
  let out = `<path d="M${cx - 26} 222L${cx} ${cy + 4}L${cx + 26} 222Z" fill="${C.panel}" stroke="${C.faint}"/>`;
  out += `<line x1="${r1(lx)}" y1="${r1(ly)}" x2="${r1(rx)}" y2="${r1(ry)}" stroke="${C.muted}" stroke-width="4" stroke-linecap="round"/>`;
  const coin = (x: number, yv: number, label: string, col: string) =>
    `<circle cx="${r1(x)}" cy="${r1(yv - 32)}" r="30" fill="${C.panel}" stroke="${col}" stroke-width="2.5"/>` + text(x, yv - 27, label, { anchor: "middle", fill: col, size: 15, weight: 700 });
  out += coin(lx, ly, base, C.blue) + coin(rx, ry, quote, C.good);
  out += text(cx, 40, `1 ${base} = ${rate.toFixed(2)} ${quote}`, { anchor: "middle", fill: C.text, size: 20, weight: 700 });
  const label = str(steps, s, "label");
  if (label) out += text(cx, 66, label, { anchor: "middle", fill: C.muted, size: 13 });
  out += text(cx, 250, `Higher number: the ${base} buys more ${quote}`, { anchor: "middle", fill: C.muted, size: 11 });
  return out;
};

/** A price with its moving average; shading shows when a simple trend rule is long or short. */
const trend: Render = (p, steps, s) => {
  const days = num(p.days, 260), win = num(p.window, 40);
  const g = rng(num(p.seed, 4));
  const price = [100];
  let regime = 1;
  for (let i = 1; i < days; i++) {
    if (i % 70 === 0) regime = -regime;
    price.push(price[i - 1] * Math.exp(regime * num(p.drift, 0.0025) + num(p.vol, 0.009) * g.normal()));
  }
  const ma = price.map((_, i) => { const a = price.slice(Math.max(0, i - win + 1), i + 1); return a.reduce((x, y) => x + y, 0) / a.length; });
  const reveal = at(steps, s, "reveal", 1), showMa = at(steps, s, "ma", 0), shade = at(steps, s, "shade", 0);
  const m = revealed(days, reveal);
  const lo = Math.min(...price) * 0.97, hi = Math.max(...price) * 1.03;
  const x = scale(0, days - 1, PLOT.x0, PLOT.x1), y = scale(lo, hi, PLOT.y1, PLOT.y0 + 14);
  let out = yAxis(lo, hi, y, "$") + xLabels(["Day 1", `Day ${days}`]);
  if (shade > 0.01) {
    for (let i = win; i < m - 1; i++) {
      const up = price[i] > ma[i];
      out += `<rect x="${r1(x(i))}" y="${PLOT.y0 + 14}" width="${r1(x(i + 1) - x(i) + 0.4)}" height="${PLOT.y1 - PLOT.y0 - 14}" fill="${up ? C.good : C.bad}" opacity="${r1(0.1 * shade * 100) / 100}"/>`;
    }
  }
  out += poly(price.slice(0, m).map((v, i) => [x(i), y(v)]), C.blue, { width: 2 });
  if (showMa > 0.01) out += poly(ma.slice(win, m).map((v, i) => [x(i + win), y(v)]), C.warn, { width: 2, opacity: showMa });
  out += text(PLOT.x0 + 4, PLOT.y0 + 2, shade > 0.5 ? "Green: price above its average (hold). Red: below (step aside or short)." : showMa > 0.5 ? `Yellow: the average of the last ${win} days` : "A price that moves in long swings", { fill: C.text, size: 12, weight: 600 });
  return out;
};


/**
 * Win rate against profit (DEC-0035): accounts that each make a run of trades with a
 * chance of winning, a size of win and a size of loss, plus at most one rare large loss
 * at a set point. Every line is labelled with its win rate and its profit so far, so the
 * picture states its own numbers. Made-up trades, drawn the same way every time.
 */
const winrate: Render = (p, steps, s) => {
  const n = num(p.trades, 200), start = num(p.start, 10000);
  const series = (p.series as { label: string; p: number; win: number; loss: number; tailAt?: number; tail?: number; seed?: number }[]) ?? [];
  const reveal = at(steps, s, "reveal", 1);
  const runs = series.map((c, k) => {
    const g = rng(num(c.seed, k + 5));
    const eq = [start];
    const won: boolean[] = [false];
    const tailAt = c.tailAt != null ? Math.round(c.tailAt * (n - 1)) : -1;
    for (let i = 1; i < n; i++) {
      const prev = eq[i - 1];
      const d = prev <= 0 ? 0 : i === tailAt ? -num(c.tail, 0) : g.next() < c.p ? c.win : -c.loss;
      won.push(d > 0);
      eq.push(Math.max(0, prev + d));
    }
    return { eq, won };
  });
  const m = revealed(n, reveal);
  const flat = runs.flatMap((r) => r.eq);
  const lo = Math.min(0, ...flat), hi = Math.max(...flat, start) * 1.08;
  const x = scale(0, n - 1, PLOT.x0, PLOT.x1), y = scale(lo, hi, PLOT.y1, PLOT.y0 + 30);
  let out = yAxis(lo, hi, y, "$") + xLabels(["Trade 1", `Trade ${n}`]);
  out += `<line x1="${PLOT.x0}" x2="${PLOT.x1}" y1="${r1(y(start))}" y2="${r1(y(start))}" stroke="${C.faint}" stroke-dasharray="3 4"/>`;
  runs.forEach((r, k) => {
    const col = PALETTE[k % PALETTE.length];
    const pts = r.eq.slice(0, m).map((v, i) => [x(i), y(v)] as [number, number]);
    out += poly(pts, col, { width: 2.5 });
    const last = pts[pts.length - 1];
    out += dot(last[0], last[1], col);
    // Win rate and profit over the trades shown so far (an empty account trades no more).
    let wins = 0, count = 0;
    for (let i = 1; i < m && r.eq[i - 1] > 0; i++) { count++; if (r.won[i]) wins++; }
    const profit = r.eq[m - 1] - start;
    const line = `${series[k].label}: wins ${count ? Math.round((wins / count) * 100) : 0}%, ${profit >= 0 ? "+" : "-"}${fmt(Math.abs(profit), "$")}`;
    out += text(PLOT.x0 + 4, PLOT.y0 + 2 + k * 16, line, { fill: col, size: 12, weight: 600 });
  });
  return out;
};

export const KINDS: Record<string, Render> = { growth, paths, drawdown, costs, maxof, gauntlet, curve, bars, lines, event, leverage, jcurve, seesaw, trend, winrate };

/** The inside of the picture at position s (0 to steps - 1), as SVG markup. */
export function renderScene(v: Visual, s: number): string {
  const f = KINDS[v.kind];
  if (!f) return text(W / 2, H / 2, `Unknown picture: ${v.kind}`, { anchor: "middle" });
  const last = Math.max(0, v.steps.length - 1);
  return f(v.params ?? {}, v.steps, clamp(s, 0, last));
}

/** A whole standalone SVG of one frame, for the public pages. */
export function svgDocument(v: Visual, s: number, label: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">${renderScene(v, s)}</svg>`;
}
