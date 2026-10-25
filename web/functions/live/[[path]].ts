// /live/* (DEC-0049): live market data. Public, no sign-in, so a signed-out check can see it
// working; nothing here is personal.
//   /live/ws?src=<id>                 WebSocket to that source's fan-out (a Durable Object)
//   /live/status                      every source's line state, viewers and feed lag (the log)
//   /live/sources                     which sources exist, how fresh, and their terms
//   /live/history?src=&s=&tf=         finished candles from the source's own history endpoint
//   /live/universe                    every US-listed symbol (SEC) plus the live symbols
// History and the universe are cached at the edge, so a page of viewers costs the source
// one request per cache period at most.
import { adapterFor, ADAPTERS, historyFor, universe } from "../../live/src/adapters";
import { SOURCES } from "../../src/lib/live/sources";
import type { DurableObjectNamespace } from "../../live/src/types";

interface Env { LIVE?: DurableObjectNamespace; VENDOR?: string; VENDOR_KEY?: string; PARITY_CONTACT?: string }
interface Context { request: Request; env: Env; params: { path?: string[] }; waitUntil: (p: Promise<unknown>) => void }

const json = (status: number, body: unknown, maxAge = 0) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json", "Cache-Control": maxAge ? `public, max-age=${maxAge}` : "no-store", "Access-Control-Allow-Origin": "*" },
});

const cache = () => (globalThis as unknown as { caches: { default: Cache } }).caches.default;

/** Serve from the edge cache, or compute, store for `ttl` seconds and serve. */
async function cached(ctx: Context, key: string, ttl: number, make: () => Promise<Response>): Promise<Response> {
  const req = new Request(`https://live.cache/${key}`);
  const hit = await cache().match(req);
  if (hit) return hit;
  const res = await make();
  if (res.ok) {
    const copy = new Response(res.clone().body, res);
    copy.headers.set("Cache-Control", `public, max-age=${ttl}`);
    ctx.waitUntil(cache().put(req, copy));
  }
  return res;
}

export const onRequest = async (ctx: Context): Promise<Response> => {
  const { request, env } = ctx;
  const url = new URL(request.url);
  const route = (ctx.params.path ?? []).join("/");
  const src = url.searchParams.get("src") ?? "";

  if (route === "ws") {
    if (!env.LIVE) return json(503, { error: "Live fan-out is not bound here" });
    if (!adapterFor(src, env)) return json(404, { error: "Unknown source" });
    const stub = env.LIVE.get(env.LIVE.idFromName(src));
    return stub.fetch(new Request(`https://hub/ws?src=${encodeURIComponent(src)}`, request));
  }

  if (route === "status") {
    if (!env.LIVE) return json(503, { error: "Live fan-out is not bound here" });
    const rows = await Promise.all(ADAPTERS.filter((a) => a.enabled(env)).map(async (a) => {
      try {
        const r = await env.LIVE!.get(env.LIVE!.idFromName(a.id)).fetch(`https://hub/status?src=${a.id}`);
        return await r.json();
      } catch (e) { return { src: a.id, error: String(e) }; }
    }));
    return json(200, { now: Date.now(), sources: rows });
  }

  if (route === "sources") return json(200, SOURCES, 300);

  if (route === "history") {
    const sym = url.searchParams.get("s") ?? "", tf = url.searchParams.get("tf") ?? "1m";
    const ttl = tf === "1d" ? 600 : 20;
    return cached(ctx, `h/${src}/${sym}/${tf}`, ttl, async () => {
      try {
        const bars = await historyFor(src, sym, tf, env);
        if (!bars) return json(404, { error: "No history for that symbol here" });
        return json(200, { src, s: sym, tf, bars, at: Date.now() }, ttl);
      } catch (e) {
        console.error("history", src, sym, tf, String(e));
        return json(502, { error: "The source did not answer" });
      }
    });
  }

  if (route === "universe") {
    return cached(ctx, "universe/v1", 86_400, async () => {
      try { return json(200, await universe(env), 86_400); } catch (e) { console.error("universe", String(e)); return json(502, { error: "Symbol list unavailable" }); }
    });
  }

  return json(404, { error: "Not found" });
};
