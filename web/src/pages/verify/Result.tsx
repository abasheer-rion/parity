// Verify's result: the verdict, the sentence that explains it, what the record was, and
// the five cards. Every number carries a one-line explanation on hover or tap (REF-0016,
// acceptance test 10).
import { createContext, useContext, type ReactNode } from "react";
import { breakEvenAt, survivesText, VERDICT_TONE, type CheckRow, type Result } from "../../lib/verify/checks";
import { explain } from "../../lib/verify/explain";
import { shortDate } from "../../lib/verify/parse";
import { Badge, KeyValues, MINUS, Panel, Tooltip } from "../../ui";
import { termById } from "../../lib/glossary";
import { HoldupSection } from "../../components/holdup/HoldupSection";

/** On the public badge page (/v/<id>) links go to the public glossary and lessons, not into the app. */
export const PublicLinks = createContext(false);

/** A glossary link that previews on hover, like the Learn page's Term, without loading the docs bundle. */
function Term({ id, children }: { id: string; children: ReactNode }) {
  const pub = useContext(PublicLinks);
  if (!termById[id]) return <>{children}</>;
  return pub ? <a className="term-link" href={`/learn/${id}/`}>{children}</a> : <a className="term-link" href={`#/learn/${id}`} data-term={id}>{children}</a>;
}

function useLesson(): string {
  return useContext(PublicLinks) ? "/learn/academy/win-rate-is-not-profit/the-99-percent-bot/" : "#/academy/win-rate-is-not-profit/the-99-percent-bot";
}

/** A number with its explanation: hover, focus or tap shows the line. */
export function Num({ id, children }: { id: string; children: ReactNode }) {
  const text = explain(id);
  return (
    <Tooltip text={text}>
      <span className="vf-num" tabIndex={0} data-explain={text} aria-label={`${typeof children === "string" ? children : ""}. ${text}`.replace(/^\. /, "")}>{children}</span>
    </Tooltip>
  );
}

const minus = (s: string) => s.replace(/^-/, MINUS);
export const pct = (v: number | null | undefined, d = 1) => (v == null || !Number.isFinite(v) ? "n/a" : minus(`${(v * 100).toFixed(d)}%`));
export const money = (v: number | null | undefined) => {
  if (v == null || !Number.isFinite(v)) return "n/a";
  const a = Math.abs(v);
  return minus(`${v < 0 ? "-" : ""}${a >= 1000 ? a.toLocaleString("en-US", { maximumFractionDigits: 0 }) : a.toFixed(2)}`);
};
const dec = (v: number | null | undefined, d = 2) => (v == null || !Number.isFinite(v) ? "n/a" : minus(v.toFixed(d)));
const int = (v: number | null | undefined) => (v == null ? "n/a" : v.toLocaleString("en-US"));

const KIND_TEXT = { real: "Real money (as you told us)", demo: "Demo account (as you told us)", backtest: "Backtest (as you told us)" } as const;

export function ResultView({ r, children }: { r: Result; children?: ReactNode }) {
  const lesson = useLesson();
  // The public badge page states the disclaimer once, in its footer.
  const pub = useContext(PublicLinks);
  const tone = VERDICT_TONE[r.verdict.id];
  const per = r.card1?.basis === "trade" ? "trade" : "period";
  const fmtResult = per === "trade" ? money : (v: number | null | undefined) => pct(v, 2);
  return (
    <section className="vf-result" aria-labelledby="vf-verdict">
      <div className={`vf-verdict vf-tone-${tone}`}>
        <h2 id="vf-verdict" className="vf-verdict-label">{r.verdict.label}</h2>
        <p className="vf-sentence" data-testid="verdict-sentence">{r.verdict.sentence}</p>
        <ul className="vf-meta">
          <li>{r.source === "file" ? KIND_TEXT[r.kind] : r.source === "strategy" ? "Backtest from our research" : "A description, not a record"}</li>
          <li>{r.what}</li>
          {r.dateFrom && r.dateTo && <li><Num id="dates">{`${shortDate(r.dateFrom)} to ${shortDate(r.dateTo)}`}</Num></li>}
          {r.trades != null && <li><Num id="trades">{`${int(r.trades)} trades`}</Num></li>}
          {r.source !== "description" && <li><Num id="tries">{`${int(r.tries)} ${r.tries === 1 ? "try" : "tries"}`}</Num></li>}
          <li><Num id="method">{`Method ${r.methodVersion}`}</Num></li>
        </ul>
        {r.triesDefaulted && r.source === "file" && <p className="vf-warn">You told us this was the only thing you tried. If other bots or settings came first, enter how many: the luck check depends on it.</p>}
        {r.gauntlet && <p className="vf-note">Our research verdict for this strategy: {r.gauntlet.verdict} It passed <Num id="gauntlet">{`${r.gauntlet.passed} of ${r.gauntlet.total}`}</Num> tests.</p>}
        {r.notes.map((n) => <p key={n} className="vf-note">{n}</p>)}
        {!pub && <p className="vf-disclaimer">Research and education only. Not investment advice. The verdict describes this record and makes no forecast.</p>}
      </div>

      {children}

      <div className="vf-cards">
        <Panel title="1. Win rate against expectancy">
          {r.card1 ? (
            <>
              <KeyValues cols={2} items={[
                [r.card1.basis === "trade" ? "Win rate" : "Share of up periods", <Num id="winRate">{pct(r.card1.winRate)}</Num>],
                [<Term id="expectancy">{r.card1.basis === "trade" ? "Expectancy per trade" : "Average per period"}</Term>, <Num id="expectancy">{fmtResult(r.card1.expectancy)}</Num>],
                ["Average win", <Num id="avgWin">{fmtResult(r.card1.avgWin)}</Num>],
                ["Average loss", <Num id="avgLoss">{fmtResult(r.card1.avgLoss)}</Num>],
                ["Payoff ratio", <Num id="payoff">{dec(r.card1.payoff)}</Num>],
                ["Break-even win rate", <Num id="breakEven">{pct(r.card1.breakEven)}</Num>],
                ["Profit factor", <Num id="profitFactor">{dec(r.card1.profitFactor)}</Num>],
                [r.card1.basis === "trade" ? "Per trade, of balance" : "Results", r.card1.basis === "trade"
                  ? <Num id="expectancyPct">{pct(r.card1.expectancyPct, 3)}</Num> : <Num id="n">{int(r.card1.n)}</Num>],
              ]} />
              <BreakEvenChart winRate={r.card1.winRate} payoff={r.card1.payoff} />
              <p className="vf-small">A high win rate can still lose money. The record makes money only if its point sits above the curve. <a href={lesson}>The 99% bot lesson</a> shows why.</p>
            </>
          ) : r.description ? <ClaimOnly r={r} /> : <p className="vf-small">Cannot be checked from this input.</p>}
        </Panel>

        <Panel title="2. Tail risk">
          {r.card2 ? (
            <>
              <KeyValues cols={2} items={[
                ["Worst trade", r.card2.worstTrade != null ? <Num id="worstTrade">{money(r.card2.worstTrade)}</Num> : <Num id="worstDayPct">{pct(r.card2.worstDayPct, 2)}</Num>],
                [r.card2.worstTrade != null ? "Worst trade, of account" : "Worst period", r.card2.worstTrade != null ? <Num id="worstTradePct">{pct(r.card2.worstTradePct, 2)}</Num> : <Num id="es5">{pct(r.card2.es5, 2)}</Num>],
                ["Worst day", <Num id="worstDayPct">{pct(r.card2.worstDayPct, 2)}</Num>],
                ["Wins wiped out by the worst loss", <Num id="winsWipedOut">{dec(r.card2.winsWipedOut, 1)}</Num>],
                [<Term id="drawdown">Largest fall from a high</Term>, <Num id="maxDrawdown">{pct(r.card2.maxDrawdown)}</Num>],
                ["Longest time under water", <Num id="underwater">{r.card2.longestUnderwaterDays == null ? "n/a" : `${int(r.card2.longestUnderwaterDays)} days`}</Num>],
                ["Expected shortfall (5%)", <Num id="es5">{pct(r.card2.es5, 2)}</Num>],
                [`Skew (${r.card2.skewBasis === "trade" ? "per trade" : r.card2.skewBasis === "daily" ? "daily" : "per period"})`, <Num id="skew">{dec(r.card2.skew)}</Num>],
              ]} />
              <p className="vf-small">
                Martingale or grid: {!r.card2.martingale.checkable ? "cannot be checked from this input (the file has no position sizes)."
                  : r.card2.martingale.found ? <strong className="vf-bad">found.</strong> : "not found."}
                {r.card2.martingale.checkable && <> Size grew after losses in <Num id="streaks">{`${r.card2.martingale.grew} of ${r.card2.martingale.streaks}`}</Num> losing streaks; positions added while losing: <Num id="adds">{int(r.card2.martingale.adds)}</Num>.</>}
              </p>
              <p className={`vf-flag ${r.card2.red ? "vf-flag-red" : ""}`}>{r.card2.red ? `Red flag: ${r.card2.reasons.join("; ")}.` : "No red flag: the worst loss is under 20 average wins, no martingale, and the fall from a high is under 50%."}</p>
            </>
          ) : <ClaimTail r={r} />}
        </Panel>

        <Panel title="3. The luck check">
          {r.card3 ? (
            <>
              <p className="vf-big"><Num id="survives">{survivesText(r.card3.survives)}</Num></p>
              <KeyValues cols={2} items={[
                [<Term id="deflated-sharpe-ratio">{`Luck check at ${int(r.card3.tries)} ${r.card3.tries === 1 ? "try" : "tries"}`}</Term>, <Num id="dsr">{r.card3.dsr == null ? "n/a" : `${r.card3.dsr.toFixed(3)} (0.95 needed)`}</Num>],
                [r.card3.basis === "trade" ? "Sharpe per trade" : "Sharpe per year", r.card3.basis === "trade" ? <Num id="sharpe">{dec(r.card3.sharpe, 3)}</Num> : <Num id="sharpeAnnual">{dec(r.card3.sharpeAnnual)}</Num>],
                [r.card3.basis === "trade" ? "Trades used" : `${r.card3.basis[0].toUpperCase()}${r.card3.basis.slice(1)} returns used`, <Num id="observations">{int(r.card3.observations)}</Num>],
                ["More months needed to pass", <Num id="monthsMore">{r.card3.monthsMore == null ? "n/a" : r.card3.monthsMore === 0 ? "0, it passes" : Number.isFinite(r.card3.monthsMore) && r.card3.monthsMore > 0 ? `${int(Math.ceil(r.card3.monthsMore))}` : "Never, at this Sharpe"}</Num>],
              ]} />
              <p className="vf-small">For an upload we do not know how much the tries differed, so we use the same single-estimate stand-in as our own research. The pass mark is 0.95, as in our own tests.</p>
            </>
          ) : <p className="vf-small">Cannot be checked from this input: a description has no returns. The closest strategies we tested, below, show their own luck checks.</p>}
        </Panel>

        <Panel title="4. Look-ahead and data flags"><CheckList rows={r.card4} /></Panel>
        <Panel title="5. Overfitting flags"><CheckList rows={r.card5} /></Panel>

        {r.claims.length > 0 && (
          <Panel title="Claim arithmetic">
            <ul className="vf-checks">
              {r.claims.map((c) => <li key={c.id}><StatusPill status={c.status === "fail" ? "fail" : c.status === "warn" ? "warn" : "pass"} /><span>{c.text}</span></li>)}
            </ul>
          </Panel>
        )}
      </div>

      {!pub && r.holdup !== undefined && r.source !== "description" && (
        <HoldupSection holdup={r.holdup} name={r.source === "strategy" ? r.what : "Your record"} level={2} id="vf-holds-up"
          intro={r.source === "strategy" && r.holdup
            ? <>From our research run, on {r.holdup.sources.strategy.n?.toLocaleString("en-US")} days of daily returns, allowing for the {r.holdup.luck.n_trials.toLocaleString("en-US")} strategies in that run. The luck check above also counts the search's tries.</>
            : r.holdup ? <>Built in this browser from the record's {r.holdup.sources.strategy.n?.toLocaleString("en-US")} daily returns, allowing for the {r.tries.toLocaleString("en-US")} {r.tries === 1 ? "try" : "tries"} you entered. An upload has no market series beside it, so the market comparisons are left out.</> : undefined}
          missing={r.source === "strategy" ? "This research run was published before these checks were added." : "These checks need at least 30 days of daily returns: upload an equity curve, or a trade list with a starting balance."} />
      )}
    </section>
  );
}

function ClaimOnly({ r }: { r: Result }) {
  const c = r.description!.claim;
  return (
    <p className="vf-small">
      Verify checks the description only. {c.winRate != null ? <>Claimed win rate <Num id="winRate">{pct(c.winRate)}</Num>. </> : null}
      The claim arithmetic below shows what the claimed numbers need in order to add up.
    </p>
  );
}

function ClaimTail({ r }: { r: Result }) {
  const c = r.description?.claim;
  if (!c) return <p className="vf-small">Cannot be checked from this input.</p>;
  return (
    <p className="vf-small">
      {c.martingale || c.grid ? `The description says it ${c.martingale ? "adds to losing positions (martingale)" : "trades a grid"}${c.maxLossCapped || c.maxLoss != null || c.stopLoss != null ? ", with a stated limit on losses." : ", with no stated limit on losses: a red flag."}` : "Nothing in the description says it adds to losers."}
      {c.maxDrawdown != null && <> Claimed largest fall: <Num id="maxDrawdown">{pct(c.maxDrawdown)}</Num>.</>}
    </p>
  );
}

const STATUS_TEXT = { pass: "Passed", fail: "Failed", na: "Cannot be checked", warn: "Check this" } as const;

function StatusPill({ status }: { status: "pass" | "fail" | "na" | "warn" }) {
  return <Badge tone={status === "pass" ? "good" : status === "fail" ? "bad" : status === "warn" ? "accent" : "neutral"}>{STATUS_TEXT[status]}</Badge>;
}

function CheckList({ rows }: { rows: CheckRow[] }) {
  return (
    <ul className="vf-checks">
      {rows.map((c) => (
        <li key={c.id}>
          <StatusPill status={c.status} />
          <span><strong>{c.label}.</strong> {c.detail}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Card 1's chart: the break-even curve (win rate needed at each payoff ratio) on a log
 * scale, with the record as a point. Above the curve makes money, below it loses.
 */
export function BreakEvenChart({ winRate, payoff }: { winRate: number; payoff: number | null }) {
  const W = 360, H = 200, L = 40, R = 12, T = 12, B = 30;
  const p = payoff && payoff > 0 ? payoff : null;
  const lo = Math.min(0.2, p ? p / 3 : 0.2), hi = Math.max(5, p ? p * 3 : 5);
  const lx = (v: number) => L + ((Math.log10(v) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo))) * (W - L - R);
  const ly = (w: number) => T + (1 - w) * (H - T - B);
  const pts: string[] = [];
  for (let i = 0; i <= 60; i++) {
    const v = 10 ** (Math.log10(lo) + (i / 60) * (Math.log10(hi) - Math.log10(lo)));
    pts.push(`${lx(v).toFixed(1)},${ly(breakEvenAt(v)).toFixed(1)}`);
  }
  const curve = `M${pts.join("L")}`;
  const above = `${curve}L${W - R},${T}L${L},${T}Z`;
  const below = `${curve}L${W - R},${H - B}L${L},${H - B}Z`;
  const ticks = [0.01, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200].filter((v) => v >= lo * 0.999 && v <= hi * 1.001);
  const label = p ? `Win rate ${pct(winRate)} at a payoff ratio of ${p.toFixed(2)}, against ${pct(breakEvenAt(p))} needed to break even.` : "No payoff ratio: the record has no losing or no winning results.";
  return (
    <figure className="vf-chart">
      <Tooltip text={explain("chart")}>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} tabIndex={0} className="vf-num" data-explain={explain("chart")}>
          <path d={above} className="vf-zone-good" />
          <path d={below} className="vf-zone-bad" />
          {[0, 0.25, 0.5, 0.75, 1].map((w) => (
            <g key={w}>
              <line x1={L} x2={W - R} y1={ly(w)} y2={ly(w)} className="vf-grid" />
              <text x={L - 6} y={ly(w) + 3} textAnchor="end" className="vf-axis">{`${w * 100}%`}</text>
            </g>
          ))}
          {ticks.map((v) => <text key={v} x={lx(v)} y={H - B + 14} textAnchor="middle" className="vf-axis">{v}</text>)}
          <text x={(L + W - R) / 2} y={H - 2} textAnchor="middle" className="vf-axis">Payoff ratio (average win / average loss)</text>
          <path d={curve} className="vf-curve" />
          <text x={W - R - 4} y={T + 12} textAnchor="end" className="vf-zone-label">makes money</text>
          <text x={L + 6} y={H - B - 6} className="vf-zone-label">loses money</text>
          {p && <circle cx={lx(Math.min(Math.max(p, lo), hi))} cy={ly(winRate)} r={5} className={winRate >= breakEvenAt(p) ? "vf-dot-good" : "vf-dot-bad"} />}
        </svg>
      </Tooltip>
      <figcaption className="vf-small">{label}</figcaption>
    </figure>
  );
}
