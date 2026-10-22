// Start here: what Parity is, where to go for each job, and how to read the numbers.
// Page names and descriptions come from lib/pages.ts so they match the sidebar.
import { Title } from "../components/Shell";
import { pct, num } from "../lib/format";
import { pageByHref } from "../lib/pages";
import { SPACE } from "../lib/space";
import type { Report } from "../lib/types";
import { Badge } from "../ui";
import { Icon } from "../ui/icons";
import { Term } from "./Learn";

// What each side is for, as jobs (DEC-0015). Only pages on this side are listed.
const JOBS: { title: string; icon: string; pages: string[] }[] = SPACE === "research" ? [
  { title: "See where the research stands", icon: "home", pages: ["#/", "#/ledger", "#/how"] },
  { title: "Read the reasoning", icon: "book", pages: ["#/docs", "#/refs", "#/learn"] },
  { title: "Look for new leads", icon: "search", pages: ["#/search", "#/catalog", "#/sim"] },
  { title: "Check a result holds up", icon: "checkCircle", pages: ["#/signals", "#/explore", "#/data", "#/sources"] },
] : [
  { title: "Find strategies", icon: "chart", pages: ["#/strategies", "#/watchlist", "#/compare"] },
  { title: "Ask \"what if\"", icon: "pulse", pages: ["#/scenarios", "#/news", "#/news/history"] },
  { title: "Understand", icon: "book", pages: ["#/learn", "#/how", "#/lab"] },
];

type M = Report["runs"][number]["metrics"];

const NUMBERS: { term: string; name: string; plain: string; good: (m?: M) => string }[] = [
  { term: "cagr", name: "Return per year (CAGR)", plain: "How fast the money grew each year, on average.", good: (m) => `Higher is better.${m?.cagr != null ? ` The US market made ${pct(m.cagr)} a year in this run.` : ""}` },
  { term: "sharpe-ratio", name: "Sharpe ratio", plain: "Return for each unit of bumpiness. It rewards steady gains over wild ones.", good: (m) => `Above 0.5 is decent, above 1 is rare.${m?.sharpe != null ? ` The US market scores ${num(m.sharpe)}.` : ""}` },
  { term: "drawdown", name: "Max drawdown (worst fall)", plain: "The biggest drop from a high point before it recovered.", good: (m) => `Closer to zero is better.${m?.max_drawdown != null ? ` The US market's worst fall was ${pct(m.max_drawdown)}.` : ""}` },
  { term: "deflated-sharpe-ratio", name: "Deflated Sharpe", plain: "The chance the Sharpe ratio is real and not luck, after counting every idea we tried.", good: () => "0.95 or more is needed to count as real." },
  { term: "break-even-cost", name: "Break-even cost", plain: "How much each trade could cost before the profit disappears.", good: () => "Higher is safer. Under 5 basis points (0.05%) is fragile." },
];

const VERDICTS: { label: string; tone: "good" | "accent" | "bad" | "neutral"; plain: string }[] = [
  { label: "Passed", tone: "good", plain: "Passed every test in the gauntlet and beats the US market after costs." },
  { label: "Promising", tone: "accent", plain: "Passed most tests, but not all, or does not beat the market yet." },
  { label: "Not proven", tone: "bad", plain: "Failed too many tests to trust. It may still teach us something." },
  { label: "Not tested", tone: "neutral", plain: "Built but not yet run through the gauntlet." },
];

export function Start({ report }: { report: Report | null }) {
  const bench = report?.runs.find((r) => r.is_benchmark)?.metrics;
  return (
    <div className="start">
      <div className="page-head">
        <Title>Start here</Title>
        <p className="start-lead">
          Parity asks one question: can a trading strategy, mostly in currencies, beat simply holding the US stock
          market? We test each idea the same honest way and show what we find, including the failures.
          Everything here is research, not investment advice.
        </p>
      </div>

      <h2 className="start-h">What do you want to do?</h2>
      <div className="start-jobs">
        {JOBS.map((j) => (
          <section key={j.title} className="start-job">
            <h3><Icon name={j.icon} size={14} /> {j.title}</h3>
            <ul>
              {j.pages.map((href) => {
                const p = pageByHref[href];
                return p && (
                  <li key={href}>
                    <a href={href}>{p.title}</a>
                    <span className="muted small">{p.what}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      <h2 className="start-h">How to read a result</h2>
      <p className="muted start-note">Every result is shown after trading costs, over the full history of the run. Hover any underlined word for its meaning.</p>
      <div className="start-table" role="table" aria-label="The five numbers on every strategy">
        <div className="start-row head" role="row"><span role="columnheader">Number</span><span role="columnheader">What it means</span><span role="columnheader">What good looks like</span></div>
        {NUMBERS.map((n) => (
          <div key={n.term} className="start-row" role="row">
            <strong role="cell"><Term id={n.term}>{n.name}</Term></strong>
            <span role="cell">{n.plain}</span>
            <span role="cell" className="muted">{n.good(bench)}</span>
          </div>
        ))}
      </div>

      <h2 className="start-h">What the verdicts mean</h2>
      <p className="muted start-note">
        The gauntlet is the same set of tests every strategy goes through: does it beat the market, does it survive
        costs, does it work in different periods and with different settings.
      </p>
      <ul className="start-verdicts">
        {VERDICTS.map((v) => <li key={v.label}><Badge tone={v.tone}>{v.label}</Badge> <span>{v.plain}</span></li>)}
      </ul>

      <h2 className="start-h">Exploratory or official?</h2>
      <p className="start-note">
        Most numbers come from the nightly <strong>exploratory</strong> run: useful for learning, not proof. A result
        is <strong>official</strong> only when its test was written down before it ran and the run is sealed in the{" "}
        <a href="#/ledger">official record</a>. The run picker at the top right shows which one you are looking at.
      </p>

      <p className="start-note">
        Press <kbd>/</kbd> anywhere to search. You can type a page, a strategy, a word, or a question like
        "what is carry" or "best strategy".
      </p>
    </div>
  );
}
