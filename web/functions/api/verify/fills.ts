// POST /api/verify/fills: the fill price check (DEC-0092). The logic is in
// src/lib/verify/range/server.ts; this file wires in the Pages environment. It uses the
// existing ALPACA_KEY_ID and ALPACA_SECRET_KEY (US stocks, only once FILL_CHECK_STOCKS is
// "on") and public blockchain nodes (crypto). No new secret. Optional, set by the owner:
//   FILL_CHECK         "off" switches the check off here.
//   FILL_CHECK_STOCKS  "on" after Alpaca has had the notice its terms ask for.
//   FILL_RANGES        a KV namespace binding, so every data centre shares one cache.
import { verifyToken } from "../../../src/lib/mcp/auth";
import { SITE_DOMAIN } from "../../../src/lib/meta";
import { supabaseFillQuota } from "../../../src/lib/verify/range/quota";
import { FILL_SOURCES } from "../../../src/lib/verify/range/registry";
import { edgeCache, handleFills, kvCache, layered, type FillsEnv } from "../../../src/lib/verify/range/server";
import { memoryCache } from "../../../src/lib/verify/range/load";

interface Kv { get(k: string): Promise<string | null>; put(k: string, v: string, o?: { expirationTtl?: number }): Promise<void> }
interface Env extends FillsEnv { FILL_RANGES?: Kv }
interface Context { request: Request; env: Env }

const quota = supabaseFillQuota();
// Where Cloudflare's cache is missing (a local run), a small one in this instance.
const local = memoryCache();

function cacheFor(env: Env) {
  const caches = (globalThis as unknown as { caches?: { default?: Parameters<typeof edgeCache>[0] } }).caches;
  const edge = caches?.default ? edgeCache(caches.default) : local;
  return env.FILL_RANGES ? layered(kvCache(env.FILL_RANGES), edge) : edge;
}

export const onRequest = async ({ request, env }: Context): Promise<Response> => handleFills(request, {
  env,
  verify: async (t) => verifyToken(t),
  quota,
  sources: FILL_SOURCES,
  cache: cacheFor(env),
  fetch: (input, init) => fetch(input, init),
  siteDomain: SITE_DOMAIN,
  // One JSON line per request: counts only, never a symbol, a time or a price.
  log: (line) => console.log(JSON.stringify(line)),
});
