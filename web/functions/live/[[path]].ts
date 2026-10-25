// /live/* (DEC-0052, DEC-0056): live market data.
//   /live/ws?src=<id>                 WebSocket to that source's fan-out (a Durable Object)
//   /live/status                      every source's line state, viewers and feed lag (the log)
//   /live/sources                     which sources exist, how fresh, and their terms
//   /live/history?src=&s=&tf=         finished candles from the source's own history endpoint
//   /live/universe[?team=1]           every US-listed symbol (SEC) plus the live symbols
//   /live/me                          whether the signed-in person is on the team list
//
// Public sources (terms allow display) need no sign-in. Team-only sources (terms allow
// internal use only) are checked HERE, on the server, before anything streams: a valid
// Supabase sign-in from Parity itself and a row in public.team_members (src/lib/live/
// teamGate.ts). Otherwise the WebSocket is accepted and closed at once with code 4003, and
// history and lists answer 403. The fan-out object double-checks: it refuses an internal
// source's viewer unless this function passed X-Parity-Team, which it strips from incoming
// requests so a browser cannot forge it.
import { adapterFor, ADAPTERS, historyFor, universe } from "../../live/src/adapters";
import { isInternal, SOURCES } from "../../src/lib/live/sources";
import { teamPass } from "../../src/lib/live/teamGate";
import type { DurableObjectNamespace, WebSocketPairCtor, WorkerSocket } from "../../live/src/types";

declare const WebSocketPair: WebSocketPairCtor;

interface Env {
  LIVE?: DurableObjectNamespace; VENDOR?: string; VENDOR_KEY?: string; PARITY_CONTACT?: string; LIVE_ALLOW?: string; LIVE_DENY?: string;
  ALPACA_KEY_ID?: string; ALPACA_SECRET_KEY?: string; ALPACA_FEED?: string; FINNHUB_TOKEN?: string;
}
interface Context { request: Request; env: Env; params: { path?: string[] }; waitUntil: (p: Promise<unknown>) => void }

/** Pages that may call /live with a sign-in from another origin: the desktop app's bundled copy. */
const CORS_ORIGIN = /^(app:\/\/parity|https:\/\/([a-z0-9-]+\.)*endyland\.com|https:\/\/([a-z0-9-]+\.)*parity-research\.pages\.dev)$/;

function corsFor(req: Request): Record<string, string> {
  const o = req.headers.get("Origin") ?? "";
  return CORS_ORIGIN.test(o) ? { "Access-Control-Allow-Origin": o, "Access-Control-Allow-Credentials": "true", Vary: "Origin" } : { "Access-Control-Allow-Origin": "*" };
}

const json = (req: Request, status: number, body: unknown, maxAge = 0, priv = false) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "Content-Type": "application/json",
    "Cache-Control": priv ? "private, no-store" : maxAge ? `public, max-age=${maxAge}` : "no-store",
    ...(priv ? { ...corsFor(req), Vary: "Origin, Cookie, Authorization" } : { "Access-Control-Allow-Origin": "*" }),
  },
});

const cache = () => (globalThis as unknown as { caches: { default: Cache } }).caches.default;

/**
 * Serve from the edge cache, or compute, store for `ttl` seconds and serve. A second copy is
 * kept for a day: when the source fails (free APIs limit by address, and Cloudflare's
 * addresses are shared), the last good answer is served and marked stale. The cache is our
 * own and server side; a team-only answer is only read after the team check passed.
 */
async function cached(ctx: Context, key: string, ttl: number, make: () => Promise<Response>, priv = false): Promise<Response> {
  const req = new Request(`https://live.cache/${key}`);
  const old = new Request(`https://live.cache/stale/${key}`);
  const out = (r: Response) => {
    if (!priv) return r;
    const o = new Response(r.body, r);
    o.headers.set("Cache-Control", "private, no-store");
    for (const [k, v] of Object.entries(corsFor(ctx.request))) o.headers.set(k, v);
    o.headers.set("Vary", "Origin, Cookie, Authorization");
    return o;
  };
  const hit = await cache().match(req);
  if (hit) return out(hit);
  const res = await make();
  if (res.ok) {
    const body = await res.clone().arrayBuffer();
    const fresh = new Response(body, res);
    fresh.headers.set("Cache-Control", `public, max-age=${ttl}`);
    const keep = new Response(body, res);
    keep.headers.set("Cache-Control", "public, max-age=86400");
    ctx.waitUntil(Promise.all([cache().put(req, fresh), cache().put(old, keep)]));
    return out(res);
  }
  const last = await cache().match(old);
  if (!last) return out(res);
  const stale = new Response(last.body, last);
  stale.headers.set("Cache-Control", "no-store");
  stale.headers.set("X-Parity-Stale", "1");
  return out(stale);
}

/** Accept a WebSocket only to close it with a reason the page can read (4003: team only). */
function refuse(code: number, reason: string, req: Request): Response {
  const pair = new WebSocketPair();
  const [client, server] = [pair[0], pair[1]] as [WorkerSocket, WorkerSocket];
  server.accept();
  server.close(code, reason);
  // A browser that offered sub-protocols fails the handshake unless one comes back.
  const offered = (req.headers.get("Sec-WebSocket-Protocol") ?? "").split(",").some((p) => p.trim() === "parity-live");
  return new Response(null, { status: 101, webSocket: client, headers: offered ? { "Sec-WebSocket-Protocol": "parity-live" } : undefined } as ResponseInit & { webSocket: WebSocket });
}

export const onRequest = async (ctx: Context): Promise<Response> => {
  const { request, env } = ctx;
  const url = new URL(request.url);
  const route = (ctx.params.path ?? []).join("/");
  const src = url.searchParams.get("src") ?? "";

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { ...corsFor(request), "Access-Control-Allow-Headers": "Authorization, Content-Type", "Access-Control-Allow-Methods": "GET, OPTIONS", "Access-Control-Max-Age": "86400" } });
  }

  if (route === "ws") {
    if (!env.LIVE) return json(request, 503, { error: "Live fan-out is not bound here" });
    if (!adapterFor(src, env)) return json(request, 404, { error: "Unknown source" });
    const headers = new Headers(request.headers);
    headers.delete("X-Parity-Team");
    if (isInternal(src)) {
      // Another site's page cannot ride a team member's sign-in into a team feed.
      const origin = request.headers.get("Origin");
      if (origin && !CORS_ORIGIN.test(origin) && origin !== url.origin) return refuse(4003, "Team only", request);
      const pass = await teamPass(request);
      if (!pass) return refuse(4003, "Team only", request);
      headers.set("X-Parity-Team", String(pass.until));
    }
    // The sign-in has done its job here; it does not travel on to the fan-out.
    headers.delete("Cookie");
    headers.delete("Authorization");
    const proto = (headers.get("Sec-WebSocket-Protocol") ?? "").split(",").map((p) => p.trim()).filter((p) => p && !p.startsWith("bearer."));
    if (proto.length) headers.set("Sec-WebSocket-Protocol", proto.join(", ")); else headers.delete("Sec-WebSocket-Protocol");
    const stub = env.LIVE.get(env.LIVE.idFromName(src));
    return stub.fetch(new Request(`https://hub/ws?src=${encodeURIComponent(src)}`, { method: "GET", headers }));
  }

  if (route === "me") {
    const pass = await teamPass(request);
    return json(request, 200, { team: !!pass, until: pass?.until ?? null, sources: pass ? SOURCES.filter((s) => s.licence === "internal" && ADAPTERS.some((a) => a.id === s.id && a.enabled(env))).map((s) => s.id) : [] }, 0, true);
  }

  if (route === "status") {
    if (!env.LIVE) return json(request, 503, { error: "Live fan-out is not bound here" });
    const rows = await Promise.all(ADAPTERS.filter((a) => a.enabled(env)).map(async (a) => {
      try {
        const r = await env.LIVE!.get(env.LIVE!.idFromName(a.id)).fetch(`https://hub/status?src=${a.id}`);
        return await r.json();
      } catch (e) { return { src: a.id, error: String(e) }; }
    }));
    return json(request, 200, { now: Date.now(), sources: rows });
  }

  if (route === "sources") return json(request, 200, SOURCES, 300);

  if (route === "history") {
    const sym = url.searchParams.get("s") ?? "", tf = url.searchParams.get("tf") ?? "1m";
    const priv = isInternal(src);
    if (priv && !(await teamPass(request))) return json(request, 403, { error: "Team only" }, 0, true);
    const ttl = tf === "1d" ? 1800 : tf === "1h" ? 300 : src === "coingecko" ? 60 : 20;
    return cached(ctx, `h/${src}/${sym}/${tf}`, ttl, async () => {
      try {
        const bars = await historyFor(src, sym, tf, env);
        if (!bars) return json(request, 404, { error: "No history for that symbol here" });
        return json(request, 200, { src, s: sym, tf, bars, at: Date.now() }, ttl);
      } catch (e) {
        console.error("history", src, sym, tf, String(e));
        const code = String(e).match(/\b(\d{3})\b/)?.[1];
        return json(request, 502, { error: code ? `The source answered ${code}` : "The source did not answer" });
      }
    }, priv);
  }

  if (route === "universe") {
    if (url.searchParams.get("team") === "1") {
      if (!(await teamPass(request))) return json(request, 403, { error: "Team only" }, 0, true);
      return cached(ctx, "universe-team/v1", 3600, async () => {
        try { return json(request, 200, await universe(env, true), 3600); } catch (e) { console.error("universe", String(e)); return json(request, 502, { error: "Symbol list unavailable" }); }
      }, true);
    }
    return cached(ctx, "universe/v3", 86_400, async () => {
      try { return json(request, 200, await universe(env), 86_400); } catch (e) { console.error("universe", String(e)); return json(request, 502, { error: "Symbol list unavailable" }); }
    });
  }

  return json(request, 404, { error: "Not found" });
};
