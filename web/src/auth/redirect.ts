// Where to send someone after they sign in, and which addresses are safe to send them to.
//
// The ?next= value comes from the address bar, so anyone can write it. We only follow it
// when it points at this site or at https://<something>.<site domain> (Parity and Sim
// World share the sign-in there). Everything else falls back to the app. This file has no
// browser globals at import time, so the tests can run it directly.

import { ORIGIN, SITE_DOMAIN } from "../lib/meta";

/** Pages that must never be a "next" target, or signing in would loop back to them. */
const AUTH_PAGES = /^\/(login|signup|reset|verify)(\/|$)/;

/** The parent domain whose subdomains share the session cookie (src/auth/client.ts), from src/lib/site.json. */
export { SITE_DOMAIN };

export const DEFAULT_NEXT = "/app/";

interface Here { origin: string; hostname: string }

function here(): Here {
  return { origin: window.location.origin, hostname: window.location.hostname };
}

/**
 * A URL's origin. The desktop app's pages live at app://parity (DEC-0041); a URL parser
 * that does not know the scheme reports its origin as "null", so it is rebuilt here.
 */
function originOf(url: URL): string {
  return url.origin !== "null" ? url.origin : `${url.protocol}//${url.host}`;
}

/** True for https://endyland.com and https://<anything>.endyland.com on the default port. */
export function isSiteHost(url: URL): boolean {
  const host = url.hostname.toLowerCase();
  return url.protocol === "https:" && url.port === "" && (host === SITE_DOMAIN || host.endsWith(`.${SITE_DOMAIN}`));
}

/**
 * The safe place to go after signing in. Accepts a same-site path ("/research/#/docs",
 * "/sim/") or an https://*.endyland.com address. Returns a path for this site, or a full
 * address for another endyland.com host. Anything else returns `fallback`.
 */
export function safeNext(raw: string | null | undefined, at: Here = here(), fallback = DEFAULT_NEXT): string {
  if (!raw) return fallback;
  const value = raw.trim();
  // Backslashes and control characters are how "/\evil.com" and "/%09/evil.com" tricks start.
  // eslint-disable-next-line no-control-regex
  if (!value || /[\\\u0000-\u001f\u007f]/.test(value)) return fallback;

  let url: URL;
  if (value.startsWith("/")) {
    if (value.startsWith("//")) return fallback;
    try { url = new URL(value, at.origin); } catch { return fallback; }
    if (originOf(url) !== at.origin) return fallback;
  } else {
    try { url = new URL(value); } catch { return fallback; }
    if (url.username || url.password) return fallback;
    if (originOf(url) !== at.origin && !isSiteHost(url)) return fallback;
  }

  if (AUTH_PAGES.test(url.pathname)) return fallback;
  // "/" on the main site is the public front page; after signing in, the app is wanted.
  // On sim.<domain>, trade.<domain>, academy.<domain> and lab.<domain>, "/" is that app itself, so it stays.
  const path = url.pathname === "/" && !/^(sim|trade|academy|lab)\./.test(url.hostname) ? DEFAULT_NEXT : url.pathname;
  const rest = path + url.search + url.hash;
  return originOf(url) === at.origin ? rest : `${url.origin}${rest}`;
}

/**
 * The ?next= of the current page, made safe. The sign-in check on the server only sees
 * the path and query, so it sends /app/#/strategy/x to /login/?next=/app/ and the browser
 * carries the #/strategy/x over to /login/ by itself (DEC-0038). That hash is put back on
 * the end of next here, so signing in lands on the exact page. Only in-app routes (#/...)
 * are carried, never a hash a sign-in provider may leave behind.
 */
export function nextFromQuery(search: string = window.location.search, at: Here = here(), hash: string = window.location.hash): string {
  return safeNext(withHash(new URLSearchParams(search).get("next"), hash), at);
}

/** Puts an in-app hash (#/...) on the end of a next path that has none. */
export function withHash(next: string | null, hash: string): string | null {
  if (!next || !hash.startsWith("#/") || next.includes("#")) return next;
  return next + hash;
}

/** Adds ?next= to an internal link (sign-up, reset), unless it is the default. */
export function withNext(path: string, next: string): string {
  if (!next || next === DEFAULT_NEXT) return path;
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}next=${encodeURIComponent(next)}`;
}

/**
 * The address put in auth emails as Supabase's redirect_to. The email templates add it
 * to their link as `&next={{ .RedirectTo }}`, so it must be a plain absolute address with
 * no query or fragment. Supabase only keeps it when it is on the redirect allow-list
 * (auth/CHECKLIST.md); otherwise it uses the Site URL, and /verify/ falls back to the app.
 */
export function emailLanding(next: string, at: Here = here()): string {
  const safe = safeNext(next, at);
  // The desktop app's pages live at app://parity (DEC-0041), which no email can link to:
  // the email then lands on the website, where the same account signs in.
  const base = /^https?:$/.test(new URL(at.origin).protocol) ? at.origin : ORIGIN;
  const url = new URL(safe, base);
  return `${url.origin}${url.pathname}`;
}
