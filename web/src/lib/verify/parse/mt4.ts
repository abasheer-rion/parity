// MetaTrader 4 account history saved as CSV (from "Save as Detailed Report" through a
// spreadsheet or a journal app). Columns, in the order MT4 prints them: Ticket, Open Time,
// Type, Size, Item, Price, S / L, T / P, Close Time, Price, Commission, Taxes, Swap,
// Profit. The two "Price" columns are the open and the close price, told apart by
// position. Column names vary between exports and are unverified against every broker
// (REF-0016), so the person can correct the mapping on the page.
import type { Mapping, Table, Trade } from "../types";
import { col, compact, reader } from "./common";

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

export function buildMt4(t: Table, m: Mapping): { trades: Trade[]; balance?: number } {
  const r = reader(m);
  const trades: Trade[] = [];
  let balance: number | undefined;
  for (const row of t.rows) {
    const type = (r.text(row, "side") ?? "").toLowerCase();
    // A "balance" row is a deposit: the first one is a good guess at the starting balance.
    if (type === "balance" && balance == null) { const v = r.num(row, "pnl"); if (v != null && v > 0) balance = v; continue; }
    if (type !== "buy" && type !== "sell") continue;
    const closeTime = r.date(row, "closeTime");
    const profit = r.num(row, "pnl");
    if (!closeTime || profit == null) continue;
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
  }
  return { trades, balance };
}
