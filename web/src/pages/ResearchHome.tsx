// Research home: where the research stands. The question and today's answer, the
// official record, the always-on search, open hypotheses and recent decisions, and
// whether the data is healthy. Nothing about product use appears on this side
// (DEC-0015): research is judged on evidence, not on what people click.
import { useEffect, useState } from "react";
import { Badge, CountUp, HeroGlow, LIFT, PageTransition, Reveal } from "../ui";
import { ledger } from "../lib/catalog";
import { useDocs } from "../lib/docs";
import { date, num } from "../lib/format";
import { loadSearch, type SearchDoc } from "../lib/data";
import { nameOf, verdictOf } from "../lib/strategyMeta";
import type { Report } from "../lib/types";

export function ResearchHome({ report }: { report: Report }) {
  const docs = useDocs();
  const [search, setSearch] = useState<SearchDoc | null>(null);
  useEffect(() => { loadSearch().then(setSearch).catch(() => setSearch(null)); }, []);

  const tested = report.runs.filter((r) => !r.is_benchmark);
  const counts: Record<string, number> = {};
  for (const r of tested) { const l = verdictOf(r).label; counts[l] = (counts[l] ?? 0) + 1; }
  const beating = tested.filter((r) => r.gauntlet?.beats_sp500);
  const closest = [...tested].filter((r) => r.gauntlet).sort((a, b) => (b.gauntlet!.passed - a.gauntlet!.passed) || ((b.metrics.deflated_sharpe ?? 0) - (a.metrics.deflated_sharpe ?? 0))).slice(0, 5);
  const official = [...ledger].reverse().slice(0, 4);
  const hypotheses = docs?.docs.filter((d) => d.type === "hypothesis") ?? [];
  const open = hypotheses.filter((d) => !["supported", "rejected", "superseded"].includes(d.status));
  const recent = docs ? [...docs.docs].filter((d) => d.type === "decision" || d.type === "experiment" || d.type === "research")
    .sort((a, b) => b.updated.localeCompare(a.updated) || b.id.localeCompare(a.id)).slice(0, 5) : [];
  const stale = (report.coverage?.series ?? []).filter((s) => !s.ok).length;

  return (
    <PageTransition className="rhome">
      <section className="rq">
        <HeroGlow />
        <div className="eyebrow">The question</div>
        <h1>Can a trading strategy beat simply holding the US stock market, after costs and after counting every idea we tried?</h1>
        <p className="answer">
          <strong>{beating.length === 0 ? "Not yet." : `${beating.length} so far.`}</strong>{" "}
          {tested.length} strategies tested in the {report.kind === "official" ? "official" : "nightly exploratory"} run of {date(report.generated_at)}
          {search ? `, and ${search.trials.toLocaleString()} variations tried by the search` : ""}.
        </p>
        <div className="verdict-bar" aria-label="Verdicts">
          {["Passed", "Promising", "Not proven", "Not tested"].map((l, i) => counts[l] ? (
            <span key={l} data-i={i} className={`seg-${l.replace(" ", "-").toLowerCase()}`} style={{ flex: counts[l] }} title={`${l}: ${counts[l]}`}>{l} {counts[l]}</span>
          ) : null)}
        </div>
      </section>

      <div className="rgrid">
        <Reveal as="section" delay={0} className={`pcard ${LIFT}`}>
          <div className="pcard-head"><h2>Closest to an answer</h2><a href="/app/#/strategies">All strategies</a></div>
          <ul className="rlist">
            {closest.map((r) => (
              <li key={r.strategy}>
                <a href={`/app/#/strategy/${r.strategy}`}>{nameOf(r)}</a>
                <span className="muted small">{r.gauntlet!.passed} of {r.gauntlet!.total} tests · luck check {num(r.metrics.deflated_sharpe)}</span>
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal as="section" delay={50} className={`pcard ${LIFT}`}>
          <div className="pcard-head"><h2>Official record</h2><a href="#/ledger">Open</a></div>
          <p className="muted small">Only these runs count as results. Each was written down before it ran.</p>
          <ul className="rlist">
            {official.map((e) => (
              <li key={e.seq}>
                <span>{e.run_id} <span className="muted small">({e.registration})</span></span>
                <span className="muted small">{date(e.recorded_at)} · {e.trials_counted} trials counted</span>
              </li>
            ))}
            {!official.length && <li className="muted small">No official runs yet.</li>}
          </ul>
        </Reveal>

        <Reveal as="section" delay={100} className={`pcard ${LIFT}`}>
          <div className="pcard-head"><h2>Strategy search</h2><a href="#/search">Open</a></div>
          {search ? (
            <>
              <div className="big-num"><CountUp value={search.trials} format={(v) => Math.round(v).toLocaleString()} /> <span className="muted small">tried</span></div>
              <p className="muted small">{search.passed_luck_check} pass the luck check, {search.beat_market} beat the market's Sharpe. Leads only, until registered and run officially.</p>
              <ul className="rlist">{search.rows.slice(0, 3).map((r) => <li key={r.id}><span>{r.name}</span><span className="muted small">luck check {num(r.deflated)}</span></li>)}</ul>
            </>
          ) : <p className="muted small">The search has not sent results yet.</p>}
        </Reveal>

        <Reveal as="section" delay={150} className={`pcard ${LIFT}`}>
          <div className="pcard-head"><h2>Open hypotheses</h2><a href="#/docs/type/hypothesis">All</a></div>
          <ul className="rlist">
            {open.slice(0, 5).map((d) => <li key={d.id}><a href={`#/doc/${d.id}`} data-doc={d.id}>{d.title}</a><Badge>{d.status}</Badge></li>)}
            {docs && !open.length && <li className="muted small">None open.</li>}
          </ul>
        </Reveal>

        <Reveal as="section" delay={200} className={`pcard ${LIFT}`}>
          <div className="pcard-head"><h2>Recent decisions and findings</h2><a href="#/docs">Docs</a></div>
          <ul className="rlist">
            {recent.map((d) => <li key={d.id}><a href={`#/doc/${d.id}`} data-doc={d.id}>{d.title}</a><span className="muted small">{d.id} · {d.updated}</span></li>)}
          </ul>
        </Reveal>

        <Reveal as="section" delay={250} className={`pcard ${LIFT}`}>
          <div className="pcard-head"><h2>Data</h2><a href="#/data">Health</a></div>
          <div className="big-num">{stale === 0 ? "Healthy" : `${stale} problem${stale > 1 ? "s" : ""}`}</div>
          <p className="muted small">{report.coverage?.series?.length ?? 0} series behind this run, fetched {date(report.coverage?.fetched_at ?? null)}.</p>
        </Reveal>
      </div>
      <p className="muted small phome-foot">This side makes the results. The product side only shows them, with their verdicts. <a href="#/how">How Parity works</a>.</p>
    </PageTransition>
  );
}
