// The hosted MCP server's protocol layer (DEC-0051): Streamable HTTP at one endpoint, /mcp,
// answering every request with plain JSON and keeping no state between requests.
//
// It speaks both eras of the Model Context Protocol:
//   modern (2026-07-28): no handshake; every POST carries MCP-Protocol-Version, Mcp-Method
//     and, for tools/call, Mcp-Name headers that must match the body; server/discover says
//     what the server supports.
//   legacy (2025-03-26 to 2025-11-25): an initialize handshake first. We never hand out a
//     session id (the spec allows that), so each request still stands alone.
// Sign-in follows the MCP authorization spec: a request without a valid token gets a 401 whose
// WWW-Authenticate header points at /.well-known/oauth-protected-resource/mcp, which names
// Supabase Auth's OAuth server. Imported by Pages Functions: no import.meta.env here.
import { bearer, challenge, originAllowed, type McpCaller } from "./auth";
import { check } from "./schema";
import { listed, ToolError, TOOLS, type Data, type Db } from "./tools";
import type { Audit } from "./supabase";

export const MODERN = "2026-07-28";
export const VERSIONS = [MODERN, "2025-11-25", "2025-06-18", "2025-03-26"];
const LEGACY_DEFAULT = "2025-11-25";
export const SERVER_INFO = { name: "parity", title: "Parity", version: "1.0.0" };
const MAX_BODY = 512 * 1024;

export const INSTRUCTIONS = [
  "Parity Verify checks trading records and claims for retail traders. Use verify_trades for a trade list or equity curve (ask how many strategies, bots or settings were tried and send it as tries), verify_strategy for one of Parity's tested strategies or a rule set described in words, and verify_claim for a seller's claim such as a win rate, take-profit, stop, monthly return or drawdown.",
  "Parity also tests trading strategies against the S&P 500 with an 11-test gauntlet that counts costs, risk and luck. Use search_strategies and get_strategy for tested results, search_leads for the always-on search, list_market_series and get_market_series for delayed market data, news_impact for what followed kinds of news, and the Academy tools to explain terms.",
  "Every result is research only, not investment advice. Most ideas fail once luck and costs are counted; say so plainly and do not present any strategy as a recommendation.",
].join(" ");

export interface ServerDeps {
  /** Checks a bearer token; null when it is missing, forged or expired. */
  verify(token: string): Promise<McpCaller | null>;
  data: Data;
  db(caller: McpCaller): Db;
  audit(db: Db): Audit;
  /** False only while the owner has switched the endpoint off (MCP_ENABLED=off). */
  enabled: boolean;
  /** The two tools that change anything. Off unless MCP_WRITE_ENABLED is "on". */
  writeEnabled: boolean;
  siteDomain: string | string[];
  extraOrigins?: string[];
  now?: () => Date;
  timeoutMs?: number;
}

interface Rpc { jsonrpc?: unknown; id?: unknown; method?: unknown; params?: unknown }
type Json = Record<string, unknown>;

const rpcError = (id: unknown, code: number, message: string, data?: unknown) =>
  ({ jsonrpc: "2.0", id: id ?? null, error: { code, message, ...(data === undefined ? {} : { data }) } });

/** Mcp-Name and Mcp-Param values may come Base64 encoded as =?base64?...?= (UTF-8). */
export function decodeHeader(v: string | null): string | null {
  if (v == null) return null;
  const m = v.match(/^=\?base64\?([A-Za-z0-9+/=]*)\?=$/);
  if (!m) return v;
  try {
    return new TextDecoder().decode(Uint8Array.from(atob(m[1]), (c) => c.charCodeAt(0)));
  } catch {
    return null;
  }
}

function cors(request: Request, deps: ServerDeps): Record<string, string> {
  const origin = request.headers.get("Origin");
  if (!origin || !originAllowed(origin, deps.siteDomain, deps.extraOrigins)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept, MCP-Protocol-Version, Mcp-Method, Mcp-Name, Mcp-Session-Id, Last-Event-ID",
    "Access-Control-Expose-Headers": "WWW-Authenticate",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
}

function reply(status: number, body: unknown, extra: Record<string, string> = {}): Response {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { ...(body === null ? {} : { "Content-Type": "application/json" }), "Cache-Control": "no-store", ...extra },
  });
}

async function readBody(request: Request): Promise<string | null> {
  const declared = Number(request.headers.get("Content-Length") ?? "0");
  if (declared > MAX_BODY) return null;
  const text = await request.text();
  return text.length > MAX_BODY ? null : text;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    p.finally(() => clearTimeout(timer)),
    new Promise<T>((_, reject) => { timer = setTimeout(() => reject(new ToolError(`The tool took longer than ${Math.round(ms / 1000)} seconds and was stopped.`)), ms); }),
  ]);
}

const toolText = (text: string, isError: boolean) => ({ result: { content: [{ type: "text", text }], isError } as Json });

const LIMIT_TEXT: Record<string, string> = {
  minute: "Too many Parity calls this minute (the limit is 30). Wait a minute and try again.",
  day: "Daily limit of 1000 Parity calls reached. It resets over the next day.",
  write: "Daily limit of 30 changes reached. It resets over the next day.",
};

async function callTool(params: Json, caller: McpCaller, deps: ServerDeps, origin: string): Promise<{ result: Json } | { rpcError: [number, string] }> {
  const name = typeof params.name === "string" ? params.name : "";
  const tool = TOOLS.find((t) => t.name === name);
  if (!tool || (tool.write && !deps.writeEnabled)) return { rpcError: [-32602, `Unknown tool: ${name}`] as [number, string] };
  const args = (params.arguments ?? {}) as Json;
  const why = check(args, tool.inputSchema);
  if (why) return toolText(`Invalid arguments: ${why}.`, true);
  const db = deps.db(caller);
  if (tool.write) {
    const allowed = await db.rpc<boolean>("mcp_write_allowed", {}).catch(() => false);
    if (allowed !== true) {
      return toolText(`You have not allowed this app to make changes in Parity. You can turn it on at ${origin}/connect/ (changes are off unless you choose otherwise).`, true);
    }
  }
  const audit = deps.audit(db);
  let begin;
  try {
    begin = await audit.begin(tool.name, !!tool.write);
  } catch (e) {
    console.error("mcp audit begin failed", String(e));
    return toolText("Parity could not log this call, so it did not run. Try again in a minute.", true);
  }
  if (!begin.ok) return toolText(LIMIT_TEXT[begin.reason] ?? "A Parity limit was reached. Try again later.", true);
  const started = Date.now();
  let ok = false;
  try {
    const data = (await withTimeout(tool.run(args, { caller, data: deps.data, db, origin, now: deps.now?.() ?? new Date() }), deps.timeoutMs ?? 20_000)) as Json;
    ok = true;
    return { result: { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: data, isError: false } };
  } catch (e) {
    if (e instanceof ToolError) return toolText(e.message, true);
    console.error("mcp tool failed", tool.name, String(e));
    return toolText(`Something went wrong running ${tool.name}. Try again later.`, true);
  } finally {
    await audit.end(begin.id, ok, Date.now() - started).catch((e) => console.error("mcp audit end failed", String(e)));
  }
}

/** One JSON-RPC request; null for a notification (nothing to answer). */
async function dispatch(msg: Rpc, era: "modern" | "legacy", caller: McpCaller, deps: ServerDeps, origin: string): Promise<{ body: unknown; status?: number } | null> {
  if (!msg || typeof msg !== "object" || msg.jsonrpc !== "2.0" || typeof msg.method !== "string") {
    return { body: rpcError(msg?.id, -32600, "Invalid request"), status: 400 };
  }
  if (msg.id === undefined) return null; // a notification, such as notifications/initialized
  const params = (msg.params && typeof msg.params === "object" ? msg.params : {}) as Json;
  const done = (result: Json) => ({ body: { jsonrpc: "2.0", id: msg.id, result: era === "modern" ? { resultType: "complete", ...result } : result } });
  switch (msg.method) {
    case "initialize": {
      const asked = typeof params.protocolVersion === "string" ? params.protocolVersion : "";
      const protocolVersion = VERSIONS.includes(asked) && asked !== MODERN ? asked : LEGACY_DEFAULT;
      return done({ protocolVersion, capabilities: { tools: { listChanged: false } }, serverInfo: SERVER_INFO, instructions: INSTRUCTIONS });
    }
    case "server/discover":
      return done({ supportedVersions: VERSIONS, capabilities: { tools: { listChanged: false } }, _meta: { "io.modelcontextprotocol/serverInfo": SERVER_INFO }, instructions: INSTRUCTIONS });
    case "ping":
      return done({});
    case "tools/list":
      return done({ tools: listed(deps.writeEnabled) });
    case "tools/call": {
      const r = await callTool(params, caller, deps, origin);
      if ("rpcError" in r) return { body: rpcError(msg.id, r.rpcError[0], r.rpcError[1]) };
      return done(r.result);
    }
    default:
      return { body: rpcError(msg.id, -32601, `Method not found: ${msg.method}`), status: era === "modern" ? 404 : 200 };
  }
}

/** Header checks for a modern request. Returns an error message, or null when they match. */
function headerMismatch(msg: Rpc, request: Request, version: string): string | null {
  const params = (msg.params && typeof msg.params === "object" ? msg.params : {}) as Json;
  const meta = (params._meta && typeof params._meta === "object" ? params._meta : {}) as Json;
  if (meta["io.modelcontextprotocol/protocolVersion"] !== version) return "MCP-Protocol-Version header does not match _meta in the body";
  const method = request.headers.get("Mcp-Method");
  if (method == null) return "Mcp-Method header is missing";
  if (method !== msg.method) return `Mcp-Method header value '${method}' does not match body value '${String(msg.method)}'`;
  if (msg.method === "tools/call") {
    const name = decodeHeader(request.headers.get("Mcp-Name"));
    if (name == null) return "Mcp-Name header is missing or malformed";
    if (name !== params.name) return `Mcp-Name header value '${name}' does not match body value '${String(params.name)}'`;
  }
  return null;
}

export async function handleMcp(request: Request, deps: ServerDeps): Promise<Response> {
  const origin = new URL(request.url).origin;
  const reqOrigin = request.headers.get("Origin");
  if (!originAllowed(reqOrigin, deps.siteDomain, deps.extraOrigins)) {
    return reply(403, rpcError(null, -32600, "Origin not allowed"));
  }
  const h = cors(request, deps);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: h });
  if (!deps.enabled) return reply(404, { error: "Not found" }, h);
  if (request.method !== "POST") return reply(405, rpcError(null, -32600, "Use POST. This server keeps no stream or session."), { ...h, Allow: "POST, OPTIONS" });

  const token = bearer(request.headers.get("Authorization"));
  const caller = token ? await deps.verify(token) : null;
  if (!caller) {
    return reply(401, { error: "Sign in to Parity first. Your AI app should open the sign-in page by itself." }, {
      ...h, "WWW-Authenticate": challenge(origin, token ? "invalid_token" : undefined),
    });
  }

  const text = await readBody(request);
  if (text == null) return reply(413, rpcError(null, -32600, "Request too large"), h);
  let body: unknown;
  try { body = JSON.parse(text); } catch { return reply(400, rpcError(null, -32700, "Parse error"), h); }

  const version = request.headers.get("MCP-Protocol-Version");
  if (version != null && !VERSIONS.includes(version)) {
    const id = body && typeof body === "object" && !Array.isArray(body) ? (body as Rpc).id : null;
    return reply(400, rpcError(id, -32022, "Unsupported protocol version", { supported: VERSIONS, requested: version }), h);
  }
  const first = (Array.isArray(body) ? body[0] : body) as Rpc | undefined;
  const metaVersion = first?.params && typeof first.params === "object" ? ((first.params as Json)._meta as Json | undefined)?.["io.modelcontextprotocol/protocolVersion"] : undefined;
  const modern = version === MODERN || (metaVersion === MODERN && first?.method !== "initialize");

  if (modern) {
    if (Array.isArray(body)) return reply(400, rpcError(null, -32600, "Send one JSON-RPC message per request"), h);
    const msg = body as Rpc;
    if (version !== MODERN) return reply(400, rpcError(msg?.id, -32020, "MCP-Protocol-Version header is missing"), h);
    const why = msg && typeof msg === "object" && msg.id !== undefined ? headerMismatch(msg, request, version) : null;
    if (why) return reply(400, rpcError(msg.id, -32020, `Header mismatch: ${why}`), h);
    const out = await dispatch(msg, "modern", caller, deps, origin);
    return out ? reply(out.status ?? 200, out.body, h) : reply(202, null, h);
  }

  // Legacy: one message, or a batch (allowed in 2025-03-26).
  const msgs = (Array.isArray(body) ? body : [body]) as Rpc[];
  if (!msgs.length) return reply(400, rpcError(null, -32600, "Empty batch"), h);
  const answers: unknown[] = [];
  let status = 200;
  for (const m of msgs) {
    const out = await dispatch(m, "legacy", caller, deps, origin);
    if (out) { answers.push(out.body); if (out.status === 400 && msgs.length === 1) status = 400; }
  }
  if (!answers.length) return reply(202, null, h);
  return reply(status, Array.isArray(body) ? answers : answers[0], h);
}

