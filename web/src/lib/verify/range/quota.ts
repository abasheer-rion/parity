// The daily allowance for the fill price check (DEC-0092), counted by the database with the
// person's own session, so it counts them and nobody else. The function is in
// supabase/migrations/20261118000000_fill_checks.sql.
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "../../mcp/auth";
import { QuotaError, type FillQuota } from "./server";

export function supabaseFillQuota(f: typeof fetch = fetch, base = SUPABASE_URL): FillQuota {
  return {
    async take(token, fills) {
      const res = await f(`${base}/rest/v1/rpc/fill_check_take`, {
        method: "POST",
        headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ p_fills: fills }),
      });
      if (res.ok) return;
      let message = "";
      try { const m = (JSON.parse(await res.text()) as { message?: unknown }).message; if (typeof m === "string" && m.length < 200) message = m; } catch { /* below */ }
      if (res.status === 401 || res.status === 403) throw new QuotaError(message || "Sign in again.", 401);
      if (/a day|today/.test(message)) throw new QuotaError(message, 429);
      throw new Error("quota unavailable");
    },
  };
}

/** For tests and the E2E suite: counts in memory with the same limits as the database. */
export function memoryFillQuota(limit = { fills: 50_000, requests: 400 }): FillQuota & { used: () => { fills: number; requests: number } } {
  let fills = 0, requests = 0;
  return {
    async take(_token, n) {
      if (fills + n > limit.fills || requests + 1 > limit.requests) throw new QuotaError("You have used today's fill price checks (50,000 fills or 400 checks a day). Try again tomorrow.");
      fills += n; requests++;
    },
    used: () => ({ fills, requests }),
  };
}
