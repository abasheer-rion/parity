// TradingView Strategy Tester, "List of trades", exported as CSV. Each trade is two rows,
// an entry and an exit, sharing a trade number: Trade #, Type ("Entry long", "Exit long"),
// Signal, Date/Time (or "Date and time"), Price USD, Contracts (or "Position size (qty)"),
// Profit USD (or "Net P&L USD"), Cum. Profit, Run-up, Drawdown. This is always a backtest,
// never real trading, and the verdict says so (REF-0016).
import type { Mapping, Table, Trade } from "../types";
import { col, compact, dayFirstIn, reader } from "./common";

export function detectTradingView(t: Table): number {
  const h = t.headers;
  const has = (p: RegExp[]) => col(h, p) != null;
  let s = 0;
  if (has([/^trade ?#$/, /^trade number$/, /^trade no\.?$/])) s += 3;
  if (has([/^signal$/])) s += 2;
  if (has([/^run-?up/])) s += 2;
  if (has([/^drawdown/])) s += 1;
  if (has([/^cum(\.|ulative)? ?(profit|p&l)/])) s += 2;
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
    size: col(h, [/^contracts$/, /^quantity$/, /^qty$/, /^position size/]),
    pnl: col(h, [/^net p&l/, /^profit( usd| [a-z]{3})?$/, /^profit$/]),
    symbol: col(h, [/^symbol$/, /^ticker$/]),
  });
}

export function buildTradingView(t: Table, m: Mapping): { trades: Trade[]; warnings: string[] } {
  const r = reader(m);
  const df = dayFirstIn(t.rows, m.closeTime);
  const byId = new Map<string, { entry?: string[]; exit?: string[] }>();
  const order: string[] = [];
  for (const row of t.rows) {
    const id = r.text(row, "id");
    const type = (r.text(row, "tvType") ?? "").toLowerCase();
    if (!id) continue;
    if (!byId.has(id)) { byId.set(id, {}); order.push(id); }
    const g = byId.get(id)!;
    if (type.startsWith("entry")) g.entry = row; else if (type.startsWith("exit")) g.exit = row;
  }
  const trades: Trade[] = [];
  let open = 0;
  for (const id of order) {
    const g = byId.get(id)!;
    if (!g.exit) { open++; continue; }
    const closeTime = r.date(g.exit, "closeTime", df);
    const pnl = r.num(g.exit, "pnl") ?? (g.entry ? r.num(g.entry, "pnl") : null);
    if (!closeTime || pnl == null) continue;
    const type = (r.text(g.entry ?? g.exit, "tvType") ?? "").toLowerCase();
    trades.push({
      id, openTime: g.entry ? r.date(g.entry, "closeTime", df) ?? undefined : undefined, closeTime,
      symbol: r.text(g.exit, "symbol")?.toUpperCase(), side: /short/.test(type) ? "sell" : "buy",
      size: r.num(g.exit, "size") ?? undefined, entry: g.entry ? r.num(g.entry, "entry") ?? undefined : undefined,
      exit: r.num(g.exit, "entry") ?? undefined, fees: 0, pnl,
    });
  }
  // Newest-first exports are put in time order.
  trades.sort((a, b) => (a.closeTime < b.closeTime ? -1 : a.closeTime > b.closeTime ? 1 : 0));
  return { trades, warnings: open ? [`${open} trade${open === 1 ? " was" : "s were"} still open at the end of the test and left out.`] : [] };
}
