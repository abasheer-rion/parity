// The charts in the "how it holds up" section. Each has a fixed height (so nothing moves
// as it draws, DEC-0061) and a data table next to it as its text alternative (WCAG 1.1.1).
import { useId } from "react";
import type { Holdup, Point } from "../../lib/types";
import { BarChart, LineChart } from "../../ui/charts";
import { dec, pct } from "./text";

export const STRATEGY_COLOR = "var(--series-1)";
export const BENCH_COLOR = "var(--color-benchmark)";

/** The equity and underwater series from the section's sampled growth curve. */
export function curves(h: Holdup): { strategy: Point[]; benchmark: Point[]; ddStrategy: Point[]; ddBenchmark: Point[] } {
  const e = h.equity_vs_benchmark;
  const pts = (vals: (number | null)[] | null): Point[] => (vals ? e.dates.flatMap((d, i) => (vals[i] == null ? [] : [[d, vals[i]!] as Point])) : []);
  const under = (p: Point[]): Point[] => { let peak = -Infinity; return p.map(([d, v]) => { peak = Math.max(peak, v); return [d, v / peak - 1] as Point; }); };
  const strategy = pts(e.strategy), benchmark = pts(e.benchmark);
  return { strategy, benchmark, ddStrategy: under(strategy), ddBenchmark: under(benchmark) };
}

export function EquityChart({ h, name, bench }: { h: Holdup; name: string; bench: string }) {
  const c = curves(h);
  return (
    <LineChart label={`Growth of 1 dollar, ${name}${c.benchmark.length ? ` against ${bench}` : ""}`} log height={240} format={(v) => `${v.toFixed(2)}x`}
      series={[{ name, color: STRATEGY_COLOR, points: c.strategy, emphasis: true }, ...(c.benchmark.length ? [{ name: bench, color: BENCH_COLOR, points: c.benchmark }] : [])]} />
  );
}

export function UnderwaterChart({ h, name, bench }: { h: Holdup; name: string; bench: string }) {
  const c = curves(h);
  return (
    <LineChart label={`Fall from the last high, ${name}`} height={180} format={(v) => pct(v, 0)}
      series={[{ name, color: "var(--color-negative)", points: c.ddStrategy, emphasis: true }, ...(c.ddBenchmark.length ? [{ name: bench, color: BENCH_COLOR, points: c.ddBenchmark }] : [])]} />
  );
}

/**
 * The resampled Sharpe ratios as a histogram, with the 80% and 95% ranges shaded behind
 * it, a line at zero and a marker at the record's own Sharpe.
 */
export function RangeChart({ h }: { h: Holdup }) {
  const b = h.bootstrap;
  const id = useId();
  if (!b || !b.histogram.counts.length) return null;
  const W = 640, H = 200, L = 12, R = 12, T = 22, B = 30;
  const edges = b.histogram.edges.map((v) => v ?? 0);
  const lo = Math.min(edges[0], 0), hi = Math.max(edges[edges.length - 1], 0);
  const x = (v: number) => L + ((v - lo) / (hi - lo || 1)) * (W - L - R);
  const max = Math.max(...b.histogram.counts, 1);
  const y = (c: number) => H - B - (c / max) * (H - T - B);
  const band = (r: [number | null, number | null] | null, cls: string) =>
    r && r[0] != null && r[1] != null ? <rect x={x(r[0])} y={T} width={Math.max(1, x(r[1]) - x(r[0]))} height={H - T - B} className={cls} /> : null;
  const s95 = b.sharpe.ci95, point = b.sharpe.point;
  const label = `Sharpe ratio from ${b.n} reshuffles of the record. 95% of them fall between ${dec(s95?.[0])} and ${dec(s95?.[1])}; the record itself is ${dec(point)}.`;
  return (
    <figure className="hu-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={id} className="hu-svg">
        <title id={id}>{label}</title>
        {band(b.sharpe.ci95, "hu-band95")}
        {band(b.sharpe.ci80, "hu-band80")}
        {b.histogram.counts.map((c, i) => (
          <rect key={i} x={x(edges[i]) + 0.5} y={y(c)} width={Math.max(0.5, x(edges[i + 1]) - x(edges[i]) - 1)} height={H - B - y(c)} className="hu-bar" />
        ))}
        <line x1={x(0)} x2={x(0)} y1={T - 6} y2={H - B} className="hu-zero" />
        <text x={x(0)} y={T - 9} textAnchor="middle" className="hu-axis">0</text>
        {point != null && (
          <g>
            <line x1={x(point)} x2={x(point)} y1={T - 6} y2={H - B} className="hu-mark" />
            <circle cx={x(point)} cy={H - B} r={4} className="hu-mark-dot" />
            <text x={Math.min(W - R, Math.max(L, x(point)))} y={T - 9} textAnchor={x(point) > W - 90 ? "end" : x(point) < 90 ? "start" : "middle"} className="hu-mark-label">This record {dec(point)}</text>
          </g>
        )}
        <line x1={L} x2={W - R} y1={H - B} y2={H - B} className="hu-baseline" />
        {[edges[0], edges[edges.length - 1]].map((v, i) => (
          <text key={i} x={x(v)} y={H - B + 16} textAnchor={i ? "end" : "start"} className="hu-axis">{dec(v)}</text>
        ))}
        <text x={(L + W - R) / 2} y={H - 4} textAnchor="middle" className="hu-axis">Sharpe ratio in each reshuffle</text>
      </svg>
    </figure>
  );
}

const heatClass = (v: number | null) => {
  if (v == null) return "hu-heat-na";
  const step = Math.min(4, Math.floor(Math.abs(v) * 5));
  return `hu-heat-${v >= 0 ? "p" : "n"}${step}`;
};

/** One row of coloured cells per comparison series, one cell per month. */
export function CorrHeatmap({ h }: { h: Holdup }) {
  const c = h.rolling_correlation;
  const id = useId();
  if (!c || !c.dates.length) return null;
  const rows = (["stocks", "bonds"] as const).filter((k) => c.series[k]?.length);
  const W = 640, L = 64, R = 8, rowH = 26, T = 4, B = 20;
  const H = T + rows.length * (rowH + 4) + B;
  const n = c.dates.length;
  const cw = (W - L - R) / n;
  const years = c.dates.map((d, i) => [d.slice(0, 4), i] as const).filter(([yv, i]) => i === 0 || c.dates[i - 1].slice(0, 4) !== yv);
  const every = Math.max(1, Math.ceil(years.length / 8));
  const label = `Correlation over each past year, month by month, from ${c.dates[0]} to ${c.dates[n - 1]}. ${rows.map((k) => `${k === "stocks" ? "Stocks" : "Bonds"}: latest ${dec(c.latest[k])}`).join(". ")}.`;
  return (
    <figure className="hu-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={id} className="hu-svg">
        <title id={id}>{label}</title>
        {rows.map((k, r) => (
          <g key={k}>
            <text x={L - 8} y={T + r * (rowH + 4) + rowH / 2 + 4} textAnchor="end" className="hu-axis">{k === "stocks" ? "Stocks" : "Bonds"}</text>
            {c.series[k]!.map((v, i) => <rect key={i} x={L + i * cw} y={T + r * (rowH + 4)} width={Math.max(0.6, cw - (cw > 3 ? 0.6 : 0))} height={rowH} className={heatClass(v)} />)}
          </g>
        ))}
        {years.filter((_, i) => i % every === 0).map(([yv, i]) => <text key={yv} x={L + i * cw} y={H - 5} className="hu-axis">{yv}</text>)}
      </svg>
      <figcaption className="hu-legend" aria-hidden>
        <span><i className="hu-heat-n4" /> moves against</span>
        <span><i className="hu-heat-p0" /> unrelated</span>
        <span><i className="hu-heat-p4" /> moves with</span>
      </figcaption>
    </figure>
  );
}

export function RegimeBars({ name, bench, family }: { name: string; bench: string; family: Holdup["regimes"][number] }) {
  const hasBench = family.items.some((i) => i.benchmark_ann != null);
  return (
    <BarChart label={`Return per year in each period, ${name}${hasBench ? ` against ${bench}` : ""}`} height={180} format={(v) => pct(v, 0)}
      groups={family.items.map((i) => ({
        label: i.label.replace(/ (crash|crisis|bear market)$/i, ""),
        values: [{ name, color: STRATEGY_COLOR, value: i.strategy_ann }, ...(hasBench ? [{ name: bench, color: BENCH_COLOR, value: i.benchmark_ann }] : [])],
      }))} />
  );
}
