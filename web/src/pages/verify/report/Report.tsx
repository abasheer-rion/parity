// The Verify report (DEC-0089): one page for every check, whether it came from a trade file,
// strategy code, one of our strategies, a seller's claim or a row of a batch screen. In
// order: the verdict in one sentence, the numbers that decided it, what the seller claims,
// the record's pictures, the five checks, what was used and what could not be checked.
// Every number explains itself on hover or tap. It draws only from ReportData, so the live
// page, a shared link, the PDF and the comparison show the same thing.
import { useContext, useMemo, type ReactNode } from "react";
import { survivesText, VERDICT_TONE, type CheckRow, type Result } from "../../../lib/verify/checks";
import { keyNumbers, type ReportData } from "../../../lib/verify/report/model";
import { termById } from "../../../lib/glossary";
import { Badge, KeyValues, Panel, Reveal } from "../../../ui";
import { Num, PublicLinks } from "../Num";
import { ReportActions } from "./Actions";
import { BreakEvenChart } from "./BreakEven";
import { ReportCharts } from "./Charts";
import { ClaimsSection, type ClaimsLive } from "./Claims";
import { dec, int, money, pct } from "./format";
import { Printing, usePrinting } from "./print";
import "./report.css";
import { count } from "../../../lib/verify/words";

const LESSON = { app: "#/academy/win-rate-is-not-profit/the-99-percent-bot", pub: "/learn/academy/win-rate-is-not-profit/the-99-percent-bot/" };

/** A glossary link that previews on hover in the app, and goes to the public glossary elsewhere. */
function Term({ id, children }: { id: string; children: ReactNode }) {
  const pub = useContext(PublicLinks);
  if (!termById[id]) return <>{children}</>;
  return pub ? <a className="term-link" href={`/learn/${id}/`}>{children}</a> : <a className="term-link" href={`#/learn/${id}`} data-term={id}>{children}</a>;
}

const SOURCE_TEXT = { file: null, strategy: "Backtest from our research", code: "A backtest we ran on our prices", description: "A claim, not a record" } as const;
const KIND_TEXT = { real: "Real money (as you told us)", demo: "Demo account (as you told us)", backtest: "Backtest (as you told us)" } as const;
const STATUS_TEXT = { pass: "Passed", fail: "Failed", na: "Cannot be checked", warn: "Check this" } as const;
const shortDate = (d: string) => d.slice(0, 10);

function StatusPill({ status }: { status: "pass" | "fail" | "na" | "warn" }) {
  return <Badge tone={status === "pass" ? "good" : status === "fail" ? "bad" : status === "warn" ? "accent" : "neutral"}>{STATUS_TEXT[status]}</Badge>;
}

function CheckList({ rows }: { rows: CheckRow[] }) {
  return (
    <ul className="vf-checks">
      {rows.map((c) => <li key={c.id}><StatusPill status={c.status} /><span><strong>{c.label}.</strong> {c.detail}</span></li>)}
    </ul>
  );
}

export interface ReportProps {
  data: ReportData;
  /** The live result, when there is one: claims are compared with it directly. */
  result?: Result | null;
  /** Opened from a shared link: the page says Parity did not store or check the link. */
  shared?: boolean;
  /** False on a published badge's page, whose own address is the link. */
  linkable?: boolean;
  signedOut?: boolean;
  /** The claims section's live actions (attach a file, ask the person's own model). */
  claimsLive?: ClaimsLive;
  /** Shown under the verdict: what we ran, for strategy code. */
  ran?: ReactNode;
  /** Shown after the claims: the closest strategies, the share step. */
  children?: ReactNode;
  /** Shown at the end: the full "how it holds up" section, for a live check. */
  more?: ReactNode;
}

export function Report({ data: d, result, shared = false, linkable = true, signedOut = false, claimsLive, ran, children, more }: ReportProps) {
  const pub = useContext(PublicLinks);
  const [printing, print] = usePrinting();
  const tone = VERDICT_TONE[d.verdict.id];
  const keys = useMemo(() => keyNumbers(d), [d]);
  const lesson = pub ? LESSON.pub : LESSON.app;
  const per = d.c1?.basis === "trade" ? "trade" : "period";
  const fmtResult = per === "trade" ? money : (v: number | null | undefined) => pct(v, 2);
  return (
    <Printing.Provider value={printing}>
      <section className="vf-result rp" aria-labelledby="vf-verdict" data-printing={printing || undefined}>
        <div className={`rp-hero vf-verdict vf-tone-${tone}`}>
          <h2 id="vf-verdict" className="vf-verdict-label rp-verdict">{d.verdict.label}</h2>
          <p className="vf-sentence rp-sentence" data-testid="verdict-sentence">{d.verdict.sentence}</p>
          <ul className="vf-meta">
            <li>{d.source === "file" ? KIND_TEXT[d.kind] : SOURCE_TEXT[d.source]}</li>
            {d.source !== "description" && <li>{d.what}</li>}
            {d.dateFrom && d.dateTo && <li><Num id="dates">{`${shortDate(d.dateFrom)} to ${shortDate(d.dateTo)}`}</Num></li>}
            {d.trades != null && <li><Num id="trades">{count(d.trades, "trade")}</Num></li>}
            {d.source !== "description" && <li><Num id="tries">{`${int(d.tries)} ${d.tries === 1 ? "try" : "tries"}`}</Num></li>}
            <li><Num id="method">{`Method ${d.method}`}</Num></li>
          </ul>
          {d.triesDefaulted && d.source === "file" && <p className="vf-warn">You told us this was the only thing you tried. If other bots or settings came first, enter how many: the luck check depends on it.</p>}
          {d.gauntlet && <p className="vf-note">Our research verdict for this strategy: {d.gauntlet.verdict} It passed <Num id="gauntlet">{`${d.gauntlet.passed} of ${d.gauntlet.total}`}</Num> tests.</p>}
          {d.screen && <p className="vf-note">Account {d.screen.account} in the batch screen: {d.screen.verdict.toLowerCase()} ({d.screen.method}). {d.screen.reason} This report uses Verify's own method, which asks more of a record: 100 trades and 12 months for the short-sample check.</p>}
          {shared && <p className="rp-shared" role="note">Shared by link. The report is inside the link; Parity did not store it and cannot vouch that nobody changed it. To be sure, run the check again on the record, or ask for a published badge.</p>}
          <ReportActions data={d} print={print} mode={shared ? "shared" : linkable ? "live" : "badge"} />
          {!pub && <p className="vf-disclaimer">Research and education only. Not investment advice. The verdict describes this record and makes no forecast.</p>}
        </div>

        {keys.length > 0 && (
          <dl className="rp-keys" aria-label="The numbers that decided it">
            {keys.map((k, i) => (
              <Reveal key={k.id} delay={i * 60} className={`rp-key${k.tone ? ` rp-${k.tone}` : ""}`}>
                <dt>{k.label}</dt>
                <dd><Num id={k.id}>{k.value}</Num></dd>
              </Reveal>
            ))}
          </dl>
        )}

        {ran}
        {d.claims && <ClaimsSection data={d} result={result} live={claimsLive} />}
        {children}

        <ReportCharts data={d} signedOut={signedOut} />

        <section className="rp-section" aria-labelledby="rp-checks-h">
          <h2 id="rp-checks-h" className="rp-h2">The five checks</h2>
          <div className="vf-cards">
            <Panel title="1. Win rate against expectancy">
              {d.c1 ? (
                <>
                  <KeyValues cols={2} items={[
                    [d.c1.basis === "trade" ? "Win rate" : "Share of up periods", <Num id="winRate">{pct(d.c1.winRate)}</Num>],
                    [<Term id="expectancy">{d.c1.basis === "trade" ? "Expectancy per trade" : "Average per period"}</Term>, <Num id="expectancy">{fmtResult(d.c1.expectancy)}</Num>],
                    ["Average win", <Num id="avgWin">{fmtResult(d.c1.avgWin)}</Num>],
                    ["Average loss", <Num id="avgLoss">{fmtResult(d.c1.avgLoss)}</Num>],
                    ["Payoff ratio", <Num id="payoff">{dec(d.c1.payoff)}</Num>],
                    ["Break-even win rate", <Num id="breakEven">{pct(d.c1.breakEven)}</Num>],
                    ["Profit factor", <Num id="profitFactor">{dec(d.c1.profitFactor)}</Num>],
                    [d.c1.basis === "trade" ? "Per trade, of balance" : "Results", d.c1.basis === "trade" ? <Num id="expectancyPct">{pct(d.c1.expectancyPct, 3)}</Num> : <Num id="n">{int(d.c1.n)}</Num>],
                  ]} />
                  <BreakEvenChart winRate={d.c1.winRate} payoff={d.c1.payoff} />
                  <p className="vf-small">A high win rate can still lose money. The record makes money only if its point sits above the curve. <a href={lesson}>The 99% bot lesson</a> shows why.</p>
                </>
              ) : d.source === "description" ? <p className="vf-small">A claim has no trades. The claim arithmetic below shows what the claimed numbers need in order to add up.</p> : <p className="vf-small">Cannot be checked from this input.</p>}
            </Panel>

            <Panel title="2. Tail risk">
              {d.c2 ? (
                <>
                  <KeyValues cols={2} items={[
                    ["Worst trade", d.c2.worstTrade != null ? <Num id="worstTrade">{money(d.c2.worstTrade)}</Num> : <Num id="worstDayPct">{pct(d.c2.worstDayPct, 2)}</Num>],
                    [d.c2.worstTrade != null ? "Worst trade, of account" : "Worst period", d.c2.worstTrade != null ? <Num id="worstTradePct">{pct(d.c2.worstTradePct, 2)}</Num> : <Num id="es5">{pct(d.c2.es5, 2)}</Num>],
                    ["Worst day", <Num id="worstDayPct">{pct(d.c2.worstDayPct, 2)}</Num>],
                    ["Wins wiped out by the worst loss", <Num id="winsWipedOut">{dec(d.c2.winsWipedOut, 1)}</Num>],
                    [<Term id="drawdown">Largest fall from a high</Term>, <Num id="maxDrawdown">{pct(d.c2.maxDrawdown)}</Num>],
                    ["Longest time under water", <Num id="underwater">{d.c2.longestUnderwaterDays == null ? "n/a" : count(d.c2.longestUnderwaterDays, "day")}</Num>],
                    ["Expected shortfall (5%)", <Num id="es5">{pct(d.c2.es5, 2)}</Num>],
                    [`Skew (${d.c2.skewBasis === "trade" ? "per trade" : d.c2.skewBasis === "daily" ? "daily" : "per period"})`, <Num id="skew">{dec(d.c2.skew)}</Num>],
                  ]} />
                  <p className="vf-small">
                    Martingale or grid: {!d.c2.martingale.checkable ? "cannot be checked from this input (the file has no position sizes)."
                      : d.c2.martingale.found ? <strong className="vf-bad">found.</strong> : "not found."}
                    {d.c2.martingale.checkable && <> Size grew after losses in <Num id="streaks">{`${d.c2.martingale.grew} of ${d.c2.martingale.streaks}`}</Num> losing streaks; positions added while losing: <Num id="adds">{int(d.c2.martingale.adds)}</Num>.</>}
                  </p>
                  <p className={`vf-flag ${d.c2.red ? "vf-flag-red" : ""}`}>{d.c2.red ? `Red flag: ${d.c2.reasons.join("; ")}.` : "No red flag: the worst loss is under 20 average wins, no martingale, and the fall from a high is under 50%."}</p>
                </>
              ) : <p className="vf-small">{d.source === "description" ? "A claim has no losses to measure. The claim arithmetic below says whether the loss is capped." : "Cannot be checked from this input."}</p>}
            </Panel>

            <Panel title="3. The luck check">
              {d.c3 ? (
                <>
                  <p className="vf-big"><Num id="survives">{survivesText(d.c3.survives)}</Num></p>
                  <KeyValues cols={2} items={[
                    [<Term id="deflated-sharpe-ratio">{`Luck check at ${int(d.c3.tries)} ${d.c3.tries === 1 ? "try" : "tries"}`}</Term>, <Num id="dsr">{d.c3.dsr == null ? "n/a" : `${d.c3.dsr.toFixed(3)} (0.95 needed)`}</Num>],
                    [d.c3.basis === "trade" ? "Sharpe per trade" : "Sharpe per year", d.c3.basis === "trade" ? <Num id="sharpe">{dec(d.c3.sharpe, 3)}</Num> : <Num id="sharpeAnnual">{dec(d.c3.sharpeAnnual)}</Num>],
                    [d.c3.basis === "trade" ? "Trades used" : `${d.c3.basis[0].toUpperCase()}${d.c3.basis.slice(1)} returns used`, <Num id="observations">{int(d.c3.observations)}</Num>],
                    ["More months needed to pass", <Num id="monthsMore">{d.c3.monthsMore == null ? "n/a" : d.c3.monthsMore === 0 ? "0, it passes" : Number.isFinite(d.c3.monthsMore) && d.c3.monthsMore > 0 ? `${int(Math.ceil(d.c3.monthsMore))}` : "Never, at this Sharpe"}</Num>],
                  ]} />
                  <p className="vf-small">For an upload we do not know how much the tries differed, so we use the same single-estimate stand-in as our own research. The pass mark is 0.95, as in our own tests.</p>
                </>
              ) : <p className="vf-small">Cannot be checked from this input: {d.source === "description" ? "a claim has no returns." : "it needs at least 30 returns, or a trade list."}</p>}
            </Panel>

            <Panel title="4. Look-ahead and data flags"><CheckList rows={d.c4} /></Panel>
            <Panel title="5. Overfitting flags"><CheckList rows={d.c5} /></Panel>

            {d.arithmetic.length > 0 && (
              <Panel title="Claim arithmetic">
                <ul className="vf-checks">
                  {d.arithmetic.map((c) => <li key={c.id}><StatusPill status={c.status === "fail" ? "fail" : c.status === "warn" ? "warn" : "pass"} /><span>{c.text}</span></li>)}
                </ul>
              </Panel>
            )}
          </div>
        </section>

        <div className="rp-pair">
          <section className="rp-card" aria-labelledby="rp-used-h">
            <h2 id="rp-used-h" className="rp-h3">What was checked</h2>
            <dl className="rp-inputs">
              {d.inputs.map((x) => <div key={x.label}><dt>{x.label}</dt><dd>{x.label === "Method" ? <><a href="/methodology/">{d.method}</a>{x.value.slice(d.method.length)}</> : x.value}</dd></div>)}
            </dl>
            {d.description && <p className="vf-small rp-words">The words checked: <q>{d.description}</q></p>}
          </section>
          <section className="rp-card" aria-labelledby="rp-cannot-h">
            <h2 id="rp-cannot-h" className="rp-h3">What could not be checked</h2>
            {d.cannot.length ? (
              <ul className="rp-cannot">{d.cannot.map((c) => <li key={c.check}><strong>{c.check}.</strong> {c.why}</li>)}</ul>
            ) : <p className="vf-small">Every check ran on this record.</p>}
            <p className="vf-small">Where a file came from is never checked: every upload is self-reported. The <a href="/methodology/">methodology</a> lists every check and line.</p>
          </section>
        </div>

        {d.notes.length > 0 && (
          <section className="rp-card rp-notes" aria-labelledby="rp-notes-h">
            <h2 id="rp-notes-h" className="rp-h3">Notes on this record</h2>
            <ul>{d.notes.map((n) => <li key={n}>{n}</li>)}</ul>
          </section>
        )}

        {more}
      </section>
    </Printing.Provider>
  );
}
