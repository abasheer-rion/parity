// The public Verify page, /verify/ (DEC-0081). Anyone can check a trade history or a bot
// description without signing in: the file is read and checked in this browser and never
// sent. Signing in is needed only to publish a badge or add a result to the research
// dataset, and to load our tested strategies and daily prices (both behind sign-in).
import { useSession } from "../auth/session";
import { LegalLinks } from "../legal/LegalLinks";
import type { Result } from "../lib/verify/checks";
import { connectionsEnabled, PROVIDERS } from "../lib/verify/connect";
import { SUPPORTED } from "../lib/verify/parse";
import { MAX_BYTES, MAX_ROWS } from "../lib/verify/csv";
import { METHOD_VERSION } from "../lib/verify/types";
import { Checker, type FileMeta } from "../pages/verify/Checker";
import { PublicLinks } from "../pages/verify/Result";
import { SharePanel } from "../pages/verify/Share";
import { Button } from "../ui";
import "../pages/verify/verify.css";

const HERE = "/verify/";
const loginHref = `/login/?next=${encodeURIComponent(HERE)}`;
const ROWS_TEXT = { fills: "Fills, paired into round trips", trades: "Closed trades", deals: "Deals, paired into trades", equity: "Daily values" } as const;

/** Under a result, signed out: what signing in adds, with a way back here. */
function SignInToShare({ r }: { r: Result }) {
  if (r.source !== "file") return null;
  return (
    <section className="mcard vf-share" aria-labelledby="vp-share-h">
      <div className="mcard-head"><h2 id="vp-share-h">Share this result</h2></div>
      <div className="vf-panel">
        <p className="vf-small">
          Publishing a badge and its public page, or adding this result to the research dataset, needs an account, so that
          only you can withdraw it later. After you log in you come back to this page. Choose the file again to publish: we
          never kept it.
        </p>
        <div className="vf-row">
          <Button variant="primary" href={loginHref}>Log in to publish</Button>
          <Button variant="secondary" href={`/signup/?next=${encodeURIComponent(HERE)}`}>Create a free account</Button>
        </div>
      </div>
    </section>
  );
}

export function PublicVerify() {
  const { loading, session } = useSession();
  const signedIn = !!session;
  const share = (r: Result, file: FileMeta | null) => (signedIn
    ? <SharePanel key={`${file?.sha256 ?? ""}:${r.tries}:${r.kind}:${r.verdict.sentence}`} r={r} file={file} />
    : <SignInToShare r={r} />);
  const unverified = SUPPORTED.filter((s) => !s.verified);
  return (
    <div className="vp-page">
      <a className="skip" href="#main">Skip to content</a>
      <header className="vp-corner">
        <a href="/" className="vp-brand"><img src="/brand/2026-10-22-wordmark/parity-lockup-on-dark.svg" width="137" height="32" alt="Parity home" /></a>
        <nav className="vp-nav" aria-label="Account">
          <a href="/methodology/">Methodology</a>
          {signedIn ? <a href="/app/#/verify">Open the app</a> : <><a href={loginHref}>Log in</a><a href={`/signup/?next=${encodeURIComponent(HERE)}`}>Sign up</a></>}
        </nav>
      </header>
      <main id="main" tabIndex={-1} className="vp-main">
        <section className="vp-hero" aria-labelledby="vp-h1">
          <h1 id="vp-h1">Verify a trading record</h1>
          <p className="vp-lede">
            Upload a trade history from your broker or exchange, or describe a bot. Verify reports the profit per trade, the worst
            loss, whether the result could be luck given how many things were tried, and signs of tuning to past data or of using
            prices that were not yet known.
          </p>
          <ul className="vp-facts">
            <li><strong>{SUPPORTED.length} file formats</strong><span>From {SUPPORTED.length - 2} brokers, exchanges and platforms, plus any trade list or equity curve.</span></li>
            <li><strong>Checked in your browser</strong><span>The file is never sent to us. Up to {MAX_BYTES / 1024 / 1024} MB and {MAX_ROWS.toLocaleString("en-US")} rows.</span></li>
            <li><strong>No sign-in to check</strong><span>An account is needed only to publish a badge or add a result to the research dataset.</span></li>
          </ul>
        </section>

        <section className="vp-tool" aria-label="Check a record" data-signed-in={loading ? undefined : String(signedIn)}>
          <PublicLinks.Provider value={true}>
            <Checker share={share} signedIn={signedIn} />
          </PublicLinks.Provider>
        </section>

        <section id="supported" className="vp-section" aria-labelledby="vp-supported-h">
          <h2 id="vp-supported-h">Supported files</h2>
          <p className="vp-text">
            The format is found from the file's header row, and you can correct any column before anything is checked. Account
            numbers, names, email addresses, servers, logins and order ids are removed as the file is read. Where an export lists
            fills, they are paired first in, first out into round trips and fees are taken off.
          </p>
          <ul className="vp-cards">
            {SUPPORTED.map((s) => (
              <li key={s.id} className="vp-card">
                <h3>{s.name}</h3>
                <p className="vp-card-rows">{ROWS_TEXT[s.rows]}{s.verified ? "" : ". Unverified layout"}</p>
                <p className="vp-card-how">{s.how}</p>
                {s.note && <p className="vp-card-note">{s.note}</p>}
              </li>
            ))}
          </ul>
          <p className="vp-text vp-small">
            Unverified layout means we wrote the reader from the platform's help pages and journal apps' import guides, not from
            an official export file. {unverified.length} of {SUPPORTED.length} are unverified: {unverified.map((s) => s.name).join("; ")}.
            If a file is read wrongly, pick the right columns on the page.
          </p>
        </section>

        {!connectionsEnabled() && (
          <section className="vp-section" aria-labelledby="vp-connect-h">
            <h2 id="vp-connect-h">Read-only connections: coming later</h2>
            <p className="vp-text">
              A read-only link to {PROVIDERS.map((p) => p.name).join(", ").replace(/, ([^,]*)$/, " and $1")} would let a record be marked
              Broker-connected instead of Self-reported. It is not built. Every upload today is self-reported: Verify checks the
              numbers in the file, not where the file came from.
            </p>
          </section>
        )}

        <section className="vp-section" aria-labelledby="vp-method-h">
          <h2 id="vp-method-h">How a record is judged</h2>
          <p className="vp-text">
            Every check, threshold and formula is written down in the <a href="/methodology/">Verify methodology</a>, method
            version {METHOD_VERSION}. A published badge names the method version that judged it.
          </p>
        </section>
      </main>
      <footer className="vp-footer">
        <LegalLinks />
        <p>Research only. Not investment advice. A verdict is about this record, not about the future.</p>
      </footer>
    </div>
  );
}
