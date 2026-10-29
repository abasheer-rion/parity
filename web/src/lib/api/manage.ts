// /api/keys: making and rotating API keys from Settings, API keys (DEC-0071). Only these two
// need the server, because only the server holds the pepper. Listing and revoking happen in
// the browser through Supabase, where the row rules show a person only their own keys.
//
// Only Parity's own signed-in session may call this: a token issued to a connected AI app
// (it carries a client_id) is refused, so an app cannot mint itself a key.
import type { McpCaller } from "../mcp/auth";
import { originAllowed } from "../mcp/auth";
import { generateKey, hashKey, last4, MIN_PEPPER, prefixOf } from "./keys";
import { DEFAULT_EXPIRY_DAYS, EXPIRY_DAYS, isScope, MAX_ALLOWLIST, OVERLAP_HOURS, parseCidr } from "./policy";
import { forget, StoreError, type Created, type NewKeyArgs } from "./store";

export interface ManageDeps {
  pepper: string | undefined;
  siteDomain: string;
  verify(token: string): Promise<McpCaller | null>;
  create(token: string, a: NewKeyArgs): Promise<Created>;
  rotate(token: string, id: string, a: { last4: string; hash: string; overlapHours: number }): Promise<Created>;
  log?: (line: Record<string, unknown>) => void;
}

const HEADERS = { "Content-Type": "application/json", "Cache-Control": "no-store", "Strict-Transport-Security": "max-age=63072000; includeSubDomains", "X-Content-Type-Options": "nosniff" };
const reply = (status: number, body: unknown, extra: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers: { ...HEADERS, ...extra } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Checks the form's values. Returns the cleaned values or the first problem in plain words. */
export function readNewKey(body: unknown): { ok: true; name: string; scopes: NewKeyArgs["scopes"]; days: number; ip: string[] } | { ok: false; error: string } {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const name = typeof b.name === "string" ? b.name.trim() : "";
  if (name.length < 1 || name.length > 80) return { ok: false, error: "Give the key a name of 1 to 80 characters." };
  const scopes = Array.isArray(b.scopes) ? [...new Set(b.scopes)] : [];
  if (scopes.length === 0 || !scopes.every(isScope)) return { ok: false, error: "Pick at least one scope from the list." };
  const days = b.days === undefined ? DEFAULT_EXPIRY_DAYS : Number(b.days);
  if (!(EXPIRY_DAYS as readonly number[]).includes(days)) return { ok: false, error: `Expiry must be one of ${EXPIRY_DAYS.join(", ")} days.` };
  const rawIp = Array.isArray(b.ip) ? b.ip : [];
  const ip = rawIp.map((x) => (typeof x === "string" ? x.trim() : "")).filter(Boolean);
  if (ip.length > MAX_ALLOWLIST) return { ok: false, error: `At most ${MAX_ALLOWLIST} addresses.` };
  const badIp = ip.find((x) => !parseCidr(x));
  if (badIp) return { ok: false, error: `"${badIp.slice(0, 60)}" is not an IP address or range.` };
  return { ok: true, name, scopes: scopes as NewKeyArgs["scopes"], days, ip };
}

export async function handleKeys(request: Request, deps: ManageDeps): Promise<Response> {
  const url = new URL(request.url);
  const origin = request.headers.get("Origin");
  // Same-site only: the keys page is on our own domain, and this is not a public endpoint.
  if (!origin || !originAllowed(origin, deps.siteDomain)) return reply(403, { error: "Not allowed from this site." });
  if (request.method !== "POST") return reply(405, { error: "POST only" }, { Allow: "POST" });
  if (!deps.pepper || deps.pepper.length < MIN_PEPPER) return reply(503, { error: "API keys are not switched on yet." });
  const token = /^Bearer\s+(\S+)$/i.exec(request.headers.get("Authorization") ?? "")?.[1];
  const caller = token ? await deps.verify(token) : null;
  if (!caller || !token) return reply(401, { error: "Sign in first." });
  if (caller.clientId) return reply(403, { error: "Connected apps cannot make API keys." });
  let body: unknown;
  try { body = JSON.parse((await request.text()).slice(0, 20_000)); } catch { return reply(400, { error: "Send JSON." }); }

  const action = url.pathname.replace(/\/+$/, "").split("/").pop();
  const key = generateKey("pk_test_");
  const hash = await hashKey(key, deps.pepper);
  try {
    if (action === "keys") {
      const v = readNewKey(body);
      if (!v.ok) return reply(400, { error: v.error });
      const made = await deps.create(token, { name: v.name, scopes: v.scopes, days: v.days, prefix: prefixOf(key), last4: last4(key), hash, ip: v.ip });
      deps.log?.({ msg: "api key created", key_id: made.id });
      // The only time the key leaves the server. It is not stored anywhere in this form.
      return reply(201, { id: made.id, key, expires_at: made.expires_at });
    }
    if (action === "rotate") {
      const b = (body ?? {}) as Record<string, unknown>;
      const id = typeof b.id === "string" && UUID.test(b.id) ? b.id : null;
      const overlapHours = Number(b.overlap_hours ?? 24);
      if (!id) return reply(400, { error: "Say which key to rotate." });
      if (!(OVERLAP_HOURS as readonly number[]).includes(overlapHours)) return reply(400, { error: `Overlap must be one of ${OVERLAP_HOURS.join(", ")} hours.` });
      const made = await deps.rotate(token, id, { last4: last4(key), hash, overlapHours });
      deps.log?.({ msg: "api key rotated", key_id: made.id, from: id });
      return reply(201, { id: made.id, key, expires_at: made.expires_at });
    }
    return reply(404, { error: "Not found" });
  } catch (e) {
    if (e instanceof StoreError && e.status < 500) return reply(e.status === 401 ? 401 : 400, { error: e.message });
    deps.log?.({ msg: "api key change failed", error: String(e) });
    return reply(500, { error: "Could not save the key. Try again." });
  } finally {
    forget(hash);
  }
}
