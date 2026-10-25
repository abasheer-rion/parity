// Strategy search (DEC-0014, DEC-0043): every variation the always-on search has tried,
// best first. Research numbers, read only. Filters live in the address
// (#/search?asset=fx&q=carry), so a link reopens them.
import { useMemo } from "react";
import { ServiceHealth } from "../components/ServiceHealth";
import { loadSearch, type SearchRow } from "../lib/data";
import { useHashFlag, useHashState } from "../lib/deeplink";
import { date, num, pct } from "../lib/format";
import { ASSET_LABEL, FAMILY_LABEL } from "../lib/strategyMeta";
import { Badge, Checkbox, DataTable, KeyValues, Select, Tooltip, useResource, type Column } from "../ui";

function luck(v: number | null): { label: string; tone: "good" | "warning" | "neutral" | "bad" } {
  if (v == null) return { label: "n/a", tone: "neutral" };
  if (v >= 0.95) return { label: "Likely real", tone: "good" };
  if (v >= 0.5) return { label: "Maybe", tone: "warning" };
  return { label: "Could be luck", tone: "bad" };
}

export function SearchView() {
  const { data: doc, error } = useResource("search", loadSearch);
  const [q, setQ] = useHashState("q");
  const [asset, setAsset] = useHashState("asset");
  const [family, setFamily] = useHashState("family");
  const [beatsOnly, setBeatsOnly] = useHashFlag("beats");

  const rows = useMemo(() => {
    if (!doc) return [];
    const needle = q.trim().toLowerCase();
    return doc.rows.filter((r) => (!asset || r.asset === asset) && (!family || r.family === family)
      && (!beatsOnly || r.beats_market) && (!needle || `${r.name} ${r.line}`.toLowerCase().includes(needle)));
  }, [doc, q, asset, family, beatsOnly]);

  const columns: Column<SearchRow>[] = [
    { key: "name", header: "Strategy", align: "left", width: "46%", sort: (r) => r.name, render: (r) => (
      <span className="lb-cell2"><span>{r.name}</span><span className="lb-dim">{r.line}</span></span>
    ) },
    { key: "deflated", header: <Tooltip text="The deflated Sharpe ratio: how likely the result is real after counting every try. 0.95 or more passes."><span>Luck check</span></Tooltip>, width: "15%", sort: (r) => r.deflated ?? -Infinity, render: (r) => { const l = luck(r.deflated); return <Badge tone={l.tone}>{l.label}</Badge>; } },
    { key: "sharpe", header: "Sharpe", width: "10%", sort: (r) => r.sharpe ?? -Infinity, render: (r) => num(r.sharpe) },
    { key: "cagr", header: "Per year", width: "10%", sort: (r) => r.cagr ?? -Infinity, render: (r) => pct(r.cagr) },
    { key: "max_dd", header: "Worst fall", width: "11%", sort: (r) => r.max_dd ?? -Infinity, render: (r) => pct(r.max_dd) },
    { key: "years", header: "Years", width: "8%", sort: (r) => r.years, render: (r) => num(r.years, 0) },
  ];

  return (
    <div className="lb-view">
      <div className="lb-bar lb-bar-wrap">
        <label className="lb-find" data-lab-find>
          <span className="sr-only">Find a strategy</span>
          <input className="lb-input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find, e.g. carry, VIX, energy" />
        </label>
        <Select label="Asset" value={asset} onChange={setAsset} options={[["", "All assets"], ...Object.keys(doc?.by_asset ?? {}).map((a) => [a, ASSET_LABEL[a] ?? a] as [string, string])]} />
        <Select label="Family" value={family} onChange={setFamily} options={[["", "All kinds"], ...Object.keys(doc?.by_family ?? {}).map((f) => [f, FAMILY_LABEL[f] ?? f] as [string, string])]} />
        <Checkbox checked={beatsOnly} onChange={setBeatsOnly} label="Beats the market" />
        <span className="lb-gap" />
        <span className="lb-dim tabular lb-count">{doc ? `${rows.length.toLocaleString()} of the best ${doc.rows.length.toLocaleString()}` : " "}</span>
      </div>
      <dl className="lb-stats">
        <div><dt>Variations tried</dt><dd>{doc ? doc.trials.toLocaleString() : " "}</dd></div>
        <div><dt>Beat the market's Sharpe</dt><dd>{doc ? doc.beat_market.toLocaleString() : " "}</dd></div>
        <div><dt>Pass the luck check</dt><dd>{doc ? doc.passed_luck_check.toLocaleString() : " "}</dd></div>
        <div><dt>Last update</dt><dd>{doc ? date(doc.generated_at) : " "}</dd></div>
      </dl>
      <ServiceHealth className="lb-health" />
      <div className="lb-box lb-flush lb-grow">
        {error ? <div className="lb-msg">No search results yet. {error}</div>
          : !doc ? <div className="lb-msg lb-loading" aria-busy="true">Loading the search</div>
          : (
            <DataTable rows={rows} columns={columns} rowKey={(r) => r.id} maxHeight="100%" virtual stickyFirst dense
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
                    ["Break-even cost", r.breakeven_bps == null ? "n/a" : `${num(r.breakeven_bps, 1)} bp`],
                    ["Luck check score", `${num(r.deflated)} (0.95 needed)`],
                  ]} />
                  <p className="lb-dim lb-recipe">Recipe <code>{JSON.stringify(r.spec)}</code> · id {r.id}</p>
                </>
              )} />
          )}
      </div>
    </div>
  );
}
