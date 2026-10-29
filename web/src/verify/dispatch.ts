// /verify/ has two jobs (DEC-0081). Every email link Supabase sends lands here
// (/verify/?type=...&token_hash=...&next=..., src/auth/config.ts), and links already sent
// must keep working. Any other visit is the public Verify checker. This decides which,
// from the query and the hash only. No browser globals, so tests can call it directly.

/** Parameters that only a sign-in link carries, in the query or in the hash. */
export const AUTH_KEYS = ["token_hash", "type", "code", "error", "error_description", "access_token"] as const;

export function isAuthLink(search: string, hash: string): boolean {
  const h = hash.replace(/^#/, "");
  // "#access_token=...&type=signup" (implicit sign-in) and "#/?mode=describe" (the checker's own state).
  const lists = [new URLSearchParams(search), new URLSearchParams(h.replace(/^\//, "")), new URLSearchParams(h.split("?")[1] ?? "")];
  return AUTH_KEYS.some((k) => lists.some((q) => q.has(k)));
}
