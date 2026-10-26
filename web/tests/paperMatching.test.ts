import { describe, expect, it } from "vitest";
import {
  applyFill, bookFromFills, cancelOrder, checkOrder, committedQty, emptyBook, estimate, evaluate, feeFor, placeBracket, placeOrder,
  processBars, slipped, trailingStopLevel, type Book, type Context, type Costs, type PaperOrder,
} from "../src/lib/paper/matching";
import type { Bar } from "../src/lib/indicators";

const NONE: Costs = { fee_bps: 0, fee_min: 0, slippage_bps: 0 };
const COSTS: Costs = { fee_bps: 10, fee_min: 1, slippage_bps: 20 };

const day = (i: number) => new Date(Date.UTC(2026, 0, 1) + i * 86400000).toISOString().slice(0, 10);
const bar = (i: number, open: number, high: number, low: number, close: number): Bar => ({ time: day(i), open, high, low, close });

function ctx(b: Bar, costs = NONE): Context {
  let n = 0;
  return { bar: b, costs, now: `2026-01-01T00:00:${String(Math.min(59, n)).padStart(2, "0")}Z`, newId: () => `id${++n}` };
}

let seq = 0;
function ctxSeq(b: Bar, costs = NONE): Context {
  return { bar: b, costs, now: `2026-01-01T00:${String(Math.floor(seq / 60)).padStart(2, "0")}:${String(seq % 60).padStart(2, "0")}Z`, newId: () => `o${++seq}` };
}

const START = bar(0, 100, 100, 100, 100);

function place(book: Book, orders: PaperOrder[], input: Parameters<typeof placeOrder>[0], b = START, costs = NONE) {
  const r = placeOrder(input, book, orders, ctxSeq(b, costs));
  return { book: r.book, orders: [...orders, ...r.orders], fills: r.fills, placed: r.orders };
}

describe("costs", () => {
  it("charges bps of notional with a minimum", () => {
    expect(feeFor(100_000, COSTS)).toBeCloseTo(100);
    expect(feeFor(500, COSTS)).toBe(1);
    expect(feeFor(0, COSTS)).toBe(0);
  });
  it("slips against the trader", () => {
    expect(slipped(100, "buy", 20)).toBeCloseTo(100.2);
    expect(slipped(100, "sell", 20)).toBeCloseTo(99.8);
  });
  it("estimates a market buy with slippage and fee", () => {
    const e = estimate({ symbol: "X", side: "buy", type: "market", qty: 10 }, 100, COSTS);
    expect(e.price).toBeCloseTo(100.2);
    expect(e.notional).toBeCloseTo(1002);
    expect(e.fee).toBeCloseTo(1.002);
    expect(e.total).toBeCloseTo(1003.002);
  });
  it("estimates a limit at its limit with no slippage", () => {
    const e = estimate({ symbol: "X", side: "sell", type: "limit", qty: 10, limit_price: 110 }, 100, COSTS);
    expect(e.price).toBe(110);
    expect(e.total).toBeCloseTo(1100 - 1.1);
  });
});

describe("the book", () => {
  it("puts buy fees into the cost basis and nets sell fees out of realized P&L", () => {
    let b = emptyBook(10_000);
    let r = applyFill(b, { order_id: "a", symbol: "X", side: "buy", qty: 10, price: 100, fee: 5, bar_date: day(0) });
    if (!("book" in r)) throw new Error("buy failed");
    b = r.book;
    expect(b.cash).toBeCloseTo(10_000 - 1005);
    expect(b.positions.X.avg_cost).toBeCloseTo(100.5);
    r = applyFill(b, { order_id: "b", symbol: "X", side: "sell", qty: 10, price: 110, fee: 5, bar_date: day(1) });
    if (!("book" in r)) throw new Error("sell failed");
    expect(r.realized).toBeCloseTo(10 * (110 - 100.5) - 5);
    expect(r.book.cash).toBeCloseTo(10_000 - 1005 + 1100 - 5);
    expect(r.book.positions.X).toBeUndefined();
  });
  it("refuses a buy without the cash and a sell without the holding", () => {
    expect(applyFill(emptyBook(100), { order_id: "a", symbol: "X", side: "buy", qty: 2, price: 100, fee: 0, bar_date: day(0) })).toEqual({ error: "Not enough cash" });
    expect("error" in applyFill(emptyBook(100), { order_id: "a", symbol: "X", side: "sell", qty: 1, price: 100, fee: 0, bar_date: day(0) })).toBe(true);
  });
  it("rebuilds the same book from fills", () => {
    const fills = [
      { order_id: "a", symbol: "X", side: "buy" as const, qty: 5, price: 10, fee: 1, bar_date: day(0), realized_pnl: null },
      { order_id: "b", symbol: "X", side: "sell" as const, qty: 2, price: 12, fee: 1, bar_date: day(1), realized_pnl: 2 * (12 - 10.2) - 1 },
    ];
    const b = bookFromFills(1000, fills);
    expect(b.cash).toBeCloseTo(1000 - 51 + 24 - 1);
    expect(b.positions.X.qty).toBe(3);
  });
});

describe("market orders", () => {
  it("fill now at the latest close plus slippage, with the fee", () => {
    const r = place(emptyBook(100_000), [], { symbol: "X", side: "buy", type: "market", qty: 10 }, START, COSTS);
    expect(r.placed[0].status).toBe("filled");
    expect(r.fills).toHaveLength(1);
    expect(r.fills[0].price).toBeCloseTo(100.2);
    expect(r.fills[0].fee).toBeCloseTo(1.002);
    expect(r.fills[0].bar_date).toBe(day(0));
    expect(r.book.cash).toBeCloseTo(100_000 - 1002 - 1.002);
  });
  it("sell fills below the close by the slippage", () => {
    const a = place(emptyBook(100_000), [], { symbol: "X", side: "buy", type: "market", qty: 10 });
    const b = place(a.book, a.orders, { symbol: "X", side: "sell", type: "market", qty: 4 }, bar(1, 100, 110, 100, 110), COSTS);
    expect(b.fills[0].price).toBeCloseTo(110 * 0.998);
    expect(b.book.positions.X.qty).toBe(6);
    expect(b.fills[0].realized_pnl).toBeCloseTo(4 * (109.78 - 100) - 1);
  });
  it("is rejected when cash is short", () => {
    const r = place(emptyBook(500), [], { symbol: "X", side: "buy", type: "market", qty: 10 });
    expect(r.placed[0].status).toBe("rejected");
    expect(r.placed[0].reason).toMatch(/Not enough cash/);
    expect(r.fills).toHaveLength(0);
    expect(r.book.cash).toBe(500);
  });
  it("is rejected when selling more than held (no shorting)", () => {
    const a = place(emptyBook(100_000), [], { symbol: "X", side: "buy", type: "market", qty: 3 });
    const b = place(a.book, a.orders, { symbol: "X", side: "sell", type: "market", qty: 5 });
    expect(b.placed[0].status).toBe("rejected");
    expect(b.placed[0].reason).toMatch(/short/);
    const c = place(emptyBook(100_000), [], { symbol: "Y", side: "sell", type: "market", qty: 1 });
    expect(c.placed[0].reason).toMatch(/short/);
  });
  it("rejects a zero or negative quantity and missing prices", () => {
    expect(place(emptyBook(1000), [], { symbol: "X", side: "buy", type: "market", qty: 0 }).placed[0].status).toBe("rejected");
    expect(place(emptyBook(1000), [], { symbol: "X", side: "buy", type: "limit", qty: 1 }).placed[0].reason).toMatch(/limit price/);
    expect(place(emptyBook(1000), [], { symbol: "X", side: "buy", type: "stop", qty: 1 }).placed[0].reason).toMatch(/stop price/);
    expect(place(emptyBook(1000), [], { symbol: "X", side: "sell", type: "trailing_stop", qty: 1, trail_pct: 0 }).placed[0].reason).toMatch(/trailing/);
  });
});

describe("limit orders", () => {
  it("a buy fills when the low reaches the limit, at the limit", () => {
    const a = place(emptyBook(10_000), [], { symbol: "X", side: "buy", type: "limit", qty: 10, limit_price: 95 });
    expect(a.placed[0].status).toBe("pending");
    const bars = { X: [START, bar(1, 100, 101, 97, 97), bar(2, 97, 97, 94, 94)] };
    const r = processBars(a.orders, a.book, bars, COSTS);
    expect(r.fills).toHaveLength(1);
    expect(r.fills[0].bar_date).toBe(day(2));
    expect(r.fills[0].price).toBe(95);
    expect(r.fills[0].fee).toBeCloseTo(1);
    expect(r.orders[0].status).toBe("filled");
  });
  it("a buy that gaps below the limit fills at the open, which is better", () => {
    const a = place(emptyBook(10_000), [], { symbol: "X", side: "buy", type: "limit", qty: 1, limit_price: 95 });
    const r = processBars(a.orders, a.book, { X: [START, bar(1, 90, 92, 89, 91)] }, NONE);
    expect(r.fills[0].price).toBe(90);
  });
  it("a sell fills at max(open, limit) once the high reaches it", () => {
    const a = place(emptyBook(10_000), [], { symbol: "X", side: "buy", type: "market", qty: 5 });
    const b = place(a.book, a.orders, { symbol: "X", side: "sell", type: "limit", qty: 5, limit_price: 105 });
    const r = processBars(b.orders, b.book, { X: [START, bar(1, 100, 104, 100, 104), bar(2, 104, 106, 104, 106)] }, NONE);
    expect(r.fills).toHaveLength(1);
    expect(r.fills[0].price).toBe(105);
    const g = processBars(b.orders, b.book, { X: [START, bar(1, 108, 108, 107, 107)] }, NONE);
    expect(g.fills[0].price).toBe(108);
  });
  it("ignores bars dated on or before the day it was placed", () => {
    const a = place(emptyBook(10_000), [], { symbol: "X", side: "buy", type: "limit", qty: 1, limit_price: 101 }, bar(5, 100, 100, 100, 100));
    const r = processBars(a.orders, a.book, { X: [bar(3, 90, 90, 90, 90), bar(5, 100, 100, 100, 100)] }, NONE);
    expect(r.fills).toHaveLength(0);
    expect(r.changed).toHaveLength(0);
  });
  it("does not check the same bar twice", () => {
    const a = place(emptyBook(10_000), [], { symbol: "X", side: "buy", type: "limit", qty: 1, limit_price: 90 });
    const bars = { X: [START, bar(1, 100, 100, 95, 95)] };
    const r1 = processBars(a.orders, a.book, bars, NONE);
    expect(r1.orders[0].checked_through).toBe(day(1));
    const r2 = processBars(r1.orders, r1.book, bars, NONE);
    expect(r2.changed).toHaveLength(0);
  });
  it("is rejected at fill time if the cash is gone by then", () => {
    const a = place(emptyBook(1000), [], { symbol: "X", side: "buy", type: "limit", qty: 9, limit_price: 100 });
    const spent: Book = { ...a.book, cash: 50 };
    const r = processBars(a.orders, spent, { X: [START, bar(1, 99, 99, 98, 98)] }, NONE);
    expect(r.fills).toHaveLength(0);
    expect(r.orders[0].status).toBe("rejected");
    expect(r.orders[0].reason).toMatch(/Not enough cash/);
  });
  it("reserves cash for open buys so a second order cannot spend it twice", () => {
    const a = place(emptyBook(1000), [], { symbol: "X", side: "buy", type: "limit", qty: 9, limit_price: 100 });
    const b = place(a.book, a.orders, { symbol: "X", side: "buy", type: "limit", qty: 2, limit_price: 100 });
    expect(b.placed[0].status).toBe("rejected");
    expect(b.placed[0].reason).toMatch(/cash/);
  });
});

describe("stop orders", () => {
  it("a sell stop triggers when the low touches it and fills at the stop minus slippage", () => {
    const a = place(emptyBook(10_000), [], { symbol: "X", side: "buy", type: "market", qty: 10 });
    const b = place(a.book, a.orders, { symbol: "X", side: "sell", type: "stop", qty: 10, stop_price: 95 });
    const r = processBars(b.orders, b.book, { X: [START, bar(1, 100, 100, 96, 96), bar(2, 96, 96, 94, 94)] }, COSTS);
    expect(r.fills).toHaveLength(1);
    expect(r.fills[0].bar_date).toBe(day(2));
    expect(r.fills[0].price).toBeCloseTo(95 * 0.998);
  });
  it("a gap through a sell stop fills at the open, worse than the stop", () => {
    const a = place(emptyBook(10_000), [], { symbol: "X", side: "buy", type: "market", qty: 10 });
    const b = place(a.book, a.orders, { symbol: "X", side: "sell", type: "stop", qty: 10, stop_price: 95 });
    const r = processBars(b.orders, b.book, { X: [START, bar(1, 80, 82, 79, 81)] }, COSTS);
    expect(r.fills[0].price).toBeCloseTo(80 * 0.998);
    expect(r.fills[0].realized_pnl!).toBeLessThan(-150);
  });
  it("a buy stop fills at max(open, stop) plus slippage", () => {
    const a = place(emptyBook(10_000), [], { symbol: "X", side: "buy", type: "stop", qty: 1, stop_price: 105 });
    const r = processBars(a.orders, a.book, { X: [START, bar(1, 100, 106, 100, 106)] }, COSTS);
    expect(r.fills[0].price).toBeCloseTo(105 * 1.002);
    const g = processBars(a.orders, a.book, { X: [START, bar(1, 110, 111, 110, 111)] }, COSTS);
    expect(g.fills[0].price).toBeCloseTo(110 * 1.002);
  });
});

describe("stop-limit orders", () => {
  it("triggers then fills at the stop when the stop is within the limit", () => {
    const a = place(emptyBook(10_000), [], { symbol: "X", side: "buy", type: "stop_limit", qty: 1, stop_price: 105, limit_price: 107 });
    const r = processBars(a.orders, a.book, { X: [START, bar(1, 100, 106, 100, 106)] }, COSTS);
    expect(r.fills[0].price).toBe(105);
  });
  it("a gap past the limit triggers but does not fill; it then rests as a limit", () => {
    const a = place(emptyBook(10_000), [], { symbol: "X", side: "buy", type: "stop_limit", qty: 1, stop_price: 105, limit_price: 107 });
    const r1 = processBars(a.orders, a.book, { X: [START, bar(1, 110, 112, 110, 112)] }, NONE);
    expect(r1.fills).toHaveLength(0);
    expect(r1.orders[0].triggered).toBe(true);
    expect(r1.orders[0].status).toBe("pending");
    const r2 = processBars(r1.orders, r1.book, { X: [START, bar(1, 110, 112, 110, 112), bar(2, 112, 112, 106, 106)] }, NONE);
    expect(r2.fills).toHaveLength(1);
    expect(r2.fills[0].price).toBe(107);
  });
  it("a sell stop-limit mirrors it", () => {
    const a = place(emptyBook(10_000), [], { symbol: "X", side: "buy", type: "market", qty: 2 });
    const b = place(a.book, a.orders, { symbol: "X", side: "sell", type: "stop_limit", qty: 2, stop_price: 95, limit_price: 94 });
    const ok = processBars(b.orders, b.book, { X: [START, bar(1, 100, 100, 94.5, 94.5)] }, NONE);
    expect(ok.fills[0].price).toBe(95);
    const gap = processBars(b.orders, b.book, { X: [START, bar(1, 90, 91, 89, 90)] }, NONE);
    expect(gap.fills).toHaveLength(0);
    expect(gap.orders.find((o) => o.type === "stop_limit")!.triggered).toBe(true);
  });
});

describe("trailing stops", () => {
  it("follows the best close and fills when price falls the percent from it", () => {
    const a = place(emptyBook(10_000), [], { symbol: "X", side: "buy", type: "market", qty: 10 });
    const b = place(a.book, a.orders, { symbol: "X", side: "sell", type: "trailing_stop", qty: 10, trail_pct: 10 });
    const t = b.placed[0];
    expect(t.trail_ref).toBe(100);
    expect(trailingStopLevel(t)).toBeCloseTo(90);
    const bars = { X: [START, bar(1, 100, 120, 100, 120), bar(2, 120, 120, 110, 110), bar(3, 110, 110, 107, 107)] };
    const r = processBars(b.orders, b.book, bars, NONE);
    // Best close 120, so the stop is 108; the low of 107 on day 3 hits it.
    expect(r.fills).toHaveLength(1);
    expect(r.fills[0].bar_date).toBe(day(3));
    expect(r.fills[0].price).toBeCloseTo(108);
  });
  it("does not move the stop down when price falls", () => {
    const a = place(emptyBook(10_000), [], { symbol: "X", side: "buy", type: "market", qty: 1 });
    const b = place(a.book, a.orders, { symbol: "X", side: "sell", type: "trailing_stop", qty: 1, trail_pct: 10 });
    const r = processBars(b.orders, b.book, { X: [START, bar(1, 100, 100, 95, 95)] }, NONE);
    const o = r.orders.find((x) => x.type === "trailing_stop")!;
    expect(o.trail_ref).toBe(100);
    expect(o.status).toBe("pending");
  });
  it("evaluate() for a buy trailing stop tracks the lowest close", () => {
    const o = place(emptyBook(10_000), [], { symbol: "X", side: "buy", type: "trailing_stop", qty: 1, trail_pct: 5 }).placed[0];
    const down = evaluate(o, bar(1, 100, 100, 90, 90), NONE);
    expect(down.price).toBeNull();
    expect(down.patch.trail_ref).toBe(90);
    const up = evaluate({ ...o, trail_ref: 90 }, bar(2, 90, 95, 90, 95), NONE);
    expect(up.price).toBeCloseTo(94.5);
  });
});

describe("brackets", () => {
  const bracket = (entry: "market" | "limit" | "stop" = "market", entry_price: number | null = null) =>
    placeBracket({ symbol: "X", qty: 10, entry, entry_price, take_profit: 110, stop_loss: 95 }, emptyBook(10_000), [], ctx(START));

  it("a market entry fills now and its children go live", () => {
    const r = bracket();
    expect(r.fills).toHaveLength(1);
    const [entry, tp, sl] = r.orders;
    expect(entry.status).toBe("filled");
    expect(tp.status).toBe("pending");
    expect(sl.status).toBe("pending");
    expect(tp.oco_group).toBe(sl.oco_group);
    expect(tp.parent_id).toBe(entry.id);
    expect(tp.type).toBe("limit");
    expect(sl.type).toBe("stop");
  });
  it("the take-profit filling cancels the stop-loss (one-cancels-other)", () => {
    const r = bracket();
    const p = processBars(r.orders, r.book, { X: [START, bar(1, 100, 111, 100, 111)] }, NONE);
    const [, tp, sl] = p.orders;
    expect(tp.status).toBe("filled");
    expect(tp.fill_price).toBe(110);
    expect(sl.status).toBe("cancelled");
    expect(sl.reason).toMatch(/One-cancels-other/);
    expect(p.book.positions.X).toBeUndefined();
  });
  it("the stop-loss filling cancels the take-profit", () => {
    const r = bracket();
    const p = processBars(r.orders, r.book, { X: [START, bar(1, 100, 100, 94, 94), bar(2, 94, 120, 94, 120)] }, NONE);
    const [, tp, sl] = p.orders;
    expect(sl.status).toBe("filled");
    expect(sl.fill_price).toBe(95);
    expect(tp.status).toBe("cancelled");
    expect(p.fills).toHaveLength(1);
  });
  it("children wait (held) until a limit entry fills, then go live from the next bar", () => {
    const r = bracket("limit", 98);
    expect(r.orders.map((o) => o.status)).toEqual(["pending", "held", "held"]);
    // Day 1 the entry fills at 98; the same bar's high of 111 must not fill the take-profit.
    const p1 = processBars(r.orders, r.book, { X: [START, bar(1, 100, 111, 97, 99)] }, NONE);
    expect(p1.orders.map((o) => o.status)).toEqual(["filled", "pending", "pending"]);
    expect(p1.orders[1].placed_on).toBe(day(1));
    const p2 = processBars(p1.orders, p1.book, { X: [START, bar(1, 100, 111, 97, 99), bar(2, 99, 112, 99, 112)] }, NONE);
    expect(p2.orders[1].status).toBe("filled");
    expect(p2.orders[2].status).toBe("cancelled");
  });
  it("cancelling the entry cancels the children", () => {
    const r = bracket("limit", 98);
    const c = cancelOrder(r.orders, r.orders[0].id);
    expect(c.map((o) => o.status)).toEqual(["cancelled", "cancelled", "cancelled"]);
  });
  it("is refused when the take-profit or stop-loss is on the wrong side", () => {
    const bad = placeBracket({ symbol: "X", qty: 1, entry: "market", take_profit: 90, stop_loss: 80 }, emptyBook(10_000), [], ctx(START));
    expect(bad.orders[0].status).toBe("rejected");
    expect(bad.orders[0].reason).toMatch(/take-profit/);
    expect(bad.orders.slice(1).every((o) => o.status === "cancelled")).toBe(true);
    const bad2 = placeBracket({ symbol: "X", qty: 1, entry: "limit", entry_price: 90, take_profit: 110, stop_loss: 95 }, emptyBook(10_000), [], ctx(START));
    expect(bad2.orders[0].reason).toMatch(/stop-loss/);
  });
  it("OCO children count once against the quantity free to sell", () => {
    const r = bracket();
    expect(committedQty(r.orders, "X")).toBe(10);
    const why = checkOrder({ symbol: "X", side: "sell", type: "market", qty: 1 }, r.book, r.orders, NONE, 100, () => 100);
    expect(why).toMatch(/at most 0|Nothing free/);
  });
});

describe("cancelling and ordering", () => {
  it("cancels an open order and leaves filled ones alone", () => {
    const a = place(emptyBook(10_000), [], { symbol: "X", side: "buy", type: "limit", qty: 1, limit_price: 90 });
    const b = place(a.book, a.orders, { symbol: "X", side: "buy", type: "market", qty: 1 });
    const c = cancelOrder(b.orders, a.placed[0].id);
    expect(c[0].status).toBe("cancelled");
    expect(cancelOrder(c, b.placed[0].id)[1].status).toBe("filled");
    const p = processBars(c, b.book, { X: [START, bar(1, 80, 80, 80, 80)] }, NONE);
    expect(p.fills).toHaveLength(0);
  });
  it("processes several instruments day by day, oldest first", () => {
    const a = place(emptyBook(1000), [], { symbol: "X", side: "buy", type: "limit", qty: 5, limit_price: 100 });
    // A second order on Y needs the same cash; only the one whose bar comes first fills.
    const b = place({ ...a.book }, [], { symbol: "Y", side: "buy", type: "limit", qty: 5, limit_price: 100 });
    const orders = [...a.orders, ...b.orders];
    const r = processBars(orders, emptyBook(600), { X: [START, bar(2, 100, 100, 99, 99)], Y: [START, bar(1, 100, 100, 99, 99)] }, NONE);
    expect(r.orders.find((o) => o.symbol === "Y")!.status).toBe("filled");
    expect(r.orders.find((o) => o.symbol === "X")!.status).toBe("rejected");
  });
  it("is deterministic: the same inputs give the same output", () => {
    const r = bracket2();
    const bars = { X: [START, bar(1, 100, 104, 96, 103), bar(2, 103, 111, 102, 108)] };
    expect(processBars(r.orders, r.book, bars, COSTS)).toEqual(processBars(r.orders, r.book, bars, COSTS));
  });
});

function bracket2() {
  return placeBracket({ symbol: "X", qty: 3, entry: "market", take_profit: 110, stop_loss: 95 }, emptyBook(10_000), [], ctx(START, COSTS));
}
