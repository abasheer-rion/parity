// The batch screen's report (DEC-0087): the firm summary, which firm rules would have caught
// the passers that look like luck, the back-test when outcomes are known, and one row per
// account. Used by the screen at /business/screen/ and the sample at /business/prop-firms/sample/.
// Download as CSV, or print (the print styles in business.css make it a plain report).
import { useMemo, useState } from "react";
import type { Backtest, Rate } from "../lib/screen/backtest";
import { resultsCsv } from "../lib/screen/export";
import type { AccountFills } from "../lib/screen/fills";
import { SCREEN_LABEL, VERDICT_ORDER, type AccountResult, type ScreenVerdict, type Summary } from "../lib/screen/score";
import { LUCK_LINE } from "../lib/verify/dsr";

const pct = (v: number | null | undefined, d = 0) => (v == null ? "n/a" : `${(v * 100).toFixed(d)}%`);
const n = (v: number) => v.toLocaleString("en-US");
/** A share of the profit; over 100% when the rest of the record lost money. */
const share = (v: number | null) => (v == null ? "n/a" : v > 1 ? "over 100%" : pct(v));
const ci = (r: Rate) => (r.lo == null ? "" : `95% interval ${pct(r.lo)} to ${pct(r.hi)}`);
const money = (v: number) => v.toLocaleString("en-US", { maximumFractionDigits: 0 });

type SortKey = "id" | "verdict" | "trades" | "dsr" | "survives" | "maxDrawdown" | "top5Share" | "bestDayShare" | "returnPct";
const COLS: { key: SortKey; label: string; num?: boolean }[] = [
  { key: "id", label: "Account" }, { key: "verdict", label: "Verdict" }, { key: "trades", label: "Trades", num: true },
  { key: "returnPct", label: "Return", num: true }, { key: "dsr", label: "Luck check", num: true }, { key: "survives", label: "Tries survived", num: true },
  { key: "maxDrawdown", label: "Worst fall", num: true }, { key: "top5Share", label: "Best 5 trades", num: true }, { key: "bestDayShare", label: "Best day", num: true },
];

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Kpi({ value, label, note, tone }: { value: string; label: string; note?: string; tone?: "luck" | "good" | "blue" }) {
  return <li className={`bz-kpi${tone ? ` ${tone}` : ""}`}><b>{value}</b><span>{label}</span>{note ? <small>{note}</small> : null}</li>;
}

export function Verdict({ v }: { v: ScreenVerdict }) {
  return <span className={`bz-v ${v}`}><i aria-hidden="true" />{SCREEN_LABEL[v]}</span>;
}

function BacktestPanel({ bt }: { bt: Backtest }) {
  return (
    <section className="bz-panel" aria-labelledby="bt-h">
      <h2 id="bt-h">How well the screen predicted what happened</h2>
      <p>
        {n(bt.n)} accounts with a known outcome and enough trades to judge. "Blew up" and "payout" come from your outcomes column. Each rate has a 95%
        Wilson interval: the range the true rate is likely in, given how many accounts there are.
      </p>
      <ul className="bz-kpis">
        <Kpi tone="luck" value={pct(bt.hitRate.p)} label={`of accounts flagged likely luck later blew up (${n(bt.tp)} of ${n(bt.tp + bt.fp)})`} note={ci(bt.hitRate)} />
        <Kpi tone="good" value={pct(bt.holdsBlowup.p)} label={`of accounts that hold up later blew up (${n(bt.fn)} of ${n(bt.fn + bt.tn)})`} note={ci(bt.holdsBlowup)} />
        <Kpi tone="blue" value={pct(bt.caught.p)} label={`of the blow-ups were flagged likely luck (${n(bt.tp)} of ${n(bt.tp + bt.fn)})`} note={ci(bt.caught)} />
        <Kpi value={pct(bt.falseAlarms.p)} label={`of the payouts were flagged likely luck: the false alarms (${n(bt.fp)} of ${n(bt.fp + bt.tn)})`} note={ci(bt.falseAlarms)} />
      </ul>
      <div className="bz-table-wrap" tabIndex={0} role="region" aria-label="Verdict against outcome">
        <table className="bz-table">
          <caption>Verdict against what happened later</caption>
          <thead><tr><th scope="col">Verdict</th><th scope="col" className="n">Blew up</th><th scope="col" className="n">Payout</th><th scope="col" className="n">Blow-up rate</th></tr></thead>
          <tbody>
            <tr><th scope="row"><Verdict v="likely_luck" /></th><td className="n">{n(bt.tp)}</td><td className="n">{n(bt.fp)}</td><td className="n">{pct(bt.hitRate.p)}</td></tr>
            <tr><th scope="row"><Verdict v="holds_up" /></th><td className="n">{n(bt.fn)}</td><td className="n">{n(bt.tn)}</td><td className="n">{pct(bt.holdsBlowup.p)}</td></tr>
            <tr><th scope="row"><Verdict v="not_enough" /></th><td className="n">{n(bt.notEnough.k)}</td><td className="n">{n(bt.notEnough.n - bt.notEnough.k)}</td><td className="n">{pct(bt.notEnough.p)}</td></tr>
          </tbody>
        </table>
      </div>
      <p className="bz-small">
        Gap in blow-up rate, likely luck minus holds up: {pct(bt.gap.d)}{bt.gap.lo != null ? ` (95% interval ${pct(bt.gap.lo)} to ${pct(bt.gap.hi)}, Newcombe)` : ""}.
        {bt.small ? " One group has fewer than 20 accounts, so these rates are rough. A longer period or more accounts will narrow them." : ""}
      </p>
    </section>
  );
}

/** One account's fill price check, in a few words. */
function fillsCell(f: AccountFills | undefined): string {
  if (!f) return "Not run";
  if (!f.checked && !f.closed) return "Not checked";
  const bits = [f.outside ? `${n(f.outside)} outside` : `${n(f.checked)} inside`];
  if (f.closed) bits.push(`${n(f.closed)} while closed`);
  return bits.join(", ");
}

export function Report({ results, summary, backtest, file, onOpen, fills, fillsNote }: { results: AccountResult[]; summary: Summary; backtest: Backtest | null; file: string; onOpen?: (id: string) => void; fills?: ReadonlyMap<string, AccountFills> | null; fillsNote?: string | null }) {
  const [show, setShow] = useState<"all" | ScreenVerdict | "passers">("all");
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "id", desc: false });
  const rows = useMemo(() => {
    const list = results.filter((r) => show === "all" || (show === "passers" ? r.passed === true : r.verdict === show));
    const val = (r: AccountResult): number | string => (sort.key === "id" ? r.id : sort.key === "verdict" ? VERDICT_ORDER.indexOf(r.verdict) : r[sort.key] ?? -Infinity);
    return [...list].sort((a, b) => {
      const x = val(a), y = val(b);
      const c = typeof x === "string" ? x.localeCompare(y as string, "en", { numeric: true }) : (x as number) - (y as number);
      return sort.desc ? -c : c;
    });
  }, [results, show, sort]);
  const s = summary;
  const judged = s.passersByVerdict.holds_up + s.passersByVerdict.likely_luck;
  const passedFrom = s.passedFrom === "file" ? "from your file" : s.passedFrom === "rule" ? `reached the ${pct(s.options.profitTarget)} target before the ${pct(s.options.maxLoss)} loss limit` : s.passedFrom === "mixed" ? "from your file where given, otherwise by the target and loss limit" : "unknown";

  return (
    <div className="bz-report">
      <section className="bz-panel" aria-labelledby="sum-h">
        <h2 id="sum-h">The batch</h2>
        <p>{n(s.accounts)} accounts screened. Passed means {passedFrom}. Method {s.version}, luck line {LUCK_LINE.toFixed(2)}.</p>
        <ul className="bz-kpis">
          <Kpi value={n(s.passers)} label={`passed the challenge, of ${n(s.accounts)} accounts`} />
          <Kpi tone="luck" value={`${n(s.passersByVerdict.likely_luck)} of ${n(judged)}`} label="passers with enough trades look like luck" note={judged ? pct(s.luckyPasserShare) : undefined} />
          <Kpi tone="good" value={n(s.passersByVerdict.holds_up)} label="passers hold up" />
          <Kpi value={n(s.passersByVerdict.not_enough)} label="passers had fewer than 30 trades: too few to tell" />
        </ul>
        <p className="bz-small">All accounts: {VERDICT_ORDER.map((v) => `${n(s.counts[v])} ${SCREEN_LABEL[v].toLowerCase()}`).join(", ")}.</p>
        <FillsSummary fills={fills} note={fillsNote} />
      </section>

      <section className="bz-panel" aria-labelledby="rules-h">
        <h2 id="rules-h">What your rules would have caught</h2>
        <p>
          For the {n(s.passersByVerdict.likely_luck)} passers that look like luck: how many each common firm rule would also have stopped, and how many of the
          {" "}{n(s.passersByVerdict.holds_up)} that hold up it would have stopped too.
        </p>
        <div className="bz-table-wrap" tabIndex={0} role="region" aria-label="Firm rules">
          <table className="bz-table">
            <thead><tr><th scope="col">Rule</th><th scope="col" className="n">Likely-luck passers caught</th><th scope="col" className="n">Passers that hold up, also stopped</th><th scope="col" className="n">Could not tell</th></tr></thead>
            <tbody>
              {s.rules.map((r) => (
                <tr key={r.id}><th scope="row">{r.label}</th><td className="n">{n(r.luckyCaught)}</td><td className="n">{n(r.holdsBlocked)}</td><td className="n">{n(r.unknown)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="bz-small">
          {n(s.onlyLuckCheck)} of the {n(s.passersByVerdict.likely_luck)} likely-luck passers pass all four rules: only the luck check flags them. Why they were flagged: {n(s.flagCounts.luck)} below the luck line, {n(s.flagCounts.loses)} losing money per trade, {n(s.flagCounts.fragile)} one bad run from losing it all.
        </p>
      </section>

      {backtest ? <BacktestPanel bt={backtest} /> : (
        <section className="bz-panel" aria-labelledby="bt-h">
          <h2 id="bt-h">Back-test the screen</h2>
          <p>Add an outcome column (payout or blow-up) for accounts whose later result you know, and this report will show how well the verdict predicted it.</p>
        </section>
      )}

      <section className="bz-panel" aria-labelledby="acc-h">
        <h2 id="acc-h">Every account</h2>
        <div className="bz-row bz-noprint">
          <div className="bz-filter">
            <label htmlFor="bz-show">Show</label>
            <select id="bz-show" value={show} onChange={(e) => setShow(e.target.value as typeof show)}>
              <option value="all">All accounts ({n(results.length)})</option>
              <option value="passers">Passers ({n(s.passers)})</option>
              {VERDICT_ORDER.map((v) => <option key={v} value={v}>{SCREEN_LABEL[v]} ({n(s.counts[v])})</option>)}
            </select>
          </div>
          <div className="bz-btn-row">
            <button type="button" className="btn" onClick={() => download(`${file.replace(/\.[a-z0-9]+$/i, "")}-screen.csv`, resultsCsv(results, fills))}>Download CSV</button>
            <button type="button" className="btn" onClick={() => window.print()}>Print or save as PDF</button>
          </div>
        </div>
        <div className="bz-table-wrap" tabIndex={0} role="region" aria-label="Accounts">
          <table className="bz-table">
            <caption>{n(rows.length)} account{rows.length === 1 ? "" : "s"}. Luck check: the deflated Sharpe ratio at the account's attempts; {LUCK_LINE.toFixed(2)} is the line.</caption>
            <thead>
              <tr>
                {COLS.map((c) => (
                  <th key={c.key} scope="col" className={c.num ? "n" : undefined} aria-sort={sort.key === c.key ? (sort.desc ? "descending" : "ascending") : undefined}>
                    <button type="button" className="bz-sort" onClick={() => setSort((p) => ({ key: c.key, desc: p.key === c.key ? !p.desc : !!c.num }))}>
                      {c.label}{sort.key === c.key ? <span aria-hidden="true">{sort.desc ? " ↓" : " ↑"}</span> : null}
                    </button>
                  </th>
                ))}
                <th scope="col">Passed</th>
                <th scope="col">Outcome</th>
                {fills ? <th scope="col">Fill prices</th> : null}
                <th scope="col">Why</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <th scope="row">{onOpen ? <button type="button" className="bz-open" onClick={() => onOpen(r.id)} aria-label={`Open the full Verify report for account ${r.id}`}>{r.id}</button> : r.id}</th>
                  <td><Verdict v={r.verdict} /></td>
                  <td className="n">{n(r.trades)}</td>
                  <td className="n">{pct(r.returnPct, 1)}</td>
                  <td className="n">{r.dsr == null ? "n/a" : r.dsr.toFixed(2)}</td>
                  <td className="n">{r.survives == null ? "n/a" : r.survives >= 1e9 ? "1bn+" : n(r.survives)}</td>
                  <td className="n">{pct(r.maxDrawdown, 1)}</td>
                  <td className="n">{share(r.top5Share)}</td>
                  <td className="n">{share(r.bestDayShare)}</td>
                  <td>{r.passed == null ? "n/a" : r.passed ? "Yes" : "No"}</td>
                  <td>{r.outcome === "payout" ? "Payout" : r.outcome === "blowup" ? "Blew up" : ""}</td>
                  {fills ? <td>{fillsCell(fills.get(r.id))}</td> : null}
                  <td className="why">{r.reason}{r.sizeGrowth ? " Size grew after losses." : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {onOpen && <p className="bz-small">Select an account's name for its full Verify report: the pictures, all five checks and what could not be checked, built in this browser and opened in a new tab. Its verdict can differ from the screen's, because Verify asks more of a short record.</p>}
        <p className="bz-small">Default starting balance {money(s.options.startingBalance)} for accounts without one. Research only, not investment advice. A verdict is about the record, not about the trader's future.</p>
      </section>
    </div>
  );
}

/** The batch's fill price check (DEC-0092): how many accounts have fills outside the traded range. */
function FillsSummary({ fills, note }: { fills?: ReadonlyMap<string, AccountFills> | null; note?: string | null }) {
  if (!fills) return note ? <p className="bz-small">{note}</p> : null;
  const all = [...fills.values()];
  const checked = all.reduce((t, f) => t + f.checked, 0), outside = all.reduce((t, f) => t + f.outside, 0), closed = all.reduce((t, f) => t + f.closed, 0);
  const accountsOut = all.filter((f) => f.outside >= 2 && f.outside / Math.max(1, f.checked) > 0.02).length;
  const sampled = all.some((f) => f.sent < f.total);
  return (
    <p className="bz-small">
      Fill prices: {n(checked)} fills checked against market data. {n(outside)} fall outside the traded range on our data source{closed ? `, and ${n(closed)} are timed while the market was closed` : ""}. {n(accountsOut)} {accountsOut === 1 ? "account has" : "accounts have"} more than 2 in 100 outside.
      {sampled ? " The batch was larger than 10,000 fills, so the same share of each account's fills was checked." : ""} {note ?? ""}
    </p>
  );
}
