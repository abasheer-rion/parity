// Session and membership hooks.
import type { Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { supabase } from "./client";

export interface SessionState { loading: boolean; session: Session | null }

/** The current Supabase session, kept up to date as people sign in and out. */
export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({ loading: true, session: null });
  useEffect(() => {
    if (!supabase) { setState({ loading: false, session: null }); return; }
    let live = true;
    supabase.auth.getSession().then(({ data }) => { if (live) setState({ loading: false, session: data.session }); });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (live) setState({ loading: false, session });
    });
    return () => { live = false; data.subscription.unsubscribe(); };
  }, []);
  return state;
}

export type Membership = "checking" | "member" | "not-member" | "error";

/**
 * Whether the signed-in person is on the team list (public.members). The database
 * makes the same check in every RLS policy; this only decides what screen to show.
 */
export function useMembership(session: Session | null): Membership {
  const [state, setState] = useState<Membership>("checking");
  const userId = session?.user.id;
  useEffect(() => {
    if (!supabase || !userId) { setState("checking"); return; }
    let live = true;
    setState("checking");
    supabase.rpc("is_member").then(({ data, error }) => {
      if (!live) return;
      setState(error ? "error" : data === true ? "member" : "not-member");
    });
    return () => { live = false; };
  }, [userId]);
  return state;
}

export function isVerified(session: Session | null): boolean {
  return Boolean(session?.user.email_confirmed_at);
}

export async function signOut() {
  await supabase?.auth.signOut();
  window.location.hash = "#/auth/sign-in";
}
