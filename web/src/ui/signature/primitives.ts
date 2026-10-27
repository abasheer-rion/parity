// The signature chart parts: the big number, axes, the dashed par line, lines that draw in
// with a leading dot and a value pill, area fills, callouts, regime bands and the verdict
// card. Each returns SVG markup for one frame.
import { clamp, circle, decimate, group, lerp, line, path, r1, rect, text, textWidth, type Frame } from "./core.ts";
import { niceTicks, type Scales } from "./camera.ts";
import type { Box, Tone } from "./theme.ts";

/** Splits text into lines that fit `width` at `size`. */
export function wrap(t: string, width: number, size: number, weight = 400): string[] {
  const out: string[] = [];
  let cur = "";
  for (const word of t.split(/\s+/).filter(Boolean)) {
    const next = cur ? `${cur} ${word}` : word;
    if (cur && textWidth(next, size, weight) > width) { out.push(cur); cur = word; } else cur = next;
  }
  if (cur) out.push(cur);
  return out;
}

// ------------------------------------------------------------------ the big number

export interface Stat { value: string; label: string; tone?: Tone }

/**
 * One huge number with a small label under it, top left. Up to two smaller stats sit to its
 * right. Semantic colour only: the number takes its tone, labels stay grey.
 */
export function headline(F: Frame, main: Stat | null, side: Stat[] = [], o: { opacity?: number; maxSide?: number } = {}): string {
  const { head } = F.L;
  if (head.y1 - head.y0 < 10 || !main) return "";
  const u = F.u, hH = head.y1 - head.y0;
  const big = Math.min(36 * u, hH * 0.62);
  const lab = Math.max(10.5 * u, big * 0.3);
  const base = head.y0 + big * 0.92;
  let out = text(F, head.x0 - big * 0.03, base, main.value, { size: big, weight: 650, fill: main.tone ? F.color(main.tone) : F.th.ink, halo: false, track: -big * 0.02 });
  out += text(F, head.x0, base + lab * 1.7, main.label, { size: lab, fill: F.th.muted, halo: false, track: 0.2 * u });
  // Side stats, right aligned, one above the other.
  const mainW = Math.max(textWidth(main.value, big, 650), textWidth(main.label, lab));
  let x = head.x1;
  const sideBig = big * 0.5;
  for (const st of side.slice(0, o.maxSide ?? 2)) {
    const w = Math.max(textWidth(st.value, sideBig, 600), textWidth(st.label, lab));
    if (x - w < head.x0 + mainW + 16 * u) break;
    out += text(F, x, base - sideBig * 0.05, st.value, { size: sideBig, weight: 600, fill: st.tone ? F.color(st.tone) : F.th.text, anchor: "end", halo: false });
    out += text(F, x, base + lab * 1.7, st.label, { size: lab, fill: F.th.muted, anchor: "end", halo: false, track: 0.2 * u });
    x -= w + 18 * u;
  }
  return group(out, o.opacity ?? 1);
}

/** A title in place of the big number, for pictures that teach a shape rather than a value. */
export function title(F: Frame, t: string, sub = "", o: { opacity?: number; tone?: Tone } = {}): string {
  const { head } = F.L;
  if (head.y1 - head.y0 < 10 || !t) return "";
  const u = F.u, size = Math.min(19 * u, (head.y1 - head.y0) * 0.36);
  const lines = wrap(t, head.x1 - head.x0, size, 600).slice(0, 2);
  let out = lines.map((l, i) => text(F, head.x0, head.y0 + size * (1.05 + i * 1.2), l, { size, weight: 600, fill: o.tone ? F.color(o.tone) : F.th.ink, halo: false })).join("");
  if (sub) out += text(F, head.x0, head.y0 + size * (1.05 + lines.length * 1.2) + 2 * u, sub, { size: 10.5 * u, fill: F.th.muted, halo: false, track: 0.2 * u });
  return group(out, o.opacity ?? 1);
}

// ------------------------------------------------------------------ axes and the par line

export interface AxisOptions {
  yFmt: (v: number) => string;
  /** Labels along the bottom: fixed [x, label] pairs, or a formatter for round x values. */
  xTicks?: [number, string][];
  xFmt?: (v: number) => string;
  yCount?: number;
  xCount?: number;
  /** Draw no y labels (bars carry their own numbers). */
  yLabels?: boolean;
  /** Leave the y labels out here, to draw them on top of the lines later with `yAxisLabels`. */
  yLabelsLater?: boolean;
}

/** Faint grid lines with their values sitting on them at the left, and labels along the bottom. */
/** The y labels alone, each on a small backing so a line passing under it cannot hide it (WCAG 1.4.3). */
export function yAxisLabels(F: Frame, sc: Scales, o: Pick<AxisOptions, "yFmt" | "yCount">): string {
  const { box, d } = sc;
  const u = F.u;
  let out = "";
  for (const v of niceTicks(d.y0, d.y1, o.yCount ?? (box.y1 - box.y0 > 200 * u ? 5 : 4))) {
    const y = sc.y(v);
    if (y < box.y0 - 1 || y > box.y1 + 1 || y - box.y0 <= 9 * u) continue;
    const edge = clamp(Math.min(y - box.y0 + 4 * u, box.y1 - y + 10 * u) / (10 * u));
    const t = o.yFmt(v), w = textWidth(t, 10 * u);
    out += rect(box.x0 - 2 * u, y - 13 * u, w + 4 * u, 12 * u, { fill: F.th.halo, rx: 2 * u, opacity: 0.88 * edge });
    out += text(F, box.x0, y - 3.5 * u, t, { size: 10 * u, fill: F.th.faint, opacity: edge, halo: false });
  }
  return out;
}

export function axes(F: Frame, sc: Scales, o: AxisOptions): string {
  const { box, d } = sc;
  const u = F.u;
  let out = "";
  const ticks = niceTicks(d.y0, d.y1, o.yCount ?? (box.y1 - box.y0 > 200 * u ? 5 : 4));
  for (const v of ticks) {
    const y = sc.y(v);
    if (y < box.y0 - 1 || y > box.y1 + 1) continue;
    // Fade grid lines and labels that sit right at the top or bottom edge as the camera moves.
    const edge = clamp(Math.min(y - box.y0 + 4 * u, box.y1 - y + 10 * u) / (10 * u));
    out += line(box.x0, y, box.x1 + F.L.right * 0.15, y, { stroke: F.th.grid, opacity: F.th.gridOpacity * edge });
    if (o.yLabels !== false && !o.yLabelsLater && y - box.y0 > 9 * u) out += text(F, box.x0, y - 3.5 * u, o.yFmt(v), { size: 10 * u, fill: F.th.faint, opacity: edge });
  }
  const bottom = box.y1 + 14 * u;
  if (o.xTicks) {
    for (const [xv, l] of o.xTicks) {
      const x = sc.x(xv);
      if (x < box.x0 - 1 || x > box.x1 + 1) continue;
      const anchor = x - box.x0 < 20 * u ? "start" : box.x1 - x < 20 * u ? "end" : "middle";
      out += text(F, x, bottom, l, { size: 10 * u, fill: F.th.faint, anchor, halo: false });
    }
  } else if (o.xFmt) {
    const xt = niceTicks(d.x0, d.x1, o.xCount ?? 5);
    for (const xv of xt) {
      const x = sc.x(xv);
      if (x < box.x0 - 1 || x > box.x1 + 1) continue;
      const fade = clamp((box.x1 - x + 2) / (18 * u));
      const anchor = x - box.x0 < 14 * u ? "start" : "middle";
      out += text(F, x, bottom, o.xFmt(xv), { size: 10 * u, fill: F.th.faint, anchor, halo: false, opacity: fade });
    }
  }
  return out;
}

/** The dashed par line: the benchmark or zero everything is measured against. */
export function parLine(F: Frame, sc: Scales, value: number, label = "", o: { opacity?: number; labelSide?: "left" | "right" } = {}): string {
  const y = sc.y(value);
  const { box } = sc;
  if (y < box.y0 - 1 || y > box.y1 + 1) return "";
  const u = F.u;
  let out = line(box.x0, y, box.x1, y, { stroke: F.th.par, sw: 1.2 * u, dash: `${r1(5 * u)} ${r1(4 * u)}`, opacity: 0.85 });
  if (label) {
    const right = o.labelSide !== "left";
    out += text(F, right ? box.x1 : box.x0 + 2 * u, y + 13 * u > box.y1 + 2 * u ? y - 5 * u : y + 13 * u, label, { size: 10 * u, fill: F.th.muted, anchor: right ? "end" : "start" });
  }
  return group(out, o.opacity ?? 1);
}

// ------------------------------------------------------------------ lines

export interface LineSpec {
  values: number[];
  /** x of each value (default 0, 1, 2...). */
  xs?: number[];
  /** Draw up to this x (a fraction of a step draws part of the next segment). */
  to?: number;
  from?: number;
  color: string;
  width?: number;
  opacity?: number;
  dash?: string;
  /** Soft fill under the line, down to `areaTo` (default the bottom of the plot). */
  area?: number;
  areaTo?: number;
  /** The leading dot with its halo at the tip. */
  dot?: boolean;
  smooth?: boolean;
}

export interface Tip { x: number; y: number; v: number; xv: number }

/** The points of a line up to x = `to`, with the tip interpolated inside the last segment. */
export function linePoints(l: LineSpec, sc: Scales): { pts: [number, number][]; tip: Tip | null } {
  const v = l.values, xs = l.xs;
  const to = l.to ?? (xs ? xs[xs.length - 1] : v.length - 1);
  const from = l.from ?? -Infinity;
  const pts: [number, number][] = [];
  let tip: Tip | null = null;
  for (let i = 0; i < v.length; i++) {
    const xv = xs ? xs[i] : i;
    if (!Number.isFinite(v[i])) continue;
    if (xv < from) continue;
    if (xv > to + 1e-9) {
      if (i > 0 && pts.length) {
        const px = xs ? xs[i - 1] : i - 1;
        const t = clamp((to - px) / (xv - px));
        const yv = lerp(v[i - 1], v[i], t);
        pts.push([sc.x(to), sc.y(yv)]);
        tip = { x: sc.x(to), y: sc.y(yv), v: yv, xv: to };
      }
      break;
    }
    pts.push([sc.x(xv), sc.y(v[i])]);
    tip = { x: sc.x(xv), y: sc.y(v[i]), v: v[i], xv };
  }
  return { pts, tip };
}

/** A line drawn in up to `to`, with an optional soft area and a leading dot. */
export function drawLine(F: Frame, sc: Scales, l: LineSpec): { svg: string; tip: Tip | null } {
  const op = l.opacity ?? 1;
  if (op < 0.01) return { svg: "", tip: null };
  const { pts, tip } = linePoints(l, sc);
  if (pts.length < 1 || !tip) return { svg: "", tip: null };
  const p = decimate(pts);
  let out = "";
  if (l.area && p.length > 1) {
    const base = l.areaTo != null ? sc.y(l.areaTo) : sc.box.y1;
    out += `<path d="${path([[p[0][0], base], ...p, [p[p.length - 1][0], base]])}Z" fill="${l.color}" opacity="${r1(l.area * op * 100) / 100}"/>`;
  }
  if (p.length > 1) out += `<path d="${path(p)}" fill="none" stroke="${l.color}" stroke-width="${r1((l.width ?? 2.4) * F.u)}" stroke-linejoin="round" stroke-linecap="round"${l.dash ? ` stroke-dasharray="${l.dash}"` : ""}${op < 0.995 ? ` opacity="${r1(op * 100) / 100}"` : ""}/>`;
  if (l.dot) out += leadDot(F, tip.x, tip.y, l.color, op);
  return { svg: out, tip };
}

/** The dot at a line's tip, with a soft halo. */
export function leadDot(F: Frame, x: number, y: number, color: string, opacity = 1): string {
  const u = F.u;
  return circle(x, y, 8 * u, color, 0.18 * opacity) + circle(x, y, 3.6 * u, color, opacity) + circle(x, y, 1.4 * u, F.th.ink, 0.9 * opacity);
}

export interface Pill { x: number; y: number; value: string; label?: string; color: string; opacity?: number }

/**
 * Value pills riding the line tips: placed right of each tip, pushed apart so they never
 * overlap, kept inside the canvas, and flipped to the left of the tip when there is no room.
 */
export function pills(F: Frame, items: Pill[], bounds?: Box): string {
  const u = F.u, size = 11 * u, h = 17 * u, gap = 3 * u;
  const b = bounds ?? { x0: 0, y0: F.L.plot.y0 - 4 * u, x1: F.w - 6 * u, y1: F.L.plot.y1 + 6 * u };
  const placed = items.filter((it) => (it.opacity ?? 1) > 0.01).map((it) => ({ ...it, py: it.y })).sort((a, c) => a.py - c.py);
  // Push down, then back up as a block if the stack ran out of room.
  for (let i = 0; i < placed.length; i++) placed[i].py = Math.max(placed[i].py, i ? placed[i - 1].py + h + gap : b.y0 + h / 2);
  const over = placed.length ? placed[placed.length - 1].py - (b.y1 - h / 2) : 0;
  if (over > 0) for (let i = placed.length - 1; i >= 0; i--) placed[i].py = Math.min(placed[i].py - over, i < placed.length - 1 ? placed[i + 1].py - h - gap : Infinity);
  let out = "";
  for (const it of placed) {
    const lab = it.label ? `${it.label} ` : "";
    // A little wider than the estimate, with the text centred, so a fallback font that runs
    // wider than Inter still sits inside the pill (the text needs the pill behind it for contrast).
    const w = (textWidth(lab, size * 0.92) + textWidth(it.value, size, 650)) * 1.08 + 16 * u;
    let x = it.x + 9 * u;
    if (x + w > b.x1) x = it.x - 9 * u - w;
    x = Math.max(b.x0 + 2 * u, x);
    const y = it.py - h / 2;
    let g = "";
    // A short tie from the tip to a pill that was pushed away from it.
    if (Math.abs(it.py - it.y) > h * 0.6) g += line(it.x, it.y, x < it.x ? x + w : x, it.py, { stroke: it.color, sw: 1 * u, opacity: 0.5 });
    g += rect(x, y, w, h, { fill: it.color, rx: h / 2 });
    g += `<text x="${r1(x + w / 2)}" y="${r1(y + h / 2 + size * 0.36)}" font-size="${r1(size)}" text-anchor="middle" fill="${F.th.onFill}" font-family="${F.th.font}" style="font-variant-numeric:tabular-nums">${it.label ? `<tspan font-size="${r1(size * 0.92)}" opacity="0.72">${escT(lab)}</tspan>` : ""}<tspan font-weight="650">${escT(it.value)}</tspan></text>`;
    out += group(g, it.opacity ?? 1);
  }
  return out;
}

const escT = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// ------------------------------------------------------------------ callouts, bands, verdict

export interface Callout {
  /** The point being called out, in pixels. */
  x: number; y: number;
  value: string;
  label?: string;
  color: string;
  /** Where the label sits relative to the point. Default: away from the nearer edges. */
  dx?: number; dy?: number;
  opacity?: number;
}

/** A ring on a point, a leader line, and a label with a bold value. */
export function callout(F: Frame, c: Callout): string {
  const op = c.opacity ?? 1;
  if (op < 0.01) return "";
  const u = F.u, { plot } = F.L;
  const size = 13 * u, lab = 10.5 * u;
  const w = Math.max(textWidth(c.value, size, 650), c.label ? textWidth(c.label, lab) : 0);
  const left = c.dx != null ? c.dx < 0 : c.x > (plot.x0 + plot.x1) / 2;
  const below = c.dy != null ? c.dy > 0 : c.y < plot.y0 + (plot.y1 - plot.y0) * 0.35;
  const dx = c.dx ?? (left ? -26 * u : 26 * u), dy = c.dy ?? (below ? 30 * u : -26 * u);
  const lx = c.x + dx, ly = c.y + dy;
  let tx = left ? lx - 4 * u : lx + 4 * u;
  tx = left ? Math.max(tx, w + 4 * u) : Math.min(tx, F.w - w - 4 * u);
  const anchor = left ? "end" : "start";
  let out = `<circle cx="${r1(c.x)}" cy="${r1(c.y)}" r="${r1(6.5 * u)}" fill="none" stroke="${c.color}" stroke-width="${r1(1.5 * u)}"/>`;
  out += line(c.x + Math.sign(dx) * 6.5 * u * 0.7, c.y + Math.sign(dy) * 6.5 * u * 0.7, lx, ly, { stroke: c.color, sw: 1.1 * u, opacity: 0.8 });
  out += line(lx, ly, left ? lx - 3 * u : lx + 3 * u, ly, { stroke: c.color, sw: 1.1 * u, opacity: 0.8 });
  const vy = below ? ly + size * 0.75 : ly - (c.label ? lab * 1.35 : 0) + size * 0.32;
  out += text(F, tx, vy, c.value, { size, weight: 650, fill: c.color, anchor });
  if (c.label) out += text(F, tx, vy + lab * 1.35, c.label, { size: lab, fill: F.th.text, anchor });
  return group(out, op);
}

export interface Band { from: number; to: number; label?: string; tone: Tone }

/** Shaded stretches of the x axis (regimes), each with a small label along its top. */
export function bands(F: Frame, sc: Scales, list: Band[], o: { opacity?: number; labels?: boolean } = {}): string {
  const op = o.opacity ?? 1;
  if (op < 0.01) return "";
  const { box } = sc, u = F.u;
  let out = "";
  for (const b of list) {
    const x0 = Math.max(box.x0, sc.x(b.from)), x1 = Math.min(box.x1, sc.x(b.to));
    if (x1 - x0 < 0.5) continue;
    const col = F.color(b.tone);
    out += rect(x0, box.y0, x1 - x0, box.y1 - box.y0, { fill: col, opacity: 0.1 });
    out += line(x0, box.y1, x1, box.y1, { stroke: col, sw: 2 * u, opacity: 0.8 });
    if (b.label && o.labels !== false && x1 - x0 > 14 * u && x0 + textWidth(b.label, 10 * u) < box.x1 + F.L.right) out += text(F, x0 + 4 * u, box.y0 + 11 * u, b.label, { size: 10 * u, fill: col, weight: 600 });
  }
  return group(out, op);
}

/**
 * The verdict card: the lesson's takeaway in a quiet panel with a tone bar. It sits in the
 * head band to the right of the big number when there is room, else over the plot.
 */
export function verdict(F: Frame, t: string, o: { tone?: Tone; opacity?: number; where?: "head" | "plot"; reserve?: number } = {}): string {
  const op = o.opacity ?? 1;
  if (op < 0.01 || !t) return "";
  const u = F.u, { head, plot } = F.L;
  const size = 11.5 * u, lh = size * 1.32;
  const col = F.color(o.tone ?? "accent");
  const vb = F.L.verdict;
  if (vb) {
    // 9:16 clips: the card has a band of its own between the chart and the caption, larger.
    const vs = 14 * u, vlh = vs * 1.3;
    const vw = vb.x1 - vb.x0;
    const vl = wrap(t, vw - 30 * u, vs, 500).slice(0, 3);
    const vh = vl.length * vlh + 18 * u;
    const vy = vb.y0 + (1 - op) * 6 * u;
    let g = rect(vb.x0, vy, vw, vh, { fill: F.th.panel, rx: 10 * u, opacity: 0.96 });
    g += rect(vb.x0, vy, vw, vh, { rx: 10 * u, stroke: col, sw: 1 * u, opacity: 0.45 });
    g += rect(vb.x0 + 8 * u, vy + 8 * u, 3.5 * u, vh - 16 * u, { fill: col, rx: 1.75 * u });
    vl.forEach((l, i) => { g += text(F, vb.x0 + 22 * u, vy + 9 * u + vlh * (i + 0.8), l, { size: vs, weight: 500, fill: F.th.ink, halo: false }); });
    return group(g, op);
  }
  const headW = head.x1 - head.x0 - (o.reserve ?? 150 * u);
  let where = o.where ?? (head.y1 - head.y0 > 30 * u && headW > 170 * u ? "head" : "plot");
  let w = where === "head" ? Math.min(headW, 250 * u) : Math.min(plot.x1 - plot.x0 + F.L.right - 20 * u, 300 * u);
  let lines = wrap(t, w - 22 * u, size, 500);
  if (where === "head" && lines.length * lh + 14 * u > head.y1 - head.y0 + 10 * u) { where = "plot"; w = Math.min(plot.x1 - plot.x0 + F.L.right - 20 * u, 300 * u); lines = wrap(t, w - 22 * u, size, 500); }
  const h = lines.length * lh + 14 * u;
  const x = where === "head" ? head.x1 - w : (plot.x0 + plot.x1 + F.L.right) / 2 - w / 2;
  const y = where === "head" ? head.y0 + Math.max(0, (head.y1 - head.y0 - h) / 2) : plot.y0 + 6 * u;
  // A small rise as it fades in (none at whole steps, so stills are exact).
  const rise = (1 - op) * 6 * u;
  let out = rect(x, y + rise, w, h, { fill: F.th.panel, rx: 9 * u, opacity: 0.96 });
  out += rect(x, y + rise, w, h, { rx: 9 * u, stroke: col, sw: 1 * u, opacity: 0.45 });
  out += rect(x + 7 * u, y + rise + 7 * u, 3 * u, h - 14 * u, { fill: col, rx: 1.5 * u });
  lines.forEach((l, i) => { out += text(F, x + 17 * u, y + rise + 7 * u + lh * (i + 0.78), l, { size, weight: 500, fill: F.th.ink, halo: false }); });
  return group(out, op);
}

/** Burned-in caption for clips, in the foot band. */
export function caption(F: Frame, t: string, o: { opacity?: number } = {}): string {
  const { foot } = F.L;
  if (foot.y1 - foot.y0 < 10 || !t) return "";
  const size = 15 * F.u;
  const lines = wrap(t, foot.x1 - foot.x0, size, 600).slice(0, 4);
  return group(lines.map((l, i) => text(F, (foot.x0 + foot.x1) / 2, foot.y0 + size * (1 + i * 1.3), l, { size, weight: 600, fill: F.th.ink, anchor: "middle", halo: false })).join(""), o.opacity ?? 1);
}

/** The clip background: a near-black field with a soft lighter middle. */
export function background(F: Frame): string {
  return `<defs><radialGradient id="sg-vignette" cx="50%" cy="42%" r="70%"><stop offset="0" stop-color="${F.th.bgGlow}"/><stop offset="1" stop-color="${F.th.bg}"/></radialGradient></defs>`
    + `<rect width="${F.w}" height="${F.h}" fill="url(#sg-vignette)"/>`;
}
