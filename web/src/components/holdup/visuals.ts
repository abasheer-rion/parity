// The "how it holds up" numbers as signature chart visuals (DEC-0067): each block of the
// section gets a short step-by-step picture built from the record's own numbers. Pure
// functions, so tests can check every picture renders for real and missing data.
import type { Holdup, HoldupRegimeFamily, Point } from "../../lib/types";
import type { SigStep, SigVisual } from "../../ui/signature";
import { dec, pct, regimeTally } from "./text";

/** The equity and underwater series from the section's sampled growth curve. */
export function curves(h: Holdup): { strategy: Point[]; benchmark: Point[]; ddStrategy: Point[]; ddBenchmark: Point[] } {
  const e = h.equity_vs_benchmark;
  const pts = (vals: (number | null)[] | null): Point[] => (vals ? e.dates.flatMap((d, i) => (vals[i] == null ? [] : [[d, vals[i]!] as Point])) : []);
  const under = (p: Point[]): Point[] => { let peak = -Infinity; return p.map(([d, v]) => { peak = Math.max(peak, v); return [d, v / peak - 1] as Point; }); };
  const strategy = pts(e.strategy), benchmark = pts(e.benchmark);
  return { strategy, benchmark, ddStrategy: under(strategy), ddBenchmark: under(benchmark) };
}

const r4 = (v: number) => Math.round(v * 1e4) / 1e4;

/** Where a date sits along the sampled curve, as a share from 0 to 1. */
function at(dates: string[], d: string): number {
  if (dates.length < 2) return 0;
  const i = dates.findIndex((x) => x >= d);
  return (i < 0 ? dates.length - 1 : i) / (dates.length - 1);
}

export function equityVisual(h: Holdup, name: string, bench: string): SigVisual | null {
  const c = curves(h);
  if (c.strategy.length < 2) return null;
  const dates = c.strategy.map((p) => p[0]);
  const labels = dates.map((d) => d.slice(0, 7));
  const hasBench = !!bench && c.benchmark.length === c.strategy.length;
  const crises = (h.regimes.find((f) => f.family === "crises")?.items ?? [])
    .filter((i) => i.start && i.end)
    .map((i) => ({ from: at(dates, i.start!), to: at(dates, i.end!), label: i.label.replace(/ (crash|crisis|bear market)$/i, ""), tone: i.wins === false ? "neg" : i.wins ? "pos" : "muted" }));
  const s = c.strategy.at(-1)![1], b = hasBench ? c.benchmark.at(-1)![1] : null;
  const steps: SigStep[] = [
    { caption: `1 dollar in ${name} from ${labels[0].slice(0, 4)}${hasBench ? `, next to the ${bench}` : ""}.`, to: 0.3 },
    { caption: crises.length ? "Shaded: the named stock market crises. Green where it beat the market, red where it did worse." : "The whole record.", to: 1, bands: crises },
    {
      caption: b == null ? `It ended at ${dec(s)} dollars.` : `It ended at ${dec(s)} dollars, against ${dec(b)} for the ${bench}.`,
      verdict: b == null ? `${dec(s)}x over the record.` : s > b ? `Ahead of the market: ${dec(s)}x against ${dec(b)}x.` : `Behind the market: ${dec(s)}x against ${dec(b)}x.`,
      tone: b == null ? "accent" : s > b ? "pos" : "neg",
    },
  ];
  return {
    kind: "equity",
    alt: `Growth of 1 dollar in ${name} from ${dates[0]} to ${dates.at(-1)}${hasBench ? `, against the ${bench}` : ""}. It ended at ${dec(s)} dollars${b == null ? "" : ` against ${dec(b)}`}.`,
    params: {
      fmt: "x", labels,
      series: [{ label: name, values: c.strategy.map((p) => r4(p[1])) }, ...(hasBench ? [{ label: bench, values: c.benchmark.map((p) => r4(p[1])), role: "benchmark" }] : [])],
      headline: { label: `${name}, growth of 1 dollar` },
    },
    steps,
  };
}

export function rangeVisual(h: Holdup): SigVisual | null {
  const bs = h.bootstrap;
  if (!bs || !bs.histogram.counts.length || bs.histogram.edges.some((e) => e == null)) return null;
  const point = bs.sharpe.point, ci = bs.sharpe.ci95;
  const above = ci?.[0] != null && ci[0] > 0;
  return {
    kind: "distribution",
    alt: `The Sharpe ratio in each of ${bs.n} reshuffles of the record. 95% fall between ${dec(ci?.[0])} and ${dec(ci?.[1])}; the record itself is ${dec(point)}.`,
    params: {
      edges: bs.histogram.edges as number[], counts: bs.histogram.counts, fmt: "num2", par: 0, parLabel: "Zero",
      marker: point == null ? undefined : { value: point, label: "This record", tone: "accent" },
      band: ci?.[0] != null && ci[1] != null ? { lo: ci[0], hi: ci[1], label: "95% of reshuffles" } : undefined,
      countLabel: "Reshuffles", beatLabel: "Of reshuffles below it", ends: { low: "Worse", high: "Better" },
    },
    steps: [
      { caption: `The record reshuffled ${bs.n.toLocaleString("en-US")} times in one-month blocks. Each bar counts the Sharpe ratios that landed there.`, grow: 1 },
      { caption: "95 of every 100 reshuffles land inside the shaded range.", band: 1 },
      { caption: "The record's own Sharpe ratio.", marker: 1 },
      { caption: above ? "The whole range sits above zero." : "The range reaches zero, so no edge at all is still possible.", verdict: above ? `Sharpe between ${dec(ci?.[0])} and ${dec(ci?.[1])}, above zero.` : `Sharpe between ${dec(ci?.[0])} and ${dec(ci?.[1])}: zero is inside.`, tone: above ? "pos" : "warn" },
    ],
  };
}

export function corrVisual(h: Holdup): SigVisual | null {
  const c = h.rolling_correlation;
  if (!c || !c.dates.length) return null;
  const rows = (["stocks", "bonds"] as const).filter((k) => c.series[k]?.length).map((k) => ({ label: k === "stocks" ? "Stocks" : "Bonds", values: c.series[k]!.map((v) => (v == null ? null : r4(v))) }));
  if (!rows.length) return null;
  const st = c.full_period.stocks;
  return {
    kind: "heatmap",
    alt: `One-year rolling correlation with ${rows.map((r) => r.label.toLowerCase()).join(" and ")}, month by month from ${c.dates[0]} to ${c.dates.at(-1)}.`,
    params: { labels: c.dates.map((d) => d.slice(0, 7)), rows },
    steps: [
      { caption: "Each cell compares one year of daily returns with the market.", to: 0.5 },
      { caption: "Teal cells move with it. Violet cells move against it.", to: 1 },
      { caption: "Over the whole record.", verdict: st == null ? "Correlation with bonds only." : `${dec(st)} with stocks${c.full_period.bonds != null ? `, ${dec(c.full_period.bonds)} with bonds` : ""}.`, tone: "accent" },
    ],
  };
}

export function regimeVisual(h: Holdup): SigVisual | null {
  const fams = h.regimes.filter((f) => f.available && f.items.length);
  // Crises last weeks to months, so their yearly rate would be extreme: show the total over the fall.
  const val = (f: HoldupRegimeFamily, v: { ann: number | null; total: number | null }) => (f.family === "crises" ? v.total : v.ann);
  const rows = fams.flatMap((f) => f.items.map((i) => ({
    label: i.label.replace(/ (crash|crisis|bear market)$/i, ""),
    strategy: val(f, { ann: i.strategy_ann, total: i.strategy_total }),
    benchmark: val(f, { ann: i.benchmark_ann, total: i.benchmark_total }),
  })));
  if (!rows.length) return null;
  const items = rows.map((r) => ({ label: r.label, strategy: r.strategy ?? 0, ...(r.benchmark != null ? { benchmark: r.benchmark } : {}) }));
  const steps: SigStep[] = [];
  let n = 0;
  for (const f of fams) {
    n += f.items.length;
    steps.push({ caption: FAM[f.family], reveal: n });
  }
  const t = regimeTally(h);
  let best = -1, worst = -1, hi = -Infinity, lo = Infinity;
  rows.forEach((r, k) => {
    if (r.benchmark == null || r.strategy == null) return;
    const g = r.strategy - r.benchmark;
    if (g > hi) { hi = g; best = k; }
    if (g < lo) { lo = g; worst = k; }
  });
  const verdict = best < 0 ? "No benchmark to compare against."
    : `Furthest ahead: ${rows[best].label}.${worst >= 0 && lo < 0 ? ` Furthest behind: ${rows[worst].label}.` : ""}`;
  steps.push({
    caption: t.total ? `It beat the market in ${t.won} of ${t.total} periods.` : "Its own return in each kind of market.",
    ...(best >= 0 ? { highlight: best } : {}),
    verdict, tone: !t.total ? "accent" : t.won * 2 >= t.total ? "pos" : "neg",
  });
  return {
    kind: "regimes",
    alt: `Return in ${items.length} kinds of market, a year for most and the total over each crisis${t.total ? `, against the market. It did better in ${t.won} of ${t.total}` : ""}.`,
    params: { fmt: "pctSigned", items, caption: fams.some((f) => f.family === "crises") ? "Return a year; crises show the total over the fall" : "Return a year in each kind of market", label: t.total ? "Periods it beat the market" : "Periods it made money" },
    steps,
  };
}

const FAM: Record<Holdup["regimes"][number]["family"], string> = {
  rates: "When rates were rising and when they were falling.",
  volatility: "Calm markets and volatile ones.",
  crises: "The named stock market crises, as the total over each fall.",
  decades: "Each decade.",
};

export function underwaterVisual(h: Holdup, name: string): SigVisual | null {
  const c = curves(h);
  if (c.strategy.length < 2) return null;
  const d = h.worst_periods.drawdowns[0];
  // The curve is sampled, so it can step over the deepest day. Put that day back in, at its
  // measured depth below the high before it, so the picture and the table agree.
  const pts = c.strategy.map((p) => [p[0], p[1]] as [string, number]);
  if (d?.depth != null) {
    const k = pts.findIndex((p) => p[0] >= d.trough);
    const i = k < 0 ? pts.length : k;
    if (pts[i]?.[0] !== d.trough) {
      const peak = Math.max(...pts.slice(0, Math.max(1, i)).map((p) => p[1]));
      pts.splice(i, 0, [d.trough, peak * (1 + d.depth)]);
    }
  }
  return {
    kind: "underwater",
    alt: `How far ${name} stood below its last high, from ${pts[0][0]} to ${pts.at(-1)![0]}. The deepest fall was ${pct(d?.depth)}.`,
    params: { values: pts.map((p) => r4(p[1])), labels: pts.map((p) => p[0].slice(0, 7)), fmt: "x" },
    steps: [
      { caption: "The red area is how far it stood below its last high.", to: 1 },
      { caption: d ? `The deepest fall: ${pct(d.depth)}, from ${d.start} to ${d.trough}.` : "No fall from a high.", to: 1, worst: true, verdict: d ? (d.recovery ? `${pct(d.depth)} at worst, back to the high after ${Math.round(d.days / 30.4)} months.` : `${pct(d.depth)} at worst, not back to the high yet.`) : "No fall.", tone: "neg" },
    ],
  };
}
