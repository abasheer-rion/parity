// The SYNTHETIC sample report at /business/prop-firms/sample/ (DEC-0087). It loads the sample
// files (made by `npm run pilot:sample` from src/lib/screen/simulate.ts) and runs the same
// screen as /business/screen/, in this browser, so what you see is exactly what the screen
// gives on that data. No account in it is a real trader.
import { useEffect, useState } from "react";
import { backtest, type Backtest } from "../lib/screen/backtest";
import { readBatch } from "../lib/screen/read";
import { SAMPLE_FILES } from "../lib/screen/sample";
import { DEFAULT_OPTIONS, screenBatch, summarise, type AccountInput, type AccountResult, type Summary } from "../lib/screen/score";
import { Report } from "./Report";
import { accountReportUrl, openAccountReport } from "./accountReport";

const GENERATOR = "https://github.com/abasheer-rion/parity/blob/main/web/src/lib/screen/simulate.ts";

export function SampleApp() {
  const [state, setState] = useState<{ results: AccountResult[]; summary: Summary; backtest: Backtest | null; accounts: AccountInput[] } | null>(null);
  const [status, setStatus] = useState("Loading the sample and screening it in your browser.");
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const [t, d] = await Promise.all([fetch(SAMPLE_FILES.trades), fetch(SAMPLE_FILES.details)]);
        if (!t.ok || !d.ok) throw new Error("The sample files could not be loaded.");
        const read = await readBatch([{ name: "trades.csv", bytes: new Uint8Array(await t.arrayBuffer()) }], { name: "details.csv", bytes: new Uint8Array(await d.arrayBuffer()) });
        const results = await screenBatch(read.accounts, DEFAULT_OPTIONS, (k, n) => live && setStatus(`Screening ${k} of ${n} accounts in your browser.`));
        if (live) { setState({ results, summary: summarise(results), backtest: backtest(results), accounts: read.accounts }); setStatus(""); }
      } catch (e) {
        if (live) setStatus(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => { live = false; };
  }, []);
  return (
    <>
      <h1>Sample report: 500 challenge accounts</h1>
      <p className="bz-synthetic" role="note"><span><b>SYNTHETIC DATA.</b> Every account here is made up by a seeded simulation: skilled traders with a small edge, traders with no edge, and gamblers with large positions, some doubling after losses. What happened after the challenge was also simulated, by letting each passer keep trading the same way. None of it is a real trader or a real firm.</span></p>
      <p className="bz-lead">This is the report a firm gets. It was screened just now, in your browser, by the same code that screens your own files.</p>
      <div className="bz-row bz-noprint">
        <a className="btn" href={SAMPLE_FILES.trades} download>Trades (CSV)</a>
        <a className="btn" href={SAMPLE_FILES.details} download>Details and outcomes (CSV)</a>
        <a className="bz-link" href={GENERATOR}>The generator script</a>
        <a className="bz-link" href="/business/screen/">Screen your own batch</a>
      </div>
      <p className="bz-progress" role="status" aria-live="polite">{status}</p>
      {state ? <Report results={state.results} summary={state.summary} backtest={state.backtest} file="synthetic-sample.csv"
        onOpen={(id) => {
          const a = state.accounts.find((x) => x.id === id), row = state.results.find((x) => x.id === id);
          if (a && row) openAccountReport(() => accountReportUrl(a, row, DEFAULT_OPTIONS.startingBalance, state.summary.version));
        }} /> : null}
    </>
  );
}
