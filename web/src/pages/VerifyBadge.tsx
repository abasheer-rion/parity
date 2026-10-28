// The public page of a published Verify badge, /v/<id> (REF-0016). Anyone can open it
// without signing in. It shows the verdict, the five cards, the date it was checked, the
// method version and the SHA-256 of the file. A withdrawn badge shows when it was
// withdrawn instead of vanishing; an unknown id says so. Reads one badge by id through
// verify_badge_public(), which never lists badges and never returns an owner.
import { useEffect, useState } from "react";
import type { Result } from "../lib/verify/checks";
import { badgeAlt, isBadgeId, KIND_WORDS, NOT_ADVICE, survivesWords, TRUST_LINE, VERDICT_WORDS, type PublicBadge } from "../lib/verify/badge";
import { trustLevel } from "../lib/verify/connect";
import { Embeds } from "./verify/Embeds";
import type { PublicCards } from "../lib/verify/publish";
import { shortDate } from "../lib/verify/parse";
import { NotFound } from "../components/NotFound";
import { LegalLinks } from "../legal/LegalLinks";
import { Skeleton } from "../ui";
import { PublicLinks, ResultView } from "./verify/Result";
import { badgeSrc } from "./verify/Share";
import "./verify/verify.css";

type State = { status: "loading" } | { status: "missing" } | { status: "error" } | { status: "ok"; badge: PublicBadge };

/** One badge by id. Exported so tests can swap the database for a stub. */
export async function fetchBadge(id: string): Promise<PublicBadge | null> {
  const { supabase } = await import("../auth/client");
  const { data, error } = await supabase.rpc("verify_badge_public", { p_id: id });
  if (error) throw error;
  return ((data as PublicBadge[] | null) ?? [])[0] ?? null;
}

export function badgeIdFromPath(path: string): string {
  return decodeURIComponent(path.replace(/^\/v\/?/, "").replace(/\/$/, "").split("/")[0] ?? "");
}

async function sha256(buf: ArrayBuffer): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function VerifyBadge({ load = fetchBadge, path = window.location.pathname }: { load?: (id: string) => Promise<PublicBadge | null>; path?: string }) {
  const id = badgeIdFromPath(path);
  const [state, setState] = useState<State>(isBadgeId(id) ? { status: "loading" } : { status: "missing" });
  useEffect(() => {
    if (!isBadgeId(id)) return;
    let live = true;
    load(id).then((b) => live && setState(b ? { status: "ok", badge: b } : { status: "missing" })).catch(() => live && setState({ status: "error" }));
    return () => { live = false; };
  }, [id, load]);
  useEffect(() => {
    if (state.status === "ok" && state.badge.name && !state.badge.withdrawn_at) document.title = `${state.badge.name}: ${VERDICT_WORDS[state.badge.verdict!]} · Parity Verify`;
  }, [state]);

  return (
    <div className="vb-page">
      <a className="skip" href="#main">Skip to content</a>
      <header className="vb-header">
        <a href="/" className="vb-brand"><img src="/brand/2026-10-22-wordmark/parity-lockup-on-dark.svg" width="137" height="32" alt="Parity home" /></a>
        <nav className="vb-nav" aria-label="Verify">
          <a href="/verify/">Check a record</a>
          <a href="/methodology/">Methodology</a>
        </nav>
      </header>
      <main id="main" tabIndex={-1} className="vb-main">
        {state.status === "loading" && <div aria-busy="true" aria-label="Loading the record"><Skeleton height={36} width="50%" /><Skeleton height={140} style={{ marginTop: 16 }} /><Skeleton height={420} style={{ marginTop: 16 }} /></div>}
        {state.status === "missing" && (
          <NotFound title="No record at this address" body="There is no Parity Verify badge with this link. Check that the address was copied in full: it ends in 12 letters and digits." home="/" homeLabel="Go to the front page" />
        )}
        {state.status === "error" && (
          <section className="vb-notice">
            <h1>This record could not be loaded</h1>
            <p>Check your connection and reload the page.</p>
          </section>
        )}
        {state.status === "ok" && (state.badge.withdrawn_at ? <Withdrawn b={state.badge} /> : <Live b={state.badge} />)}
      </main>
      <footer className="vb-footer">
        <LegalLinks />
        <p>Research and education only. Not investment advice. The verdict describes this record and makes no forecast.</p>
      </footer>
    </div>
  );
}

function Withdrawn({ b }: { b: PublicBadge }) {
  return (
    <section className="vb-notice" data-testid="withdrawn">
      <h1>This record was withdrawn by its owner on {shortDate(b.withdrawn_at!.slice(0, 10))}</h1>
      <p>It was published on {shortDate(b.created_at.slice(0, 10))}. When an owner withdraws a record, we delete its numbers and keep this page with the date it was withdrawn.</p>
      <img src={badgeSrc(b)} width={320} height={80} alt="Parity Verify badge: withdrawn by its owner" />
    </section>
  );
}

function Live({ b }: { b: PublicBadge }) {
  const origin = window.location.origin;
  const cards = b.cards as unknown as PublicCards;
  const r: Result = { ...cards, balance: null, triesDefaulted: false };
  const [check, setCheck] = useState<"same" | "different" | null>(null);
  const range = b.date_from && b.date_to ? `${shortDate(b.date_from)} to ${shortDate(b.date_to)}` : "Not given";
  return (
    <>
      <div className="vb-top">
        <div>
          <h1 className="vb-title">{b.name}</h1>
          <p className="vb-verdict">{VERDICT_WORDS[b.verdict!]}. {survivesWords(b.survives_tries)}.</p>
        </div>
        <img src={badgeSrc(b)} width={320} height={80} alt={badgeAlt(b)} className="vb-badge" />
      </div>
      <section className="vb-record" aria-labelledby="vb-record-h">
        <h2 id="vb-record-h" className="sr-only">The record</h2>
        <dl className="vb-facts">
          <div><dt>Verdict</dt><dd>{VERDICT_WORDS[b.verdict!]}</dd></div>
          <div><dt>Luck check</dt><dd>{survivesWords(b.survives_tries)}, at {b.stated_tries?.toLocaleString("en-US")} {b.stated_tries === 1 ? "try" : "tries"} stated by the owner</dd></div>
          <div><dt>Trust level</dt><dd>{trustLevel("upload")}. {b.input_kind ? KIND_WORDS[b.input_kind] : "Self-reported record"}</dd></div>
          <div><dt>Trades</dt><dd>{b.trade_count == null ? "Not a trade list" : b.trade_count.toLocaleString("en-US")}</dd></div>
          <div><dt>Period</dt><dd>{range}</dd></div>
          <div><dt>Checked on</dt><dd>{shortDate(b.created_at.slice(0, 10))}</dd></div>
          <div><dt>Record id</dt><dd><code>{b.id}</code></dd></div>
          <div><dt>Method</dt><dd><a href="/methodology/">{b.method_version}</a>, the rules that judged it</dd></div>
        </dl>
      </section>
      <div className="vb-trust">
        <p><strong>{TRUST_LINE}</strong> {NOT_ADVICE}</p>
        <p className="vf-small">
          File fingerprint (SHA-256): <code className="vb-hash">{b.file_sha256}</code>. Anyone with the same file gets the same fingerprint.
        </p>
        <label className="vb-hashcheck">
          <span>Check a file against it, in your browser:</span>
          <input type="file" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setCheck((await sha256(await f.arrayBuffer())) === b.file_sha256 ? "same" : "different"); }} />
          <span role="status" className={check === "same" ? "vb-ok" : check === "different" ? "vf-bad" : ""}>
            {check === "same" ? "Same file: the fingerprints match." : check === "different" ? "Not the same file: the fingerprints differ." : ""}
          </span>
        </label>
      </div>
      <PublicLinks.Provider value={true}>
        <ResultView r={r} />
      </PublicLinks.Provider>
      <details className="vb-share">
        <summary>Embed or share this record</summary>
        <Embeds badge={b} origin={origin} host={window.location.host} />
      </details>
    </>
  );
}
