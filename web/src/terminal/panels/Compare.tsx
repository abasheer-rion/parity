// CMP <a> <b>: two series or strategies side by side. Rebased to 100 (prices) or change
// since the start (levels), the spread and the ratio, rolling 26- and 52-week correlation
// of weekly changes, beta, and drawdowns. The first side follows the linked series.
import { useEffect, useMemo, useRef, useState } from "react";
import { nameOf } from "../../lib/strategyMeta";
import type { Point, StrategyRun } from "../../lib/types";
import { useAsOf, usePanel, usePanelTitle, useTerm } from "../context";
import { loadSeries, type Loadable, type TermIndex, type TermSeries } from "../data";
import { fmtNum, fmtPct, MINUS, tone } from "../fmt";
import { Empty, fmtAxis, Loading, RANGES, Seg, sliceRange, TChart, type Range } from "../tui";
import { WithIndex } from "./common";

type Side = { kind: "series"; s: TermSeries; name: string; level: boolean } | { kind: "strategy"; r: StrategyRun; name: string; level: false };

const WEEK = 7 * 86_400_000;
const MONDAY = Date.UTC(1970, 0, 5);

/** Last point of each week, keyed by week number. */
function weekly(p: Point[]): Map<number, [string, number]> {
  const m = new Map<number, [string, number]>();
  for (const x of p) m.set(Math.floor((Date.parse(x[0]) - MONDAY) / WEEK), x);
  return m;
}

function valueAt(p: Point[], d: string): number | null {
  let a = 0, b = p.length - 1, ans: number | null = null;
  while (a <= b) { const m = (a + b) >> 1; if (p[m][0] <= d) { ans = p[m][1]; a = m + 1; } else b = m - 1; }
  return ans;
}

function corr(x: number[], y: number[]): number | null {
  const n = x.length;
  if (n < 8) return null;
  const mx = x.reduce((s, v) => s + v, 0) / n, my = y.reduce((s, v) => s + v, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { const a = x[i] - mx, b = y[i] - my; sxy += a * b; sxx += a * a; syy += b * b; }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : null;
}

function useSidePoints(side: Side | null): Loadable<Point[]> {
  const [v, setV] = useState<Loadable<Point[]>>({ status: "loading" });
  useEffect(() => {
    if (!side) return;
    if (side.kind === "strategy") { setV({ status: "ok", data: side.r.equity }); return; }
    let live = true;
    setV({ status: "loading" });
    loadSeries(side.s).then((r) => { if (live) setV(r); });
    return () => { live = false; };
  }, [side]);
  return v;
}

export function ComparePanel() {
  return <WithIndex>{(ix) => <Compare ix={ix} />}</WithIndex>;
}

function Compare({ ix }: { ix: TermIndex }) {
  const t = useTerm();
  const p = usePanel();
  const short = (k?: string) => ix.series.find((s) => s.key === k)?.short;
  const aTok = p.leaf.args[0] ?? short(t.link.series) ?? ix.series[0]?.short ?? "";
  const bTok = p.leaf.args[1] ?? ix.series.find((s) => s.short !== aTok && s.class === (t.find(aTok)?.class ?? ""))?.short ?? ix.series.find((s) => s.short !== aTok)?.short ?? "";

  // Follow the linked series on the first side when it changes (not on mount).
  const seen = useRef(t.link.series);
  useEffect(() => {
    if (seen.current === t.link.series) return;
    seen.current = t.link.series;
    const sh = short(t.link.series);
    if (p.leaf.follow !== false && sh && sh !== aTok) p.setArgs([sh, bTok]);
  }, [t.link.series]); // eslint-disable-line react-hooks/exhaustive-deps

  const resolve = (tok: string): Side | null => {
    const s = t.find(tok);
    if (s) return { kind: "series", s, name: s.short, level: s.kind === "level" };
    const r = t.strategy(tok);
    return r ? { kind: "strategy", r, name: nameOf(r), level: false } : null;
  };
  const a = useMemo(() => resolve(aTok), [aTok, t.find, t.strategy]); // eslint-disable-line react-hooks/exhaustive-deps
  const b = useMemo(() => resolve(bTok), [bTok, t.find, t.strategy]); // eslint-disable-line react-hooks/exhaustive-deps
  usePanelTitle(`${a?.name ?? aTok} vs ${b?.name ?? bTok}`);
  useAsOf(a?.kind === "series" ? a.s.asof : ix.data_through);

  return (
    <div className="term-col">
      <div className="term-bar">
        <PickInput label="First" value={aTok} onCommit={(v) => p.setArgs([v, bTok])} ix={ix} />
        <span className="term-bar-note">vs</span>
        <PickInput label="Second" value={bTok} onCommit={(v) => p.setArgs([aTok, v])} ix={ix} />
        <button type="button" className="term-mini" onClick={() => p.setArgs([bTok, aTok])} title="Swap">⇄</button>
      </div>
      {!a || !b ? <Empty title="Pick two series or strategies">Type a series code (EUR, BRENT) or a strategy name in each box.</Empty> : <CompareBody a={a} b={b} />}
    </div>
  );
}

function PickInput({ label, value, onCommit, ix }: { label: string; value: string; onCommit: (v: string) => void; ix: TermIndex }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  const id = "term-cmp-list";
  return (
    <>
      <input className="term-input" aria-label={`${label} series or strategy`} value={v} list={id} spellCheck={false}
        onChange={(e) => setV(e.target.value)} onBlur={() => v.trim() && v !== value && onCommit(v.trim())}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (v.trim()) onCommit(v.trim()); } else if (e.key === "Escape") { setV(value); (e.target as HTMLInputElement).blur(); } }} />
      <datalist id={id}>{ix.series.map((s) => <option key={s.key} value={s.short}>{s.label}</option>)}</datalist>
    </>
  );
}

function CompareBody({ a, b }: { a: Side; b: Side }) {
  const pa = useSidePoints(a), pb = useSidePoints(b);
  const [range, setRange] = useState<Range>("5Y");
  const [view, setView] = useState<"spread" | "ratio">("spread");
  const both = useMemo(() => (pa.status === "ok" && pb.status === "ok" ? [pa.data, pb.data] as const : null), [pa, pb]);

  const calc = useMemo(() => {
    if (!both) return null;
    const [A0, B0] = both;
    if (!A0.length || !B0.length) return null;
    const start = A0[0][0] > B0[0][0] ? A0[0][0] : B0[0][0];
    const end = A0[A0.length - 1][0] < B0[B0.length - 1][0] ? A0[A0.length - 1][0] : B0[B0.length - 1][0];
    const clip = (p: Point[]) => sliceRange(p.filter((x) => x[0] >= start && x[0] <= end), range);
    const A = clip(A0), B = clip(B0);
    if (A.length < 2 || B.length < 2) return null;
    const norm = (p: Point[], level: boolean): Point[] => (level ? p.map(([d, v]) => [d, v - p[0][1]]) : p.map(([d, v]) => [d, (v / p[0][1]) * 100]));
    const nA = norm(A, a.level), nB = norm(B, b.level);
    const anyLevel = a.level || b.level;
    const spread: Point[] = [], ratio: Point[] = [];
    for (const [d, v] of A) {
      const w = valueAt(B, d);
      if (w == null) continue;
      if (anyLevel) spread.push([d, v - w]);
      else {
        const va = (v / A[0][1]) * 100, vb = (w / B[0][1]) * 100;
        spread.push([d, va - vb]);
        ratio.push([d, ((v / w) / (A[0][1] / B[0][1])) * 100]);
      }
    }
    // Weekly changes, aligned by week.
    const wa = weekly(A), wb = weekly(B);
    const weeks = [...wa.keys()].filter((k) => wb.has(k)).sort((x, y) => x - y);
    const ra: number[] = [], rb: number[] = [], rd: string[] = [];
    for (let i = 1; i < weeks.length; i++) {
      const [, a1] = wa.get(weeks[i])!, [, a0] = wa.get(weeks[i - 1])!;
      const [d, b1] = wb.get(weeks[i])!, [, b0] = wb.get(weeks[i - 1])!;
      const x = a.level ? a1 - a0 : a0 > 0 && a1 > 0 ? Math.log(a1 / a0) : NaN;
      const y = b.level ? b1 - b0 : b0 > 0 && b1 > 0 ? Math.log(b1 / b0) : NaN;
      if (Number.isFinite(x) && Number.isFinite(y)) { ra.push(x); rb.push(y); rd.push(d); }
    }
    const rolling = (n: number): Point[] => {
      const out: Point[] = [];
      for (let i = n; i <= ra.length; i++) { const c = corr(ra.slice(i - n, i), rb.slice(i - n, i)); if (c != null) out.push([rd[i - 1], c]); }
      return out;
    };
    const mean = (x: number[]) => x.reduce((s, v) => s + v, 0) / (x.length || 1);
    const mb = mean(rb), ma = mean(ra);
    let cov = 0, vb = 0, va = 0;
    for (let i = 0; i < ra.length; i++) { cov += (ra[i] - ma) * (rb[i] - mb); vb += (rb[i] - mb) ** 2; va += (ra[i] - ma) ** 2; }
    const beta = vb ? cov / vb : null;
    const dd = (p: Point[]): Point[] => { let peak = -Infinity; return p.map(([d, v]) => { peak = Math.max(peak, v); return [d, (v / peak - 1) * 100]; }); };
    const ret = (p: Point[], level: boolean) => (level ? p[p.length - 1][1] - p[0][1] : p[p.length - 1][1] / p[0][1] - 1);
    const ann = (x: number[]) => (x.length > 2 ? Math.sqrt(x.reduce((s, v) => s + (v - mean(x)) ** 2, 0) / (x.length - 1)) * Math.sqrt(52) : null);
    return {
      nA, nB, spread, ratio, anyLevel, r26: rolling(26), r52: rolling(52), corr: corr(ra, rb), beta,
      ddA: a.level ? null : dd(A), ddB: b.level ? null : dd(B),
      retA: ret(A, a.level), retB: ret(B, b.level), volA: a.level ? null : ann(ra), volB: b.level ? null : ann(rb), n: ra.length, start: A[0][0],
    };
  }, [both, range, a, b]);

  if (pa.status === "loading" || pb.status === "loading") return <Loading what="Loading both histories" />;
  if (pa.status !== "ok" || pb.status !== "ok") return <Empty title="Missing history">{pa.status !== "ok" ? pa.message : pb.status !== "ok" ? pb.message : ""}</Empty>;
  if (!calc) return <Empty title="No overlap">These two have no dates in common in this range.</Empty>;

  const ret = (v: number, level: boolean) => (level ? `${v > 0 ? "+" : v < 0 ? MINUS : ""}${Math.abs(v).toFixed(2)}` : fmtPct(v, 1, true));
  const CA = "var(--t-amber)", CB = "var(--t-cyan)";
  return (
    <div className="term-cmp">
      <div className="term-bar">
        <Seg label="Range" value={range} onChange={setRange} options={RANGES.map((r) => [r, r])} />
        <dl className="term-inline-stats">
          <div><dt>Corr</dt><dd className={tone(calc.corr)}>{fmtNum(calc.corr, 2, true)}</dd></div>
          <div><dt>Beta</dt><dd>{fmtNum(calc.beta, 2)}</dd></div>
          <div><dt>{a.name}</dt><dd className={tone(calc.retA)}>{ret(calc.retA, a.level)}</dd></div>
          <div><dt>{b.name}</dt><dd className={tone(calc.retB)}>{ret(calc.retB, b.level)}</dd></div>
          {calc.volA != null && <div className="c-vol"><dt>Vol A</dt><dd>{fmtPct(calc.volA, 1)}</dd></div>}
          {calc.volB != null && <div className="c-vol"><dt>Vol B</dt><dd>{fmtPct(calc.volB, 1)}</dd></div>}
        </dl>
      </div>
      <div className="term-cmp-grid">
        <figure>
          <figcaption>{calc.anyLevel ? "Change since start" : "Rebased to 100"} <span className="muted">from {calc.start}</span></figcaption>
          <TChart series={[{ name: a.name, color: CA, points: calc.nA }, { name: b.name, color: CB, points: calc.nB }]} format={fmtAxis} label="Rebased comparison" />
        </figure>
        <figure>
          <figcaption>
            {calc.anyLevel ? `Spread (${a.name} − ${b.name})` : <Seg label="Spread or ratio" value={view} onChange={setView} options={[["spread", "Spread"], ["ratio", "Ratio"]]} />}
          </figcaption>
          <TChart series={[{ name: view === "ratio" && !calc.anyLevel ? "Ratio" : "Spread", color: "var(--t-violet)", points: view === "ratio" && !calc.anyLevel ? calc.ratio : calc.spread }]} format={fmtAxis} zero={view === "spread" || calc.anyLevel} label="Spread or ratio" area />
        </figure>
        <figure>
          <figcaption>Rolling correlation of weekly changes <span className="muted">{calc.n} weeks</span></figcaption>
          <TChart series={[{ name: "26w", color: CA, points: calc.r26 }, { name: "52w", color: CB, points: calc.r52 }]} format={(v) => fmtNum(v, 2)} zero label="Rolling correlation" />
        </figure>
        <figure>
          <figcaption>Drawdown from peak, %</figcaption>
          {calc.ddA || calc.ddB
            ? <TChart series={[...(calc.ddA ? [{ name: a.name, color: CA, points: calc.ddA }] : []), ...(calc.ddB ? [{ name: b.name, color: CB, points: calc.ddB }] : [])]} format={(v) => `${fmtNum(v, 0)}%`} label="Drawdowns" />
            : <Empty title="Not for levels">Drawdowns only make sense for prices and strategies.</Empty>}
        </figure>
      </div>
    </div>
  );
}
