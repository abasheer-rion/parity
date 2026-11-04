// Two trading records side by side, /verify/compare/ (DEC-0089), such as two bots someone is
// choosing between. Each side is a report link someone shared, or a trade file checked here
// in the browser. Both reports travel in the address after "#" (#a=...&b=...), which the
// browser never sends, so a comparison can be shared without Parity storing anything.
import { useEffect, useId, useMemo, useState } from "react";
import { useSession } from "../auth/session";
import { checkUpload } from "../lib/verify/checks/upload";
import { ParseError, MAX_BYTES } from "../lib/verify/csv";
import { describeParsed, parseFile } from "../lib/verify/parse";
import { loadPrices } from "../lib/verify/prices";
import { compareRows, compareSentence, overlap } from "../lib/verify/report/compare";
import { decodeReport, encodeReport, LinkError } from "../lib/verify/report/link";
import { reportFrom, type ReportData } from "../lib/verify/report/model";
import { axisLabels } from "../lib/verify/report/visuals";
import type { InputKind, Parsed } from "../lib/verify/types";
import { VERDICT_TONE } from "../lib/verify/checks/verdict";
import { Button, Checkbox, Input, Select, toast } from "../ui";
import { SignatureFrame, SignaturePlayer, type SigVisual } from "../ui/signature";
import { Num, PublicLinks } from "../pages/verify/Num";
import { Printing, usePrinting, usePrintingNow } from "../pages/verify/report/print";
import { PublicChrome } from "./Chrome";
import "../pages/verify/verify.css";
import "../pages/verify/report/report.css";
import "./compare.css";

type Side = "a" | "b";
const NAME: Record<Side, string> = { a: "A", b: "B" };

export function codesFromHash(hash: string): Partial<Record<Side, string>> {
  const q = new URLSearchParams(hash.replace(/^#/, ""));
  return { ...(q.get("a") ? { a: q.get("a")! } : {}), ...(q.get("b") ? { b: q.get("b")! } : {}) };
}

/** A report link pasted in any form: the whole address, the part after "#", or after "#r=". */
export function codeFromPaste(s: string): string | null {
  const t = s.trim();
  const m = t.match(/[#&](?:r|a|b)=([A-Za-z0-9_-]+)/) ?? t.match(/^([zj][A-Za-z0-9_-]{20,})$/);
  return m ? m[1] : null;
}

function Picker({ side, onPick }: { side: Side; onPick: (d: ReportData) => void }) {
  const { session } = useSession();
  const id = useId();
  const [paste, setPaste] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<{ p: Parsed; name: string } | null>(null);
  const [balance, setBalance] = useState("");
  const [tries, setTries] = useState("1");
  const [kind, setKind] = useState<InputKind>("backtest");
  const [noCash, setNoCash] = useState(false);
  const [busy, setBusy] = useState(false);
  // An equity curve with no deposits column: the person says there were none, as on the Verify page.
  const needCash = !!parsed?.p.equity && parsed.p.mapping.cashflow == null;

  const fromLink = async () => {
    setError(null);
    const code = codeFromPaste(paste);
    if (!code) { setError("That is not a Verify report link. It should contain #r= followed by the report."); return; }
    try { onPick(await decodeReport(code)); } catch (e) { setError(e instanceof LinkError ? e.message : "That link could not be read."); }
  };
  const read = async (f: File) => {
    setError(null); setParsed(null); setNoCash(false);
    if (f.size > MAX_BYTES) { setError("The file is larger than 5 MB, the most Verify reads."); return; }
    try {
      const p = await parseFile(await f.arrayBuffer());
      setParsed({ p, name: f.name });
      setBalance(p.inferredBalance ? String(p.inferredBalance) : "");
      if (p.backtestExport) setKind("backtest");
    } catch (e) { setError(e instanceof ParseError ? e.message : "We could not read this file."); }
  };
  const check = async () => {
    if (!parsed) return;
    setBusy(true);
    try {
      const prices = session ? await loadPrices() : null;
      const t = Math.max(1, Math.floor(Number(tries) || 1));
      const r = checkUpload({ parsed: parsed.p, prices, signedIn: !!session, triesDefaulted: t === 1,
        answers: { kind, balance: Number(balance) > 0 ? Number(balance) : null, tries: t, claim: {}, noCashflows: noCash } });
      onPick(reportFrom(r, { prices: session ? (prices ? "loaded" : "missing") : "signed_out", fileName: parsed.name }));
    } finally { setBusy(false); }
  };
  return (
    <section className="rp-card cp-pick" aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`} className="rp-h3">Record {NAME[side]}</h2>
      <label className="ui-field">
        <span className="ui-field-label">Paste a Verify report link</span>
        <input className="ui-input" value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="https://paritytrading.app/verify/report/#r=..." />
      </label>
      <div className="vf-row"><Button variant="primary" onClick={() => void fromLink()} disabled={paste.trim().length < 10}>Use this report</Button></div>
      <p className="cp-or">Or check a trade file here. It is read in this browser and never sent.</p>
      <label className="vf-drop">
        <input type="file" className="sr-only" accept=".csv,.txt,.tsv,.htm,.html,.xlsx,.json" onChange={(e) => { const f = e.target.files?.[0]; if (f) void read(f); e.target.value = ""; }} aria-label={`Trade file for record ${NAME[side]}`} />
        <strong>{parsed ? parsed.name : "Choose a trade file"}</strong>
        <span>Any file the Verify page reads: broker and exchange exports, MetaTrader and TradingView reports, a trade list or an equity curve.</span>
      </label>
      {parsed && (
        <div className="cp-questions">
          <p className="vf-found" aria-live="polite"><strong>Found:</strong> {describeParsed(parsed.p)}</p>
          <Input label="Starting balance" type="number" value={balance} onChange={setBalance} placeholder="For example 10000" />
          <Input label="Things tried before this one, counting it" type="number" value={tries} onChange={setTries} />
          <label className="ui-field"><span className="ui-field-label">Money</span>
            <Select<InputKind> label="Money" value={kind} onChange={setKind} options={[["real", "Real money"], ["demo", "Demo account"], ["backtest", "Backtest"]]} />
          </label>
          {needCash && <Checkbox checked={noCash} onChange={setNoCash} label="There were no deposits or withdrawals in this period (the file has no column for them)." />}
          <div className="vf-row"><Button variant="primary" onClick={() => void check()} loading={busy} disabled={needCash && !noCash}>Check record {NAME[side]}</Button></div>
        </div>
      )}
      {error && <p className="vf-error" role="alert">{error}</p>}
    </section>
  );
}

function Pic({ visual }: { visual: SigVisual }) {
  const printing = usePrintingNow();
  return printing ? <SignatureFrame visual={visual} s={visual.steps.length - 1} theme="light" /> : <SignaturePlayer visual={visual} startAtEnd />;
}

function SideCard({ side, d, code, onClear }: { side: Side; d: ReportData; code: string | null; onClear: () => void }) {
  return (
    <section className={`rp-card cp-side vf-tone-${VERDICT_TONE[d.verdict.id]}`} aria-labelledby={`cp-${side}-h`}>
      <h2 id={`cp-${side}-h`} className="cp-name">Record {NAME[side]}: {d.what}</h2>
      <p className="cp-verdict">{d.verdict.label}</p>
      <p className="cp-sentence">{d.verdict.sentence}</p>
      <div className="vf-row cp-side-actions">
        {code && <Button size="sm" href={`/verify/report/#r=${code}`} target="_blank" rel="noopener">Open its full report</Button>}
        <Button size="sm" variant="tertiary" onClick={onClear}>Use another record</Button>
      </div>
    </section>
  );
}

export function ComparePage() {
  const [reports, setReports] = useState<Partial<Record<Side, ReportData>>>({});
  const [codes, setCodes] = useState<Partial<Record<Side, string>>>({});
  const [errors, setErrors] = useState<string[]>([]);
  const [printing, print] = usePrinting();

  // Read both sides from the address once, and again when it changes.
  useEffect(() => {
    const load = async () => {
      const c = codesFromHash(window.location.hash);
      const next: Partial<Record<Side, ReportData>> = {};
      const errs: string[] = [];
      for (const s of ["a", "b"] as Side[]) {
        if (!c[s]) continue;
        try { next[s] = await decodeReport(c[s]!); } catch (e) { errs.push(`Record ${NAME[s]}: ${e instanceof LinkError ? e.message : "the link could not be read."}`); }
      }
      setReports(next); setCodes(c); setErrors(errs);
    };
    void load();
    window.addEventListener("hashchange", load);
    return () => window.removeEventListener("hashchange", load);
  }, []);

  const pick = async (s: Side, d: ReportData) => {
    const code = await encodeReport(d);
    const c = { ...codes, [s]: code };
    setReports((r) => ({ ...r, [s]: d }));
    setCodes(c);
    history.replaceState(null, "", `#${(["a", "b"] as Side[]).filter((k) => c[k]).map((k) => `${k}=${c[k]}`).join("&")}`);
  };
  const clear = (s: Side) => {
    const c = { ...codes }; delete c[s];
    setReports((r) => { const n = { ...r }; delete n[s]; return n; });
    setCodes(c);
    history.replaceState(null, "", `#${(["a", "b"] as Side[]).filter((k) => c[k]).map((k) => `${k}=${c[k]}`).join("&")}`);
  };

  const a = reports.a, b = reports.b;
  const rows = useMemo(() => (a && b ? compareRows(a, b) : []), [a, b]);
  const both = useMemo<SigVisual | null>(() => {
    if (!a || !b) return null;
    const o = overlap(a, b);
    if (!o) return null;
    const ea = o.a[o.a.length - 1], eb = o.b[o.b.length - 1];
    return {
      kind: "equity",
      alt: `Growth of 1 dollar in records A and B over the ${o.dates.length > 1 ? `days they share, ${o.dates[0]} to ${o.dates[o.dates.length - 1]}` : "same days"}. A ended at ${ea.toFixed(2)}, B at ${eb.toFixed(2)}.`,
      params: { fmt: "x", labels: axisLabels(o.dates), series: [{ label: "A", values: o.a }, { label: "B", values: o.b, tone: "alt" }], headline: { label: "A, growth of 1 dollar" } },
      steps: [
        { caption: `1 dollar in each, from ${o.dates[0]}, the first day both records cover.`, to: 0.35 },
        { caption: "Both records over the days they share.", to: 1, verdict: `A ${ea.toFixed(2)}x, B ${eb.toFixed(2)}x over the same days.`, tone: "accent" },
      ],
    };
  }, [a, b]);

  const copy = () => {
    void navigator.clipboard?.writeText(window.location.href).then(() => toast("Link copied. Both reports are in it; Parity keeps no copy."), () => toast("Copy the address from the address bar."));
  };

  return (
    <Printing.Provider value={printing}>
      <PublicChrome here="/verify/compare/">
        <section className="vp-hero cp-hero" aria-labelledby="cp-h1">
          <h1 id="cp-h1">Compare two trading records</h1>
          <p className="vp-lede">Put two records side by side, such as two bots you are choosing between. Each side is a Verify report link, or a trade file checked here in your browser. Parity does not rank them or say which to choose.</p>
        </section>
        {errors.map((e) => <p key={e} className="vf-error" role="alert">{e}</p>)}
        <PublicLinks.Provider value={true}>
          <div className="cp-sides">
            {(["a", "b"] as Side[]).map((s) => {
              const d = reports[s];
              return d ? <SideCard key={s} side={s} d={d} code={codes[s] ?? null} onClear={() => clear(s)} /> : <Picker key={s} side={s} onPick={(x) => void pick(s, x)} />;
            })}
          </div>
          {a && b && (
            <>
              <section className="rp-card cp-summary" aria-labelledby="cp-sum-h">
                <h2 id="cp-sum-h" className="rp-h2">Side by side</h2>
                <p className="rp-lead" data-testid="compare-sentence">{compareSentence(a, b)}</p>
                <div className="vf-row cp-actions">
                  <Button variant="primary" icon="link" onClick={copy}>Copy a link to this comparison</Button>
                  <Button icon="download" onClick={print}>Save as PDF</Button>
                </div>
                <div className="cp-table-wrap" tabIndex={0} role="region" aria-label="The two records' numbers">
                  <table className="cp-table">
                    <caption className="sr-only">The same numbers for record A and record B</caption>
                    <thead><tr><th scope="col">Number</th><th scope="col">Record A</th><th scope="col">Record B</th></tr></thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.label}>
                          <th scope="row">{r.label}</th>
                          {(["a", "b"] as Side[]).map((s) => (
                            <td key={s} className={r.worse === s ? "cp-worse" : undefined}>{r.id && r[s] !== "n/a" ? <Num id={r.id}>{r[s]}</Num> : r[s]}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="vf-small">Red marks the side with the deeper fall, the longer time under water, more wins wiped out by its worst loss, the weaker luck check or more failed checks. Returns are shown, never ranked.</p>
              </section>
              <section className="rp-card" aria-labelledby="cp-growth-h">
                <h2 id="cp-growth-h" className="rp-h2">Growth over the same days</h2>
                {both ? <Pic visual={both} /> : <p className="rp-gap">Not drawn: the two records do not share enough days, or one has no starting balance. Each full report has its own picture.</p>}
              </section>
            </>
          )}
        </PublicLinks.Provider>
      </PublicChrome>
    </Printing.Provider>
  );
}
