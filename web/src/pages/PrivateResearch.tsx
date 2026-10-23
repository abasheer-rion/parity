// Private markets data on the research side (DEC-0029, RES-0012): the unsmoothing study,
// Form D counts in detail, BDC marks and the FRED proxies, each with its source, its limits
// and what it cannot tell us. The product page (/app/#/markets/private) explains the same
// data in plain words; this page shows the numbers behind it.
import { useState } from "react";
import { Title } from "../components/Shell";
import { LineChart } from "../ui/charts";
import { Select } from "../ui/inputs";
import { loadPrivate, pctText, useMarket, usdCompact } from "../lib/markets";
import { calmFactor, providers, reading, type PrivateDoc, type Study } from "../lib/privateMarkets";
import { Attribution, Banner, Loading, Sources } from "./markets/shared";
import "./markets/markets.css";

export function PrivateResearch() {
  const [doc, error] = useMarket(loadPrivate);
  return (
    <div className="mk">
      <div className="page-head mk-head">
        <Title label="Private markets data">Private markets data</Title>
        <p>What free public data can and cannot say about private markets. Nothing here is a return series for private funds: those sit behind paid licences. We measure how much smoothing hides, how busy private fundraising is, how private loans are marked, and the credit backdrop.</p>
        <p className="small">Read with: {reading.map((r, i) => <span key={r.doc}>{i > 0 && " · "}<a href={`#/doc/${r.doc}`}>{r.label}</a></span>)}. Plain-words version: <a href="/app/#/markets/private">Private markets</a> on the product side.</p>
      </div>
      {!doc ? <Loading error={error} what="private markets" /> : <Body doc={doc} />}
    </div>
  );
}

function Body({ doc }: { doc: PrivateDoc }) {
  return (
    <>
      <Unsmoothing studies={doc.unsmoothing} />
      <FormdDetail doc={doc} />
      <BdcDetail doc={doc} />
      <SeriesDetail doc={doc} />
      <section className="mk-card">
        <h2>What we cannot measure for free</h2>
        <ul className="mk-check">
          <li><span>Fund cash flows and net returns (IRR, TVPI, PME by vintage). These come from Burgiss (MSCI), Preqin, PitchBook or Cambridge Associates under licence.</span></li>
          <li><span>NCREIF's appraisal index, the usual real estate smoothing example, is for members only. We use the Fed's index and FHFA's instead.</span></li>
          <li><span>Prices of listed private equity, BDCs and REITs. Every free price feed we know of forbids showing them, and the index families are licensed.</span></li>
          <li><span>Interval fund and non-traded REIT flows and repurchase queues. They sit in SEC filings (N-CSR, N-23C3, 10-Q) as text, not yet parsed.</span></li>
        </ul>
        <ul className="mk-list">
          {providers.map((p) => <li key={p.name}><div className="mk-row"><span className="mk-name">{p.name}</span><span className={`pm-free pm-free-${p.free}`}>{p.free === "yes" ? "Free" : p.free === "partly" ? "Some free" : "Paid"}</span></div><span className="small">{p.what}. {p.note}</span></li>)}
        </ul>
      </section>
      <Attribution sources={doc.sources} />
      <Sources sources={doc.sources} />
    </>
  );
}

const pct = (v: number | null | undefined, d = 1) => (v == null ? "n/a" : `${v.toFixed(d)}%`);
const num = (v: number | null | undefined, d = 2) => (v == null ? "n/a" : v.toFixed(d));

function Unsmoothing({ studies }: { studies: Study[] }) {
  if (!studies.length) return <Banner><strong>No unsmoothing study yet.</strong> Run <code>parity fetch</code> for the pm.* series, then <code>parity markets export</code>.</Banner>;
  const charted = studies.find((s) => s.chart);
  return (
    <section className="mk-card">
      <h2>How much smoothing hides</h2>
      <p className="small">Each index is turned into quarterly returns. Geltner's fix assumes each reported change is part today's true change and part last quarter's reported change, estimates that share from the first autocorrelation, and removes it. The Getmansky, Lo and Makarov fix fits a moving average over three quarters and scales volatility by the smoothing index. The summed beta adds the stock market's effect this quarter and the two before, which smoothing spreads out.</p>
      <div className="mk-table-scroll">
        <table className="mtable dense">
          <thead>
            <tr><th scope="col">Index</th><th scope="col">Years</th><th scope="col" className="num">Autocorrelation</th><th scope="col" className="num">Reported volatility</th><th scope="col" className="num">Geltner</th><th scope="col" className="num">GLM implied</th><th scope="col" className="num">Deepest fall, reported to Geltner</th><th scope="col" className="num">Stock beta, same quarter to summed</th><th scope="col" className="num">Stocks volatility</th></tr>
          </thead>
          <tbody>
            {studies.map((s) => (
              <tr key={s.id}>
                <th scope="row">{s.label}</th>
                <td>{s.start.slice(0, 4)} to {s.end.slice(0, 4)}</td>
                <td className="num">{num(s.autocorrelation.lag1)}, {num(s.autocorrelation.lag2)}</td>
                <td className="num">{pct(s.raw.vol)}</td>
                <td className="num">{pct(s.geltner.vol)} <span className="muted small">({num(calmFactor(s), 1)}x)</span></td>
                <td className="num">{pct(s.glm.vol_implied)}{s.glm.fit_error > 0.1 && <span className="muted small"> poor fit</span>}</td>
                <td className="num">{pct(s.raw.max_drawdown)} to {pct(s.geltner.max_drawdown)}</td>
                <td className="num">{num(s.beta_raw?.same_quarter)} to {num(s.beta_raw?.summed)}</td>
                <td className="num">{pct(s.stocks?.vol)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="pm-study-grid">
        {studies.map((s) => (
          <div key={s.id} className="mk-stat">
            <div className="mk-stat-label">{s.label}</div>
            <div className="small">{s.note}</div>
            <div className="small muted">GLM weights {s.glm.theta.map((t) => t.toFixed(2)).join(", ")}, smoothing index {num(s.glm.smoothing_index)}{s.glm.fit_error > 0.1 ? `. The moving average cannot reach an autocorrelation this high (fit error ${num(s.glm.fit_error)}), so its volatility is a lower bound.` : "."}{s.site ? "" : " Numbers only: the index is built from CoStar data, so we do not chart it."}</div>
          </div>
        ))}
      </div>
      {charted?.chart && (
        <div className="mk-chart">
          <LineChart log height={260} label={`${charted.label}: reported and Geltner unsmoothed index`} format={(v) => v.toFixed(0)}
            series={[
              { name: "Reported", color: "var(--series-1)", points: charted.chart.map(([d, a]) => [d, a]) },
              { name: "Geltner unsmoothed", color: "var(--series-2)", points: charted.chart.map(([d, , b]) => [d, b]) },
            ]} />
        </div>
      )}
      <p className="muted small">Caveats. Both fixes assume true returns are unpredictable; property prices may really trend, which would make these estimates too high. The FHFA index is deseasonalised first. Summed betas are small here because property is a weak stock market bet, but they rise once smoothing is allowed for. None of this is a tradable return.</p>
    </section>
  );
}

function FormdDetail({ doc }: { doc: PrivateDoc }) {
  const f = doc.formd;
  if (!f) return <Banner><strong>No Form D data yet.</strong> Needs PARITY_CONTACT set for the SEC.</Banner>;
  const kinds = f.kinds;
  return (
    <section className="mk-card">
      <h2>Form D notices by quarter</h2>
      <p className="small">New notices only (amendments are not counted again). Kinds come from the industry group each filer picks; pooled funds are split by the fund type they pick. "Sold" is the amount the filer reports sold when it files, which is often zero for new funds.</p>
      <div className="mk-table-scroll">
        <table className="mtable dense">
          <thead><tr><th scope="col">Quarter</th><th scope="col" className="num">All</th>{kinds.map((k) => <th key={k} scope="col" className="num">{k}</th>)}<th scope="col" className="num">Sold</th><th scope="col" className="num">506(c)</th></tr></thead>
          <tbody>
            {[...f.by_quarter].reverse().map((q) => (
              <tr key={q.quarter}>
                <th scope="row">{q.quarter}</th>
                <td className="num">{q.filings.toLocaleString()}</td>
                {kinds.map((k) => <td key={k} className="num">{(q.by_kind[k] ?? 0).toLocaleString()}</td>)}
                <td className="num">{usdCompact(q.amount_sold_usd)}</td>
                <td className="num">{(q.by_exemption["506c"] ?? 0).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h3 className="pm-h3">Largest groups in {f.latest.quarter}, by size sold</h3>
      <div className="mk-table-scroll">
        <table className="mtable dense">
          <thead><tr><th scope="col">Group</th><th scope="col">Kind</th><th scope="col" className="num">Notices</th>{f.sizes.map((s) => <th key={s.id} scope="col" className="num">{s.label}</th>)}</tr></thead>
          <tbody>
            {f.latest.groups.slice(0, 15).map((g) => (
              <tr key={g.group}>
                <th scope="row">{g.group}</th><td>{g.kind}</td><td className="num">{g.filings.toLocaleString()}</td>
                {f.sizes.map((s) => <td key={s.id} className="num">{(g.by_size[s.id] ?? 0).toLocaleString()}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function BdcDetail({ doc }: { doc: PrivateDoc }) {
  const b = doc.bdc;
  if (!b) return null;
  return (
    <section className="mk-card">
      <h2>BDC net asset value per share</h2>
      <p className="small">From each fund's 10-Q and 10-K XBRL facts, one value per period end, from the latest filing that reported it. Quarterly statistics use only consecutive quarter ends. A one-quarter move over 40% is treated as a share split or merger and left out. NAV per share excludes dividends.</p>
      <div className="mk-table-scroll">
        <table className="mtable dense">
          <thead><tr><th scope="col">Fund</th><th scope="col">From</th><th scope="col" className="num">Quarterly changes</th><th scope="col" className="num">Volatility a year</th><th scope="col" className="num">Autocorrelation</th><th scope="col" className="num">Worst quarter</th><th scope="col" className="num">Deepest fall</th></tr></thead>
          <tbody>
            {[...b.funds].sort((x, y) => x.name.localeCompare(y.name)).map((f) => (
              <tr key={f.cik}>
                <th scope="row">{f.name} {f.ticker && <span className="mk-sym">{f.ticker}</span>}</th>
                <td>{f.first_date.slice(0, 7)}</td>
                <td className="num">{f.quarterly_changes}</td>
                <td className="num">{pctText(f.quarter_vol_pct, 1, false)}</td>
                <td className="num">{num(f.ac1)}</td>
                <td className="num">{pctText(f.worst_quarter_pct)} <span className="muted small">{f.worst_quarter_date?.slice(0, 7)}</span></td>
                <td className="num">{pctText(f.max_drawdown_pct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small">Positive autocorrelation in NAV changes is a sign of smoothed marks, the same pattern as in the property indexes above. With so few quarters it is a hint, not a test.</p>
    </section>
  );
}

function SeriesDetail({ doc }: { doc: PrivateDoc }) {
  const [key, setKey] = useState(doc.series[0]?.key ?? "");
  const s = doc.series.find((x) => x.key === key) ?? doc.series[0];
  if (!s) return null;
  return (
    <section className="mk-card">
      <h2>FRED proxies</h2>
      <div className="pm-calc-top"><Select label="Series" value={s.key} onChange={setKey} options={doc.series.map((x) => [x.key, `${x.label} (${x.key})`] as [string, string])} /></div>
      <LineChart height={240} label={s.label} format={(v) => (Math.abs(v) >= 1000 ? v.toLocaleString(undefined, { maximumFractionDigits: 0 }) : v.toFixed(2))}
        series={[{ name: s.label, color: "var(--series-3)", points: s.points }]} />
      <p className="muted small">{s.description}. Frequency {s.freq}. {s.source}: {s.licence}. In the engine's panel each value waits for its release delay, so a backtest never sees it early.</p>
    </section>
  );
}
