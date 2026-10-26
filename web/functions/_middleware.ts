// Cloudflare Pages middleware: only signed-in people get the apps (/app/*, /research/*,
// /sim/*, /trade/*, /academy/*, /lab/*) and the research data (/data/*). Everything else (the front page, /login/, /signup/,
// /reset/, /verify/, /brand/, favicons) is public. public/_routes.json limits this
// function to the protected paths, so public pages never run it. An address that does
// not exist gets dist/404.html with status 404 from Pages itself (DEC-0055).
//
// The browser's Supabase client keeps the session in a cookie (src/auth/client.ts).
// We check the access token's signature against the project's public keys (ES256,
// fetched from the JWKS address and cached by jose), its issuer, audience and expiry.
// The desktop app sends the same token as "Authorization: Bearer" (DEC-0041).
// No secret is needed. See auth/README.md.
import { createRemoteJWKSet, jwtVerify } from "jose";
import { mainHostFor, siteDomainOf, SITE_DOMAIN } from "../src/lib/meta";
import { wellKnown } from "../src/lib/mcp/wellknown";
import { appHashRedirect } from "../src/lib/notFound";

const SUPABASE_URL = "https://ttqvpxvctnomfbeoqbbs.supabase.co";
const ISSUER = `${SUPABASE_URL}/auth/v1`;
const COOKIE = "sb-ttqvpxvctnomfbeoqbbs-auth-token";
const JWKS = createRemoteJWKSet(new URL(`${ISSUER}/.well-known/jwks.json`));

interface Context {
  request: Request;
  next: (input?: Request) => Promise<Response>;
}

const PROTECTED = [/^\/app(\/|$)/, /^\/research(\/|$)/, /^\/sim(\/|$)/, /^\/trade(\/|$)/, /^\/academy(\/|$)/, /^\/lab(\/|$)/, /^\/data\//];

// Sim World, Parity Trade, Parity Academy and Parity Workbench have their own addresses,
// sim.<domain> (DEC-0016 follow-up), trade.<domain> (DEC-0040), academy.<domain> (DEC-0042)
// and lab.<domain> (DEC-0043): the front page of each is its app at /sim/, /trade/,
// /academy/ or /lab/, behind the same sign-in. Sign-in pages, brand files and built assets stay reachable there so
// logging in works; the other apps send people back to the main address.
const SUBSITES: Record<string, string> = { sim: "/sim/", trade: "/trade/", academy: "/academy/", lab: "/lab/" };
const SUBSITE_PUBLIC = /^\/(login|signup|reset|verify|assets|brand)(\/|$)|^\/(favicon|apple-touch-icon|icon-|manifest)/;
/** The main address on the request's own Parity domain: paritytrading.app (site.json,
 *  DEC-0038), or parity.endyland.com for a request still on the old domain (DEC-0067). */
export function mainHost(hostname: string): string {
  return mainHostFor(siteDomainOf(hostname) ?? SITE_DOMAIN);
}

export const onRequest = async ({ request, next }: Context): Promise<Response> => {
  const url = new URL(request.url);
  // Sign-in metadata for the hosted MCP server at /mcp (DEC-0051): public, on every host.
  if (url.pathname.startsWith("/.well-known/")) {
    const res = await wellKnown(request);
    if (res) return res;
  }
  let forward: Request | undefined;
  const sub = url.hostname.split(".")[0];
  const home = Object.hasOwn(SUBSITES, sub) && url.hostname.includes(".") ? SUBSITES[sub] : null;
  if (home) {
    const others = Object.values(SUBSITES).filter((p) => p !== home).map((p) => p.slice(1, -1));
    const away = new RegExp(`^/(${["app", "research", ...others].join("|")})(/|$)`);
    if (away.test(url.pathname)) {
      return Response.redirect(`https://${mainHost(url.hostname)}${url.pathname}${url.search}`, 302);
    }
    if (url.pathname === "/" || url.pathname === "/index.html") {
      forward = new Request(new URL(`${home}${url.search}`, url).toString(), request);
      url.pathname = home;
    } else if (SUBSITE_PUBLIC.test(url.pathname)) {
      return next();
    }
  }
  if (!PROTECTED.some((re) => re.test(url.pathname))) return next();

  // The desktop app (DEC-0041) has no cookie for this address: its main process sends the
  // same access token as a bearer header instead, checked the same way.
  const token = bearerToken(request.headers.get("Authorization")) ?? accessToken(request.headers.get("Cookie") ?? "");
  if (token && (await valid(token))) {
    const res = await next(forward);
    // Nothing at /<app>/<x>: the apps route by the hash, so open /<app>/#/<x>, where a real
    // page shows and anything else gets that app's "not found" view (DEC-0055). Files and
    // assets keep the 404, which Pages answers with dist/404.html.
    const to = res.status === 404 && (request.method === "GET" || request.method === "HEAD") ? appHashRedirect(url.pathname, url.search) : null;
    if (to) return new Response(null, { status: 302, headers: { Location: to, "Cache-Control": "private, no-store" } });
    const out = new Response(res.body, res);
    out.headers.set("Cache-Control", cacheFor(url.pathname, res.status));
    out.headers.append("Vary", "Cookie, Authorization");
    return out;
  }

  // A code file asked for without a valid session (an expired one, say) gets a plain 401,
  // never the log-in page in its place, so the app sees a failed file and can reload (REF-0024).
  if (url.pathname.startsWith("/data/") || HASHED.test(url.pathname)) {
    return new Response("Sign in to see this.", { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const login = new URL("/login/", url);
  login.searchParams.set("next", url.pathname + url.search);
  return new Response(null, { status: 302, headers: { Location: login.pathname + login.search, "Cache-Control": "no-store" } });
};

// Built files have a hash of their contents in the name (vite), so a copy never goes stale.
const HASHED = /^\/(app|research|sim|trade|academy|lab)\/assets\/[^/]+-[A-Za-z0-9_-]{8}\.(js|css|woff2?|png|svg|webp|jpg)$/;

/**
 * How long the browser may keep a signed-in answer. Hashed code files: a year without asking
 * again (they are still private, so no shared cache keeps them). Pages and data: ask each
 * time, which costs a small "not changed" answer when nothing changed.
 */
export function cacheFor(pathname: string, status = 200): string {
  if (status === 200 && HASHED.test(pathname)) return "private, max-age=31536000, immutable";
  return "private, no-cache";
}

async function valid(token: string): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, JWKS, { issuer: ISSUER, audience: "authenticated", clockTolerance: 30 });
    return typeof payload.sub === "string" && payload.role === "authenticated";
  } catch {
    return false;
  }
}

/** The token from an "Authorization: Bearer <token>" header, or null. */
export function bearerToken(header: string | null): string | null {
  const m = /^Bearer\s+([A-Za-z0-9._~+/=-]+)$/.exec((header ?? "").trim());
  return m ? m[1] : null;
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
