// /api/trade/*: buying and selling through the broker partner (DEC-0046), pretend money
// only until every live gate passes (src/lib/trading/mode.ts). Every order path checks the
// mode, the caller, rate limits, idempotency and risk here on the server. Keys come from the
// Pages environment and never reach the browser.
//
//   GET    status                 mode, badge, limits (no sign-in needed)
//   POST   preview                cost, fees, errors and warnings for an order
//   POST   orders                 place (Idempotency-Key header required)
//   GET    orders?status=open|all
//   PATCH  orders/:id             change qty, limit, stop or time in force (Idempotency-Key)
//   DELETE orders/:id             cancel (Idempotency-Key)
//   GET    fills | positions | export
//   GET    stream                 order updates as Server-Sent Events, ~25 s per connection
//   POST   sandbox/account        open a Broker API sandbox account with test values
//   POST   sandbox/fund           add pretend money to it
import { callerFrom } from "../../../src/lib/payments/auth";
import { DEFAULT_SUPABASE_URL, json } from "../../../src/lib/payments/guard";
import { gatewayFor } from "../../../src/lib/trading/alpaca";
import { resolveMode, type TradingEnv } from "../../../src/lib/trading/mode";
import { createTradingService, TradeError } from "../../../src/lib/trading/service";
import { memoryStore, supabaseTradingStore, type TradingStore } from "../../../src/lib/trading/store";
import { OPEN_STATUSES, type OrderRequest, type TradeOrder } from "../../../src/lib/trading/types";

interface Context { request: Request; env: TradingEnv; params: { path?: string[] | string } }

const STREAM_MS = 25_000;
const POLL_MS = 3_000;

function storeFor(env: TradingEnv): TradingStore | null {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return null;
  return supabaseTradingStore(env.SUPABASE_URL || DEFAULT_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

async function body<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new TradeError(400, "Send JSON");
  }
}

export const onRequest = async ({ request, env, params }: Context): Promise<Response> => {
  const parts = Array.isArray(params.path) ? params.path : params.path ? [params.path] : [];
  const route = parts.join("/");
  const method = request.method;
  const url = new URL(request.url);
  const store = storeFor(env);
  const decision = await resolveMode(env, () => (store ? store.adminSwitchOn() : Promise.resolve(false)));
  if (!store && decision.engine !== "browser") decision.notes.push("The server cannot record orders, so they stay in this browser");
  const effective = store ? decision : { ...decision, mode: "demo" as const, engine: "browser" as const, badge: "Demo money" };
  const service = createTradingService({ decision: effective, store: store ?? memoryStore(), gateway: store ? gatewayFor(decision, env) : null });

  try {
    if (route === "status" && method === "GET") {
      const caller = await callerFrom(request, env.SUPABASE_URL || DEFAULT_SUPABASE_URL);
      return json(200, await service.status(caller?.userId ?? null));
    }

    // Everything else needs a signed-in person. EventSource cannot send headers, so the
    // stream alone also takes the token as ?access_token=.
    let authReq = request;
    if (route === "stream" && !request.headers.get("Authorization") && url.searchParams.get("access_token")) {
      authReq = new Request(request.url, { headers: { Authorization: `Bearer ${url.searchParams.get("access_token")}` } });
    }
    const caller = await callerFrom(authReq, env.SUPABASE_URL || DEFAULT_SUPABASE_URL);
    if (!caller) return json(401, { error: "Sign in first" });
    const user = caller.userId;
    const idem = request.headers.get("Idempotency-Key");

    if (route === "preview" && method === "POST") return json(200, await service.preview(user, await body<OrderRequest>(request)));
    if (route === "orders" && method === "POST") {
      const r = await service.place(user, await body<OrderRequest>(request), idem);
      return json(r.duplicate ? 200 : 201, r);
    }
    if (route === "orders" && method === "GET") return json(200, { orders: await service.orders(user, url.searchParams.get("status") !== "all") });
    if (parts[0] === "orders" && parts.length === 2 && method === "DELETE") return json(200, await service.cancel(user, parts[1], idem));
    if (parts[0] === "orders" && parts.length === 2 && method === "PATCH") {
      const p = await body<{ qty?: number; limitPrice?: number; stopPrice?: number; timeInForce?: string }>(request);
      const patch = {
        ...(typeof p.qty === "number" ? { qty: p.qty } : {}),
        ...(typeof p.limitPrice === "number" ? { limitPrice: p.limitPrice } : {}),
        ...(typeof p.stopPrice === "number" ? { stopPrice: p.stopPrice } : {}),
        ...(typeof p.timeInForce === "string" ? { timeInForce: p.timeInForce } : {}),
      };
      if (!Object.keys(patch).length) return json(400, { error: "Nothing to change" });
      return json(200, await service.replace(user, parts[1], patch, idem));
    }
    if (route === "fills" && method === "GET") return json(200, { fills: await service.fills(user) });
    if (route === "positions" && method === "GET") return json(200, await service.positions(user));
    if (route === "export" && method === "GET") {
      return new Response(await service.exportCsv(user), {
        headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="parity-${effective.mode}-orders.csv"`, "Cache-Control": "no-store" },
      });
    }
    if (route === "sandbox/account" && method === "POST") {
      const b = await body<{ agree?: unknown }>(request);
      const ip = request.headers.get("CF-Connecting-IP") ?? "127.0.0.1";
      return json(200, { account: await service.openSandboxAccount(user, ip, b.agree === true) });
    }
    if (route === "sandbox/fund" && method === "POST") {
      const b = await body<{ amount?: unknown }>(request);
      return json(200, await service.fundSandbox(user, Number(b.amount)));
    }
    if (route === "stream" && method === "GET") return stream(service, user);
    return json(404, { error: "Not found" });
  } catch (e) {
    if (e instanceof TradeError) return json(e.status, { error: e.message, errors: e.errors });
    console.error("trade failed", e instanceof Error ? e.name : "error");
    return json(500, { error: "Something went wrong. Nothing was sent twice" });
  }
};

function stream(service: ReturnType<typeof createTradingService>, user: string): Response {
  const enc = new TextEncoder();
  const seen = new Map<string, string>();
  const sig = (o: TradeOrder) => `${o.status}|${o.filledQty}|${o.filledAvgPrice}`;
  const body = new ReadableStream<Uint8Array>({
    async start(ctrl) {
      const end = Date.now() + STREAM_MS;
      ctrl.enqueue(enc.encode(`retry: 3000\n\n`));
      let first = true;
      while (Date.now() < end) {
        try {
          const orders = await service.orders(user, false);
          for (const o of orders.slice(0, 50)) {
            if (!first && seen.get(o.id) === sig(o)) continue;
            if (first && !OPEN_STATUSES.has(o.status)) { seen.set(o.id, sig(o)); continue; }
            seen.set(o.id, sig(o));
            ctrl.enqueue(enc.encode(`event: order\ndata: ${JSON.stringify(o)}\n\n`));
          }
        } catch {
          ctrl.enqueue(enc.encode(`: status check failed\n\n`));
        }
        first = false;
        await new Promise((r) => setTimeout(r, POLL_MS));
      }
      ctrl.close();
    },
  });
  return new Response(body, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-store", Connection: "keep-alive" } });
}
