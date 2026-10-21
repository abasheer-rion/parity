// Sim World, the home page. A playground for the strategies: replay the race from
// the first date to today, step and skip through time, pick the runners, watch market
// panels move with it, then filter, sort and compare the field, and see what has been
// working lately, said plainly and honestly.
import { useMemo, useState, type CSSProperties } from "react";
import {
  Button, Checkbox, Delta, FilterBar, FilterChip, Icon, KeyValues, LineChart, Money, Panel,
  Select, Separator, Sparkline, Tabs, fmt, toast, useFilters, useSort,
  type Column, DataTable, type FilterDef,
} from "../ui";
import { colorMap } from "../lib/colors";
import { usePrefs } from "../lib/prefs";
import { ASSET_LABEL, FAMILY_LABEL, insightsFor, nameOf, tagsOf } from "../lib/strategyMeta";
import type { Point, Report, StrategyRun } from "../lib/types";
import { Race } from "./sim/Race";
import { dollars, windowStats } from "./sim/shared";
import "./SimWorld.css";

// ---------- the page ----------

type SortKey = "sharpe" | "total" | "y1" | "tests" | "name";
type Row = { run: StrategyRun; market: string; family: string; total: number; y1: number | null; y3: number | null; s1: number | null; s3: number | null };

export function SimWorld({ report }: { report: Report }) {
  const prefs = usePrefs();
  const start = prefs.startingAmount || 10_000;
  const colors = useMemo(() => colorMap(report.runs), [report.runs]);
  const bench = report.runs.find((r) => r.is_benchmark);

  const rows: Row[] = useMemo(() => report.runs.map((run) => {
    const a = windowStats(run.equity, 1), b = windowStats(run.equity, 3);
    const eq = run.equity;
    const tg = tagsOf(run);
    return { run, market: tg.asset, family: tg.family, total: eq.length ? eq[eq.length - 1][1] / eq[0][1] - 1 : 0, y1: a.ret, y3: b.ret, s1: a.sharpe, s3: b.sharpe };
  }), [report.runs]);

  // Filters: one market group (pick one or none) and two on/off tests.
  const [market, setMarket] = useState<string | null>(null);
  const [family, setFamily] = useState<string>("all");
  const defs: FilterDef<Row>[] = useMemo(() => [
    { id: "sharpe", label: "Positive Sharpe", test: (r) => (r.run.metrics.sharpe ?? 0) > 0 },
    { id: "tests", label: "Passed 6+ tests", test: (r) => (r.run.gauntlet?.passed ?? 0) >= 6 },
  ], []);
  const f = useFilters(rows.filter((r) => !r.run.is_benchmark), defs, (r) => `${r.run.strategy} ${nameOf(r.run)} ${r.run.summary}`);
  const field = f.filtered.filter((r) => (!market || r.market === market) && (family === "all" || r.family === family));
  const assets = [...new Set(rows.filter((r) => !r.run.is_benchmark).map((r) => r.market))];
  const families = [...new Set(rows.filter((r) => !r.run.is_benchmark).map((r) => r.family))];
  const getter = useMemo(() => (r: Row, k: SortKey) =>
    k === "sharpe" ? r.run.metrics.sharpe : k === "total" ? r.total : k === "y1" ? r.y1 : k === "tests" ? r.run.gauntlet?.passed ?? 0 : nameOf(r.run), []);
  const { sorted, sort, setSort } = useSort<Row, SortKey>(field, getter, { key: "sharpe", dir: "desc" });


  const [picked, setPicked] = useState<string[]>([]);
  const togglePick = (name: string) => setPicked((p) => {
    if (p.includes(name)) return p.filter((x) => x !== name);
    if (p.length >= 4) { toast("You can compare up to 4 at a time."); return p; }
    return [...p, name];
  });
  const pickedRows = picked.map((n) => rows.find((r) => r.run.strategy === n)!).filter(Boolean);
  const filtersOn = f.count + (market ? 1 : 0) + (family !== "all" ? 1 : 0);

  return (
    <div className="sw">
      <header className="sw-hero-head">
        <h1>Sim World</h1>
        <p>Every strategy we test, replayed with play money from the first day of data to today. Press play and watch who pulls ahead.</p>
      </header>

      <Race runs={report.runs} colors={colors} start={start} comparison={report.comparison} series={report.series} />

      <WorkingNow rows={rows} colors={colors} />

      <section className="sw-field" aria-label="The field">
        <div className="sw-sec-head">
          <h2>The field <span className="sw-count">{sorted.length}</span></h2>
          <Select<SortKey> label="Sort by" value={sort.key} onChange={(k) => setSort({ key: k, dir: k === "name" ? "asc" : "desc" })}
            options={[["sharpe", "Sharpe"], ["total", "Total return"], ["y1", "Last year"], ["tests", "Tests passed"], ["name", "Name"]]} />
        </div>
        <FilterBar count={filtersOn} onReset={() => { f.reset(); setMarket(null); setFamily("all"); }}>
          {assets.map((m) => (
            <FilterChip key={m} label={ASSET_LABEL[m] ?? m} active={market === m} onClick={() => setMarket(market === m ? null : m)} onRemove={() => setMarket(null)} />
          ))}
          <Separator />
          {defs.map((d) => <FilterChip key={d.id} label={d.label} active={f.active.includes(d.id)} onClick={() => f.toggle(d.id)} onRemove={() => f.toggle(d.id)} />)}
          <Separator />
          <Select<string> label="Family" value={family} onChange={setFamily}
            options={[["all", "Every family"], ...families.map((x) => [x, FAMILY_LABEL[x] ?? x] as [string, string])]} />
        </FilterBar>
        <p className="sw-hint">Tick up to 4 to compare. Choose who runs in the race with the Runners button above.</p>

        {sorted.length === 0 ? <p className="muted">Nothing matches these filters.</p> : (
          <div className="sw-cards">
            {sorted.map((r) => {
              const on = picked.includes(r.run.strategy);
              const g = r.run.gauntlet;
              return (
                <article key={r.run.strategy} className={`sw-card ${on ? "on" : ""}`} style={{ "--c": colors[r.run.strategy] } as CSSProperties}>
                  <div className="sw-card-top">
                    <span className="sw-dot" style={{ background: colors[r.run.strategy] }} />
                    <a className="sw-card-name" href={`#/strategy/${encodeURIComponent(r.run.strategy)}`}>{nameOf(r.run)}</a>
                  </div>
                  <div className="sw-tags">
                    <span className="sw-tag">{FAMILY_LABEL[r.family] ?? r.family}</span>
                    <span className="sw-tag">{ASSET_LABEL[r.market] ?? r.market}</span>
                    {tagsOf(r.run).style && <span className="sw-tag">{tagsOf(r.run).style}</span>}
                  </div>
                  <p className="sw-card-sum" title={r.run.summary}>{r.run.description || r.run.summary}</p>
                  <div className="sw-card-spark"><Sparkline points={r.run.equity} width={240} height={36} /></div>
                  <dl className="sw-card-stats">
                    <div><dt>Ends at</dt><dd><Money value={start * (1 + r.total)} cents={false} /></dd></div>
                    <div><dt>Sharpe</dt><dd>{fmt.num(r.run.metrics.sharpe)}</dd></div>
                    <div><dt>Last year</dt><dd><Delta value={r.y1} /></dd></div>
                    <div><dt>Tests</dt><dd>{g ? `${g.passed} of ${g.total}` : "n/a"}</dd></div>
                  </dl>
                  <Insights run={r.run} report={report} bench={bench} max={2} />
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
                ...pickedRows.map((r) => ({ name: nameOf(r.run), color: colors[r.run.strategy], points: r.run.equity.map(([d, v]) => [d, v * start] as Point), emphasis: true })),
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
                    <span className="sw-card-name">{nameOf(r.run)}</span>
                    <button className="sw-x" aria-label={`Remove ${nameOf(r.run)}`} onClick={() => togglePick(r.run.strategy)}><Icon name="close" size={12} /></button>
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
                  <Insights run={r.run} report={report} bench={bench} max={4} />
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
              {nameOf(r.run)}
              <button aria-label={`Remove ${nameOf(r.run)}`} onClick={() => togglePick(r.run.strategy)}><Icon name="close" size={11} /></button>
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
  const byMarket = (m: string) => {
    const g = field.filter((r) => r.market === m);
    return g.length ? g.reduce((a, r) => a + (ret(r) ?? 0), 0) / g.length : null;
  };
  const fxAvg = byMarket("fx"), stAvg = byMarket("stocks");
  const passAll = rows.filter((r) => r.run.gauntlet?.beats_sp500).length;
  const tested = rows.filter((r) => r.run.gauntlet).length;

  const cols: Column<Row>[] = [
    { key: "name", header: "Strategy", align: "left", render: (r) => (
      <span className="sw-cell-name"><span className="sw-dot" style={{ background: colors[r.run.strategy] }} />{nameOf(r.run)}</span>
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
          {top && <li><strong>{nameOf(top.run)}</strong> did best over {span}, with <Delta value={ret(top)} /></li>}
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

// ---------- strengths and weaknesses ----------

function Insights({ run, report, bench, max }: { run: StrategyRun; report: Report; bench?: StrategyRun; max: number }) {
  const all = useMemo(() => insightsFor(run, report.comparison, bench), [run, report.comparison, bench]);
  const good = all.filter((x) => x.kind === "strength").slice(0, max);
  const bad = all.filter((x) => x.kind === "weakness").slice(0, max);
  return (
    <div className="sw-ins">
      {good.map((x) => <div key={x.text} className="sw-ins-row good" title={x.detail}><span aria-hidden>+</span>{x.text}</div>)}
      {bad.map((x) => <div key={x.text} className="sw-ins-row bad" title={x.detail}><span aria-hidden>{"\u2212"}</span>{x.text}</div>)}
    </div>
  );
}
