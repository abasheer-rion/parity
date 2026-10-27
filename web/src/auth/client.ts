// The one Supabase client for the browser. It keeps the session in a cookie (not only
// in local storage) so the site's middleware (web/functions/_middleware.ts) can check
// it before serving /app/ and /data/.
import { createBrowserClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { desktop } from "../desktop/bridge";
import { siteDomainOf } from "../lib/meta";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./config";

// The Parity domain this page is on: paritytrading.app, or endyland.com while it redirects (DEC-0069).
const cookieDomain = () => siteDomainOf(window.location.hostname);

// The desktop app (DEC-0041) loads the live site when online (DEC-0048), and there the
// session is the site's cookie like in any browser. Offline it shows its bundled copy from
// app://parity, where there is no middleware to read a cookie: there the session lives in
// the app's own storage, which survives restarts, and the access token goes to the main
// process for /data/ requests.
const bundledInDesktop = () => desktop !== null && window.location.protocol === "app:";

function desktopClient(): SupabaseClient {
  const client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { flowType: "pkce", detectSessionInUrl: true, persistSession: true, autoRefreshToken: true, storage: window.localStorage },
  });
  client.auth.onAuthStateChange((_event, session) => desktop?.setToken(session?.access_token ?? null));
  return client;
}

export const supabase: SupabaseClient = bundledInDesktop() ? desktopClient() : createBrowserClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  cookieOptions: {
    path: "/",
    // On the site's domain (paritytrading.app, from src/lib/site.json) the session is shared
    // by the main address and every app's subdomain, so opening one in its own tab needs no
    // second sign-in. An old domain (endyland.com) keeps its own shared cookie until its
    // addresses redirect. Elsewhere (pages.dev, localhost) the cookie stays on the one host.
    ...(cookieDomain() ? { domain: `.${cookieDomain()}` } : {}),
    sameSite: "lax",
    secure: window.location.protocol === "https:",
    maxAge: 60 * 60 * 24 * 30,
  },
  auth: { flowType: "pkce", detectSessionInUrl: true, persistSession: true, autoRefreshToken: true },
});

// On the live site inside the desktop app, the main process still gets the token, so the
// bundled copy can fetch /data/ if the connection drops mid-session.
if (desktop && !bundledInDesktop()) {
  supabase.auth.onAuthStateChange((_event, session) => desktop?.setToken(session?.access_token ?? null));
}

/** Kept for the pages written before the client was always present. */
export function requireClient() {
  return supabase;
}

/** Plain-words messages for sign-in errors (errors.ts). */
export { explain } from "./errors";
