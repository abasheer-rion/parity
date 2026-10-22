// New and trending: funds being filed with the SEC, newly numbered fund series, and the
// coins people search for most. Newest first, never ranked by gains or hype.
import { useMemo, useState } from "react";
import { Select } from "../../ui";
import { Term } from "../Learn";
import { day, daysAgo, loadDiscover, pctText, usd, usdCompact, useMarket, type Filing } from "../../lib/markets";
import { ETF_CHECKS } from "./Etfs";
import { Attribution, Banner, Checks, Loading, Sources, type Check } from "./shared";

const KIND_LABEL: Record<Filing["kind"], string> = {
  "new-company": "New fund company",
  "new-series": "New fund or big change",
  trust: "Trust registration",
  other: "Other",
};

const KIND_WHAT: Record<Filing["kind"], string> = {
  "new-company": "A fund company filed its first registration (form N-1A). It may take months to launch, or never launch.",
  "new-series": "An existing fund company asked to add a fund or change one a lot (form 485APOS). Most new ETFs arrive this way, about 75 days after filing.",
  trust: "A trust filed to register shares (form S-1 or an amendment). Spot crypto and commodity ETFs use this route. A filing is a request, not an approval.",
  other: "",
};

const FILING_CHECKS: Check[] = [
  { label: "Is it real yet", text: "A filing is a request. Many funds are filed and never launch, and some launch and close within a few years." },
  ...ETF_CHECKS,
];

const COIN_CHECKS: Check[] = [
  { label: "Why it is trending", text: "Trending means many people searched for it on CoinGecko in the last day. It says nothing about quality, and searches often peak after the price has already jumped." },
  { label: "Fees", text: "Small coins usually trade on few exchanges, with wide gaps between buy and sell prices." },
  { label: "Liquidity", text: "Check daily trading volume. A few large sellers can move a small coin by tens of percent." },
  { label: "Concentration", text: <>Insiders often hold much of the supply of a new coin and can sell into the attention. See <Term id="memecoin">memecoin</Term>.</> },
  { label: "History", text: "Most coins that trend once are far lower a year later. A short price history tells you very little." },
];

export function Discover() {
  const [doc, error] = useMarket(loadDiscover);
  const [kind, setKind] = useState("");
  const [shown, setShown] = useState(40);
  const filings = useMemo(() => (doc?.filings ?? []).filter((f) => !kind || f.kind === kind), [doc, kind]);
  if (!doc) return <Loading error={error} what="new and trending" />;

  return (
    <>
      <Banner>
        <strong>Newest first, not hottest first.</strong> This page lists what is being filed and launched so you can see what is coming. Being new or trending is not a reason to buy. Each item has a "what to check" list.
      </Banner>
      <div className="mk-grid">
        <section className="mk-card span2">
          <div className="mk-card-head">
            <h2>New fund filings with the SEC</h2>
            <Select label="Kind" value={kind} onChange={(v) => { setKind(v); setShown(40); }} options={[["", "All kinds"], ["trust", "Trusts (crypto, commodities)"], ["new-company", "New fund companies"], ["new-series", "New funds at existing companies"]]} />
          </div>
          <p className="muted small">{filings.length} filings in the last {doc.filing_days} days we have fetched, newest first. The SEC lists the fund company's name; the fund's own name is inside the filing.</p>
          <ul className="mk-list">
            {filings.slice(0, shown).map((f) => (
              <li key={f.adsh}>
                <div className="mk-row">
                  <span className="mk-name">{f.name}{f.tickers.length > 0 && <> <span className="mk-sym">{f.tickers.join(", ")}</span></>}</span>
                  <span className="mk-num muted small">{day(f.filed)}, {daysAgo(f.filed)} days ago</span>
                </div>
                <div className="mk-meta">
                  <span>{KIND_LABEL[f.kind]}</span>
                  <span>Form {f.form}</span>
                  {f.description && f.description !== f.form && f.description !== f.root_form && <span>{f.description}</span>}
                  {f.url && <a href={f.url} target="_blank" rel="noreferrer">Read the filing</a>}
                </div>
                <p className="small muted" style={{ margin: 0 }}>{KIND_WHAT[f.kind]}</p>
                <Checks items={FILING_CHECKS} />
              </li>
            ))}
          </ul>
          {filings.length > shown && <button className="ui-btn ui-btn-secondary ui-btn-md" onClick={() => setShown(shown + 40)}>Show more</button>}
          <Attribution sources={doc.sources.filter((s) => s.id.startsWith("sec"))} />
        </section>

        <section className="mk-card">
          <h2>Coins people are searching for</h2>
          <p className="muted small">The coins searched most on CoinGecko in the last day, in CoinGecko's order, as of {day(doc.trending_fetched_at)}. Attention, not evidence.</p>
          <ul className="mk-list">
            {doc.trending_coins.map((c) => (
              <li key={c.id}>
                <div className="mk-row">
                  <span className="mk-name">{c.name} <span className="mk-sym">{c.symbol}</span></span>
                  <span className="mk-num">{usd(c.price_usd)}</span>
                </div>
                <div className="mk-meta">
                  <span>{c.market_cap_rank ? `Size rank ${c.market_cap_rank}` : "No size rank"}</span>
                  <span>Market value {usdCompact(c.market_cap_usd)}</span>
                  <span>Traded in a day {usdCompact(c.volume_24h_usd)}</span>
                  <span>{pctText(c.change_24h_pct)} in a day</span>
                </div>
                <Checks items={COIN_CHECKS} />
              </li>
            ))}
          </ul>
          <Attribution sources={doc.sources.filter((s) => s.id.startsWith("coingecko"))} />
        </section>

        <section className="mk-card">
          <h2>Newest fund series</h2>
          <p className="muted small">ETFs with the highest SEC series numbers, so the most recently registered. Some have not started trading.</p>
          <ul className="mk-list">
            {doc.newest_series.slice(0, 15).map((e) => (
              <li key={e.ticker}>
                <div className="mk-row"><span className="mk-name"><span className="mk-sym">{e.ticker}</span> {e.name}</span></div>
                <div className="mk-meta"><span>{e.issuer}</span>{e.first_seen && <span>First seen by us {day(e.first_seen)}</span>}</div>
              </li>
            ))}
          </ul>
          <a className="small" href="#/markets/etfs">Browse every ETF by theme</a>
          <Attribution sources={doc.sources.filter((s) => s.id === "sec-funds")} />
        </section>
      </div>
      <Sources sources={doc.sources} />
    </>
  );
}
