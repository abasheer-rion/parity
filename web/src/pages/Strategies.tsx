// Every strategy in one list, Robinhood watchlist style (name, a small chart, the
// move over the chosen range) in Mercury's table, with filters for the family.
import { useMemo, useState } from "react";
import { Title } from "../components/Shell";
import { colorMap } from "../lib/colors";
import { usePrefs } from "../lib/prefs";
import type { Report, StrategyRun } from "../lib/types";
import { Badge, DataTable, FilterBar, FilterChip, RANGES, SearchInput, Sparkline, Tabs, fmt, sliceRange, useFilters, type Column, type RangeKey } from "../ui";
import { Term } from "./Learn";

function move(r: StrategyRun, range: RangeKey): number | null {
  const p = sliceRange(r.equity, range);
  return p.length > 1 ? p[p.length - 1][1] / p[0][1] - 1 : null;
}

const FAMILY = (r: StrategyRun) => (r.is_benchmark ? "benchmark" : r.strategy.startsWith("fx_") ? "fx" : r.strategy.startsWith("stocks_") ? "stocks" : "other");

export function Strategies({ report }: { report: Report }) {
  const prefs = usePrefs();
  const [range, setRange] = useState<RangeKey>(prefs.defaultRange);
  const colors = colorMap(report.runs);
  const defs = useMemo(() => [
    { id: "fx", label: "Currencies", test: (r: StrategyRun) => r.is_benchmark || FAMILY(r) === "fx" },
    { id: "stocks", label: "Stocks", test: (r: StrategyRun) => r.is_benchmark || FAMILY(r) === "stocks" },
    { id: "positive", label: "Positive Sharpe", test: (r: StrategyRun) => r.is_benchmark || (r.metrics.sharpe ?? 0) > 0 },
  ], []);
  const f = useFilters(report.runs, defs, (r) => r.strategy);

  const columns: Column<StrategyRun>[] = [
    {
      key: "name", header: "Strategy", align: "left", sort: (r) => r.strategy,
      render: (r) => <><span className="acct-dot" style={{ background: colors[r.strategy] }} /><a href={`#/strategy/${r.strategy}`}>{r.strategy}</a>{r.is_benchmark && <> <Badge>benchmark</Badge></>}</>,
    },
    { key: "spark", header: range, align: "left", render: (r) => <Sparkline points={sliceRange(r.equity, range)} /> },
    { key: "move", header: "Move", sort: (r) => move(r, range), tone: (r) => move(r, range), render: (r) => fmt.signedPct(move(r, range)) },
    { key: "cagr", header: <Term id="cagr">CAGR</Term>, sort: (r) => r.metrics.cagr, render: (r) => fmt.pct(r.metrics.cagr) },
    { key: "sharpe", header: <Term id="sharpe-ratio">Sharpe</Term>, sort: (r) => r.metrics.sharpe, render: (r) => fmt.num(r.metrics.sharpe) },
    { key: "dd", header: <Term id="drawdown">Max drawdown</Term>, sort: (r) => r.metrics.max_drawdown, render: (r) => fmt.pct(r.metrics.max_drawdown) },
    { key: "dsr", header: <Term id="deflated-sharpe-ratio">Deflated</Term>, sort: (r) => r.metrics.deflated_sharpe, render: (r) => fmt.num(r.metrics.deflated_sharpe) },
    { key: "gauntlet", header: "Gauntlet", sort: (r) => r.gauntlet?.passed, render: (r) => (r.gauntlet ? `${r.gauntlet.passed} of ${r.gauntlet.total}` : "") },
  ];

  return (
    <>
      <Title>Strategies</Title>
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
