// Cloudflare Pages middleware: only signed-in people get the app (/app/*) and the
// research data (/data/*). Everything else (the front page, /login/, /signup/,
// /reset/, /verify/, /brand/, favicons) is public. public/_routes.json limits this
// function to the protected paths, so public pages never run it.
//
// The browser's Supabase client keeps the session in a cookie (src/auth/client.ts).
// We check the access token's signature against the project's public keys (ES256,
// fetched from the JWKS address and cached by jose), its issuer, audience and expiry.
// No secret is needed. See auth/README.md.
import { createRemoteJWKSet, jwtVerify } from "jose";

const SUPABASE_URL = "https://ttqvpxvctnomfbeoqbbs.supabase.co";
const ISSUER = `${SUPABASE_URL}/auth/v1`;
const COOKIE = "sb-ttqvpxvctnomfbeoqbbs-auth-token";
const JWKS = createRemoteJWKSet(new URL(`${ISSUER}/.well-known/jwks.json`));

interface Context {
  request: Request;
  next: () => Promise<Response>;
}

const PROTECTED = [/^\/app(\/|$)/, /^\/research(\/|$)/, /^\/data\//];

export const onRequest = async ({ request, next }: Context): Promise<Response> => {
  const url = new URL(request.url);
  if (!PROTECTED.some((re) => re.test(url.pathname))) return next();

  const token = accessToken(request.headers.get("Cookie") ?? "");
  if (token && (await valid(token))) {
    const res = await next();
    const out = new Response(res.body, res);
    out.headers.set("Cache-Control", "private, no-cache");
    out.headers.append("Vary", "Cookie");
    return out;
  }

  if (url.pathname.startsWith("/data/")) {
    return new Response("Sign in to see this.", { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const login = new URL("/login/", url);
  login.searchParams.set("next", url.pathname + url.search);
  return new Response(null, { status: 302, headers: { Location: login.pathname + login.search, "Cache-Control": "no-store" } });
};

async function valid(token: string): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, JWKS, { issuer: ISSUER, audience: "authenticated", clockTolerance: 30 });
    return typeof payload.sub === "string" && payload.role === "authenticated";
  } catch {
    return false;
  }
}

/** Reads the session cookie written by @supabase/ssr (maybe split into .0, .1, ...). */
export function accessToken(header: string): string | null {
  const jar = new Map<string, string>();
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i > 0) jar.set(part.slice(0, i).trim(), decodeURIComponent(part.slice(i + 1).trim()));
  }
  let raw = jar.get(COOKIE) ?? "";
  if (!raw) {
    for (let n = 0; jar.has(`${COOKIE}.${n}`); n++) raw += jar.get(`${COOKIE}.${n}`);
  }
  if (!raw) return null;
  try {
    const json = raw.startsWith("base64-") ? fromBase64Url(raw.slice(7)) : raw;
    const session = JSON.parse(json) as { access_token?: unknown };
    return typeof session.access_token === "string" ? session.access_token : null;
  } catch {
    return null;
  }
}

function fromBase64Url(s: string): string {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "=");
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
