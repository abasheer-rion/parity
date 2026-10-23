// Private markets on the product side (DEC-0029): what each kind is in plain words, how to
// read the numbers managers report (with a calculator), the ways individuals get in, and
// free public data. Every route has a "what to check" list. Nothing is ranked by return
// and nothing says "buy" (DEC-0015).
import { useMemo, useState } from "react";
import { BarChart, LineChart, Sparkline } from "../../ui/charts";
import { Segmented, Select } from "../../ui/inputs";
import { Term } from "../Learn";
import { terms as glossary } from "../../lib/glossary";
import { loadPrivate, pctText, useMarket, usdCompact } from "../../lib/markets";
import {
  calmFactor, checklist, classes, directAlpha, EXAMPLES, intro, irr, ksPme, measures, multiples, netFlows, providers,
  routes, smoothing, type Flow, type PrivateDoc, type Study,
} from "../../lib/privateMarkets";
import { Attribution, Banner, Checks, Loading, Risk, Sources, Stat } from "./shared";

type Part = "kinds" | "numbers" | "access" | "data";
const PARTS: [Part, string][] = [["kinds", "The kinds"], ["numbers", "Reading the numbers"], ["access", "Ways in"], ["data", "Public data"]];

export function PrivateMarkets() {
  const [part, setPart] = useState<Part>("kinds");
  const [doc, error] = useMarket(loadPrivate);
  return (
    <>
      <Banner icon="info"><strong>Private markets in one line.</strong> {intro}</Banner>
      <div className="pm-nav"><Segmented label="Private markets section" value={part} onChange={setPart} options={PARTS} /></div>
      {part === "kinds" && <Kinds />}
      {part === "numbers" && <Numbers doc={doc} />}
      {part === "access" && <Access />}
      {part === "data" && (doc ? <PublicData doc={doc} /> : <Loading error={error} what="private markets" />)}
      <section className="mk-card pm-checklist">
        <h2>Before you trust any private markets number</h2>
        <ol>{checklist.map((c) => <li key={c}>{c}</li>)}</ol>
      </section>
      {doc && <Sources sources={doc.sources} />}
      {!doc && <p className="mk-sources">Research and education only. Nothing here is advice to buy or sell anything, and Parity does not trade for anyone.</p>}
    </>
  );
}

// ------------------------------------------------------------------ the kinds

function Kinds() {
  return (
    <div className="mk-grid">
      {classes.map((c) => (
        <article key={c.id} id={`pm-${c.id}`} className="mk-card pm-class">
          <h2>{c.name}</h2>
          <p>{c.simple}</p>
          <dl className="pm-dl">
            <dt>How it earns</dt><dd>{c.returns}</dd>
            <dt>Getting money out</dt><dd>{c.liquidity}</dd>
            <dt>Fees</dt><dd>{c.fees}</dd>
          </dl>
          <Risk>{c.risks.join(" ")}</Risk>
          <Checks items={c.check.map((t, i) => ({ label: `${i + 1}`, text: t }))} />
          <p className="pm-terms">Words: {c.terms.map((t, i) => <span key={t}>{i > 0 && ", "}<Term id={t}>{glossary.find((g) => g.id === t)?.term ?? t.replace(/-/g, " ")}</Term></span>)}</p>
        </article>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ reading the numbers

function Numbers({ doc }: { doc: PrivateDoc | null }) {
  const houses = doc?.unsmoothing.find((s) => s.id === "houses");
  return (
    <>
      <div className="mk-grid three">
        {measures.map((m) => (
          <article key={m.id} className="mk-card">
            <h3><Term id={m.term}>{m.name}</Term></h3>
            <p>{m.simple}</p>
            <p className="pm-pitfall"><strong>Watch out:</strong> {m.pitfall}</p>
          </article>
        ))}
      </div>
      <Calculator />
      <section className="mk-card pm-smooth">
        <h2>{smoothing.title}</h2>
        <p>{smoothing.text}</p>
        <ul className="mk-check">{smoothing.points.map((p) => <li key={p}><span>{p}</span></li>)}</ul>
        {houses && <SmoothChart study={houses} />}
        {doc && <p className="muted small">The full study, with commercial property too, is on the research side: <a href="/research/#/private">Private markets data</a>.</p>}
      </section>
    </>
  );
}

function SmoothChart({ study }: { study: Study }) {
  const f = calmFactor(study);
  return (
    <>
      <div className="mk-stats">
        <Stat label="Reported swings" value={`${study.raw.vol.toFixed(1)}% a year`} note="volatility of the published index" term="volatility" />
        <Stat label="After unsmoothing" value={`${study.geltner.vol.toFixed(1)}% a year`} note={f ? `${f.toFixed(1)} times the reported figure` : undefined} term="unsmoothing" />
        {study.stocks && <Stat label="US stocks, same years" value={`${study.stocks.vol.toFixed(1)}% a year`} note="for comparison" />}
        <Stat label="Deepest fall" value={`${study.raw.max_drawdown.toFixed(1)}% vs ${study.geltner.max_drawdown.toFixed(1)}%`} note="reported vs unsmoothed" />
      </div>
      {study.chart && (
        <div className="mk-chart">
          <LineChart log height={240} label={`${study.label}: reported index and unsmoothed index`} format={(v) => v.toFixed(0)}
            series={[
              { name: "Reported", color: "var(--series-1)", points: study.chart.map(([d, a]) => [d, a]) },
              { name: "Unsmoothed", color: "var(--series-2)", points: study.chart.map(([d, , b]) => [d, b]) },
            ]} />
        </div>
      )}
      <p className="muted small">{study.label}, {study.start.slice(0, 4)} to {study.end.slice(0, 4)}. {study.note} Unsmoothing assumes each quarter's reported change leans on the last one by {Math.round(study.geltner.phi * 100)}%, the measured autocorrelation, and strips that out.</p>
    </>
  );
}

function fmtX(v: number | null | undefined) { return v == null ? "n/a" : `${v.toFixed(2)}x`; }
function fmtPct(v: number | null | undefined) { return v == null ? "n/a" : pctText(v * 100, 1, false); }

function Calculator() {
  const [exampleId, setExampleId] = useState(EXAMPLES[0].id);
  const [flows, setFlows] = useState<Flow[]>(EXAMPLES[0].flows);
  const [nav, setNav] = useState(EXAMPLES[0].nav);
  const [index, setIndex] = useState(7);
  const pick = (id: string) => {
    const e = EXAMPLES.find((x) => x.id === id) ?? EXAMPLES[0];
    setExampleId(e.id); setFlows(e.flows); setNav(e.nav);
  };
  const example = EXAMPLES.find((x) => x.id === exampleId);
  const m = useMemo(() => multiples(flows, nav), [flows, nav]);
  const r = useMemo(() => irr(netFlows(flows, nav)), [flows, nav]);
  const pme = useMemo(() => ksPme(flows, nav, index / 100), [flows, nav, index]);
  const alpha = useMemo(() => directAlpha(flows, nav, index / 100), [flows, nav, index]);
  const set = (i: number, key: "paidIn" | "paidOut", v: string) => {
    const n = Math.max(0, Number(v) || 0);
    setFlows((fs) => fs.map((f, j) => (j === i ? { ...f, [key]: n } : f)));
  };
  return (
    <section className="mk-card pm-calc" aria-labelledby="pm-calc-title">
      <h2 id="pm-calc-title">Try it: one fund, five numbers</h2>
      <p className="muted small">Pick an example or type your own yearly cash. Amounts are in any currency unit. The index return stands in for what the same cash would have earned in a stock index.</p>
      <div className="pm-calc-top">
        <Select label="Example fund" value={exampleId} onChange={pick} options={EXAMPLES.map((e) => [e.id, e.label] as [string, string])} />
        <label className="pm-field">Value still held (NAV)
          <input type="number" min={0} inputMode="decimal" value={nav} onChange={(e) => setNav(Math.max(0, Number(e.target.value) || 0))} />
        </label>
        <label className="pm-field">Index return, % a year
          <input type="number" step={0.5} inputMode="decimal" value={index} onChange={(e) => setIndex(Number(e.target.value) || 0)} />
        </label>
      </div>
      {example && <p className="small">{example.what}</p>}
      <div className="mk-stats pm-results">
        <Stat label="IRR" value={fmtPct(r)} term="irr" note="yearly, timing weighted" />
        <Stat label="TVPI" value={fmtX(m.tvpi)} term="tvpi" note={`DPI ${fmtX(m.dpi)} + RVPI ${fmtX(m.rvpi)}`} />
        <Stat label="PME" value={pme == null ? "n/a" : pme.toFixed(2)} term="pme" note={pme == null ? undefined : pme >= 1 ? "beat the index" : "trailed the index"} />
        <Stat label="Direct alpha" value={fmtPct(alpha)} note="yearly return above the index" />
      </div>
      <div className="mk-table-scroll">
        <table className="mtable dense pm-flows">
          <caption className="sr-only">Yearly cash paid in and paid out</caption>
          <thead><tr><th scope="col">Year</th>{flows.map((f) => <th key={f.year} scope="col">{f.year}</th>)}</tr></thead>
          <tbody>
            <tr><th scope="row">Paid in</th>{flows.map((f, i) => <td key={f.year}><input aria-label={`Paid in, year ${f.year}`} type="number" min={0} value={f.paidIn} onChange={(e) => set(i, "paidIn", e.target.value)} /></td>)}</tr>
            <tr><th scope="row">Paid out</th>{flows.map((f, i) => <td key={f.year}><input aria-label={`Paid out, year ${f.year}`} type="number" min={0} value={f.paidOut} onChange={(e) => set(i, "paidOut", e.target.value)} /></td>)}</tr>
          </tbody>
        </table>
      </div>
      <p className="muted small">Compare the examples: the early win and the borrowed start have the same TVPI as the steady fund, but a higher IRR. That is why one number is never enough.</p>
    </section>
  );
}

// ------------------------------------------------------------------ ways in

function Access() {
  return (
    <>
      <Banner icon="info"><strong>None of these is a recommendation.</strong> Each one trades something away: the ability to sell, low fees, or a price set by a market. Read what can go wrong and what to check first.</Banner>
      <div className="mk-grid">
        {routes.map((r) => (
          <article key={r.id} id={`pm-route-${r.id}`} className="mk-card">
            <h2><Term id={r.term}>{r.name}</Term></h2>
            <p>{r.what}</p>
            <dl className="pm-dl">
              <dt>Getting money out</dt><dd>{r.liquidity}</dd>
              <dt>Minimum</dt><dd>{r.minimum}</dd>
            </dl>
            <Risk>{r.risks.join(" ")}</Risk>
            <Checks items={r.check.map((t, i) => ({ label: `${i + 1}`, text: t }))} />
          </article>
        ))}
      </div>
      <section className="mk-card">
        <h2>Who has the data</h2>
        <p className="muted small">Most private markets data is sold, not given away. These are the main sources and what is free.</p>
        <ul className="mk-list">
          {providers.map((p) => (
            <li key={p.name}>
              <div className="mk-row"><span className="mk-name">{p.name}</span><span className={`pm-free pm-free-${p.free}`}>{p.free === "yes" ? "Free" : p.free === "partly" ? "Some free" : "Paid"}</span></div>
              <span className="small">{p.what}. {p.note}</span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

// ------------------------------------------------------------------ public data

function PublicData({ doc }: { doc: PrivateDoc }) {
  return (
    <>
      <FormD doc={doc} />
      <Bdcs doc={doc} />
      <Lending doc={doc} />
      <Attribution sources={doc.sources} />
    </>
  );
}

function FormD({ doc }: { doc: PrivateDoc }) {
  const f = doc.formd;
  const [kind, setKind] = useState("all");
  if (!f) return <Banner><strong>No Form D data yet.</strong> The SEC asks scripts to name a contact, so this runs only where PARITY_CONTACT is set.</Banner>;
  const last = f.by_quarter[f.by_quarter.length - 1];
  const value = (q: (typeof f.by_quarter)[number]) => (kind === "all" ? q.filings : q.by_kind[kind] ?? 0);
  const kinds = Object.entries(last.by_kind).sort((a, b) => b[1] - a[1]);
  const sizes = f.sizes.map((s) => [s.label, last.by_size[s.id] ?? 0] as const);
  return (
    <section className="mk-card">
      <div className="mk-card-head"><h2>What is being raised privately</h2></div>
      <p className="small">Every company or fund selling securities privately under Regulation D must file a short notice, a <Term id="form-d">Form D</Term>, within 15 days of its first sale. Counting new notices shows how busy private fundraising is. A notice says nothing about quality: the SEC does not review it.</p>
      <div className="pm-calc-top">
        <Select label="Kind of issuer" value={kind} onChange={setKind} options={[["all", "All issuers"], ...f.kinds.map((k) => [k, k] as [string, string])]} />
      </div>
      <BarChart height={200} label={`New Form D notices per quarter, ${kind === "all" ? "all issuers" : kind}`} format={(v) => v.toLocaleString()}
        groups={f.by_quarter.map((q) => ({ label: q.quarter.replace("Q", " Q"), values: [{ name: "New notices", color: "var(--series-1)", value: value(q) }] }))} />
      <div className="mk-grid">
        <div>
          <h3 className="pm-h3">By kind, {last.quarter.replace("Q", " Q")}</h3>
          <ul className="pm-bars">
            {kinds.map(([k, n]) => (
              <li key={k}><span>{k}</span><span className="mk-num">{n.toLocaleString()}</span><i style={{ width: `${(100 * n) / last.filings}%` }} /></li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="pm-h3">By amount sold so far</h3>
          <ul className="pm-bars">
            {sizes.map(([label, n]) => (
              <li key={label}><span>{label}</span><span className="mk-num">{n.toLocaleString()}</span><i style={{ width: `${(100 * n) / last.filings}%` }} /></li>
            ))}
          </ul>
          <p className="muted small">{last.filings.toLocaleString()} new notices, reporting {usdCompact(last.amount_sold_usd)} sold so far. {last.nonaccredited.toLocaleString()} say they sold to someone who is not an accredited investor.</p>
        </div>
      </div>
    </section>
  );
}

function Bdcs({ doc }: { doc: PrivateDoc }) {
  const b = doc.bdc;
  if (!b) return null;
  return (
    <section className="mk-card">
      <h2>How private loans are marked: BDC net asset values</h2>
      <p className="small">A <Term id="bdc">BDC</Term> lends to private companies and must report the value of its loans every quarter. Net asset value (NAV) per share is the fund's own estimate of what each share is worth. It ignores dividends, which are most of a BDC's return, so read it as a record of the marks, not of what holders earned. Ordered by name, not by return.</p>
      <div className="mk-table-scroll">
        <table className="mtable dense">
          <thead><tr><th scope="col">Fund</th><th scope="col" className="num">NAV per share</th><th scope="col" className="num">Change over a year</th><th scope="col" className="num">Worst quarter</th><th scope="col" className="num">Deepest fall</th><th scope="col">Path</th></tr></thead>
          <tbody>
            {[...b.funds].sort((x, y) => x.name.localeCompare(y.name)).map((f) => (
              <tr key={f.cik}>
                <th scope="row">{f.name} {f.ticker && <span className="mk-sym">{f.ticker}</span>}</th>
                <td className="num">{f.last?.toFixed(2)} <span className="muted small">{f.last_date.slice(0, 7)}</span></td>
                <td className="num">{pctText(f.change_1y_pct)}</td>
                <td className="num">{pctText(f.worst_quarter_pct)}</td>
                <td className="num">{pctText(f.max_drawdown_pct)}</td>
                <td><Sparkline points={f.points} width={90} height={24} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small">Older filings give NAV only once a year, so the worst quarter counts only quarters with a value at both ends. These funds are listed, so their share prices can sit well above or below NAV; we do not show prices because no free source allows it.</p>
    </section>
  );
}

const LENDING = ["pm.SLOOS_CI", "pm.SLOOS_CRE", "pm.DELINQ_CRE", "pm.LOANS_NDFI", "pm.LOANS_CRE", "pm.LOANS_CI", "pm.CRE_PRICE_YOY", "pm.HOUSE_FHFA"];

function Lending({ doc }: { doc: PrivateDoc }) {
  const list = LENDING.map((k) => doc.series.find((s) => s.key === k)).filter((s): s is NonNullable<typeof s> => !!s);
  const [key, setKey] = useState(list[0]?.key ?? "");
  const s = list.find((x) => x.key === key) ?? list[0];
  if (!s) return null;
  return (
    <section className="mk-card">
      <h2>The weather private funds live in</h2>
      <p className="small">Private credit and property funds depend on banks, borrowers and building prices. These official series show that backdrop. They are not returns of any fund.</p>
      <div className="pm-calc-top"><Select label="Series" value={s.key} onChange={setKey} options={list.map((x) => [x.key, x.label] as [string, string])} /></div>
      <LineChart height={220} label={s.label} format={(v) => (Math.abs(v) >= 1000 ? v.toLocaleString(undefined, { maximumFractionDigits: 0 }) : v.toFixed(1))}
        series={[{ name: s.label, color: "var(--series-3)", points: s.points }]} />
      <p className="muted small">{s.description}. Unit: {s.unit}. {s.source}: {s.licence}.</p>
    </section>
  );
}
