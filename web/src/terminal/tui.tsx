// The terminal's own small parts: a dense sortable table, a time-series chart with the
// axis on the right and a crosshair read-out, segmented buttons, sparklines, and the
// empty and loading states. They read the terminal's tokens (terminal.css).
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Point } from "../lib/types";
import { MINUS } from "./fmt";

export function useBox<T extends HTMLElement>(): [React.RefObject<T | null>, number, number] {
  const ref = useRef<T>(null);
  const [box, setBox] = useState<[number, number]>([0, 0]);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setBox([Math.round(e.contentRect.width), Math.round(e.contentRect.height)]));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, box[0], box[1]];
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="term-empty" role="status">
      <div className="term-empty-title">{title}</div>
      {children && <div className="term-empty-body">{children}</div>}
    </div>
  );
}

export const Loading = ({ what = "Loading" }: { what?: string }) => <div className="term-loading" role="status"><span className="term-blink">▮</span> {what}</div>;

export function Seg<T extends string>({ value, options, onChange, label }: { value: T; options: [T, string][]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="term-seg" role="radiogroup" aria-label={label}>
      {options.map(([v, l]) => (
        <button key={v} type="button" role="radio" aria-checked={v === value} className={v === value ? "on" : ""} onClick={() => onChange(v)}>{l}</button>
      ))}
    </div>
  );
}

export function Spark({ values, width = 64, height = 16 }: { values: (number | null)[]; width?: number; height?: number }) {
  const v = values.filter((x): x is number => x != null && Number.isFinite(x));
  if (v.length < 2) return <svg width={width} height={height} aria-hidden />;
  const lo = Math.min(...v), hi = Math.max(...v);
  const up = v[v.length - 1] >= v[0];
  const d = v.map((y, i) => `${((i / (v.length - 1)) * (width - 2) + 1).toFixed(1)},${(height - 1.5 - ((y - lo) / (hi - lo || 1)) * (height - 3)).toFixed(1)}`).join(" ");
  return <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden className="term-spark"><polyline fill="none" stroke={up ? "var(--t-up)" : "var(--t-down)"} strokeWidth={1.1} points={d} /></svg>;
}

/** Where the last value sits in its 1-year range, as a small bar with a tick. */
export function PctBar({ value }: { value: number | null | undefined }) {
  if (value == null) return <span className="muted">n/a</span>;
  const p = Math.max(0, Math.min(100, value));
  return (
    <span className="term-pctbar" title={`${p.toFixed(0)}th percentile of the past year`}>
      <span className="term-pctbar-fill" style={{ width: `${p}%` }} />
      <span className="term-pctbar-num">{p.toFixed(0)}</span>
    </span>
  );
}

export function Attribution({ text, url }: { text?: string; url?: string }) {
  if (!text && !url) return null;
  return url
    ? <a className="term-attr" href={url} target="_blank" rel="noopener noreferrer">{text ?? "Data provided by CoinGecko"}</a>
    : <span className="term-attr">{text}</span>;
}

// ---------- Table ----------

export interface TCol<T> { key: string; label: ReactNode; title?: string; sort?: (r: T) => number | string | null | undefined; render: (r: T) => ReactNode; align?: "left" | "right"; width?: number | string; className?: string }

export function TTable<T>({ rows, cols, rowKey, initial, onPick, picked, caption, groupOf, groupLabel }: {
  rows: T[]; cols: TCol<T>[]; rowKey: (r: T) => string; initial?: { key: string; dir: "asc" | "desc" };
  onPick?: (r: T) => void; picked?: string | null; caption: string;
  /** Optional grouping: rows keep their group order unless sorted by a column. */
  groupOf?: (r: T) => string; groupLabel?: (g: string) => string;
}) {
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(initial ?? null);
  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = cols.find((c) => c.key === sort.key);
    if (!col?.sort) return rows;
    const get = col.sort;
    const m = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const x = get(a), y = get(b);
      if (x == null && y == null) return 0;
      if (x == null) return 1;
      if (y == null) return -1;
      return (typeof x === "string" ? x.localeCompare(String(y)) : x - (y as number)) * m;
    });
  }, [rows, cols, sort]);
  const toggle = (key: string) => setSort((s) => (s?.key === key ? (s.dir === "desc" ? { key, dir: "asc" } : null) : { key, dir: "desc" }));
  const body = useRef<HTMLTableSectionElement>(null);

  const onKey = (e: React.KeyboardEvent<HTMLTableRowElement>, r: T) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick?.(r); return; }
    const step = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const trs = [...(body.current?.querySelectorAll<HTMLTableRowElement>("tr[data-row]") ?? [])];
    const i = trs.indexOf(e.currentTarget);
    const next = trs[i + step];
    if (next) { next.focus(); next.scrollIntoView({ block: "nearest" }); }
  };

  let lastGroup = "";
  return (
    <div className="term-table-wrap">
      <table className="term-table ui-stagger-rows">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {cols.map((c) => {
              const on = sort?.key === c.key;
              return (
                <th key={c.key} className={`${c.align === "left" ? "l" : ""} ${on ? "on" : ""} ${c.className ?? ""}`} style={c.width ? { width: c.width } : undefined} title={c.title}
                  aria-sort={on ? (sort!.dir === "asc" ? "ascending" : "descending") : undefined}>
                  {c.sort ? <button type="button" onClick={() => toggle(c.key)}>{c.label}{on ? (sort!.dir === "asc" ? "▲" : "▼") : ""}</button> : c.label}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody ref={body}>
          {sorted.flatMap((r) => {
            const k = rowKey(r);
            const out: ReactNode[] = [];
            if (groupOf && !sort) {
              const g = groupOf(r);
              if (g !== lastGroup) {
                lastGroup = g;
                out.push(<tr key={`g-${g}`} className="term-group-row"><th colSpan={cols.length} scope="colgroup">{groupLabel?.(g) ?? g}</th></tr>);
              }
            }
            out.push(
              <tr key={k} data-row tabIndex={onPick ? 0 : undefined} className={`${picked === k ? "picked" : ""} ${onPick ? "pick" : ""}`}
                onClick={onPick ? () => onPick(r) : undefined} onKeyDown={onPick ? (e) => onKey(e, r) : undefined} aria-selected={onPick ? picked === k : undefined}>
                {cols.map((c) => <td key={c.key} className={`${c.align === "left" ? "l" : ""} ${c.className ?? ""}`}>{c.render(r)}</td>)}
              </tr>,
            );
            return out;
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---------- Chart ----------

export interface TSeries { name: string; color: string; points: Point[]; dashed?: boolean }

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function niceTicks(lo: number, hi: number, count: number): number[] {
  const span = hi - lo || 1;
  const raw = span / Math.max(2, count);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= count) ?? mag * 10;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(+v.toFixed(10));
  return out;
}

function timeTicks(t0: number, t1: number, width: number): { t: number; label: string }[] {
  const days = (t1 - t0) / 86_400_000;
  const max = Math.max(2, Math.floor(width / 70));
  const out: { t: number; label: string }[] = [];
  const d0 = new Date(t0);
  if (days > 3 * 365) {
    const y0 = d0.getUTCFullYear() + 1, y1 = new Date(t1).getUTCFullYear();
    const step = Math.max(1, Math.ceil((y1 - y0 + 1) / max));
    for (let y = y0; y <= y1; y += step) out.push({ t: Date.UTC(y, 0, 1), label: String(y) });
  } else if (days > 75) {
    const months = Math.round(days / 30.4);
    const step = [1, 2, 3, 6, 12].find((s) => months / s <= max) ?? 12;
    let y = d0.getUTCFullYear(), m = d0.getUTCMonth() + 1;
    if (m > 11) { m = 0; y += 1; }
    while (Date.UTC(y, m, 1) <= t1) {
      if (m % step === 0) out.push({ t: Date.UTC(y, m, 1), label: m === 0 ? String(y) : `${MONTHS[m]} ${String(y).slice(2)}` });
      m += 1; if (m > 11) { m = 0; y += 1; }
    }
  } else {
    const step = Math.max(1, Math.ceil(days / max));
    for (let t = t0 + 86_400_000; t <= t1; t += step * 86_400_000) {
      const d = new Date(t);
      out.push({ t, label: `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}` });
    }
  }
  return out;
}

/** Keep about `n` points, always including the last. */
function thin(p: Point[], n: number): Point[] {
  if (p.length <= n) return p;
  const step = p.length / n;
  const out: Point[] = [];
  for (let i = 0; i < n; i++) out.push(p[Math.floor(i * step)]);
  out.push(p[p.length - 1]);
  return out;
}

export function TChart({ series, format, height, zero, label, area, log }: {
  series: TSeries[]; format: (v: number) => string; height?: number; zero?: boolean; label: string; area?: boolean; log?: boolean;
}) {
  const [ref, w, hBox] = useBox<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const h = height ?? Math.max(110, hBox);
  const pad = { top: 18, right: 58, bottom: 18, left: 6 };
  const iw = Math.max(10, w - pad.left - pad.right), ih = Math.max(10, h - pad.top - pad.bottom);

  const prepared = useMemo(() => series.filter((s) => s.points.length).map((s) => {
    const p = thin(s.points, Math.max(200, Math.round(iw * 1.5)));
    return { ...s, pts: p.map(([d, v]) => [Date.parse(d), v] as [number, number]) };
  }), [series, iw]);

  if (!prepared.length) return <div className="term-chart" ref={ref} style={height ? { height } : undefined}><Empty title="No data in this range" /></div>;

  const ts = prepared.flatMap((s) => [s.pts[0][0], s.pts[s.pts.length - 1][0]]);
  const t0 = Math.min(...ts), t1 = Math.max(...ts);
  let lo = Infinity, hi = -Infinity;
  for (const s of prepared) for (const [, v] of s.pts) { if (v < lo) lo = v; if (v > hi) hi = v; }
  if (zero) { lo = Math.min(lo, 0); hi = Math.max(hi, 0); }
  const useLog = !!log && lo > 0;
  const tf = (v: number) => (useLog ? Math.log(v) : v);
  if (lo === hi) { lo -= 1; hi += 1; }
  const padY = (tf(hi) - tf(lo)) * 0.06;
  const ylo = tf(lo) - padY, yhi = tf(hi) + padY;
  const x = (t: number) => pad.left + ((t - t0) / (t1 - t0 || 1)) * iw;
  const y = (v: number) => pad.top + ih - ((tf(v) - ylo) / (yhi - ylo || 1)) * ih;
  const yTicks = useLog ? niceTicks(lo, hi, Math.max(2, Math.floor(ih / 34))) : niceTicks(lo, hi, Math.max(2, Math.floor(ih / 34)));
  const xTicks = timeTicks(t0, t1, iw);

  const ht = hover != null ? t0 + (hover / iw) * (t1 - t0) : null;
  const valAt = (pts: [number, number][], t: number): [number, number] | null => {
    let a = 0, b = pts.length - 1, ans: [number, number] | null = null;
    while (a <= b) { const m = (a + b) >> 1; if (pts[m][0] <= t) { ans = pts[m]; a = m + 1; } else b = m - 1; }
    return ans;
  };
  const read = prepared.map((s) => ({ s, p: ht != null ? valAt(s.pts, ht) : s.pts[s.pts.length - 1] }));
  const readDate = ht != null ? read.find((r) => r.p)?.p?.[0] : t1;
  const tagYs = prepared.filter((s) => s.pts.length).map((s) => y(s.pts[s.pts.length - 1][1]));

  return (
    <div className="term-chart" ref={ref} style={height ? { height } : undefined}>
      {w > 0 && (
        <svg width={w} height={h} role="img" aria-label={label}>
          {yTicks.map((v) => (
            <g key={v}>
              <line className="term-gl" x1={pad.left} x2={pad.left + iw} y1={y(v)} y2={y(v)} />
              {/* A tick label under a last-value tag would be drawn over it: leave it out. */}
              {!tagYs.some((ty) => Math.abs(ty - y(v)) < 14) && <text className="term-tick" x={pad.left + iw + 6} y={y(v)} dy="0.32em">{format(v)}</text>}
            </g>
          ))}
          {zero && lo < 0 && hi > 0 && <line className="term-zero" x1={pad.left} x2={pad.left + iw} y1={y(0)} y2={y(0)} />}
          {xTicks.map((k) => (
            <g key={k.t}>
              <line className="term-gl v" x1={x(k.t)} x2={x(k.t)} y1={pad.top} y2={pad.top + ih} />
              <text className="term-tick" x={x(k.t)} y={h - 4} textAnchor="middle">{k.label}</text>
            </g>
          ))}
          {prepared.map((s, i) => {
            const d = s.pts.map(([t, v]) => `${x(t).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
            return (
              <g key={s.name + i}>
                {area && i === 0 && prepared.length === 1 && (
                  <polygon className="term-area-fill ui-fill-in" points={`${x(s.pts[0][0])},${pad.top + ih} ${d} ${x(s.pts[s.pts.length - 1][0])},${pad.top + ih}`} style={{ fill: s.color }} />
                )}
                {/* Solid lines draw in from left to right the first time they show (REF-0023). */}
                <polyline className={s.dashed ? undefined : "ui-draw"} pathLength={s.dashed ? undefined : 1} fill="none" stroke={s.color} strokeWidth={1.3} strokeDasharray={s.dashed ? "4 3" : undefined} strokeLinejoin="round" points={d} />
              </g>
            );
          })}
          {prepared.map((s, i) => {
            const last = s.pts[s.pts.length - 1];
            return (
              <g key={`l${i}`} className="term-lastlab">
                <rect x={pad.left + iw + 2} y={y(last[1]) - 7} width={pad.right - 4} height={14} style={{ fill: s.color }} />
                <text x={pad.left + iw + 6} y={y(last[1])} dy="0.32em">{format(last[1])}</text>
              </g>
            );
          })}
          {ht != null && (
            <g>
              <line className="term-cross" x1={pad.left + hover!} x2={pad.left + hover!} y1={pad.top} y2={pad.top + ih} />
              {read.map(({ s, p }, i) => p && <circle key={i} cx={x(p[0])} cy={y(p[1])} r={2.5} fill={s.color} />)}
            </g>
          )}
          <rect x={pad.left} y={pad.top} width={iw} height={ih} fill="transparent"
            onPointerMove={(e) => { const b = e.currentTarget.getBoundingClientRect(); setHover(Math.max(0, Math.min(iw, e.clientX - b.left))); }}
            onPointerLeave={() => setHover(null)} />
        </svg>
      )}
      <div className="term-chart-read" aria-live="off">
        {readDate != null && <span className="term-chart-date">{new Date(readDate).toISOString().slice(0, 10)}</span>}
        {read.map(({ s, p }, i) => (
          <span key={i}><i style={{ background: s.color }} />{s.name} <b>{p ? format(p[1]) : "n/a"}</b></span>
        ))}
      </div>
    </div>
  );
}

export const fmtAxis = (v: number) => {
  const a = Math.abs(v);
  const s = a >= 10000 ? `${(a / 1000).toFixed(0)}k` : a >= 1000 ? a.toFixed(0) : a >= 100 ? a.toFixed(1) : a >= 10 ? a.toFixed(2) : a >= 1 ? a.toFixed(3) : a === 0 ? "0" : a.toPrecision(3);
  return (v < 0 ? MINUS : "") + s;
};

export const RANGES = ["1M", "3M", "1Y", "5Y", "MAX"] as const;
export type Range = (typeof RANGES)[number];
const RANGE_DAYS: Record<Range, number> = { "1M": 31, "3M": 92, "1Y": 366, "5Y": 1827, MAX: Infinity };

export function sliceRange(p: Point[], r: Range): Point[] {
  if (!p.length || r === "MAX") return p;
  const end = Date.parse(p[p.length - 1][0]);
  const from = new Date(end - RANGE_DAYS[r] * 86_400_000).toISOString().slice(0, 10);
  const i = p.findIndex((x) => x[0] >= from);
  return i < 0 ? p : p.slice(Math.max(0, i - 1));
}
