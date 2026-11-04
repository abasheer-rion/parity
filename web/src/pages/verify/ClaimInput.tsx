// Check a seller's claim (DEC-0088): paste the address of their page, or their words. An
// address is read by our server (functions/api/verify/claim-url.ts) under the site's
// robots.txt and with no login; words are read here in the browser. Either way the fixed
// patterns list each claim with the words it came from, and the result is a report whose
// claims section can take a trade file to check them against.
import { useEffect, useState } from "react";
import { hashQuery, setHashQuery } from "../../lib/deeplink";
import { checkDescription, type ClaimSource, type Result } from "../../lib/verify/checks";
import { claimFrom, extractClaims } from "../../lib/verify/claims/extract";
import { plainText } from "../../lib/verify/claims/text";
import { extract } from "../../lib/verify/describe";
import type { Claim } from "../../lib/verify/types";
import { Button } from "../../ui";

export const CLAIM_EXAMPLE = "Buys Bitcoin when RSI goes under 30 and sells at 5% profit, no stop loss, 50 trades a month, claims 92% win rate.";

/** One web address and nothing else, with or without https://. */
export function isAddress(s: string): boolean {
  const t = s.trim();
  return !/\s/.test(t) && /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(\/\S*)?$/i.test(t);
}

export interface ClaimRead {
  result: Result;
  /** The page's words, kept only in this tab, for the person's own model. */
  text: string;
}

/**
 * The claim the checks use: what the patterns found, plus the holding time the older reader
 * picks up. Settings are counted only in words a person wrote about a bot, never on a page,
 * where every number would count.
 */
export function claimOf(found: ReturnType<typeof extractClaims>, words: string, page: boolean): { claim: Claim; settings: number | null; trades: number | null } {
  const x = extract(words);
  const claim: Claim = { ...(x.claim.holding ? { holding: x.claim.holding } : {}), ...claimFrom(found) };
  const trades = claim.trades ?? (claim.tradesPerMonth != null ? Math.round(claim.tradesPerMonth * (claim.months ?? 1)) : null);
  return { claim, settings: page ? null : x.settings || null, trades };
}

/** The description result for words or a page, carrying where each claim came from. */
export function checkClaimWords(words: string, source: Omit<ClaimSource, "found">): Result {
  const text = plainText(words);
  const found = extractClaims(text);
  const { claim, settings, trades } = claimOf(found, text, !!source.url);
  const r = checkDescription({ text: source.url ? (source.title ? `${source.title}\n${text.slice(0, 500)}` : text.slice(0, 600)) : text, claim, settings, trades });
  return { ...r, claimSource: { ...source, found } };
}

interface PageAnswer { ok: boolean; url?: string; final_url?: string; title?: string | null; read_at?: string; notes?: string[]; text?: string; detail?: string }

export function ClaimInput({ onResult }: { onResult: (r: ClaimRead) => void }) {
  const [text, setTextRaw] = useState(() => (hashQuery().get("example") === "1" ? CLAIM_EXAMPLE : ""));
  const setText = (t: string) => { setTextRaw(t); setHashQuery({ example: t === CLAIM_EXAMPLE ? "1" : null }); };
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const address = isAddress(text);

  const run = async (input = text) => {
    setError(null); setNotes([]);
    if (!isAddress(input)) {
      onResult({ result: checkClaimWords(input, { url: null, title: null, readAt: null }), text: input });
      return;
    }
    setBusy(true);
    try {
      // The words come back too (capped), so the claims are read here by the same patterns,
      // and the person's own model can read them if they ask.
      const res = await fetch("/api/verify/claim-url", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: input.trim(), with_text: true }) });
      const a = (await res.json().catch(() => ({ ok: false }))) as PageAnswer;
      if (!a.ok || !a.url) { setError(a.detail ?? "The page could not be read. Paste its words instead."); return; }
      setNotes(a.notes ?? []);
      onResult({ result: checkClaimWords(a.text ?? "", { url: a.final_url ?? a.url, title: a.title ?? null, readAt: a.read_at ?? null }), text: a.text ?? "" });
    } catch {
      setError("We could not reach the page reader. Check your connection, or paste the page's words instead.");
    } finally { setBusy(false); }
  };

  // A link to the example checks it straight away.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (hashQuery().get("example") === "1") void run(CLAIM_EXAMPLE); }, []);

  return (
    <div className="vf-panel">
      <label className="ui-field">
        <span className="ui-field-label">A seller's page address, or their words</span>
        <textarea className="ui-input vf-textarea" value={text} onChange={(e) => setText(e.target.value)} rows={4} maxLength={8000}
          placeholder={`https://www.mql5.com/en/signals/...\n\nor: ${CLAIM_EXAMPLE}`} />
      </label>
      <p className="vf-help">
        {address
          ? "We read the page once from our server, as the site's robots.txt allows, with no login, and keep no copy. Sites that block automatic readers (X, and pages behind a bot check) cannot be read: paste their words instead."
          : "Paste a bot or signal sales page, a statistics page or a post. Each claim is listed with the words it came from. Words are read in this browser and never sent."}
      </p>
      {error && <p className="vf-error" role="alert">{error}</p>}
      {notes.map((n) => <p key={n} className="vf-warn">{n}</p>)}
      <div className="vf-row">
        <Button variant="primary" onClick={() => void run()} disabled={text.trim().length < (address ? 4 : 10)} loading={busy}>{address ? "Read the page's claims" : "Check these words"}</Button>
        <Button variant="tertiary" onClick={() => setText(CLAIM_EXAMPLE)}>Use the example</Button>
      </div>
    </div>
  );
}
