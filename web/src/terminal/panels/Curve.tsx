// CRV: yield curves from the index (US Treasury, euro area AAA when present) now, a month
// ago and a year ago, and Sim World's rates replay on a second tab.
import { useMemo } from "react";
import { useAsOf, useOpt, useTerm } from "../context";
import type { TermIndex, TermSeries } from "../data";
import { fmtNum, MINUS, tone } from "../fmt";
import { Empty, Seg, useBox } from "../tui";
import { usePick } from "./common";
import { SimPanel } from "./Sim";

interface Point { s: TermSeries; years: number; tenor: string; now: number; w1: number | null; m1: number | null; y1: number | null }
interface Curve { id: string; label: string; pts: Point[] }

function tenorOf(key: string): { years: number; tenor: string } | null {
  const tail = key.split(/[._]/).pop() ?? "";
  const m = tail.match(/(\d+(?:\.\d+)?)\s*(MO|M|YR|Y|W)$/i) ?? key.match(/(\d+(?:\.\d+)?)\s*(MO|M|YR|Y|W)$/i);
  if (!m) return null;
  const n = parseFloat(m[1]);
  const u = m[2].toUpperCase();
  const years = u.startsWith("M") ? n / 12 : u === "W" ? n / 52 : n;
  return { years, tenor: `${m[1]}${u.startsWith("M") ? "M" : u === "W" ? "W" : "Y"}` };
}

function build(ix: TermIndex, test: (k: string) => boolean, prefer?: (k: string) => boolean): Point[] {
  const byTenor = new Map<string, Point>();
  for (const s of ix.series) {
    if (!test(s.key) || s.last == null) continue;
    const t = tenorOf(s.key);
    if (!t) continue;
    const p: Point = {
      s, ...t, now: s.last,
      w1: s.chg?.w1 != null ? s.last - s.chg.w1 : null,
      m1: s.chg?.m1 != null ? s.last - s.chg.m1 : null,
      y1: s.spark?.length ? s.spark.find((v) => v != null) ?? null : null,
    };
    const had = byTenor.get(t.tenor);
    if (!had || (prefer && prefer(s.key) && !prefer(had.s.key))) byTenor.set(t.tenor, p);
  }
  return [...byTenor.values()].sort((a, b) => a.years - b.years);
}

export function curvesOf(ix: TermIndex): Curve[] {
  const ust = build(ix, (k) => /^curve\.UST_/i.test(k) || /^bond\.UST/i.test(k), (k) => /^curve\./i.test(k));
  const ea = build(ix, (k) => /^curve\.EA_AAA_/i.test(k));
  return [
    { id: "ust", label: "US Treasury", pts: ust },
    { id: "ea", label: "Euro area AAA", pts: ea },
  ].filter((c) => c.pts.length >= 2);
}

export function CurvePanel() {
  const [tab, setTab] = useOpt("tab", "curves");
  return (
    <div className="term-col">
      <div className="term-bar">
        <Seg label="View" value={tab} onChange={setTab} options={[["curves", "Curves"], ["replay", "Rates replay"]]} />
      </div>
      {tab === "replay" ? <SimPanel fn="RATES" /> : <Curves />}
    </div>
  );
}

function Curves() {
  const t = useTerm();
  const ix = t.index.status === "ok" ? t.index.data : null;
  useAsOf(ix?.data_through);
  const curves = useMemo(() => (ix ? curvesOf(ix) : []), [ix]);
  if (!ix) return <Empty title={t.index.status === "loading" ? "Loading" : "No terminal data yet"}>{t.index.status === "missing" || t.index.status === "error" ? t.index.message : null} The rates replay tab still works.</Empty>;
  if (!curves.length) return <Empty title="No curve series in the export">The index has no Treasury or euro curve tenors yet. The rates replay tab still works.</Empty>;
  return (
    <div className="term-scroll">
      {curves.map((c) => <CurveBlock key={c.id} c={c} />)}
    </div>
  );
}

const bp = (v: number | null) => (v == null ? "—" : `${v > 0 ? "+" : v < 0 ? MINUS : ""}${Math.abs(Math.round(v * 100))}`);

function CurveBlock({ c }: { c: Curve }) {
  const pick = usePick();
  const t = useTerm();
  const [ref, w] = useBox<HTMLDivElement>();
  const h = 190;
  const pad = { l: 8, r: 46, t: 12, b: 20 };
  const iw = Math.max(50, w - pad.l - pad.r), ih = h - pad.t - pad.b;
  const vals = c.pts.flatMap((p) => [p.now, p.m1, p.y1]).filter((v): v is number => v != null);
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const span = hi - lo || 1;
  const sx = (y: number) => pad.l + (Math.sqrt(y) - Math.sqrt(c.pts[0].years)) / (Math.sqrt(c.pts[c.pts.length - 1].years) - Math.sqrt(c.pts[0].years) || 1) * iw;
  const sy = (v: number) => pad.t + ih - ((v - (lo - span * 0.08)) / (span * 1.16)) * ih;
  const line = (get: (p: Point) => number | null) => c.pts.filter((p) => get(p) != null).map((p) => `${sx(p.years).toFixed(1)},${sy(get(p)!).toFixed(1)}`).join(" ");
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => lo - span * 0.08 + f * span * 1.16);
  const two = c.pts.find((p) => p.tenor === "2Y"), ten = c.pts.find((p) => p.tenor === "10Y");
  const spread = two && ten ? ten.now - two.now : null;
  return (
    <section className="term-curve" aria-label={`${c.label} yield curve`}>
      <div className="term-curve-head">
        <h3>{c.label}</h3>
        <span className="term-curve-key"><i className="k-now" />now <i className="k-m1" />1M ago <i className="k-y1" />1Y ago</span>
        {spread != null && <span className="term-bar-note">2s10s <b className={tone(spread)}>{bp(spread)} bp</b></span>}
      </div>
      <div ref={ref} className="term-curve-plot">
        {w > 0 && (
          <svg width={w} height={h} role="img" aria-label={`${c.label} curve: ${c.pts.map((p) => `${p.tenor} ${p.now.toFixed(2)}%`).join(", ")}`}>
            {ticks.map((v) => (
              <g key={v}>
                <line className="term-gl" x1={pad.l} x2={pad.l + iw} y1={sy(v)} y2={sy(v)} />
                <text className="term-tick" x={pad.l + iw + 6} y={sy(v)} dy="0.32em">{fmtNum(v, 2)}%</text>
              </g>
            ))}
            {c.pts.map((p) => <text key={p.tenor} className="term-tick" x={sx(p.years)} y={h - 5} textAnchor="middle">{p.tenor}</text>)}
            <polyline className="term-curve-y1" points={line((p) => p.y1)} />
            <polyline className="term-curve-m1" points={line((p) => p.m1)} />
            <polyline className="term-curve-now" points={line((p) => p.now)} />
            {c.pts.map((p) => <circle key={p.tenor} className="term-curve-dot" cx={sx(p.years)} cy={sy(p.now)} r={2.6} />)}
          </svg>
        )}
      </div>
      <table className="term-table">
        <caption className="sr-only">{c.label} by tenor</caption>
        <thead><tr><th className="l">Tenor</th><th>Yield</th><th>1W bp</th><th>1M bp</th><th>1Y bp</th></tr></thead>
        <tbody>
          {c.pts.map((p) => (
            <tr key={p.tenor} className={`pick ${t.link.series === p.s.key ? "picked" : ""}`} tabIndex={0} onClick={() => pick(p.s)} onKeyDown={(e) => { if (e.key === "Enter") pick(p.s); }}>
              <td className="l"><span className="term-sym">{p.tenor}</span> <span className="muted">{p.s.short}</span></td>
              <td>{fmtNum(p.now, 3)}</td>
              <td className={tone(p.w1 == null ? null : p.now - p.w1)}>{bp(p.w1 == null ? null : p.now - p.w1)}</td>
              <td className={tone(p.m1 == null ? null : p.now - p.m1)}>{bp(p.m1 == null ? null : p.now - p.m1)}</td>
              <td className={tone(p.y1 == null ? null : p.now - p.y1)}>{bp(p.y1 == null ? null : p.now - p.y1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
