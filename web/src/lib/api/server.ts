// The Parity public API at /api/v1/ (DEC-0071). Callers send "Authorization: Bearer
// pk_test_..."; we check the key's shape and checksum, look up its HMAC (cached for a minute),
// then its expiry, revocation, IP allowlist, scope and rate limits, and only then run the
// endpoint. Every endpoint reads the files the site already publishes (/data/..., cached in
// the worker) through the same code as the hosted MCP server, so the API never queries
// Supabase for market or research data. Errors are RFC 9457 problem details. The key itself
// is never logged, stored or echoed: logs carry the key's id only.
import { byName, NOTE, seriesRow, termIndex, ToolError, type Data, type Db, type ToolContext } from "../mcp/tools";
import { check, type Schema } from "../mcp/schema";
import { originAllowed } from "../mcp/auth";
import { liveSources } from "../live/sources";
import { METHOD_VERSION } from "../verify/types";
import { bearer, constantTimeEqual, hashKey, MIN_PEPPER, wellFormed } from "./keys";
import { ipAllowed, LIMITS, MinuteLimiter, SCOPE_TEXT, type Scope } from "./policy";
import { StoreError, type KeyRecord, type LogLine, type Store } from "./store";
import { openApi } from "./openapi";

export const API_BASE = "/api/v1";
export const MAX_BODY = 1_000_000;

export interface ApiDeps {
  /** PARITY_API_KEY_PEPPER, or undefined while it is not set (the API answers 503). */
  pepper: string | undefined;
  store: Store;
  data: Data;
  siteDomain: string;
  /** The site's public origin, for links in problem details and docs. */
  site: string;
  limiter?: MinuteLimiter;
  missLimiter?: MinuteLimiter;
  now?: () => number;
  waitUntil?: (p: Promise<unknown>) => void;
  log?: (line: Record<string, unknown>) => void;
}

// ---------------------------------------------------------------- problem details

const SECURITY_HEADERS: Record<string, string> = {
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
  Vary: "Origin",
};

export function problem(site: string, status: number, slug: string, title: string, detail?: string, headers: Record<string, string> = {}, extra: Record<string, unknown> = {}): Response {
  const body = { type: `${site}/developers/#problem-${slug}`, title, status, ...(detail ? { detail } : {}), ...extra };
  return new Response(JSON.stringify(body), { status, headers: { ...SECURITY_HEADERS, "Content-Type": "application/problem+json", ...headers } });
}

function ok(body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { ...SECURITY_HEADERS, "Content-Type": "application/json", ...headers } });
}

// ---------------------------------------------------------------- routes

interface Route {
  method: "GET" | "POST";
  /** Path after /api/v1, with {name} for one path segment. */
  path: string;
  scope: Scope;
  summary: string;
  /** An old path kept so callers do not break; the spec marks it deprecated. */
  deprecated?: boolean;
  run(args: { params: Record<string, string>; query: URLSearchParams; body: unknown }, ctx: ToolContext): Promise<unknown>;
}

/** Query text to the types a tool's input schema asks for. Unknown names are dropped. */
function argsFrom(query: URLSearchParams, schema: Schema, names: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const name of names) {
    const raw = query.get(name);
    if (raw === null) continue;
    const t = schema.properties?.[name]?.type;
    if (t === "integer" || t === "number") out[name] = /^-?\d+(\.\d+)?$/.test(raw) ? Number(raw) : raw;
    else if (t === "boolean") out[name] = raw === "true" ? true : raw === "false" ? false : raw;
    else out[name] = raw;
  }
  return out;
}

function viaTool(tool: string, names: string[], fromParams: (p: Record<string, string>) => Record<string, unknown> = () => ({})) {
  return async (a: { params: Record<string, string>; query: URLSearchParams; body: unknown }, ctx: ToolContext) => {
    const t = byName(tool);
    const args = { ...argsFrom(a.query, t.inputSchema, names), ...fromParams(a.params) };
    const bad = check(args, t.inputSchema, "query");
    if (bad) throw new ToolError(bad);
    return t.run(args, ctx);
  };
}

function viaBody(tool: string) {
  return async (a: { body: unknown }, ctx: ToolContext) => {
    const t = byName(tool);
    if (!a.body || typeof a.body !== "object" || Array.isArray(a.body)) throw new ToolError("Send a JSON object as the body.");
    const bad = check(a.body, t.inputSchema, "body");
    if (bad) throw new ToolError(bad);
    return t.run(a.body as Record<string, unknown>, ctx);
  };
}

export const VERIFY_TESTS = [
  { id: "profit_per_trade", name: "Profit per trade", what: "Average profit per trade after fees, and whether it clears realistic trading costs." },
  { id: "worst_losses", name: "Worst losses", what: "The deepest fall and the longest time under water, against what the claim implies." },
  { id: "luck_check", name: "Luck check", what: "A deflated Sharpe ratio that counts how many strategies, bots or settings were tried." },
  { id: "signs_of_peeking_or_editing", name: "Signs of peeking or editing", what: "Fills at prices the market never traded, and history that looks edited." },
  { id: "signs_of_tuning", name: "Signs of tuning", what: "Results that look fitted to the past: too many settings for too few trades." },
  { id: "claim_arithmetic", name: "Claim arithmetic", what: "Whether the win rate, payoff and returns claimed can hold together." },
];

export const ROUTES: Route[] = [
  { method: "GET", path: "/strategies", scope: "read:strategies", summary: "Search tested strategies", run: viaTool("search_strategies", ["query", "asset", "beats_sp500", "limit"]) },
  { method: "GET", path: "/strategies/{id}", scope: "read:strategies", summary: "One strategy with its 11 test results", run: viaTool("get_strategy", [], (p) => ({ id: p.id })) },
  { method: "GET", path: "/search/leaderboard", scope: "read:strategies", summary: "Strategy search leaderboard", run: viaTool("search_leads", ["family", "asset", "limit"]) },
  { method: "GET", path: "/markets/series", scope: "read:markets", summary: "List market series", run: viaTool("list_market_series", ["query", "class", "limit"]) },
  { method: "GET", path: "/markets/series/{key}", scope: "read:markets", summary: "History of one market series", run: viaTool("get_market_series", ["from", "to", "max_points"], (p) => ({ key: p.key })) },
  {
    method: "GET", path: "/markets/snapshot", scope: "read:markets", summary: "Latest value of every public series",
    async run({ query }, ctx) {
      const t = await termIndex(ctx);
      const cls = (query.get("class") ?? "").toLowerCase();
      const rows = t.series.filter((s) => !cls || s.class === cls).map((s) => ({ ...seriesRow(s), change_1d: s.chg?.d1 ?? null, attribution: s.attribution ?? null }));
      const live = liveSources().map((s) => ({ id: s.id, name: s.name, covers: s.covers, delay_minutes: s.delayMin ?? 0 }));
      return { data_through: t.data_through, generated_at: t.generated_at, series: rows, live_sources: live, note: `Delayed, end-of-day values for series whose terms let us show them. ${NOTE}` };
    },
  },
  { method: "GET", path: "/news/impact", scope: "read:markets", summary: "What markets did after kinds of news", run: viaTool("news_impact", ["topic", "asset", "limit"]) },
  {
    method: "GET", path: "/verify/tests", scope: "read:verify", summary: "The checks Verify runs",
    async run() { return { method_version: METHOD_VERSION, tests: VERIFY_TESTS, note: NOTE }; },
  },
  { method: "POST", path: "/verify/trades", scope: "write:verify", summary: "Verify a trade list or an equity curve", run: viaBody("verify_trades") },
  { method: "POST", path: "/verify/strategy", scope: "read:verify", summary: "Verify one of Parity's tested strategies, or find the closest to a described rule set", run: viaBody("verify_strategy") },
  { method: "POST", path: "/verify/claim", scope: "write:verify", summary: "Check the arithmetic of a seller's claim", run: viaBody("verify_claim") },
  { method: "POST", path: "/verify", scope: "write:verify", summary: "Old name for POST /verify/trades", deprecated: true, run: viaBody("verify_record") },
  { method: "POST", path: "/verify/description", scope: "write:verify", summary: "Old name for POST /verify/claim", deprecated: true, run: viaBody("verify_description") },
];

function match(path: string): { routes: Route[]; params: Record<string, string> } {
  let segs: string[];
  try {
    segs = path.split("/").filter(Boolean).map((s) => decodeURIComponent(s));
  } catch {
    return { routes: [], params: {} }; // a broken %-escape matches nothing
  }
  const found: Route[] = [];
  let params: Record<string, string> = {};
  for (const r of ROUTES) {
    const want = r.path.split("/").filter(Boolean);
    if (want.length !== segs.length) continue;
    const p: Record<string, string> = {};
    if (want.every((w, i) => (w.startsWith("{") ? (p[w.slice(1, -1)] = segs[i]) !== "" : w === segs[i]))) {
      found.push(r);
      params = p;
    }
  }
  return { routes: found, params };
}

// ---------------------------------------------------------------- usage metering

interface Pending { requests: number; errors: number; log: LogLine[]; since: number }
const pending = new Map<string, Pending>();
const FLUSH_EVERY_MS = 30_000;
const FLUSH_AT = 25;

/** Counts a request against the key and, every 25 requests or 30 seconds, sends the counts
 *  and log lines to the database in one call (batched to keep Supabase traffic small). */
function meter(hash: string, line: LogLine, deps: ApiDeps, now: number) {
  const p = pending.get(hash) ?? { requests: 0, errors: 0, log: [], since: now };
  p.requests += 1;
  if (line.status >= 400) p.errors += 1;
  p.log.push(line);
  pending.set(hash, p);
  if (p.requests >= FLUSH_AT || now - p.since >= FLUSH_EVERY_MS) {
    pending.set(hash, { requests: 0, errors: 0, log: [], since: now });
    const send = deps.store.record(hash, p.requests, p.errors, p.log).catch((e) => deps.log?.({ msg: "api usage flush failed", error: String(e) }));
    deps.waitUntil ? deps.waitUntil(send) : void send;
  }
}

/** Requests this worker has counted for a key and not yet sent. The daily count can lag by
 *  up to a minute (the lookup cache), which is fine for a quota of thousands. */
const localSince = (hash: string) => pending.get(hash)?.requests ?? 0;

// ---------------------------------------------------------------- the handler

const sharedLimiter = new MinuteLimiter();
const leakLimiter = new MinuteLimiter();
/** Unknown keys per address. Anyone can make keys that pass the checksum, so after 20
 *  misses in a minute an address gets 429 before we spend a database call on it. */
const missLimiter = new MinuteLimiter();
export const MAX_MISSES = 20;

function requestId(): string {
  const b = crypto.getRandomValues(new Uint8Array(8));
  return "req_" + [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

function corsHeaders(origin: string | null, siteDomain: string): Record<string, string> {
  return origin && originAllowed(origin, siteDomain) ? { "Access-Control-Allow-Origin": origin, "Access-Control-Expose-Headers": "RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset, Retry-After, X-Request-Id" } : {};
}

export async function handleApi(request: Request, deps: ApiDeps): Promise<Response> {
  const now = deps.now ?? Date.now;
  const started = now();
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "").slice(API_BASE.length) || "/";
  const origin = request.headers.get("Origin");
  const rid = requestId();
  const cors = corsHeaders(origin, deps.siteDomain);
  const P = (status: number, slug: string, title: string, detail?: string, headers: Record<string, string> = {}, extra: Record<string, unknown> = {}) =>
    problem(deps.site, status, slug, title, detail, { ...cors, "X-Request-Id": rid, ...headers }, extra);

  // Browsers: only our own sites, and keys belong on servers anyway.
  if (origin && !originAllowed(origin, deps.siteDomain)) return P(403, "origin", "Origin not allowed", "Call the API from your server. Browsers on other sites are refused.");
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { ...SECURITY_HEADERS, ...cors, "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Authorization, Content-Type", "Access-Control-Max-Age": "600" } });
  }

  // Open to everyone: the index, the spec, and the leaked-key report.
  if (request.method === "GET" && (path === "/" || path === "")) {
    return ok({ name: "Parity API", version: "v1", docs: `${deps.site}/developers/`, openapi: `${deps.site}${API_BASE}/openapi.json`, endpoints: ROUTES.map((r) => ({ method: r.method, path: API_BASE + r.path, scope: r.scope, summary: r.summary, ...(r.deprecated ? { deprecated: true } : {}) })) }, { ...cors, "Cache-Control": "public, max-age=300" });
  }
  if (request.method === "GET" && path === "/openapi.json") return ok(openApi(deps.site, ROUTES), { ...cors, "Cache-Control": "public, max-age=300" });
  if (path === "/leaked-keys") return leaked(request, deps, P);

  if (!deps.pepper || deps.pepper.length < MIN_PEPPER) return P(503, "not-configured", "Not configured", "The API is not switched on yet. Try again later.", { "Retry-After": "3600" });

  const key = bearer(request.headers.get("Authorization"));
  const challenge = (error?: string, desc?: string) => ({ "WWW-Authenticate": `Bearer realm="parity-api"${error ? `, error="${error}"` : ""}${desc ? `, error_description="${desc}"` : ""}` });
  if (!key) return P(401, "unauthorized", "API key needed", "Send your key as 'Authorization: Bearer pk_test_...'.", challenge());
  if (!wellFormed(key)) return P(401, "invalid-key", "Key not valid", "That is not a Parity API key, or it was copied wrong.", challenge("invalid_token", "malformed key"));

  const ip = request.headers.get("CF-Connecting-IP");
  const misses = deps.missLimiter ?? missLimiter;
  if (misses.count(ip ?? "unknown") >= MAX_MISSES) return P(429, "rate-limited", "Too many requests", "Too many unknown keys from this address. Wait a minute.", { "Retry-After": "60" });
  const hash = await hashKey(key, deps.pepper);
  let rec: KeyRecord | null;
  try {
    rec = await deps.store.lookup(hash);
  } catch (e) {
    deps.log?.({ msg: "api key lookup failed", rid, error: e instanceof StoreError ? `${e.status} ${e.message}` : String(e) });
    return P(503, "unavailable", "Temporarily unavailable", "We could not check your key. Try again shortly.", { "Retry-After": "30" });
  }
  // The lookup is by HMAC; comparing again in constant time is a second, cheap guard.
  if (!rec || !constantTimeEqual(rec.key_hash, hash)) {
    misses.take(ip ?? "unknown", Number.MAX_SAFE_INTEGER);
    return P(401, "invalid-key", "Key not valid", "No key matches. It may have been deleted.", challenge("invalid_token", "unknown key"));
  }
  if (rec.revoked_at) return P(401, "revoked", "Key revoked", "This key was revoked. Make a new one in Settings, API keys.", challenge("invalid_token", "revoked"));
  if (Date.parse(rec.expires_at) <= now()) return P(401, "expired", "Key expired", "This key has expired. Make a new one in Settings, API keys.", challenge("invalid_token", "expired"));

  if (!ipAllowed(ip, rec.ip_allowlist)) {
    deps.log?.({ msg: "api ip refused", rid, key_id: rec.id });
    return P(403, "ip-not-allowed", "Address not allowed", "This key only works from the addresses on its allowlist.");
  }

  const { routes, params } = match(path);
  if (routes.length === 0) return P(404, "not-found", "Not found", `No endpoint at ${API_BASE}${path}. See ${deps.site}${API_BASE}/openapi.json.`);
  const route = routes.find((r) => r.method === request.method);
  if (!route) return P(405, "method", "Method not allowed", undefined, { Allow: routes.map((r) => r.method).join(", ") });
  if (!rec.scopes.includes(route.scope)) {
    return P(403, "insufficient-scope", "Scope missing", `This endpoint needs the ${route.scope} scope (${SCOPE_TEXT[route.scope]}).`, { "WWW-Authenticate": `Bearer realm="parity-api", error="insufficient_scope", scope="${route.scope}"` });
  }

  // Limits: per minute in this worker, per day across all the person's keys.
  const limits = LIMITS[rec.plan];
  const minute = (deps.limiter ?? sharedLimiter).take(rec.user_id, limits.minute);
  const rate = { "RateLimit-Limit": String(limits.minute), "RateLimit-Remaining": String(minute.remaining), "RateLimit-Reset": String(minute.reset) };
  if (!minute.ok) return P(429, "rate-limited", "Too many requests", `Your plan allows ${limits.minute} requests a minute.`, { ...rate, "Retry-After": String(minute.reset) });
  const usedToday = rec.used_today + localSince(hash);
  if (usedToday >= limits.day) {
    const midnight = new Date(now());
    midnight.setUTCHours(24, 0, 0, 0);
    return P(429, "quota", "Daily quota used", `Your plan allows ${limits.day} requests a day. It resets at 00:00 UTC.`, { ...rate, "Retry-After": String(Math.ceil((midnight.getTime() - now()) / 1000)) });
  }

  let body: unknown = undefined;
  if (route.method === "POST") {
    if (!(request.headers.get("Content-Type") ?? "").toLowerCase().startsWith("application/json")) return P(415, "media-type", "Send JSON", "Set 'Content-Type: application/json'.");
    if (Number(request.headers.get("Content-Length") ?? 0) > MAX_BODY) return P(413, "too-large", "Body too large", `At most ${MAX_BODY} bytes.`);
    const text = await request.text();
    if (text.length > MAX_BODY) return P(413, "too-large", "Body too large", `At most ${MAX_BODY} bytes.`);
    try { body = JSON.parse(text); } catch { return P(400, "bad-json", "Body is not JSON"); }
  }

  const noDb: Db = { select: async () => { throw new ToolError("Not available through the API."); }, rpc: async () => { throw new ToolError("Not available through the API."); } };
  const ctx: ToolContext = { caller: { userId: rec.user_id, email: null, clientId: "parity-api", token: "" }, data: deps.data, db: noDb, origin: deps.site, now: new Date(now()) };
  let res: Response;
  try {
    const out = await route.run({ params, query: url.searchParams, body }, ctx);
    res = ok(out, { ...cors, ...rate, "X-Request-Id": rid });
  } catch (e) {
    if (e instanceof ToolError) {
      const missing = /^No (strategy|series|topic|asset|study)\b/.test(e.message);
      res = missing ? P(404, "not-found", "Not found", e.message, rate) : P(400, "bad-request", "Bad request", e.message, rate);
    } else {
      deps.log?.({ msg: "api endpoint failed", rid, key_id: rec.id, path: route.path, error: String(e) });
      res = P(500, "server-error", "Something went wrong", `Quote ${rid} if you report it.`, rate);
    }
  }
  const ms = Math.max(0, now() - started);
  meter(hash, { at: new Date(started).toISOString(), method: request.method, path: (API_BASE + path).slice(0, 200), status: res.status, ms }, deps, now());
  deps.log?.({ msg: "api request", rid, key_id: rec.id, method: request.method, path: API_BASE + route.path, status: res.status, ms });
  return res;
}

/** Clears the metering buffer. Tests only. */
export const resetMeter = () => pending.clear();

// ---------------------------------------------------------------- leaked keys

async function sha256Hex(text: string): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
  return [...d].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** POST /api/v1/leaked-keys: anyone holding a key can have it revoked at once. Takes
 *  GitHub's secret scanning format ([{token, type, url, source}]) or {"key": "..."}. Holding
 *  the full key is the proof, so no sign-in is needed, and revoking a leaked key is always
 *  safe. Answers GitHub's format with the token's SHA-256, never the token itself. */
async function leaked(request: Request, deps: ApiDeps, P: (s: number, slug: string, t: string, d?: string, h?: Record<string, string>) => Response): Promise<Response> {
  if (request.method !== "POST") return P(405, "method", "Method not allowed", undefined, { Allow: "POST" });
  if (!deps.pepper || deps.pepper.length < MIN_PEPPER) return P(503, "not-configured", "Not configured", "The API is not switched on yet.", { "Retry-After": "3600" });
  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
  const lim = leakLimiter.take(`leak:${ip}`, 20);
  if (!lim.ok) return P(429, "rate-limited", "Too many requests", undefined, { "Retry-After": String(lim.reset) });
  const text = await request.text();
  if (text.length > 200_000) return P(413, "too-large", "Body too large");
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return P(400, "bad-json", "Body is not JSON"); }
  // At most 10 different tokens a report, so one request cannot fan out into many lookups.
  const seen = new Set<string>();
  const items = ((Array.isArray(raw) ? raw : [raw]) as Record<string, unknown>[]).filter((it) => {
    const t = typeof it?.token === "string" ? it.token : typeof it?.key === "string" ? it.key : "";
    if (!t || seen.has(t)) return false;
    seen.add(t);
    return true;
  }).slice(0, 10);
  const out: { token_hash: string; token_type: string; label: string }[] = [];
  let revoked = 0;
  for (const it of items) {
    const token = typeof it?.token === "string" ? it.token : typeof it?.key === "string" ? it.key : "";
    if (!token) continue;
    const source = [it.source, it.url].filter((x) => typeof x === "string").join(" ").slice(0, 200) || "report";
    let label = "false_positive";
    if (wellFormed(token)) {
      try {
        if (await deps.store.revokeLeaked(await hashKey(token, deps.pepper), source)) { label = "true_positive"; revoked += 1; }
      } catch (e) {
        deps.log?.({ msg: "leaked key revoke failed", error: String(e) });
        return P(503, "unavailable", "Temporarily unavailable", "Try again shortly.", { "Retry-After": "30" });
      }
    }
    out.push({ token_hash: await sha256Hex(token), token_type: typeof it.type === "string" ? it.type.slice(0, 60) : "parity_api_key", label });
  }
  deps.log?.({ msg: "leaked keys reported", count: out.length, revoked });
  return ok(out);
}
