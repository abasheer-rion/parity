// The guard for every signed-in app: the product (/app/), research (/research/) and Sim
// World (/sim/ and sim.<domain>). The middleware (web/functions/_middleware.ts) already
// refuses to serve them without a valid session cookie; this handles the same cases in
// the browser (an expired session, signing out in another tab, a pending second step).
import { useEffect, useState, type ReactNode } from "react";
import { ROUTES } from "./config";
import { Splash } from "./form";
import { go } from "./nav";
import { withNext } from "./redirect";
import { needsSecondStep, signOut, useSession } from "./session";

/** The log-in address for the current page, so signing in comes straight back here. */
export function loginUrl(loc: Pick<Location, "pathname" | "search" | "hash"> = window.location, mfa = false): string {
  const next = loc.pathname + loc.search + loc.hash;
  return withNext(mfa ? `${ROUTES.login}?mfa=1` : ROUTES.login, next);
}

function toLogin(mfa = false) {
  go(loginUrl(window.location, mfa));
}

export type GuardUser = { email: string | null; id: string | null; signOut: () => void };

// Local preview only: `VITE_AUTH_BYPASS=1 npm run dev` skips sign-in so pages can be
// checked without a Supabase session. import.meta.env.DEV is false in every build, so
// this branch is removed from what we deploy.
const BYPASS = import.meta.env.DEV && import.meta.env.VITE_AUTH_BYPASS === "1";

export function AppGuard({ children }: { children: (user: GuardUser) => ReactNode }) {
  if (BYPASS) return <>{children({ email: "preview@localhost", id: null, signOut: () => {} })}</>;
  return <SessionGuard>{children}</SessionGuard>;
}

function SessionGuard({ children }: { children: (user: GuardUser) => ReactNode }) {
  const { loading, session } = useSession();
  const [state, setState] = useState<"checking" | "ok" | "failed">("checking");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (loading) return;
    if (!session) { toLogin(); return; }
    let live = true;
    needsSecondStep()
      .then((pending) => { if (!live) return; if (pending) toLogin(true); else setState("ok"); })
      .catch(() => { if (live) setState("failed"); });
    return () => { live = false; };
  }, [loading, session, attempt]);

  if (state === "failed") {
    return (
      <Splash>
        <span>We could not check your sign-in. </span>
        <button type="button" className="auth-splash-retry" onClick={() => { setState("checking"); setAttempt((n) => n + 1); }}>Try again</button>
      </Splash>
    );
  }
  if (!session || state !== "ok") return <Splash />;
  return <>{children({ email: session.user.email ?? null, id: session.user.id, signOut: () => void signOut() })}</>;
}
