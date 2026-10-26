import { Title } from "../components/Shell";
import { useMemo } from "react";
import { useHashState } from "../lib/deeplink";
import { Card } from "../ui/layout";
import { algorithms, bestReported, STAGES } from "../lib/catalog";
import type { Algorithm } from "../lib/types";
import { Term } from "./Learn";
import { TableScroll } from "../ui";

type SortKey = "id" | "year" | "sharpe" | "relevance" | "stage";

const uniq = (xs: string[]) => [...new Set(xs)].sort();

export function Catalog() {
  // The filters live in the link, so Copy link and the back button reopen this view (DEC-0038).
  const [q, setQ] = useHashState("q");
  const [family, setFamily] = useHashState("family");
  const [market, setMarket] = useHashState("market");
  const [stageRaw, setStageRaw] = useHashState("stage", "0");
  const stageMin = Number(stageRaw) || 0;
  const setStageMin = (n: number) => setStageRaw(String(n));
  const [sortRaw, setSort] = useHashState("sort", "relevance");
  const sort: SortKey = (["id", "year", "sharpe", "relevance", "stage"] as const).includes(sortRaw as SortKey) ? (sortRaw as SortKey) : "relevance";

  const families = uniq(algorithms.map((a) => a.family));
  const markets = uniq(algorithms.flatMap((a) => a.markets));

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    const filtered = algorithms.filter((a) =>
      (!family || a.family === family) &&
      (!market || a.markets.includes(market)) &&
      a.research.stage >= stageMin &&
      (!t || [a.name, a.how_it_works.simple, a.tags.join(" "), a.origin.authors].some((x) => x.toLowerCase().includes(t))));
    const key = (a: Algorithm): number =>
      sort === "year" ? -(a.origin.first_published ?? 0) :
      sort === "sharpe" ? -(bestReported(a) ?? -99) :
      sort === "relevance" ? -a.relevance.score * 100 - a.research.stage :
      sort === "stage" ? -a.research.stage : 0;
    return [...filtered].sort((a, b) => key(a) - key(b) || a.id.localeCompare(b.id));
  }, [q, family, market, stageMin, sort]);

  const byFamily = families.map((f) => [f, algorithms.filter((a) => a.family === f).length] as const);
  const thisYear = new Date().getFullYear();

  return (
    <>
      <div className="page-head">
        <Title>Algorithm catalog</Title>
        <p>
          Every trading algorithm we know of, with where it came from, how old it is, what its authors reported and how
          far we have tested it. Reported numbers are the source's claims until the stage shows we tested them. Very high
          reported Sharpe ratios are usually a warning sign.
        </p>
      </div>

      <div className="tiles">
        <div className="tile"><div className="tile-label">Algorithms</div><div className="tile-value">{algorithms.length}</div>
          <div className="tile-note">{families.length} families</div></div>
        <div className="tile"><div className="tile-label">Tested by us officially</div>
          <div className="tile-value">{algorithms.filter((a) => a.research.stage >= 6).length}</div>
          <div className="tile-note">stage 6 or later</div></div>
        <div className="tile"><div className="tile-label">With live trading evidence</div>
          <div className="tile-value">{algorithms.filter((a) => a.reported_results.some((r) => r.evidence_type === "live")).length}</div></div>
        <div className="tile"><div className="tile-label">Testable with free data</div>
          <div className="tile-value">{algorithms.filter((a) => a.testable_with_free_data).length}</div></div>
      </div>

      <Card title="Filter">
        <div className="filters">
          <input type="search" placeholder="Search name, tags, authors" value={q} onChange={(e) => setQ(e.target.value)} />
          <select value={family} onChange={(e) => setFamily(e.target.value)} aria-label="Family">
            <option value="">All families</option>
            {byFamily.map(([f, n]) => <option key={f} value={f}>{f} ({n})</option>)}
          </select>
          <select value={market} onChange={(e) => setMarket(e.target.value)} aria-label="Market">
            <option value="">All markets</option>
            {markets.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <select value={stageMin} onChange={(e) => setStageMin(Number(e.target.value))} aria-label="Minimum stage">
            <option value={0}>Any stage</option>
            {STAGES.map((s, i) => <option key={s} value={i + 1}>At least {i + 1}. {s}</option>)}
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Sort">
            <option value="relevance">Sort: relevance to us</option>
            <option value="stage">Sort: research stage</option>
            <option value="sharpe">Sort: best reported Sharpe</option>
            <option value="year">Sort: newest first</option>
            <option value="id">Sort: catalog id</option>
          </select>
        </div>
      </Card>

      <Card title={`${rows.length} algorithms`} help={<>Click a row for the full report. <Term id="sharpe-ratio">Sharpe</Term> is the best any source reported, with its evidence type.</>}>
        <TableScroll>
          <table className="catalog">
            <thead>
              <tr><th>Algorithm</th><th>Family</th><th>Markets</th><th>Horizon</th><th>Since</th><th>Origin</th>
                <th>Best reported Sharpe</th><th>Our stage</th><th>Relevance</th></tr>
            </thead>
            <tbody>
              {rows.map((a) => {
                const best = a.reported_results.filter((r) => r.sharpe != null).sort((x, y) => (y.sharpe! - x.sharpe!))[0];
                const yr = a.origin.first_published;
                return (
                  <tr key={a.id}>
                    <td className="wrap"><a href={`#/algo/${a.slug}`}><strong>{a.name}</strong></a><div className="muted small">{a.id}</div></td>
                    <td>{a.family}</td>
                    <td>{a.markets.join(", ")}</td>
                    <td>{a.horizon}</td>
                    <td>{yr ?? "n/a"}{yr ? <span className="muted small"> ({thisYear - yr}y)</span> : null}</td>
                    <td>{a.origin.type}</td>
                    <td>{best ? <>{best.sharpe!.toFixed(2)} <span className={`badge ev-${best.evidence_type}`}>{best.evidence_type}</span>{best.sharpe! > 2 && <span className="badge warn" title="Very high Sharpe ratios usually mean overfitting, leakage or a short sample">check</span>}</> : <span className="muted">none</span>}</td>
                    <td><StageBar stage={a.research.stage} /></td>
                    <td>{a.relevance.score} / 5</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableScroll>
      </Card>
    </>
  );
}

export function StageBar({ stage }: { stage: number }) {
  return (
    <span className="stagebar" title={`${stage} of 9: ${STAGES[stage - 1]}`}>
      {STAGES.map((s, i) => <i key={s} className={i < stage ? "on" : ""} />)}
      <span className="small muted"> {STAGES[stage - 1]}</span>
    </span>
  );
}
