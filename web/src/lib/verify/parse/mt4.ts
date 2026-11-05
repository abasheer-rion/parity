// MetaTrader 4 account history saved as CSV (from "Save as Detailed Report" through a
// spreadsheet or a journal app). Columns, in the order MT4 prints them: Ticket, Open Time,
// Type, Size, Item, Price, S / L, T / P, Close Time, Price, Commission, Taxes, Swap,
// Profit. The two "Price" columns are the open and the close price, told apart by
// position. Column names vary between exports and are unverified against every broker
// (REF-0016), so the person can correct the mapping on the page.
import { num, parseDate } from "../csv";
import type { Mapping, Table, Trade } from "../types";

export const SERVER_TIME = "MetaTrader times are the broker's server time; days are counted in that time.";
import { col, compact, reader, skippedWarning, whyBad } from "./common";

export function detectMt4(t: Table): number {
  const h = t.headers;
  const has = (p: RegExp[]) => col(h, p) != null;
  let s = 0;
  if (has([/^ticket$/, /^order$/])) s += 2;
  if (has([/^open time$/])) s += 2;
  if (has([/^close time$/])) s += 2;
  if (has([/^item$/])) s += 2;
  if (has([/^size$/, /^lots?$/])) s += 1;
  if (has([/^profit$/])) s += 1;
  if (has([/^taxes$/])) s += 1;
  return s >= 6 ? s : 0;
}

export function mapMt4(t: Table): Mapping {
  const h = t.headers;
  const symbol = col(h, [/^item$/, /^symbol$/]);
  const openTime = col(h, [/^open time$/, /^time$/]);
  const closeTime = col(h, [/^close time$/]) ?? col(h, [/^time$/], 1);
  return compact({
    id: col(h, [/^ticket$/, /^order$/]),
    openTime,
    closeTime,
    side: col(h, [/^type$/]),
    size: col(h, [/^size$/, /^lots?$/, /^volume$/]),
    symbol,
    entry: col(h, [/^price$/, /^open price$/], 0, symbol ?? openTime ?? -1) ?? col(h, [/^open price$/]),
    exit: col(h, [/^price$/, /^close price$/], 0, closeTime ?? -1) ?? col(h, [/^close price$/]),
    commission: col(h, [/^commission$/]),
    swap: col(h, [/^swap$/]),
    fees: col(h, [/^taxes$/]),
    pnl: col(h, [/^profit$/]),
  });
}

export function buildMt4(t: Table, m: Mapping): { trades: Trade[]; balance?: number; warnings: string[]; notes: string[] } {
  const r = reader(m, t);
  const trades: Trade[] = [];
  const bad: { k: number; why: string }[] = [];
  let balance: number | undefined, closeBy = 0;
  t.rows.forEach((row, k) => {
    const type = (r.text(row, "side") ?? "").toLowerCase();
    // A "balance" row is a deposit: the first one, before any trade, is the starting balance.
    if (type === "balance") { const v = r.num(row, "pnl"); if (balance == null && !trades.length && v != null && v > 0) balance = v; return; }
    if (type !== "buy" && type !== "sell") return;
    const closeTime = r.date(row, "closeTime");
    const profit = r.num(row, "pnl");
    if (!closeTime || profit == null) { bad.push({ k, why: whyBad([...(!closeTime ? [["close time", r.cell(row, "closeTime"), "date"]] : []), ...(profit == null ? [["profit", r.cell(row, "pnl"), "number"]] : [])] as [string, string, "date" | "number" | "text"][]) }); return; }
    // A row of size 0 and no profit is the record a "close by" leaves; the trade is on another row.
    if (r.num(row, "size") === 0 && profit === 0) { closeBy++; return; }
    const costs = (r.num(row, "commission") ?? 0) + (r.num(row, "swap") ?? 0) + (r.num(row, "fees") ?? 0);
    trades.push({
      id: r.text(row, "id"),
      openTime: r.date(row, "openTime") ?? undefined,
      closeTime,
      symbol: r.text(row, "symbol")?.toUpperCase(),
      side: type,
      size: r.num(row, "size") ?? undefined,
      entry: r.num(row, "entry") ?? undefined,
      exit: r.num(row, "exit") ?? undefined,
      fees: -costs,
      pnl: profit + costs,
    });
  });
  trades.sort((a, b) => (a.closeTime < b.closeTime ? -1 : a.closeTime > b.closeTime ? 1 : 0));
  const warnings = skippedWarning(t, bad);
  if (closeBy) warnings.push(`${closeBy} row${closeBy === 1 ? " has" : "s have"} size 0 and no profit: what "close by" leaves behind. ${closeBy === 1 ? "It is" : "They are"} left out; the trades ${closeBy === 1 ? "it closed are" : "they closed are"} on their own rows.`);
  return { trades, balance, warnings, notes: [SERVER_TIME] };
}

/**
 * MetaTrader 4 Strategy Tester report: one row per event (#, Time, Type, Order, Size, Price,
 * S / L, T / P, Profit, Balance). An order opens with "buy" or "sell" and closes with
 * "close", "t/p", "s/l" or "close at stop", whose row carries the profit and the balance after.
 */
export function buildMt4Tester(t: Table): { trades: Trade[]; balance?: number; warnings: string[]; notes: string[] } {
  const opens = new Map<string, { time: string; side: "buy" | "sell"; size: number; price: number }>();
  const trades: Trade[] = [];
  let balance: number | undefined;
  for (const row of t.rows) {
    const [, time, type, order, size, price, , , profit, bal] = row;
    const when = parseDate(time);
    if (!when) continue;
    if (type === "buy" || type === "sell") { opens.set(order, { time: when, side: type, size: num(size) ?? 0, price: num(price) ?? NaN }); continue; }
    if (!/^(close|t\/p|s\/l|close at stop)$/.test(type)) continue;
    const p = num(profit), b = num(bal);
    if (p == null) continue;
    if (balance == null && b != null) balance = b - p;
    const o = opens.get(order);
    trades.push({ id: order, openTime: o?.time, closeTime: when, side: o?.side, size: o?.size, entry: o && Number.isFinite(o.price) ? o.price : undefined, exit: num(price) ?? undefined, fees: 0, pnl: p });
  }
  return { trades, balance, warnings: [], notes: ["A Strategy Tester report is a backtest: rules run on past prices, not real trading."] };
}
