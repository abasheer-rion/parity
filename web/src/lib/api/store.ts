// The public API's few database calls (DEC-0071), as Supabase RPCs. Two kinds:
//   - as the person (their Parity session token): create and rotate a key. The functions
//     read auth.uid() themselves, so nobody can make a key for someone else.
//   - with no person (the publishable key only): look a key up, record usage, revoke a
//     leaked key. Each takes the key's HMAC, which only this server can work out because
//     only it holds the pepper, so the HMAC itself is the proof.
// No service-role secret is used anywhere. Lookups are cached for a minute (in this worker
// and in Cloudflare's cache, 30 seconds each) so the API does not read Supabase on every request.
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "../mcp/auth";
import { planOf, type ApiPlan, type Scope } from "./policy";

export interface KeyRecord {
  id: string;
  user_id: string;
  /** The stored HMAC, compared again in constant time by the caller. */
  key_hash: string;
  scopes: Scope[];
  ip_allowlist: string[] | null;
  expires_at: string;
  revoked_at: string | null;
  plan: ApiPlan;
  /** Requests already counted today across all the person's keys, when the record was read. */
  used_today: number;
}

export interface LogLine { at: string; method: string; path: string; status: number; ms: number }

export interface Store {
  lookup(hash: string): Promise<KeyRecord | null>;
  record(hash: string, requests: number, errors: number, log: LogLine[]): Promise<void>;
  revokeLeaked(hash: string, source: string): Promise<boolean>;
}

export interface Created { id: string; expires_at: string }

type Fetch = typeof fetch;

async function rpc<T>(f: Fetch, base: string, fn: string, args: Record<string, unknown>, token?: string): Promise<T> {
  const res = await f(`${base}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${token ?? SUPABASE_PUBLISHABLE_KEY}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(args),
  });
  const text = await res.text();
  if (!res.ok) {
    let message = `The database answered ${res.status}.`;
    try {
      const m = (JSON.parse(text) as { message?: unknown }).message;
      if (typeof m === "string" && m.length < 300) message = m;
    } catch { /* keep the status line */ }
    throw new StoreError(res.status, message);
  }
  return (text ? JSON.parse(text) : null) as T;
}

export class StoreError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

function toRecord(v: unknown): KeyRecord | null {
  if (!v || typeof v !== "object") return null;
  const r = v as Record<string, unknown>;
  if (typeof r.id !== "string" || typeof r.user_id !== "string" || typeof r.key_hash !== "string" || typeof r.expires_at !== "string" || !Array.isArray(r.scopes)) return null;
  return {
    id: r.id, user_id: r.user_id, key_hash: r.key_hash, expires_at: r.expires_at,
    scopes: r.scopes.filter((s): s is Scope => typeof s === "string") as Scope[],
    ip_allowlist: Array.isArray(r.ip_allowlist) ? r.ip_allowlist.filter((s): s is string => typeof s === "string") : null,
    revoked_at: typeof r.revoked_at === "string" ? r.revoked_at : null,
    plan: planOf(r.plan),
    used_today: typeof r.used_today === "number" ? r.used_today : 0,
  };
}

// 30 seconds in the worker and 30 in the edge cache: a revoke reaches everywhere within a minute.
const TTL_MS = 30_000;
const memo = new Map<string, { at: number; rec: KeyRecord | null }>();

/** Cloudflare's cache for this data centre, when there is one (not in tests or Node). */
function edgeCache(): Cache | null {
  const c = (globalThis as { caches?: { default?: Cache } }).caches;
  return c?.default ?? null;
}
const cacheUrl = (hash: string) => `https://api-key-cache.parity.invalid/${hash}`;

export function supabaseStore(f: Fetch = fetch, base = SUPABASE_URL, now: () => number = Date.now): Store {
  return {
    async lookup(hash) {
      const hit = memo.get(hash);
      if (hit && now() - hit.at < TTL_MS) return hit.rec;
      const edge = edgeCache();
      if (edge) {
        const res = await edge.match(cacheUrl(hash)).catch(() => undefined);
        if (res) {
          const rec = toRecord(await res.json().catch(() => null));
          memo.set(hash, { at: now(), rec });
          return rec;
        }
      }
      const rec = toRecord(await rpc<unknown>(f, base, "api_key_lookup", { p_hash: hash }));
      if (memo.size > 2_000) memo.clear();
      memo.set(hash, { at: now(), rec });
      if (edge) {
        await edge.put(cacheUrl(hash), new Response(JSON.stringify(rec), { headers: { "Content-Type": "application/json", "Cache-Control": "max-age=30" } })).catch(() => undefined);
      }
      return rec;
    },
    async record(hash, requests, errors, log) {
      await rpc(f, base, "api_key_record", { p_hash: hash, p_requests: requests, p_errors: errors, p_log: log.slice(-100) });
    },
    async revokeLeaked(hash, source) {
      const ok = await rpc<boolean>(f, base, "api_key_revoke_leaked", { p_hash: hash, p_source: source.slice(0, 200) });
      memo.delete(hash);
      await edgeCache()?.delete(cacheUrl(hash)).catch(() => undefined);
      return ok === true;
    },
  };
}

/** Forget a cached lookup in this worker (after a revoke or rotate made here). */
export const forget = (hash: string) => { memo.delete(hash); void edgeCache()?.delete(cacheUrl(hash)).catch(() => undefined); };

export interface NewKeyArgs { name: string; scopes: Scope[]; days: number; prefix: string; last4: string; hash: string; ip: string[] }

export async function createKey(token: string, a: NewKeyArgs, f: Fetch = fetch, base = SUPABASE_URL): Promise<Created> {
  return rpc<Created>(f, base, "api_key_create", { p_name: a.name, p_scopes: a.scopes, p_days: a.days, p_prefix: a.prefix, p_last4: a.last4, p_hash: a.hash, p_ip: a.ip }, token);
}

export async function rotateKey(token: string, id: string, a: { last4: string; hash: string; overlapHours: number }, f: Fetch = fetch, base = SUPABASE_URL): Promise<Created> {
  return rpc<Created>(f, base, "api_key_rotate", { p_id: id, p_last4: a.last4, p_hash: a.hash, p_overlap_hours: a.overlapHours }, token);
}
