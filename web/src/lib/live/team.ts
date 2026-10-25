// Is the signed-in person on the team (DEC-0053)? The edge answers at /live/me after checking
// the sign-in and the team list. The page uses it only to decide what to offer (the team-only
// feeds in search, the Markets venues); the edge enforces it on every connection anyway.
import { useEffect, useState } from "react";
import { liveOrigin } from "./client";

export interface TeamInfo { team: boolean; sources: string[] }

let teamP: Promise<TeamInfo> | null = null;

const httpOrigin = () => liveOrigin()?.replace(/^ws/, "http") ?? null;

/** Headers for a team-only request: the bearer token (the desktop app has no cookie here). */
export async function teamHeaders(): Promise<Record<string, string>> {
  try {
    const { supabase } = await import("../../auth/client");
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ? { Authorization: `Bearer ${data.session.access_token}` } : {};
  } catch {
    return {};
  }
}

export function loadTeam(): Promise<TeamInfo> {
  const o = httpOrigin();
  if (!o) return Promise.resolve({ team: false, sources: [] });
  teamP ??= teamHeaders()
    .then((headers) => fetch(`${o}/live/me`, { headers, credentials: "include" }))
    .then((r) => (r.ok ? (r.json() as Promise<TeamInfo>) : { team: false, sources: [] }))
    .then((d) => ({ team: d.team === true, sources: Array.isArray(d.sources) ? d.sources : [] }))
    .catch(() => ({ team: false, sources: [] }));
  return teamP;
}

/** The team answer for this page, null until it arrives. */
export function useTeam(): TeamInfo | null {
  const [t, setT] = useState<TeamInfo | null>(null);
  useEffect(() => { let live = true; void loadTeam().then((d) => { if (live) setT(d); }); return () => { live = false; }; }, []);
  return t;
}
