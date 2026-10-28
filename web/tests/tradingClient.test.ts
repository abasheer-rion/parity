// The browser client for /api/trade (DEC-0046): the sign-in token on every call, one
// idempotency key per submission reused on retry, error bodies, and the order stream's
// token in the address and its reconnect. No test talks to the network.
import { afterEach, describe, expect, it, vi } from "vitest";
import { createTradingClient, IDEMPOTENCY_KEY, isCrypto, newIdempotencyKey, subscribeOrders, TradeApiError, tifsFor } from "../src/lib/trading/client";
import type { OrderRequest, TradeOrder } from "../src/lib/trading/types";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const REQ: OrderRequest = { symbol: "AAPL", side: "buy", type: "market", qty: 1, timeInForce: "day" };
const ORDER = { id: "o1", clientOrderId: "c1", symbol: "AAPL", status: "new", filledQty: 0, createdAt: "2026-10-26T14:00:00Z" } as TradeOrder;

function client(fetch: ReturnType<typeof vi.fn>, token: string | null = "tok-123") {
  return createTradingClient({ fetch: fetch as unknown as typeof globalThis.fetch, token: async () => token });
}
const headersOf = (f: ReturnType<typeof vi.fn>, i = 0) => (f.mock.calls[i][1] as RequestInit).headers as Record<string, string>;

describe("idempotency keys", () => {
  it("are 8 to 48 characters from the allowed set, and differ each time", () => {
    const a = newIdempotencyKey(), b = newIdempotencyKey();
    expect(a).toMatch(IDEMPOTENCY_KEY);
    expect(a).not.toBe(b);
  });
});

describe("trading client", () => {
  it("sends the bearer token on every call", async () => {
    const f = vi.fn(async (_u?: string, _i?: RequestInit) => json({ mode: "demo", engine: "browser", badge: "Demo money", notes: [], limits: {} }));
    await client(f).status();
    expect(f).toHaveBeenCalledWith("/api/trade/status", expect.objectContaining({ method: "GET" }));
    expect(headersOf(f).Authorization).toBe("Bearer tok-123");
  });

  it("sends the order as JSON with the Idempotency-Key header", async () => {
    const f = vi.fn(async (_u?: string, _i?: RequestInit) => json({ order: ORDER, duplicate: false }));
    const key = newIdempotencyKey();
    const r = await client(f).placeOrder(REQ, key);
    expect(r.order.id).toBe("o1");
    const init = f.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual(REQ);
    expect(headersOf(f)).toMatchObject({ Authorization: "Bearer tok-123", "Idempotency-Key": key, "Content-Type": "application/json" });
  });

  it("retries a dropped submission with the same key", async () => {
    const f = vi.fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(json({ order: ORDER, duplicate: true }));
    const key = newIdempotencyKey();
    const r = await client(f).placeOrder(REQ, key);
    expect(r.duplicate).toBe(true);
    expect(f).toHaveBeenCalledTimes(2);
    expect(headersOf(f, 0)["Idempotency-Key"]).toBe(key);
    expect(headersOf(f, 1)["Idempotency-Key"]).toBe(key);
  });

  it("retries a 5xx with the same key but not a 4xx", async () => {
    const f5 = vi.fn().mockResolvedValueOnce(json({ error: "busy" }, 503)).mockResolvedValueOnce(json({ order: ORDER, duplicate: false }));
    await client(f5).placeOrder(REQ, "key-aaaaaaaa");
    expect(f5.mock.calls.map((_, i) => headersOf(f5, i)["Idempotency-Key"])).toEqual(["key-aaaaaaaa", "key-aaaaaaaa"]);

    const f4 = vi.fn(async (_u?: string, _i?: RequestInit) => json({ error: "Order refused", errors: ["Over the order limit"] }, 422));
    const err = await client(f4).placeOrder(REQ, "key-bbbbbbbb").catch((e) => e);
    expect(f4).toHaveBeenCalledTimes(1);
    expect(err).toBeInstanceOf(TradeApiError);
    expect(err).toMatchObject({ message: "Order refused", status: 422, errors: ["Over the order limit"] });
  });

  it("sends the key on modify and cancel", async () => {
    const f = vi.fn().mockResolvedValueOnce(json({ order: ORDER })).mockResolvedValueOnce(json({ ok: true }));
    const c = client(f);
    await c.modifyOrder("o 1", { qty: 2 }, "mod-key-1");
    await c.cancelOrder("o1", "can-key-1");
    expect(f.mock.calls[0][0]).toBe("/api/trade/orders/o%201");
    expect((f.mock.calls[0][1] as RequestInit).method).toBe("PATCH");
    expect(headersOf(f, 0)["Idempotency-Key"]).toBe("mod-key-1");
    expect((f.mock.calls[1][1] as RequestInit).method).toBe("DELETE");
    expect(headersOf(f, 1)["Idempotency-Key"]).toBe("can-key-1");
  });

  it("refuses a malformed key before sending", async () => {
    const f = vi.fn();
    await expect(client(f).placeOrder(REQ, "short")).rejects.toThrow(/idempotency/i);
    expect(f).not.toHaveBeenCalled();
  });

  it("asks for sign-in and sends nothing without a token", async () => {
    const f = vi.fn();
    await expect(client(f, null).status()).rejects.toMatchObject({ status: 401 });
    expect(f).not.toHaveBeenCalled();
  });

  it("asks for open or all orders and unwraps the lists", async () => {
    const f = vi.fn().mockResolvedValueOnce(json({ orders: [ORDER] })).mockResolvedValueOnce(json({ fills: [] }));
    const c = client(f);
    expect(await c.orders("open")).toHaveLength(1);
    expect(f.mock.calls[0][0]).toBe("/api/trade/orders?status=open");
    expect(await c.fills()).toEqual([]);
  });

  it("sends only agree and amount to the sandbox endpoints", async () => {
    const f = vi.fn().mockResolvedValueOnce(json({ account: { status: "ACTIVE", funded: false } })).mockResolvedValueOnce(json({ ok: true }));
    const c = client(f);
    await c.createSandboxAccount();
    await c.fundSandbox(5000);
    expect(JSON.parse((f.mock.calls[0][1] as RequestInit).body as string)).toEqual({ agree: true });
    expect(JSON.parse((f.mock.calls[1][1] as RequestInit).body as string)).toEqual({ amount: 5000 });
  });
});

describe("symbols", () => {
  it("treats a slash as crypto, which allows gtc and ioc only", () => {
    expect(isCrypto("BTC/USD")).toBe(true);
    expect(tifsFor("BTC/USD")).toEqual(["gtc", "ioc"]);
    expect(tifsFor("AAPL")).toEqual(["day", "gtc", "ioc", "fok"]);
  });
});

class FakeES {
  static all: FakeES[] = [];
  listeners: Record<string, ((e: unknown) => void)[]> = {};
  onerror: (() => void) | null = null;
  closed = false;
  constructor(readonly url: string) { FakeES.all.push(this); }
  addEventListener(name: string, fn: (e: unknown) => void) { (this.listeners[name] ??= []).push(fn); }
  emit(name: string, data?: string) { for (const fn of this.listeners[name] ?? []) fn({ data }); }
  close() { this.closed = true; }
}

describe("order stream", () => {
  afterEach(() => { vi.useRealTimers(); FakeES.all = []; });

  it("puts the token in the address, since EventSource cannot send headers", async () => {
    const url = await createTradingClient({ token: async () => "a b+c" }).streamUrl();
    expect(url).toBe("/api/trade/stream?access_token=a%20b%2Bc");
  });

  it("passes order events on and reconnects with a fresh token after the server closes", async () => {
    vi.useFakeTimers();
    let n = 0;
    const c = createTradingClient({ token: async () => `tok${++n}` });
    const got: TradeOrder[] = [];
    const stop = subscribeOrders(c, (o) => got.push(o), { EventSource: FakeES as unknown as typeof EventSource, retryMs: 500 });
    await vi.advanceTimersByTimeAsync(0);
    expect(FakeES.all).toHaveLength(1);
    expect(FakeES.all[0].url).toContain("access_token=tok1");
    FakeES.all[0].emit("order", JSON.stringify(ORDER));
    expect(got[0].id).toBe("o1");

    FakeES.all[0].onerror?.();
    expect(FakeES.all[0].closed).toBe(true);
    await vi.advanceTimersByTimeAsync(500);
    expect(FakeES.all).toHaveLength(2);
    expect(FakeES.all[1].url).toContain("access_token=tok2");

    stop();
    expect(FakeES.all[1].closed).toBe(true);
    FakeES.all[1].onerror?.();
    await vi.advanceTimersByTimeAsync(20000);
    expect(FakeES.all).toHaveLength(2);
  });
});
