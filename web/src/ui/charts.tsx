import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Point } from "../lib/types";
import { Money } from "./text";

export { Money };

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
        <DotGrid x={pad.left} y={pad.top} width={w} height={h} />
        {yTicks.map((v) => (
          <g key={v}>
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
            className="ui-draw"
            pathLength={1}
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
        <DotGrid x={pad.left} y={pad.top} width={w} height={h} />
        {ticks.map((v) => (
          <g key={v}>
            {v === 0 && <line className="axis" x1={pad.left} x2={pad.left + w} y1={y(v)} y2={y(v)} />}
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

let gridSeq = 0;

/** Mercury's plot background: small dots on a grid, faded at the top and bottom. */
export function DotGrid({ x, y, width, height, gap = 14 }: { x: number; y: number; width: number; height: number; gap?: number }) {
  const [id] = useState(() => `dg${++gridSeq}`);
  return (
    <g aria-hidden>
      <defs>
        <pattern id={`${id}p`} x={x} y={y} width={gap} height={gap} patternUnits="userSpaceOnUse">
          <circle cx={1} cy={1} r={1} className="dotgrid" />
        </pattern>
        <linearGradient id={`${id}f`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.15" stopColor="#fff" stopOpacity="1" />
          <stop offset="0.85" stopColor="#fff" stopOpacity="1" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id={`${id}m`}><rect x={x} y={y} width={width} height={height} fill={`url(#${id}f)`} /></mask>
      </defs>
      <rect x={x} y={y} width={width} height={height} fill={`url(#${id}p)`} mask={`url(#${id}m)`} />
    </g>
  );
}

export const RANGES = ["1M", "3M", "YTD", "1Y", "5Y", "10Y", "ALL"] as const;
export type RangeKey = (typeof RANGES)[number];

const RANGE_LABEL: Record<RangeKey, string> = {
  "1M": "Past month", "3M": "Past 3 months", YTD: "Year to date", "1Y": "Past year",
  "5Y": "Past 5 years", "10Y": "Past 10 years", ALL: "All time",
};

/** The points that fall inside a range ending at the series' last date. */
export function sliceRange(points: Point[], range: RangeKey): Point[] {
  if (!points.length || range === "ALL") return points;
  const last = new Date(points[points.length - 1][0]);
  const from = new Date(last);
  if (range === "YTD") { from.setMonth(0, 1); }
  else {
    const months = { "1M": 1, "3M": 3, "1Y": 12, "5Y": 60, "10Y": 120 }[range];
    from.setMonth(from.getMonth() - months);
  }
  const cut = from.toISOString().slice(0, 10);
  return points.filter((p) => p[0] >= cut);
}

function rebase(points: Point[], amount: number): Point[] {
  const p0 = points[0]?.[1];
  return p0 ? points.map(([d, v]) => [d, (v / p0) * amount]) : [];
}

function thin(points: Point[], max: number): Point[] {
  if (points.length <= max) return points;
  const step = points.length / max;
  const out: Point[] = [];
  for (let i = 0; i < max; i++) out.push(points[Math.floor(i * step)]);
  out.push(points[points.length - 1]);
  return out;
}

const fmtDate = (d: string) => new Date(d + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

/**
 * The headline chart: Robinhood's layout (big value, coloured change, no y axis, a
 * dotted line at the starting value, range tabs below, scrubbing updates the header)
 * drawn in Mercury's style (soft gradient fill, dotted background, quiet date labels).
 */
export function HeroChart({
  title,
  main,
  compare,
  amount,
  range,
  onRange,
  height = 300,
  aside,
}: {
  title: ReactNode;
  main: { name: string; points: Point[] };
  compare?: { name: string; points: Point[] };
  amount: number;
  range: RangeKey;
  onRange: (r: RangeKey) => void;
  height?: number;
  aside?: ReactNode;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const [gid] = useState(() => `hc${++gridSeq}`);
  const [showCmp, setShowCmp] = useState(true);
  const pts = useMemo(() => thin(rebase(sliceRange(main.points, range), amount), 900), [main.points, range, amount]);
  const cmp = useMemo(() => (compare && showCmp ? thin(rebase(sliceRange(compare.points, range), amount), 900) : []), [compare, range, amount, showCmp]);
  const pad = { top: 22, right: 4, bottom: 24, left: 4 };
  const w = width - pad.left - pad.right;
  const h = height - pad.top - pad.bottom;

  if (pts.length < 2) return <p className="muted">Not enough data for this range.</p>;
  const t0 = new Date(pts[0][0]).getTime();
  const t1 = new Date(pts[pts.length - 1][0]).getTime();
  const tx = (d: string) => pad.left + ((new Date(d).getTime() - t0) / (t1 - t0 || 1)) * w;
  const all = [...pts, ...cmp].map((p) => p[1]).concat(amount);
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const yy = (v: number) => pad.top + h - ((v - lo) / (hi - lo || 1)) * h;
  const line = (ps: Point[]) => ps.map((p) => `${tx(p[0]).toFixed(1)},${yy(p[1]).toFixed(1)}`).join(" ");

  const last = pts[pts.length - 1];
  const shown = hover != null ? pts[hover] : last;
  const change = shown[1] - amount;
  const up = last[1] >= amount;
  const tone = up ? "var(--good)" : "var(--bad)";
  const cmpAt = hover != null && cmp.length ? valueAt(cmp, shown[0]) : cmp.length ? cmp[cmp.length - 1][1] : null;

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const rel = Math.min(1, Math.max(0, (e.clientX - box.left) / box.width));
    const target = t0 + rel * (t1 - t0);
    let lo2 = 0, hi2 = pts.length - 1;
    while (lo2 < hi2) { const mid = (lo2 + hi2) >> 1; if (new Date(pts[mid][0]).getTime() < target) lo2 = mid + 1; else hi2 = mid; }
    setHover(lo2);
  };

  const xLabels = [0.1, 0.3, 0.5, 0.7, 0.9].map((f) => pts[Math.floor(f * (pts.length - 1))][0]);
  const hx = hover != null ? tx(pts[hover][0]) : null;

  return (
    <div className="hero" ref={ref}>
      <div className="hero-head">
        <div>
          <div className="hero-title">{title}</div>
          <div className="hero-value"><Money value={shown[1]} /></div>
          <div className="hero-change" style={{ color: change >= 0 ? "var(--good)" : "var(--bad)" }}>
            <Money value={change} signed /> ({change >= 0 ? "+" : "\u2212"}{Math.abs((change / amount) * 100).toFixed(2)}%)
            <span className="muted"> {hover != null ? fmtDate(shown[0]) : RANGE_LABEL[range]}</span>
          </div>
          {compare && showCmp && cmpAt != null && (
            <div className="hero-compare muted">
              {compare.name}: <Money value={cmpAt} /> ({cmpAt >= amount ? "+" : "\u2212"}{Math.abs(((cmpAt - amount) / amount) * 100).toFixed(2)}%)
            </div>
          )}
        </div>
        {aside}
      </div>
      <svg width={width} height={height} role="img" aria-label={`Growth of $${amount.toLocaleString()} in ${main.name}`}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={tone} stopOpacity="0.28" />
            <stop offset="1" stopColor={tone} stopOpacity="0" />
          </linearGradient>
        </defs>
        <DotGrid x={pad.left} y={pad.top} width={w} height={h} />
        <line className="baseline" x1={pad.left} x2={pad.left + w} y1={yy(amount)} y2={yy(amount)} />
        <polygon className="ui-fill-in" fill={`url(#${gid})`} points={`${tx(pts[0][0])},${pad.top + h} ${line(pts)} ${tx(last[0])},${pad.top + h}`} />
        {cmp.length > 1 && <polyline className="hero-cmp" fill="none" points={line(cmp)} />}
        <polyline className="ui-draw" pathLength={1} fill="none" stroke={tone} strokeWidth={2} strokeLinejoin="round" points={line(pts)} />
        {hx != null && (
          <g>
            <line className="crosshair" x1={hx} x2={hx} y1={pad.top} y2={pad.top + h} />
            <text className="tick" x={Math.min(Math.max(hx, 40), width - 40)} y={12} textAnchor="middle">{fmtDate(shown[0])}</text>
            {cmpAt != null && <circle cx={hx} cy={yy(cmpAt)} r={3.5} fill="var(--benchmark)" className="dot" />}
            <circle cx={hx} cy={yy(shown[1])} r={5} fill={tone} className="dot" />
          </g>
        )}
        {xLabels.map((d) => (
          <text key={d} className={`tick ${hover != null ? "faint" : ""}`} x={tx(d)} y={height - 4} textAnchor="middle">
            {range === "ALL" || range === "10Y" || range === "5Y" ? d.slice(0, 4) : fmtDate(d).replace(/, \d{4}$/, "")}
          </text>
        ))}
        <rect x={pad.left} y={0} width={w} height={height} fill="transparent" onPointerMove={onMove} onPointerLeave={() => setHover(null)} />
      </svg>
      <div className="range-tabs" role="tablist" aria-label="Time range">
        {RANGES.map((r) => (
          <button key={r} role="tab" aria-selected={r === range} className={r === range ? "on" : ""} onClick={() => onRange(r)}
            style={r === range ? { color: tone, borderColor: tone } : undefined}>{r}</button>
        ))}
        {compare && (
          <span className="range-key">
            <i style={{ background: tone }} />{main.name}
            <button className={showCmp ? "" : "off"} onClick={() => setShowCmp((v) => !v)} aria-pressed={showCmp} title="Show or hide the comparison line">
              <i className="cmp" />{compare.name}
            </button>
          </span>
        )}
      </div>
    </div>
  );
}

/** A small line for lists, coloured by whether it ended above where it started. `fluid` fills its box's width. */
export function Sparkline({ points, width = 84, height = 28, fluid }: { points: Point[]; width?: number; height?: number; fluid?: boolean }) {
  const pts = thin(points, 60);
  if (pts.length < 2) return <svg width={width} height={height} />;
  const vals = pts.map((p) => p[1]);
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const up = vals[vals.length - 1] >= vals[0];
  const d = pts.map((p, i) => `${((i / (pts.length - 1)) * (width - 2) + 1).toFixed(1)},${(height - 2 - ((p[1] - lo) / (hi - lo || 1)) * (height - 4)).toFixed(1)}`).join(" ");
  return (
    <svg width={fluid ? "100%" : width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio={fluid ? "none" : undefined} aria-hidden className="spark">
      <polyline className="ui-draw" pathLength={1} vectorEffect={fluid ? "non-scaling-stroke" : undefined} fill="none" stroke={up ? "var(--good)" : "var(--bad)"} strokeWidth={1.5} strokeLinejoin="round" points={d} />
    </svg>
  );
}

export interface FanBand { day: number; median: number; q25: number; q75: number; min: number; max: number; count: number }

/**
 * What happened after a set of past events, day by day: a faint line per event, the
 * full range lightly shaded, the middle half (25th to 75th percentile) shaded more,
 * the median bold, and a dotted zero line. One series colour, one y axis.
 */
export function FanChart({
  bands,
  paths,
  color,
  format,
  tickFormat,
  label,
  markers = [],
  height = 240,
  step = 1,
  unit = "trading day",
  countLabel = "event",
  outerLabel = "Full range",
}: {
  bands: FanBand[];
  paths: { name: string; values: number[] }[];
  color: string;
  format: (v: number) => string;
  /** Shorter labels for the y axis; defaults to `format`. */
  tickFormat?: (v: number) => string;
  label: string;
  markers?: { day: number; label: string }[];
  height?: number;
  /** Days between two values of a faint path (paths kept every 3rd day use 3). */
  step?: number;
  /** What one step on the x axis is, for the hover title: "trading day", "week". */
  unit?: string;
  /** What the count is a count of: "event", "simulated path". */
  countLabel?: string;
  /** Name of the light outer band: "Full range", or "5 to 95 in 100" for simulations. */
  outerLabel?: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { top: 12, right: 16, bottom: 26, left: 58 };
  const w = width - pad.left - pad.right;
  const h = height - pad.top - pad.bottom;
  if (!bands.length) return <p className="muted">No path data for these events.</p>;

  const lastDay = Math.max(bands[bands.length - 1].day, ...markers.map((m) => m.day));
  const all = [0, ...bands.flatMap((b) => [b.min, b.max]), ...paths.flatMap((p) => p.values.filter((v) => v != null && !Number.isNaN(v)))];
  let lo = Math.min(...all);
  let hi = Math.max(...all);
  if (lo === hi) { lo -= 1; hi += 1; }
  const ticks = niceLinearTicks(lo, hi, 5);
  lo = Math.min(lo, ticks[0]);
  hi = Math.max(hi, ticks[ticks.length - 1]);
  const x = (d: number) => pad.left + (d / Math.max(lastDay, 1)) * w;
  const y = (v: number) => pad.top + h - ((v - lo) / (hi - lo || 1)) * h;
  const area = (top: (b: FanBand) => number, bottom: (b: FanBand) => number) =>
    `${bands.map((b) => `${x(b.day).toFixed(1)},${y(top(b)).toFixed(1)}`).join(" ")} ${[...bands].reverse().map((b) => `${x(b.day).toFixed(1)},${y(bottom(b)).toFixed(1)}`).join(" ")}`;
  const line = (vals: (number | null)[]) => vals.map((v, d) => (v == null || Number.isNaN(v) ? null : `${x(d * step).toFixed(1)},${y(v).toFixed(1)}`)).filter(Boolean).join(" ");

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const day = Math.round(Math.min(1, Math.max(0, (e.clientX - box.left) / box.width)) * lastDay);
    let best = 0;
    bands.forEach((b, i) => { if (Math.abs(b.day - day) < Math.abs(bands[best].day - day)) best = i; });
    setHover(best);
  };
  const hb = hover != null ? bands[hover] : null;

  return (
    <figure className="chart" ref={ref}>
      <svg width={width} height={height} role="img" aria-label={label}>
        <DotGrid x={pad.left} y={pad.top} width={w} height={h} />
        {ticks.map((v) => (
          <text key={v} className="tick" x={pad.left - 8} y={y(v)} dy="0.32em" textAnchor="end">{(tickFormat ?? format)(v)}</text>
        ))}
        {markers.map((m) => (
          <g key={m.label}>
            <line className="crosshair" strokeDasharray="2 4" x1={x(m.day)} x2={x(m.day)} y1={pad.top} y2={pad.top + h} opacity={0.6} />
            <text className="tick" x={x(m.day)} y={height - 6} textAnchor="middle">{m.label}</text>
          </g>
        ))}
        <polygon points={area((b) => b.max, (b) => b.min)} fill={color} opacity={0.08} />
        <polygon points={area((b) => b.q75, (b) => b.q25)} fill={color} opacity={0.22} />
        {paths.map((p) => (
          <polyline key={p.name} fill="none" stroke={color} strokeWidth={1} opacity={0.28} strokeLinejoin="round" points={line(p.values)} />
        ))}
        <line className="baseline" x1={pad.left} x2={pad.left + w} y1={y(0)} y2={y(0)} />
        <polyline fill="none" stroke={color} strokeWidth={2.25} strokeLinejoin="round" points={bands.map((b) => `${x(b.day).toFixed(1)},${y(b.median).toFixed(1)}`).join(" ")} />
        {hb && (
          <g>
            <line className="crosshair" x1={x(hb.day)} x2={x(hb.day)} y1={pad.top} y2={pad.top + h} />
            <circle cx={x(hb.day)} cy={y(hb.median)} r={4} fill={color} className="dot" />
          </g>
        )}
        <rect x={pad.left} y={pad.top} width={w} height={h} fill="transparent" onPointerMove={onMove} onPointerLeave={() => setHover(null)} />
      </svg>
      {hb && (
        <Tooltip x={x(hb.day)} width={width}>
          <div className="tt-title">{hb.day} {unit}{hb.day === 1 ? "" : "s"} after · {hb.count} {countLabel}{hb.count === 1 ? "" : "s"}</div>
          <div className="tt-row"><span className="swatch" style={{ background: color }} /><span>Middle outcome</span><strong>{format(hb.median)}</strong></div>
          <div className="tt-row"><span className="swatch" style={{ background: color, opacity: 0.4 }} /><span>Middle half</span><strong>{format(hb.q25)} to {format(hb.q75)}</strong></div>
          <div className="tt-row"><span className="swatch" style={{ background: color, opacity: 0.15 }} /><span>{outerLabel}</span><strong>{format(hb.min)} to {format(hb.max)}</strong></div>
        </Tooltip>
      )}
    </figure>
  );
}
