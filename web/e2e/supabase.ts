// A stand-in for Supabase inside the browser, so no test talks to the hosted project:
//   - a session cookie shaped like the one @supabase/ssr writes, with a token that does not
//     expire during the run (the browser never checks its signature; the middleware stand-in
//     in e2e/server.ts only checks the cookie is there)
//   - auth endpoints that answer like GoTrue (user, sign-in, sign-out, codes, reset)
//   - a small in-memory PostgREST: GET with eq filters, order and limit, POST, PATCH,
//     DELETE and upsert, one store per browser context, so the Trade demo account works
//   - realtime sockets accepted and left quiet
import type { BrowserContext, Route } from "@playwright/test";
import { COOKIE, SUPABASE } from "./config";

export const USER = {
  id: "00000000-0000-4000-8000-0000000000e2",
  aud: "authenticated",
  role: "authenticated",
  email: "e2e@example.com",
  email_confirmed_at: "2026-01-01T00:00:00Z",
  phone: "",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: { name: "E2E Tester" },
  identities: [],
  factors: [],
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const b64url = (s: string) => Buffer.from(s).toString("base64url");
const EXP = 4102444800; // 2100-01-01

export function accessToken(): string {
  const header = { alg: "ES256", typ: "JWT", kid: "e2e" };
  const payload = {
    iss: `${SUPABASE}/auth/v1`, sub: USER.id, aud: "authenticated", role: "authenticated", email: USER.email,
    exp: EXP, iat: 1767225600, aal: "aal1", amr: [{ method: "password", timestamp: 1767225600 }], session_id: "e2e-session",
    app_metadata: USER.app_metadata, user_metadata: USER.user_metadata, is_anonymous: false,
  };
  return `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}.${b64url("e2e-signature")}`;
}

export function session() {
  return { access_token: accessToken(), token_type: "bearer", expires_in: EXP - 1767225600, expires_at: EXP, refresh_token: "e2e-refresh", user: USER };
}

/** The cookie @supabase/ssr writes for a signed-in browser. */
export function sessionCookie(host = "127.0.0.1") {
  return { name: COOKIE, value: `base64-${b64url(JSON.stringify(session()))}`, domain: host, path: "/", sameSite: "Lax" as const, expires: EXP };
}

type RowT = Record<string, unknown>;

/** One context's tables. Tests can seed rows with `db.seed(table, rows)` before a page loads. */
export class FakeDb {
  tables = new Map<string, RowT[]>();
  calls: { method: string; table: string; body?: unknown }[] = [];
  seed(table: string, rows: RowT[]) { this.tables.set(table, [...(this.tables.get(table) ?? []), ...rows]); }
  rows(table: string) { return this.tables.get(table) ?? []; }
}

const FILTER = /^(eq|neq|gt|gte|lt|lte|is|in)\.(.*)$/;

function filterRows(rows: RowT[], params: URLSearchParams): RowT[] {
  let out = rows;
  for (const [k, v] of params) {
    if (["select", "order", "limit", "offset", "on_conflict", "columns"].includes(k)) continue;
    const m = v.match(FILTER);
    if (!m) continue;
    const [, op, raw] = m;
    out = out.filter((r) => {
      const x = r[k];
      const s = x == null ? "null" : String(x);
      if (op === "eq") return s === raw;
      if (op === "neq") return s !== raw;
      if (op === "is") return raw === "null" ? x == null : s === raw;
      if (op === "in") return raw.replace(/^\(|\)$/g, "").split(",").map((t) => t.replace(/^"|"$/g, "")).includes(s);
      const a = Number(x), b = Number(raw);
      const cmp = Number.isFinite(a) && Number.isFinite(b) ? a - b : s.localeCompare(raw);
      return op === "gt" ? cmp > 0 : op === "gte" ? cmp >= 0 : op === "lt" ? cmp < 0 : cmp <= 0;
    });
  }
  const order = params.get("order");
  if (order) {
    const [col, dir] = order.split(",")[0].split(".");
    out = [...out].sort((a, b) => String(a[col] ?? "").localeCompare(String(b[col] ?? "")) * (dir === "desc" ? -1 : 1));
  }
  const limit = Number(params.get("limit"));
  if (limit > 0) out = out.slice(0, limit);
  return out;
}

let seq = 0;
const newRowId = () => `00000000-0000-4000-9000-${String(++seq).padStart(12, "0")}`;

async function rest(route: Route, db: FakeDb) {
  const req = route.request();
  const url = new URL(req.url());
  const name = url.pathname.replace(/^\/rest\/v1\//, "");
  const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
    route.fulfill({ status, contentType: "application/json", headers: { "content-range": "0-0/*", ...headers }, body: body === undefined ? "" : JSON.stringify(body) });
  if (name.startsWith("rpc/")) {
    db.calls.push({ method: "RPC", table: name });
    return json(200, name === "rpc/verify_badge_public" ? [] : null);
  }
  const single = (req.headers()["accept"] ?? "").includes("vnd.pgrst.object");
  const prefer = req.headers()["prefer"] ?? "";
  const wantRows = prefer.includes("return=representation");
  const method = req.method();
  const all = db.rows(name);
  if (method === "GET" || method === "HEAD") {
    const rows = filterRows(all, url.searchParams);
    if (single) return rows.length ? json(200, rows[0]) : json(406, { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned" });
    return json(200, rows, { "content-range": `0-${Math.max(0, rows.length - 1)}/${rows.length}` });
  }
  let body: unknown = null;
  try { body = req.postDataJSON(); } catch { body = null; }
  db.calls.push({ method, table: name, body });
  if (method === "POST") {
    const list = (Array.isArray(body) ? body : [body]).filter(Boolean) as RowT[];
    const now = new Date().toISOString();
    const upsert = prefer.includes("resolution=merge-duplicates");
    const made: RowT[] = [];
    const next = [...all];
    for (const r of list) {
      const row = { id: newRowId(), user_id: USER.id, created_at: now, ...r };
      const i = upsert ? next.findIndex((x) => x.id === row.id) : -1;
      if (i >= 0) next[i] = { ...next[i], ...row }; else next.push(row);
      made.push(row);
    }
    db.tables.set(name, next);
    if (!wantRows) return json(201, undefined);
    return json(201, single ? made[0] : made);
  }
  if (method === "PATCH") {
    const hit = new Set(filterRows(all, url.searchParams));
    const next = all.map((r) => (hit.has(r) ? { ...r, ...(body as RowT) } : r));
    db.tables.set(name, next);
    const changed = next.filter((_, i) => hit.has(all[i]));
    return wantRows ? json(200, single ? changed[0] ?? null : changed) : json(204, undefined);
  }
  if (method === "DELETE") {
    const hit = new Set(filterRows(all, url.searchParams));
    db.tables.set(name, all.filter((r) => !hit.has(r)));
    return wantRows ? json(200, [...hit]) : json(204, undefined);
  }
  return json(405, { message: "not stubbed" });
}

async function auth(route: Route, signedIn: () => boolean) {
  const req = route.request();
  const path = new URL(req.url()).pathname.replace(/^\/auth\/v1/, "");
  const json = (status: number, body: unknown) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  if (path === "/user") return signedIn() ? json(200, USER) : json(401, { code: 401, error_code: "no_authorization", msg: "This endpoint requires a valid Bearer token" });
  if (path === "/token") {
    let body: { password?: string } = {};
    try { body = req.postDataJSON() as { password?: string }; } catch { body = {}; }
    if (body.password === "wrong-password") return json(400, { code: 400, error_code: "invalid_credentials", msg: "Invalid login credentials" });
    return json(200, session());
  }
  if (path === "/logout") return route.fulfill({ status: 204, body: "" });
  if (path === "/factors" || path.startsWith("/factors/")) return json(200, { id: "f1", type: "totp", totp: { qr_code: "data:image/svg+xml,", secret: "SECRET", uri: "otpauth://" } });
  if (path === "/signup") return json(200, { ...USER, identities: [{ id: "i1" }], confirmation_sent_at: "2026-01-01T00:00:00Z" });
  if (path === "/settings") return json(200, { external: { email: true, google: true, github: true }, disable_signup: false, mailer_autoconfirm: false });
  // otp, recover, verify, resend, reauthenticate and the rest: a plain success.
  return json(200, {});
}

/** Puts the Supabase stand-in on a browser context. */
export async function stubSupabase(context: BrowserContext, db: FakeDb, signedIn: () => boolean) {
  await context.route(`${SUPABASE}/**`, (route) => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" } });
    if (path.startsWith("/auth/v1/")) return auth(route, signedIn);
    if (path.startsWith("/rest/v1/")) return rest(route, db);
    if (path.startsWith("/functions/v1/")) return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ message: "not stubbed" }) });
  });
  await context.routeWebSocket(/supabase\.co\/realtime/, (ws) => {
    ws.onMessage((raw) => {
      // Phoenix channels: answer every join and heartbeat with ok, send nothing else.
      try {
        const m = JSON.parse(String(raw)) as { topic: string; event: string; ref: string; join_ref?: string };
        ws.send(JSON.stringify({ topic: m.topic, event: "phx_reply", payload: { status: "ok", response: {} }, ref: m.ref, join_ref: m.join_ref }));
      } catch { /* not JSON */ }
    });
  });
}
