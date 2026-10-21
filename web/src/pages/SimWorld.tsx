// Sim World, the home page. A playground for the strategies: replay the race from
// the first date to today, filter and sort the field, tick a few to compare, and
// see what has been working lately, said plainly and honestly.
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  Badge, Button, Checkbox, Delta, FilterBar, FilterChip, Icon, KeyValues, LineChart, Money, Panel,
  Segmented, Select, Separator, Sparkline, Tabs, fmt, toast, useFilters, useSort,
  type Column, DataTable, type FilterDef,
} from "../ui";
import { colorMap } from "../lib/colors";
import { usePrefs } from "../lib/prefs";
import type { Point, Report, StrategyRun } from "../lib/types";
import "./SimWorld.css";

// ---------- small helpers ----------

const WORDS: Record<string, string> = { fx: "FX", us: "US", tsmom: "trend", xs: "cross-section", reer: "real rate", ma: "moving average", rsi: "RSI", "10m": "10-month" };
const label = (r: StrategyRun) => (r.is_benchmark ? "US stock market" : pretty(r.strategy));
export function pretty(name: string): string {
  const s = name.split("_").map((w) => WORDS[w] ?? w).join(" ");
  return s[0].toUpperCase() + s.slice(1);
}

type Market = "currencies" | "stocks" | "mixed";
function marketOf(r: StrategyRun): Market {
  const keys = Object.keys(r.exposure);
  if (keys.length && keys.every((k) => k.startsWith("fx."))) return "currencies";
  if (keys.length && keys.every((k) => k.startsWith("eq.") || k.startsWith("cash."))) return "stocks";
  return "mixed";
}
const MARKET_LABEL: Record<Market, string> = { currencies: "Currencies", stocks: "Stocks", mixed: "Mixed" };

const DAY = 86_400_000;
const t = (iso: string) => Date.parse(iso + "T00:00:00Z");

/** Keep about one point a week, so the replay stays light. */
function weekly(points: Point[]): Point[] {
  const out: Point[] = [];
  let last = -Infinity;
  for (const p of points) {
    const ms = t(p[0]);
    if (ms - last >= 6.5 * DAY) { out.push(p); last = ms; }
  }
  if (points.length && out[out.length - 1] !== points[points.length - 1]) out.push(points[points.length - 1]);
  return out;
}

/** Return and Sharpe over the last `years` of an equity curve. */
function windowStats(eq: Point[], years: number): { ret: number | null; sharpe: number | null } {
  if (eq.length < 3) return { ret: null, sharpe: null };
  const end = t(eq[eq.length - 1][0]);
  const from = end - years * 365.25 * DAY;
  const pts = eq.filter((p) => t(p[0]) >= from);
  if (pts.length < 10 || t(eq[0][0]) > from + 30 * DAY) return { ret: null, sharpe: null };
  const rets: number[] = [];
  for (let i = 1; i < pts.length; i++) rets.push(pts[i][1] / pts[i - 1][1] - 1);
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const sd = Math.sqrt(rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length - 1));
  const perYear = rets.length / years;
  return { ret: pts[pts.length - 1][1] / pts[0][1] - 1, sharpe: sd > 0 ? (mean / sd) * Math.sqrt(perYear) : null };
}

function usePrefersReducedMotion(): boolean {
  const [reduce, setReduce] = useState(() => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;
    const on = () => setReduce(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduce;
}

function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(640);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, e.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

const monthYear = (iso: string) => new Date(t(iso)).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
const dollars = (v: number) => `$${Math.round(v).toLocaleString("en-US")}`;

// ---------- the race ----------

interface Lane { run: StrategyRun; color: string; values: number[] }

const SPEEDS = ["1x", "4x", "16x"] as const;
type Speed = (typeof SPEEDS)[number];
const WEEKS_PER_SEC: Record<Speed, number> = { "1x": 13, "4x": 52, "16x": 208 };
const ROW = 34;

function Race({ runs, colors, start }: { runs: StrategyRun[]; colors: Record<string, string>; start: number }) {
  const reduce = usePrefersReducedMotion();

  // One shared weekly timeline; every lane is forward-filled onto it.
  const { dates, lanes } = useMemo(() => {
    const master = runs.find((r) => r.is_benchmark) ?? runs[0];
    const dates = weekly(master?.equity ?? []).map((p) => p[0]);
    const lanes: Lane[] = runs.map((run) => {
      const eq = run.equity;
      const values: number[] = [];
      let j = 0, last = eq[0]?.[1] ?? 1;
      for (const d of dates) {
        while (j < eq.length && eq[j][0] <= d) { last = eq[j][1]; j++; }
        values.push(last);
      }
      // Rebase so everyone starts at the same amount on the first date.
      const base = values[0] || 1;
      return { run, color: colors[run.strategy], values: values.map((v) => (v / base) * start) };
    });
    return { dates, lanes };
  }, [runs, colors, start]);

  const end = Math.max(0, dates.length - 1);
  const [pos, setPos] = useState(end);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<Speed>("4x");
  const posRef = useRef(pos);
  posRef.current = pos;

  useEffect(() => { setPos(end); setPlaying(false); }, [end]);

  useEffect(() => {
    if (!playing) return;
    let raf = 0, prev = performance.now();
    const step = (now: number) => {
      const dt = Math.min(0.1, (now - prev) / 1000);
      prev = now;
      const next = Math.min(end, posRef.current + dt * WEEKS_PER_SEC[speed]);
      setPos(next);
      if (next >= end) { setPlaying(false); return; }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, end]);

  const play = () => {
    if (playing) { setPlaying(false); return; }
    if (reduce) { setPos(end); return; }
    if (posRef.current >= end) setPos(0);
    setPlaying(true);
  };

  const i = Math.floor(pos);
  const frac = pos - i;
  const valueAt = (l: Lane) => (i >= end ? l.values[end] : l.values[i] + (l.values[i + 1] - l.values[i]) * frac);
  const standings = lanes.map((l) => ({ l, v: valueAt(l) })).sort((a, b) => b.v - a.v);
  // Reorder the board at most every 180ms while playing, so close neighbours
  // swap places cleanly instead of flickering back and forth every frame.
  const order = useRef<{ at: number; rank: Map<string, number> } | null>(null);
  const now = performance.now();
  if (!order.current || !playing || now - order.current.at > 180) {
    order.current = { at: now, rank: new Map(standings.map((s, k) => [s.l.run.strategy, k])) };
  }
  const rank = order.current.rank;
  const leader = standings[0];

  // Chart geometry: time on x, money on a log y axis fixed for the whole race,
  // so lines never rescale while they grow.
  const [ref, width] = useWidth<HTMLDivElement>();
  const height = Math.min(450, Math.max(240, width * 0.62));
  const pad = { top: 14, right: 14, bottom: 24, left: 52 };
  const w = width - pad.left - pad.right, h = height - pad.top - pad.bottom;
  const [lo, hi] = useMemo(() => {
    let mn = start, mx = start;
    for (const l of lanes) for (const v of l.values) { if (v < mn) mn = v; if (v > mx) mx = v; }
    return [Math.log(mn), Math.log(mx)];
  }, [lanes, start]);
  const x = (k: number) => pad.left + (end ? (k / end) * w : 0);
  const y = (v: number) => pad.top + h - ((Math.log(v) - lo) / (hi - lo || 1)) * h;
  const paths = useMemo(
    () => lanes.map((l) => l.values.map((v, k) => `${k ? "L" : "M"}${x(k).toFixed(1)},${y(v).toFixed(1)}`).join("")),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lanes, width, height],
  );
  const ticks = useMemo(() => {
    const out: number[] = [];
    for (let m = 1e2; m < 1e8; m *= 10) for (const k of [1, 2, 5]) { const v = m * k; if (Math.log(v) >= lo && Math.log(v) <= hi) out.push(v); }
    return out.length > 5 ? out.filter((_, k) => k % 2 === 0) : out;
  }, [lo, hi]);
  const years = useMemo(() => {
    const out: { k: number; label: string }[] = [];
    let lastYear = "";
    dates.forEach((d, k) => { const yr = d.slice(0, 4); if (yr !== lastYear && Number(yr) % 5 === 0) out.push({ k, label: yr }); lastYear = yr; });
    return out;
  }, [dates]);
  const clipW = Math.max(0, x(pos) - pad.left + 1);

  if (!dates.length) return <p className="muted">No data to replay.</p>;
  const date = dates[i] ?? dates[end];
  const elapsed = (t(date) - t(dates[0])) / (365.25 * DAY);

  return (
    <section className="sw-race" aria-label="Race replay">
      <div className="sw-race-top">
        <div>
          <div className="sw-eyebrow">Race replay · every strategy starts with <Money value={start} cents={false} /></div>
          <div className="sw-date" aria-live="off">{monthYear(date)}</div>
          <div className="sw-date-sub">
            {elapsed < 0.05 ? "The starting line" : `${elapsed.toFixed(1)} years in`}
            {leader && <> · leading: <span className="sw-dot" style={{ background: leader.l.color }} /> {label(leader.l.run)}</>}
          </div>
        </div>
        <div className="sw-controls">
          <Button variant="primary" icon={playing ? "pause" : pos >= end ? "restart" : "play"} onClick={play} aria-label={playing ? "Pause" : "Play"}>
            {playing ? "Pause" : pos >= end ? "Replay" : "Play"}
          </Button>
          <Segmented label="Speed" size="sm" value={speed} onChange={setSpeed} options={SPEEDS.map((s) => [s, s] as [Speed, string])} />
        </div>
      </div>

      <div className="sw-race-body">
        <div className="sw-track" ref={ref}>
          <svg width={width} height={height} role="img" aria-label={`Growth of ${dollars(start)} for each strategy up to ${monthYear(date)}, log scale`}>
            <defs>
              <clipPath id="sw-clip"><rect x={pad.left} y={0} width={clipW} height={height} /></clipPath>
            </defs>
            {ticks.map((v) => (
              <g key={v}>
                <line x1={pad.left} x2={pad.left + w} y1={y(v)} y2={y(v)} className="sw-grid" />
                <text x={pad.left - 8} y={y(v) + 4} textAnchor="end" className="sw-axis">{fmt.compact(v)}</text>
              </g>
            ))}
            {years.map((yr) => <text key={yr.k} x={x(yr.k)} y={height - 6} textAnchor="middle" className="sw-axis">{yr.label}</text>)}
            <line x1={pad.left} x2={pad.left + w} y1={y(start)} y2={y(start)} className="sw-start" />
            <g clipPath="url(#sw-clip)">
              {lanes.map((l, k) => (
                <path key={l.run.strategy} d={paths[k]} fill="none" stroke={l.color}
                  strokeWidth={l.run.is_benchmark ? 1.6 : 1.4} strokeDasharray={l.run.is_benchmark ? "4 3" : undefined}
                  opacity={rank.get(l.run.strategy)! < 3 || l.run.is_benchmark ? 1 : 0.5} />
              ))}
            </g>
            <line x1={x(pos)} x2={x(pos)} y1={pad.top} y2={pad.top + h} className="sw-now" />
            {lanes.map((l) => <circle key={l.run.strategy} cx={x(pos)} cy={y(valueAt(l))} r={rank.get(l.run.strategy)! < 3 ? 3.5 : 2.5} fill={l.color} />)}
          </svg>
          <input className="sw-scrub" type="range" min={0} max={end} step={1} value={i} aria-label="Move through time"
            aria-valuetext={monthYear(date)}
            onChange={(e) => { setPlaying(false); setPos(Number(e.target.value)); }}
            style={{ "--p": `${end ? (pos / end) * 100 : 0}%` } as CSSProperties} />
          <div className="sw-scrub-ends"><span>{monthYear(dates[0])}</span><span>Today</span></div>
        </div>

        <ol className="sw-board" style={{ height: lanes.length * ROW }} aria-label="Leaderboard">
          {lanes.map((l) => {
            const r = rank.get(l.run.strategy)!;
            const v = valueAt(l);
            return (
              <li key={l.run.strategy} className={`sw-row ${l.run.is_benchmark ? "bench" : ""} ${r === 0 ? "first" : ""}`}
                style={{ transform: `translateY(${r * ROW}px)` }}>
                <span className="sw-rank">{r + 1}</span>
                <span className="sw-dot" style={{ background: l.color }} />
                <a className="sw-name" href={`#/strategy/${encodeURIComponent(l.run.strategy)}`} title={l.run.summary}>
                  {label(l.run)}
                </a>
                <span className="sw-val"><Money value={v} cents={false} /></span>
                <span className="sw-chg"><Delta value={v / start - 1} digits={0} /></span>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

// ---------- the page ----------

type SortKey = "sharpe" | "total" | "y1" | "tests" | "name";
type Row = { run: StrategyRun; market: Market; total: number; y1: number | null; y3: number | null; s1: number | null; s3: number | null };

export function SimWorld({ report }: { report: Report }) {
  const prefs = usePrefs();
  const start = prefs.startingAmount || 10_000;
  const colors = useMemo(() => colorMap(report.runs), [report.runs]);
  const bench = report.runs.find((r) => r.is_benchmark);

  const rows: Row[] = useMemo(() => report.runs.map((run) => {
    const a = windowStats(run.equity, 1), b = windowStats(run.equity, 3);
    const eq = run.equity;
    return { run, market: marketOf(run), total: eq.length ? eq[eq.length - 1][1] / eq[0][1] - 1 : 0, y1: a.ret, y3: b.ret, s1: a.sharpe, s3: b.sharpe };
  }), [report.runs]);

  // Filters: one market group (pick one or none) and two on/off tests.
  const [market, setMarket] = useState<Market | null>(null);
  const defs: FilterDef<Row>[] = useMemo(() => [
    { id: "sharpe", label: "Positive Sharpe", test: (r) => (r.run.metrics.sharpe ?? 0) > 0 },
    { id: "tests", label: "Passed 6+ tests", test: (r) => (r.run.gauntlet?.passed ?? 0) >= 6 },
  ], []);
  const f = useFilters(rows.filter((r) => !r.run.is_benchmark), defs, (r) => `${r.run.strategy} ${pretty(r.run.strategy)} ${r.run.summary}`);
  const field = f.filtered.filter((r) => !market || r.market === market);
  const getter = useMemo(() => (r: Row, k: SortKey) =>
    k === "sharpe" ? r.run.metrics.sharpe : k === "total" ? r.total : k === "y1" ? r.y1 : k === "tests" ? r.run.gauntlet?.passed ?? 0 : pretty(r.run.strategy), []);
  const { sorted, sort, setSort } = useSort<Row, SortKey>(field, getter, { key: "sharpe", dir: "desc" });

  const raceRuns = useMemo(() => [...field.map((r) => r.run), ...(bench ? [bench] : [])], [field, bench]);
  const raceKey = raceRuns.map((r) => r.strategy).join(",");

  const [picked, setPicked] = useState<string[]>([]);
  const togglePick = (name: string) => setPicked((p) => {
    if (p.includes(name)) return p.filter((x) => x !== name);
    if (p.length >= 4) { toast("You can compare up to 4 at a time."); return p; }
    return [...p, name];
  });
  const pickedRows = picked.map((n) => rows.find((r) => r.run.strategy === n)!).filter(Boolean);
  const filtersOn = f.count + (market ? 1 : 0);

  return (
    <div className="sw">
      <header className="sw-hero-head">
        <h1>Sim World</h1>
        <p>Every strategy we test, replayed with play money from the first day of data to today. Press play and watch who pulls ahead.</p>
      </header>

      <Race key={raceKey} runs={raceRuns} colors={colors} start={start} />

      <WorkingNow rows={rows} colors={colors} />

      <section className="sw-field" aria-label="The field">
        <div className="sw-sec-head">
          <h2>The field <span className="sw-count">{sorted.length}</span></h2>
          <Select<SortKey> label="Sort by" value={sort.key} onChange={(k) => setSort({ key: k, dir: k === "name" ? "asc" : "desc" })}
            options={[["sharpe", "Sharpe"], ["total", "Total return"], ["y1", "Last year"], ["tests", "Tests passed"], ["name", "Name"]]} />
        </div>
        <FilterBar count={filtersOn} onReset={() => { f.reset(); setMarket(null); }}>
          {(Object.keys(MARKET_LABEL) as Market[]).map((m) => (
            <FilterChip key={m} label={MARKET_LABEL[m]} active={market === m} onClick={() => setMarket(market === m ? null : m)} onRemove={() => setMarket(null)} />
          ))}
          <Separator />
          {defs.map((d) => <FilterChip key={d.id} label={d.label} active={f.active.includes(d.id)} onClick={() => f.toggle(d.id)} onRemove={() => f.toggle(d.id)} />)}
        </FilterBar>
        <p className="sw-hint">Filters also change who runs in the race above. Tick up to 4 to compare.</p>

        {sorted.length === 0 ? <p className="muted">Nothing matches these filters.</p> : (
          <div className="sw-cards">
            {sorted.map((r) => {
              const on = picked.includes(r.run.strategy);
              const g = r.run.gauntlet;
              return (
                <article key={r.run.strategy} className={`sw-card ${on ? "on" : ""}`} style={{ "--c": colors[r.run.strategy] } as CSSProperties}>
                  <div className="sw-card-top">
                    <span className="sw-dot" style={{ background: colors[r.run.strategy] }} />
                    <a className="sw-card-name" href={`#/strategy/${encodeURIComponent(r.run.strategy)}`}>{pretty(r.run.strategy)}</a>
                    <Badge>{MARKET_LABEL[r.market]}</Badge>
                  </div>
                  <p className="sw-card-sum">{r.run.summary}</p>
                  <div className="sw-card-spark"><Sparkline points={r.run.equity} width={240} height={36} /></div>
                  <dl className="sw-card-stats">
                    <div><dt>Ends at</dt><dd><Money value={start * (1 + r.total)} cents={false} /></dd></div>
                    <div><dt>Sharpe</dt><dd>{fmt.num(r.run.metrics.sharpe)}</dd></div>
                    <div><dt>Last year</dt><dd><Delta value={r.y1} /></dd></div>
                    <div><dt>Tests</dt><dd>{g ? `${g.passed} of ${g.total}` : "n/a"}</dd></div>
                  </dl>
                  <div className="sw-card-foot">
                    <Checkbox checked={on} onChange={() => togglePick(r.run.strategy)} label="Compare" />
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {pickedRows.length > 0 && (
        <section className="sw-compare" aria-label="Compare">
          <div className="sw-sec-head">
            <h2>Side by side</h2>
            <Button variant="tertiary" size="sm" onClick={() => setPicked([])}>Clear</Button>
          </div>
          <Panel>
            <LineChart label="Growth of the starting amount" format={dollars} log height={280}
              series={[
                ...pickedRows.map((r) => ({ name: pretty(r.run.strategy), color: colors[r.run.strategy], points: r.run.equity.map(([d, v]) => [d, v * start] as Point), emphasis: true })),
                ...(bench ? [{ name: "US stock market", color: colors[bench.strategy], points: bench.equity.map(([d, v]) => [d, v * start] as Point) }] : []),
              ]} />
          </Panel>
          <div className={`sw-compare-cols n${pickedRows.length}`}>
            {pickedRows.map((r) => {
              const m = r.run.metrics;
              return (
                <div key={r.run.strategy} className="sw-compare-col">
                  <div className="sw-card-top">
                    <span className="sw-dot" style={{ background: colors[r.run.strategy] }} />
                    <span className="sw-card-name">{pretty(r.run.strategy)}</span>
                    <button className="sw-x" aria-label={`Remove ${pretty(r.run.strategy)}`} onClick={() => togglePick(r.run.strategy)}><Icon name="close" size={12} /></button>
                  </div>
                  <KeyValues cols={2} items={[
                    ["Ends at", <Money value={start * (1 + r.total)} cents={false} />],
                    ["Yearly return", <Delta value={m.cagr} />],
                    ["Sharpe", fmt.num(m.sharpe)],
                    ["Worst drop", fmt.pct(m.max_drawdown)],
                    ["Last year", <Delta value={r.y1} />],
                    ["Last 3 years", <Delta value={r.y3} />],
                    ["Tests passed", r.run.gauntlet ? `${r.run.gauntlet.passed} of ${r.run.gauntlet.total}` : "n/a"],
                    ["Beats market", r.run.gauntlet?.beats_sp500 ? "Yes" : "No"],
                  ]} />
                  {r.run.gauntlet && <p className="sw-verdict">{r.run.gauntlet.verdict}</p>}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {pickedRows.length > 0 && (
        <div className="sw-tray" role="region" aria-label="Compare tray">
          {pickedRows.map((r) => (
            <span key={r.run.strategy} className="sw-tray-chip">
              <span className="sw-dot" style={{ background: colors[r.run.strategy] }} />
              {pretty(r.run.strategy)}
              <button aria-label={`Remove ${pretty(r.run.strategy)}`} onClick={() => togglePick(r.run.strategy)}><Icon name="close" size={11} /></button>
            </span>
          ))}
          <span className="sw-tray-n">{pickedRows.length} of 4</span>
          <a className="sw-tray-go" href="#" onClick={(e) => { e.preventDefault(); document.querySelector(".sw-compare")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>See comparison</a>
        </div>
      )}
    </div>
  );
}

// ---------- what is working now ----------

function WorkingNow({ rows, colors }: { rows: Row[]; colors: Record<string, string> }) {
  const [win, setWin] = useState<"1y" | "3y">("1y");
  const ret = (r: Row) => (win === "1y" ? r.y1 : r.y3);
  const shp = (r: Row) => (win === "1y" ? r.s1 : r.s3);
  const bench = rows.find((r) => r.run.is_benchmark);
  const field = rows.filter((r) => !r.run.is_benchmark && ret(r) != null);
  const ranked = [...field].sort((a, b) => (ret(b) ?? -9) - (ret(a) ?? -9));
  const top = ranked[0];
  const bRet = bench ? ret(bench) : null;
  const ahead = bRet == null ? 0 : field.filter((r) => (ret(r) ?? -9) > bRet).length;
  const span = win === "1y" ? "the last year" : "the last 3 years";
  const byMarket = (m: Market) => {
    const g = field.filter((r) => r.market === m);
    return g.length ? g.reduce((a, r) => a + (ret(r) ?? 0), 0) / g.length : null;
  };
  const fxAvg = byMarket("currencies"), stAvg = byMarket("stocks");
  const passAll = rows.filter((r) => r.run.gauntlet?.beats_sp500).length;
  const tested = rows.filter((r) => r.run.gauntlet).length;

  const cols: Column<Row>[] = [
    { key: "name", header: "Strategy", align: "left", render: (r) => (
      <span className="sw-cell-name"><span className="sw-dot" style={{ background: colors[r.run.strategy] }} />{label(r.run)}</span>
    ) },
    { key: "ret", header: win === "1y" ? "Last year" : "Last 3 years", align: "right", sort: ret, render: (r) => <Delta value={ret(r)} /> },
    { key: "sharpe", header: "Sharpe", align: "right", sort: shp, render: (r) => fmt.num(shp(r)) },
    { key: "vs", header: "Against market", align: "right", sort: (r) => (bRet == null || ret(r) == null ? null : ret(r)! - bRet),
      render: (r) => (r.run.is_benchmark ? <span className="muted">reference</span> : <Delta value={bRet == null || ret(r) == null ? null : ret(r)! - bRet} />) },
  ];

  return (
    <section className="sw-now-panel" aria-label="What is working now">
      <div className="sw-sec-head">
        <h2>What is working now</h2>
        <Tabs label="Time window" value={win} onChange={setWin} tabs={[["1y", "Last year"], ["3y", "Last 3 years"]]} />
      </div>
      <div className="sw-now-grid">
        <ul className="sw-notes">
          {top && <li><strong>{pretty(top.run.strategy)}</strong> did best over {span}, with <Delta value={ret(top)} /></li>}
          {bRet != null && <li>Simply holding the US stock market made <Delta value={bRet} />. {ahead === 0 ? "Nothing here did better." : `${ahead} of ${field.length} did better.`}</li>}
          {fxAvg != null && stAvg != null && (
            <li>On average, currency strategies made <Delta value={fxAvg} /> and stock strategies <Delta value={stAvg} />. Stock rules mostly ride the market, so they rise and fall with it.</li>
          )}
          <li>
            A good stretch is not proof. {passAll === 0
              ? `None of the ${tested} strategies passes the full gauntlet: after trading costs and counting every idea we tried, none reliably beats holding the market.`
              : `${passAll} of ${tested} strategies pass the full gauntlet. Treat that with care until it holds up on new data.`}
            {" "}<a href="#/doc/REF-0006">How the gauntlet works</a>
          </li>
        </ul>
        <div className="sw-now-table">
          <DataTable key={win} dense rows={[...ranked.slice(0, 6), ...(bench ? [bench] : [])]} columns={cols} rowKey={(r) => r.run.strategy}
            initialSort={{ key: "ret", dir: "desc" }} pin={(r) => r.run.is_benchmark} href={(r) => `#/strategy/${encodeURIComponent(r.run.strategy)}`}
            caption={`Best strategies over ${span}`} />
        </div>
      </div>
    </section>
  );
}
