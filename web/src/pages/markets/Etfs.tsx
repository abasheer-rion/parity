// ETFs: every US-listed ETF we can find in the SEC's lists, browsable by theme, newest
// fund series first. Themes come from words in the fund's name, which is rough.
import { useMemo, useState } from "react";
import { Button, Select } from "../../ui";
import { Term } from "../Learn";
import { day, loadEtfs, useMarket, type Etf, type EtfsDoc } from "../../lib/markets";
import { Attribution, Checks, Loading, Sources, type Check } from "./shared";

type Sort = "newest" | "az";
const PAGE = 100;

export const ETF_CHECKS: Check[] = [
  { label: "Fees", text: <>Find the <Term id="expense-ratio">expense ratio</Term> in the fund's prospectus. Theme, option and leveraged funds often charge 0.5% to 1% a year or more; broad index funds can cost under 0.1%.</> },
  { label: "Liquidity", text: <>Look at daily trading volume and the gap between buy and sell prices. Small funds can trade away from the value of what they hold, a <Term id="premium-discount-to-nav">premium or discount</Term>.</> },
  { label: "Concentration", text: "Read the top ten holdings. Many theme funds put half their money in a handful of stocks, or in one coin." },
  { label: "History", text: <>A new fund has no track record. <Term id="thematic-etf">Theme funds</Term> have on average done worse after launch than before it, and many close within a few years.</> },
];

/** Practice needs a price we are not licensed to show yet, so the Practice page asks for it. */
export function etfFollow(e: Etf) {
  window.location.hash = `#/markets/practice?add=${encodeURIComponent(e.ticker)}`;
}

function themeFromHash(): string {
  const q = window.location.hash.split("?")[1] ?? "";
  return new URLSearchParams(q).get("theme") ?? "";
}

export function Etfs() {
  const [doc, error] = useMarket(loadEtfs);
  const [theme, setTheme] = useState(themeFromHash);
  const [q, setQ] = useState("");
  const [structure, setStructure] = useState("");
  const [fresh, setFresh] = useState(false);
  const [sort, setSort] = useState<Sort>("newest");
  const [shown, setShown] = useState(PAGE);
  const rows = useMemo(() => filterEtfs(doc, theme, q, structure, fresh, sort), [doc, theme, q, structure, fresh, sort]);
  if (!doc) return <Loading error={error} what="ETF" />;
  const t = doc.themes.find((x) => x.id === theme);
  const pick = (id: string) => { setTheme(id === theme ? "" : id); setShown(PAGE); };

  return (
    <>
      <p className="muted small">{doc.count.toLocaleString("en-US")} US-listed ETFs from the SEC's own lists, checked {day(doc.fetched_at)}. Themes are matched by words in each fund's name, so some funds are missed or misfiled.</p>
      <div className="mk-theme-grid" role="group" aria-label="Themes">
        {doc.themes.map((x) => (
          <button key={x.id} className={`mk-theme ${theme === x.id ? "on" : ""}`} onClick={() => pick(x.id)} aria-pressed={theme === x.id}>
            <span className="mk-theme-top"><span>{x.label}</span><span className="mk-num muted">{x.count}</span></span>
            <span className="muted small">{x.what}</span>
          </button>
        ))}
      </div>
      {t && (
        <div className="mk-risk"><strong>{t.label}, what to check: </strong>{t.check}{t.glossary && <> See <Term id={t.glossary}>the glossary entry</Term>.</>}</div>
      )}
      <section className="mk-card">
        <h2>Before you look at any fund</h2>
        <Checks items={ETF_CHECKS} title="What to check, for every ETF" />
      </section>

      <div className="mk-filters" style={{ marginTop: 16 }}>
        <input type="search" placeholder="Search ticker, fund or company" value={q} onChange={(e) => { setQ(e.target.value); setShown(PAGE); }} aria-label="Search ETFs" />
        <Select label="Structure" value={structure} onChange={(v) => { setStructure(v); setShown(PAGE); }} options={[["", "All structures"], ["fund", "Registered funds"], ["trust", "Listed trusts (crypto, gold)"]]} />
        <Select<Sort> label="Order" value={sort} onChange={setSort} options={[["newest", "Newest fund series first"], ["az", "A to Z by ticker"]]} />
        <label className="small"><input type="checkbox" checked={fresh} onChange={(e) => { setFresh(e.target.checked); setShown(PAGE); }} /> New this year</label>
      </div>
      <p className="muted small">{rows.length.toLocaleString("en-US")} funds. "Newest first" uses the order the SEC numbered each fund series, so a fund near the top was registered recently and may not trade yet. Listed trusts have no series number and come last.</p>
      <ul className="mk-list">
        {rows.slice(0, shown).map((e) => (
          <li key={e.ticker}>
            <div className="mk-row">
              <span className="mk-name"><span className="mk-sym">{e.ticker}</span> {e.name}</span>
              <Button size="sm" variant="tertiary" onClick={() => etfFollow(e)}>Practice</Button>
            </div>
            <div className="mk-meta">
              <span>{e.issuer}</span>
              <span>{e.structure === "trust" ? "Listed trust" : "Registered fund"}</span>
              {e.new_this_year && <span>New in the SEC's list this year</span>}
              {e.themes.map((id) => <span key={id}>{doc.themes.find((x) => x.id === id)?.label}</span>)}
            </div>
          </li>
        ))}
      </ul>
      {rows.length > shown && <Button variant="secondary" onClick={() => setShown(shown + PAGE)}>Show {Math.min(PAGE, rows.length - shown)} more</Button>}
      <Attribution sources={doc.sources} />
      <Sources sources={doc.sources} />
    </>
  );
}

function filterEtfs(doc: EtfsDoc | null, theme: string, q: string, structure: string, fresh: boolean, sort: Sort): Etf[] {
  if (!doc) return [];
  const t = q.trim().toLowerCase();
  const out = doc.etfs.filter((e) => (!theme || e.themes.includes(theme)) && (!structure || e.structure === structure) &&
    (!fresh || e.new_this_year) && (!t || `${e.ticker} ${e.name} ${e.issuer}`.toLowerCase().includes(t)));
  return sort === "az" ? [...out].sort((a, b) => a.ticker.localeCompare(b.ticker)) : out;
}
