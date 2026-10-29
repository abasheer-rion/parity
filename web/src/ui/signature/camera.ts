// The camera: which slice of the data the plot shows. Every step fits the plot to what has
// been drawn so far, so lines always fill the box, and moves between steps ease from one
// fit to the next. A line tip can never leave the plot: the camera is widened to hold it.
import { clamp, lerp, type Frame } from "./core.ts";
import type { Box } from "./theme.ts";

export interface Domain { x0: number; x1: number; y0: number; y1: number }

export interface FitOptions {
  /** Share of the height left free above and below the data. */
  padTop?: number;
  padBottom?: number;
  /** Values that must stay in view (a par line, zero). */
  include?: number[];
  /** Smallest height of the y range, as a share of its middle value (stops tiny ranges filling the box). */
  minSpan?: number;
  /** Keep the bottom at this value when the data does not go below it (bars, counts). */
  floor?: number;
}

/** A series to fit: y values at x = 0, 1, 2... (or at `xs`), shown from x0 up to x1. */
export interface FitSeries { values: number[]; xs?: number[] }

/** The data range inside [x0, x1] for every series, padded. Partial points at x1 are interpolated. */
export function fit(series: FitSeries[], x0: number, x1: number, o: FitOptions = {}): Domain {
  let lo = Infinity, hi = -Infinity;
  for (const sr of series) {
    const v = sr.values;
    for (let i = 0; i < v.length; i++) {
      const x = sr.xs ? sr.xs[i] : i;
      if (x < x0 - 1e-9) continue;
      if (x > x1 + 1e-9) {
        // The point the line has reached between this sample and the one before.
        if (i > 0) {
          const px = sr.xs ? sr.xs[i - 1] : i - 1;
          const y = lerp(v[i - 1], v[i], clamp((x1 - px) / (x - px)));
          lo = Math.min(lo, y); hi = Math.max(hi, y);
        }
        break;
      }
      if (Number.isFinite(v[i])) { lo = Math.min(lo, v[i]); hi = Math.max(hi, v[i]); }
    }
  }
  for (const v of o.include ?? []) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  if (!Number.isFinite(lo)) { lo = 0; hi = 1; }
  const mid = (lo + hi) / 2;
  const minSpan = Math.abs(mid) * (o.minSpan ?? 0.06) || 1;
  if (hi - lo < minSpan) { lo = mid - minSpan / 2; hi = mid + minSpan / 2; }
  const span = hi - lo;
  let y0 = lo - span * (o.padBottom ?? 0.08), y1 = hi + span * (o.padTop ?? 0.1);
  if (o.floor != null && lo >= o.floor && y0 < o.floor) y0 = o.floor;
  return { x0, x1: x1 > x0 ? x1 : x0 + 1, y0, y1 };
}

export function union(a: Domain, b: Domain): Domain {
  return { x0: Math.min(a.x0, b.x0), x1: Math.max(a.x1, b.x1), y0: Math.min(a.y0, b.y0), y1: Math.max(a.y1, b.y1) };
}

export function lerpDomain(a: Domain, b: Domain, t: number): Domain {
  return { x0: lerp(a.x0, b.x0, t), x1: lerp(a.x1, b.x1, t), y0: lerp(a.y0, b.y0, t), y1: lerp(a.y1, b.y1, t) };
}

/**
 * The camera at this frame: eased (out) from step i's fit to step j's, then widened to hold
 * `hold` (the fit of what is drawn right now) so nothing runs off the plot mid-move.
 * `fitAt(k)` gives the fit for the finished step k (k is -1 for the empty first frame).
 */
export function camera(F: Frame, fitAt: (k: number) => Domain, hold?: Domain): Domain {
  const a = fitAt(F.i), b = F.j === F.i ? a : fitAt(F.j);
  const d = lerpDomain(a, b, F.eo);
  return hold ? union(d, hold) : d;
}

export interface Scales { x: (v: number) => number; y: (v: number) => number; d: Domain; box: Box }

export function scales(d: Domain, box: Box): Scales {
  const kx = d.x1 === d.x0 ? 0 : (box.x1 - box.x0) / (d.x1 - d.x0);
  const ky = d.y1 === d.y0 ? 0 : (box.y1 - box.y0) / (d.y1 - d.y0);
  return { x: (v) => box.x0 + (v - d.x0) * kx, y: (v) => box.y1 - (v - d.y0) * ky, d, box };
}

/** Round values for grid lines between lo and hi, about `count` of them. */
export function niceTicks(lo: number, hi: number, count = 4): number[] {
  const span = hi - lo;
  if (!(span > 0) || !Number.isFinite(span)) return [lo];
  const raw = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((m) => span / m <= count + 0.5) ?? raw;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step - 1e-9) * step; v <= hi + 1e-9 && out.length < 20; v += step) out.push(Math.round(v / step) * step);
  return out;
}
