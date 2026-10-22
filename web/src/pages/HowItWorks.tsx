// How Parity works: the two sides, what each is for, and the wall between them
// (DEC-0015). Shown on both sides, so anyone can see where a number comes from.
import { Title } from "../components/Shell";
import { Icon } from "../ui/icons";
import { SPACE } from "../lib/space";

const RULES: { title: string; text: string }[] = [
  { title: "Research decides, the product presents.", text: "Every number in the product comes from the research side's tests, with its verdict next to it. The product cannot make a strategy look better than the research says." },
  { title: "Research never sees product numbers.", text: "Sign-ups, watchlists, clicks and popularity are not shown on the research side and never feed into a test. A strategy cannot pass because people like it." },
  { title: "Leads are not results.", text: "The always-on search tries thousands of variations. They stay on the research side as leads. A lead reaches the product only after it is written down in advance and run officially." },
  { title: "Rank by evidence, not by return.", text: "The product sorts by how well a strategy held up in testing. A high return with a weak luck check is shown as what it is: possibly luck." },
  { title: "Every try is counted.", text: "The more ideas we test, the higher the bar each one must clear. Searching harder cannot manufacture a winner." },
];

export function HowItWorks() {
  const here = SPACE === "research" ? "research" : "product";
  return (
    <div className="how">
      <div className="page-head">
        <Title>How Parity works</Title>
        <p className="page-purpose">
          Parity has two sides, kept apart on purpose. One makes results. The other shows them. Keeping them separate stops
          what sells from shaping what we find. You are on the <strong>{here}</strong> side.
        </p>
      </div>

      <div className="how-sides">
        <section className={`how-side ${here === "research" ? "here" : ""}`}>
          <div className="how-icon"><Icon name="book" size={18} /></div>
          <h2>Research <span className="muted small">/research/</span></h2>
          <p>Where results are made. Ideas come from papers and practice, get written down before they are tested, run through the same gauntlet of tests, and go into a sealed official record.</p>
          <ul>
            <li>Research docs: decisions, hypotheses, experiments, reading notes</li>
            <li>The official record and the gauntlet</li>
            <li>The always-on strategy search, Sim World and the data</li>
          </ul>
          <a href={here === "research" ? "#/" : "/research/"}>Open research <Icon name="arrowUpRight" size={12} /></a>
        </section>

        <div className="how-arrow" aria-hidden>
          <span>verdicts only</span>
          <Icon name="chevronRight" size={18} />
        </div>

        <section className={`how-side ${here === "product" ? "here" : ""}`}>
          <div className="how-icon"><Icon name="chart" size={18} /></div>
          <h2>Product <span className="muted small">/app/</span></h2>
          <p>Where people discover, follow and understand strategies. Built to be clear and open to anyone, like Public, with tools to test ideas, like QuantPad. It shows research results with their verdicts and explains them plainly.</p>
          <ul>
            <li>Home, Discover, Watchlist and Compare</li>
            <li>What if scenarios and the news</li>
            <li>Soon: describe a strategy in plain words and have it tested</li>
          </ul>
          <a href={here === "product" ? "#/" : "/app/"}>Open the app <Icon name="arrowUpRight" size={12} /></a>
        </section>
      </div>

      <h2 className="start-h">The wall between them</h2>
      <ol className="how-rules">
        {RULES.map((r) => <li key={r.title}><strong>{r.title}</strong> {r.text}</li>)}
      </ol>

      <h2 className="start-h">How an idea becomes a result</h2>
      <ol className="how-flow">
        <li><span>1</span><div><strong>Idea</strong><p className="muted small">From a paper, a trader's practice or the search. Goes in the algorithm library.</p></div></li>
        <li><span>2</span><div><strong>Written down first</strong><p className="muted small">What we expect and what would prove it wrong, before any test runs.</p></div></li>
        <li><span>3</span><div><strong>The gauntlet</strong><p className="muted small">The same tests for everyone: costs, other periods, other settings, luck.</p></div></li>
        <li><span>4</span><div><strong>Official record</strong><p className="muted small">The run is sealed. Changing an old result would break the seal.</p></div></li>
        <li><span>5</span><div><strong>Shown in the product</strong><p className="muted small">With its verdict, in plain words. Nothing more is claimed than research found.</p></div></li>
      </ol>
      <p className="muted small">Research, not investment advice. The full decision is DEC-0015 in the research docs.</p>
    </div>
  );
}
