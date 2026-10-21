import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Point } from "../lib/types";

// Small hand-rolled SVG charts. One y-axis per chart, thin marks, recessive grid,
// a hover layer on every chart, and a legend whenever there are two or more series.

export interface Series {
  name: string;
  color: string;
  points: Point[];
  emphasis?: boolean;
}

function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(640);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(280, entry.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

export function Legend({ items }: { items: { name: string; color: string }[] }) {
  if (items.length < 2) return null;
  return (
    <ul className="legend">
      {items.map((i) => (
        <li key={i.name}>
          <span className="swatch" style={{ background: i.color }} />
          {i.name}
        </li>
      ))}
    </ul>
  );
}

function niceLinearTicks(min: number, max: number, count = 5): number[] {
  const span = max - min || 1;
  const step0 = span / count;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= count) ?? mag * 10;
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-12; v += step) out.push(+v.toFixed(10));
  return out;
}

function logTicks(min: number, max: number): number[] {
  const candidates = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 6, 8, 12, 16, 24, 32];
  const inRange = candidates.filter((c) => c >= min * 0.98 && c <= max * 1.02);
  return inRange.length > 6 ? inRange.filter((_, i) => i % 2 === 0) : inRange;
}

/** Last value at or before the given date. Points are sorted by date. */
function valueAt(points: Point[], d: string): number | null {
  let lo = 0;
  let hi = points.length - 1;
  let ans: number | null = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (points[mid][0] <= d) {
      ans = points[mid][1];
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans;
}

export function LineChart({
  series,
  height = 300,
  log = false,
  format,
  label,
}: {
  series: Series[];
  height?: number;
  log?: boolean;
  format: (v: number) => string;
  label: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { top: 12, right: 16, bottom: 26, left: 52 };
  const w = width - pad.left - pad.right;
  const h = height - pad.top - pad.bottom;

  const dates = useMemo(() => {
    const all = new Set<string>();
    series.forEach((s) => s.points.forEach((p) => all.add(p[0])));
    return [...all].sort();
  }, [series]);

  const values = series.flatMap((s) => s.points.map((p) => p[1]));
  if (!dates.length || !values.length) return <p className="muted">No data.</p>;

  let lo = Math.min(...values);
  let hi = Math.max(...values);
  if (log) {
    lo = Math.max(lo, 1e-3);
  } else if (lo === hi) {
    lo -= 1;
    hi += 1;
  }
  const t = (v: number) => (log ? Math.log(Math.max(v, 1e-3)) : v);
  const y = (v: number) => pad.top + h - ((t(v) - t(lo)) / (t(hi) - t(lo) || 1)) * h;
  const x = (i: number) => pad.left + (i / Math.max(dates.length - 1, 1)) * w;
  const index = new Map(dates.map((d, i) => [d, i]));

  const yTicks = log ? logTicks(lo, hi) : niceLinearTicks(lo, hi);
  const years = dates.map((d) => d.slice(0, 4));
  const firstYear = +years[0];
  const lastYear = +years[years.length - 1];
  const yearStep = Math.max(1, Math.ceil((lastYear - firstYear) / Math.max(2, Math.floor(w / 70))));
  const xTicks = dates
    .map((d, i) => ({ d, i }))
    .filter(({ d }, k, arr) => k === 0 || d.slice(0, 4) !== arr[k - 1].d.slice(0, 4))
    .filter(({ d }) => (+d.slice(0, 4) - firstYear) % yearStep === 0);

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const rel = (e.clientX - box.left) / box.width;
    setHover(Math.round(rel * (dates.length - 1)));
  };

  const hd = hover != null ? dates[hover] : null;
  const ordered = [...series].sort((a, b) => Number(!!a.emphasis) - Number(!!b.emphasis));

  return (
    <figure className="chart" ref={ref}>
      <Legend items={series} />
      <svg width={width} height={height} role="img" aria-label={label}>
        {yTicks.map((v) => (
          <g key={v}>
            <line className="grid" x1={pad.left} x2={pad.left + w} y1={y(v)} y2={y(v)} />
            <text className="tick" x={pad.left - 8} y={y(v)} dy="0.32em" textAnchor="end">
              {format(v)}
            </text>
          </g>
        ))}
        {xTicks.map(({ d, i }) => (
          <text key={d} className="tick" x={x(i)} y={height - 6} textAnchor="middle">
            {d.slice(0, 4)}
          </text>
        ))}
        {ordered.map((s) => (
          <polyline
            key={s.name}
            fill="none"
            stroke={s.color}
            strokeWidth={s.emphasis ? 2 : 1.5}
            strokeLinejoin="round"
            points={s.points.map((p) => `${x(index.get(p[0]) ?? 0)},${y(p[1])}`).join(" ")}
          />
        ))}
        {hd && (
          <g>
            <line className="crosshair" x1={x(hover!)} x2={x(hover!)} y1={pad.top} y2={pad.top + h} />
            {series.map((s) => {
              const v = valueAt(s.points, hd);
              return v == null ? null : (
                <circle key={s.name} cx={x(hover!)} cy={y(v)} r={4} fill={s.color} className="dot" />
              );
            })}
          </g>
        )}
        <rect
          x={pad.left}
          y={pad.top}
          width={w}
          height={h}
          fill="transparent"
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
        />
      </svg>
      {hd && (
        <Tooltip x={x(hover!)} width={width}>
          <div className="tt-title">{hd}</div>
          {series.map((s) => (
            <div key={s.name} className="tt-row">
              <span className="swatch" style={{ background: s.color }} />
              <span>{s.name}</span>
              <strong>{(() => { const v = valueAt(s.points, hd); return v == null ? "n/a" : format(v); })()}</strong>
            </div>
          ))}
        </Tooltip>
      )}
    </figure>
  );
}

function Tooltip({ x, width, children }: { x: number; width: number; children: ReactNode }) {
  const left = x > width * 0.6 ? undefined : x + 12;
  const right = x > width * 0.6 ? width - x + 12 : undefined;
  return (
    <div className="tooltip" style={{ left, right }} role="status">
      {children}
    </div>
  );
}

export interface BarGroup {
  label: string;
  values: { name: string; color: string; value: number | null }[];
}

export function BarChart({
  groups,
  height = 220,
  format,
  label,
}: {
  groups: BarGroup[];
  height?: number;
  format: (v: number) => string;
  label: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { top: 12, right: 12, bottom: 26, left: 52 };
  const w = width - pad.left - pad.right;
  const h = height - pad.top - pad.bottom;
  const vals = groups.flatMap((g) => g.values.map((v) => v.value ?? 0));
  if (!groups.length) return <p className="muted">No data.</p>;
  const lo = Math.min(0, ...vals);
  const hi = Math.max(0, ...vals);
  const ticks = niceLinearTicks(lo, hi === lo ? lo + 1 : hi, 4);
  const top = Math.max(hi, ticks[ticks.length - 1]);
  const bottom = Math.min(lo, ticks[0]);
  const y = (v: number) => pad.top + h - ((v - bottom) / (top - bottom || 1)) * h;
  const band = w / groups.length;
  const per = groups[0].values.length;
  const gap = 2;
  const barW = Math.max(2, Math.min(28, (band * 0.7 - gap * (per - 1)) / per));
  const labelEvery = Math.ceil(groups.length / Math.max(1, Math.floor(w / 44)));

  const legend = groups[0].values.map((v) => ({ name: v.name, color: v.color }));

  return (
    <figure className="chart" ref={ref}>
      <Legend items={legend} />
      <svg width={width} height={height} role="img" aria-label={label}>
        {ticks.map((v) => (
          <g key={v}>
            <line className={v === 0 ? "axis" : "grid"} x1={pad.left} x2={pad.left + w} y1={y(v)} y2={y(v)} />
            <text className="tick" x={pad.left - 8} y={y(v)} dy="0.32em" textAnchor="end">
              {format(v)}
            </text>
          </g>
        ))}
        {groups.map((g, gi) => {
          const x0 = pad.left + gi * band + (band - (per * barW + (per - 1) * gap)) / 2;
          return (
            <g key={g.label} onPointerEnter={() => setHover(gi)} onPointerLeave={() => setHover(null)}>
              <rect x={pad.left + gi * band} y={pad.top} width={band} height={h} fill="transparent" />
              {g.values.map((v, vi) => {
                if (v.value == null) return null;
                const yv = y(v.value);
                const y0 = y(0);
                const r = Math.min(4, barW / 2, Math.abs(y0 - yv));
                const xx = x0 + vi * (barW + gap);
                const up = v.value >= 0;
                const hh = Math.abs(y0 - yv);
                // Rounded on the data end only, square on the zero baseline.
                const d = up
                  ? `M${xx},${y0} V${yv + r} Q${xx},${yv} ${xx + r},${yv} H${xx + barW - r} Q${xx + barW},${yv} ${xx + barW},${yv + r} V${y0} Z`
                  : `M${xx},${y0} V${y0 + hh - r} Q${xx},${y0 + hh} ${xx + r},${y0 + hh} H${xx + barW - r} Q${xx + barW},${y0 + hh} ${xx + barW},${y0 + hh - r} V${y0} Z`;
                return <path key={v.name} d={d} fill={v.color} opacity={hover == null || hover === gi ? 1 : 0.45} />;
              })}
              {gi % labelEvery === 0 && (
                <text className="tick" x={pad.left + gi * band + band / 2} y={height - 6} textAnchor="middle">
                  {g.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {hover != null && (
        <Tooltip x={pad.left + hover * band + band / 2} width={width}>
          <div className="tt-title">{groups[hover].label}</div>
          {groups[hover].values.map((v) => (
            <div key={v.name} className="tt-row">
              <span className="swatch" style={{ background: v.color }} />
              <span>{v.name}</span>
              <strong>{v.value == null ? "n/a" : format(v.value)}</strong>
            </div>
          ))}
        </Tooltip>
      )}
    </figure>
  );
}
