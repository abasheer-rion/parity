// The always-on strategy search (DEC-0014): every variation the box has tried, each
// with a short name, one line and the numbers that matter. Click a row for more.
import { Fragment, useEffect, useMemo, useState } from "react";
import { Title } from "../components/Shell";
import { date, num, pct } from "../lib/format";
import { loadSearch, type SearchDoc, type SearchRow } from "../lib/data";
import { ASSET_LABEL, FAMILY_LABEL } from "../lib/strategyMeta";
import { Badge, EmptyState, SearchInput } from "../ui";
import { Term } from "./Learn";

type SortKey = "deflated" | "sharpe" | "cagr" | "max_dd" | "years" | "name";
const PAGE = 100;

function luck(v: number | null): { label: string; tone: "good" | "accent" | "neutral" | "bad" } {
  if (v == null) return { label: "n/a", tone: "neutral" };
  if (v >= 0.95) return { label: "Likely real", tone: "good" };
  if (v >= 0.5) return { label: "Maybe", tone: "accent" };
  return { label: "Could be luck", tone: "bad" };
}

export function Search() {
  const [doc, setDoc] = useState<SearchDoc | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [asset, setAsset] = useState("");
  const [family, setFamily] = useState("");
  const [beatsOnly, setBeatsOnly] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "deflated", dir: -1 });
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => { loadSearch().then(setDoc).catch((e: Error) => setError(e.message)); }, []);
  useEffect(() => setPage(0), [q, asset, family, beatsOnly, sort]);

  const rows = useMemo(() => {
    if (!doc) return [];
    const needle = q.trim().toLowerCase();
    const out = doc.rows.filter((r) => (!asset || r.asset === asset) && (!family || r.family === family)
      && (!beatsOnly || r.beats_market) && (!needle || `${r.name} ${r.line}`.toLowerCase().includes(needle)));
    const val = (r: SearchRow) => (sort.key === "name" ? r.name : r[sort.key] ?? -Infinity);
    return out.sort((a, b) => {
      const x = val(a), y = val(b);
      return (x < y ? -1 : x > y ? 1 : 0) * sort.dir;
    });
  }, [doc, q, asset, family, beatsOnly, sort]);

  if (error) return (
    <>
      <Head />
      <EmptyState title="No search results yet">{error} It runs on the team's machine and sends results here a few times a day.</EmptyState>
    </>
  );
  if (!doc) return <><Head /><p className="muted">Loading the search</p></>;

  const shown = rows.slice(page * PAGE, page * PAGE + PAGE);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const th = (key: SortKey, label: React.ReactNode, left = false) => (
    <th className={`${left ? "left" : ""} sortable ${sort.key === key ? "sorted" : ""}`}>
      <button className="ui-th-btn" onClick={() => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : key === "name" ? 1 : -1 }))}>
        {label}{sort.key === key && <span className="ui-sort-arrow">{sort.dir === 1 ? "↑" : "↓"}</span>}
      </button>
    </th>
  );

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
        <select aria-label="Asset" value={asset} onChange={(e) => setAsset(e.target.value)}>
          <option value="">All assets</option>
          {Object.keys(doc.by_asset).map((a) => <option key={a} value={a}>{ASSET_LABEL[a] ?? a}</option>)}
        </select>
        <select aria-label="Family" value={family} onChange={(e) => setFamily(e.target.value)}>
          <option value="">All kinds</option>
          {Object.keys(doc.by_family).map((f) => <option key={f} value={f}>{FAMILY_LABEL[f] ?? f}</option>)}
        </select>
        <label className="search-check"><input type="checkbox" checked={beatsOnly} onChange={(e) => setBeatsOnly(e.target.checked)} /> Beats the market only</label>
        <span className="muted small">{rows.length.toLocaleString()} shown of the best {doc.rows.length.toLocaleString()}</span>
      </div>

      <div className="table-wrap">
        <table className="mtable search-table">
          <thead>
            <tr>
              {th("name", "Strategy", true)}
              {th("deflated", <Term id="deflated-sharpe-ratio">Luck check</Term>)}
              {th("sharpe", <Term id="sharpe-ratio">Sharpe</Term>)}
              {th("cagr", <Term id="cagr">Per year</Term>)}
              {th("max_dd", <Term id="drawdown">Worst fall</Term>)}
              {th("years", "Years")}
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => {
              const l = luck(r.deflated);
              const isOpen = open === r.id;
              return (
                <Fragment key={r.id}>
                  <tr className={`search-row ${isOpen ? "open" : ""}`} onClick={() => setOpen(isOpen ? null : r.id)}>
                    <td className="left">
                      <div className="search-name">{r.name}</div>
                      <div className="muted small search-line">{r.line}</div>
                    </td>
                    <td><Badge tone={l.tone}>{l.label}</Badge></td>
                    <td>{num(r.sharpe)}</td>
                    <td>{pct(r.cagr)}</td>
                    <td>{pct(r.max_dd)}</td>
                    <td>{num(r.years, 0)}</td>
                  </tr>
                  {isOpen && (
                    <tr className="search-detail">
                      <td colSpan={6}>
                        <dl>
                          <div><dt>Kind</dt><dd>{FAMILY_LABEL[r.family] ?? r.family}, {r.style}</dd></div>
                          <div><dt>Assets</dt><dd>{ASSET_LABEL[r.asset] ?? r.asset}</dd></div>
                          <div><dt>Since</dt><dd>{r.start}</dd></div>
                          <div><dt>Volatility</dt><dd>{pct(r.vol)}</dd></div>
                          <div><dt>Moves with stocks</dt><dd>{num(r.corr)}</dd></div>
                          <div><dt>Trading per year</dt><dd>{r.turnover == null ? "n/a" : `${num(r.turnover, 1)}x`}</dd></div>
                          <div><dt><Term id="break-even-cost">Break-even cost</Term></dt><dd>{r.breakeven_bps == null ? "n/a" : `${num(r.breakeven_bps, 1)} bp`}</dd></div>
                          <div><dt>Luck check score</dt><dd>{num(r.deflated)} (0.95 needed)</dd></div>
                        </dl>
                        <p className="muted small">Recipe: <code>{JSON.stringify(r.spec)}</code> · id {r.id}</p>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="search-pager">
          <button disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</button>
          <span className="muted small">Page {page + 1} of {pages}</span>
          <button disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      )}
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
