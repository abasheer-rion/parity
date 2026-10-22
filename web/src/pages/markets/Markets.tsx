// Markets, on the product side: crypto, perps, ETFs, new and trending, the hype terms
// explained, and practice positions. Everything shows data with its date and source,
// ranks by size or date and never by gains, and never says "buy" (DEC-0015, DEC-0016).
import { Title } from "../../components/Shell";
import { Tabs } from "../../ui";
import { Icon } from "../../ui/icons";
import { categories, terms } from "../../lib/glossary";
import { Crypto } from "./Crypto";
import { Discover } from "./Discover";
import { Etfs } from "./Etfs";
import { Perps } from "./Perps";
import { Practice } from "./Practice";
import { Banner } from "./shared";
import "./markets.css";

export const HYPE_CATEGORY = "New products and hype terms";

const VIEWS = [
  ["", "Overview"], ["new", "New and trending"], ["crypto", "Crypto"], ["perps", "Perps"],
  ["etfs", "ETFs"], ["terms", "Hype terms"], ["practice", "Practice"],
] as const;
type View = (typeof VIEWS)[number][0];

const DOORS: { view: View; title: string; icon: string; what: string }[] = [
  { view: "new", title: "New and trending", icon: "sparkle", what: "Funds being filed with the SEC and the coins people search for, newest first, each with what to check." },
  { view: "crypto", title: "Crypto", icon: "chart", what: "Prices for the 100 largest coins, a year of history for the majors, and how hard they fall." },
  { view: "perps", title: "Perps", icon: "pulse", what: "Perpetual futures: what they are, funding as a cost of holding, and how leverage wipes out deposits." },
  { view: "etfs", title: "ETFs", icon: "catalog", what: "Every US-listed ETF we can find, by theme: crypto, leveraged, option income, buffer, AI and more." },
  { view: "terms", title: "Hype terms explained", icon: "cap", what: "Staking, restaking, memecoins, 0DTE, buffer ETFs, prediction markets: plain words and what can go wrong." },
  { view: "practice", title: "Practice", icon: "bookmark", what: "Follow a coin or an ETF with pretend money and watch what it would be worth. No real money." },
];

export function Markets({ view: raw }: { view?: string }) {
  const view = (VIEWS.some(([v]) => v === raw) ? raw : "") as View;
  const go = (v: View) => { window.location.hash = v ? `#/markets/${v}` : "#/markets"; };
  return (
    <div className="mk">
      <div className="page-head mk-head">
        <Title label="Markets">Markets</Title>
        <p>The things people are talking about, from spot bitcoin ETFs to perps and memecoins, with the data, the dates and the plain risks. We list what is new; we never tell you to buy it. Research and education only.</p>
      </div>
      <div className="mk-tabs"><Tabs label="Markets view" value={view} onChange={go} tabs={VIEWS.map(([v, l]) => [v, l] as [View, string])} /></div>
      {view === "" && <Overview />}
      {view === "new" && <Discover />}
      {view === "crypto" && <Crypto />}
      {view === "perps" && <Perps />}
      {view === "etfs" && <Etfs />}
      {view === "terms" && <HypeTerms />}
      {view === "practice" && <Practice />}
    </div>
  );
}

function Overview() {
  return (
    <>
      <Banner><strong>How to read these pages.</strong> Lists are ordered by size or by date, never by who went up most. Every coin, fund and filing has a "what to check" list: fees, how easy it is to sell, how concentrated it is, and how much history it has.</Banner>
      <div className="mk-grid three">
        {DOORS.map((d) => (
          <a key={d.view} className="mk-card mk-door" href={`#/markets/${d.view}`}>
            <span className="mk-door-title"><Icon name={d.icon} size={15} />{d.title}</span>
            <span className="muted small">{d.what}</span>
          </a>
        ))}
      </div>
    </>
  );
}

function HypeTerms() {
  const list = terms.filter((t) => t.category === HYPE_CATEGORY).sort((a, b) => a.term.localeCompare(b.term));
  const clean = (s: string) => s.replace(/\s*\[@[^\]]+\]/g, "");
  return (
    <>
      <p className="muted small">{list.length} words you will hear about new ways to spend money, each explained simply, by analogy and precisely, with what can go wrong. Sources are in the <a href={`#/learn`}>glossary</a>{categories.includes(HYPE_CATEGORY) ? ` under "${HYPE_CATEGORY}"` : ""}.</p>
      <div className="mk-terms">
        {list.map((t) => (
          <article key={t.id} id={`hype-${t.id}`} className="mk-card mk-term">
            <h3><a href={`#/learn/${t.id}`}>{t.term}</a></h3>
            <dl>
              <dt>Simple</dt><dd>{t.simple}</dd>
              <dt>Like</dt><dd>{t.analogy}</dd>
              <dt>Precisely</dt><dd>{clean(t.precise)}</dd>
              {t.risk && <><dt>What can go wrong</dt><dd className="mk-wrong">{t.risk}</dd></>}
            </dl>
          </article>
        ))}
      </div>
    </>
  );
}
