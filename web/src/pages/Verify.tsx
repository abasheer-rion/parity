// Parity Verify (REF-0016, INT-0003): give it a trading record, a bot described in words
// or one of our strategies, and it says in plain words whether the record holds up. An
// uploaded file is read and checked in this browser only; nothing about it is sent.
import { useMemo, useRef, useState, type ReactNode } from "react";
import { Title } from "../components/Shell";
import { loadReport, loadSearch } from "../lib/data";
import { nameOf, tagsOf } from "../lib/strategyMeta";
import { checkDescription, checkFile, checkStrategy, type Result } from "../lib/verify/checks";
import { MAX_BYTES, ParseError } from "../lib/verify/csv";
import { closest, extract, searchVerdict, type Candidate, type Match } from "../lib/verify/describe";
import { build, defaultMapping, describeParsed, FIELDS, parseText } from "../lib/verify/parse";
import { loadPrices } from "../lib/verify/prices";
import { FORMAT_LABEL, type Answers, type FormatId, type InputKind, type Parsed } from "../lib/verify/types";
import { Button, Checkbox, Disclosure, EmptyState, Input, SearchInput, Segmented, Select, SkeletonTable, useResource } from "../ui";
import { Num, ResultView, pct } from "./verify/Result";
import "./verify/verify.css";

type Mode = "file" | "describe" | "strategy";
const LESSON = "#/academy/win-rate-is-not-profit/the-99-percent-bot";

export interface FileMeta { parsed: Parsed; sha256: string; name: string }

export function Verify({ share }: { share?: (r: Result, file: FileMeta | null) => ReactNode } = {}) {
  const [mode, setMode] = useState<Mode>("file");
  const [result, setResult] = useState<{ r: Result; file: FileMeta | null; matches?: Match[] } | null>(null);
  const change = (m: Mode) => { setMode(m); setResult(null); };
  return (
    <>
      <div className="page-head">
        <Title>Verify</Title>
        <p className="page-purpose">
          Check whether a trading record holds up. Give it a trade log, describe a bot, or pick one of our strategies, and it
          tells you in plain words whether it makes money per trade, how bad one loss can get, whether the result could be luck
          for the number of things tried, and whether there are signs it was tuned to the past or peeked at the future.
        </p>
      </div>
      <Segmented<Mode> label="What to check" value={mode} onChange={change}
        options={[["file", "Upload a file"], ["describe", "Describe a bot"], ["strategy", "Pick a strategy"]]} />
      <div className="vf-input">
        {mode === "file" && <FileInput onResult={(r, file) => setResult({ r, file })} />}
        {mode === "describe" && <DescribeInput onResult={(r, matches) => setResult({ r, file: null, matches })} />}
        {mode === "strategy" && <StrategyInput onResult={(r) => setResult({ r, file: null })} />}
      </div>
      {result ? (
        <ResultView r={result.r}>
          {result.matches && <Matches matches={result.matches} />}
          {share?.(result.r, result.file)}
        </ResultView>
      ) : (
        <EmptyState title="Nothing checked yet" icon="checkCircle">
          A bot that wins 99 trades in 100 can still lose money. <a href={LESSON}>See why in the Academy</a>, then check a record here.
        </EmptyState>
      )}
    </>
  );
}

// ---------------------------------------------------------------- A: a file

async function sha256(buf: ArrayBuffer): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const KINDS: [InputKind, string][] = [["real", "Real money"], ["demo", "Demo account"], ["backtest", "Backtest"]];

function FileInput({ onResult }: { onResult: (r: Result, file: FileMeta) => void }) {
  const [file, setFile] = useState<FileMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState<InputKind>("backtest");
  const [balance, setBalance] = useState("");
  const [tries, setTries] = useState("1");
  const [claimWin, setClaimWin] = useState("");
  const [claimMonthly, setClaimMonthly] = useState("");
  const [claimDd, setClaimDd] = useState("");
  const [noCash, setNoCash] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const read = async (f: File) => {
    setError(null); setFile(null);
    if (f.size > MAX_BYTES) { setError("The file is larger than 5 MB, the most Verify reads for now."); return; }
    if (!/\.(csv|txt|tsv)$/i.test(f.name) && f.type && !/text|csv/.test(f.type)) { setError("Verify reads .csv and .txt files (with commas or tabs)."); return; }
    try {
      // The bytes are hashed for the badge and read as text once; only the parsed rows,
      // without personal columns, are kept. Nothing is sent anywhere.
      const buf = await f.arrayBuffer();
      const [hash, parsed] = [await sha256(buf), parseText(new TextDecoder().decode(buf))];
      setFile({ parsed, sha256: hash, name: f.name });
      setBalance(parsed.inferredBalance ? String(parsed.inferredBalance) : "");
      if (parsed.backtestExport) setKind("backtest");
    } catch (e) {
      setError(e instanceof ParseError ? e.message : "We could not read this file. Is it a CSV export?");
    }
  };

  const remap = (format: FormatId, mapping = defaultMapping(format, file!.parsed.table)) => {
    const p = build(file!.parsed.table, format, mapping, file!.parsed.dropped);
    setFile({ ...file!, parsed: p });
  };

  const p = file?.parsed;
  const ready = !!p && !!(p.trades?.length || p.equity?.length);
  const needCash = !!p?.equity && p.mapping.cashflow == null;
  const triesN = Math.max(1, Math.floor(Number(tries) || 1));

  const run = async () => {
    if (!p || !file) return;
    setBusy(true);
    const answers: Answers = {
      kind, tries: triesN,
      balance: Number(balance) > 0 ? Number(balance) : null,
      claim: {
        winRate: claimWin ? Number(claimWin) / 100 : undefined,
        monthlyReturn: claimMonthly ? Number(claimMonthly) / 100 : undefined,
        maxDrawdown: claimDd ? Math.abs(Number(claimDd)) / 100 : undefined,
      },
      noCashflows: noCash,
    };
    const needsPrices = !!p.trades?.some((t) => t.symbol && (t.entry != null || t.exit != null));
    const prices = needsPrices ? await loadPrices() : null;
    onResult(checkFile({ parsed: p, answers, prices, triesDefaulted: tries.trim() === "1" || !tries.trim() }), file);
    setBusy(false);
  };

  return (
    <div className="vf-panel">
      <p className="vf-privacy">Your file stays in this browser. It is read and checked on your device and is never sent to our servers.</p>
      <label className={`vf-drop ${drag ? "is-drag" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f) void read(f); }}>
        <input ref={input} type="file" accept=".csv,.txt,.tsv,text/csv,text/plain" className="sr-only"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void read(f); e.target.value = ""; }} />
        <strong>{file ? file.name : "Drop a CSV here, or choose a file"}</strong>
        <span>MetaTrader 4 or 5 history, a TradingView list of trades, any trade list with a close date and a profit, or an equity curve. Up to 5 MB and 50,000 rows.</span>
      </label>
      {error && <p className="vf-error" role="alert">{error}</p>}

      {p && (
        <>
          <p className="vf-found" aria-live="polite"><strong>Found:</strong> {describeParsed(p)}</p>
          {p.dropped.length > 0 && <p className="vf-small">We removed {p.dropped.length} column{p.dropped.length === 1 ? "" : "s"} that look personal before reading anything else: {p.dropped.join(", ")}.</p>}
          {p.warnings.map((w) => <p key={w} className="vf-warn">{w}</p>)}
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
            <div className="ui-field"><span className="ui-field-label">1. Is this real money, a demo account, or a backtest?</span>
              <Segmented<InputKind> label="Kind of record" value={kind} onChange={setKind} options={KINDS} size="sm" />
              <span className="vf-help">Left as is, we treat it as a backtest, the least trusted.</span>
            </div>
            <div className="ui-field">
              <Input label={p.trades ? "2. Starting balance" : "2. Starting value (read from the file)"} type="number" value={balance} onChange={setBalance} placeholder="For example 10000" />
              <span className="vf-help">{p.trades ? "Turns profits into returns. Without it, only the per-trade checks run." : "We start the curve here."}</span>
            </div>
            <div className="ui-field">
              <Input label="3. How many strategies, bots or settings did you try before this one?" type="number" value={tries} onChange={setTries} />
              <span className="vf-help">The luck check needs it: try enough bots and one will look great by chance, as the <a href={LESSON}>bot battle</a> shows. Count every version you tested.</span>
            </div>
            <fieldset className="vf-claim">
              <legend className="ui-field-label">4. What was claimed? (optional, for example from a seller's page)</legend>
              <Input label="Win rate, %" type="number" value={claimWin} onChange={setClaimWin} placeholder="92" />
              <Input label="Monthly return, %" type="number" value={claimMonthly} onChange={setClaimMonthly} placeholder="8" />
              <Input label="Largest fall, %" type="number" value={claimDd} onChange={setClaimDd} placeholder="15" />
            </fieldset>
            {needCash && <Checkbox checked={noCash} onChange={setNoCash} label="There were no deposits or withdrawals in this period (the file has no column for them)." />}
          </div>
          <Button variant="primary" onClick={() => void run()} disabled={!ready || (needCash && !noCash)} loading={busy}>Check this record</Button>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- B: a description

const EXAMPLE = "Buys Bitcoin when RSI goes under 30 and sells at 5% profit, no stop loss, 50 trades a month, claims 92% win rate.";

async function candidates(): Promise<Candidate[]> {
  const [report, search] = await Promise.all([loadReport().catch(() => null), loadSearch().catch(() => null)]);
  const out: Candidate[] = [];
  for (const r of report?.runs ?? []) {
    if (r.is_benchmark) continue;
    const t = tagsOf(r);
    out.push({ id: r.strategy, name: nameOf(r), line: r.description ?? r.summary, family: t.family, asset: t.asset, style: t.style, from: "report",
      verdict: r.gauntlet?.verdict ?? "Not yet through the gauntlet", deflated: r.metrics.deflated_sharpe, sharpe: r.metrics.sharpe });
  }
  for (const s of search?.rows ?? []) {
    out.push({ id: s.id, name: s.name, line: s.line, family: s.family, asset: s.asset, style: s.style, from: "search", verdict: searchVerdict(s.deflated), deflated: s.deflated, sharpe: s.sharpe });
  }
  return out;
}

function DescribeInput({ onResult }: { onResult: (r: Result, matches: Match[]) => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const run = async () => {
    const x = extract(text);
    setBusy(true);
    const matches = closest(x, await candidates());
    onResult(checkDescription({ text, claim: x.claim, settings: x.settings || null, trades: x.trades }), matches);
    setBusy(false);
  };
  return (
    <div className="vf-panel">
      <label className="ui-field">
        <span className="ui-field-label">Describe the bot in your own words: what it trades, when it buys and sells, and what it claims</span>
        <textarea className="ui-input vf-textarea" value={text} onChange={(e) => setText(e.target.value)} placeholder={EXAMPLE} rows={4} maxLength={2000} />
      </label>
      <p className="vf-help">This checks the description, not the bot: claims that fail on arithmetic, and the closest strategies we have already tested.</p>
      <div className="vf-row">
        <Button variant="primary" onClick={() => void run()} disabled={text.trim().length < 10} loading={busy}>Check this description</Button>
        <Button variant="tertiary" onClick={() => setText(EXAMPLE)}>Use the example</Button>
      </div>
    </div>
  );
}

function Matches({ matches }: { matches: Match[] }) {
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
      ) : <p className="vf-small">We could not load our tested strategies, or none is close to this description.</p>}
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
    return runs.filter((r) => !n || `${nameOf(r)} ${r.strategy} ${r.description ?? ""}`.toLowerCase().includes(n)).slice(0, 12);
  }, [runs, q]);
  if (error) return <div className="vf-panel"><EmptyState title="Our strategies are not available">{error}</EmptyState></div>;
  if (!report) return <div className="vf-panel"><SkeletonTable rows={6} cols={2} label="Loading our strategies" /></div>;
  const tries = (search?.trials ?? 0) + report.n_trials;
  const pick = (name: string) => {
    const r = runs.find((x) => x.strategy === name)!;
    onResult(checkStrategy({ name: nameOf(r), equity: r.equity, tries, asset: tagsOf(r).asset,
      gauntlet: r.gauntlet ? { verdict: r.gauntlet.verdict, passed: r.gauntlet.passed, total: r.gauntlet.total } : null }));
  };
  return (
    <div className="vf-panel">
      <SearchInput value={q} onChange={setQ} placeholder={`Search ${runs.length} tested strategies`} />
      <p className="vf-help">The luck check uses every try our research and search have counted: {tries.toLocaleString("en-US")}.</p>
      <ul className="vf-pick">
        {shown.map((r) => (
          <li key={r.strategy}>
            <button type="button" onClick={() => pick(r.strategy)}>
              <strong>{nameOf(r)}</strong>
              <span>{r.gauntlet?.verdict ?? "Not yet through the gauntlet"} Sharpe {r.metrics.sharpe == null ? "n/a" : r.metrics.sharpe.toFixed(2)}, worst fall {pct(r.metrics.max_drawdown == null ? null : -Math.abs(r.metrics.max_drawdown), 0)}.</span>
            </button>
          </li>
        ))}
        {!shown.length && <li className="vf-small">No strategy matches.</li>}
      </ul>
    </div>
  );
}
