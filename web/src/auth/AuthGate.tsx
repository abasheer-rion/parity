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

export function AppGuard({ children }: { children: (user: { email: string | null; id: string | null; signOut: () => void }) => ReactNode }) {
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
