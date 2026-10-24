// MetaTrader 5 history saved as CSV. Two shapes are read:
//
//   Positions: Time, Position, Symbol, Type, Volume, Price, S / L, T / P, Time, Price,
//              Commission, Swap, Profit (open and close told apart by position).
//   Deals:     Time, Deal, Symbol, Type, Direction, Volume, Price, Order, Commission,
//              Fee, Swap, Profit, Balance, Comment, and sometimes Position.
//
// Deals are paired into trades: every "out" deal closes volume opened by earlier "in"
// deals of the same position (or, without a position column, the same symbol, oldest
// first). A partial close is its own trade (REF-0016). Column names are unverified
// against every broker, so the person can correct the mapping on the page.
import type { Mapping, Table, Trade } from "../types";
import { col, compact, reader } from "./common";

const has = (t: Table, p: RegExp[]) => col(t.headers, p) != null;

export function detectMt5(t: Table): number {
  if (has(t, [/^direction$/])) return 0; // that is the deals shape
  let s = 0;
  if (has(t, [/^position$/])) s += 3;
  if (col(t.headers, [/^time$/], 1) != null || (has(t, [/^open time$/]) && has(t, [/^close time$/]))) s += 2;
  if (has(t, [/^volume$/])) s += 2;
  if (has(t, [/^symbol$/])) s += 1;
  if (has(t, [/^profit$/])) s += 1;
  if (has(t, [/^swap$/])) s += 1;
  return s >= 7 ? s : 0;
}

export function mapMt5(t: Table): Mapping {
  const h = t.headers;
  const openTime = col(h, [/^open time$/]) ?? col(h, [/^time$/]);
  const closeTime = col(h, [/^close time$/]) ?? col(h, [/^time$/], 1);
  return compact({
    id: col(h, [/^position$/, /^ticket$/]),
    openTime,
    closeTime,
    symbol: col(h, [/^symbol$/]),
    side: col(h, [/^type$/]),
    size: col(h, [/^volume$/, /^lots?$/]),
    entry: col(h, [/^open price$/]) ?? col(h, [/^price$/], 0, openTime ?? -1),
    exit: col(h, [/^close price$/]) ?? col(h, [/^price$/], 0, closeTime ?? -1),
    commission: col(h, [/^commission$/]),
    swap: col(h, [/^swap$/]),
    fees: col(h, [/^fee$/]),
    pnl: col(h, [/^profit$/]),
  });
}

export function buildMt5(t: Table, m: Mapping): { trades: Trade[] } {
  const r = reader(m);
  const trades: Trade[] = [];
  for (const row of t.rows) {
    const type = (r.text(row, "side") ?? "").toLowerCase();
    if (type !== "buy" && type !== "sell") continue;
    const closeTime = r.date(row, "closeTime");
    const profit = r.num(row, "pnl");
    if (!closeTime || profit == null) continue;
    const costs = (r.num(row, "commission") ?? 0) + (r.num(row, "swap") ?? 0) + (r.num(row, "fees") ?? 0);
    trades.push({
      id: r.text(row, "id"), openTime: r.date(row, "openTime") ?? undefined, closeTime,
      symbol: r.text(row, "symbol")?.toUpperCase(), side: type, size: r.num(row, "size") ?? undefined,
      entry: r.num(row, "entry") ?? undefined, exit: r.num(row, "exit") ?? undefined,
      fees: -costs, pnl: profit + costs,
    });
  }
  return { trades };
}

// ---------------------------------------------------------------- deals

export function detectMt5Deals(t: Table): number {
  let s = 0;
  if (has(t, [/^deal$/])) s += 3;
  if (has(t, [/^direction$/])) s += 3;
  if (has(t, [/^volume$/])) s += 1;
  if (has(t, [/^profit$/])) s += 1;
  if (has(t, [/^balance$/])) s += 1;
  return s >= 7 ? s : 0;
}

export function mapMt5Deals(t: Table): Mapping {
  const h = t.headers;
  return compact({
    closeTime: col(h, [/^time$/]),
    id: col(h, [/^deal$/]),
    position: col(h, [/^position$/]),
    symbol: col(h, [/^symbol$/]),
    side: col(h, [/^type$/]),
    direction: col(h, [/^direction$/]),
    size: col(h, [/^volume$/]),
    entry: col(h, [/^price$/]),
    commission: col(h, [/^commission$/]),
    fees: col(h, [/^fee$/]),
    swap: col(h, [/^swap$/]),
    pnl: col(h, [/^profit$/]),
    equity: col(h, [/^balance$/]),
  });
}

interface Open { time: string; price: number; left: number; side: "buy" | "sell"; costPerLot: number }

export function buildMt5Deals(t: Table, m: Mapping): { trades: Trade[]; balance?: number; warnings: string[] } {
  const r = reader(m);
  const warnings: string[] = [];
  const open = new Map<string, Open[]>();
  const trades: Trade[] = [];
  let balance: number | undefined;
  let unmatched = 0;
  const rows = t.rows
    .map((row) => ({ row, time: r.date(row, "closeTime") }))
    .filter((x): x is { row: string[]; time: string } => !!x.time)
    .sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));
  for (const { row, time } of rows) {
    const type = (r.text(row, "side") ?? "").toLowerCase();
    const dir = (r.text(row, "direction") ?? "").toLowerCase();
    if (type === "balance" || type === "credit") {
      const v = r.num(row, "pnl");
      if (balance == null && v != null && v > 0) balance = v;
      continue;
    }
    if (type !== "buy" && type !== "sell") continue;
    const symbol = r.text(row, "symbol")?.toUpperCase();
    const key = r.text(row, "position") ?? symbol ?? "?";
    const vol = r.num(row, "size") ?? 0;
    const price = r.num(row, "entry") ?? NaN;
    const costs = (r.num(row, "commission") ?? 0) + (r.num(row, "fees") ?? 0) + (r.num(row, "swap") ?? 0);
    if (dir === "in") {
      const list = open.get(key) ?? [];
      list.push({ time, price, left: vol, side: type, costPerLot: vol > 0 ? costs / vol : 0 });
      open.set(key, list);
      continue;
    }
    if (!dir.startsWith("out") && dir !== "in/out") continue;
    // An "out" deal closes earlier "in" volume, oldest first.
    const list = open.get(key) ?? [];
    let need = vol, w = 0, inCost = 0;
    let first: Open | undefined;
    while (need > 1e-12 && list.length) {
      const o = list[0];
      first ??= o;
      const take = Math.min(o.left, need);
      w += take * o.price; inCost += take * o.costPerLot;
      o.left -= take; need -= take;
      if (o.left <= 1e-12) list.shift();
    }
    if (!first) unmatched++;
    const matched = vol - need;
    const profit = r.num(row, "pnl") ?? 0;
    trades.push({
      id: r.text(row, "id"), openTime: first?.time, closeTime: time, symbol,
      side: first?.side ?? (type === "buy" ? "sell" : "buy"), size: vol || undefined,
      entry: matched > 0 ? w / matched : undefined, exit: Number.isFinite(price) ? price : undefined,
      fees: -(costs + inCost), pnl: profit + costs + inCost,
    });
  }
  if (unmatched) warnings.push(`${unmatched} closing deals had no opening deal in the file (the trade was opened before the file starts). Their profit still counts.`);
  return { trades, balance, warnings };
}
