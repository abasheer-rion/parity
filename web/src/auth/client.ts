// The one Supabase client for the browser. It keeps the session in a cookie (not only
// in local storage) so the site's middleware (web/functions/_middleware.ts) can check
// it before serving /app/ and /data/.
import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./config";

export const supabase = createBrowserClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  cookieOptions: {
    path: "/",
    // On endyland.com the session is shared by parity.endyland.com and sim.endyland.com,
    // so opening Sim World in its own tab needs no second sign-in. Elsewhere (pages.dev,
    // localhost) the cookie stays on the one host.
    ...(window.location.hostname.endsWith(".endyland.com") ? { domain: ".endyland.com" } : {}),
    sameSite: "lax",
    secure: window.location.protocol === "https:",
    maxAge: 60 * 60 * 24 * 30,
  },
  auth: { flowType: "pkce", detectSessionInUrl: true, persistSession: true, autoRefreshToken: true },
});

/** Kept for the pages written before the client was always present. */
export function requireClient() {
  return supabase;
}

/** Plain-words messages for sign-in errors (errors.ts). */
export { explain } from "./errors";
