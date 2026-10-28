// Draws any moment of a motion reel (DEC-0085) as SVG: the brand strip, the big line at the
// top, the shot (the lesson's signature chart under a moving camera, a statement, a grid of
// paths or panels side by side), and on clips the burned-in caption and the risk line.
//
// Cuts: when the shot changes, the old picture pushes in and blurs away sideways while the
// new one settles in, in 0.4 seconds. The big line swaps with the same blur. The film opens
// from black and closes to black, so it loops cleanly.
//
// Node loads this file with `node --experimental-strip-types`: imports with their .ts
// extension, and only type syntax that can be stripped.
import { clamp, decimate, easeInOut, easeOut, esc, lerp, path, r1, r2, textWidth } from "../signature/core.ts";
import { fmtOf, renderSignature, seriesValues, tipAt, type SigVisual } from "../signature/scenes.ts";
import { THEMES, toneColor, type Tone, type Viewport } from "../signature/theme.ts";
import { RAW } from "../tokens.gen.ts";
import { beatAt, pageAt, type PlannedBeat, type Reel, type ReelHead, type ReelPlan, type ReelShot } from "./timeline.ts";

export type ReelSize = "wide" | "square" | "vertical";
export interface ReelCanvas { name: ReelSize; w: number; h: number; u: number }

export const REEL_SIZES: Record<ReelSize, ReelCanvas> = {
  // The Academy lesson film, 16:9.
  wide: { name: "wide", w: 960, h: 540, u: 1.9 },
  // Clips: 1:1 and 9:16 (TikTok, Reels, Shorts).
  square: { name: "square", w: 1080, h: 1080, u: 2.3 },
  vertical: { name: "vertical", w: 1080, h: 1920, u: 2.5 },
};

export interface ReelRenderOptions {
  size?: ReelSize;
  /** Burn the caption into the picture (clips). The app shows it as real text over the picture. */
  captions?: boolean;
  /** The risk line at the foot of every frame (clips). */
  risk?: string;
  /** A prefix for ids inside the SVG, unique for each player on a page. */
  id?: string;
}

interface Box { x0: number; y0: number; x1: number; y1: number }
interface Zones { strip: number; headY: number; headSize: number; subY: number; stage: Box; capY: number; capSize: number; riskY: number; statement: number }

const TH = THEMES.dark;
/** Mask white: fully shown. */
const WHITE = RAW["palette-white"];
/** Seconds a cut and a change of the big line take. */
const CUT = 0.4, SWAP = 0.32;
/** The film fades in from black and out to black at its ends. */
const OPEN = 0.35, CLOSE = 0.45;

/** Where things go on each canvas. Shares of the height and width, so every size keeps the same rhythm. */
export function zones(c: ReelCanvas): Zones {
  const { w, h } = c;
  if (c.name === "vertical") {
    return { strip: 0.045 * h, headY: 0.15 * h, headSize: 0.05 * h, subY: 0.15 * h + 0.032 * h, stage: { x0: 0.035 * w, y0: 0.205 * h, x1: 0.965 * w, y1: 0.6 * h }, capY: 0.7 * h, capSize: 0.028 * h, riskY: 0.965 * h, statement: 0.056 * h };
  }
  if (c.name === "square") {
    return { strip: 0.055 * h, headY: 0.16 * h, headSize: 0.078 * h, subY: 0.16 * h + 0.048 * h, stage: { x0: 0.04 * w, y0: 0.245 * h, x1: 0.96 * w, y1: 0.75 * h }, capY: 0.84 * h, capSize: 0.036 * h, riskY: 0.968 * h, statement: 0.088 * h };
  }
  return { strip: 0.065 * h, headY: 0.205 * h, headSize: 0.088 * h, subY: 0.205 * h + 0.058 * h, stage: { x0: 0.045 * w, y0: 0.29 * h, x1: 0.955 * w, y1: 0.8 * h }, capY: 0.905 * h, capSize: 0.043 * h, riskY: 0.978 * h, statement: 0.11 * h };
}

interface T { size: number; fill?: string; weight?: number; anchor?: "start" | "middle" | "end"; mono?: boolean; track?: number; opacity?: number }

function tx(x: number, y: number, t: string, o: T): string {
  if (!t || (o.opacity != null && o.opacity < 0.01)) return "";
  const op = o.opacity != null && o.opacity < 0.995 ? ` opacity="${r2(o.opacity)}"` : "";
  return `<text x="${r1(x)}" y="${r1(y)}" font-size="${r1(o.size)}" fill="${o.fill ?? TH.ink}" text-anchor="${o.anchor ?? "start"}" font-weight="${o.weight ?? 400}"${o.track ? ` letter-spacing="${r2(o.track)}"` : ""}${op} font-family="${o.mono ? TH.mono : TH.font}" style="font-variant-numeric:tabular-nums">${esc(t)}</text>`;
}

const color = (t: Tone | undefined, d = TH.ink) => (t ? toneColor(TH, t) : d);

/** The visual a shot draws: the lesson's own ("main") or one of the reel's. */
export function visualOf(reel: Reel, main: SigVisual, name?: string): SigVisual {
  return !name || name === "main" ? main : reel.visuals?.[name] ?? main;
}

const visualName = (shot: ReelShot): string | undefined => (shot.kind === "statement" ? undefined : shot.visual);

/** Seconds the chart takes to move within a beat: longer for a bigger move, never the whole beat. */
function moveSeconds(b: PlannedBeat): number {
  return clamp(Math.abs(b.s1 - b.s0) * 1.7, 0.9, Math.max(0.9, (b.end - b.start) * 0.85));
}

/** The chart position at second t of a beat. */
export function sAt(b: PlannedBeat, t: number): number {
  if (b.s0 === b.s1) return b.s1;
  return lerp(b.s0, b.s1, easeInOut(clamp((t - b.start - 0.05) / moveSeconds(b))));
}

function camAt(b: PlannedBeat, t: number) {
  const p = easeInOut(clamp((t - b.start) / Math.max(0.1, b.end - b.start)));
  return { z: lerp(b.cam0.z, b.cam1.z, p), x: lerp(b.cam0.x, b.cam1.x, p), y: lerp(b.cam0.y, b.cam1.y, p) };
}

/** A number written for the big line. "int" is a whole count, 1,000. */
function fmtNum(fmt: string | undefined, v: SigVisual, n: number): string {
  if (fmt === "int") return Math.round(n).toLocaleString("en-US");
  return fmtOf(fmt ?? v.params?.fmt)(n);
}

/** The big line's words at second t, with its counting number filled in. */
export function headAt(reel: Reel, main: SigVisual, b: PlannedBeat, t: number): { text: string; sub: string; tone?: Tone } | null {
  const h: ReelHead | null = b.head;
  if (!h) return null;
  const v = visualOf(reel, main, visualName(b.shot));
  let n: number | null = null;
  if (h.tip != null) n = tipAt(v, b.shot.kind === "chart" ? sAt(b, t) : b.s1, h.tip);
  else if (b.count) n = lerp(b.count[0], b.count[1], easeOut(clamp((t - b.start - 0.1) / moveSeconds(b))));
  const num = n != null && Number.isFinite(n) ? fmtNum(h.fmt, v, n) : "";
  const text = (h.text ?? (n != null ? "{n}" : "")).replace("{n}", num);
  return { text, sub: h.sub ?? "", tone: h.tone };
}

// ------------------------------------------------------------------ layers and blur

interface Fx { opacity?: number; scale?: number; cx?: number; cy?: number; blur?: number; dy?: number }

/** Wraps a layer with a fade, a scale about a point and a sideways motion blur. Blur filters go in `defs`. */
function layer(inner: string, fx: Fx, id: string, defs: string[]): string {
  const op = fx.opacity ?? 1;
  if (op < 0.01 || !inner) return "";
  let attrs = "";
  if (op < 0.995) attrs += ` opacity="${r2(op)}"`;
  const k = fx.scale ?? 1, dy = fx.dy ?? 0;
  if (Math.abs(k - 1) > 1e-3 || Math.abs(dy) > 0.05) {
    const cx = fx.cx ?? 0, cy = fx.cy ?? 0;
    attrs += ` transform="translate(${r1(cx)} ${r1(cy + dy)}) scale(${r2(k * 1000) / 1000}) translate(${r1(-cx)} ${r1(-cy)})"`;
  }
  if ((fx.blur ?? 0) > 0.3) {
    defs.push(`<filter id="${id}" x="-15%" y="-30%" width="130%" height="160%"><feGaussianBlur stdDeviation="${r1(fx.blur!)} ${r1(fx.blur! * 0.12)}"/></filter>`);
    attrs += ` filter="url(#${id})"`;
  }
  return attrs ? `<g${attrs}>${inner}</g>` : inner;
}

// ------------------------------------------------------------------ the big line

function headSvg(c: ReelCanvas, Z: Zones, h: { text: string; sub: string; tone?: Tone }): string {
  const t = h.text.toUpperCase();
  const fit = (c.w * 0.9) / Math.max(1, textWidth(t, 1, 800) * 1.06);
  const size = Math.min(Z.headSize, fit);
  let out = tx(c.w / 2, Z.headY, t, { size, weight: 800, fill: color(h.tone), anchor: "middle", track: -size * 0.01 });
  if (h.sub) out += tx(c.w / 2, Z.headY + Math.max(Z.subY - Z.headY, size * 0.72), h.sub.toUpperCase(), { size: 10.5 * c.u, fill: TH.muted, anchor: "middle", mono: true, track: 2.2 * c.u });
  return out;
}

// ------------------------------------------------------------------ shots

function chartShot(reel: Reel, main: SigVisual, c: ReelCanvas, Z: Zones, b: PlannedBeat, t: number, id: string, defs: string[]): string {
  const v = visualOf(reel, main, visualName(b.shot));
  const st = Z.stage, W = st.x1 - st.x0, H = st.y1 - st.y0;
  const vp: Viewport = { name: "reel", w: W, h: H, u: c.u * (c.name === "wide" ? 0.9 : 0.95) };
  const body = renderSignature(v, sAt(b, t), { size: vp, theme: "dark", background: false, captions: false, head: false, verdict: false });
  const cam = camAt(b, t);
  // A slow breath on the zoom, so the picture is never quite still.
  const z = Math.max(1, cam.z) * (1 + 0.012 * Math.sin(t * 0.7));
  const fx = clamp(cam.x * W, W / (2 * z), W - W / (2 * z)), fy = clamp(cam.y * H, H / (2 * z), H - H / (2 * z));
  if (!defs.some((d) => d.includes(`id="${id}-clip"`))) {
    defs.push(`<clipPath id="${id}-clip"><rect x="0" y="${r1(st.y0 - 6 * c.u)}" width="${c.w}" height="${r1(H + 12 * c.u)}"/></clipPath>`);
    defs.push(`<linearGradient id="${id}-edge" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="${WHITE}" stop-opacity="0"/><stop offset="0.04" stop-color="${WHITE}"/><stop offset="0.96" stop-color="${WHITE}"/><stop offset="1" stop-color="${WHITE}" stop-opacity="0"/></linearGradient>`);
    defs.push(`<mask id="${id}-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="${c.w}" height="${c.h}"><rect x="0" y="0" width="${c.w}" height="${c.h}" fill="url(#${id}-edge)"/></mask>`);
  }
  const tr = `translate(${r1(st.x0 + W / 2)} ${r1(st.y0 + H / 2)}) scale(${r2(z * 1000) / 1000}) translate(${r1(-fx)} ${r1(-fy)})`;
  return `<g clip-path="url(#${id}-clip)" mask="url(#${id}-mask)"><g transform="${tr}">${body}</g></g>`;
}

function statementShot(c: ReelCanvas, Z: Zones, b: PlannedBeat, t: number, hasHead: boolean): string {
  if (b.shot.kind !== "statement") return "";
  const lines = b.shot.lines.map((l) => ({ ...l, words: l.text.toUpperCase().split(/\s+/).filter(Boolean) }));
  const widest = Math.max(1, ...lines.map((l) => textWidth(l.words.join(" "), 1, 800)));
  const size = Math.min(Z.statement, (c.w * 0.86) / (widest * 1.06));
  const lh = size * 1.12;
  const mid = hasHead ? (Z.stage.y0 + Z.stage.y1) / 2 : c.h * (c.name === "vertical" ? 0.42 : 0.5);
  const top = mid - (lines.length * lh) / 2 + size * 0.8;
  let out = "", k = 0;
  lines.forEach((l, li) => {
    const y = top + li * lh;
    // One text element per line, so the browser spaces the words; each word lights up in turn
    // and the line pops in with its first word.
    const first = k;
    const spans = l.words.map((w, wi) => {
      const p = easeOut(clamp((t - b.start - 0.1 - (first + wi) * 0.12) / 0.3));
      return `<tspan${p < 0.995 ? ` fill-opacity="${r2(p)}"` : ""}>${esc(w)}${wi < l.words.length - 1 ? " " : ""}</tspan>`;
    }).join("");
    k += l.words.length;
    const p = easeOut(clamp((t - b.start - 0.1 - first * 0.12) / 0.4));
    const line = `<text x="${r1(c.w / 2)}" y="${r1(y)}" font-size="${r1(size)}" fill="${color(l.tone)}" text-anchor="middle" font-weight="800" letter-spacing="${r2(-size * 0.01)}" font-family="${TH.font}">${spans}</text>`;
    out += layer(line, { opacity: Math.min(1, p * 1.6), scale: 1.12 - 0.12 * p, cx: c.w / 2, cy: y - size * 0.35, dy: (1 - p) * 6 * c.u }, "", []);
  });
  return out;
}

/** A colour for series i of a visual: its own tone, or the signature order (accent first). */
function seriesTone(v: SigVisual, i: number): Tone | undefined {
  const P = v.params ?? {};
  if (v.kind === "split") {
    const side = (i === 1 ? P.right : P.left) as { tone?: Tone } | undefined;
    return side?.tone ?? (i === 1 ? "warn" : "accent");
  }
  const s = (Array.isArray(P.series) ? P.series[i] : undefined) as { tone?: Tone; role?: string } | undefined;
  if (s?.tone) return s.tone;
  if (s?.role === "benchmark" || s?.role === "par") return "muted";
  return i === 0 ? "accent" : (["pos", "warn", "alt", "neg"] as Tone[])[(i - 1) % 4];
}

function seriesLabel(v: SigVisual, i: number): string {
  const P = v.params ?? {};
  if (v.kind === "split") return String(((i === 1 ? P.right : P.left) as { title?: string } | undefined)?.title ?? "");
  return String(((Array.isArray(P.series) ? P.series[i] : undefined) as { label?: string } | undefined)?.label ?? "");
}

function spark(vals: number[], to: number, box: Box, lo: number, hi: number, col: string, u: number, o: { area?: boolean; width?: number; dot?: boolean; opacity?: number } = {}): { svg: string; tip: number } {
  const n = vals.length;
  if (n < 2) return { svg: "", tip: NaN };
  const X = (i: number) => box.x0 + (i / (n - 1)) * (box.x1 - box.x0);
  const Y = (v: number) => box.y1 - ((v - lo) / Math.max(1e-9, hi - lo)) * (box.y1 - box.y0);
  const end = clamp(to) * (n - 1);
  const pts: [number, number][] = [];
  for (let i = 0; i <= Math.floor(end); i++) if (Number.isFinite(vals[i])) pts.push([X(i), Y(vals[i])]);
  let tip = vals[Math.floor(end)];
  if (end % 1 > 1e-6 && Math.ceil(end) < n) {
    const a = vals[Math.floor(end)], b2 = vals[Math.ceil(end)];
    tip = lerp(a, b2, end % 1);
    pts.push([X(end), Y(tip)]);
  }
  if (pts.length < 2) return { svg: "", tip };
  const p = decimate(pts, 160);
  const op = o.opacity ?? 1;
  let svg = "";
  if (o.area) svg += `<path d="${path([[p[0][0], box.y1], ...p, [p[p.length - 1][0], box.y1]])}Z" fill="${col}" opacity="${r2(0.12 * op)}"/>`;
  svg += `<path d="${path(p)}" fill="none" stroke="${col}" stroke-width="${r1((o.width ?? 2.2) * u)}" stroke-linejoin="round" stroke-linecap="round"${op < 0.995 ? ` opacity="${r2(op)}"` : ""}/>`;
  if (o.dot !== false) {
    const [x, y] = p[p.length - 1];
    svg += `<circle cx="${r1(x)}" cy="${r1(y)}" r="${r1(7 * u)}" fill="${col}" opacity="${r2(0.2 * op)}"/><circle cx="${r1(x)}" cy="${r1(y)}" r="${r1(3.2 * u)}" fill="${col}"${op < 0.995 ? ` opacity="${r2(op)}"` : ""}/>`;
  }
  return { svg, tip };
}

function panelsShot(reel: Reel, main: SigVisual, c: ReelCanvas, Z: Zones, b: PlannedBeat, t: number): string {
  if (b.shot.kind !== "panels") return "";
  const shot = b.shot;
  const v = visualOf(reel, main, shot.visual);
  const all = shot.series.map((i) => seriesValues(v, i));
  const flat = all.flat().filter(Number.isFinite);
  if (!flat.length) return "";
  let lo = Math.min(...flat), hi = Math.max(...flat);
  const pad = (hi - lo) * 0.08 || 1;
  lo -= pad; hi += pad;
  const m = all.length, u = c.u, st = Z.stage;
  const grid2 = c.name === "vertical" && m === 4;
  const cols = grid2 ? 2 : m, rows = grid2 ? 2 : 1;
  const gap = 14 * u;
  const cw = (st.x1 - st.x0 - gap * (cols - 1)) / cols, ch = (st.y1 - st.y0 - gap * (rows - 1)) / rows;
  const p = lerp(b.d0, b.d1, easeInOut(clamp((t - b.start - 0.05) / Math.min(2.4, Math.max(0.9, (b.end - b.start) * 0.6)))));
  const fm = fmtOf(v.params?.fmt);
  let out = "";
  all.forEach((vals, k) => {
    const cx0 = st.x0 + (k % cols) * (cw + gap), cy0 = st.y0 + Math.floor(k / cols) * (ch + gap);
    const tone = shot.tones?.[k] ?? seriesTone(v, shot.series[k]);
    const col = color(tone, TH.accent);
    const label = shot.labels?.[k] ?? seriesLabel(v, shot.series[k]);
    const appear = easeOut(clamp((t - b.start - k * 0.12) / 0.4));
    let g = "";
    g += `<rect x="${r1(cx0)}" y="${r1(cy0)}" width="${r1(cw)}" height="${r1(ch)}" rx="${r1(10 * u)}" fill="${TH.panel}" opacity="0.5"/>`;
    const labSize = Math.min(10.5 * u, (cw - 16 * u) / Math.max(1, textWidth(label.toUpperCase(), 1) * 1.25));
    g += tx(cx0 + cw / 2, cy0 + 20 * u, label.toUpperCase(), { size: labSize, fill: TH.muted, anchor: "middle", mono: true, track: 1.4 * u });
    const valSize = Math.min(28 * u, ch * 0.16);
    const box: Box = { x0: cx0 + 12 * u, y0: cy0 + 34 * u, x1: cx0 + cw - 12 * u, y1: cy0 + ch - valSize - 26 * u };
    // The starting level, so up and down read at a glance.
    const y0v = vals.find(Number.isFinite) ?? lo;
    const yb = box.y1 - ((y0v - lo) / (hi - lo)) * (box.y1 - box.y0);
    g += `<line x1="${r1(box.x0)}" y1="${r1(yb)}" x2="${r1(box.x1)}" y2="${r1(yb)}" stroke="${TH.par}" stroke-width="${r1(1 * u)}" stroke-dasharray="${r1(4 * u)} ${r1(4 * u)}" opacity="0.6"/>`;
    const sp = spark(vals, p, box, lo, hi, col, u, { area: true });
    g += sp.svg;
    if (Number.isFinite(sp.tip)) g += tx(cx0 + cw / 2, cy0 + ch - 16 * u, fm(sp.tip), { size: valSize, weight: 750, fill: col, anchor: "middle" });
    out += layer(g, { opacity: appear, dy: (1 - appear) * 10 * u }, "", []);
  });
  return out;
}

function gridShot(reel: Reel, main: SigVisual, c: ReelCanvas, Z: Zones, b: PlannedBeat, t: number): string {
  if (b.shot.kind !== "grid") return "";
  const shot = b.shot;
  const v = visualOf(reel, main, shot.visual);
  const all = shot.series.map((i) => seriesValues(v, i));
  const flat = all.flat().filter(Number.isFinite);
  if (!flat.length) return "";
  const lo = Math.min(...flat), hi = Math.max(...flat);
  const n = all.length, u = c.u, st = Z.stage;
  const ratio = c.name === "wide" ? 2.8 : c.name === "square" ? 1.3 : 0.62;
  const cols = Math.max(1, Math.round(Math.sqrt(n * ratio)));
  const rows = Math.ceil(n / cols);
  const gap = 6 * u;
  const cw = (st.x1 - st.x0 - gap * (cols - 1)) / cols, ch = (st.y1 - st.y0 - gap * (rows - 1)) / rows;
  const shown = lerp(b.g0, b.g1, easeOut(clamp((t - b.start - 0.05) / Math.max(0.9, (b.end - b.start) * 0.8))));
  let out = "";
  all.forEach((vals, k) => {
    const a = clamp(shown - k);
    if (a <= 0.001) return;
    const x0 = st.x0 + (k % cols) * (cw + gap), y0 = st.y0 + Math.floor(k / cols) * (ch + gap);
    const first = vals.find(Number.isFinite) ?? 0, last = [...vals].reverse().find(Number.isFinite) ?? first;
    const hl = shot.highlight === shot.series[k];
    const col = hl ? TH.accent : last >= first ? TH.pos : TH.neg;
    const box: Box = { x0: x0 + 4 * u, y0: y0 + 4 * u, x1: x0 + cw - 4 * u, y1: y0 + ch - 4 * u };
    const yb = box.y1 - ((first - lo) / Math.max(1e-9, hi - lo)) * (box.y1 - box.y0);
    let g = `<rect x="${r1(x0)}" y="${r1(y0)}" width="${r1(cw)}" height="${r1(ch)}" rx="${r1(4 * u)}" fill="${TH.panel}" opacity="0.45"${hl ? ` stroke="${TH.accent}" stroke-width="${r1(1.4 * u)}"` : ""}/>`;
    g += `<line x1="${r1(box.x0)}" y1="${r1(yb)}" x2="${r1(box.x1)}" y2="${r1(yb)}" stroke="${TH.par}" stroke-width="${r1(0.8 * u)}" opacity="0.5"/>`;
    g += spark(vals, clamp((shown - k) / 3), box, lo, hi, col, u, { width: hl ? 1.8 : 1.2, dot: false, opacity: hl ? 1 : 0.9 }).svg;
    out += layer(g, { opacity: a, scale: 0.9 + 0.1 * a, cx: x0 + cw / 2, cy: y0 + ch / 2 }, "", []);
  });
  return out;
}

function shotSvg(reel: Reel, main: SigVisual, c: ReelCanvas, Z: Zones, b: PlannedBeat, t: number, id: string, defs: string[]): string {
  switch (b.shot.kind) {
    case "chart": return chartShot(reel, main, c, Z, b, t, id, defs);
    // A slow push in, so a statement is never quite still.
    case "statement": return layer(statementShot(c, Z, b, t, !!b.head), { scale: 1 + 0.035 * clamp((t - b.start) / Math.max(1, b.end - b.start)), cx: c.w / 2, cy: c.h * 0.48 }, "", []);
    case "panels": return panelsShot(reel, main, c, Z, b, t);
    case "grid": return gridShot(reel, main, c, Z, b, t);
    default: return "";
  }
}

// ------------------------------------------------------------------ captions

/** The caption burned into a clip: the current card, words lighting up as they are said. */
function captionSvg(c: ReelCanvas, Z: Zones, P: ReelPlan, t: number): string {
  const pg = pageAt(P, t);
  if (!pg) return "";
  const size = Z.capSize, maxW = c.w * 0.84;
  const lines: typeof pg.words[] = [[]];
  let w = 0;
  for (const word of pg.words) {
    const ww = textWidth(`${word.text} `, size, 650);
    if (w + ww > maxW && lines[lines.length - 1].length) { lines.push([]); w = 0; }
    lines[lines.length - 1].push(word);
    w += ww;
  }
  const fade = clamp((t - pg.from + 0.05) / 0.15);
  return lines.map((ln, i) => {
    const y = Z.capY + i * size * 1.28 - ((lines.length - 1) * size * 1.28) / 2;
    const spans = ln.map((word) => `<tspan fill="${word.em ? TH.accent : TH.ink}"${t >= word.at ? "" : ` opacity="0.38"`}>${esc(word.text)} </tspan>`).join("");
    return `<text x="${r1(c.w / 2)}" y="${r1(y)}" font-size="${r1(size)}" font-weight="650" text-anchor="middle" font-family="${TH.font}"${fade < 0.995 ? ` opacity="${r2(fade)}"` : ""}>${spans}</text>`;
  }).join("");
}

// ------------------------------------------------------------------ the frame

/** The SVG markup (no outer <svg>) of a reel at second t. */
export function renderReel(reel: Reel, main: SigVisual, P: ReelPlan, t: number, o: ReelRenderOptions = {}): string {
  const c = REEL_SIZES[o.size ?? "wide"];
  const Z = zones(c);
  const id = o.id ?? "rl";
  const u = c.u;
  const tt = clamp(t, 0, P.seconds);
  const b = beatAt(P, tt);
  const prev = b.i > 0 ? P.beats[b.i - 1] : null;
  const local = tt - b.start;
  const defs: string[] = [];
  let body = "";

  // The strip along the top: brand and what the numbers are.
  body += tx(Z.stage.x0, Z.strip, (reel.brand ?? "Parity Academy").toUpperCase(), { size: 9.5 * u, fill: TH.muted, mono: true, track: 1.8 * u, weight: 600 });
  if (reel.tag) body += tx(Z.stage.x1, Z.strip, reel.tag.toUpperCase(), { size: 9.5 * u, fill: TH.faint, mono: true, track: 1.2 * u, anchor: "end" });
  body += `<line x1="${r1(Z.stage.x0)}" y1="${r1(Z.strip + 9 * u)}" x2="${r1(Z.stage.x1)}" y2="${r1(Z.strip + 9 * u)}" stroke="${TH.grid}" stroke-opacity="0.12" stroke-width="${r1(u)}"/>`;

  // The shot, with a cut from the last one.
  const cx = c.w / 2, cy = (Z.stage.y0 + Z.stage.y1) / 2;
  if (prev && prev.shotKey !== b.shotKey && local < CUT) {
    const p = easeInOut(local / CUT);
    body += layer(shotSvg(reel, main, c, Z, prev, prev.end, `${id}-a`, defs), { opacity: 1 - p, scale: 1 + 0.07 * p, cx, cy, blur: 10 * u * p }, `${id}-bo`, defs);
    body += layer(shotSvg(reel, main, c, Z, b, tt, `${id}-b`, defs), { opacity: p, scale: 0.94 + 0.06 * p, cx, cy, blur: 10 * u * (1 - p) }, `${id}-bi`, defs);
  } else {
    body += shotSvg(reel, main, c, Z, b, tt, `${id}-b`, defs);
  }

  // The big line, swapped with a blur when it changes.
  const hNow = headAt(reel, main, b, tt);
  if (prev && prev.headKey !== b.headKey && local < SWAP) {
    const p = easeOut(local / SWAP);
    const hPrev = headAt(reel, main, prev, prev.end);
    if (hPrev) body += layer(headSvg(c, Z, hPrev), { opacity: 1 - p, blur: 12 * u * p, dy: -8 * u * p, scale: 1 + 0.05 * p, cx, cy: Z.headY }, `${id}-ho`, defs);
    if (hNow) body += layer(headSvg(c, Z, hNow), { opacity: p, blur: 12 * u * (1 - p), dy: 8 * u * (1 - p), scale: 1.06 - 0.06 * p, cx, cy: Z.headY }, `${id}-hi`, defs);
  } else if (hNow) {
    body += headSvg(c, Z, hNow);
  }

  if (o.captions) body += captionSvg(c, Z, P, tt);
  if (o.risk) body += tx(c.w / 2, Z.riskY, o.risk, { size: 9 * u, fill: TH.muted, anchor: "middle" });

  // Open from black and close to black.
  const dark = Math.max(1 - tt / OPEN, (tt - (P.seconds - CLOSE)) / CLOSE);
  const bg = `<defs><radialGradient id="${id}-bg" cx="50%" cy="45%" r="75%"><stop offset="0" stop-color="${TH.bgGlow}"/><stop offset="1" stop-color="${TH.bg}"/></radialGradient>${defs.join("")}</defs>`
    + `<rect width="${c.w}" height="${c.h}" fill="url(#${id}-bg)"/>`;
  return bg + body + (dark > 0.01 ? `<rect width="${c.w}" height="${c.h}" fill="${TH.bg}" opacity="${r2(clamp(dark))}"/>` : "");
}

/** A whole SVG document of a reel at second t. */
export function reelSvg(reel: Reel, main: SigVisual, P: ReelPlan, t: number, o: ReelRenderOptions = {}): string {
  const c = REEL_SIZES[o.size ?? "wide"];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${c.w} ${c.h}" width="${c.w}" height="${c.h}">${renderReel(reel, main, P, t, o)}</svg>`;
}
