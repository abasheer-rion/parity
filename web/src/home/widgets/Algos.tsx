// New algos (DEC-0075): the newest entries in the algorithm library and the newest registered
// tests, newest first. Each says how far our own research has got with it, never how much it
// might make.
import { algorithms, registrations, STAGES } from "../../lib/catalog";
import { researchUrl } from "../../lib/space";
import { Src } from "./common";

const STAGE_WORD: Record<string, string> = {
  catalogued: "Written up", sourced: "Data found", hypothesis: "Question written", implemented: "Coded",
  registered: "Test registered", official: "Official run", reproduced: "Reproduced", forward: "Running forward", verdict: "Verdict in",
};

export default function Algos() {
  const algos = [...algorithms].sort((a, b) => b.id.localeCompare(a.id)).slice(0, 4);
  const regs = [...registrations].sort((a, b) => (b.created ?? "").localeCompare(a.created ?? "")).slice(0, 2);
  return (
    <>
      <ul className="wl">
        {algos.map((a) => (
          <li key={a.id} className="wl-row">
            <a href={researchUrl(`#/algo/${a.slug}`)}><b>{a.name}</b></a>
            <span className="wl-sub">{a.family}. {STAGE_WORD[STAGES[a.research.stage - 1] ?? ""] ?? "Written up"}. {a.reported_results.length} published result{a.reported_results.length === 1 ? "" : "s"} to check.</span>
          </li>
        ))}
        {regs.map((r) => (
          <li key={r.id} className="wl-row">
            <a href={researchUrl(`#/docs`)}><b>{r.title}</b></a>
            <span className="wl-sub">Test registered {r.created}, {r.strategies.length} strateg{r.strategies.length === 1 ? "y" : "ies"}, {r.prior_trials} earlier tries counted.</span>
          </li>
        ))}
      </ul>
      <Src>From the algorithm library and the test register. <a href={researchUrl("#/catalog")}>All ideas</a></Src>
    </>
  );
}
