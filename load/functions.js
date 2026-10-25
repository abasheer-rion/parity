// The site's public functions (REF-0025), in a mix like real traffic:
//   /live/status, /live/universe        live data line state and the symbol list
//   POST /e                             analytics batch, sent with DNT: 1 so it is dropped
//                                       before the database (no test rows in production)
//   POST /rum                           page timing beacon with an unknown app, also dropped
//                                       before the database
//   /v/<id>                             a Verify badge page: a well-formed id that does not
//                                       exist (one database lookup each) and a malformed one
//   /badge/<id>.svg                     the badge image, not-found id (one lookup each)
//   /.well-known/oauth-protected-resource and oauth-authorization-server   MCP discovery
//   /mcp without a sign-in               refused, no database
// About a fifth of requests reach Supabase (the badge lookups and the sign-in server's
// metadata), so keep the steps small: the preview shares the production project.
//   BASE=https://<preview>.parity-research.pages.dev STEPS=10,25,50 STEP_S=30 make load-functions
import http from "k6/http";
import { check } from "k6";
import { base, stepRates, stepped, summarize } from "./lib.js";

const B = base();
const uuid = () => "xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx".replace(/x/g, () => Math.floor(Math.random() * 16).toString(16));
const id12 = () => Array.from({ length: 12 }, () => "abcdefghjkmnpqrstuvwxyz23456789"[Math.floor(Math.random() * 31)]).join("");

const MIX = [
  [20, "status", () => http.get(`${B}/live/status`, { tags: { name: "live-status" } }), (r) => r.status === 200],
  [20, "universe", () => http.get(`${B}/live/universe`, { tags: { name: "live-universe" } }), (r) => r.status === 200],
  [15, "e", () => http.post(`${B}/e`, JSON.stringify({ app: "site", sid: uuid(), vid: uuid(), ev: [{ n: "page_view", t: Date.now() }] }), { headers: { "Content-Type": "application/json", DNT: "1" }, tags: { name: "beacon-e" } }), (r) => r.status === 204],
  [15, "rum", () => http.post(`${B}/rum`, JSON.stringify({ a: "loadtest", ev: [{ m: "ttfb", e: "/", v: 120 }] }), { headers: { "Content-Type": "application/json" }, tags: { name: "beacon-rum" } }), (r) => r.status === 204],
  [10, "v-missing", () => http.get(`${B}/v/${id12()}`, { tags: { name: "badge-page-missing" }, responseCallback: http.expectedStatuses(404) }), (r) => r.status === 404],
  [5, "v-malformed", () => http.get(`${B}/v/not-a-badge`, { tags: { name: "badge-page-malformed" }, responseCallback: http.expectedStatuses(404) }), (r) => r.status === 404],
  [5, "badge-svg", () => http.get(`${B}/badge/${id12()}.svg`, { tags: { name: "badge-svg-missing" }, responseCallback: http.expectedStatuses(404) }), (r) => r.status === 404],
  [4, "wk-resource", () => http.get(`${B}/.well-known/oauth-protected-resource`, { tags: { name: "mcp-resource-meta" } }), (r) => r.status === 200],
  [4, "wk-as", () => http.get(`${B}/.well-known/oauth-authorization-server`, { tags: { name: "mcp-as-meta" } }), (r) => r.status === 200],
  [2, "mcp", () => http.post(`${B}/mcp`, JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }), { headers: { "Content-Type": "application/json" }, tags: { name: "mcp-signed-out" }, responseCallback: http.expectedStatuses(401) }), (r) => r.status === 401],
];
const TOTAL = MIX.reduce((s, m) => s + m[0], 0);

export const options = stepped({ fn: "call", rates: stepRates("10,25,50"), seconds: Number(__ENV.STEP_S || 30), fnShare: 1 });

export function call() {
  let x = Math.random() * TOTAL;
  for (const [w, name, run, ok] of MIX) {
    x -= w;
    if (x > 0) continue;
    const r = run();
    check(r, { [name]: ok });
    return;
  }
}

export function handleSummary(data) { return summarize("functions", data); }
