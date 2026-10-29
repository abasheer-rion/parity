// @vitest-environment node
// Server side of broker trading (DEC-0046): mode gating, idempotency, risk checks, the audit
// log and warnings. The broker is always a mock: no test talks to Alpaca or Supabase.
import { describe, expect, it, vi } from "vitest";
import { BrokerError, brokerGateway, gatewayFor, orderBody, paperGateway, sandboxAccountBody, type AlpacaOrder, type Gateway } from "../../src/lib/trading/alpaca";
import { checklistComplete, liveGate, resolveMode, type Checklist, type TradingEnv } from "../../src/lib/trading/mode";
import { DEFAULT_LIMITS, checkOrder, estimateFees, type RiskContext } from "../../src/lib/trading/risk";
import { book, countDayTrades, createTradingService, DEMO_START_CASH, TradeError } from "../../src/lib/trading/service";
import { memoryStore } from "../../src/lib/trading/store";
import type { OrderRequest } from "../../src/lib/trading/types";

const PAPER: TradingEnv = { ALPACA_KEY_ID: "pk", ALPACA_SECRET_KEY: "ps" };
const SANDBOX: TradingEnv = { ...PAPER, TRADING_MODE: "sandbox", ALPACA_BROKER_KEY_ID: "bk", ALPACA_BROKER_SECRET: "bs" };
const LIVE_ALL: TradingEnv = { ...SANDBOX, TRADING_MODE: "live", ALPACA_LIVE_BROKER_KEY_ID: "lk", ALPACA_LIVE_BROKER_SECRET: "ls", TRADING_LIVE_DEPLOY: "on" };
const DONE: Checklist = { complete: true, items: [{ id: "a", item: "x", done: true, evidence: "Signed 2027-01-01, file ref 12" }] };
const on = async () => true;
const off = async () => false;

describe("trading mode", () => {
  it("defaults to demo, in the browser without keys", async () => {
    const d = await resolveMode({}, off);
    expect(d).toMatchObject({ mode: "demo", engine: "browser", badge: "Demo money" });
  });
  it("demo uses the paper account when the paper keys exist", async () => {
    expect(await resolveMode(PAPER, off)).toMatchObject({ mode: "demo", engine: "alpaca_paper" });
  });
  it("sandbox needs both sandbox keys, else demo with a note", async () => {
    expect(await resolveMode(SANDBOX, off)).toMatchObject({ mode: "sandbox", engine: "alpaca_broker_sandbox", badge: "Sandbox" });
    const d = await resolveMode({ ...PAPER, TRADING_MODE: "sandbox", ALPACA_BROKER_KEY_ID: "bk" }, off);
    expect(d.mode).toBe("demo");
    expect(d.notes).toContain("Sandbox keys are not set");
  });
  it("live passes only with all four gates", async () => {
    expect((await resolveMode(LIVE_ALL, on, DONE)).mode).toBe("live");
    const cases: [TradingEnv, () => Promise<boolean>, Checklist, string][] = [
      [{ ...LIVE_ALL, ALPACA_LIVE_BROKER_SECRET: "" }, on, DONE, "No live broker key is set"],
      [{ ...LIVE_ALL, TRADING_LIVE_DEPLOY: "yes" }, on, DONE, "The deploy does not set TRADING_LIVE_DEPLOY=on"],
      [LIVE_ALL, off, DONE, "No trading admin has switched live trading on"],
      [LIVE_ALL, on, { ...DONE, complete: false }, "The registration checklist is not complete"],
      [LIVE_ALL, async () => { throw new Error("db down"); }, DONE, "No trading admin has switched live trading on"],
    ];
    for (const [env, sw, list, why] of cases) {
      const d = await resolveMode(env, sw, list);
      expect(d.mode).not.toBe("live");
      expect(d.mode).toBe("sandbox");
      expect(d.notes).toContain(why);
    }
  });
  it("the committed checklist is not complete", async () => {
    expect(checklistComplete()).toBe(false);
    expect((await liveGate(LIVE_ALL, on)).ok).toBe(false);
  });
  it("a checklist marked complete without evidence does not count", () => {
    expect(checklistComplete({ complete: true, items: [{ id: "a", item: "x", done: true, evidence: "" }] })).toBe(false);
    expect(checklistComplete({ complete: true, items: [] })).toBe(false);
  });
  it("never builds the live gateway outside live mode", () => {
    expect(() => gatewayFor({ mode: "sandbox", engine: "alpaca_broker_live", badge: "Sandbox", notes: [] }, LIVE_ALL)).toThrow();
    expect(gatewayFor({ mode: "demo", engine: "browser", badge: "Demo money", notes: [] }, {})).toBeNull();
  });
  it("the paper gateway refuses a non-paper address", () => {
    expect(() => paperGateway("k", "s", fetch, "https://api.alpaca.markets")).toThrow(/paper/);
  });
});

// ---------------------------------------------------------------- risk

const ctx = (over: Partial<RiskContext> = {}): RiskContext => ({ mode: "demo", lastPrice: 100, heldQty: 0, pendingSellQty: 0, buyingPower: 100_000, equity: 100_000, dayTrades: 0, ...over });
const buy = (over: Partial<OrderRequest> = {}): OrderRequest => ({ symbol: "SPY", side: "buy", type: "market", qty: 1, timeInForce: "day", ...over });

describe("risk checks", () => {
  it("accepts a plain market buy", () => {
    const r = checkOrder(buy(), ctx());
    expect(r.ok).toBe(true);
    expect(r.estCost).toBe(100);
  });
  it("refuses an order over the size limits", () => {
    expect(checkOrder(buy({ qty: 300 }), ctx()).errors.join()).toMatch(/Order value is over/);
    expect(checkOrder(buy({ qty: DEFAULT_LIMITS.maxQty + 1 }), ctx({ lastPrice: 1 })).errors.join()).toMatch(/Quantity is over/);
  });
  it("refuses a limit or stop price outside the collar", () => {
    expect(checkOrder(buy({ type: "limit", limitPrice: 120 }), ctx()).errors.join()).toMatch(/Limit price is more than 10%/);
    expect(checkOrder(buy({ type: "stop", stopPrice: 80 }), ctx()).errors.join()).toMatch(/Stop price is more than 10%/);
    expect(checkOrder(buy({ type: "limit", limitPrice: 105 }), ctx()).ok).toBe(true);
  });
  it("refuses short sales and selling more than is free", () => {
    expect(checkOrder(buy({ side: "sell" }), ctx()).errors.join()).toMatch(/Short selling is off/);
    expect(checkOrder(buy({ side: "sell", qty: 3 }), ctx({ heldQty: 5, pendingSellQty: 3 })).errors.join()).toMatch(/sell up to 2/);
    expect(checkOrder(buy({ side: "sell", qty: 2 }), ctx({ heldQty: 5, pendingSellQty: 3 })).ok).toBe(true);
    expect(checkOrder(buy({ symbol: "BTC/USD", side: "sell", qty: 1, timeInForce: "gtc" }), ctx()).errors.join()).toMatch(/Crypto cannot be sold short/);
  });
  it("warns before a fourth day trade under $25,000", () => {
    const r = checkOrder(buy(), ctx({ equity: 10_000, dayTrades: 3 }));
    expect(r.ok).toBe(true);
    expect(r.warnings.join()).toMatch(/pattern day trader/);
    expect(checkOrder(buy(), ctx({ equity: 30_000, dayTrades: 3 })).warnings.join()).not.toMatch(/pattern/);
  });
  it("checks quantity or notional, crypto time in force and brackets", () => {
    expect(checkOrder(buy({ notional: 50 }), ctx()).errors.join()).toMatch(/not both/);
    expect(checkOrder(buy({ qty: undefined, notional: 50, type: "limit", limitPrice: 100 }), ctx()).errors.join()).toMatch(/market orders only/);
    expect(checkOrder(buy({ symbol: "BTC/USD", timeInForce: "day" }), ctx()).errors.join()).toMatch(/GTC or IOC/);
    expect(checkOrder(buy({ orderClass: "bracket", takeProfit: 95, stopLoss: 105 }), ctx()).errors.join()).toMatch(/Take profit must be above/);
    expect(checkOrder(buy({ orderClass: "bracket", takeProfit: 105, stopLoss: 95 }), ctx()).ok).toBe(true);
    expect(checkOrder(buy({ buyingPower: 0 } as never), ctx({ buyingPower: 50 })).errors.join()).toMatch(/buying power/);
  });
  it("estimates sell fees and none on buys or crypto", () => {
    expect(estimateFees("buy", 10, 1000, "us_equity")).toBe(0);
    expect(estimateFees("sell", 10, 1000, "crypto")).toBe(0);
    expect(estimateFees("sell", 100, 10_000, "us_equity")).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------- service with a mock broker

function mockBroker(opts: { fillAt?: number; fail?: BrokerError; timeoutButSent?: boolean } = {}) {
  const orders = new Map<string, AlpacaOrder>();
  let n = 0;
  const g: Gateway & { calls: string[] } = {
    engine: "alpaca_paper",
    calls: [],
    async placeOrder(_a, req, cid) {
      g.calls.push(`place ${cid}`);
      const o: AlpacaOrder = {
        id: `bro-${++n}-0000-0000-0000-000000000000`, client_order_id: cid, status: opts.fillAt ? "filled" : "accepted", symbol: req.symbol, side: req.side,
        qty: req.qty === undefined ? null : String(req.qty), notional: null, filled_qty: opts.fillAt ? String(req.qty) : "0", filled_avg_price: opts.fillAt ? String(opts.fillAt) : null,
        limit_price: null, stop_price: null, time_in_force: req.timeInForce, created_at: "", updated_at: "",
      };
      if (opts.fail) throw opts.fail;
      orders.set(cid, o);
      if (opts.timeoutButSent) throw new BrokerError(503, "The broker did not answer (TimeoutError)", "network");
      return o;
    },
    async orderByClientId(_a, cid) { return orders.get(cid) ?? null; },
    async cancelOrder(_a, id) { g.calls.push(`cancel ${id}`); },
    async replaceOrder(_a, id, p, cid) {
      g.calls.push(`replace ${id}`);
      const o = { ...[...orders.values()].find((x) => x.id === id)!, id: `rep-${++n}-0000-0000-0000-000000000000`, client_order_id: cid, qty: String(p.qty ?? 1) };
      orders.set(cid, o);
      return o;
    },
    async positions() { return []; },
    async account() { return { cash: "1000", buying_power: "1000", equity: "1000" }; },
    async lastPrice() { return 100; },
  };
  return { g, orders };
}

const DEMO = { mode: "demo" as const, engine: "alpaca_paper" as const, badge: "Demo money", notes: [] };
const U = "11111111-1111-4111-8111-111111111111";

describe("trading service", () => {
  it("places once per idempotency key and logs it", async () => {
    const store = memoryStore();
    const { g } = mockBroker();
    const s = createTradingService({ decision: DEMO, store, gateway: g });
    const a = await s.place(U, buy(), "key-0001-abcd");
    const b = await s.place(U, buy(), "key-0001-abcd");
    expect(a.duplicate).toBe(false);
    expect(b.duplicate).toBe(true);
    expect(b.order.id).toBe(a.order.id);
    expect(g.calls.filter((c) => c.startsWith("place"))).toHaveLength(1);
    expect(store.orders).toHaveLength(1);
    expect(store.audits.map((x) => x.event)).toEqual(["requested", "sent", "duplicate"]);
    expect(store.orders[0].mode).toBe("demo");
  });
  it("prefixes the key sent to the shared paper account per person", async () => {
    const { g } = mockBroker();
    const s = createTradingService({ decision: DEMO, store: memoryStore(), gateway: g });
    await s.place(U, buy(), "key-pref-0001");
    expect(g.calls[0]).toBe("place 111111111111-key-pref-0001");
  });
  it("refuses outside demo when price or buying power is unknown", () => {
    expect(checkOrder(buy({ type: "limit", limitPrice: 100 }), ctx({ mode: "sandbox", lastPrice: null })).errors.join()).toMatch(/No recent price/);
    expect(checkOrder(buy({ type: "limit", limitPrice: 100 }), ctx({ lastPrice: null })).ok).toBe(true);
  });
  it("refuses a missing or bad idempotency key", async () => {
    const s = createTradingService({ decision: DEMO, store: memoryStore(), gateway: mockBroker().g });
    await expect(s.place(U, buy(), null)).rejects.toMatchObject({ status: 400 });
    await expect(s.place(U, buy(), "short")).rejects.toMatchObject({ status: 400 });
  });
  it("refuses a risky order before the broker sees it, and logs the refusal", async () => {
    const store = memoryStore();
    const { g } = mockBroker();
    const s = createTradingService({ decision: DEMO, store, gateway: g });
    await expect(s.place(U, buy({ side: "sell" }), "key-sell-0001")).rejects.toMatchObject({ status: 422 });
    expect(g.calls).toHaveLength(0);
    expect(store.orders).toHaveLength(0);
    expect(store.audits[0].event).toBe("refused");
  });
  it("tracks fills, positions and cash per person in the shared demo account", async () => {
    const store = memoryStore();
    const s = createTradingService({ decision: DEMO, store, gateway: mockBroker({ fillAt: 100 }).g });
    await s.place(U, buy({ qty: 10 }), "key-fill-0001");
    const { positions, balances } = await s.positions(U);
    expect(positions).toEqual([expect.objectContaining({ symbol: "SPY", qty: 10, avgCost: 100 })]);
    expect(balances.cash).toBe(DEMO_START_CASH - 1000);
    expect(balances.badge).toBe("Demo money");
    // Another person sees none of it.
    expect((await s.positions("22222222-2222-4222-8222-222222222222")).positions).toEqual([]);
    // A refresh does not record the same fill twice.
    await s.orders(U, false);
    expect(store.audits.filter((a) => a.event === "fill")).toHaveLength(1);
  });
  it("finds an order that reached the broker despite a timeout", async () => {
    const store = memoryStore();
    const s = createTradingService({ decision: DEMO, store, gateway: mockBroker({ timeoutButSent: true }).g });
    const r = await s.place(U, buy(), "key-time-0001");
    expect(r.order.status).toBe("accepted");
    expect(store.warnings).toHaveLength(0);
  });
  it("puts broker outages in the warnings, not a person's mistakes", async () => {
    const store = memoryStore();
    const down = createTradingService({ decision: DEMO, store, gateway: mockBroker({ fail: new BrokerError(500, "internal") }).g });
    await expect(down.place(U, buy(), "key-down-0001")).rejects.toMatchObject({ status: 502 });
    expect(store.warnings).toEqual([expect.objectContaining({ source: "broker.alpaca", severity: "error" })]);
    expect(store.orders[0].status).toBe("error");
    const store2 = memoryStore();
    const picky = createTradingService({ decision: DEMO, store: store2, gateway: mockBroker({ fail: new BrokerError(422, "qty must be > 0") }).g });
    await expect(picky.place(U, buy(), "key-pick-0001")).rejects.toMatchObject({ status: 422 });
    expect(store2.warnings).toHaveLength(0);
    expect(store2.audits.map((a) => a.event)).toContain("rejected");
  });
  it("rate limits order actions", async () => {
    const store = memoryStore();
    const s = createTradingService({ decision: DEMO, store, gateway: mockBroker().g, limits: { ...DEFAULT_LIMITS, ordersPerMinute: 2 } });
    await s.place(U, buy(), "key-rate-0001");
    await s.place(U, buy(), "key-rate-0002");
    await expect(s.place(U, buy(), "key-rate-0003")).rejects.toMatchObject({ status: 429 });
    expect(store.audits.at(-1)?.event).toBe("rate_limited");
  });
  it("cancels and changes once per key", async () => {
    const store = memoryStore();
    const { g } = mockBroker();
    const s = createTradingService({ decision: DEMO, store, gateway: g });
    const { order } = await s.place(U, buy({ type: "limit", limitPrice: 99, qty: 2 }), "key-ord-00001");
    const r1 = await s.replace(U, order.id, { qty: 3 }, "key-rep-00001");
    const r2 = await s.replace(U, order.id, { qty: 3 }, "key-rep-00001");
    expect(r2.duplicate).toBe(true);
    expect(r2.order.id).toBe(r1.order.id);
    expect(g.calls.filter((c) => c.startsWith("replace"))).toHaveLength(1);
    const c1 = await s.cancel(U, r1.order.id, "key-can-00001");
    const c2 = await s.cancel(U, r1.order.id, "key-can-00001");
    expect([c1.duplicate, c2.duplicate]).toEqual([false, true]);
    expect(g.calls.filter((c) => c.startsWith("cancel"))).toHaveLength(1);
    await expect(s.cancel("22222222-2222-4222-8222-222222222222", r1.order.id, "key-can-00002")).rejects.toMatchObject({ status: 404 });
  });
  it("keeps orders in the browser when the server has no broker", async () => {
    const s = createTradingService({ decision: { ...DEMO, engine: "browser" }, store: memoryStore(), gateway: null });
    await expect(s.place(U, buy(), "key-none-0001")).rejects.toBeInstanceOf(TradeError);
  });
  it("sandbox needs an account, takes test values only and refuses outside sandbox", async () => {
    const store = memoryStore();
    const created: Record<string, unknown>[] = [];
    const g = { ...mockBroker().g, engine: "alpaca_broker_sandbox" as const, createAccount: async (b: Record<string, unknown>) => { created.push(b); return { id: "acct-1", status: "APPROVED" }; } };
    const sb = createTradingService({ decision: { mode: "sandbox", engine: "alpaca_broker_sandbox", badge: "Sandbox", notes: [] }, store, gateway: g });
    await expect(sb.place(U, buy(), "key-sbx-00001")).rejects.toMatchObject({ status: 409 });
    await expect(sb.openSandboxAccount(U, "1.2.3.4", false)).rejects.toMatchObject({ status: 400 });
    expect(await sb.openSandboxAccount(U, "1.2.3.4", true)).toEqual({ status: "APPROVED", funded: false });
    expect((created[0].identity as { tax_id: string }).tax_id).toBe("666-55-4321");
    const demo = createTradingService({ decision: DEMO, store: memoryStore(), gateway: g });
    await expect(demo.openSandboxAccount(U, "1.2.3.4", true)).rejects.toMatchObject({ status: 409 });
    await expect(demo.fundSandbox(U, 100)).rejects.toMatchObject({ status: 409 });
  });
  it("exports history as CSV that cannot run formulas", async () => {
    const store = memoryStore();
    const s = createTradingService({ decision: DEMO, store, gateway: mockBroker({ fillAt: 100 }).g });
    await s.place(U, buy(), "key-csv-00001");
    const csv = await s.exportCsv(U);
    expect(csv.split("\n")[0]).toMatch(/^record,mode,time,symbol/);
    expect(csv).toMatch(/order,demo,.*SPY,buy,market/);
    expect(csv).toMatch(/fill,demo/);
  });
});

describe("books and day trades", () => {
  it("averages cost and books realized P&L", () => {
    const b = book([
      { at: "2026-10-01T15:00:00Z", clientOrderId: "a", symbol: "X", side: "buy", qty: 2, price: 10 },
      { at: "2026-10-01T16:00:00Z", clientOrderId: "b", symbol: "X", side: "buy", qty: 2, price: 20 },
      { at: "2026-10-01T17:00:00Z", clientOrderId: "c", symbol: "X", side: "sell", qty: 1, price: 25 },
    ]);
    expect(b.positions.get("X")).toEqual({ qty: 3, avgCost: 15, realized: 10 });
    expect(countDayTrades([
      { at: "2026-10-01T15:00:00Z", clientOrderId: "a", symbol: "X", side: "buy", qty: 1, price: 1 },
      { at: "2026-10-01T16:00:00Z", clientOrderId: "b", symbol: "X", side: "sell", qty: 1, price: 1 },
    ], new Date("2026-10-02T00:00:00Z"))).toBe(1);
  });
});

describe("Alpaca requests", () => {
  it("sends the paper keys to the paper address and the order fields Alpaca expects", async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ id: "o1" }), { status: 200 }));
    const g = paperGateway("pk", "ps", f as unknown as typeof fetch);
    await g.placeOrder(null, { symbol: "SPY", assetClass: "us_equity", side: "buy", type: "limit", qty: 1, limitPrice: 99, timeInForce: "day", orderClass: "bracket", takeProfit: 105, stopLoss: 95 }, "key-req-00001");
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://paper-api.alpaca.markets/v2/orders");
    expect((init.headers as Record<string, string>)["APCA-API-KEY-ID"]).toBe("pk");
    expect(JSON.parse(String(init.body))).toMatchObject({ symbol: "SPY", order_class: "bracket", take_profit: { limit_price: "105" }, stop_loss: { stop_price: "95" }, client_order_id: "key-req-00001" });
  });
  it("talks to the Broker API sandbox by default, per account", async () => {
    const f = vi.fn(async () => new Response("[]", { status: 200 }));
    const g = brokerGateway("bk", "bs", { fetcher: f as unknown as typeof fetch });
    await g.positions("acct-9");
    expect((f.mock.calls[0] as unknown as [string])[0]).toBe("https://broker-api.sandbox.alpaca.markets/v1/trading/accounts/acct-9/positions");
    await expect(g.positions(null)).rejects.toMatchObject({ status: 409 });
  });
  it("turns broker errors into BrokerError without the keys", async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ code: 40310000, message: "insufficient buying power" }), { status: 403 }));
    const g = paperGateway("pk", "secret-value", f as unknown as typeof fetch);
    const e = (await g.account(null).catch((x: unknown) => x)) as BrokerError;
    expect(e).toBeInstanceOf(BrokerError);
    expect(e.message).toBe("insufficient buying power");
    expect(e.message).not.toMatch(/secret-value/);
  });
  it("uses notional for dollar orders and Alpaca's test identity for sandbox accounts", () => {
    expect(orderBody({ symbol: "SPY", side: "buy", type: "market", notional: 25.5, timeInForce: "day" }, "k")).toMatchObject({ notional: "25.50" });
    const b = sandboxAccountBody(U, "1.2.3.4", new Date("2026-10-26T00:00:00Z")) as { contact: { email_address: string }; identity: { tax_id: string } };
    expect(b.identity.tax_id).toBe("666-55-4321");
    expect(b.contact.email_address).toMatch(/@example\.com$/);
  });
});
