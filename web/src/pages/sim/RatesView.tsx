// Rates and curves: the US Treasury yield curve changing shape through time, and a race of
// each currency's interest rate gap with the US dollar (the carry behind currency trades).
import { useMemo } from "react";
import type { WorldData } from "../../lib/world";
import { useWidth } from "./shared";
import { WindowSelect } from "./play/Controls";
import { agoIndex, at, colorAt, dayMonthYear, weekly, windowRange } from "./play/data";
import { lastCommon, SeriesRace, type RaceItem } from "./play/SeriesRace";

const CURVE = [
  { key: "rate.TBILL3M", label: "3m", years: 0.25 },
  { key: "bond.UST2Y", label: "2y", years: 2 },
  { key: "bond.UST10Y", label: "10y", years: 10 },
  { key: "bond.UST30Y", label: "30y", years: 30 },
];

export function RatesView({ data, win, setWin }: { data: WorldData; win: string; setWin: (w: string) => void }) {
  const last = useMemo(() => lastCommon(data, ["bond.UST10Y", "bond.UST2Y"]), [data]);
  const [a, b] = useMemo(() => windowRange(data.weekly.dates, win, last), [data, win, last]);
  const items: RaceItem[] = useMemo(() => {
    const us = weekly(data, "rate:USD");
    const gaps = Object.keys(data.rates).filter((c) => c !== "USD").map((code, i) => {
      const r = weekly(data, `rate:${code}`);
      const label = data.assets.find((x) => x.key === code)?.label ?? code;
      return { key: code, label: `${code} ${label}`, color: colorAt(i), values: r.map((v, k) => (v == null || us[k] == null ? null : v - (us[k] as number))) };
    });
    const t10 = weekly(data, "bond.UST10Y"), t3 = weekly(data, "rate.TBILL3M");
    const slope = { key: "slope", label: "US curve: 10y minus 3m", color: "var(--text-2)", dashed: true, bench: true,
      note: "Below zero the curve is inverted: short rates above long ones, which has often come before US recessions",
      values: t10.map((v, k) => (v == null || t3[k] == null ? null : v - (t3[k] as number))) };
    return [...gaps, slope];
  }, [data]);

  return (
    <SeriesRace data={data} items={items} a={a} b={b} mode="level" unitLabel=" pts" name="Rate gap vs USD"
      valueFmt={(v) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(2)}`}
      eyebrow="Rates · the Treasury curve, and each currency's rate gap with the dollar"
      controls={<WindowSelect value={win} onChange={setWin} />}
      honest={<>Rate gaps use 3-month interbank rates (OECD, monthly, carried forward), in percentage points; above zero, holding that currency earned more interest than holding dollars. Only nine currencies have a rate in our data. Treasury yields are daily (Fed), shown weekly; the 30-year was not issued from 2002 to 2006.</>}
      above={(k) => <Curve data={data} k={k} start={a} />}
    />
  );
}

function Curve({ data, k, start }: { data: WorldData; k: number; start: number }) {
  const [ref, width] = useWidth<HTMLDivElement>(240);
  const series = useMemo(() => CURVE.map((c) => ({ ...c, v: weekly(data, c.key) })), [data]);
  const height = 190;
  const pad = { top: 16, right: 16, bottom: 26, left: 44 };
  const w = width - pad.left - pad.right, h = height - pad.top - pad.bottom;
  const [lo, hi] = useMemo(() => {
    let mn = 0, mx = 1;
    for (const s of series) for (let j = start; j < s.v.length; j++) { const v = s.v[j]; if (v != null) { mn = Math.min(mn, v); mx = Math.max(mx, v); } }
    return [Math.floor(mn), Math.ceil(mx + 0.25)];
  }, [series, start]);
  const xs = (years: number) => pad.left + (Math.log(years / 0.25) / Math.log(30 / 0.25)) * w;
  const y = (v: number) => pad.top + h - ((v - lo) / (hi - lo || 1)) * h;
  const curveAt = (j: number) => series.map((s) => ({ s, v: j >= 0 ? at(s.v, j) : null })).filter((p) => p.v != null) as { s: (typeof series)[number]; v: number }[];
  const now = curveAt(k), first = curveAt(start), ago = curveAt(agoIndex(data.weekly.dates, k));
  const line = (pts: { s: { years: number }; v: number }[]) => pts.map((p, n) => `${n ? "L" : "M"}${xs(p.s.years).toFixed(1)},${y(p.v).toFixed(1)}`).join("");
  const t10 = now.find((p) => p.s.label === "10y")?.v, t3 = now.find((p) => p.s.label === "3m")?.v;
  const inverted = t10 != null && t3 != null && t10 < t3;
  const ticks = Array.from({ length: hi - lo + 1 }, (_, n) => lo + n).filter((v, _, arr) => arr.length <= 9 || v % 2 === 0);
  return (
    <div className="pb-curve" ref={ref}>
      <div className="pb-curve-head">
        <span>US Treasury yield curve on {dayMonthYear(data.weekly.dates[k] ?? "")}</span>
        {inverted && <span className="sw-inside">Inverted</span>}
      </div>
      <svg width={width} height={height} role="img" aria-label="US Treasury yields by maturity">
        {ticks.map((v) => (
          <g key={v}><line x1={pad.left} x2={pad.left + w} y1={y(v)} y2={y(v)} className="sw-grid" /><text x={pad.left - 8} y={y(v) + 4} textAnchor="end" className="sw-axis">{v}%</text></g>
        ))}
        {CURVE.map((c) => <text key={c.label} x={xs(c.years)} y={height - 6} textAnchor="middle" className="sw-axis">{c.label}</text>)}
        {first.length > 1 && <path d={line(first)} className="pb-curve-ghost" />}
        {ago.length > 1 && <path d={line(ago)} className="pb-curve-ago" />}
        {now.length > 1 && <path d={line(now)} className="pb-curve-now" />}
        {now.map((p) => <g key={p.s.label}><circle cx={xs(p.s.years)} cy={y(p.v)} r={3.5} className="pb-curve-dot" /><text x={xs(p.s.years)} y={y(p.v) - 8} textAnchor="middle" className="pb-curve-val">{p.v.toFixed(2)}</text></g>)}
      </svg>
      <div className="pb-curve-key"><span><i className="now" />Now</span><span><i className="ago" />A year earlier</span><span><i className="ghost" />Start of the window</span></div>
    </div>
  );
}
