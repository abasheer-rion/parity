// The always-on strategy search (DEC-0014): every variation the box has tried, each
// with a short name, one line and the numbers that matter. Click a row for more.
import { useMemo, useState } from "react";
import { Title } from "../components/Shell";
import { date, num, pct } from "../lib/format";
import { loadSearch, type SearchRow } from "../lib/data";
import { ASSET_LABEL, FAMILY_LABEL } from "../lib/strategyMeta";
import { AnimatedNumber, Badge, Checkbox, DataTable, EmptyState, KeyValues, PageSkeleton, SearchInput, Select, useResource, type Column } from "../ui";
import { Term } from "./Learn";


function luck(v: number | null): { label: string; tone: "good" | "accent" | "neutral" | "bad" } {
  if (v == null) return { label: "n/a", tone: "neutral" };
  if (v >= 0.95) return { label: "Likely real", tone: "good" };
  if (v >= 0.5) return { label: "Maybe", tone: "accent" };
  return { label: "Could be luck", tone: "bad" };
}

export function Search() {
  const { data: doc, error } = useResource("search", loadSearch);
  const [q, setQ] = useState("");
  const [asset, setAsset] = useState("");
  const [family, setFamily] = useState("");
  const [beatsOnly, setBeatsOnly] = useState(false);

  const rows = useMemo(() => {
    if (!doc) return [];
    const needle = q.trim().toLowerCase();
    return doc.rows.filter((r) => (!asset || r.asset === asset) && (!family || r.family === family)
      && (!beatsOnly || r.beats_market) && (!needle || `${r.name} ${r.line}`.toLowerCase().includes(needle)));
  }, [doc, q, asset, family, beatsOnly]);

  if (error) return (
    <>
      <Head />
      <EmptyState title="No search results yet">{error} It runs on the team's machine and sends results here a few times a day.</EmptyState>
    </>
  );
  if (!doc) return <><Head /><PageSkeleton parts={["stats", "table"]} label="Loading the search" /></>;

  // Every row in one list: only the rows on screen are drawn, the header sticks, and a
  // row opens in place to show its details (the library's DataTable, REF-0009).
  const columns: Column<SearchRow>[] = [
    { key: "name", header: "Strategy", align: "left", width: "46%", sort: (r) => r.name, render: (r) => (
      <span className="search-cell"><span className="search-name">{r.name}</span><span className="muted small search-line">{r.line}</span></span>
    ) },
    { key: "deflated", header: "Luck check", width: "15%", sort: (r) => r.deflated ?? -Infinity, render: (r) => { const l = luck(r.deflated); return <Badge tone={l.tone}>{l.label}</Badge>; } },
    { key: "sharpe", header: "Sharpe", width: "10%", sort: (r) => r.sharpe ?? -Infinity, render: (r) => num(r.sharpe) },
    { key: "cagr", header: "Per year", width: "10%", sort: (r) => r.cagr ?? -Infinity, render: (r) => pct(r.cagr) },
    { key: "max_dd", header: "Worst fall", width: "11%", sort: (r) => r.max_dd ?? -Infinity, render: (r) => pct(r.max_dd) },
    { key: "years", header: "Years", width: "8%", sort: (r) => r.years, render: (r) => num(r.years, 0) },
  ];

  return (
    <>
      <Head />
      <div className="search-stats">
        <div><strong>{doc.trials.toLocaleString()}</strong><span>variations tried</span></div>
        <div><strong>{doc.beat_market.toLocaleString()}</strong><span>beat the market's Sharpe</span></div>
        <div><strong>{doc.passed_luck_check.toLocaleString()}</strong><span>pass the luck check</span></div>
        <div><strong>{date(doc.generated_at)}</strong><span>last update</span></div>
      </div>

      <div className="search-filters">
        <SearchInput value={q} onChange={setQ} placeholder="Find a strategy, e.g. carry, VIX, energy" />
        <Select label="Asset" value={asset} onChange={setAsset} options={[["", "All assets"], ...Object.keys(doc.by_asset).map((a) => [a, ASSET_LABEL[a] ?? a] as [string, string])]} />
        <Select label="Family" value={family} onChange={setFamily} options={[["", "All kinds"], ...Object.keys(doc.by_family).map((f) => [f, FAMILY_LABEL[f] ?? f] as [string, string])]} />
        <Checkbox checked={beatsOnly} onChange={setBeatsOnly} label="Beats the market only" />
        <span className="muted small search-count"><AnimatedNumber value={rows.length} format={(v) => Math.round(v).toLocaleString()} /> shown of the best {doc.rows.length.toLocaleString()}</span>
      </div>

      {/* Glossary links sit here, not inside the sort buttons, so each header is one control. */}
      <p className="muted small search-terms">
        Columns: <Term id="deflated-sharpe-ratio">luck check</Term>, <Term id="sharpe-ratio">Sharpe</Term>,
        {" "}<Term id="cagr">per year</Term> and <Term id="drawdown">worst fall</Term>. Click a row for its details.
      </p>
      <DataTable rows={rows} columns={columns} rowKey={(r) => r.id} maxHeight="min(72vh, 760px)" virtual stickyFirst
        initialSort={{ key: "deflated", dir: "desc" }} caption="Strategy variations, best first" empty="No variation matches these filters."
        expand={(r) => (
          <>
            <KeyValues cols={4} items={[
              ["Kind", `${FAMILY_LABEL[r.family] ?? r.family}, ${r.style}`],
              ["Assets", ASSET_LABEL[r.asset] ?? r.asset],
              ["Since", r.start],
              ["Volatility", pct(r.vol)],
              ["Moves with stocks", num(r.corr)],
              ["Trading per year", r.turnover == null ? "n/a" : `${num(r.turnover, 1)}x`],
              [<Term key="b" id="break-even-cost">Break-even cost</Term>, r.breakeven_bps == null ? "n/a" : `${num(r.breakeven_bps, 1)} bp`],
              ["Luck check score", `${num(r.deflated)} (0.95 needed)`],
            ]} />
            <p className="muted small search-recipe">Recipe: <code>{JSON.stringify(r.spec)}</code> · id {r.id}</p>
          </>
        )} />
    </>
  );
}

function Head() {
  return (
    <div className="page-head">
      <Title>Strategy search</Title>
      <p className="page-purpose">
        A machine tries new strategy variations around the clock: different ideas, assets and settings, each
        backtested after costs since 1999. Every try is counted, so the more it searches the higher the bar for the
        luck check. These are leads, not results; a lead becomes a result only when it is written up in advance and
        run officially. <a href="#/start">How to read these numbers</a>.
      </p>
    </div>
  );
}
