// The trading service behind /api/trade (DEC-0046). Every order path runs here, on the
// server: the mode decision, rate limits, idempotency, risk checks, the append-only audit
// log, then the broker. Broker failures go to the warnings table. Imported by Pages
// Functions, so nothing here may read import.meta.env.
import { BrokerError, SANDBOX_ACH, sandboxAccountBody, type AlpacaOrder, type BrokerAccounts, type Gateway, type OrderPatch } from "./alpaca";
import type { ModeDecision } from "./mode";
import { DEFAULT_LIMITS, IDEM_RE, checkOrder, normalise, type RiskContext } from "./risk";
import { DuplicateError, type Provider, type StoredMode, type StoredOrder, type TradingStore } from "./store";
import {
  OPEN_STATUSES, type OrderRequest, type Preview, type RiskLimits, type TradeBalances, type TradeFill, type TradeOrder, type TradePosition, type TradingStatus,
} from "./types";

/** Pretend cash each person starts with in the shared demo account. */
export const DEMO_START_CASH = 100_000;
export const SANDBOX_AGREEMENT_VERSION = "alpaca-sandbox-2026-10";
export const MAX_SANDBOX_FUNDING = 50_000;

export class TradeError extends Error {
  constructor(public status: number, message: string, public errors: string[] = []) {
    super(message);
    this.name = "TradeError";
  }
}

export interface ServiceDeps {
  decision: ModeDecision;
  store: TradingStore;
  gateway: (Gateway & Partial<BrokerAccounts>) | null;
  limits?: RiskLimits;
  now?: () => Date;
}

export function toTradeOrder(o: StoredOrder): TradeOrder {
  return {
    id: o.id, clientOrderId: o.client_order_id, brokerOrderId: o.broker_order_id, mode: o.mode, symbol: o.symbol, assetClass: o.asset_class,
    side: o.side, type: o.type, orderClass: o.order_class, qty: o.qty, notional: o.notional, limitPrice: o.limit_price, stopPrice: o.stop_price,
    takeProfit: o.take_profit, stopLoss: o.stop_loss, timeInForce: o.time_in_force, status: o.status, filledQty: Number(o.filled_qty) || 0,
    filledAvgPrice: o.filled_avg_price, reason: o.reason, createdAt: o.created_at, updatedAt: o.updated_at,
  };
}

const num = (v: string | number | null | undefined): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const round = (v: number, d = 2) => Math.round(v * 10 ** d) / 10 ** d;
const fillKey = (brokerId: string, qty: number) => `f-${brokerId}-${String(qty).replace(/[^0-9]/g, "_")}`.slice(0, 64);

/** New York calendar day of a timestamp, for day-trade counting. */
const nyDay = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/New_York" });

/** Positions and realized P&L from a list of fills, oldest first. Average cost method. */
export function book(fills: TradeFill[]): { positions: Map<string, { qty: number; avgCost: number; realized: number }>; cashDelta: number } {
  const positions = new Map<string, { qty: number; avgCost: number; realized: number }>();
  let cashDelta = 0;
  for (const f of fills) {
    const p = positions.get(f.symbol) ?? { qty: 0, avgCost: 0, realized: 0 };
    if (f.side === "buy") {
      const qty = p.qty + f.qty;
      p.avgCost = qty > 0 ? (p.avgCost * p.qty + f.price * f.qty) / qty : 0;
      p.qty = qty;
      cashDelta -= f.qty * f.price;
    } else {
      const sold = Math.min(f.qty, Math.max(0, p.qty));
      p.realized += sold * (f.price - p.avgCost);
      p.qty -= f.qty;
      if (Math.abs(p.qty) < 1e-9) { p.qty = 0; p.avgCost = 0; }
      cashDelta += f.qty * f.price;
    }
    positions.set(f.symbol, p);
  }
  return { positions, cashDelta };
}

/** Day trades in the last 5 business days: a buy and a sell of one symbol on one day. */
export function countDayTrades(fills: TradeFill[], now: Date): number {
  const since = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  const days = new Map<string, Set<string>>();
  for (const f of fills) {
    if (f.at < since) continue;
    const k = `${f.symbol}|${nyDay(f.at)}`;
    const s = days.get(k) ?? new Set<string>();
    s.add(f.side);
    days.set(k, s);
  }
  return [...days.values()].filter((s) => s.size === 2).length;
}

export function createTradingService(deps: ServiceDeps) {
  const { decision, store, gateway } = deps;
  const limits = deps.limits ?? DEFAULT_LIMITS;
  const now = deps.now ?? (() => new Date());
  const mode = decision.mode as StoredMode;
  const provider: Provider = decision.engine === "alpaca_paper" ? "alpaca_paper" : "alpaca_broker";
  const shared = decision.engine === "alpaca_paper";

  function live(): Gateway & Partial<BrokerAccounts> {
    if (!gateway) throw new TradeError(409, "Orders stay in this browser while the server has no broker keys");
    return gateway;
  }

  async function accountId(userId: string): Promise<string | null> {
    if (shared) return null;
    const acct = await store.account(userId);
    if (!acct) throw new TradeError(409, "Open a sandbox account first");
    return acct.external_account_id;
  }

  async function brokerFailed(userId: string, what: string, e: unknown, cid?: string | null): Promise<never> {
    const be = e instanceof BrokerError ? e : new BrokerError(500, e instanceof Error ? e.message.slice(0, 200) : "Unknown error");
    await store.audit({ user_id: userId, mode, provider, event: be.isUserError ? "rejected" : "error", client_order_id: cid ?? null, detail: { what, status: be.status, code: be.code, message: be.message } });
    if (!be.isUserError) {
      await store.warn("broker.alpaca", be.status >= 500 || be.status === 401 || be.status === 403 ? "error" : "warn", `${what} failed: ${be.message}`, { status: be.status, code: be.code, engine: decision.engine });
      throw new TradeError(502, "The broker could not take this right now. Try again shortly");
    }
    throw new TradeError(422, be.message, [be.message]);
  }

  async function rateLimit(userId: string) {
    const since = new Date(now().getTime() - 60_000).toISOString();
    if ((await store.countActions(userId, since)) >= limits.ordersPerMinute) {
      await store.audit({ user_id: userId, mode, provider, event: "rate_limited" });
      throw new TradeError(429, "Too many orders in a minute. Wait a moment");
    }
  }

  // ------------------------------------------------------------ fills and sync

  async function recordFills(userId: string, o: StoredOrder, a: AlpacaOrder, prevQty: number, prevAvg: number | null): Promise<void> {
    const qty = num(a.filled_qty) ?? 0;
    const avg = num(a.filled_avg_price);
    if (qty > prevQty + 1e-12 && avg) {
      const delta = qty - prevQty;
      const price = prevQty > 0 && prevAvg ? (qty * avg - prevQty * prevAvg) / delta : avg;
      await store.audit({ user_id: userId, mode, provider, event: "fill", client_order_id: o.client_order_id, broker_order_id: a.id, idem_key: fillKey(a.id, qty), detail: { symbol: o.symbol, side: o.side, qty: delta, price: round(price, 6) } });
    }
    // Bracket legs fill on their own (take profit or stop loss, opposite side).
    for (const leg of a.legs ?? []) {
      const lq = num(leg.filled_qty) ?? 0;
      const la = num(leg.filled_avg_price);
      if (lq > 0 && la) {
        await store.audit({ user_id: userId, mode, provider, event: "fill", client_order_id: o.client_order_id, broker_order_id: leg.id, idem_key: fillKey(leg.id, lq), detail: { symbol: o.symbol, side: o.side === "buy" ? "sell" : "buy", qty: lq, price: la, leg: true } });
      }
    }
  }

  async function sync(userId: string, o: StoredOrder): Promise<StoredOrder> {
    if (!gateway || !OPEN_STATUSES.has(o.status)) return o;
    let a: AlpacaOrder | null;
    try {
      a = await gateway.orderByClientId(shared ? null : await accountId(userId), o.client_order_id);
    } catch (e) {
      if (e instanceof BrokerError && !e.isUserError) await store.warn("broker.alpaca", "warn", `Order status check failed: ${e.message}`, { status: e.status });
      return o;
    }
    if (!a) return o;
    await recordFills(userId, o, a, Number(o.filled_qty) || 0, o.filled_avg_price);
    const patch: Partial<StoredOrder> = { status: a.status, broker_order_id: a.id, filled_qty: num(a.filled_qty) ?? 0, filled_avg_price: num(a.filled_avg_price) };
    if (patch.status !== o.status) await store.audit({ user_id: userId, mode, provider, event: a.status === "canceled" ? "cancelled" : "status", client_order_id: o.client_order_id, broker_order_id: a.id, detail: { from: o.status, to: a.status } });
    return (await store.updateOrder(o.id, patch)) ?? { ...o, ...patch };
  }

  async function fills(userId: string): Promise<TradeFill[]> {
    const rows = await store.listAudit(userId, ["fill"], 2000);
    return rows
      .map((r) => {
        const d = (r.detail ?? {}) as { symbol?: string; side?: string; qty?: number; price?: number };
        return { at: r.at, clientOrderId: r.client_order_id ?? "", symbol: String(d.symbol ?? ""), side: d.side === "sell" ? "sell" : "buy", qty: Number(d.qty) || 0, price: Number(d.price) || 0 } as TradeFill;
      })
      .filter((f) => f.symbol && f.qty > 0 && f.price > 0)
      .sort((x, y) => (x.at < y.at ? -1 : 1));
  }

  // ------------------------------------------------------------ risk context

  async function riskContext(userId: string, symbol: string, assetClass: "us_equity" | "crypto"): Promise<RiskContext> {
    const g = live();
    const [f, open] = await Promise.all([fills(userId), store.listOrders(userId, { openOnly: true })]);
    const bk = book(f);
    const pendingSellQty = open.filter((o) => o.symbol === symbol && o.side === "sell").reduce((s, o) => s + (Number(o.qty) || 0) - (Number(o.filled_qty) || 0), 0);
    const lastPrice = await g.lastPrice(symbol, assetClass);
    if (shared) {
      const cash = DEMO_START_CASH + bk.cashDelta;
      const pendingBuy = open.filter((o) => o.side === "buy").reduce((s, o) => s + (o.notional ?? (Number(o.qty) || 0) * (o.limit_price ?? o.stop_price ?? lastPrice ?? 0)), 0);
      let mv = 0;
      for (const [, p] of bk.positions) mv += p.qty * p.avgCost;
      return { mode: decision.mode, lastPrice, heldQty: bk.positions.get(symbol)?.qty ?? 0, pendingSellQty, buyingPower: Math.max(0, cash - pendingBuy), equity: cash + mv, dayTrades: countDayTrades(f, now()), limits };
    }
    const acct = await g.account(await accountId(userId)).catch(() => null);
    const held = await g.positions(await accountId(userId)).then((ps) => num(ps.find((p) => p.symbol === symbol.replace("/", ""))?.qty ?? ps.find((p) => p.symbol === symbol)?.qty) ?? 0).catch(() => bk.positions.get(symbol)?.qty ?? 0);
    return { mode: decision.mode, lastPrice, heldQty: held, pendingSellQty, buyingPower: num(acct?.buying_power), equity: num(acct?.equity), dayTrades: acct?.daytrade_count ?? countDayTrades(f, now()), limits };
  }

  // ------------------------------------------------------------ the API

  return {
    async status(userId: string | null): Promise<TradingStatus> {
      let account: TradingStatus["account"] = undefined;
      if (userId && decision.mode !== "demo") {
        const a = await store.account(userId).catch(() => null);
        account = a ? { status: a.status, funded: !!a.funded_at } : null;
      }
      return { mode: decision.mode, engine: decision.engine, badge: decision.badge, notes: decision.notes, account, limits };
    },

    async preview(userId: string, req: OrderRequest): Promise<Preview> {
      const n = normalise(req);
      const ctx = await riskContext(userId, n.symbol, n.assetClass);
      const r = checkOrder(n, ctx);
      return { ok: r.ok, badge: decision.badge, mode: decision.mode, price: ctx.lastPrice, priceSource: gateway ? "Alpaca latest trade" : "none", estQty: r.estQty, estCost: r.estCost === null ? null : round(r.estCost), estFees: r.estFees, errors: r.errors, warnings: r.warnings };
    },

    async place(userId: string, req: OrderRequest, idemKey: string | null): Promise<{ order: TradeOrder; duplicate: boolean }> {
      if (!idemKey || !IDEM_RE.test(idemKey)) throw new TradeError(400, "Send an Idempotency-Key header (8 to 48 letters, digits, - or _)");
      const g = live();
      const existing = await store.findOrder(userId, idemKey);
      if (existing) {
        await store.audit({ user_id: userId, mode, provider, event: "duplicate", client_order_id: idemKey });
        return { order: toTradeOrder(await sync(userId, existing)), duplicate: true };
      }
      await rateLimit(userId);
      const n = normalise(req);
      const ctx = await riskContext(userId, n.symbol, n.assetClass);
      const risk = checkOrder(n, ctx);
      if (!risk.ok) {
        await store.audit({ user_id: userId, mode, provider, event: "refused", client_order_id: idemKey, detail: { symbol: n.symbol, side: n.side, type: n.type, errors: risk.errors.slice(0, 5) } });
        throw new TradeError(422, risk.errors[0], risk.errors);
      }
      const acct = await accountId(userId);
      let row: StoredOrder;
      try {
        row = await store.insertOrder({
          user_id: userId, mode, provider, asset_class: n.assetClass, client_order_id: idemKey, symbol: n.symbol, side: n.side, type: n.type,
          order_class: n.orderClass ?? "simple", qty: n.qty ?? null, notional: n.notional ?? null, limit_price: n.limitPrice ?? null, stop_price: n.stopPrice ?? null,
          take_profit: n.takeProfit ?? null, stop_loss: n.stopLoss ?? null, time_in_force: n.timeInForce,
        });
      } catch (e) {
        if (e instanceof DuplicateError) {
          const again = await store.findOrder(userId, idemKey);
          if (again) return { order: toTradeOrder(again), duplicate: true };
        }
        throw e;
      }
      await store.audit({ user_id: userId, mode, provider, event: "requested", client_order_id: idemKey, detail: { symbol: n.symbol, side: n.side, type: n.type, qty: n.qty ?? null, notional: n.notional ?? null, limit: n.limitPrice ?? null, stop: n.stopPrice ?? null, tif: n.timeInForce, class: n.orderClass } });
      let a: AlpacaOrder;
      try {
        a = await g.placeOrder(acct, n, idemKey);
      } catch (e) {
        // A timeout may still have reached the broker. Ask by our key before calling it lost.
        const found = e instanceof BrokerError && e.code === "network" ? await g.orderByClientId(acct, idemKey).catch(() => null) : null;
        if (!found) {
          const be = e instanceof BrokerError ? e : null;
          await store.updateOrder(row.id, { status: be?.isUserError ? "rejected" : "error", reason: (be?.message ?? "Broker error").slice(0, 300) });
          return brokerFailed(userId, "Place order", e, idemKey);
        }
        a = found;
      }
      await store.audit({ user_id: userId, mode, provider, event: "sent", client_order_id: idemKey, broker_order_id: a.id, detail: { status: a.status } });
      await recordFills(userId, row, a, 0, null);
      const updated = await store.updateOrder(row.id, { status: a.status, broker_order_id: a.id, filled_qty: num(a.filled_qty) ?? 0, filled_avg_price: num(a.filled_avg_price) });
      return { order: toTradeOrder(updated ?? row), duplicate: false };
    },

    async cancel(userId: string, id: string, idemKey: string | null): Promise<{ ok: true; duplicate: boolean }> {
      if (!idemKey || !IDEM_RE.test(idemKey)) throw new TradeError(400, "Send an Idempotency-Key header");
      const g = live();
      const o = await store.getOrder(userId, id);
      if (!o) throw new TradeError(404, "No such order");
      if (!OPEN_STATUSES.has(o.status)) throw new TradeError(409, `This order is ${o.status.replace(/_/g, " ")} and cannot be cancelled`);
      await rateLimit(userId);
      const first = await store.audit({ user_id: userId, mode, provider, event: "cancel_requested", client_order_id: o.client_order_id, broker_order_id: o.broker_order_id, idem_key: idemKey });
      if (!first) return { ok: true, duplicate: true };
      if (!o.broker_order_id) throw new TradeError(409, "This order has not reached the broker yet");
      try {
        await g.cancelOrder(await accountId(userId), o.broker_order_id);
      } catch (e) {
        return brokerFailed(userId, "Cancel order", e, o.client_order_id);
      }
      await store.updateOrder(o.id, { status: "pending_cancel" });
      return { ok: true, duplicate: false };
    },

    async replace(userId: string, id: string, patch: OrderPatch, idemKey: string | null): Promise<{ order: TradeOrder; duplicate: boolean }> {
      if (!idemKey || !IDEM_RE.test(idemKey)) throw new TradeError(400, "Send an Idempotency-Key header (8 to 48 letters, digits, - or _)");
      const g = live();
      const prior = await store.findOrder(userId, idemKey);
      if (prior) return { order: toTradeOrder(prior), duplicate: true };
      const o = await store.getOrder(userId, id);
      if (!o) throw new TradeError(404, "No such order");
      if (!OPEN_STATUSES.has(o.status) || !o.broker_order_id) throw new TradeError(409, "Only open orders can be changed");
      if (o.order_class === "bracket") throw new TradeError(409, "Cancel a bracket and place it again to change it");
      await rateLimit(userId);
      const merged: OrderRequest = {
        symbol: o.symbol, side: o.side, type: o.type, timeInForce: (patch.timeInForce as OrderRequest["timeInForce"]) ?? o.time_in_force,
        qty: patch.qty ?? o.qty ?? undefined, notional: patch.qty === undefined ? o.notional ?? undefined : undefined,
        limitPrice: patch.limitPrice ?? o.limit_price ?? undefined, stopPrice: patch.stopPrice ?? o.stop_price ?? undefined,
      };
      const ctx = await riskContext(userId, o.symbol, o.asset_class);
      if (o.side === "sell") ctx.pendingSellQty = Math.max(0, ctx.pendingSellQty - ((Number(o.qty) || 0) - (Number(o.filled_qty) || 0)));
      const risk = checkOrder(normalise(merged), ctx);
      if (!risk.ok) {
        await store.audit({ user_id: userId, mode, provider, event: "refused", client_order_id: o.client_order_id, detail: { replace: true, errors: risk.errors.slice(0, 5) } });
        throw new TradeError(422, risk.errors[0], risk.errors);
      }
      const first = await store.audit({ user_id: userId, mode, provider, event: "replace_requested", client_order_id: o.client_order_id, broker_order_id: o.broker_order_id, idem_key: idemKey, detail: { ...patch } });
      if (!first) {
        const again = await store.findOrder(userId, idemKey);
        if (again) return { order: toTradeOrder(again), duplicate: true };
        throw new TradeError(409, "This change is already being sent");
      }
      let a: AlpacaOrder;
      try {
        a = await g.replaceOrder(await accountId(userId), o.broker_order_id, patch, idemKey);
      } catch (e) {
        return brokerFailed(userId, "Change order", e, o.client_order_id);
      }
      await store.updateOrder(o.id, { status: "replaced" });
      const n = normalise(merged);
      const row = await store.insertOrder({
        user_id: userId, mode, provider, asset_class: o.asset_class, client_order_id: idemKey, symbol: o.symbol, side: o.side, type: o.type, order_class: "simple",
        qty: n.qty ?? null, notional: n.notional ?? null, limit_price: n.limitPrice ?? null, stop_price: n.stopPrice ?? null, take_profit: null, stop_loss: null, time_in_force: n.timeInForce, status: a.status,
      });
      await store.audit({ user_id: userId, mode, provider, event: "replaced", client_order_id: idemKey, broker_order_id: a.id, detail: { replaces: o.client_order_id } });
      const updated = await store.updateOrder(row.id, { broker_order_id: a.id });
      return { order: toTradeOrder(updated ?? row), duplicate: false };
    },

    async orders(userId: string, openOnly: boolean): Promise<TradeOrder[]> {
      const rows = await store.listOrders(userId, { openOnly, limit: 200 });
      const synced = await Promise.all(rows.map((o) => (OPEN_STATUSES.has(o.status) ? sync(userId, o) : o)));
      return synced.filter((o) => !openOnly || OPEN_STATUSES.has(o.status)).map(toTradeOrder);
    },

    fills,

    async positions(userId: string): Promise<{ positions: TradePosition[]; balances: TradeBalances }> {
      const g = live();
      const f = await fills(userId);
      const bk = book(f);
      if (shared) {
        const out: TradePosition[] = [];
        let mv = 0;
        let unreal = 0;
        let realized = 0;
        for (const [symbol, p] of bk.positions) {
          realized += p.realized;
          if (p.qty === 0) continue;
          const cls = symbol.includes("/") ? "crypto" : "us_equity";
          const last = await g.lastPrice(symbol, cls);
          const value = last !== null ? p.qty * last : null;
          const u = last !== null ? p.qty * (last - p.avgCost) : null;
          if (value !== null) mv += value;
          if (u !== null) unreal += u;
          out.push({ symbol, assetClass: cls, qty: round(p.qty, 9), avgCost: round(p.avgCost, 4), lastPrice: last, marketValue: value === null ? null : round(value), unrealizedPl: u === null ? null : round(u), realizedPl: round(p.realized) });
        }
        const cash = DEMO_START_CASH + bk.cashDelta;
        return { positions: out, balances: { mode: decision.mode, badge: decision.badge, cash: round(cash), buyingPower: round(Math.max(0, cash)), equity: round(cash + mv), totalPl: round(realized + unreal) } };
      }
      const acctId = await accountId(userId);
      let ps, acct;
      try {
        [ps, acct] = await Promise.all([g.positions(acctId), g.account(acctId)]);
      } catch (e) {
        return brokerFailed(userId, "Read positions", e);
      }
      const positions = ps.map((p) => {
        const qty = num(p.qty) ?? 0;
        const avg = num(p.avg_entry_price) ?? 0;
        const last = num(p.current_price);
        const sym = p.asset_class === "crypto" && !p.symbol.includes("/") && p.symbol.endsWith("USD") ? `${p.symbol.slice(0, -3)}/USD` : p.symbol;
        return { symbol: sym, assetClass: p.asset_class === "crypto" ? "crypto" : "us_equity", qty, avgCost: avg, lastPrice: last, marketValue: last === null ? null : round(qty * last), unrealizedPl: last === null ? null : round(qty * (last - avg)), realizedPl: round(bk.positions.get(sym)?.realized ?? 0) } as TradePosition;
      });
      const totalReal = [...bk.positions.values()].reduce((s, p) => s + p.realized, 0);
      const totalUnreal = positions.reduce((s, p) => s + (p.unrealizedPl ?? 0), 0);
      return { positions, balances: { mode: decision.mode, badge: decision.badge, cash: num(acct.cash), buyingPower: num(acct.buying_power), equity: num(acct.equity), totalPl: round(totalReal + totalUnreal) } };
    },

    async exportCsv(userId: string): Promise<string> {
      const esc = (v: unknown) => {
        const s = v === null || v === undefined ? "" : String(v);
        // A leading = + - @ would run as a formula in a spreadsheet.
        const safe = /^[=+\-@]/.test(s) && !/^-?\d/.test(s) ? `'${s}` : s;
        return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
      };
      const rows: unknown[][] = [["record", "mode", "time", "symbol", "side", "type", "qty", "notional", "limit", "stop", "tif", "status", "filled_qty", "price", "client_order_id"]];
      for (const o of await store.listOrders(userId, { limit: 500 })) rows.push(["order", o.mode, o.created_at, o.symbol, o.side, o.type, o.qty, o.notional, o.limit_price, o.stop_price, o.time_in_force, o.status, o.filled_qty, o.filled_avg_price, o.client_order_id]);
      for (const f of await fills(userId)) rows.push(["fill", decision.mode, f.at, f.symbol, f.side, "", f.qty, "", "", "", "", "filled", f.qty, f.price, f.clientOrderId]);
      return rows.map((r) => r.map(esc).join(",")).join("\n") + "\n";
    },

    async openSandboxAccount(userId: string, ip: string, agree: boolean): Promise<{ status: string; funded: boolean }> {
      if (decision.mode !== "sandbox") throw new TradeError(409, "Sandbox accounts are off");
      if (!agree) throw new TradeError(400, "Accept the sandbox account agreement first");
      const g = live();
      const have = await store.account(userId);
      if (have) return { status: have.status, funded: !!have.funded_at };
      if (!g.createAccount) throw new TradeError(409, "Sandbox accounts are off");
      let made;
      try {
        made = await g.createAccount(sandboxAccountBody(userId, ip || "127.0.0.1", now()));
      } catch (e) {
        return brokerFailed(userId, "Open sandbox account", e);
      }
      await store.upsertAccount({ user_id: userId, provider: "alpaca_broker", mode: "sandbox", external_account_id: made.id, status: String(made.status ?? "SUBMITTED").slice(0, 40) });
      await store.recordOnboarding(userId, SANDBOX_AGREEMENT_VERSION);
      await store.audit({ user_id: userId, mode, provider, event: "onboarding", detail: { status: made.status } });
      return { status: made.status, funded: false };
    },

    async fundSandbox(userId: string, amount: number): Promise<{ ok: true }> {
      if (decision.mode !== "sandbox") throw new TradeError(409, "Sandbox funding is off");
      if (!Number.isFinite(amount) || amount < 1 || amount > MAX_SANDBOX_FUNDING) throw new TradeError(400, `Pick an amount from $1 to $${MAX_SANDBOX_FUNDING.toLocaleString("en-US")}`);
      const g = live();
      const acct = await store.account(userId);
      if (!acct) throw new TradeError(409, "Open a sandbox account first");
      if (!g.createTransfer || !g.createAchRelationship || !g.listAchRelationships) throw new TradeError(409, "Sandbox funding is off");
      try {
        const rels = await g.listAchRelationships(acct.external_account_id);
        const rel = rels.find((r) => r.status !== "CANCELED") ?? (await g.createAchRelationship(acct.external_account_id, SANDBOX_ACH));
        await g.createTransfer(acct.external_account_id, { transfer_type: "ach", relationship_id: rel.id, amount: amount.toFixed(2), direction: "INCOMING" });
      } catch (e) {
        return brokerFailed(userId, "Add sandbox funds", e);
      }
      await store.upsertAccount({ ...acct, funded_at: now().toISOString() });
      await store.audit({ user_id: userId, mode, provider, event: "funded", detail: { amount: round(amount) } });
      return { ok: true };
    },
  };
}

export type TradingService = ReturnType<typeof createTradingService>;
