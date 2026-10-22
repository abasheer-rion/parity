// The app's guard. The middleware (web/functions/_middleware.ts) already refuses to
// serve /app/ without a valid session cookie; this handles the same cases in the
// browser (an expired session, signing out in another tab, a pending second step).
import { useEffect, useState, type ReactNode } from "react";
import { ROUTES } from "./config";
import { needsSecondStep, signOut, useSession } from "./session";

function toLogin(extra = "") {
  const next = window.location.pathname + window.location.hash;
  window.location.replace(`${ROUTES.login}?next=${encodeURIComponent(next)}${extra}`);
}

type GuardUser = { email: string | null; id: string | null; signOut: () => void };

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
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!session) { toLogin(); return; }
    needsSecondStep().then((pending) => (pending ? toLogin("&mfa=1") : setChecked(true)));
  }, [loading, session]);

  if (!session || !checked) return <div className="auth-splash">Loading</div>;
  return <>{children({ email: session.user.email ?? null, id: session.user.id, signOut: () => void signOut() })}</>;
}
