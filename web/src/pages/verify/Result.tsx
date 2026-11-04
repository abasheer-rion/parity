// Verify's result: the report for this check (DEC-0089), built from the result and drawn by
// report/Report.tsx, with the parts only a live check has: what we ran for strategy code,
// the closest strategies, the share step and the full "how it holds up" section. Every
// number carries a one-line explanation on hover or tap (REF-0016, acceptance test 10).
import { useMemo, type ReactNode } from "react";
import type { Result } from "../../lib/verify/checks";
import { reportFrom, type ReportExtra } from "../../lib/verify/report/model";
import { Disclosure, KeyValues, Panel } from "../../ui";
import { HoldupSection } from "../../components/holdup/HoldupSection";
import type { Rules } from "../../lib/verify/strategy";
import { RulesSummary } from "./CodeInput";
import { Num } from "./Num";
import { Report } from "./report/Report";
import type { ClaimsLive } from "./report/Claims";
import { int, money, pct } from "./report/format";

export { Num, PublicLinks } from "./Num";
export { BreakEvenChart } from "./report/BreakEven";
export { money, pct } from "./report/format";

export interface ResultViewProps {
  r: Result;
  children?: ReactNode;
  /** What the report says about the inputs (prices loaded, the file's name). */
  extra?: ReportExtra;
  signedOut?: boolean;
  claimsLive?: ClaimsLive;
  /** False on a published badge's own page. */
  linkable?: boolean;
}

export function ResultView({ r, children, extra, signedOut, claimsLive, linkable }: ResultViewProps) {
  const data = useMemo(() => reportFrom(r, extra), [r, extra]);
  const more = r.holdup && r.source !== "description" ? (
    <Disclosure summary="More detail: every number behind the pictures">
      <HoldupSection holdup={r.holdup} name={r.source === "strategy" ? r.what : "Your record"} bench={r.benchmark ?? "US stock market"} level={2} id="vf-holds-up"
        intro={r.source === "strategy"
          ? <>From our research run, on {r.holdup.sources.strategy.n?.toLocaleString("en-US")} days of daily returns, allowing for the {r.holdup.luck.n_trials.toLocaleString("en-US")} strategies in that run. The luck check above also counts the search's tries.</>
          : <>Built in this browser from the record's {r.holdup.sources.strategy.n?.toLocaleString("en-US")} daily returns, allowing for the {r.tries.toLocaleString("en-US")} {r.tries === 1 ? "try" : "tries"} counted.{r.benchmark ? ` Compared with the ${r.benchmark} over the same days.` : " An upload has no market series beside it here, so the market comparisons are left out."}</>} />
    </Disclosure>
  ) : null;
  return (
    <Report data={data} result={r} signedOut={signedOut} claimsLive={claimsLive} linkable={linkable} ran={r.code ? <CodeFactsPanel r={r} /> : null} more={more}>
      {children}
    </Report>
  );
}

/** What we ran for strategy code: the market, costs, returns, the tries counted and the rules. */
function CodeFactsPanel({ r }: { r: Result }) {
  const c = r.code!;
  const sw = c.sweep;
  return (
    <Panel title="The backtest we ran">
      <div className="vf-ran">
        <KeyValues cols={2} items={[
          ["Market", `${c.marketName} (${c.market})`],
          ["Starting balance", money(c.capital)],
          ["Cost each way", `${pct(c.cost, 2)}: ${c.costWhy}`],
          ["Total return", <Num id="codeReturn">{pct(c.totalReturn)}</Num>],
          ["Filled one day later", <Num id="codeLate">{pct(c.delayedReturn)}</Num>],
          ["Buying and holding", <Num id="codeHold">{pct(c.buyHoldReturn)}</Num>],
          ["Tries counted", <Num id="tries">{`${int(c.triesStated)} stated + ${int(c.triesSweep)} nearby = ${int(r.tries)}`}</Num>],
          ["Nearby settings that make money", <Num id="codeSweep">{sw.runs > 1 ? `${pct(sw.profitable, 0)} of ${int(sw.runs)}` : "No settings to vary"}</Num>],
        ]} />
        <Disclosure summary="The rules we ran">
          <RulesSummary rules={c.rules as Rules} />
          <pre className="vf-json" tabIndex={0} aria-label="The rules as JSON">{JSON.stringify(c.rules, null, 2)}</pre>
        </Disclosure>
        {c.ignored.length > 0 && (
          <Disclosure summary={`Left out: ${c.ignored.length} part${c.ignored.length === 1 ? "" : "s"} that do not change the trades`}>
            <ul className="vf-left">{c.ignored.map((u) => <li key={`${u.what}-${u.line}`}>{u.line ? `Line ${u.line}: ` : ""}<code>{u.what}</code>, {u.why}</li>)}</ul>
          </Disclosure>
        )}
        <p className="vf-small">Prices: {c.priceSource}. Overnight financing, borrowing to sell short and funding on perpetual futures are not charged.</p>
      </div>
    </Panel>
  );
}
