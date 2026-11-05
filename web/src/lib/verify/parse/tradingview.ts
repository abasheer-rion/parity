// TradingView Strategy Tester, "List of trades", as CSV or as the "List of trades" sheet of
// the xlsx download. Each trade is two rows, an entry and an exit, sharing a trade number.
// Three header versions were checked against real exports:
//   2026: Trade number, Type, Date and time, Signal, Price USDT, Size (qty), Size (value),
//         Net PnL USDT, Return %, Commission USDT, Favorable excursion ..., Cumulative PnL ...
//   2025: Trade #, Type, Date and time, Signal, Price USD, Position size (qty), Position size
//         (value), Net P&L USD, Net P&L %, Favorable excursion ..., Cumulative P&L ...
//   older: Trade #, Type, Signal, Date/Time, Price USD, Contracts, Profit USD, Profit %, Cum.
//         Profit USD, Run-up USD, Drawdown USD (newest first, "Exit Long").
// Rows may come exit first; a trade still open at the end of the test has an exit row with
// an empty Signal (or "Open"), and is left out. Net P&L is after commission. This is always a
// backtest, never real trading, and the verdict says so (REF-0016).
import type { Mapping, Table, Trade } from "../types";
import { col, compact, dayFirstIn, reader, skippedWarning, whyBad } from "./common";

export function detectTradingView(t: Table): number {
  const h = t.headers;
  const has = (p: RegExp[]) => col(h, p) != null;
  let s = 0;
  if (has([/^trade ?#$/, /^trade number$/, /^trade no\.?$/])) s += 3;
  if (has([/^signal$/])) s += 2;
  if (has([/^run-?up/, /^favorable excursion/])) s += 2;
  if (has([/^drawdown/, /^adverse excursion/])) s += 1;
  if (has([/^cum(\.|ulative)? ?(profit|p&l|pnl)/])) s += 2;
  if (has([/^type$/])) s += 1;
  return s >= 6 ? s : 0;
}

export function mapTradingView(t: Table): Mapping {
  const h = t.headers;
  return compact({
    id: col(h, [/^trade ?#$/, /^trade number$/, /^trade no\.?$/]),
    tvType: col(h, [/^type$/]),
    closeTime: col(h, [/^date ?\/ ?time$/, /^date and time$/, /^date$/, /^time$/]),
    entry: col(h, [/^price/]),
    size: col(h, [/^contracts$/, /^quantity$/, /^qty$/, /^(position )?size \(qty\)/]),
    pnl: col(h, [/^net (p&l|pnl)( [a-z]{2,5})?$/, /^profit( [a-z]{2,5})?$/]),
    fees: col(h, [/^commission( [a-z]{2,5})?$/]),
    rowType: col(h, [/^signal$/]),
    symbol: col(h, [/^symbol$/, /^ticker$/]),
  });
}

export function buildTradingView(t: Table, m: Mapping): { trades: Trade[]; warnings: string[] } {
  const r = reader(m, t);
  const df = dayFirstIn(t.rows, m.closeTime);
  const byId = new Map<string, { entry?: string[]; exit?: string[]; k: number }>();
  const order: string[] = [];
  t.rows.forEach((row, k) => {
    const id = r.text(row, "id");
    const type = (r.text(row, "tvType") ?? "").toLowerCase();
    if (!id) return;
    if (!byId.has(id)) { byId.set(id, { k }); order.push(id); }
    const g = byId.get(id)!;
    if (type.startsWith("entry")) g.entry = row; else if (type.startsWith("exit")) g.exit = row;
  });
  const trades: Trade[] = [];
  const bad: { k: number; why: string }[] = [];
  let open = 0;
  for (const id of order) {
    const g = byId.get(id)!;
    const signal = g.exit && m.rowType != null ? (r.text(g.exit, "rowType") ?? "") : "x";
    if (!g.exit || !signal || /^open$/i.test(signal)) { open++; continue; }
    const closeTime = r.date(g.exit, "closeTime", df);
    const pnl = r.loose(g.exit, "pnl") ?? (g.entry ? r.loose(g.entry, "pnl") : null);
    if (!closeTime || pnl == null) { bad.push({ k: g.k, why: whyBad([...(!closeTime ? [["date", r.cell(g.exit, "closeTime"), "date"]] : []), ...(pnl == null ? [["profit", r.cell(g.exit, "pnl"), "number"]] : [])] as [string, string, "date" | "number" | "text"][]) }); continue; }
    const type = (r.text(g.entry ?? g.exit, "tvType") ?? "").toLowerCase();
    trades.push({
      id, openTime: g.entry ? r.date(g.entry, "closeTime", df) ?? undefined : undefined, closeTime,
      symbol: r.text(g.exit, "symbol")?.toUpperCase(), side: /short/.test(type) ? "sell" : "buy",
      size: r.loose(g.exit, "size") ?? undefined, entry: g.entry ? r.loose(g.entry, "entry") ?? undefined : undefined,
      exit: r.loose(g.exit, "entry") ?? undefined, fees: Math.abs(r.loose(g.exit, "fees") ?? 0), pnl,
    });
  }
  // Newest-first exports are put in time order.
  trades.sort((a, b) => (a.closeTime < b.closeTime ? -1 : a.closeTime > b.closeTime ? 1 : 0));
  const warnings = skippedWarning(t, bad);
  if (open) warnings.push(`${open} trade${open === 1 ? " was" : "s were"} still open at the end of the test and left out.`);
  return { trades, warnings };
}
