// The guard. Loaded only when VITE_APP_AUTH=on. It shows the sign-in pages until there
// is a session with a confirmed email whose address is on the team list, then renders
// the app. The database checks the same team list on every read (RLS), so this screen
// is about what people see, not what they can fetch.
import { useEffect, useState, type ReactNode } from "react";
import { Button, Toaster } from "../ui";
import { supabase } from "./client";
import { ROUTES } from "./config";
import { AuthCard } from "./form";
import { Forgot } from "./pages/Forgot";
import { Reset } from "./pages/Reset";
import { CheckEmail, SignUp } from "./pages/SignUp";
import { SignIn } from "./pages/SignIn";
import { Verify } from "./pages/Verify";
import { isVerified, signOut, useMembership, useSession } from "./session";

function useRoute(): string {
  const read = () => (window.location.hash.split("?")[0] || "#/");
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const on = () => setRoute(read());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}

export default function AuthGate({ children }: { children: (user: { email: string | null; signOut: () => void }) => ReactNode }) {
  const route = useRoute();
  const state = useSession();
  const { session } = state;
  const membership = useMembership(session && isVerified(session) ? session : null);

  const page = ((): ReactNode => {
    if (!supabase) {
      return (
        <AuthCard title="Sign-in is not set up" lead="This build has in-app sign-in switched on but no Supabase key. Set VITE_SUPABASE_ANON_KEY and rebuild (auth/README.md).">
          <span />
        </AuthCard>
      );
    }
    // These two work whether or not someone is signed in.
    if (route === ROUTES.verify) return <Verify />;
    if (route === ROUTES.reset) return <Reset session={state} />;
    if (state.loading) return <div className="auth-splash">Loading</div>;

    if (!session) {
      if (route === ROUTES.signUp) return <SignUp />;
      if (route === ROUTES.forgot) return <Forgot />;
      return <SignIn />;
    }
    if (!isVerified(session)) return <CheckEmail email={session.user.email ?? ""} />;
    if (membership === "checking") return <div className="auth-splash">Checking your access</div>;
    if (membership !== "member") {
      return (
        <AuthCard
          title={membership === "error" ? "Could not check your access" : "Not on the team list yet"}
          lead={membership === "error"
            ? "We could not reach the team list. Try again in a minute."
            : <>You are signed in as <strong>{session.user.email}</strong>, but this address is not on the Parity team list. Ask the owner to add it.</>}>
          <Button size="lg" full onClick={() => void signOut()}>Sign out</Button>
        </AuthCard>
      );
    }
    return null;
  })();

  // Signed-in members who land on a sign-in page go to the app.
  const ready = page === null;
  useEffect(() => {
    if (ready && route.startsWith("#/auth/")) window.location.hash = "#/";
  }, [ready, route]);

  if (!ready) return <>{page}<Toaster /></>;
  return <>{children({ email: session?.user.email ?? null, signOut: () => void signOut() })}</>;
}
