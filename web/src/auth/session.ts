// Session hooks shared by the app guard, the sign-in pages and Account settings.
import type { Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { supabase } from "./client";
import { ROUTES } from "./config";

export interface SessionState { loading: boolean; session: Session | null }

/** The current session, kept up to date as people sign in and out. */
export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({ loading: true, session: null });
  useEffect(() => {
    let live = true;
    supabase.auth.getSession().then(({ data }) => { if (live) setState({ loading: false, session: data.session }); });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (live) setState({ loading: false, session });
    });
    return () => { live = false; data.subscription.unsubscribe(); };
  }, []);
  return state;
}

/** True when the person has an authenticator app and has not yet typed its code. */
export async function needsSecondStep(): Promise<boolean> {
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  return Boolean(data && data.nextLevel === "aal2" && data.currentLevel !== "aal2");
}

/** Whether the signed-in person is on the team list. Only used for a badge. */
export function useTeamBadge(userId?: string): boolean {
  const [team, setTeam] = useState(false);
  useEffect(() => {
    if (!userId) return;
    supabase.from("members").select("email").limit(1).then(({ data }) => setTeam(Boolean(data?.length)));
  }, [userId]);
  return team;
}

export async function signOut() {
  await supabase.auth.signOut();
  window.location.assign(ROUTES.login);
}
