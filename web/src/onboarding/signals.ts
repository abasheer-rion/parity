// Live signals for the getting started checklist (DEC-0053): has the person already done each
// thing? Every read goes through the person's own session and row rules, so it sees only
// their rows. A read that fails counts as "not yet", never as done.
import type { Signals } from "./items";

type Client = typeof import("../auth/client").supabase;

async function safe<T>(f: () => Promise<T>, fallback: T): Promise<T> {
  try { return await f(); } catch { return fallback; }
}

type Filter = { neq?: [string, string]; notNull?: string };

async function count(sb: Client, table: string, f: Filter = {}): Promise<number> {
  let q = sb.from(table).select("id", { count: "exact", head: true });
  if (f.neq) q = q.neq(f.neq[0], f.neq[1]);
  if (f.notNull) q = q.not(f.notNull, "is", null);
  const { count: n, error } = await q;
  if (error) throw error;
  return n ?? 0;
}

/** Signals from Supabase for the signed-in person. */
export async function remoteSignals(sb: Client): Promise<Signals & { mfaAvailable: boolean }> {
  const { data } = await sb.auth.getSession();
  const user = data.session?.user;
  if (!user) return { mfaAvailable: true };
  const [factors, grants, appCalls, orders, alerts, lists, lessons, wallets] = await Promise.all([
    safe(async () => { const r = await sb.auth.mfa.listFactors(); return r.error ? null : r.data; }, null),
    // Approved AI apps, from Supabase's OAuth server; an approval is what issues the first token.
    safe(async () => { const r = await sb.auth.oauth.listGrants(); return r.error ? 0 : (r.data ?? []).length; }, 0),
    // A call from an AI app (anything but Parity's own assistant panel) means it holds a token.
    safe(() => count(sb, "mcp_calls", { neq: ["client_id", "parity-web"] }), 0),
    safe(() => count(sb, "paper_orders"), 0),
    safe(() => count(sb, "trade_alerts"), 0),
    safe(() => count(sb, "trade_watchlists"), 0),
    safe(() => count(sb, "academy_progress", { notNull: "done_at" }), 0),
    safe(() => count(sb, "crypto_wallets"), 0),
  ]);
  return {
    email: !!(user.email_confirmed_at ?? user.confirmed_at),
    mfa: !!factors?.all?.some((f) => f.factor_type === "totp" && f.status === "verified"),
    mfaAvailable: factors !== null,
    ai: grants > 0 || appCalls > 0,
    trade: orders > 0,
    // Trade gives everyone one starter list, so a second list or any alert is the person's own.
    watch: alerts > 0 || lists > 1,
    lesson: lessons > 0,
    wallet: wallets > 0,
  };
}

function localRows(table: string): unknown[] {
  try {
    const raw = window.localStorage.getItem(`parity.demo.${table}`);
    const rows = raw ? JSON.parse(raw) : [];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

/** Signals for the local preview (no Supabase user): the same tables, from this browser. */
export function localSignals(): Signals & { mfaAvailable: boolean } {
  const lessons = localRows("academy_progress").filter((r) => !!(r as { done_at?: string | null }).done_at);
  return {
    email: true,
    mfa: false,
    mfaAvailable: true,
    ai: false,
    trade: localRows("paper_orders").length > 0,
    watch: localRows("trade_alerts").length > 0 || localRows("trade_watchlists").length > 1,
    lesson: lessons.length > 0,
    wallet: localRows("crypto_wallets").length > 0,
  };
}
