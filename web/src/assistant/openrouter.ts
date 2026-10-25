// Connecting an OpenRouter account with OAuth and PKCE (DEC-0049), the one provider with a
// public sign-in that lets an app call models on the person's own bill without registering
// the app first. Docs: https://openrouter.ai/docs/guides/overview/auth/oauth
//
//   1. start(): make a random verifier, keep it in this tab's session storage, and send the
//      person to openrouter.ai/auth with its SHA-256 challenge and our callback address.
//   2. The person signs in at OpenRouter and approves. OpenRouter sends them back to
//      /oauth/openrouter/?code=... on the same address they started from.
//   3. finish(): swap the code and the verifier for a key the person owns, and keep it in
//      this browser only (keys.ts). Parity's servers never see the code or the key.
import { writeKey } from "./keys";

const AUTH_URL = "https://openrouter.ai/auth";
const KEYS_URL = "https://openrouter.ai/api/v1/auth/keys";
const VERIFIER = "parity.ai.openrouter.verifier";
const RETURN = "parity.ai.openrouter.return";

function base64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function newVerifier(): string {
  const bytes = new Uint8Array(48);
  crypto.getRandomValues(bytes);
  return base64url(bytes);
}

export async function challengeFor(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64url(new Uint8Array(digest));
}

export const callbackUrl = (origin: string) => `${origin}/oauth/openrouter/`;

/** The address to send the person to. Also remembers where to bring them back. */
export async function startUrl(origin: string, returnTo: string, store: Storage = sessionStorage): Promise<string> {
  const verifier = newVerifier();
  store.setItem(VERIFIER, verifier);
  store.setItem(RETURN, returnTo);
  const q = new URLSearchParams({ callback_url: callbackUrl(origin), code_challenge: await challengeFor(verifier), code_challenge_method: "S256" });
  return `${AUTH_URL}?${q}`;
}

/** Only paths on this address: never send the person somewhere a link chose. */
function safeReturn(raw: string | null): string {
  return raw && raw.startsWith("/") && !raw.startsWith("//") && !raw.includes("\\") ? raw : "/";
}

export type Finish = { ok: true; returnTo: string } | { ok: false; message: string; returnTo: string };

export async function finish(code: string | null, store: Storage = sessionStorage, f: typeof fetch = fetch): Promise<Finish> {
  const verifier = store.getItem(VERIFIER);
  const returnTo = safeReturn(store.getItem(RETURN));
  store.removeItem(VERIFIER);
  store.removeItem(RETURN);
  if (!code) return { ok: false, message: "OpenRouter did not send a code back. Try connecting again.", returnTo };
  if (!verifier) return { ok: false, message: "This tab did not start the connection, so it cannot finish it. Start again from the assistant panel.", returnTo };
  try {
    const res = await f(KEYS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, code_verifier: verifier, code_challenge_method: "S256" }),
    });
    const body = (await res.json().catch(() => ({}))) as { key?: unknown };
    if (!res.ok || typeof body.key !== "string" || !body.key) {
      return { ok: false, message: `OpenRouter refused the connection (${res.status}). Try again.`, returnTo };
    }
    writeKey("openrouter", body.key);
    return { ok: true, returnTo };
  } catch {
    return { ok: false, message: "Could not reach OpenRouter. Check the connection and try again.", returnTo };
  }
}
