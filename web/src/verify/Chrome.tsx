// The frame of the public Verify pages that are not the checker itself (DEC-0089), such as
// a shared report. Same look as /verify/: no top bar, the brand in
// the corner, a few quiet links, the legal links at the foot.
import type { ReactNode } from "react";
import { useSession } from "../auth/session";
import { LegalLinks } from "../legal/LegalLinks";

export function PublicChrome({ children, here }: { children: ReactNode; here: string }) {
  const { session } = useSession();
  const next = encodeURIComponent(here);
  return (
    <div className="vp-page">
      <a className="skip" href="#main">Skip to content</a>
      <header className="vp-corner">
        <a href="/" className="vp-brand"><img src="/brand/2026-10-22-wordmark/parity-lockup-on-dark.svg" width="137" height="32" alt="Parity home" /></a>
        <nav className="vp-nav" aria-label="Verify">
          <a href="/verify/">Check a record</a>
          <a href="/methodology/">Methodology</a>
          {session ? <a href="/app/#/verify">Open the app</a> : <a href={`/login/?next=${next}`}>Log in</a>}
        </nav>
      </header>
      <main id="main" tabIndex={-1} className="vp-main rp-main">{children}</main>
      <footer className="vp-footer">
        <LegalLinks />
        <p>Research only. Not investment advice. A verdict is about the record, not about the future.</p>
      </footer>
    </div>
  );
}
