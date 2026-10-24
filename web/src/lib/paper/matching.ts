// The demo account's matching engine (DEC-0033). A pure, deterministic function of the
// orders, the cash and holdings, and the delayed daily bars: the same inputs always give
// the same fills. It runs in the browser; this is a practice account, not an exchange,
// and no real money or real order is ever involved.
//
// The rules, in plain words:
//   - Long only. You can buy, and sell up to what you hold. No short selling, no margin,
//     no borrowing: a buy needs the cash, a sell needs the holding.
//   - A market order fills at once at the latest delayed close, moved against you by the
//     account's slippage.
//   - Every other order waits and is checked against each new daily bar dated after the
//     day it was placed:
//       limit buy    fills if low <= limit, at min(open, limit)
//       limit sell   fills if high >= limit, at max(open, limit)
//       stop buy     triggers if high >= stop, fills at max(open, stop) plus slippage
//       stop sell    triggers if low <= stop, fills at min(open, stop) minus slippage
//       stop-limit   becomes a limit when its stop triggers; on that bar it fills only if
//                    the trigger price is within the limit, otherwise it rests as a limit
//       trailing     a stop that follows the best close since it was placed, by a percent
//   - A bracket is an entry plus two sell children, a take-profit limit and a stop-loss
//     stop. The children wait until the entry fills, then one cancels the other.
//   - A fee is charged on every fill: fee_bps of the notional, at least fee_min.
//
// Daily bars here are built from closes (lib/bars.ts): a bar opens at the previous close.
// So a "gap" is the move from one close to the next, and a stop that is gapped through
// fills at the open, which is worse than the stop.
import type { Bar } from "../indicators";

export type Side = "buy" | "sell";
export type OrderType = "market" | "limit" | "stop" | "stop_limit" | "trailing_stop";
export type OrderStatus = "held" | "pending" | "filled" | "cancelled" | "rejected";
export type OrderRole = "entry" | "take_profit" | "stop_loss";

export interface Costs {
  /** Fee in basis points of the notional (1 bp = 0.01%). */
  fee_bps: number;
  /** Smallest fee per filled order, in dollars. */
  fee_min: number;
  /** Slippage in basis points, applied against you on market and stop fills. */
  slippage_bps: number;
}

export interface PaperOrder {
  id: string;
  symbol: string;
  side: Side;
  type: OrderType;
  qty: number;
  limit_price: number | null;
  stop_price: number | null;
  /** Trailing distance in percent, for trailing stops. */
  trail_pct: number | null;
  status: OrderStatus;
  /** When it was placed (ISO); orders are processed in this order. */
  placed_at: string;
  /** The date of the latest bar when it was placed or activated; only later bars count. */
  placed_on: string;
  parent_id: string | null;
  oco_group: string | null;
  role: OrderRole | null;
  /** A stop-limit whose stop has triggered is now a plain limit. */
  triggered: boolean;
  /** Trailing stops: the best close since placement. */
  trail_ref: number | null;
  /** The last bar date this order was checked against. */
  checked_through: string | null;
  fill_price: number | null;
  filled_on: string | null;
  reason: string | null;
}

export interface PaperFill {
  order_id: string;
  symbol: string;
  side: Side;
  qty: number;
  price: number;
  fee: number;
  bar_date: string;
  /** For sells: the profit or loss of the part closed, after both fees. */
  realized_pnl: number | null;
}

export interface Position { symbol: string; qty: number; avg_cost: number; realized: number }
export interface Book { cash: number; positions: Record<string, Position> }

export const EPS = 1e-9;
export const DEFAULT_COSTS: Costs = { fee_bps: 1, fee_min: 1, slippage_bps: 5 };

const ACTIVE: OrderStatus[] = ["held", "pending"];
export const isActive = (o: Pick<PaperOrder, "status">) => ACTIVE.includes(o.status);

// ---------------------------------------------------------------- costs

/** The fee on a fill of this notional: fee_bps of it, at least fee_min. */
export function feeFor(notional: number, c: Costs): number {
  if (!(notional > 0)) return 0;
  return Math.max(c.fee_min, (Math.abs(notional) * c.fee_bps) / 10_000);
}

/** A price moved against the trader by `bps`: higher for a buy, lower for a sell. */
export function slipped(price: number, side: Side, bps: number): number {
  return side === "buy" ? price * (1 + bps / 10_000) : price * (1 - bps / 10_000);
}

// ---------------------------------------------------------------- the book

export function emptyBook(cash: number): Book { return { cash, positions: {} }; }

export function heldQty(book: Book, symbol: string): number { return book.positions[symbol]?.qty ?? 0; }

/** The book after one fill, or an error saying why the fill cannot happen. Buy fees go
 *  into the cost basis, so a sell's realized P&L is net of both fees. With `strict` off
 *  (replaying fills that already happened) nothing is refused. */
export function applyFill(book: Book, f: Omit<PaperFill, "realized_pnl">, strict = true): { book: Book; realized: number | null } | { error: string } {
  const notional = f.qty * f.price;
  const pos = book.positions[f.symbol];
  if (f.side === "buy") {
    const cost = notional + f.fee;
    if (strict && cost > book.cash + EPS) return { error: "Not enough cash" };
    const qty = (pos?.qty ?? 0) + f.qty;
    const avg = ((pos?.qty ?? 0) * (pos?.avg_cost ?? 0) + cost) / qty;
    return { book: { cash: book.cash - cost, positions: { ...book.positions, [f.symbol]: { symbol: f.symbol, qty, avg_cost: avg, realized: pos?.realized ?? 0 } } }, realized: null };
  }
  const held = pos?.qty ?? 0;
  if (strict && f.qty > held + EPS) return { error: held > 0 ? "Not enough held to sell (no short selling)" : "Nothing held to sell (no short selling)" };
  const realized = f.qty * (f.price - (pos?.avg_cost ?? 0)) - f.fee;
  const left = held - f.qty;
  const positions = { ...book.positions };
  if (left <= EPS) delete positions[f.symbol];
  else positions[f.symbol] = { ...pos!, qty: left, realized: (pos?.realized ?? 0) + realized };
  return { book: { cash: book.cash + notional - f.fee, positions }, realized };
}

/** Rebuild cash and holdings from the fills, in the order they happened. The fills are
 *  the record; the stored cash and positions are a copy of this. */
export function bookFromFills(startingCash: number, fills: PaperFill[]): Book {
  let book = emptyBook(startingCash);
  for (const f of fills) {
    const r = applyFill(book, f, false);
    if ("book" in r) book = r.book;
  }
  return book;
}

// ---------------------------------------------------------------- placing orders

export interface OrderInput {
  symbol: string;
  side: Side;
  type: OrderType;
  qty: number;
  limit_price?: number | null;
  stop_price?: number | null;
  trail_pct?: number | null;
}

export interface BracketInput {
  symbol: string;
  qty: number;
  /** How the entry is placed: at market, or as a limit or stop buy. */
  entry: "market" | "limit" | "stop";
  entry_price?: number | null;
  take_profit: number;
  stop_loss: number;
}

export interface Placed { orders: PaperOrder[]; fills: PaperFill[]; book: Book }
export interface Context { bar: Bar; costs: Costs; now: string; newId: () => string }

const pos = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;

/** What a fill would roughly cost, for the ticket: the price we expect, the notional, the
 *  fee and the total cash out (buy) or in (sell). Limit-type orders assume their limit. */
export function estimate(input: OrderInput, refPrice: number, c: Costs): { price: number; notional: number; fee: number; total: number } {
  let price = refPrice;
  if (input.type === "market") price = slipped(refPrice, input.side, c.slippage_bps);
  else if (input.type === "limit" || input.type === "stop_limit") price = input.limit_price ?? refPrice;
  else if (input.type === "stop") price = slipped(input.stop_price ?? refPrice, input.side, c.slippage_bps);
  else if (input.type === "trailing_stop") {
    const t = (input.trail_pct ?? 0) / 100;
    price = slipped(input.side === "sell" ? refPrice * (1 - t) : refPrice * (1 + t), input.side, c.slippage_bps);
  }
  const notional = (input.qty || 0) * price;
  const fee = feeFor(notional, c);
  return { price, notional, fee, total: input.side === "buy" ? notional + fee : notional - fee };
}

/** Cash already set aside for open buy orders, at their estimated cost. */
export function reservedCash(orders: PaperOrder[], c: Costs, refPrice: (symbol: string) => number | null): number {
  let sum = 0;
  for (const o of orders) {
    if (o.side !== "buy" || o.status !== "pending") continue;
    const ref = refPrice(o.symbol);
    if (ref == null) continue;
    sum += estimate(o, ref, c).total;
  }
  return sum;
}

/** Quantity already promised to open sell orders. Orders in one OCO group count once
 *  (only one of them can fill), and children waiting on an unfilled entry count nothing. */
export function committedQty(orders: PaperOrder[], symbol: string): number {
  const groups = new Map<string, number>();
  let sum = 0;
  for (const o of orders) {
    if (o.side !== "sell" || o.symbol !== symbol || o.status !== "pending") continue;
    if (o.oco_group) groups.set(o.oco_group, Math.max(groups.get(o.oco_group) ?? 0, o.qty));
    else sum += o.qty;
  }
  for (const v of groups.values()) sum += v;
  return sum;
}

/** Why an order cannot be placed, or null if it can. */
export function checkOrder(input: OrderInput, book: Book, orders: PaperOrder[], c: Costs, refPrice: number, ref: (s: string) => number | null): string | null {
  if (!input.symbol) return "Pick an instrument";
  if (!pos(input.qty)) return "Quantity must be more than zero";
  if (!pos(refPrice)) return "No price for this instrument yet";
  if ((input.type === "limit" || input.type === "stop_limit") && !pos(input.limit_price)) return "Enter a limit price above zero";
  if ((input.type === "stop" || input.type === "stop_limit") && !pos(input.stop_price)) return "Enter a stop price above zero";
  if (input.type === "trailing_stop" && !(pos(input.trail_pct) && input.trail_pct! < 100)) return "Enter a trailing percent between 0 and 100";
  if (input.side === "sell") {
    const free = heldQty(book, input.symbol) - committedQty(orders, input.symbol);
    if (input.qty > free + EPS) return free > EPS ? `You can sell at most ${round(free)} (the rest is held or already in open sell orders). No short selling.` : "Nothing free to sell. This account is long only: no short selling.";
    return null;
  }
  const need = estimate(input, refPrice, c).total;
  const free = book.cash - reservedCash(orders, c, ref);
  if (need > free + EPS) return `Not enough cash: this needs about ${money(need)} and ${money(Math.max(0, free))} is free.`;
  return null;
}

/** Why a bracket cannot be placed, or null. */
export function checkBracket(b: BracketInput, book: Book, orders: PaperOrder[], c: Costs, refPrice: number, ref: (s: string) => number | null): string | null {
  const entryPx = b.entry === "market" ? refPrice : b.entry_price ?? NaN;
  if (b.entry !== "market" && !pos(b.entry_price)) return "Enter the entry price";
  if (!pos(b.take_profit) || !pos(b.stop_loss)) return "Enter both a take-profit and a stop-loss price";
  if (!(b.take_profit > entryPx)) return "The take-profit must be above the entry price";
  if (!(b.stop_loss < entryPx)) return "The stop-loss must be below the entry price";
  return checkOrder(entryInput(b), book, orders, c, refPrice, ref);
}

function entryInput(b: BracketInput): OrderInput {
  return { symbol: b.symbol, side: "buy", type: b.entry, qty: b.qty, limit_price: b.entry === "limit" ? b.entry_price : null, stop_price: b.entry === "stop" ? b.entry_price : null };
}

function blank(input: OrderInput, ctx: Context): PaperOrder {
  return {
    id: ctx.newId(), symbol: input.symbol, side: input.side, type: input.type, qty: input.qty,
    limit_price: input.type === "limit" || input.type === "stop_limit" ? input.limit_price ?? null : null,
    stop_price: input.type === "stop" || input.type === "stop_limit" ? input.stop_price ?? null : null,
    trail_pct: input.type === "trailing_stop" ? input.trail_pct ?? null : null,
    status: "pending", placed_at: ctx.now, placed_on: ctx.bar.time, parent_id: null, oco_group: null, role: null,
    triggered: false, trail_ref: input.type === "trailing_stop" ? ctx.bar.close : null, checked_through: null,
    fill_price: null, filled_on: null, reason: null,
  };
}

/** Place one order. A market order fills now at the latest close plus slippage; others
 *  wait for later bars. A rule breach comes back as a rejected order, never a throw. */
export function placeOrder(input: OrderInput, book: Book, orders: PaperOrder[], ctx: Context): Placed {
  const ref = (s: string) => (s === input.symbol ? ctx.bar.close : null);
  const o = blank(input, ctx);
  const why = checkOrder(input, book, orders, ctx.costs, ctx.bar.close, ref);
  if (why) return { orders: [{ ...o, status: "rejected", reason: why }], fills: [], book };
  if (input.type !== "market") return { orders: [o], fills: [], book };
  const r = fillOrder(o, slipped(ctx.bar.close, o.side, ctx.costs.slippage_bps), ctx.bar.time, book, ctx.costs);
  return { orders: [r.order], fills: r.fill ? [r.fill] : [], book: r.book };
}

/** Place a bracket: the entry buy and its two sell children, which wait for the entry. */
export function placeBracket(b: BracketInput, book: Book, orders: PaperOrder[], ctx: Context): Placed {
  const ref = (s: string) => (s === b.symbol ? ctx.bar.close : null);
  const entry: PaperOrder = { ...blank(entryInput(b), ctx), role: "entry" };
  const group = ctx.newId();
  const child = (type: "limit" | "stop", price: number, role: OrderRole): PaperOrder => ({
    ...blank({ symbol: b.symbol, side: "sell", type, qty: b.qty, limit_price: type === "limit" ? price : null, stop_price: type === "stop" ? price : null }, ctx),
    status: "held", parent_id: entry.id, oco_group: group, role,
  });
  const tp = child("limit", b.take_profit, "take_profit");
  const sl = child("stop", b.stop_loss, "stop_loss");
  const why = checkBracket(b, book, orders, ctx.costs, ctx.bar.close, ref);
  if (why) {
    const cancelled = { status: "cancelled" as const, reason: "The bracket entry was rejected" };
    return { orders: [{ ...entry, status: "rejected", reason: why }, { ...tp, ...cancelled }, { ...sl, ...cancelled }], fills: [], book };
  }
  if (b.entry !== "market") return { orders: [entry, tp, sl], fills: [], book };
  const r = fillOrder(entry, slipped(ctx.bar.close, "buy", ctx.costs.slippage_bps), ctx.bar.time, book, ctx.costs);
  const kids = settleFamily(r.order, [tp, sl], ctx.bar);
  return { orders: [r.order, ...kids], fills: r.fill ? [r.fill] : [], book: r.book };
}

/** Cancel an open order. Cancelling a bracket entry cancels its waiting children too. */
export function cancelOrder(orders: PaperOrder[], id: string): PaperOrder[] {
  const target = orders.find((o) => o.id === id);
  if (!target || !isActive(target)) return orders;
  return orders.map((o) => {
    if (o.id === id) return { ...o, status: "cancelled", reason: "Cancelled by you" };
    if (o.parent_id === id && o.status === "held") return { ...o, status: "cancelled", reason: "Its bracket entry was cancelled" };
    return o;
  });
}

// ---------------------------------------------------------------- filling

function fillOrder(o: PaperOrder, price: number, date: string, book: Book, c: Costs): { order: PaperOrder; fill: PaperFill | null; book: Book } {
  const fee = feeFor(o.qty * price, c);
  const r = applyFill(book, { order_id: o.id, symbol: o.symbol, side: o.side, qty: o.qty, price, fee, bar_date: date });
  if ("error" in r) return { order: { ...o, status: "rejected", reason: `${r.error} when it would have filled on ${date}`, checked_through: date }, fill: null, book };
  return {
    order: { ...o, status: "filled", fill_price: price, filled_on: date, checked_through: date },
    fill: { order_id: o.id, symbol: o.symbol, side: o.side, qty: o.qty, price, fee, bar_date: date, realized_pnl: r.realized },
    book: r.book,
  };
}

/** After an entry fills, its children go live from the next bar; if it did not fill, they go. */
function settleFamily(parent: PaperOrder, kids: PaperOrder[], bar: Bar): PaperOrder[] {
  return kids.map((k) => {
    if (k.status !== "held") return k;
    if (parent.status === "filled") return { ...k, status: "pending", placed_on: parent.filled_on ?? bar.time, trail_ref: k.type === "trailing_stop" ? bar.close : k.trail_ref };
    return { ...k, status: "cancelled", reason: parent.status === "rejected" ? "The bracket entry was rejected" : "The bracket entry was cancelled" };
  });
}

/** What happens to one waiting order on one bar: the price it fills at (before fees), or
 *  null, plus any change to its state (a stop-limit triggering, a trailing stop moving). */
export function evaluate(o: PaperOrder, bar: Bar, c: Costs): { price: number | null; patch: Partial<PaperOrder> } {
  const buy = o.side === "buy";
  const slip = (p: number) => slipped(p, o.side, c.slippage_bps);
  switch (o.type) {
    case "market":
      return { price: slip(bar.open), patch: {} };
    case "limit": {
      const L = o.limit_price!;
      if (buy) return { price: bar.low <= L ? Math.min(bar.open, L) : null, patch: {} };
      return { price: bar.high >= L ? Math.max(bar.open, L) : null, patch: {} };
    }
    case "stop": {
      const S = o.stop_price!;
      if (buy) return { price: bar.high >= S ? slip(Math.max(bar.open, S)) : null, patch: {} };
      return { price: bar.low <= S ? slip(Math.min(bar.open, S)) : null, patch: {} };
    }
    case "stop_limit": {
      const S = o.stop_price!, L = o.limit_price!;
      if (o.triggered) {
        if (buy) return { price: bar.low <= L ? Math.min(bar.open, L) : null, patch: {} };
        return { price: bar.high >= L ? Math.max(bar.open, L) : null, patch: {} };
      }
      if (buy) {
        if (bar.high < S) return { price: null, patch: {} };
        const at = Math.max(bar.open, S);
        return { price: at <= L ? at : null, patch: { triggered: true } };
      }
      if (bar.low > S) return { price: null, patch: {} };
      const at = Math.min(bar.open, S);
      return { price: at >= L ? at : null, patch: { triggered: true } };
    }
    case "trailing_stop": {
      const t = (o.trail_pct ?? 0) / 100;
      const ref = o.trail_ref ?? bar.open;
      if (buy) {
        const S = ref * (1 + t);
        if (bar.high >= S) return { price: slip(Math.max(bar.open, S)), patch: {} };
        return { price: null, patch: { trail_ref: Math.min(ref, bar.close) } };
      }
      const S = ref * (1 - t);
      if (bar.low <= S) return { price: slip(Math.min(bar.open, S)), patch: {} };
      return { price: null, patch: { trail_ref: Math.max(ref, bar.close) } };
    }
  }
}

/** The current stop level of a trailing stop, for display. */
export function trailingStopLevel(o: Pick<PaperOrder, "side" | "trail_pct" | "trail_ref">): number | null {
  if (o.trail_ref == null || o.trail_pct == null) return null;
  return o.side === "sell" ? o.trail_ref * (1 - o.trail_pct / 100) : o.trail_ref * (1 + o.trail_pct / 100);
}

export interface Processed { orders: PaperOrder[]; fills: PaperFill[]; book: Book; changed: string[] }

const byPlacement = (a: PaperOrder, b: PaperOrder) => (a.placed_at < b.placed_at ? -1 : a.placed_at > b.placed_at ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/**
 * Check every waiting order against the bars that came after it, day by day across all
 * instruments, oldest first; on one day orders go in the order they were placed. Returns
 * the updated orders, the new fills, the new book and the ids of the orders that changed.
 */
export function processBars(orders: PaperOrder[], book: Book, bars: Record<string, Bar[]>, c: Costs): Processed {
  const state = new Map(orders.map((o) => [o.id, { ...o }]));
  const changed = new Set<string>();
  const fills: PaperFill[] = [];
  const live = () => [...state.values()].filter(isActive);
  const start = (o: PaperOrder) => o.checked_through && o.checked_through > o.placed_on ? o.checked_through : o.placed_on;

  const symbols = new Set(live().map((o) => o.symbol));
  const earliest = live().reduce((m, o) => (start(o) < m ? start(o) : m), "9999-12-31");
  const dates = new Set<string>();
  const index = new Map<string, Map<string, Bar>>();
  for (const s of symbols) {
    const m = new Map<string, Bar>();
    for (const b of bars[s] ?? []) if (b.time > earliest) { m.set(b.time, b); dates.add(b.time); }
    index.set(s, m);
  }

  for (const d of [...dates].sort()) {
    for (const o0 of live().sort(byPlacement)) {
      const o = state.get(o0.id)!;
      if (o.status !== "pending" || d <= start(o)) continue;
      const bar = index.get(o.symbol)?.get(d);
      if (!bar) continue;
      const { price, patch } = evaluate(o, bar, c);
      if (price == null) {
        state.set(o.id, { ...o, ...patch, checked_through: d });
        changed.add(o.id);
        continue;
      }
      const r = fillOrder({ ...o, ...patch }, price, d, book, c);
      book = r.book;
      state.set(o.id, r.order);
      changed.add(o.id);
      if (r.fill) fills.push(r.fill);
      // Children of a bracket entry go live (or go away); an OCO sibling is cancelled.
      for (const k of [...state.values()]) {
        if (k.parent_id === o.id && k.status === "held") {
          state.set(k.id, settleFamily(r.order, [k], bar)[0]);
          changed.add(k.id);
        } else if (o.oco_group && k.oco_group === o.oco_group && k.id !== o.id && isActive(k)) {
          state.set(k.id, { ...k, status: "cancelled", reason: r.order.status === "filled" ? "One-cancels-other: its pair filled" : "One-cancels-other: its pair was rejected" });
          changed.add(k.id);
        }
      }
    }
  }
  return { orders: orders.map((o) => state.get(o.id)!), fills, book, changed: [...changed] };
}

// ---------------------------------------------------------------- small helpers

function round(v: number): string { return String(Math.round(v * 1e6) / 1e6); }
function money(v: number): string { return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }

export const ORDER_TYPE_LABEL: Record<OrderType, string> = {
  market: "Market", limit: "Limit", stop: "Stop", stop_limit: "Stop-limit", trailing_stop: "Trailing stop",
};
