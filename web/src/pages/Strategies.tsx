// Every strategy in one list, Robinhood watchlist style (name, a small chart, the
// move over the chosen range) in Mercury's table, with filters for the family.
import { useEffect, useMemo } from "react";
import { useHashState } from "../lib/deeplink";
import { Title } from "../components/Shell";
import { colorMap } from "../lib/colors";
import { usePrefs } from "../lib/prefs";
import { nameOf, searchTextOf, taglineOf, verdictOf } from "../lib/strategyMeta";
import type { Report, StrategyRun } from "../lib/types";
import { Badge, DataTable, FilterBar, FilterChip, RANGES, SearchInput, Sparkline, Tabs, fmt, sliceRange, useFilters, type Column, type RangeKey } from "../ui";
import { Term } from "./Learn";

function move(r: StrategyRun, range: RangeKey): number | null {
  const p = sliceRange(r.equity, range);
  return p.length > 1 ? p[p.length - 1][1] / p[0][1] - 1 : null;
}

const FAMILY = (r: StrategyRun) => (r.is_benchmark ? "benchmark" : r.strategy.startsWith("fx_") ? "fx" : r.strategy.startsWith("stocks_") ? "stocks" : "other");

export function Strategies({ report, query }: { report: Report; query?: string }) {
  const prefs = usePrefs();
  const [rangeRaw, setRangeRaw] = useHashState("range", prefs.defaultRange);
  const range: RangeKey = (RANGES as readonly string[]).includes(rangeRaw) ? (rangeRaw as RangeKey) : prefs.defaultRange;
  const setRange = (r: RangeKey) => setRangeRaw(r);
  const colors = colorMap(report.runs);
  const defs = useMemo(() => [
    { id: "fx", label: "Currencies", test: (r: StrategyRun) => r.is_benchmark || FAMILY(r) === "fx" },
    { id: "stocks", label: "Stocks", test: (r: StrategyRun) => r.is_benchmark || FAMILY(r) === "stocks" },
    { id: "positive", label: "Positive Sharpe", test: (r: StrategyRun) => r.is_benchmark || (r.metrics.sharpe ?? 0) > 0 },
  ], []);
  const f = useFilters(report.runs, defs, searchTextOf, true);
  // Home's theme links open this page with a search already typed in (#/strategies?q=...).
  useEffect(() => { if (query && query !== f.query) f.setQuery(query); }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

  const columns: Column<StrategyRun>[] = [
    {
      key: "name", header: "Strategy", align: "left", sort: (r) => nameOf(r),
      render: (r) => (
        <div className="strat-cell">
          <span className="acct-dot" style={{ background: colors[r.strategy] }} />
          <div>
            <a href={`#/strategy/${r.strategy}`} title={taglineOf(r) || undefined}>{nameOf(r)}</a>
            {(taglineOf(r) || r.description || r.summary) && <div className="muted small strat-line">{taglineOf(r) || r.description || r.summary}</div>}
          </div>
        </div>
      ),
    },
    { key: "spark", header: range, align: "left", render: (r) => <Sparkline points={sliceRange(r.equity, range)} /> },
    { key: "move", header: "Move", sort: (r) => move(r, range), tone: (r) => move(r, range), render: (r) => fmt.signedPct(move(r, range)) },
    { key: "cagr", header: <Term id="cagr">CAGR</Term>, sort: (r) => r.metrics.cagr, render: (r) => fmt.pct(r.metrics.cagr) },
    { key: "sharpe", header: <Term id="sharpe-ratio">Sharpe</Term>, sort: (r) => r.metrics.sharpe, render: (r) => fmt.num(r.metrics.sharpe) },
    { key: "dd", header: <Term id="drawdown">Max drawdown</Term>, sort: (r) => r.metrics.max_drawdown, render: (r) => fmt.pct(r.metrics.max_drawdown) },
    { key: "dsr", header: <Term id="deflated-sharpe-ratio">Deflated</Term>, sort: (r) => r.metrics.deflated_sharpe, render: (r) => fmt.num(r.metrics.deflated_sharpe) },
    {
      key: "verdict", header: "Verdict", align: "left", sort: (r) => (r.gauntlet ? r.gauntlet.passed / (r.gauntlet.total || 1) : -1),
      render: (r) => { const v = verdictOf(r); return <span title={v.plain}><Badge tone={v.tone}>{v.label}</Badge>{r.gauntlet && <span className="muted small"> {r.gauntlet.passed}/{r.gauntlet.total}</span>}</span>; },
    },
  ];

  return (
    <>
      <Title label="Discover">Discover strategies</Title>
      <p className="page-purpose">
        Every strategy we have tested, after trading costs, next to holding the US stock market (pinned at the top).
        Click a row for the full report. The verdict sums up the test results. <a href="#/start">Start here</a> explains
        each number.
      </p>
      <FilterBar count={f.count} onReset={f.reset} right={<SearchInput value={f.query} onChange={f.setQuery} placeholder="Search strategies" />}>
        <FilterChip icon="filter" label={`Filters${f.active.length ? ` (${f.active.length})` : ""}`} />
        {defs.map((d) => <FilterChip key={d.id} label={d.label} active={f.active.includes(d.id)} onClick={() => f.toggle(d.id)} onRemove={() => f.toggle(d.id)} />)}
      </FilterBar>
      <div className="toolbar">
        <Tabs label="Time range" value={range} onChange={setRange} tabs={RANGES} />
        <span className="muted small">{f.filtered.filter((r) => !r.is_benchmark).length} of {report.runs.length - 1} strategies, {report.n_trials} trials counted</span>
      </div>
      <DataTable rows={f.filtered} columns={columns} rowKey={(r) => r.strategy} pin={(r) => r.is_benchmark}
        initialSort={{ key: "sharpe", dir: "desc" }} href={(r) => `#/strategy/${r.strategy}`} empty="No strategy matches these filters." caption="Strategies" />
    </>
  );
}
