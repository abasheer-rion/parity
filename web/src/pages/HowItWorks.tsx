// How Parity works: the two sides, what each is for, and the rules that keep them apart
// (DEC-0015). Shown on both sides, so anyone can see where a number comes from.
import { Title } from "../components/Shell";
import { Icon } from "../ui/icons";
import { HeroGlow, LIFT, PageTransition, Reveal, Tilt } from "../ui";
import { SPACE } from "../lib/space";

const RULES: { title: string; text: string }[] = [
  { title: "Product numbers come from research.", text: "Every number in the product comes from a research test, with its verdict next to it." },
  { title: "Research does not see product numbers.", text: "Sign-ups, watchlists and clicks are not shown on the research side and are not used in any test." },
  { title: "Search finds are leads.", text: "The strategy search tries variations around the clock. They stay on the research side. One reaches the product only after it is written down in advance and run officially." },
  { title: "Sorted by verdict.", text: "The home page lists strategies by verdict, then by the luck-adjusted Sharpe ratio. A high return that fails the luck check is labelled as possibly luck." },
  { title: "Every try is counted.", text: "The more ideas we test, the higher the bar each one must clear." },
];

export function HowItWorks() {
  const here = SPACE === "research" ? "research" : "product";
  return (
    <PageTransition className="how">
      <div className="page-head how-head">
        <HeroGlow tone="mint" />
        <div>
        <Title>How Parity works</Title>
        <p className="page-purpose">
          Parity has two sides. Research runs the tests. The product shows the results. Product data such as sign-ups is
          kept out of research. You are on the <strong>{here}</strong> side.
        </p>
        </div>
      </div>

      <div className="how-sides">
        <Tilt as="section" max={4} className={`how-side ${here === "research" ? "here" : ""}`}>
          <div className="how-icon"><Icon name="book" size={18} /></div>
          <h2>Research <span className="muted small">/research/</span></h2>
          <p>Ideas from papers and traders are written down before testing, run through the same 11 tests and stored in a sealed official record.</p>
          <ul>
            <li>Research docs: decisions, hypotheses, experiments, reading notes</li>
            <li>The official record and the 11 tests</li>
            <li>The strategy search, Sim World and the data</li>
          </ul>
          <a href={here === "research" ? "#/" : "/research/"}>Open research <Icon name="arrowUpRight" size={12} /></a>
        </Tilt>

        <div className="how-arrow" aria-hidden>
          <span className="how-flowline"><i /><i /><i /></span>
          <span>verdicts only</span>
          <Icon name="chevronRight" size={18} />
        </div>

        <Tilt as="section" max={4} className={`how-side ${here === "product" ? "here" : ""}`}>
          <div className="how-icon"><Icon name="chart" size={18} /></div>
          <h2>Product <span className="muted small">/app/</span></h2>
          <p>Find, follow and compare strategies. Each one is shown with its research result and verdict.</p>
          <ul>
            <li>Home, Discover, Watchlist and Compare</li>
            <li>What if scenarios and the news</li>
            <li>Soon: describe a strategy in plain words and have it tested</li>
          </ul>
          <a href={here === "product" ? "#/" : "/app/"}>Open the app <Icon name="arrowUpRight" size={12} /></a>
        </Tilt>
      </div>

      <h2 className="start-h">Rules between the two sides</h2>
      <ol className="how-rules">
        {RULES.map((r, i) => <Reveal as="li" key={r.title} delay={i * 60}><strong>{r.title}</strong> {r.text}</Reveal>)}
      </ol>

      <h2 className="start-h">How an idea becomes a result</h2>
      <ol className="how-flow">
        <Reveal as="li" delay={0} className={LIFT}><span>1</span><div><strong>Idea</strong><p className="muted small">From a paper, a trader or the search. Added to the algorithm library.</p></div></Reveal>
        <Reveal as="li" delay={80} className={LIFT}><span>2</span><div><strong>Written down first</strong><p className="muted small">What we expect and what would prove it wrong, before any test runs.</p></div></Reveal>
        <Reveal as="li" delay={160} className={LIFT}><span>3</span><div><strong>11 tests</strong><p className="muted small">The same tests for every strategy: costs, other periods, other settings, luck.</p></div></Reveal>
        <Reveal as="li" delay={240} className={LIFT}><span>4</span><div><strong>Official record</strong><p className="muted small">The run is sealed with a hash. Changing an old result breaks the hash.</p></div></Reveal>
        <Reveal as="li" delay={320} className={LIFT}><span>5</span><div><strong>Shown in the product</strong><p className="muted small">With its verdict in plain words.</p></div></Reveal>
      </ol>
      <p className="muted small">The full decision is DEC-0015 in the research docs.</p>
    </PageTransition>
  );
}
