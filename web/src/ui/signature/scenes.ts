// The signature scenes (DEC-0067). Each scene is a pure function of a visual (its settings
// and steps) and a position `s`, drawn at one of the named sizes in one of the themes. The
// React player tweens `s`; build scripts and the clip renderer call the same functions in
// Node, so a still on a public page and a frame of a clip are the same picture.
//
// Steps: whole numbers of `s` are the finished step frames. A setting set on a step is
// carried forward until a later step changes it, and number settings ease between steps.
// From s = -1 to 0 the first step draws itself in from an empty chart.
//
// Node loads this file with `node --experimental-strip-types`: imports with their .ts
// extension, and only type syntax that can be stripped.
import {
  appear, clamp, easeOut, frame, lerp, money, moneySigned, nums, num, pct, pctSigned, rect, line, text, textWidth,
  track, unit, valueAt, word, group, r1, esc, type Fmt, type Frame, type FrameOptions, type StepData,
} from "./core.ts";
import { camera, fit, scales, niceTicks, type Domain } from "./camera.ts";
import {
  axes, yAxisLabels, bands, callout, caption, drawLine, headline, leadDot, parLine, pills, title, verdict, background, wrap,
  type Band, type Pill, type Stat,
} from "./primitives.ts";
import { viewport, type Box, type SizeName, type ThemeName, type Theme, type Tone, type Viewport } from "./theme.ts";

export interface SigStep extends StepData { caption: string }
export interface SigVisual { kind: string; alt: string; params?: Record<string, unknown>; steps: SigStep[] }

export interface RenderOptions {
  size?: SizeName | Viewport;
  theme?: ThemeName | Theme;
  /** Paint the clip background (default: only for the clip sizes). */
  background?: boolean;
  /** Burn the step caption into the picture (default: only for the clip sizes). */
  captions?: boolean;
  /** A small label at the top of a clip, such as "Parity". */
  brand?: string;
}

type Scene = (v: SigVisual, F: Frame) => string;

// ------------------------------------------------------------------ settings helpers

export type FmtName = "money" | "moneySigned" | "pct" | "pct1" | "pctSigned" | "pctSigned1" | "x" | "num" | "num2";

export function fmtOf(name: unknown): Fmt {
  switch (name) {
    case "money": return money;
    case "moneySigned": return moneySigned;
    case "pct1": return pct(1);
    case "pctSigned": return pctSigned(0);
    case "pctSigned1": return pctSigned(1);
    case "x": return (v) => `${v.toFixed(Math.abs(v) >= 10 ? 0 : 1)}x`;
    case "num": return unit("");
    case "num2": return (v) => v.toFixed(2);
    case "pct": return pct(0);
    default: return money;
  }
}

const str = (v: unknown, d = ""): string => (typeof v === "string" ? v : d);
const isTone = (v: unknown): v is Tone => typeof v === "string" && ["pos", "neg", "accent", "warn", "alt", "text", "muted", "faint"].includes(v);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const list = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.map(obj) : []);
/** Numbers with gaps (null) kept as NaN, so lines skip them. */
const gappy = (v: unknown): number[] => (Array.isArray(v) ? v.map((x) => (typeof x === "number" && Number.isFinite(x) ? x : NaN)) : []);

/** Draws a setting that may change between steps, crossfading the old value into the new one. */
function crossfade(F: Frame, steps: SigStep[], key: string, draw: (val: unknown, opacity: number) => string): string {
  const b = valueAt(steps, Math.max(0, F.j), key);
  const a = F.i < 0 ? undefined : valueAt(steps, F.i, key);
  if (F.i === F.j || JSON.stringify(a) === JSON.stringify(b)) return b === undefined ? "" : draw(b, F.i < 0 ? F.e : 1);
  return (a === undefined ? "" : draw(a, 1 - F.e)) + (b === undefined ? "" : draw(b, F.e));
}

/** A setting that belongs to one step only (callouts): shown at that step, faded on the way in and out. */
function stepOnly(F: Frame, steps: SigStep[], key: string, draw: (val: unknown, opacity: number) => string): string {
  let out = "";
  const seen = new Set<number>();
  for (const k of [F.i, F.j]) {
    if (k < 0 || seen.has(k)) continue;
    seen.add(k);
    const v = steps[k]?.[key];
    if (v === undefined) continue;
    const op = F.i === F.j ? 1 : k === F.j ? clamp((F.f - 0.45) / 0.55) : clamp(1 - F.f / 0.4);
    out += draw(v, op);
  }
  return out;
}

/** Side stats make way for the verdict card, which sits where they do. */
function sideRoom(F: Frame, steps: SigStep[], side: Stat[]): Stat[] {
  return word(F, steps, "verdict") ? [] : side;
}

function verdictOf(F: Frame, steps: SigStep[], o: { reserve?: number; where?: "head" | "plot" } = {}): string {
  return crossfade(F, steps, "verdict", (t, op) => verdict(F, str(t), { tone: isTone(valueAt(steps, Math.max(0, F.k), "tone")) ? (valueAt(steps, Math.max(0, F.k), "tone") as Tone) : "accent", opacity: op, ...o }));
}

/** x-axis labels for a series indexed 0..n-1, from per-point labels or a start year. */
function xTicksFor(d: Domain, P: Record<string, unknown>, n: number, count = 5): [number, string][] {
  const labels = Array.isArray(P.labels) ? (P.labels as unknown[]).map((x) => String(x)) : null;
  const start = num(P.start, NaN), perYear = num(P.perYear, 1);
  if (labels && labels.length) {
    // Dates: one label per year boundary when the window spans years, else the raw labels.
    const lo = Math.max(0, Math.ceil(d.x0)), hi = Math.min(labels.length - 1, Math.floor(d.x1));
    const years = /^\d{4}/.test(labels[0]);
    const out: [number, string][] = [];
    if (years && labels[hi]?.slice(0, 4) !== labels[lo]?.slice(0, 4)) {
      const y0 = +labels[lo].slice(0, 4), y1 = +labels[hi].slice(0, 4);
      const ticks = niceTicks(y0, y1, count).filter((y) => Number.isInteger(y));
      for (const y of ticks) {
        const idx = labels.findIndex((l) => +l.slice(0, 4) >= y);
        if (idx >= lo && idx <= hi) out.push([idx, String(y)]);
      }
      return out;
    }
    const step = Math.max(1, Math.ceil((hi - lo + 1) / count));
    for (let i = lo; i <= hi; i += step) out.push([i, labels[i]]);
    return out;
  }
  if (Number.isFinite(start)) {
    const y0 = start + d.x0 / perYear, y1 = start + d.x1 / perYear;
    return niceTicks(y0, y1, count).filter((y) => Number.isInteger(y)).map((y) => [(y - start) * perYear, String(y)]);
  }
  return niceTicks(d.x0, Math.min(d.x1, n - 1), count).map((x) => [x, String(Math.round(x))]);
}

/** A label for point i (the date or year), for tables and callouts. */
function pointLabel(P: Record<string, unknown>, i: number): string {
  const labels = Array.isArray(P.labels) ? (P.labels as unknown[]) : null;
  if (labels && labels[i] != null) return String(labels[i]);
  const start = num(P.start, NaN), perYear = num(P.perYear, 1);
  if (Number.isFinite(start)) return perYear === 1 ? String(start + i) : `${start + Math.floor(i / perYear)}`;
  return String(i);
}

// ------------------------------------------------------------------ equity: lines that draw in

// A "crowd" series is one of many background paths (simulated tries, say): drawn thin and
// faint, with no dot or value pill, and summed up as its highest and lowest in the table.
interface SeriesSpec { label: string; values: number[]; tone?: Tone; par: boolean; crowd: boolean }

function seriesOf(P: Record<string, unknown>): SeriesSpec[] {
  return list(P.series).map((s, i) => ({
    label: str(s.label, `Series ${i + 1}`), values: gappy(s.values), tone: isTone(s.tone) ? s.tone : undefined, par: s.role === "par" || s.role === "benchmark", crowd: s.role === "crowd",
  })).filter((s) => s.values.length > 0);
}

function seriesColor(F: Frame, s: SeriesSpec, i: number): string {
  if (s.tone) return F.color(s.tone);
  if (s.crowd) return F.th.muted;
  if (s.par) return F.th.par;
  return i === 0 ? F.th.accent : [F.th.pos, F.th.warn, F.th.alt, F.th.neg][(i - 1) % 4];
}

/** How visible each series is: the `show` step setting (indices), eased. Default: all. */
function shown(F: Frame, steps: SigStep[], n: number): number[] {
  const at = (k: number) => {
    const v = nums(valueAt(steps, Math.max(0, k), "show"));
    return Array.from({ length: n }, (_, i) => (v ? (v.includes(i) ? 1 : 0) : 1));
  };
  const a = at(F.i < 0 ? 0 : F.i), b = at(F.j);
  return a.map((x, i) => lerp(x, b[i], F.e));
}

const equity: Scene = (v, F) => {
  const P = v.params ?? {}, steps = v.steps;
  const S = seriesOf(P);
  if (!S.length) return "";
  const n = Math.max(...S.map((s) => s.values.length));
  const X = (share: number) => clamp(share) * (n - 1);
  const fm = fmtOf(P.fmt);
  const par = valueAt(steps, Math.max(0, F.k), "par");
  const include = typeof par === "number" ? [par] : [];
  const vis = shown(F, steps, S.length);
  const to = X(track(F, steps, "to", 1, 0));

  const fitAt = (k: number): Domain => {
    const kk = Math.max(0, k);
    const toK = X(num(valueAt(steps, kk, "to"), 1));
    // A zoom belongs to its own step: the next step without one widens back out.
    const z = nums(steps[Math.min(kk, steps.length - 1)]?.zoom);
    const show = nums(valueAt(steps, kk, "show"));
    const x0 = z ? X(z[0]) : 0, x1 = z ? X(z[1]) : Math.max(toK, X(0.04));
    const fs = S.filter((_, i) => !show || show.includes(i)).map((s) => ({ values: s.values }));
    return fit(fs, x0, x1, { include });
  };
  const zoomed = nums(steps[Math.max(0, F.j)]?.zoom) || (F.i >= 0 && nums(steps[F.i]?.zoom));
  let cam = camera(F, fitAt);
  if (!zoomed && to > cam.x1) cam = { ...cam, x1: to };
  const sc = scales(cam, F.L.plot);

  let out = axes(F, sc, { yFmt: fm, xTicks: xTicksFor(cam, P, n), yLabelsLater: true });
  out += crossfade(F, steps, "bands", (b, op) => bands(F, sc, list(b).map((x) => ({
    from: X(num(x.from, 0)), to: X(num(x.to, 1)), label: str(x.label), tone: isTone(x.tone) ? x.tone : "muted",
  })) as Band[], { opacity: op }));
  if (typeof par === "number") out += parLine(F, sc, par, str(valueAt(steps, Math.max(0, F.k), "parLabel")));

  const tipPills: Pill[] = [];
  const tips: { x: number; y: number; v: number }[] = [];
  // Crowd, then par series first, so the main line sits on top.
  const under = (x: SeriesSpec) => (x.crowd ? 2 : x.par ? 1 : 0);
  const order = S.map((_, i) => i).sort((a, b) => under(S[b]) - under(S[a]));
  for (const i of order) {
    const s = S[i];
    const col = seriesColor(F, s, i);
    if (s.crowd) {
      out += drawLine(F, sc, { values: s.values, to: Math.min(to, cam.x1), from: cam.x0 - 1, color: col, opacity: vis[i] * 0.45, width: 1.1, area: 0, dot: false }).svg;
      tips[i] = { x: NaN, y: NaN, v: NaN };
      continue;
    }
    const r = drawLine(F, sc, {
      values: s.values, to: Math.min(to, cam.x1), from: cam.x0 - 1, color: col, opacity: vis[i],
      width: s.par ? 1.8 : 2.6, area: s.par || i > 0 ? 0 : 0.1, dot: !s.par || S.length === 1
    });
    out += r.svg;
    tips[i] = r.tip ? { x: r.tip.x, y: r.tip.y, v: r.tip.v } : { x: NaN, y: NaN, v: NaN };
    if (r.tip && vis[i] > 0.01) tipPills.push({ x: r.tip.x, y: r.tip.y, value: fm(r.tip.v), label: S.length > 1 ? s.label : undefined, color: col, opacity: vis[i] });
  }
  out += yAxisLabels(F, sc, { yFmt: fm });
  out += pills(F, tipPills);

  // Callouts that belong to one step: a ring on the point, a leader and a label.
  out += stepOnly(F, steps, "callouts", (c, op) => list(c).map((x) => {
    const si = Math.min(S.length - 1, Math.max(0, num(x.series, 0)));
    const xi = Math.round(X(num(x.at, 1)));
    const yv = S[si].values[xi];
    if (!Number.isFinite(yv) || xi < cam.x0 - 0.5 || xi > cam.x1 + 0.5) return "";
    return callout(F, { x: sc.x(xi), y: sc.y(yv), value: str(x.value) || fm(yv), label: str(x.label) || pointLabel(P, xi), color: isTone(x.tone) ? F.color(x.tone) : seriesColor(F, S[si], si), opacity: op });
  }).join(""));

  // The headline: the main series' value at its tip, ticking as the line draws in.
  const t = word(F, steps, "title");
  if (t) out += title(F, t, word(F, steps, "sub"));
  else {
    const H = obj(P.headline);
    const hi = Math.min(S.length - 1, num(H.series, 0));
    const main: Stat | null = Number.isFinite(tips[hi]?.v) ? { value: fm(tips[hi].v), label: word(F, steps, "stat") || str(H.label, S[hi].label), tone: isTone(H.tone) ? H.tone : undefined } : null;
    const side: Stat[] = S.map((s, i) => ({ s, i })).filter(({ i }) => i !== hi && vis[i] > 0.5 && Number.isFinite(tips[i]?.v)).map(({ s, i }) => ({ value: fm(tips[i].v), label: s.label }));
    out += headline(F, main, sideRoom(F, steps, side), { maxSide: 1 });
  }
  out += verdictOf(F, steps, { reserve: 190 * F.u });
  return out;
};

// ------------------------------------------------------------------ split: two charts side by side

function panelBoxes(F: Frame): [Box, Box] {
  const { plot, right } = F.L, u = F.u;
  const all: Box = { x0: plot.x0, y0: plot.y0, x1: plot.x1 + right, y1: plot.y1 };
  if (F.h > F.w * 1.4) {
    const g = 26 * u, mid = (all.y0 + all.y1) / 2;
    return [{ ...all, y1: mid - g / 2 }, { ...all, y0: mid + g / 2 }];
  }
  const g = 18 * u, mid = (all.x0 + all.x1) / 2;
  return [{ ...all, x1: mid - g / 2 }, { ...all, x0: mid + g / 2 }];
}

const split: Scene = (v, F) => {
  const P = v.params ?? {}, steps = v.steps, u = F.u;
  const sides = [obj(P.left), obj(P.right)].map((s, i) => ({
    title: str(s.title, i ? "Right" : "Left"), values: gappy(s.values), tone: isTone(s.tone) ? s.tone : (i ? "muted" : "accent") as Tone, labels: s.labels,
  }));
  const fm = fmtOf(P.fmt);
  const to = track(F, steps, "to", 1, 0);
  const winner = valueAt(steps, Math.max(0, F.k), "winner");
  const winOp = winner === "left" || winner === "right" ? appear(F, steps.findIndex((st) => st.winner !== undefined), 0.3) : 0;
  const boxes = panelBoxes(F);
  const same = P.sameScale !== false;
  const vals: number[] = [];
  let out = "";
  const doms = sides.map((s) => {
    const n = s.values.length;
    return fit([{ values: s.values }], 0, Math.max(1, (n - 1) * Math.max(to, 0.04)));
  });
  if (same) {
    const y0 = Math.min(doms[0].y0, doms[1].y0), y1 = Math.max(doms[0].y1, doms[1].y1);
    doms.forEach((d) => { d.y0 = y0; d.y1 = y1; });
  }
  const main: Stat[] = [];
  sides.forEach((s, i) => {
    const b = boxes[i];
    const titleH = 16 * u;
    const pb: Box = { x0: b.x0, y0: b.y0 + titleH + 6 * u, x1: b.x1 - 54 * u, y1: b.y1 - 14 * u };
    const n = s.values.length;
    const sc = scales({ ...doms[i], x1: Math.max(doms[i].x1, (n - 1) * to) }, pb);
    const col = F.color(s.tone);
    const isWin = (winner === "left" && i === 0) || (winner === "right" && i === 1);
    // A quiet panel behind each side; the winner's edge lights up in its colour.
    out += rect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0, { fill: F.th.panel, rx: 10 * u, opacity: 0.55 });
    if (winOp > 0.01) out += rect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0, { rx: 10 * u, stroke: isWin ? F.th.pos : F.th.grid, sw: (isWin ? 1.6 : 1) * u, opacity: winOp * (isWin ? 0.9 : 0.25) });
    out += text(F, b.x0 + 10 * u, b.y0 + 16 * u, s.title, { size: 11 * u, weight: 600, fill: F.th.ink, halo: false });
    if (isWin && winOp > 0.01) out += text(F, b.x1 - 10 * u, b.y0 + 16 * u, "Ahead", { size: 10 * u, weight: 600, fill: F.th.pos, anchor: "end", halo: false, opacity: winOp });
    const ticks = niceTicks(sc.d.y0, sc.d.y1, 3);
    for (const t of ticks) {
      const y = sc.y(t);
      if (y < pb.y0 || y > pb.y1) continue;
      out += line(pb.x0, y, b.x1 - 8 * u, y, { stroke: F.th.grid, opacity: F.th.gridOpacity });
      out += text(F, pb.x0, y - 3 * u, fm(t), { size: 9.5 * u, fill: F.th.faint });
    }
    const r = drawLine(F, sc, { values: s.values, to: (n - 1) * to, color: col, dot: true, area: 0.1, width: 2.4 });
    out += r.svg;
    if (r.tip) {
      vals[i] = r.tip.v;
      out += pills(F, [{ x: r.tip.x, y: r.tip.y, value: fm(r.tip.v), color: col }], { x0: b.x0, y0: pb.y0 - 4 * u, x1: b.x1 - 4 * u, y1: pb.y1 + 6 * u });
      main.push({ value: fm(r.tip.v), label: s.title, tone: isWin && winOp > 0.5 ? "pos" : undefined });
    }
    const p2 = { ...P, labels: s.labels ?? P.labels };
    const xt = xTicksFor(sc.d, p2, n, 3);
    for (const [xv, l] of xt) {
      const x = sc.x(xv);
      if (x < pb.x0 - 1 || x > pb.x1 + 1) continue;
      out += text(F, x, pb.y1 + 11 * u, l, { size: 9.5 * u, fill: F.th.faint, anchor: x - pb.x0 < 14 * u ? "start" : "middle", halo: false });
    }
  });
  const t = word(F, steps, "title");
  if (t) out += title(F, t, word(F, steps, "sub"));
  else if (main.length) out += headline(F, main[0], sideRoom(F, steps, main.slice(1)), { maxSide: 1 });
  out += verdictOf(F, steps, { reserve: 190 * u });
  return out;
};

// ------------------------------------------------------------------ underwater: how far below the high

function drawdownOf(values: number[]): number[] {
  let peak = -Infinity;
  return values.map((x) => {
    if (!Number.isFinite(x)) return NaN;
    peak = Math.max(peak, x);
    return peak > 0 ? x / peak - 1 : 0;
  });
}

const underwater: Scene = (v, F) => {
  const P = v.params ?? {}, steps = v.steps, u = F.u;
  const values = gappy(P.values);
  const dd = values.length ? drawdownOf(values) : gappy(P.drawdown);
  const n = dd.length;
  if (!n) return "";
  const to = track(F, steps, "to", 1, 0) * (n - 1);
  const eqShow = track(F, steps, "equity", values.length ? 1 : 0, values.length ? 1 : 0);
  const fm = fmtOf(P.fmt ?? "money");
  const { plot } = F.L;
  const full: Box = { ...plot };
  const split = values.length ? lerp(0, 0.4, clamp(eqShow)) : 0;
  const gap = split > 0 ? 12 * u * clamp(eqShow) : 0;
  const top: Box = { ...full, y1: full.y0 + (full.y1 - full.y0) * split };
  const bot: Box = { ...full, y0: top.y1 + gap };

  // The camera on the drawdown: the deepest point of each step's window, eased.
  const fitAt = (k: number): Domain => {
    const toK = num(valueAt(steps, Math.max(0, k), "to"), 1) * (n - 1);
    let lo = 0;
    for (let i = 0; i <= Math.min(n - 1, Math.ceil(toK)); i++) if (Number.isFinite(dd[i])) lo = Math.min(lo, dd[i]);
    return { x0: 0, x1: n - 1, y0: Math.min(-0.05, lo * 1.18), y1: 0 };
  };
  const dom = camera(F, fitAt);
  let worstSoFar = 0, worstAt = 0;
  for (let i = 0; i <= Math.min(n - 1, Math.floor(to)); i++) if (dd[i] < worstSoFar) { worstSoFar = dd[i]; worstAt = i; }
  dom.y0 = Math.min(dom.y0, worstSoFar * 1.05);
  const sb = scales(dom, bot);
  let out = axes(F, sb, { yFmt: pct(0), xTicks: xTicksFor(dom, P, n), yCount: 3, yLabelsLater: true });
  // The waterline and the fill below it.
  out += line(bot.x0, sb.y(0), bot.x1, sb.y(0), { stroke: F.th.par, sw: 1.2 * u });
  out += text(F, bot.x1, sb.y(0) - 4 * u, str(P.highLabel, "Last high"), { size: 10 * u, fill: F.th.muted, anchor: "end" });
  const r = drawLine(F, sb, { values: dd, to, color: F.th.neg, area: 0.3, areaTo: 0, width: 1.8, dot: true });
  out += r.svg;
  out += yAxisLabels(F, sb, { yFmt: pct(0), yCount: 3 });
  if (r.tip) out += pills(F, [{ x: r.tip.x, y: r.tip.y, value: pct(0)(r.tip.v), color: F.th.neg }]);

  if (split > 0.01) {
    let lo = Infinity, hi = -Infinity;
    for (const x of values) if (Number.isFinite(x)) { lo = Math.min(lo, x); hi = Math.max(hi, x); }
    const st = scales({ x0: 0, x1: n - 1, y0: lo - (hi - lo) * 0.08, y1: hi + (hi - lo) * 0.12 }, top);
    // The running high as a faint step line, so the gap to it is visible.
    let peak = -Infinity;
    const peaks = values.map((x) => (peak = Math.max(peak, Number.isFinite(x) ? x : peak)));
    out += group(drawLine(F, st, { values: peaks, to, color: F.th.par, width: 1, opacity: 0.6 }).svg + drawLine(F, st, { values, to, color: F.th.accent, width: 2, dot: true }).svg, clamp(eqShow));
    out += text(F, top.x0, top.y0 + 10 * u, "Account value and its running high", { size: 10 * u, fill: F.th.muted, opacity: clamp(eqShow) });
  }

  out += stepOnly(F, steps, "worst", (on, op) => (on && worstSoFar < 0 ? callout(F, {
    x: sb.x(worstAt), y: sb.y(worstSoFar), value: pct(0)(worstSoFar), label: str(valueAt(steps, Math.max(0, F.k), "worstLabel")) || `Worst fall, ${pointLabel(P, worstAt)}`, color: F.th.neg, opacity: op, dy: -24 * u,
  }) : ""));
  const t = word(F, steps, "title");
  if (t) out += title(F, t, word(F, steps, "sub"));
  else {
    const side: Stat[] = r.tip ? [{ value: pct(0)(r.tip.v), label: "Now" }] : [];
    if (values.length && r.tip) side.push({ value: fm(values[Math.min(n - 1, Math.round(to))]), label: "Account" });
    out += headline(F, { value: pct(0)(worstSoFar), label: str(P.label, "Worst fall so far"), tone: worstSoFar < -0.005 ? "neg" : undefined }, sideRoom(F, steps, side), { maxSide: 1 });
  }
  out += verdictOf(F, steps, { reserve: 190 * u });
  return out;
};

// ------------------------------------------------------------------ distribution: where one result sits among many

interface Hist { edges: number[]; counts: number[] }

function histOf(P: Record<string, unknown>): Hist | null {
  const e = nums(P.edges), c = nums(P.counts);
  if (e && c && e.length === c.length + 1) return { edges: e, counts: c };
  const sm = nums(P.samples);
  if (!sm) return null;
  const bins = Math.max(6, Math.min(60, num(P.bins, 30)));
  let lo = Math.min(...sm), hi = Math.max(...sm);
  if (hi === lo) { lo -= 1; hi += 1; }
  const w = (hi - lo) / bins;
  const counts = new Array(bins).fill(0);
  for (const x of sm) counts[Math.min(bins - 1, Math.floor((x - lo) / w))]++;
  return { edges: Array.from({ length: bins + 1 }, (_, i) => lo + i * w), counts };
}

/** Share of the distribution below x (bins split linearly). */
function shareBelow(h: Hist, x: number): number {
  const total = h.counts.reduce((a, b) => a + b, 0) || 1;
  let acc = 0;
  for (let i = 0; i < h.counts.length; i++) {
    const a = h.edges[i], b = h.edges[i + 1];
    if (x >= b) acc += h.counts[i];
    else if (x > a) acc += h.counts[i] * (x - a) / (b - a);
  }
  return acc / total;
}

function median(h: Hist): number {
  const total = h.counts.reduce((a, b) => a + b, 0);
  let acc = 0;
  for (let i = 0; i < h.counts.length; i++) {
    if (acc + h.counts[i] >= total / 2) return lerp(h.edges[i], h.edges[i + 1], h.counts[i] ? (total / 2 - acc) / h.counts[i] : 0.5);
    acc += h.counts[i];
  }
  return h.edges[h.edges.length - 1];
}

const distribution: Scene = (v, F) => {
  const P = v.params ?? {}, steps = v.steps, u = F.u;
  const h = histOf(P);
  if (!h) return "";
  const fm = fmtOf(P.fmt ?? "num2");
  const M = obj(P.marker), B = obj(P.band);
  const mv = num(M.value, NaN), lo = num(B.lo, NaN), hi = num(B.hi, NaN);
  const par = num(P.par, NaN);
  const grow = track(F, steps, "grow", 1, 0);
  const bandOp = track(F, steps, "band", 0, 0);
  const markOp = track(F, steps, "marker", 0, 0);
  let x0 = h.edges[0], x1 = h.edges[h.edges.length - 1];
  for (const x of [mv, lo, hi, par]) if (Number.isFinite(x)) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
  const pad = (x1 - x0) * 0.04;
  const maxC = Math.max(...h.counts, 1);
  const { plot, right } = F.L;
  const ends = obj(P.ends);
  const box: Box = { ...plot, x1: plot.x1 + right * 0.6, y0: plot.y0 + 16 * u, y1: plot.y1 - (ends.low || ends.high ? 12 * u : 0) };
  const sc = scales({ x0: x0 - pad, x1: x1 + pad, y0: 0, y1: maxC * 1.08 }, box);
  let out = axes(F, sc, { yFmt: () => "", yLabels: false, xFmt: fm, xCount: 5 });
  out += line(box.x0, box.y1, box.x1, box.y1, { stroke: F.th.grid, opacity: 0.35 });

  // The confidence band behind the bars, with its range marked along the bottom.
  if (bandOp > 0.01 && Number.isFinite(lo) && Number.isFinite(hi)) {
    const a = sc.x(lo), b = sc.x(lo + (hi - lo) * easeOut(bandOp));
    let g = rect(a, box.y0, b - a, box.y1 - box.y0, { fill: F.th.accent, opacity: 0.1 });
    g += line(a, box.y1 + 4 * u, b, box.y1 + 4 * u, { stroke: F.th.accent, sw: 2 * u, cap: "round" });
    g += line(a, box.y0, a, box.y1, { stroke: F.th.accent, sw: 1 * u, opacity: 0.6, dash: `${r1(3 * u)} ${r1(3 * u)}` });
    g += line(sc.x(hi), box.y0, sc.x(hi), box.y1, { stroke: F.th.accent, sw: 1 * u, opacity: 0.6 * clamp(bandOp * 2 - 1), dash: `${r1(3 * u)} ${r1(3 * u)}` });
    const lab = str(B.label, "95% range");
    // Centred over the band, but kept inside the chart when the band sits near an edge.
    const bl = `${lab}: ${fm(lo)} to ${fm(hi)}`, half = textWidth(bl, 10 * u, 600) / 2;
    const bx = clamp((sc.x(lo) + sc.x(hi)) / 2, box.x0 + half, box.x1 - half);
    g += text(F, bx, box.y0 - 4 * u, bl, { size: 10 * u, fill: F.th.accent, anchor: "middle", weight: 600 });
    out += group(g, clamp(bandOp * 1.5));
  }
  // Bars rise left to right.
  const n = h.counts.length;
  const bw = (sc.x(h.edges[1]) - sc.x(h.edges[0]));
  const gapPx = Math.min(bw * 0.28, 2.5 * u);
  for (let i = 0; i < n; i++) {
    const p = easeOut(clamp(grow * 1.6 - (i / n) * 0.6));
    if (p <= 0) continue;
    const x = sc.x(h.edges[i]) + gapPx / 2, top = sc.y(h.counts[i] * p);
    const mid = (h.edges[i] + h.edges[i + 1]) / 2;
    const inBand = bandOp > 0.5 && Number.isFinite(lo) && mid >= lo && mid <= hi;
    out += rect(x, top, Math.max(0.5, bw - gapPx), box.y1 - top, { fill: inBand ? F.th.accent : F.th.muted, opacity: inBand ? 0.55 : 0.38, rx: Math.min(1.5 * u, bw / 4) });
  }
  if (Number.isFinite(par)) {
    const x = sc.x(par);
    out += line(x, box.y0, x, box.y1, { stroke: F.th.par, sw: 1.2 * u, dash: `${r1(4 * u)} ${r1(3 * u)}` });
    // The label goes on the side of the line away from the marker, so the two never overlap.
    const left = markOp > 0.01 && Number.isFinite(mv) && mv > par;
    out += text(F, left ? x - 4 * u : x + 4 * u, box.y0 + 26 * u, str(P.parLabel, "Zero"), { size: 10 * u, fill: F.th.muted, anchor: left ? "end" : "start" });
  }
  // The marker: one result, dropped onto the pile of others.
  let headlineStat: Stat | null = null;
  if (Number.isFinite(mv)) {
    const tone: Tone = isTone(M.tone) ? M.tone : "accent";
    const col = F.color(tone);
    const from = Number.isFinite(par) ? par : median(h);
    const shown = lerp(from, mv, easeOut(markOp));
    if (markOp > 0.01) {
      const x = sc.x(shown);
      const drop = easeOut(clamp(markOp * 1.4));
      const yTop = box.y0 + 22 * u;
      out += group(line(x, lerp(box.y1, yTop, drop), x, box.y1, { stroke: col, sw: 2 * u }) + leadDot(F, x, box.y1, col)
        + text(F, x, yTop - 6 * u, `${str(M.label, "This result")} ${fm(shown)}`, { size: 11 * u, fill: col, weight: 650, anchor: x > box.x1 - 60 * u ? "end" : x < box.x0 + 60 * u ? "start" : "middle" }), clamp(markOp * 2));
    }
    const better = P.better === "low" ? 1 - shareBelow(h, shown) : shareBelow(h, shown);
    // Until the marker drops in, the headline counts the pile, so it does not give the answer away.
    const total = h.counts.reduce((x, y) => x + y, 0);
    headlineStat = markOp > 0.01 ? { value: fm(shown), label: str(M.label, "This result"), tone } : { value: total.toLocaleString("en-US"), label: str(P.countLabel, "Tries") };
    const share = better > 0.99 ? "Over 99%" : better < 0.01 ? "Under 1%" : `${Math.round(better * 100)}%`;
    const side: Stat[] = markOp > 0.5 ? [{ value: share, label: str(P.beatLabel, "Of the others it beats") }] : [];
    const t = word(F, steps, "title");
    out += t ? title(F, t, word(F, steps, "sub")) : headline(F, headlineStat, sideRoom(F, steps, side), { maxSide: 1 });
  } else {
    const t = word(F, steps, "title");
    if (t) out += title(F, t, word(F, steps, "sub"));
  }
  if (ends.low || ends.high) {
    out += text(F, box.x0, box.y1 + 27 * u, `< ${str(ends.low)}`, { size: 9.5 * u, fill: F.th.faint, halo: false });
    out += text(F, box.x1, box.y1 + 27 * u, `${str(ends.high)} >`, { size: 9.5 * u, fill: F.th.faint, anchor: "end", halo: false });
  }
  out += verdictOf(F, steps, { reserve: 190 * u });
  return out;
};

// ------------------------------------------------------------------ heatmap: rolling correlation over time

function corrColor(F: Frame, v: number): { fill: string; opacity: number } {
  if (!Number.isFinite(v)) return { fill: F.th.grid, opacity: 0.05 };
  return { fill: v >= 0 ? F.th.accent : F.th.alt, opacity: 0.12 + 0.83 * Math.min(1, Math.abs(v)) };
}

const heatmap: Scene = (v, F) => {
  const P = v.params ?? {}, steps = v.steps, u = F.u;
  const rows = list(P.rows).map((r, i) => ({ label: str(r.label, `Row ${i + 1}`), values: gappy(r.values) })).filter((r) => r.values.length);
  if (!rows.length) return "";
  const n = Math.max(...rows.map((r) => r.values.length));
  const to = track(F, steps, "to", 1, 0) * (n - 1);
  const fm = fmtOf(P.fmt ?? "num2");
  const { plot, right } = F.L;
  const legendH = 30 * u;
  const area: Box = { x0: plot.x0, y0: plot.y0, x1: plot.x1, y1: plot.y1 - legendH };
  const labH = 15 * u;
  const rowH = Math.min(70 * u, (area.y1 - area.y0) / rows.length - labH - 6 * u);
  const sc = scales({ x0: 0, x1: n - 1, y0: 0, y1: 1 }, area);
  const cw = (area.x1 - area.x0) / n;
  let out = "";
  const tipPills: Pill[] = [];
  const latest: number[] = [];
  rows.forEach((r, ri) => {
    const y = area.y0 + ri * (rowH + labH + 6 * u) + labH;
    out += text(F, area.x0, y - 4 * u, r.label, { size: 10.5 * u, fill: F.th.text, weight: 600, halo: false });
    out += rect(area.x0, y, area.x1 - area.x0, rowH, { fill: F.th.panel, opacity: 0.5, rx: 3 * u });
    // Runs of cells with the same shade merge into one rectangle, so long series stay light.
    let i = 0;
    const last = Math.min(n - 1, Math.floor(to));
    while (i <= last) {
      const c = corrColor(F, r.values[i]);
      const q = Math.round(c.opacity * 20);
      let j = i + 1;
      while (j <= last && Math.round(corrColor(F, r.values[j]).opacity * 20) === q && corrColor(F, r.values[j]).fill === c.fill) j++;
      out += rect(area.x0 + i * cw, y, (j - i) * cw + 0.3, rowH, { fill: c.fill, opacity: c.opacity });
      i = j;
    }
    let li = last;
    while (li > 0 && !Number.isFinite(r.values[li])) li--;
    latest[ri] = r.values[li];
    if (Number.isFinite(r.values[li]) && to > 0) {
      const x = area.x0 + (li + 1) * cw;
      out += line(x, y - 2 * u, x, y + rowH + 2 * u, { stroke: F.th.ink, sw: 1.5 * u, opacity: 0.9 });
      tipPills.push({ x, y: y + rowH / 2, value: fm(r.values[li]), color: corrColor(F, r.values[li]).fill });
    }
  });
  out += pills(F, tipPills, { x0: area.x0, y0: area.y0, x1: plot.x1 + right - 2 * u, y1: area.y1 });
  // Years along the bottom of the last row.
  const lastY = area.y0 + rows.length * (rowH + labH + 6 * u) - 6 * u;
  for (const [xv, l] of xTicksFor(sc.d, P, n)) {
    const x = area.x0 + (xv + 0.5) * cw;
    out += text(F, x, lastY + 12 * u, l, { size: 9.5 * u, fill: F.th.faint, anchor: x - area.x0 < 14 * u ? "start" : "middle", halo: false });
  }
  // The highlight window, outlined across every row.
  out += crossfade(F, steps, "highlight", (hv, op) => {
    const hz = nums(hv);
    if (!hz) return "";
    const a = area.x0 + hz[0] * (n - 1) * cw, b = area.x0 + (hz[1] * (n - 1) + 1) * cw;
    const lab = word(F, steps, "highlightLabel");
    return group(rect(a, area.y0 + labH - 3 * u, b - a, lastY - area.y0 - labH + 6 * u, { stroke: F.th.ink, sw: 1.2 * u, rx: 3 * u })
      + (lab ? text(F, Math.min(a, area.x1 - textWidth(lab, 10 * u)), area.y0 + 4 * u, lab, { size: 10 * u, fill: F.th.ink, weight: 600 }) : ""), op);
  });
  // The legend: a two-sided scale.
  const ly = Math.min(plot.y1 - 10 * u, lastY + 34 * u), lw = Math.min(180 * u, area.x1 - area.x0), lx = area.x0;
  const cells = 24;
  for (let k = 0; k < cells; k++) {
    const val = -1 + (2 * k + 1) / cells;
    const c = corrColor(F, val);
    out += rect(lx + (k * lw) / cells, ly - 6 * u, lw / cells + 0.3, 6 * u, { fill: c.fill, opacity: c.opacity });
  }
  out += text(F, lx, ly + 9 * u, "-1 opposite", { size: 9.5 * u, fill: F.th.faint, halo: false });
  out += text(F, lx + lw / 2, ly + 9 * u, "0", { size: 9.5 * u, fill: F.th.faint, anchor: "middle", halo: false });
  out += text(F, lx + lw, ly + 9 * u, "+1 together", { size: 9.5 * u, fill: F.th.faint, anchor: "end", halo: false });

  const t = word(F, steps, "title");
  if (t) out += title(F, t, word(F, steps, "sub"));
  else if (to > 0) {
    out += headline(F, Number.isFinite(latest[0]) ? { value: fm(latest[0]), label: `${rows[0].label}, latest` } : null,
      sideRoom(F, steps, rows.slice(1).map((r, i) => ({ value: Number.isFinite(latest[i + 1]) ? fm(latest[i + 1]) : "n/a", label: r.label }))), { maxSide: 1 });
  }
  out += verdictOf(F, steps, { reserve: 190 * u });
  return out;
};

// ------------------------------------------------------------------ regimes: wins and losses by kind of market

const regimes: Scene = (v, F) => {
  const P = v.params ?? {}, steps = v.steps, u = F.u;
  const items = list(P.items).map((x) => ({ label: str(x.label), s: num(x.strategy, NaN), b: num(x.benchmark, NaN) })).filter((x) => x.label);
  if (!items.length) return "";
  const fm = fmtOf(P.fmt ?? "pctSigned");
  const reveal = track(F, steps, "reveal", items.length, 0);
  const hi = valueAt(steps, Math.max(0, F.k), "highlight");
  const { plot, right } = F.L;
  const box: Box = { x0: plot.x0, y0: plot.y0 + 14 * u, x1: plot.x1 + right, y1: plot.y1 + 10 * u };
  const rowH = Math.min((F.h > F.w * 1.4 ? 44 : 30) * u, (box.y1 - box.y0) / items.length);
  const size = clamp(rowH / (2.1 * u), 8.5, 12.5) * u;
  const labelW = Math.min((box.x1 - box.x0) * 0.36, Math.max(...items.map((x) => textWidth(x.label, size))) + 8 * u);
  const tagW = 36 * u;
  const bx0 = box.x0 + labelW, bx1 = box.x1 - tagW;
  let lo = 0, hiV = 0;
  for (const x of items) for (const val of [x.s, x.b]) if (Number.isFinite(val)) { lo = Math.min(lo, val); hiV = Math.max(hiV, val); }
  const span = hiV - lo || 1;
  const sx = (val: number) => bx0 + 34 * u + ((val - lo) / span) * (bx1 - bx0 - 68 * u);
  const zx = sx(0);
  let out = line(zx, box.y0 - 6 * u, zx, box.y0 + rowH * items.length, { stroke: F.th.par, sw: 1 * u, opacity: 0.7 });
  out += text(F, box.x0, box.y0 - 4 * u, str(P.caption, "Return a year in each kind of market"), { size: 9.5 * u, fill: F.th.faint, halo: false });
  const hasB = items.some((x) => Number.isFinite(x.b));
  if (hasB) out += text(F, box.x1, box.y0 - 4 * u, "Bar: strategy. Tick: benchmark", { size: 9.5 * u, fill: F.th.faint, anchor: "end", halo: false });
  let wins = 0, counted = 0;
  items.forEach((x, i) => {
    const p = easeOut(clamp(reveal - i));
    const y = box.y0 + i * rowH + rowH / 2;
    const win = Number.isFinite(x.b) ? x.s > x.b : x.s > 0;
    if (p > 0.5) { counted++; if (win) wins++; }
    const isHi = typeof hi === "number" && hi === i;
    const dim = typeof hi === "number" && !isHi ? 0.45 : 1;
    if (isHi) out += rect(box.x0 - 4 * u, y - rowH / 2 + 1 * u, box.x1 - box.x0 + 8 * u, rowH - 2 * u, { fill: F.th.panel, rx: 5 * u, opacity: 0.9 });
    out += text(F, box.x0, y + size * 0.35, x.label, { size, fill: F.th.text, opacity: Math.max(0.35, p) * dim, halo: false });
    if (p <= 0) return;
    const col = win ? F.th.pos : F.th.neg;
    const bh = Math.min(10 * u, rowH * 0.42);
    if (Number.isFinite(x.s)) {
      const end = sx(x.s * p);
      out += rect(Math.min(zx, end), y - bh / 2, Math.abs(end - zx), bh, { fill: col, rx: 2 * u, opacity: dim });
      // The number sits past the bar, and past the benchmark tick when that is further out.
      const tick = Number.isFinite(x.b) && Math.sign(x.b || 1) === Math.sign(x.s || 1) ? sx(x.b * p) : end;
      const far = x.s >= 0 ? Math.max(end, tick) + 4 * u : Math.min(end, tick) - 4 * u;
      out += text(F, far, y + size * 0.35, fm(x.s * p), { size: size * 0.92, fill: F.th.ink, weight: 600, anchor: x.s >= 0 ? "start" : "end", opacity: dim });
    }
    if (Number.isFinite(x.b)) {
      const bxp = sx(x.b * p);
      out += line(bxp, y - bh * 0.9, bxp, y + bh * 0.9, { stroke: F.th.ink, sw: 1.6 * u, opacity: 0.75 * dim });
    }
    out += group(text(F, box.x1, y + size * 0.35, win ? "Won" : "Lost", { size: size * 0.92, weight: 650, fill: col, anchor: "end", halo: false }), clamp(p * 2 - 1) * dim);
  });
  const t = word(F, steps, "title");
  if (t) out += title(F, t, word(F, steps, "sub"));
  else out += headline(F, { value: `${wins} of ${Math.max(counted, 0)}`, label: str(P.label, hasB ? "Kinds of market where it beat the benchmark" : "Kinds of market where it made money"), tone: counted ? (wins * 2 >= counted ? "pos" : "neg") : undefined });
  out += verdictOf(F, steps, { reserve: 210 * u });
  return out;
};

// ------------------------------------------------------------------ scorecard: the numbers and the verdict

const scorecard: Scene = (v, F) => {
  const P = v.params ?? {}, steps = v.steps, u = F.u;
  const stats = list(P.stats).map((x) => ({ label: str(x.label), value: num(x.value, NaN), text: str(x.text), fmt: fmtOf(x.fmt ?? "num2"), tone: isTone(x.tone) ? x.tone : undefined, note: str(x.note) }));
  if (!stats.length) return "";
  const reveal = track(F, steps, "reveal", stats.length, 0);
  const { head, plot, right } = F.L;
  const vertical = F.h > F.w * 1.4;
  const verdictText = word(F, steps, "verdict");
  // Without a title the cards use the head band too.
  const hasTitle = steps.some((st) => typeof st.title === "string");
  const box: Box = { x0: plot.x0, y0: hasTitle ? plot.y0 : head.y0 + 4 * u, x1: plot.x1 + right, y1: plot.y1 };
  const cols = vertical ? 1 : stats.length >= 4 ? 2 : stats.length;
  const rowsN = Math.ceil(stats.length / cols);
  const gap = 10 * u;
  const vh = verdictText && !F.L.verdict ? 52 * u : 0;
  const cw = (box.x1 - box.x0 - gap * (cols - 1)) / cols;
  const ch = Math.min(vertical ? 150 * u : 90 * u, (box.y1 - box.y0 - vh - gap * (rowsN - 1)) / rowsN);
  let out = "";
  stats.forEach((st, i) => {
    const p = easeOut(clamp(reveal - i));
    const c = i % cols, r = Math.floor(i / cols);
    const x = box.x0 + c * (cw + gap), y = box.y0 + r * (ch + gap);
    const rise = (1 - p) * 8 * u;
    let g = rect(x, y + rise, cw, ch, { fill: F.th.panel, rx: 10 * u, opacity: 0.75 });
    if (st.tone) g += rect(x, y + rise, 3 * u, ch, { fill: F.color(st.tone), rx: 1.5 * u });
    const big = Math.min(28 * u, ch * 0.42);
    g += text(F, x + 12 * u, y + rise + 16 * u, st.label, { size: 10.5 * u, fill: F.th.muted, halo: false });
    const shownV = st.text ? st.text : Number.isFinite(st.value) ? st.fmt(st.value * p) : "n/a";
    g += text(F, x + 12 * u, y + rise + 16 * u + big * 1.05, shownV, { size: big, weight: 650, fill: st.tone ? F.color(st.tone) : F.th.ink, halo: false });
    if (st.note) {
      const lines = wrap(st.note, cw - 24 * u, 10 * u).slice(0, 2);
      lines.forEach((l, k) => { g += text(F, x + 12 * u, y + rise + 16 * u + big * 1.05 + 14 * u + k * 12.5 * u, l, { size: 10 * u, fill: F.th.faint, halo: false }); });
    }
    out += group(g, clamp(p * 1.3));
  });
  const t = word(F, steps, "title");
  if (t) out += title(F, t, word(F, steps, "sub"));
  // The verdict sits under the cards (in its own band on 9:16 clips).
  if (F.L.verdict) return out + verdictOf(F, steps);
  out += crossfade(F, steps, "verdict", (tv, op) => {
    const tone = valueAt(steps, Math.max(0, F.k), "tone");
    const col = F.color(isTone(tone) ? tone : "accent");
    const y = box.y0 + rowsN * (ch + gap);
    const size = 12 * u;
    const lines = wrap(str(tv), box.x1 - box.x0 - 30 * u, size, 500).slice(0, 3);
    const hh = Math.max(vh - gap, lines.length * size * 1.3 + 16 * u);
    let g = rect(box.x0, y, box.x1 - box.x0, hh, { fill: F.th.panel, rx: 10 * u, opacity: 0.95 });
    g += rect(box.x0, y, box.x1 - box.x0, hh, { stroke: col, sw: 1 * u, rx: 10 * u, opacity: 0.5 });
    g += rect(box.x0 + 8 * u, y + 8 * u, 3 * u, hh - 16 * u, { fill: col, rx: 1.5 * u });
    lines.forEach((l, k) => { g += text(F, box.x0 + 20 * u, y + 8 * u + size * (1 + k * 1.3), l, { size, weight: 500, fill: F.th.ink, halo: false }); });
    return group(g, op);
  });
  return out;
};

// ------------------------------------------------------------------ the registry


// ------------------------------------------------------------------ candles
// A strategy's recent path as candles (DEC-0075): params.candles is [open, high, low, close]
// per period, oldest first, from real results. The candles draw in left to right from s = -1
// to 0; a dashed line marks the first open, and the last close carries a pill with the change.
const candles: Scene = (v, F) => {
  const P = v.params ?? {};
  const raw = Array.isArray(P.candles) ? (P.candles as unknown[]) : [];
  const cs = raw.map((c) => (Array.isArray(c) ? c.map(Number) : [])).filter((c) => c.length === 4 && c.every(Number.isFinite)) as number[][];
  if (!cs.length) return "";
  const { x0, x1, y0, y1 } = F.L.plot;
  const lo = Math.min(...cs.map((c) => c[2])), hi = Math.max(...cs.map((c) => c[1]));
  const pad = (hi - lo) * 0.08 || Math.abs(hi) * 0.01 || 1;
  const Y = (val: number) => y1 - ((val - (lo - pad)) / (hi - lo + 2 * pad)) * (y1 - y0);
  const step = (x1 - x0) / cs.length;
  const bw = Math.max(1.5 * F.u, step * 0.62);
  const shown = F.s < 0 ? easeOut(F.s + 1) * cs.length : cs.length;
  let out = line(x0, Y(cs[0][0]), x1, Y(cs[0][0]), { stroke: F.th.par, sw: 1 * F.u, dash: `${3 * F.u} ${3 * F.u}`, opacity: 0.7 });
  cs.forEach((c, i) => {
    const a = clamp(shown - i);
    if (a <= 0) return;
    const up = c[3] >= c[0];
    const col = up ? F.th.pos : F.th.neg;
    const cx = x0 + step * (i + 0.5);
    const top = Y(Math.max(c[0], c[3])), bot = Y(Math.min(c[0], c[3]));
    out += group(line(cx, Y(c[1]), cx, Y(c[2]), { stroke: col, sw: 1.2 * F.u }) +
      rect(cx - bw / 2, top, bw, Math.max(1 * F.u, bot - top), { fill: col, rx: 1 * F.u }), a);
  });
  const first = cs[0][0], lastC = cs[cs.length - 1][3];
  const change = first ? lastC / first - 1 : 0;
  if (shown >= cs.length - 0.01) {
    const label = pctSigned(1)(change);
    const tone: Tone = change >= 0 ? "pos" : "neg";
    // Above the highs of the last few candles, so the label never sits on a candle body.
    const hi = Math.max(...cs.slice(-4).map((c) => c[1]));
    out += text(F, x1, Math.max(y0 + 12 * F.u, Y(hi) - 6 * F.u), label, { size: 12 * F.u, weight: 700, fill: F.color(tone), anchor: "end" });
  }
  return out;
};

export const SCENES: Record<string, Scene> = { equity, split, underwater, distribution, heatmap, regimes, scorecard, candles };
export const SCENE_KINDS = Object.keys(SCENES);

/** Frame options per kind: which bands of the canvas a scene needs. */
function frameOptions(kind: string, o: RenderOptions): FrameOptions {
  const pillsRoom = kind === "equity" || kind === "underwater" || kind === "heatmap";
  return { size: o.size, theme: o.theme, pills: pillsRoom, xAxis: kind !== "regimes" && kind !== "scorecard" };
}

function isClip(vp: Viewport): boolean {
  return vp.w > 600;
}

/** The SVG markup (no outer <svg>) for a visual at position s. */
export function renderSignature(v: SigVisual, s: number, o: RenderOptions = {}): string {
  const scene = SCENES[v.kind];
  const vp = viewport(o.size);
  const F = frame(s, Math.max(0, v.steps.length - 1), frameOptions(v.kind, o));
  let out = "";
  if (o.background ?? isClip(vp)) out += background(F);
  if (o.brand) {
    const u = F.u, y = Math.max(16 * u, F.L.head.y0 - 22 * u);
    out += text(F, F.L.head.x0, y, o.brand, { size: 11 * u, fill: F.th.muted, weight: 600, track: 1.5 * u, halo: false });
    const tag = str(v.params?.tag);
    if (tag) out += text(F, F.L.head.x1, y, tag, { size: 11 * u, fill: F.th.faint, anchor: "end", track: 0.6 * u, halo: false });
    out += line(F.L.head.x0, y + 9 * u, F.L.head.x1, y + 9 * u, { stroke: F.th.grid, opacity: F.th.gridOpacity * 2 });
  }
  if (scene) out += scene(v, F);
  if (o.captions ?? isClip(vp)) out += crossfade(F, v.steps, "caption", (t, op) => caption(F, str(t), { opacity: op }));
  return out;
}

/** A whole SVG document for a visual at position s, with its title for screen readers. */
export function signatureSvg(v: SigVisual, s: number, o: RenderOptions = {}, label = v.alt): string {
  const vp = viewport(o.size);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vp.w} ${vp.h}" width="${vp.w}" height="${vp.h}" role="img"><title>${esc(label)}</title>${renderSignature(v, s, o)}</svg>`;
}

// ------------------------------------------------------------------ the data table (text alternative)

export interface SigTable { caption: string; head: string[]; rows: string[][] }

/** Up to `max` evenly spaced indices from 0 to n-1, always with both ends. */
function sample(n: number, max: number): number[] {
  if (n <= max) return Array.from({ length: n }, (_, i) => i);
  return Array.from({ length: max }, (_, k) => Math.round((k * (n - 1)) / (max - 1)));
}

/** Indices for table rows. When several points share a label (months labelled by year), one row per label. */
function samplePoints(P: Record<string, unknown>, n: number, max: number): number[] {
  const labels = Array.isArray(P.labels) ? (P.labels as unknown[]).map((x) => String(x)) : null;
  if (!labels) return sample(n, max);
  const firsts: number[] = [];
  for (let i = 0; i < n; i++) if (i === 0 || labels[i] !== labels[i - 1]) firsts.push(i);
  return firsts.length === n ? sample(n, max) : sample(firsts.length, max).map((k) => firsts[k]);
}

/** The numbers behind a visual as a table: the text alternative every chart carries (WCAG 1.1.1). */
export function signatureTable(v: SigVisual, max = 14): SigTable | null {
  const P = v.params ?? {};
  const cell = (f: Fmt, x: number) => (Number.isFinite(x) ? f(x) : "n/a");
  switch (v.kind) {
    case "candles": {
      const cs = (Array.isArray(P.candles) ? (P.candles as unknown[]) : []).filter((c): c is number[] => Array.isArray(c) && c.length === 4);
      if (!cs.length) return null;
      const labels = Array.isArray(P.labels) ? (P.labels as string[]) : [];
      const f = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : "n/a");
      return { caption: v.alt, head: ["Period", "Open", "High", "Low", "Close"], rows: sample(cs.length, max).map((i) => [labels[i] ?? String(i + 1), f(cs[i][0]), f(cs[i][1]), f(cs[i][2]), f(cs[i][3])]) };
    }
    case "equity": {
      const S = seriesOf(P), fm = fmtOf(P.fmt);
      if (!S.length) return null;
      const n = Math.max(...S.map((s) => s.values.length));
      const own = S.filter((s) => !s.crowd), crowd = S.filter((s) => s.crowd);
      const name = str(P.crowdLabel, "background paths");
      const ext = (i: number, f: (...x: number[]) => number) => f(...crowd.map((s) => s.values[i]).filter(Number.isFinite));
      const head = ["Point", ...own.map((s) => s.label), ...(crowd.length ? [`Highest of ${crowd.length} ${name}`, `Lowest of ${crowd.length} ${name}`] : [])];
      return { caption: v.alt, head, rows: samplePoints(P, n, max).map((i) => [pointLabel(P, i), ...own.map((s) => cell(fm, s.values[i])), ...(crowd.length ? [cell(fm, ext(i, Math.max)), cell(fm, ext(i, Math.min))] : [])]) };
    }
    case "split": {
      const L = obj(P.left), R = obj(P.right), fm = fmtOf(P.fmt);
      const a = gappy(L.values), b = gappy(R.values);
      const n = Math.max(a.length, b.length);
      return { caption: v.alt, head: ["Point", str(L.title, "Left"), str(R.title, "Right")], rows: samplePoints(P, n, max).map((i) => [pointLabel(P, i), cell(fm, a[i]), cell(fm, b[i])]) };
    }
    case "underwater": {
      const values = gappy(P.values);
      const dd = values.length ? drawdownOf(values) : gappy(P.drawdown);
      let w = 0;
      dd.forEach((x, i) => { if (x < dd[w]) w = i; });
      const rows = samplePoints(P, dd.length, max).map((i) => [pointLabel(P, i), cell(pct(0), dd[i])]);
      rows.push([`Worst, ${pointLabel(P, w)}`, cell(pct(0), dd[w])]);
      return { caption: v.alt, head: ["Point", "Below the high"], rows };
    }
    case "distribution": {
      const h = histOf(P), fm = fmtOf(P.fmt ?? "num2");
      if (!h) return null;
      const group2 = Math.ceil(h.counts.length / max);
      const rows: string[][] = [];
      for (let i = 0; i < h.counts.length; i += group2) {
        const j = Math.min(h.counts.length, i + group2);
        rows.push([`${fm(h.edges[i])} to ${fm(h.edges[j])}`, String(h.counts.slice(i, j).reduce((a, b) => a + b, 0))]);
      }
      const M = obj(P.marker), B = obj(P.band);
      if (Number.isFinite(num(B.lo, NaN))) rows.push([str(B.label, "95% range"), `${fm(num(B.lo, 0))} to ${fm(num(B.hi, 0))}`]);
      if (Number.isFinite(num(M.value, NaN))) rows.push([str(M.label, "This result"), fm(num(M.value, 0))]);
      return { caption: v.alt, head: ["Range", "Count"], rows };
    }
    case "heatmap": {
      const rows = list(P.rows).map((r) => ({ label: str(r.label), values: gappy(r.values) }));
      const fm = fmtOf(P.fmt ?? "num2");
      const n = Math.max(0, ...rows.map((r) => r.values.length));
      return { caption: v.alt, head: ["Point", ...rows.map((r) => r.label)], rows: samplePoints(P, n, max).map((i) => [pointLabel(P, i), ...rows.map((r) => cell(fm, r.values[i]))]) };
    }
    case "regimes": {
      const fm = fmtOf(P.fmt ?? "pctSigned");
      const items = list(P.items);
      const hasB = items.some((x) => Number.isFinite(num(x.benchmark, NaN)));
      return {
        caption: v.alt, head: hasB ? ["Kind of market", "Strategy", "Benchmark", "Result"] : ["Kind of market", "Strategy", "Result"],
        rows: items.map((x) => {
          const sv = num(x.strategy, NaN), bv = num(x.benchmark, NaN);
          const win = Number.isFinite(bv) ? sv > bv : sv > 0;
          return hasB ? [str(x.label), cell(fm, sv), cell(fm, bv), win ? "Won" : "Lost"] : [str(x.label), cell(fm, sv), win ? "Won" : "Lost"];
        }),
      };
    }
    case "scorecard": {
      const stats = list(P.stats);
      return { caption: v.alt, head: ["Measure", "Value", "Note"], rows: stats.map((x) => [str(x.label), str(x.text) || cell(fmtOf(x.fmt ?? "num2"), num(x.value, NaN)), str(x.note)]) };
    }
    default: return null;
  }
}

