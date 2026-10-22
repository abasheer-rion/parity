// Lines that draw in as time plays, like the strategy race: a fixed y axis for the whole
// window (so nothing rescales mid-race), a "now" line, a dot on each runner, the focused
// runner bold, and event bands shaded behind.
import { useMemo } from "react";
import { useWidth } from "../shared";
import type { Band } from "./Stage";

export interface Lane { key: string; label: string; color: string; values: (number | null)[]; dashed?: boolean }

export function RaceLines({ lanes, pos, end, focus, log, baseline, format, xTicks, bands = [], label, height: fixedHeight }: {
  lanes: Lane[];
  pos: number;
  end: number;
  focus?: string | null;
  /** Log scale: for growth of 100. Otherwise linear. */
  log?: boolean;
  /** A dotted reference line: 100 for growth, 0 for changes. */
  baseline?: number;
  format: (v: number) => string;
  xTicks: { k: number; label: string }[];
  bands?: Band[];
  label: string;
  height?: number;
}) {
  const [ref, width] = useWidth<HTMLDivElement>(240);
  const height = fixedHeight ?? Math.min(420, Math.max(220, width * 0.46));
  const pad = { top: 10, right: 12, bottom: 22, left: 54 };
  const w = width - pad.left - pad.right, h = height - pad.top - pad.bottom;
  const [lo, hi] = useMemo(() => {
    let mn = Infinity, mx = -Infinity;
    for (const l of lanes) for (const v of l.values) if (v != null && Number.isFinite(v) && (!log || v > 0)) { if (v < mn) mn = v; if (v > mx) mx = v; }
    if (baseline != null) { mn = Math.min(mn, baseline); mx = Math.max(mx, baseline); }
    if (!Number.isFinite(mn)) return [0, 1];
    if (log) return [Math.log(mn * 0.96), Math.log(mx * 1.04)];
    const padv = (mx - mn) * 0.05 || 1;
    return [mn - padv, mx + padv];
  }, [lanes, log, baseline]);
  const tv = (v: number) => (log ? Math.log(Math.max(v, 1e-9)) : v);
  const x = (k: number) => pad.left + (end ? (k / end) * w : 0);
  const y = (v: number) => pad.top + h - ((tv(v) - lo) / (hi - lo || 1)) * h;
  const paths = useMemo(() => new Map(lanes.map((l) => {
    let d = "", pen = false;
    l.values.forEach((v, k) => {
      if (v == null || !Number.isFinite(v) || (log && v <= 0)) { pen = false; return; }
      d += `${pen ? "L" : "M"}${x(k).toFixed(1)},${y(v).toFixed(1)}`;
      pen = true;
    });
    return [l.key, d];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  })), [lanes, width, height, lo, hi, end]);
  const ticks = useMemo(() => {
    if (log) {
      const out: number[] = [];
      for (let m = 1e-3; m < 1e7; m *= 10) for (const k of [1, 2, 5]) { const v = m * k; if (Math.log(v) >= lo && Math.log(v) <= hi) out.push(v); }
      return out.length > 6 ? out.filter((_, k) => k % 2 === 0) : out;
    }
    const span = hi - lo, raw = span / 5, mag = 10 ** Math.floor(Math.log10(raw || 1));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= 6) ?? mag * 10;
    const out: number[] = [];
    for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) out.push(+v.toFixed(10));
    return out;
  }, [lo, hi, log]);
  const k = Math.min(end, Math.floor(pos));
  const clipId = useMemo(() => `rl-${Math.random().toString(36).slice(2, 8)}`, []);

  return (
    <div className="pb-lines" ref={ref}>
      <svg width={width} height={height} role="img" aria-label={label}>
        <defs><clipPath id={clipId}><rect x={pad.left} y={0} width={Math.max(0, x(pos) - pad.left + 1)} height={height} /></clipPath></defs>
        {bands.filter((b) => b.b > b.a).map((b) => (
          <rect key={b.label} x={x(b.a)} y={pad.top} width={Math.max(2, x(b.b) - x(b.a))} height={h} className="pb-shade" />
        ))}
        {ticks.map((v) => (
          <g key={v}>
            <line x1={pad.left} x2={pad.left + w} y1={y(v)} y2={y(v)} className="sw-grid" />
            <text x={pad.left - 8} y={y(v) + 4} textAnchor="end" className="sw-axis">{format(v)}</text>
          </g>
        ))}
        {xTicks.map((t) => <text key={t.k} x={x(t.k)} y={height - 5} textAnchor="middle" className="sw-axis">{t.label}</text>)}
        {baseline != null && <line x1={pad.left} x2={pad.left + w} y1={y(baseline)} y2={y(baseline)} className="sw-start" />}
        <g clipPath={`url(#${clipId})`}>
          {lanes.map((l) => {
            const on = focus === l.key;
            return <path key={l.key} d={paths.get(l.key)} fill="none" stroke={l.color} strokeWidth={on ? 2.4 : 1.4}
              strokeDasharray={l.dashed ? "4 3" : undefined} opacity={focus && !on ? 0.45 : 0.95} />;
          })}
        </g>
        <line x1={x(pos)} x2={x(pos)} y1={pad.top} y2={pad.top + h} className="sw-now" />
        {lanes.map((l) => {
          const v = l.values[k];
          return v == null || !Number.isFinite(v) || (log && v <= 0) ? null
            : <circle key={l.key} cx={x(pos)} cy={y(v)} r={focus === l.key ? 4 : 2.5} fill={l.color} />;
        })}
      </svg>
    </div>
  );
}
