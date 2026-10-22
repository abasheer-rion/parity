// Session hooks shared by the app guard, the sign-in pages and Account settings.
import type { Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { supabase } from "./client";
import { ROUTES } from "./config";
import { goPush } from "./nav";
import { withNext } from "./redirect";

export interface SessionState { loading: boolean; session: Session | null }

/** The current session, kept up to date as people sign in and out. */
export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({ loading: true, session: null });
  useEffect(() => {
    let live = true;
    supabase.auth.getSession()
      .then(({ data }) => { if (live) setState({ loading: false, session: data.session }); })
      .catch(() => { if (live) setState({ loading: false, session: null }); });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (live) setState({ loading: false, session });
    });
    return () => { live = false; data.subscription.unsubscribe(); };
  }, []);
  return state;
}

/** True when the person has an authenticator app and has not yet typed its code. */
export async function needsSecondStep(): Promise<boolean> {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) throw error;
  return Boolean(data && data.nextLevel === "aal2" && data.currentLevel !== "aal2");
}

/** The log-in page's second step, keeping where the person was going. */
export function secondStepUrl(next: string): string {
  return withNext(`${ROUTES.login}?mfa=1`, next);
}

/**
 * After any successful sign-in (password, code, email link, provider): ask for the
 * authenticator code if the account has one, otherwise go where the person was going.
 */
export async function continueTo(next: string, go: (to: string) => void): Promise<"second-step" | "done"> {
  if (await needsSecondStep()) return "second-step";
  go(next);
  return "done";
}

/** Whether the signed-in person is on the team list. Only used for a badge. */
export function useTeamBadge(userId?: string): boolean {
  const [team, setTeam] = useState(false);
  useEffect(() => {
    if (!userId) return;
    supabase.from("members").select("email").limit(1).then(({ data }) => setTeam(Boolean(data?.length)), () => setTeam(false));
  }, [userId]);
  return team;
}

/**
 * Signs out in this browser and goes to the log-in page. If the server cannot be
 * reached, the local session is still cleared, so the person is never stuck signed in.
 */
export async function signOut() {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) await supabase.auth.signOut({ scope: "local" });
  } catch {
    await supabase.auth.signOut({ scope: "local" }).catch(() => {});
  }
  goPush(ROUTES.login);
}
