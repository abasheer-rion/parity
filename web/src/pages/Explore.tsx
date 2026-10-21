import { Title } from "../components/Shell";
import { useMemo, useState } from "react";
import { LineChart } from "../ui/charts";
import { Card } from "../ui/layout";
import type { Point, Report } from "../lib/types";
import { Term } from "./Learn";

const PALETTE = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)", "var(--series-5)", "var(--series-6)"];

function weeklyReturns(points: Point[]): Map<string, number> {
  const out = new Map<string, number>();
  for (let i = 1; i < points.length; i++) out.set(points[i][0], points[i][1] / points[i - 1][1] - 1);
  return out;
}

function corr(a: number[], b: number[]): number | null {
  const n = a.length;
  if (n < 10) return null;
  const ma = a.reduce((s, x) => s + x, 0) / n;
  const mb = b.reduce((s, x) => s + x, 0) / n;
  let sab = 0, saa = 0, sbb = 0;
  for (let i = 0; i < n; i++) { sab += (a[i] - ma) * (b[i] - mb); saa += (a[i] - ma) ** 2; sbb += (b[i] - mb) ** 2; }
  return saa && sbb ? sab / Math.sqrt(saa * sbb) : null;
}

export function Explore({ report }: { report: Report }) {
  const series = report.series ?? {};
  const keys = Object.keys(series).sort();
  const [picked, setPicked] = useState<string[]>(["fx.CAD", "cmd.WTI"].filter((k) => keys.includes(k)));
  const [start, setStart] = useState("2010-01-01");
  const [mode, setMode] = useState<"index" | "level">("index");
  const [windowWeeks, setWindowWeeks] = useState(52);
  const [lagWeeks, setLagWeeks] = useState(0);

  const toggle = (k: string) =>
    setPicked((p) => (p.includes(k) ? p.filter((x) => x !== k) : p.length >= 6 ? p : [...p, k]));

  const chart = picked.map((k, i) => {
    const pts = series[k].points.filter((p) => p[0] >= start);
    const base = pts[0]?.[1] ?? 1;
    return { name: k, color: PALETTE[i], points: mode === "index" ? pts.map(([d, v]) => [d, (v / base) * 100] as Point) : pts };
  });

  // Rolling correlation of weekly returns between the first two picked series,
  // with the second one shifted by `lagWeeks` (positive = second leads first).
  const rolling = useMemo(() => {
    if (picked.length < 2) return null;
    const ra = weeklyReturns(series[picked[0]].points.filter((p) => p[0] >= start));
    const rbPts = series[picked[1]].points.filter((p) => p[0] >= start);
    const rbList = [...weeklyReturns(rbPts).entries()];
    const rbShift = new Map<string, number>();
    rbList.forEach(([d], i) => { const j = i - lagWeeks; if (j >= 0 && j < rbList.length) rbShift.set(d, rbList[j][1]); });
    const dates = [...ra.keys()].filter((d) => rbShift.has(d));
    const out: Point[] = [];
    for (let i = windowWeeks; i <= dates.length; i++) {
      const w = dates.slice(i - windowWeeks, i);
      const c = corr(w.map((d) => ra.get(d)!), w.map((d) => rbShift.get(d)!));
      if (c != null) out.push([w[w.length - 1], c]);
    }
    const all = corr(dates.map((d) => ra.get(d)!), dates.map((d) => rbShift.get(d)!));
    return { points: out, all };
  }, [picked, start, windowWeeks, lagWeeks, series]);

  if (!keys.length) return <p className="muted">This run has no market series attached. Run the engine again to include them.</p>;

  return (
    <>
      <div className="page-head">
        <Title>Explore the data</Title>
        <p>Look at the raw series behind every strategy. Pick up to six, choose a start date, and compare them indexed to
          100. Pick two to see how closely they move together over time, and whether one leads the other. Weekly data,
          so anything faster than a week is invisible here.</p>
      </div>
      <Card title="Series">
        <div className="chips">
          {keys.map((k) => (
            <button key={k} className={`chip ${picked.includes(k) ? "on" : ""}`} onClick={() => toggle(k)} title={series[k].description}>{k}</button>
          ))}
        </div>
        <div className="filters">
          <label>From <input type="date" value={start} min="2000-01-01" onChange={(e) => setStart(e.target.value)} /></label>
          <label><input type="radio" checked={mode === "index"} onChange={() => setMode("index")} /> Indexed to 100</label>
          <label><input type="radio" checked={mode === "level"} onChange={() => setMode("level")} /> Raw levels</label>
        </div>
      </Card>
      {chart.length > 0 && (
        <Card title={mode === "index" ? "Indexed to 100 at the start date" : "Raw levels"} help={mode === "level" && chart.length > 1 ? "Different units on one axis; use indexed mode to compare shapes." : undefined}>
          <LineChart label="Selected market series" series={chart} format={(v) => (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(2))} />
          <ul className="small muted">{picked.map((k) => <li key={k}><code>{k}</code>: {series[k].description} ({series[k].source} {series[k].code})</li>)}</ul>
        </Card>
      )}
      {rolling && (
        <Card title={`How ${picked[0]} and ${picked[1]} move together`}
          help={<>Rolling <Term id="correlation">correlation</Term> of weekly returns. Whole period: {rolling.all == null ? "n/a" : rolling.all.toFixed(2)}. Shift the second series to test whether it leads the first; a correlation that only appears at a lag is a possible signal, and something to register, not trade.</>}>
          <div className="filters">
            <label>Window <select value={windowWeeks} onChange={(e) => setWindowWeeks(Number(e.target.value))}>
              {[26, 52, 104, 156].map((w) => <option key={w} value={w}>{w} weeks</option>)}</select></label>
            <label>{picked[1]} leads by <select value={lagWeeks} onChange={(e) => setLagWeeks(Number(e.target.value))}>
              {[0, 1, 2, 4, 8, 13].map((w) => <option key={w} value={w}>{w} weeks</option>)}</select></label>
          </div>
          <LineChart label="Rolling correlation" height={220} format={(v) => v.toFixed(2)}
            series={[{ name: `corr(${picked[0]}, ${picked[1]}${lagWeeks ? ` lagged ${lagWeeks}w` : ""})`, color: "var(--series-1)", points: rolling.points }]} />
          <p className="muted small">Every lag and window you look at here is a trial. If something interesting appears, write it down as a hypothesis before testing it.</p>
        </Card>
      )}
    </>
  );
}
