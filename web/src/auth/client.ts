// The one Supabase client for the browser. It keeps the session in a cookie (not only
// in local storage) so the site's middleware (web/functions/_middleware.ts) can check
// it before serving /app/ and /data/.
import { createBrowserClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { desktop } from "../desktop/bridge";
import { SITE_DOMAIN } from "../lib/meta";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./config";

const onSiteDomain = () => window.location.hostname === SITE_DOMAIN || window.location.hostname.endsWith(`.${SITE_DOMAIN}`);

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
    // On the site's domain (endyland.com, from src/lib/site.json) the session is shared by
    // the main address, sim.<domain> and trade.<domain>, so opening Sim World or Parity Trade
    // in its own tab needs no second sign-in. Elsewhere (pages.dev, localhost) the cookie
    // stays on the one host.
    ...(onSiteDomain() ? { domain: `.${SITE_DOMAIN}` } : {}),
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
