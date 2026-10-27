// The OpenAPI 3.1 description of /api/v1/ (DEC-0071), built from the route table and the
// MCP tools' input schemas so the spec cannot drift from what the API accepts. Served at
// /api/v1/openapi.json and linked from /developers/.
import { byName, TOOLS } from "../mcp/tools";
import type { Schema } from "../mcp/schema";
import { SCOPE_TEXT, SCOPES, type Scope } from "./policy";

interface RouteLike { method: string; path: string; scope: Scope; summary: string }

const TOOL_FOR: Record<string, string> = {
  "GET /strategies": "search_strategies", "GET /strategies/{id}": "get_strategy", "GET /search/leaderboard": "search_leads",
  "GET /markets/series": "list_market_series", "GET /markets/series/{key}": "get_market_series", "GET /news/impact": "news_impact",
  "POST /verify": "verify_record", "POST /verify/description": "verify_description",
};

const problemRef = { $ref: "#/components/responses/Problem" };

export function openApi(site: string, routes: RouteLike[]) {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const r of routes) {
    const tool = TOOL_FOR[`${r.method} ${r.path}`];
    const t = tool && TOOLS.some((x) => x.name === tool) ? byName(tool) : null;
    const pathParams = [...r.path.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
    const params: unknown[] = pathParams.map((name) => ({ name, in: "path", required: true, schema: { type: "string" } }));
    if (r.method === "GET" && t) {
      for (const [name, s] of Object.entries(t.inputSchema.properties ?? {})) {
        if (pathParams.includes(name)) continue;
        params.push({ name, in: "query", required: false, description: (s as Schema).description, schema: { ...(s as Schema), description: undefined } });
      }
    }
    if (r.path === "/markets/snapshot") params.push({ name: "class", in: "query", required: false, schema: { type: "string" } });
    const op: Record<string, unknown> = {
      operationId: `${r.method.toLowerCase()}${r.path.replace(/\{(\w+)\}/g, "By_$1").replace(/[^A-Za-z0-9]+(\w)?/g, (_, c: string | undefined) => (c ?? "").toUpperCase())}`,
      summary: r.summary,
      description: t ? t.description : undefined,
      security: [{ bearer: [] }],
      "x-required-scope": r.scope,
      parameters: params,
      responses: {
        200: { description: "OK", headers: { "RateLimit-Limit": { schema: { type: "integer" } }, "RateLimit-Remaining": { schema: { type: "integer" } }, "RateLimit-Reset": { schema: { type: "integer" } } }, content: { "application/json": { schema: { type: "object" } } } },
        400: problemRef, 401: problemRef, 403: problemRef, 404: problemRef, 429: problemRef, 503: problemRef,
      },
    };
    if (r.method === "POST" && t) op.requestBody = { required: true, content: { "application/json": { schema: t.inputSchema } } };
    const key = `/api/v1${r.path}`;
    paths[key] = { ...(paths[key] ?? {}), [r.method.toLowerCase()]: op };
  }
  paths["/api/v1/leaked-keys"] = {
    post: {
      operationId: "postLeakedKeys", summary: "Report leaked keys so they are revoked at once",
      description: "Anyone holding a key can revoke it. Accepts GitHub secret scanning's format or {\"key\": \"...\"}. No key needed.",
      security: [],
      requestBody: { required: true, content: { "application/json": { schema: { oneOf: [{ type: "array", maxItems: 10, items: { type: "object", properties: { token: { type: "string" }, type: { type: "string" }, url: { type: "string" }, source: { type: "string" } }, required: ["token"] } }, { type: "object", properties: { key: { type: "string" } }, required: ["key"] }] } } } },
      responses: { 200: { description: "One row per reported token, by its SHA-256", content: { "application/json": { schema: { type: "array", items: { type: "object", properties: { token_hash: { type: "string" }, token_type: { type: "string" }, label: { type: "string", enum: ["true_positive", "false_positive"] } } } } } } }, 429: problemRef, 503: problemRef },
    },
  };
  return {
    openapi: "3.1.0",
    info: {
      title: "Parity API", version: "1.0.0",
      summary: "Tested strategies, market data, news impact and Verify checks.",
      description: `Research only, not investment advice. Make a key in Settings, API keys. Guide: ${site}/developers/`,
      contact: { url: `${site}/developers/` },
    },
    servers: [{ url: site }],
    security: [{ bearer: [] }],
    // Each operation names the one scope it needs in x-required-scope.
    "x-scopes": Object.fromEntries(SCOPES.map((s) => [s, SCOPE_TEXT[s]])),
    paths,
    components: {
      securitySchemes: {
        bearer: { type: "http", scheme: "bearer", bearerFormat: "pk_test_ followed by 49 base62 characters", description: "An API key from Settings, API keys." },
      },
      responses: {
        Problem: { description: "An RFC 9457 problem", content: { "application/problem+json": { schema: { $ref: "#/components/schemas/Problem" } } } },
      },
      schemas: {
        Problem: { type: "object", properties: { type: { type: "string", format: "uri" }, title: { type: "string" }, status: { type: "integer" }, detail: { type: "string" } }, required: ["type", "title", "status"] },
      },
    },
  };
}
