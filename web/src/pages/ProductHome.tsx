// Product home, in the spirit of Public's: your watchlist first, then strategies worth
// a look, a plain-words box for asking, "what if", and how this year is going. Every
// number shown here comes from the research side's gauntlet, with its verdict; the
// product never shows search leads or ranks on return alone (DEC-0015).
import { useEffect, useMemo, useState } from "react";
import { Sparkline } from "../ui/charts";
import { Icon } from "../ui/icons";
import { Badge, HeroGlow, LIFT, PageSkeleton, PageTransition, Reveal, Tilt } from "../ui";
import { colorMap } from "../lib/colors";
import { pct, signedPct } from "../lib/format";
import { usePrefs } from "../lib/prefs";
import { nameOf, tagsOf, verdictOf } from "../lib/strategyMeta";
import type { Report, StrategyRun } from "../lib/types";
import { productInsights } from "../lib/insights";
import { date } from "../lib/format";
import { Insights } from "../components/Insights";
import { Checklist } from "../onboarding/Checklist";
import { useOnboarding } from "../onboarding/store";
import { FirstRunTour } from "../onboarding/FirstRunTour";
import { isDesktop } from "../desktop/bridge";

const THEMES: { label: string; q: string; icon: string; what: string }[] = [
  { label: "Currencies", q: "currency", icon: "compare", what: "Carry, trend and value strategies on currencies" },
  { label: "Stock timing", q: "stock", icon: "chart", what: "Rules for when to hold stocks and when to hold cash" },
  { label: "Industries", q: "industr", icon: "catalog", what: "Rotating between US industries" },
  { label: "Factors", q: "factor", icon: "flask", what: "Value, momentum, quality and size" },
  { label: "Stocks and bonds", q: "bond", icon: "ledger", what: "Balanced mixes like 60/40 and risk parity" },
  { label: "Oil and gas", q: "oil", icon: "pulse", what: "Commodities, trends and seasons" },
];

const ORDER: Record<string, number> = { Passed: 3, Promising: 2, "Not proven": 1 };

function ytd(r: StrategyRun): number | null {
  const years = Object.keys(r.yearly).sort();
  return years.length ? r.yearly[years[years.length - 1]] : null;
}

export function ProductHome({ report, email }: { report: Report; email?: string | null }) {
  const prefs = usePrefs();
  const colors = colorMap(report.runs);
  const bench = report.runs.find((r) => r.is_benchmark);
  const tested = report.runs.filter((r) => !r.is_benchmark && r.gauntlet);
  const followed = useMemo(() => {
    const ids = prefs.bookmarks.filter((b) => b.href.startsWith("#/strategy/")).map((b) => decodeURIComponent(b.href.slice(11)));
    return report.runs.filter((r) => ids.includes(r.strategy));
  }, [prefs.bookmarks, report.runs]);
  // Worth a look: best verdict first, then the luck check, never raw return.
  const picks = [...tested].sort((a, b) => (ORDER[verdictOf(b).label] ?? 0) - (ORDER[verdictOf(a).label] ?? 0)
    || (b.metrics.deflated_sharpe ?? 0) - (a.metrics.deflated_sharpe ?? 0)).slice(0, 9);
  const year = bench ? Object.keys(bench.yearly).sort().slice(-1)[0] : undefined;
  const movers = [...tested].filter((r) => ytd(r) != null).sort((a, b) => (ytd(b) ?? 0) - (ytd(a) ?? 0));
  const beating = tested.filter((r) => r.gauntlet?.beats_sp500).length;
  const first = email ? email.split("@")[0].replace(/[._-].*$/, "") : "";
  // On a first visit, wait (at most 1.5 seconds) for the checklist's data, so it does not push
  // the page down when it arrives. Later visits draw it at once from this browser's copy.
  const ob = useOnboarding();
  const [late, setLate] = useState(false);
  useEffect(() => { const t = window.setTimeout(() => setLate(true), 1500); return () => window.clearTimeout(t); }, []);
  if (!ob.checked && !late) return <PageSkeleton parts={["stats", "chart", "table"]} label="Loading results" />;

  return (
    <PageTransition className="phome">
      <section className="phome-hero">
        <HeroGlow />
        <div>
          <h1 className="display">{first ? `Hi ${first[0].toUpperCase()}${first.slice(1)}` : "Welcome"}</h1>
          <p className="muted">{tested.length} strategies, each run through the same tests. {beating === 0 ? "None beats holding the US stock market." : `${beating} beat holding the US stock market.`}</p>
        </div>
        <button className="ask" onClick={() => window.dispatchEvent(new Event("parity:search"))}>
          <Icon name="sparkle" size={16} />
          <span>Ask anything: "what is carry", "best strategy", "does anything beat the market"</span>
        </button>
      </section>

      <Checklist />
      <FirstRunTour areas={isDesktop() ? ["home", "desktop"] : ["home"]} />

      <Insights items={productInsights(report)} source={`the ${report.kind === "official" ? "official" : "nightly"} research run of ${date(report.generated_at)}`} />

      {picks.length > 0 && (
        <div className="feat-row" aria-label="Top strategies by verdict">
          {picks.slice(0, 3).map((r, i) => (
            <Reveal key={r.strategy} delay={i * 70}>
              <Tilt className="feat">
                <Feature r={r} color={colors[r.strategy]} />
              </Tilt>
            </Reveal>
          ))}
        </div>
      )}

      <div className="phome-grid">
        <Reveal as="section" className={`pcard ${LIFT}`}>
          <div className="pcard-head"><h2>Watchlist</h2><a href="#/watchlist">See all</a></div>
          {followed.length === 0 ? (
            <p className="muted small">Follow a strategy with the bookmark button on its page and it shows up here.</p>
          ) : (
            <ul className="plist">{followed.slice(0, 6).map((r) => <Row key={r.strategy} r={r} color={colors[r.strategy]} />)}</ul>
          )}
          {bench && (
            <div className="bench-line">
              <span>US stock market, {year}</span>
              <strong className={(ytd(bench) ?? 0) >= 0 ? "good" : "bad"}>{signedPct(ytd(bench))}</strong>
            </div>
          )}
        </Reveal>

        <Reveal as="section" delay={50} className={`pcard ${LIFT}`}>
          <div className="pcard-head"><h2>More strategies</h2><a href="#/strategies">Discover</a></div>
          <p className="muted small">Sorted by verdict, then by the luck-adjusted Sharpe ratio.</p>
          <ul className="plist">{picks.slice(3).map((r) => <Row key={r.strategy} r={r} color={colors[r.strategy]} showVerdict />)}</ul>
        </Reveal>

        <Reveal as="section" delay={100} className={`pcard span2 ${LIFT}`}>
          <div className="pcard-head"><h2>Explore by theme</h2></div>
          <div className="themes">
            {THEMES.map((t) => (
              <a key={t.label} className={`theme ${LIFT}`} href={`#/strategies?q=${encodeURIComponent(t.q)}`}>
                <Icon name={t.icon} size={16} />
                <strong>{t.label}</strong>
                <span className="muted small">{t.what}</span>
              </a>
            ))}
          </div>
        </Reveal>

        <Reveal as="section" delay={150} className={`pcard ${LIFT}`}>
          <div className="pcard-head"><h2>What if</h2><a href="#/scenarios">Try one</a></div>
          <p className="small">Describe an event, like a war, a rate hike or an oil shock, and see what markets did after similar ones in the past.</p>
          <div className="chips">
            {["Oil supply shock", "Surprise rate hike", "War in a major economy", "Bank failure"].map((s) => (
              <a key={s} className="chip" href="#/scenarios">{s}</a>
            ))}
          </div>
        </Reveal>

        <Reveal as="section" delay={200} className={`pcard ${LIFT}`}>
          <div className="pcard-head"><h2>{year ?? "This year"} so far</h2><a href="#/compare">Compare</a></div>
          <ul className="plist">
            {movers.slice(0, 3).map((r) => <Row key={r.strategy} r={r} color={colors[r.strategy]} />)}
          </ul>
          <div className="muted small divider-label">Weakest</div>
          <ul className="plist">
            {movers.slice(-2).reverse().map((r) => <Row key={r.strategy} r={r} color={colors[r.strategy]} />)}
          </ul>
        </Reveal>

        <Reveal as="section" delay={250} className={`pcard span2 build ${LIFT}`}>
          <div>
            <h2>Build a strategy by describing it <Badge tone="accent">Coming next</Badge></h2>
            <p className="muted small">Planned: type an idea, like "own the strongest currencies but step aside when fear is high", and Parity turns it into a strategy and runs the same tests. For now, you can change the settings of an existing strategy.</p>
          </div>
          <a className="btn-primary" href="#/lab">Try settings</a>
        </Reveal>
      </div>
      <p className="muted small phome-foot">
        Results are backtests after trading costs. Past results do not predict future ones. They come from the <a href="/research/">research side</a>. See <a href="#/how">how Parity works</a>.
      </p>
    </PageTransition>
  );
}

/** One of the three strongest by the evidence: a tilting card with its line drawing in. */
function Feature({ r, color }: { r: StrategyRun; color: string }) {
  const v = verdictOf(r);
  const g = r.gauntlet;
  return (
    <a className="feat-in" href={`#/strategy/${r.strategy}`}>
      <div className="feat-top">
        <span className="acct-dot" style={{ background: color }} />
        <span className="muted small">{tagsOf(r).style || tagsOf(r).family}</span>
        <Badge tone={v.tone}>{v.label}</Badge>
      </div>
      <strong className="feat-name">{nameOf(r)}</strong>
      <Sparkline points={r.equity} width={240} height={56} fluid />
      <div className="feat-stats">
        <span><b>{g ? `${g.passed} of ${g.total}` : "None"}</b><span className="muted small">tests passed</span></span>
        <span><b>{pct(r.metrics.cagr)}</b><span className="muted small">a year</span></span>
        <span><b>{pct(r.metrics.max_drawdown)}</b><span className="muted small">worst fall</span></span>
      </div>
    </a>
  );
}

function Row({ r, color, showVerdict }: { r: StrategyRun; color: string; showVerdict?: boolean }) {
  const v = verdictOf(r);
  const y = ytd(r);
  return (
    <li>
      <a href={`#/strategy/${r.strategy}`}>
        <span className="acct-dot" style={{ background: color }} />
        <span className="pname">
          <span>{nameOf(r)}</span>
          <span className="muted small">{showVerdict ? tagsOf(r).style || tagsOf(r).family : `${pct(r.metrics.cagr)} a year`}</span>
        </span>
        <Sparkline points={r.equity} width={64} height={24} />
        {showVerdict ? <Badge tone={v.tone}>{v.label}</Badge> : <span className={`pval ${(y ?? 0) >= 0 ? "good" : "bad"}`}>{signedPct(y)}</span>}
      </a>
    </li>
  );
}
