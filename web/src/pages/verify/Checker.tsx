// The Verify checker (REF-0016, INT-0003): give it a trading record, a bot described in
// words or one of our strategies, and it says in plain words whether the record holds up.
// An uploaded file is read and checked in this browser only; nothing about it is sent.
// The app's Verify page (pages/Verify.tsx) and the public page at /verify/ (DEC-0081) both
// show this one component. On the public page, signed out, our strategies and our daily
// prices (both behind sign-in) are left out and the result says what that leaves unchecked.
import { useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { hashQuery, setHashQuery, useHashState } from "../../lib/deeplink";
import { loadReport, loadSearch } from "../../lib/data";
import { nameOf, searchTextOf, tagsOf } from "../../lib/strategyMeta";
import { benchmarkFrom, checkDescription, checkFile, checkStrategy, type ClaimSource, type Result } from "../../lib/verify/checks";
import { MAX_BYTES, ParseError } from "../../lib/verify/csv";
import { closest, extract, searchVerdict, type Candidate, type Match } from "../../lib/verify/describe";
import { build, defaultMapping, describeParsed, FIELDS, parseFile } from "../../lib/verify/parse";
import { loadPrices } from "../../lib/verify/prices";
import { FORMAT_LABEL, type Answers, type Claim, type FormatId, type InputKind, type Parsed } from "../../lib/verify/types";
import { mergeFound, modelPrompt, readModelAnswer } from "../../lib/verify/claims/model";
import { complete, ProviderError } from "../../assistant/chat";
import { providerById, readKey, readModel, readProvider } from "../../assistant/keys";
import type { ReportExtra } from "../../lib/verify/report/model";
import { ClaimInput, claimOf } from "./ClaimInput";
import { Button, Checkbox, ChoiceCards, Disclosure, EmptyState, Input, SearchInput, Select, SkeletonTable, TextButton, useResource, type Choice } from "../../ui";
import { hostOf } from "../../lib/verify/report/model";
import { Num, PublicLinks, ResultView, pct } from "./Result";
import "./verify.css";
import { track } from "../../lib/analytics";
import { CodeInput } from "./CodeInput";
import { ConnectInput } from "./ConnectInput";
import { ConnectedSource } from "./Connected";
import { connectionsEnabled, type FetchAnswer } from "../../lib/verify/connect";
import { SignedIn } from "./signedIn";
import { fetchCoverage, planFile, RangeFailed, runFills, type Coverage, type RangeOutcome } from "../../lib/verify/range/client";

type Mode = "file" | "broker" | "code" | "describe" | "strategy";
const APP_LESSON = "#/academy/win-rate-is-not-profit/the-99-percent-bot";
const PUBLIC_LESSON = "/learn/academy/win-rate-is-not-profit/the-99-percent-bot/";
const MODES: Choice<Mode>[] = [
  { value: "file", title: "Upload a file", body: "A trade history from your broker or exchange, MetaTrader, TradingView or a spreadsheet.", icon: "upload" },
  { value: "broker", title: "Read from your broker", body: "Parity reads the trades itself with a read-only key, so the record is broker-connected.", icon: "link" },
  { value: "code", title: "Paste strategy code", body: "Pine Script from TradingView, Python, or rules in words. We run it on our prices.", icon: "flask" },
  { value: "describe", title: "Check a seller's claim", body: "Paste the address of a seller's page, or their words. Each claim is listed with where it came from.", icon: "quote" },
  { value: "strategy", title: "Pick a strategy", body: "Check one of the strategies we have already tested.", icon: "catalog" },
];

export interface FileMeta { parsed: Parsed; sha256: string; name: string }

const useLesson = () => (useContext(PublicLinks) ? PUBLIC_LESSON : APP_LESSON);

export interface CheckerProps {
  /** The Share step under a result. A record read from a broker comes with its signed source. */
  share?: (r: Result, file: FileMeta | null, connected?: FetchAnswer | null) => ReactNode;
  /** Called with every result shown. */
  onResult?: (r: Result) => void;
  /** False on the public page when nobody is signed in. */
  signedIn?: boolean;
}

/** Claims carried from "Check a seller's claim" to a trade file, to check them against it. */
export interface PendingClaim { claim: Claim; source: ClaimSource }

interface Shown { r: Result; file: FileMeta | null; matches?: Match[]; extra?: ReportExtra; pageText?: string; connected?: FetchAnswer }

export function Checker({ share, onResult, signedIn = true }: CheckerProps) {
  // The input kind, the example and the picked strategy are in the address, so a link
  // reopens the same check: #/verify?mode=describe&example=1, #/verify?mode=strategy&strategy=fx_carry (DEC-0038).
  const [rawMode, setRawMode] = useHashState("mode", "file");
  // Read-only broker connections (DEC-0091) only when the build turns them on. Back from
  // Alpaca's sign-in (?connect=alpaca), the broker tab opens to finish the read.
  const connections = connectionsEnabled();
  const backFromBroker = connections && typeof window !== "undefined" && /[?&]connect=alpaca\b/.test(window.location.search);
  const modes = MODES.filter((m) => (m.value !== "strategy" || signedIn) && (m.value !== "broker" || connections));
  const mode: Mode = backFromBroker ? "broker" : rawMode === "describe" || rawMode === "code" || (rawMode === "strategy" && signedIn) || (rawMode === "broker" && connections) ? rawMode as Mode : "file";
  const [result, setResult] = useState<Shown | null>(null);
  const [pending, setPending] = useState<PendingClaim | null>(null);
  const change = (m: Mode) => { setHashQuery({ example: null, strategy: null }); setRawMode(m); setResult(null); };
  const lesson = useLesson();
  // The empty state's one button: check the example bot (remounts the claim input so it runs it).
  const [exampleRun, setExampleRun] = useState(0);
  const top = useRef<HTMLDivElement>(null);
  const tryExample = () => { setHashQuery({ example: "1", strategy: null }); setRawMode("describe"); setResult(null); setExampleRun((n) => n + 1); track("verify_example", {}); };
  useEffect(() => { if (result) onResult?.(result.r); }, [result, onResult]);

  // A seller's claims, checked against a trade file next.
  const attach = (r: Result) => {
    if (!r.claimSource || !r.description) return;
    setPending({ claim: r.description.claim, source: r.claimSource });
    setHashQuery({ example: null, strategy: null });
    setRawMode("file");
    setResult(null);
    top.current?.scrollIntoView({ block: "start" });
  };
  // The person's own model reads the page for claims the patterns missed (DEC-0051, DEC-0088).
  const provider = readProvider();
  const key = readKey(provider);
  const askModel = async (shown: Shown) => {
    const text = shown.pageText ?? "";
    const prompt = modelPrompt(text);
    let reply: string;
    try {
      reply = await complete({ provider, key: key!, model: readModel(provider), system: prompt.system, prompt: prompt.prompt, origin: window.location.origin });
    } catch (e) {
      throw new Error(e instanceof ProviderError ? e.message : "Your model could not be reached. Check the key in Settings and try again.");
    }
    const got = readModelAnswer(reply, text);
    const src = shown.r.claimSource!;
    const found = mergeFound(src.found, got.found);
    const added = found.length - src.found.length;
    if (added) {
      const { claim, settings, trades } = claimOf(found, text, !!src.url);
      const d = checkDescription({ text: shown.r.description?.text ?? "", claim, settings, trades });
      setResult({ ...shown, r: { ...d, claimSource: { ...src, found } } });
    }
    return { added, dropped: got.dropped };
  };

  return (
    <SignedIn.Provider value={signedIn}>
      <div ref={top} />
      <ChoiceCards<Mode> label="What to check" value={mode} onChange={change} options={modes} />
      <div className="vf-input">
        {mode === "file" && <FileInput pending={pending} onClearPending={() => setPending(null)} onResult={(r, file, extra) => { track("verify_run", { mode, format: file?.parsed.format ?? "" }); setResult({ r, file, extra }); }} />}
        {mode === "broker" && <ConnectInput onResult={(r, connected) => { track("verify_run", { mode, format: connected.source.venue }); setResult({ r, file: null, connected, extra: { prices: "loaded" } }); }} />}
        {mode === "code" && <CodeInput onResult={(r) => { track("verify_run", { mode, format: r.code?.language ?? "" }); setResult({ r, file: null, extra: { prices: "loaded" } }); }} />}
        {mode === "describe" && <ClaimInput key={exampleRun} onResult={async ({ result: r, text }) => {
          track("verify_run", { mode, format: r.claimSource?.url ? "url" : "words" });
          const matches = signedIn && !r.claimSource?.url ? closest(extract(text), await candidates()) : [];
          setResult({ r, file: null, matches, pageText: text });
        }} />}
        {mode === "strategy" && <StrategyInput onResult={(r) => { track("verify_run", { mode }); setResult({ r, file: null }); }} />}
      </div>
      {result ? (
        <>
        {result.connected && <ConnectedSource answer={result.connected} />}
        <ResultView r={result.r} extra={result.extra} signedOut={!signedIn}
          claimsLive={result.r.claimSource ? {
            onAttach: result.r.source === "description" ? () => attach(result.r) : undefined,
            onModel: key && result.pageText ? () => askModel(result) : undefined,
            modelName: key ? providerById(provider).name.split(" (")[0] : null,
          } : undefined}>
          {result.matches && <Matches matches={result.matches} />}
          {share?.(result.r, result.file, result.connected ?? null)}
        </ResultView>
        </>
      ) : (
        <EmptyState title="Nothing checked yet" icon="checkCircle"
          action={<Button variant="accent" icon="play" onClick={tryExample}>Check the example bot</Button>}>
          Pick one of the {["", "one", "two", "three", "four", "five"][modes.length]} ways above. Or start with our example, a bot that wins 99 trades in 100 and still loses money. <a href={lesson}>Why that happens</a> is in the Academy.
        </EmptyState>
      )}
    </SignedIn.Provider>
  );
}

// ---------------------------------------------------------------- A: a file

async function sha256(buf: ArrayBuffer): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const KINDS: Choice<InputKind>[] = [
  { value: "real", title: "Real money", body: "Trades on a live account." },
  { value: "demo", title: "Demo account", body: "Trades on a practice account." },
  { value: "backtest", title: "Backtest", body: "Rules run on past prices. Trusted least." },
];

async function sessionToken(): Promise<string> {
  const { requireClient } = await import("../../auth/client");
  const { data } = await requireClient().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new RangeFailed("Sign in first.", "signed_out");
  return token;
}

/** The report's "What was checked" line for the fill price check. */
function fillsLine(r: RangeOutcome | null): string | undefined {
  if (!r) return undefined;
  if (!r.ran) return r.why === "opted_out" ? "Not checked against market data: you kept every part of the file in this browser" : r.why === "signed_out" ? "Not checked against market data while signed out" : r.why === "nothing" ? undefined : "Not checked against market data: the check could not run";
  const done = r.answers.filter((a) => a.r !== "none").length;
  return `${done.toLocaleString("en-US")} of ${r.points.length.toLocaleString("en-US")} fills checked against market data; only their symbol, time and price were sent`;
}

/** Card 4's words when the daily prices could not be loaded because nobody is signed in. */
export const SIGNED_OUT_PRICES = "Not checked while signed out: our daily prices load only for signed-in accounts. Sign in and run the check again to compare the fills with them.";

function FileInput({ onResult, pending, onClearPending }: { onResult: (r: Result, file: FileMeta, extra: ReportExtra) => void; pending: PendingClaim | null; onClearPending: () => void }) {
  const signedIn = useContext(SignedIn);
  const lesson = useLesson();
  const [file, setFile] = useState<FileMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState<InputKind>("backtest");
  const [balance, setBalance] = useState("");
  const [tries, setTries] = useState("1");
  // A claim carried over from "Check a seller's claim" fills these in; any can be changed.
  const fromPct = (v: number | undefined) => (v == null ? "" : String(Number((v * 100).toFixed(2))));
  const [claimWin, setClaimWin] = useState(() => fromPct(pending?.claim.winRate));
  const [claimMonthly, setClaimMonthly] = useState(() => fromPct(pending?.claim.monthlyReturn));
  const [claimDd, setClaimDd] = useState(() => fromPct(pending?.claim.maxDrawdown));
  const [claimTotal, setClaimTotal] = useState(() => fromPct(pending?.claim.totalReturn));
  const [noCash, setNoCash] = useState(false);
  // The fill price check (DEC-0092): on unless the person turns it off, and told before it runs.
  const [fillCheck, setFillCheck] = useState(true);
  const [progress, setProgress] = useState<string | null>(null);
  // Which markets the server can check, so only those fills are ever sent. Asks for nothing in.
  const [cover, setCover] = useState<Coverage | null>(null);
  useEffect(() => { if (signedIn && file) void fetchCoverage().then(setCover); }, [signedIn, file]);
  const input = useRef<HTMLInputElement>(null);

  const read = async (f: File) => {
    setError(null); setFile(null);
    if (f.size > MAX_BYTES) { setError("The file is larger than 5 MB, the most Verify reads for now."); return; }
    if (!/\.(csv|txt|tsv|htm|html|xlsx|json)$/i.test(f.name) && f.type && !/text|csv|html|json|spreadsheet/.test(f.type)) { setError("Verify reads CSV and text files, MetaTrader HTML reports, Excel files (.xlsx) and JSON."); return; }
    try {
      // The bytes are hashed for the badge and read once; only the parsed rows, without
      // personal columns, are kept. Nothing is sent anywhere.
      const buf = await f.arrayBuffer();
      const [hash, parsed] = [await sha256(buf), await parseFile(buf)];
      setFile({ parsed, sha256: hash, name: f.name });
      setBalance(parsed.inferredBalance ? String(parsed.inferredBalance) : "");
      if (parsed.backtestExport) setKind("backtest");
    } catch (e) {
      setError(e instanceof ParseError ? e.message : "We could not read this file. Is it a CSV, HTML, Excel or JSON export of a trade history?");
    }
  };

  const remap = (format: FormatId, mapping = defaultMapping(format, file!.parsed.table)) => {
    const p = build(file!.parsed.table, format, mapping, file!.parsed.dropped);
    setFile({ ...file!, parsed: p });
  };

  const p = file?.parsed;
  const ready = !!p && !!(p.trades?.length || p.equity?.length);
  const needCash = !!p?.equity && p.mapping.cashflow == null;
  const triesN = Math.min(1_000_000_000, Math.max(1, Math.floor(Number(tries) || 1)));
  const planned = useMemo(() => (p?.trades?.length ? planFile(p, cover) : null), [p, cover]);
  const fillCount = planned?.points.length ?? 0;

  const run = async () => {
    if (!p || !file) return;
    setBusy(true);
    const answers: Answers = {
      kind, tries: triesN,
      balance: Number(balance) > 0 ? Number(balance) : null,
      claim: {
        ...(pending?.claim ?? {}),
        winRate: claimWin ? Number(claimWin) / 100 : undefined,
        monthlyReturn: claimMonthly ? Number(claimMonthly) / 100 : undefined,
        maxDrawdown: claimDd ? Math.abs(Number(claimDd)) / 100 : undefined,
        totalReturn: claimTotal ? Number(claimTotal) / 100 : undefined,
      },
      noCashflows: noCash,
    };
    const needsPrices = !!p.trades?.some((t) => t.symbol && (t.entry != null || t.exit != null));
    // Only this price file is ever fetched, and only for a signed-in account: it checks the
    // fills and gives the S&P 500 to compare the record with.
    const prices = signedIn ? await loadPrices() : null;
    // The fill price check sends the symbol, time and price of each fill, and nothing else.
    let ranges: RangeOutcome | null = null;
    if (planned && !fillCount && Object.keys(planned.uncovered).length) {
      // Nothing a source covers: say which symbols, without sending anything.
      ranges = signedIn ? { ran: true, clock: planned.clock, offset: null, points: [], answers: [], unsupported: [], skipped: planned.skipped, uncovered: planned.uncovered } : { ran: false, why: "signed_out" };
    } else if (planned && fillCount) {
      if (!signedIn) ranges = { ran: false, why: "signed_out" };
      else if (!fillCheck) ranges = { ran: false, why: "opted_out" };
      // Without the server's answer on what it covers, nothing is sent.
      else if (!cover) ranges = { ran: false, why: "failed", message: "the fill price check could not be reached. Try again in a minute." };
      else {
        try {
          setProgress(`Checking fill prices: 0 of ${fillCount.toLocaleString("en-US")}`);
          ranges = await runFills(planned, { token: await sessionToken(), onProgress: (done, total) => setProgress(`Checking fill prices: ${done.toLocaleString("en-US")} of ${total.toLocaleString("en-US")}`) });
        } catch (e) {
          ranges = e instanceof RangeFailed && e.code === "off" ? { ran: false, why: "off" } : e instanceof RangeFailed && e.code === "signed_out" ? { ran: false, why: "signed_out" } : { ran: false, why: "failed", message: e instanceof Error ? e.message : undefined };
        }
        setProgress(null);
      }
    }
    const r = checkFile({ parsed: p, answers, prices: needsPrices ? prices : null, benchmark: benchmarkFrom(prices), pricesMissing: needsPrices && !signedIn ? SIGNED_OUT_PRICES : undefined, triesDefaulted: tries.trim() === "1" || !tries.trim(), ranges });
    onResult(pending ? { ...r, claimSource: pending.source } : r, file, { prices: signedIn ? (prices ? "loaded" : "missing") : "signed_out", fileName: file.name, fills: fillsLine(ranges) });
    track("verify_fill_check", { ran: ranges?.ran ? 1 : 0, why: ranges && !ranges.ran ? ranges.why : "" });
    setBusy(false);
  };

  return (
    <div className="vf-panel">
      <p className="vf-privacy">Your file stays in this browser. It is read and checked on your device and is never sent to our servers. The one exception is the fill price check below, which sends the symbol, time and price of each fill, and only if you leave it on.</p>
      {pending && (
        <div className="vf-pending" role="note">
          <p><strong>Checking against {pending.source.found.length} claim{pending.source.found.length === 1 ? "" : "s"} from {pending.source.url ? hostOf(pending.source.url) : "the words you pasted"}.</strong> Upload the account's trade history: the report sets each claim against it.</p>
          <TextButton tone="muted" onClick={onClearPending}>Leave the claims out</TextButton>
        </div>
      )}
      <label className={`vf-drop ${drag ? "is-drag" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f) void read(f); }}>
        <input ref={input} type="file" accept=".csv,.txt,.tsv,.htm,.html,.xlsx,.json,text/csv,text/plain,text/html,application/json" className="sr-only"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void read(f); e.target.value = ""; }} />
        <strong>{file ? file.name : "Drop a CSV here, or choose a file"}</strong>
        <span>Trade history from Interactive Brokers, Binance, Bybit, Coinbase, Kraken, cTrader, NinjaTrader, Tradovate, thinkorswim, Alpaca or Myfxbook, a MetaTrader 4 or 5 report (HTML or Excel), a TradingView list of trades (CSV or Excel), any trade list with a close date and a profit, or an equity curve. Up to 5 MB and 50,000 rows.</span>
      </label>
      {error && <p className="vf-error" role="alert">{error}</p>}

      {p && (
        <>
          <p className="vf-found" aria-live="polite"><strong>Found:</strong> {describeParsed(p)}</p>
          {p.dropped.length > 0 && <p className="vf-small">We removed {p.dropped.length} column{p.dropped.length === 1 ? "" : "s"} that look personal before reading anything else: {p.dropped.join(", ")}.</p>}
          {p.warnings.map((w) => <p key={w} className="vf-warn">{w}</p>)}
          {p.notes?.map((n) => <p key={n} className="vf-small">{n}</p>)}
          <Disclosure summary="Check the format and columns we picked" defaultOpen={!ready}>
            <div className="vf-map">
              <label className="ui-field"><span className="ui-field-label">Format</span>
                <Select<FormatId> label="Format" value={p.format} onChange={(f) => remap(f)}
                  options={(Object.keys(FORMAT_LABEL) as FormatId[]).map((f) => [f, FORMAT_LABEL[f]])} />
              </label>
              {FIELDS[p.format].map((f) => (
                <label key={f.field} className="ui-field"><span className="ui-field-label">{f.label}{f.required ? "" : " (optional)"}</span>
                  <Select<string> label={f.label} value={p.mapping[f.field] == null ? "" : String(p.mapping[f.field])}
                    onChange={(v) => remap(p.format, { ...p.mapping, [f.field]: v === "" ? undefined : Number(v) })}
                    options={[["", "Not in the file"], ...p.table.headers.map((h, i) => [String(i), h || `Column ${i + 1}`] as [string, string])]} />
                </label>
              ))}
            </div>
          </Disclosure>

          <div className="vf-questions">
            <div className="ui-field vf-kind"><span className="ui-field-label" id="vf-kind-q">1. Is this real money, a demo account, or a backtest?</span>
              <ChoiceCards<InputKind> label="1. Is this real money, a demo account, or a backtest?" value={kind} onChange={setKind} options={KINDS} />
              <span className="vf-help">If you leave this, we treat it as a backtest, which we trust least.</span>
            </div>
            <div className="ui-field">
              <Input label={p.trades ? "2. Starting balance" : "2. Starting value (read from the file)"} type="number" value={balance} onChange={setBalance} placeholder="For example 10000" />
              <span className="vf-help">{p.trades ? "Turns profits into returns. Without it, only the per-trade checks run." : "We start the curve here."}</span>
            </div>
            <div className="ui-field">
              <Input label="3. How many strategies, bots or settings did you try before this one?" type="number" value={tries} onChange={setTries} />
              <span className="vf-help">The luck check needs this number. If you try enough bots, one will look good by chance, as the <a href={lesson}>bot battle</a> shows. Count every version you tested.</span>
            </div>
            <fieldset className="vf-claim">
              <legend className="ui-field-label">4. What was claimed? (optional, for example from a seller's page)</legend>
              <Input label="Win rate, %" type="number" value={claimWin} onChange={setClaimWin} placeholder="92" />
              <Input label="Monthly return, %" type="number" value={claimMonthly} onChange={setClaimMonthly} placeholder="8" />
              <Input label="Largest fall, %" type="number" value={claimDd} onChange={setClaimDd} placeholder="15" />
              <Input label="Total return, %" type="number" value={claimTotal} onChange={setClaimTotal} placeholder="120" />
            </fieldset>
            {needCash && <Checkbox checked={noCash} onChange={setNoCash} label="There were no deposits or withdrawals in this period (the file has no column for them)." />}
            {fillCount > 0 && (
              <div className="vf-fillcheck">
                {signedIn ? (
                  <>
                    <Checkbox checked={fillCheck} onChange={setFillCheck} describedBy="vf-fillcheck-help" label="Check fill prices against market data" />
                    <p className="vf-help" id="vf-fillcheck-help">
                      This sends only the symbol, time and price of each fill ({fillCount.toLocaleString("en-US")} {fillCount === 1 ? "fill" : "fills"}) to our server, which checks that each price was traded at that time. Nothing else from the file leaves this browser, and nothing is kept. Untick it to keep everything here; the report then says this check was not run. <a href="/methodology/#fills">How it works</a>
                    </p>
                  </>
                ) : (
                  <p className="vf-help">Signed out, every part of the file stays in this browser, so fill prices are not checked against market data. <a href={`/login/?next=${encodeURIComponent("/verify/")}`}>Log in</a> to check them: only the symbol, time and price of each fill are sent.</p>
                )}
              </div>
            )}
          </div>
          <Button variant="primary" onClick={() => void run()} disabled={!ready || (needCash && !noCash)} loading={busy}>Check this record</Button>
          {progress && <p className="vf-small" role="status" aria-live="polite">{progress}</p>}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- B: a description

// ---------------------------------------------------------------- B: the closest tested strategies to words

async function candidates(): Promise<Candidate[]> {
  const [report, search] = await Promise.all([loadReport().catch(() => null), loadSearch().catch(() => null)]);
  const out: Candidate[] = [];
  for (const r of report?.runs ?? []) {
    if (r.is_benchmark) continue;
    const t = tagsOf(r);
    out.push({ id: r.strategy, name: nameOf(r), line: r.description ?? r.summary, family: t.family, asset: t.asset, style: t.style, from: "report",
      verdict: r.gauntlet?.verdict ?? "Not yet run through our tests", deflated: r.metrics.deflated_sharpe, sharpe: r.metrics.sharpe });
  }
  for (const s of search?.rows ?? []) {
    out.push({ id: s.id, name: s.name, line: s.line, family: s.family, asset: s.asset, style: s.style, from: "search", verdict: searchVerdict(s.deflated), deflated: s.deflated, sharpe: s.sharpe });
  }
  return out;
}

function Matches({ matches }: { matches: Match[] }) {
  const signedIn = useContext(SignedIn);
  return (
    <section className="mcard vf-matches">
      <div className="mcard-head"><h2>The closest strategies we have tested</h2></div>
      {matches.length ? (
        <ul className="vf-checks">
          {matches.map((m) => (
            <li key={`${m.c.from}-${m.c.id}`}>
              <span>
                <strong>{m.c.name}.</strong> {m.c.verdict}{m.c.verdict.endsWith(".") ? "" : "."} Luck check <Num id="matchLuck">{m.c.deflated == null ? "n/a" : m.c.deflated.toFixed(2)}</Num>,
                Sharpe <Num id="matchSharpe">{m.c.sharpe == null ? "n/a" : m.c.sharpe.toFixed(2)}</Num>. <span className="vf-small">Close because it has {m.why.join(" and ") || "a similar shape"}.</span>
              </span>
            </li>
          ))}
        </ul>
      ) : signedIn ? <p className="vf-small">We could not load our tested strategies, or none is close to this description.</p>
        : <p className="vf-small">Our tested strategies are for signed-in accounts. <a href={`/login/?next=${encodeURIComponent("/verify/")}`}>Log in</a> to see the closest ones and their luck checks.</p>}
    </section>
  );
}

// ---------------------------------------------------------------- C: one of our strategies

function StrategyInput({ onResult }: { onResult: (r: Result) => void }) {
  const { data: report, error } = useResource("report-latest", () => loadReport());
  const { data: search } = useResource("search", loadSearch);
  const [q, setQ] = useState("");
  const runs = useMemo(() => (report?.runs ?? []).filter((r) => !r.is_benchmark && r.equity.length > 30), [report]);
  const shown = useMemo(() => {
    const n = q.trim().toLowerCase();
    return runs.filter((r) => !n || searchTextOf(r).toLowerCase().includes(n)).slice(0, 12);
  }, [runs, q]);
  if (error) return <div className="vf-panel"><EmptyState title="Our strategies are not available">{error}</EmptyState></div>;
  // The loading panel keeps the loaded panel's height, so the page below it does not jump.
  if (!report) return <div className="vf-panel vf-panel-wait"><SkeletonTable rows={6} cols={2} label="Loading our strategies" /></div>;
  const tries = (search?.trials ?? 0) + report.n_trials;
  const pick = (name: string) => {
    const r = runs.find((x) => x.strategy === name);
    if (!r) return;
    setHashQuery({ strategy: name });
    onResult(checkStrategy({ name: nameOf(r), equity: r.equity, tries, asset: tagsOf(r).asset,
      gauntlet: r.gauntlet ? { verdict: r.gauntlet.verdict, passed: r.gauntlet.passed, total: r.gauntlet.total } : null, holdup: r.holdup }));
  };
  return (
    <div className="vf-panel">
      <PickFromLink pick={pick} />
      <SearchInput value={q} onChange={setQ} placeholder={`Search ${runs.length} tested strategies`} />
      <p className="vf-help">The luck check uses every try our research and search have counted: {tries.toLocaleString("en-US")}.</p>
      <ul className="vf-pick">
        {shown.map((r) => (
          <li key={r.strategy}>
            <button type="button" onClick={() => pick(r.strategy)}>
              <strong>{nameOf(r)}</strong>
              <span>{r.gauntlet?.verdict ?? "Not yet run through our tests."} Sharpe {r.metrics.sharpe == null ? "n/a" : r.metrics.sharpe.toFixed(2)}, worst fall {pct(r.metrics.max_drawdown == null ? null : -Math.abs(r.metrics.max_drawdown), 0)}.</span>
            </button>
          </li>
        ))}
        {!shown.length && <li className="vf-small">No strategy matches.</li>}
      </ul>
    </div>
  );
}

/** Picks the strategy a link names (#/verify?mode=strategy&strategy=<id>) once the list is loaded. */
function PickFromLink({ pick }: { pick: (name: string) => void }) {
  const done = useRef(false);
  useEffect(() => {
    const id = hashQuery().get("strategy");
    if (id && !done.current) { done.current = true; pick(id); }
  }, [pick]);
  return null;
}
