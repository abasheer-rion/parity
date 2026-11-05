// The batch screen at /business/screen/ (DEC-0087). A firm drops one file of many challenge
// accounts (a long CSV with an account column, a zip of per-account trade files, or several
// files) and, optionally, a details file with balances, attempts, passes and outcomes. All of
// it is read and screened in this browser. The one exception, only with the firm's leave and
// a sign-in, is the fill price check (DEC-0092): the symbol, time and price of each fill go to
// our server, which says which fall outside the range traded at that time.
import { useEffect, useRef, useState, type DragEvent } from "react";
import { backtest, type Backtest } from "../lib/screen/backtest";
import { readBatch, type FileIn, type ReadResult } from "../lib/screen/read";
import { SAMPLE_FILES } from "../lib/screen/sample";
import { DEFAULT_OPTIONS, screenBatch, summarise, type AccountResult, type ScreenOptions, type Summary } from "../lib/screen/score";
import { Report } from "./Report";
import { accountReportUrl, openAccountReport } from "./accountReport";
import { MAX_BATCH_FILLS, screenFills, type AccountFills } from "../lib/screen/fills";
import { RangeFailed } from "../lib/verify/range/client";

interface Done { results: AccountResult[]; summary: Summary; backtest: Backtest | null; read: ReadResult; file: string; fills: Map<string, AccountFills> | null; fillsNote: string | null; fillsWhy: "opted_out" | "signed_out" | "failed" | null }

/** The signed-in person's session token, or null. Loaded only when the fill price check runs. */
async function sessionToken(): Promise<string | null> {
  try {
    const { requireClient } = await import("../auth/client");
    const { data } = await requireClient().auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

const toIn = async (f: File): Promise<FileIn> => ({ name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) });
const MAX_UPLOAD = 200 * 1024 * 1024;

function NumberField({ id, label, hint, value, onChange, min, max, step }: { id: string; label: string; hint: string; value: number; onChange: (v: number) => void; min: number; max: number; step: number }) {
  return (
    <div className="bz-num">
      <label htmlFor={id}>{label}</label>
      <input id={id} type="number" inputMode="decimal" min={min} max={max} step={step} value={Number.isFinite(value) ? value : ""} aria-describedby={`${id}-h`}
        onChange={(e) => onChange(e.target.valueAsNumber)} />
      <small id={`${id}-h`}>{hint}</small>
    </div>
  );
}

export function ScreenApp() {
  const [files, setFiles] = useState<File[]>([]);
  const [details, setDetails] = useState<File | null>(null);
  const [over, setOver] = useState(false);
  const [opts, setOpts] = useState<ScreenOptions>(DEFAULT_OPTIONS);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [fillCheck, setFillCheck] = useState(true);
  const reportRef = useRef<HTMLDivElement>(null);
  // When a report appears, move focus to it so keyboard and screen reader users land on it.
  useEffect(() => { if (done) reportRef.current?.focus(); }, [done]);
  const set = <K extends keyof ScreenOptions>(k: K) => (v: ScreenOptions[K]) => setOpts((o) => ({ ...o, [k]: v }));

  async function run(inputs: FileIn[], det: FileIn | null, name: string) {
    setError(null);
    setDone(null);
    const bad = Object.entries({ "Starting balance": opts.startingBalance, "Profit target": opts.profitTarget, "Loss limit": opts.maxLoss, "Best day limit": opts.consistencyLimit, "Minimum trading days": opts.minDays })
      .find(([, v]) => !Number.isFinite(v) || v < 0);
    if (bad) { setError(`${bad[0]} needs a number.`); return; }
    try {
      setBusy("Reading the files.");
      const read = await readBatch(inputs, det);
      if (!read.accounts.length) { setError(`No account could be read. ${read.skipped[0]?.why ?? ""}`); setBusy(null); return; }
      const results = await screenBatch(read.accounts, opts, (k, total) => setBusy(`Screening ${k.toLocaleString("en-US")} of ${total.toLocaleString("en-US")} accounts.`));
      // The fill price check, only when ticked and signed in: symbol, time and price of each fill.
      let fills: Map<string, AccountFills> | null = null, fillsNote: string | null = null;
      let fillsWhy: Done["fillsWhy"] = null;
      if (fillCheck) {
        const token = await sessionToken();
        if (!token) { fillsNote = "Fill prices were not checked: sign in to check them against market data."; fillsWhy = "signed_out"; }
        else {
          try {
            fills = await screenFills(read.accounts, { token, onProgress: (d, t) => setBusy(`Checking fill prices: ${d.toLocaleString("en-US")} of ${t.toLocaleString("en-US")}.`) });
          } catch (e) {
            fillsNote = `Fill prices were not checked: ${e instanceof RangeFailed ? e.message : "the check could not be reached."}`;
            fillsWhy = "failed";
          }
        }
      } else { fillsNote = "Fill prices were not checked: you kept every part of the files in this browser."; fillsWhy = "opted_out"; }
      setDone({ results, summary: summarise(results, opts), backtest: backtest(results), read, file: name, fills, fillsNote, fillsWhy });
      setBusy(null);
    } catch (e) {
      setBusy(null);
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function runFiles() {
    if (!files.length) { setError("Choose a file first."); return; }
    const total = files.reduce((s, f) => s + f.size, 0) + (details?.size ?? 0);
    if (total > MAX_UPLOAD) { setError("The files add up to more than 200 MB. Split the batch, or use the API."); return; }
    await run(await Promise.all(files.map(toIn)), details ? await toIn(details) : null, files[0].name);
  }

  async function runSample() {
    setBusy("Loading the synthetic sample.");
    try {
      const [t, d] = await Promise.all([fetch(SAMPLE_FILES.trades), fetch(SAMPLE_FILES.details)]);
      if (!t.ok || !d.ok) throw new Error("The sample files could not be loaded.");
      await run([{ name: "trades.csv", bytes: new Uint8Array(await t.arrayBuffer()) }], { name: "details.csv", bytes: new Uint8Array(await d.arrayBuffer()) }, "synthetic-sample.csv");
    } catch (e) {
      setBusy(null);
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    const list = [...e.dataTransfer.files];
    if (list.length) setFiles(list);
  };

  return (
    <>
      <section className="bz-noprint" aria-labelledby="screen-h">
        <h1 id="screen-h">Screen a batch of challenge accounts</h1>
        <p className="bz-lead">
          One verdict per account, holds up, likely luck or not enough trades, with the numbers behind it, a firm summary and, if you add outcomes, a
          back-test of the screen itself.
        </p>
        <p className="bz-lead"><strong>Your files never leave this computer.</strong> This page reads and checks them in your browser. Nothing is uploaded to Parity, and closing the tab clears it. The one exception is the fill price check in step 4, which sends the symbol, time and price of each fill, and only if you leave it on.</p>

        <div className="bz-panel">
          <h2>1. Trade files</h2>
          <p>One CSV with an account column and one row per trade, or a zip with one trade file per account (named by the account), or several files at once. MetaTrader, cTrader, TradingView, NinjaTrader and plain CSVs with a close time and a profit column work.</p>
          <div className={`bz-drop${over ? " over" : ""}`} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={onDrop}>
            <b>Drop files here</b>
            <span>or</span>
            <input id="bz-files" className="sr bz-file" type="file" multiple accept=".csv,.tsv,.txt,.zip,text/csv,application/zip" onChange={(e) => setFiles([...(e.target.files ?? [])])} />
            <label className="btn" htmlFor="bz-files">Choose files</label>
          </div>
          {files.length ? <ul className="bz-files" aria-label="Chosen files">{files.slice(0, 8).map((f) => <li key={f.name}>{f.name} ({(f.size / 1024).toFixed(0)} KB)</li>)}{files.length > 8 ? <li>and {files.length - 8} more</li> : null}</ul> : null}
        </div>

        <div className="bz-panel">
          <h2>2. Account details <span className="bz-ci">(optional)</span></h2>
          <p>One row per account with an account column and any of: starting balance, attempts, passed (yes or no) and outcome (payout or blow-up). Outcomes turn on the back-test. These columns can also sit in the trade file.</p>
          <input id="bz-details" className="sr bz-file" type="file" accept=".csv,.tsv,.txt,text/csv" onChange={(e) => setDetails(e.target.files?.[0] ?? null)} />
          <label className="btn" htmlFor="bz-details">Choose a details file</label>
          {details ? <p className="bz-files">{details.name}</p> : null}
        </div>

        <div className="bz-panel">
          <h2>3. Your challenge rules</h2>
          <p>Used to tell who passed when the file does not say, and for the firm rules in the report.</p>
          <div className="bz-grid">
            <NumberField id="o-bal" label="Starting balance" hint="For accounts without one" value={opts.startingBalance} min={1} max={1e12} step={1000} onChange={set("startingBalance")} />
            <NumberField id="o-target" label="Profit target, %" hint="Of the starting balance" value={Math.round(opts.profitTarget * 1000) / 10} min={0.1} max={1000} step={0.5} onChange={(v) => set("profitTarget")(v / 100)} />
            <NumberField id="o-loss" label="Loss limit, %" hint="Below the starting balance" value={Math.round(opts.maxLoss * 1000) / 10} min={0.1} max={100} step={0.5} onChange={(v) => set("maxLoss")(v / 100)} />
            <NumberField id="o-cons" label="Best day limit, %" hint="Consistency rule: best day's share of the profit" value={Math.round(opts.consistencyLimit * 100)} min={1} max={100} step={5} onChange={(v) => set("consistencyLimit")(v / 100)} />
            <NumberField id="o-days" label="Minimum trading days" hint="Days with at least one trade" value={opts.minDays} min={0} max={365} step={1} onChange={set("minDays")} />
          </div>
          <label className="bz-check"><input type="checkbox" checked={opts.countBatchAsTries} onChange={(e) => set("countBatchAsTries")(e.target.checked)} /><span>Count every account in the batch as a try. The strictest reading: it asks whether each result beats the luckiest of all of them.</span></label>
        </div>

        <div className="bz-panel">
          <h2>4. Fill prices <span className="bz-ci">(signed in)</span></h2>
          <label className="bz-check"><input type="checkbox" checked={fillCheck} onChange={(e) => setFillCheck(e.target.checked)} aria-describedby="bz-fills-h" /><span>Check fill prices against market data</span></label>
          <p id="bz-fills-h">This sends only the symbol, time and price of each fill to our server, which checks that each price was traded at that time, and nothing else from the files. Nothing is kept. Up to {MAX_BATCH_FILLS.toLocaleString("en-US")} fills a batch, the same share of each account's. It needs a sign-in; untick it to keep everything in this browser. It is reported next to each verdict and does not change it.</p>
        </div>

        <div className="bz-row">
          <button type="button" className="btn primary" onClick={() => void runFiles()} disabled={!!busy}>Screen the accounts</button>
          <button type="button" className="btn" onClick={() => void runSample()} disabled={!!busy}>Try the synthetic sample</button>
          <span className="bz-progress" role="status" aria-live="polite">{busy ?? ""}</span>
        </div>
        {error ? <p className="bz-error" role="alert">{error}</p> : null}
      </section>

      {done ? (
        <div ref={reportRef} tabIndex={-1} aria-label="Report" style={{ outline: "none" }}>
          {done.read.skipped.length || done.read.notes.length ? (
            <section className="bz-panel bz-noprint" aria-labelledby="skip-h">
              <h2 id="skip-h">Not read</h2>
              <ul className="bz-list">
                {done.read.notes.map((t) => <li key={t}>{t}</li>)}
                {done.read.skipped.slice(0, 20).map((s) => <li key={s.id}>{s.id}: {s.why}</li>)}
                {done.read.skipped.length > 20 ? <li>and {done.read.skipped.length - 20} more</li> : null}
              </ul>
            </section>
          ) : null}
          <Report results={done.results} summary={done.summary} backtest={done.backtest} file={done.file} fills={done.fills} fillsNote={done.fillsNote}
            onOpen={(id) => {
              const a = done.read.accounts.find((x) => x.id === id), row = done.results.find((x) => x.id === id);
              if (a && row) openAccountReport(() => accountReportUrl(a, row, opts.startingBalance, done.summary.version, done.fills?.get(id)?.outcome ?? (done.fillsWhy ? { ran: false, why: done.fillsWhy } : null)));
            }} />
        </div>
      ) : null}
    </>
  );
}
