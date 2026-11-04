// /api/connect/*: read-only broker connections (DEC-0091). The logic is in
// src/lib/connect/server.ts; this file wires in the Pages environment. Secrets, all set by the
// owner as Pages secrets and never committed:
//   BROKER_RECORD_SIGNING_KEY       signs broker-connected records. Without it, reads answer 503.
//   BROKER_CREDENTIAL_KEY           seals credentials for "keep in sync". Without it, keeping is off.
//   ALPACA_OAUTH_CLIENT_ID/_SECRET  Alpaca's sign-in. Without them, Alpaca answers 503.
//   BROKER_RECORD_OLD_PUBLIC_KEYS   optional: earlier public keys still trusted for old badges.
//   BROKER_CONNECT                  "off" switches connections off here; "on" switches them on.
// Otherwise the build decides: /verify/connections.json, written from VITE_VERIFY_CONNECTIONS
// (on for pull request previews and the E2E build, off for production until the owner turns it on).
import { assetData } from "../../mcp";
import { verifyToken } from "../../../src/lib/mcp/auth";
import { handleConnect, type ConnectEnv } from "../../../src/lib/connect/server";
import { supabaseConnectStore } from "../../../src/lib/connect/store";
import { priceBook } from "../../../src/lib/verify/prices";
import { SITE_DOMAIN } from "../../../src/lib/meta";
import { memoryCache } from "../../../src/lib/verify/range/load";
import { FILL_SOURCES } from "../../../src/lib/verify/range/registry";
import { edgeCache, kvCache, layered, serverFills, type FillsEnv } from "../../../src/lib/verify/range/server";

interface Kv { get(k: string): Promise<string | null>; put(k: string, v: string, o?: { expirationTtl?: number }): Promise<void> }
interface Env extends ConnectEnv, FillsEnv { ASSETS: { fetch: (input: Request | string) => Promise<Response> }; FILL_RANGES?: Kv }
interface Context { request: Request; env: Env }

const store = supabaseConnectStore();
const local = memoryCache();

/** The fill price check's cache (DEC-0092): KV when the owner binds one, Cloudflare's cache otherwise. */
function fillCache(env: Env) {
  const caches = (globalThis as unknown as { caches?: { default?: Parameters<typeof edgeCache>[0] } }).caches;
  const edge = caches?.default ? edgeCache(caches.default) : local;
  return env.FILL_RANGES ? layered(kvCache(env.FILL_RANGES), edge) : edge;
}
let flag: { at: number; on: boolean } | null = null;

async function buildFlag(env: Env, base: string): Promise<boolean> {
  if (flag && Date.now() - flag.at < 60_000) return flag.on;
  const res = await env.ASSETS.fetch(new Request(new URL("/verify/connections.json", base)));
  const on = res.ok && (res.headers.get("content-type") ?? "").includes("json") && ((await res.json()) as { on?: unknown }).on === true;
  flag = { at: Date.now(), on };
  return on;
}

export const onRequest = async ({ request, env }: Context): Promise<Response> => {
  const data = assetData(env.ASSETS, request.url);
  return handleConnect(request, {
    env,
    buildFlag: () => buildFlag(env, request.url),
    verify: (t) => verifyToken(t),
    store,
    venueFetch: (input, init) => fetch(input, init),
    prices: async () => {
      const doc = await data.json<Parameters<typeof priceBook>[0]>("/data/verify/prices.json");
      return doc ? priceBook(doc) : null;
    },
    // The fill price check on the trades read, on this server: nothing leaves a page for it.
    fills: serverFills({ env, sources: FILL_SOURCES, cache: fillCache(env), fetch: (input, init) => fetch(input, init) }, Date.now),
    siteDomain: SITE_DOMAIN,
    // One JSON line per request: route, venue, status, time, request count. Never a credential.
    log: (line) => console.log(JSON.stringify(line)),
  });
};
