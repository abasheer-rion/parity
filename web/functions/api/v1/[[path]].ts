// /api/v1/*: the Parity public API (DEC-0071). The logic is in src/lib/api/server.ts; this
// file wires in the Pages environment:
//   PARITY_API_KEY_PEPPER  server secret for hashing keys. Until it is set, every keyed
//                          endpoint answers 503 "not configured".
//   API_ENABLED            "off" switches the whole API off (404).
// Market and research data come from the published /data/ files through ASSETS, cached in
// the worker for a minute, never from Supabase.
import { assetData } from "../../mcp";
import { handleApi } from "../../../src/lib/api/server";
import { supabaseStore } from "../../../src/lib/api/store";
import { ORIGIN, SITE_DOMAIN } from "../../../src/lib/meta";

interface Env {
  PARITY_API_KEY_PEPPER?: string;
  API_ENABLED?: string;
  ASSETS: { fetch: (input: Request | string) => Promise<Response> };
}
interface Context { request: Request; env: Env; waitUntil: (p: Promise<unknown>) => void }

const store = supabaseStore();

export const onRequest = async ({ request, env, waitUntil }: Context): Promise<Response> => {
  if (env.API_ENABLED === "off") return new Response("Not found", { status: 404 });
  return handleApi(request, {
    pepper: env.PARITY_API_KEY_PEPPER,
    store,
    data: assetData(env.ASSETS, request.url),
    siteDomain: SITE_DOMAIN,
    site: ORIGIN,
    waitUntil,
    // One JSON line per request: key id, path, status, time. Never the key or any header.
    log: (line) => console.log(JSON.stringify(line)),
  });
};
