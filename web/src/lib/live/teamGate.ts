// Who may see team-only feeds (DEC-0056). Imported by the /live Pages Function, never by the
// browser. A person qualifies when their Supabase sign-in checks out (signature, issuer,
// audience, expiry: the same public-key check as the site middleware) AND the database says
// they are on the team list (public.team_members, through is_team(), which reads only the
// caller's own row). No secret is needed: the check runs as the person.
//
// The sign-in arrives three ways: the site's session cookie (same-site requests, including
// the WebSocket), an "Authorization: Bearer" header (history and lists from the desktop app),
// or a WebSocket sub-protocol "bearer.<token>" (the desktop app's WebSocket, which cannot set
// headers or carry the cookie). Tokens issued to AI apps (they carry a client_id) never count.
import { bearer, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, verifyToken } from "../mcp/auth";

const COOKIE = "sb-ttqvpxvctnomfbeoqbbs-auth-token";

/** Team membership answers, per person, for one minute in this isolate. */
const memo = new Map<string, { ok: boolean; at: number }>();
const MEMO_MS = 60_000;

export interface TeamPass { userId: string; until: number }

/** The access token in a request, from the header, the sub-protocol or the session cookie. */
export function tokenOf(req: Request): string | null {
  const h = bearer(req.headers.get("Authorization"));
  if (h) return h;
  const proto = (req.headers.get("Sec-WebSocket-Protocol") ?? "").split(",").map((p) => p.trim()).find((p) => p.startsWith("bearer."));
  if (proto) return proto.slice(7);
  return cookieToken(req.headers.get("Cookie") ?? "");
}

/** Reads the session cookie written by @supabase/ssr (maybe split into .0, .1, ...). */
export function cookieToken(header: string): string | null {
  const jar = new Map<string, string>();
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i > 0) { try { jar.set(part.slice(0, i).trim(), decodeURIComponent(part.slice(i + 1).trim())); } catch { /* skip a bad cookie */ } }
  }
  let raw = jar.get(COOKIE) ?? "";
  if (!raw) for (let n = 0; jar.has(`${COOKIE}.${n}`); n++) raw += jar.get(`${COOKIE}.${n}`);
  if (!raw) return null;
  try {
    const json = raw.startsWith("base64-") ? b64url(raw.slice(7)) : raw;
    const s = JSON.parse(json) as { access_token?: unknown };
    return typeof s.access_token === "string" ? s.access_token : null;
  } catch {
    return null;
  }
}

function b64url(s: string): string {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "=");
  return new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)));
}

/** The JWT's expiry in ms (already verified by the caller). */
function expiry(token: string): number {
  try { return Number((JSON.parse(b64url(token.split(".")[1])) as { exp?: number }).exp ?? 0) * 1000; } catch { return 0; }
}

/** Asks the database, as the person, whether they are on the team list. */
async function onTeam(token: string, fetcher: typeof fetch): Promise<boolean> {
  const res = await fetcher(`${SUPABASE_URL}/rest/v1/rpc/is_team`, {
    method: "POST",
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: "{}",
  });
  if (!res.ok) return false;
  return (await res.json()) === true;
}

/**
 * The person's team pass (who, and until when the sign-in holds), or null when they are not
 * signed in, the token is bad, it belongs to an AI app, or they are not on the team.
 */
export async function teamPass(req: Request, fetcher: typeof fetch = fetch, verify = verifyToken): Promise<TeamPass | null> {
  const token = tokenOf(req);
  if (!token) return null;
  const who = await verify(token);
  if (!who || who.clientId) return null;
  const until = expiry(token);
  if (!(until > Date.now())) return null;
  const hit = memo.get(who.userId);
  let ok: boolean;
  if (hit && Date.now() - hit.at < MEMO_MS) ok = hit.ok;
  else {
    try { ok = await onTeam(token, fetcher); } catch { ok = false; }
    if (memo.size > 1000) memo.clear();
    memo.set(who.userId, { ok, at: Date.now() });
  }
  return ok ? { userId: who.userId, until } : null;
}

/** Only for tests: forget cached answers. */
export const _forget = () => memo.clear();
