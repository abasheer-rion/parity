// The database calls behind /api/connect (DEC-0091), as Supabase RPCs made with the person's
// own session token, so every one runs as them: the functions read auth.uid() themselves and
// a person can only ever reach their own rows. No service-role key is used. The functions
// are in supabase/migrations/20261117100000_broker_connections.sql.
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "../mcp/auth";
import { ConnectError, type VenueId } from "./types";

export interface KeptConnection { venue: VenueId; env: "live" | "paper"; label: string; account_code: string | null; sealed: string; key_id: string }

export interface ConnectStore {
  /** Checks the rate limit and logs the read. Throws ConnectError(429) with the database's words. */
  begin(token: string, venue: VenueId, connection?: string | null): Promise<void>;
  log(token: string, venue: VenueId, event: "fetched" | "refused" | "failed", detail: string, connection?: string | null): Promise<void>;
  dataKey(token: string): Promise<{ sealed: string; key_id: string } | null>;
  putDataKey(token: string, sealed: string, keyId: string): Promise<{ sealed: string; key_id: string }>;
  save(token: string, c: { id: string; venue: VenueId; env: "live" | "paper"; label: string; account: string; sealed: string; keyId: string }): Promise<void>;
  open(token: string, id: string): Promise<KeptConnection | null>;
  synced(token: string, id: string, ok: boolean, detail: string): Promise<void>;
}

type Fetch = typeof fetch;

async function rpc<T>(f: Fetch, base: string, token: string, fn: string, args: Record<string, unknown>): Promise<T> {
  const res = await f(`${base}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(args),
  });
  const text = await res.text();
  if (!res.ok) {
    let message = "";
    try { const m = (JSON.parse(text) as { message?: unknown }).message; if (typeof m === "string" && m.length < 200) message = m; } catch { /* below */ }
    // The functions raise plain sentences for limits and refusals; anything else stays generic.
    if (res.status === 401 || res.status === 403) throw new ConnectError(401, message || "Sign in again.", "signed_out");
    if (message && /a day|an hour|Revoke one|not found or was revoked|Sign in|Connected apps/.test(message)) {
      throw new ConnectError(/an hour|a day/.test(message) ? 429 : 400, message, /an hour|a day/.test(message) ? "rate_limited" : "bad_input");
    }
    throw new ConnectError(503, "We could not save this right now. Try again in a minute.", "venue_down");
  }
  return (text ? JSON.parse(text) : null) as T;
}

export function supabaseConnectStore(f: Fetch = fetch, base = SUPABASE_URL): ConnectStore {
  return {
    begin: async (token, venue, connection = null) => { await rpc(f, base, token, "broker_fetch_begin", { p_venue: venue, p_connection: connection }); },
    log: async (token, venue, event, detail, connection = null) => {
      await rpc(f, base, token, "broker_event_log", { p_venue: venue, p_event: event, p_detail: detail.slice(0, 300), p_connection: connection });
    },
    dataKey: async (token) => (await rpc<{ sealed: string; key_id: string }[]>(f, base, token, "broker_data_key_get", {}))?.[0] ?? null,
    putDataKey: async (token, sealed, keyId) => {
      const rows = await rpc<{ sealed: string; key_id: string }[]>(f, base, token, "broker_data_key_put", { p_sealed: sealed, p_key_id: keyId });
      if (!rows?.[0]) throw new ConnectError(503, "We could not save this right now. Try again in a minute.", "venue_down");
      return rows[0];
    },
    save: async (token, c) => {
      await rpc(f, base, token, "broker_connection_save", { p_id: c.id, p_venue: c.venue, p_env: c.env, p_label: c.label, p_account: c.account, p_sealed: c.sealed, p_key_id: c.keyId });
    },
    open: async (token, id) => (await rpc<KeptConnection[]>(f, base, token, "broker_connection_open", { p_id: id }))?.[0] ?? null,
    synced: async (token, id, ok, detail) => { await rpc(f, base, token, "broker_connection_synced", { p_id: id, p_ok: ok, p_detail: detail.slice(0, 300) }); },
  };
}

/** The same calls kept in memory, for tests and the E2E suite. */
export function memoryConnectStore() {
  const events: { venue: string; event: string; detail?: string; connection?: string | null }[] = [];
  const kept = new Map<string, KeptConnection & { revoked?: boolean; userToken: string }>();
  let dataKey: { sealed: string; key_id: string } | null = null;
  const store: ConnectStore = {
    async begin(_t, venue, connection = null) {
      const n = events.filter((e) => e.event === "fetch").length;
      if (n >= 10) throw new ConnectError(429, "You can read from a broker 10 times an hour. Try again later.", "rate_limited");
      events.push({ venue, event: "fetch", connection });
    },
    async log(_t, venue, event, detail, connection = null) { events.push({ venue, event, detail, connection }); },
    async dataKey() { return dataKey; },
    async putDataKey(_t, sealed, keyId) { dataKey ??= { sealed, key_id: keyId }; return dataKey; },
    async save(t, c) {
      kept.set(c.id, { venue: c.venue, env: c.env, label: c.label, account_code: c.account, sealed: c.sealed, key_id: c.keyId, userToken: t });
      events.push({ venue: c.venue, event: "saved", connection: c.id });
    },
    async open(_t, id) { const k = kept.get(id); return k && !k.revoked ? k : null; },
    async synced(_t, id, ok, detail) { events.push({ venue: kept.get(id)?.venue ?? "", event: ok ? "synced" : "sync_failed", detail, connection: id }); },
  };
  return { store, events, kept };
}
