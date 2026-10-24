// Any other CSV: a list of trades (at least a close date and a profit per trade) or an
// equity curve (a date and an account value or a return). Columns are found by the
// common names below; the person can pick others on the page.
import type { EquityPoint, Mapping, Table, Trade } from "../types";
import { col, compact, dayFirstIn, reader, sideOf } from "./common";

const P = {
  closeTime: [/^close ?time$/, /^closed?( at| on)?$/, /^exit ?(time|date)$/, /^close ?date$/, /^date ?closed$/, /^time ?closed$/, /^close$/],
  openTime: [/^open ?time$/, /^opened?( at| on)?$/, /^entry ?(time|date)$/, /^open ?date$/, /^date ?opened$/],
  anyDate: [/^date$/, /^time$/, /^date ?time$/, /^timestamp$/, /^day$/],
  pnl: [/^pnl$/, /^p ?& ?l$/, /^p\/l$/, /^net ?(profit|pnl|p&l)$/, /^profit$/, /^profit ?\/ ?loss$/, /^realized( pnl| p&l)?$/, /^result$/, /^gain$/, /^net$/],
  fees: [/^fees?$/, /^commissions?$/, /^costs?$/],
  symbol: [/^symbol$/, /^ticker$/, /^instrument$/, /^market$/, /^pair$/, /^asset$/, /^item$/, /^coin$/],
  side: [/^side$/, /^direction$/, /^type$/, /^action$/, /^buy ?\/ ?sell$/, /^long ?\/ ?short$/],
  size: [/^size$/, /^qty$/, /^quantity$/, /^volume$/, /^lots?$/, /^contracts$/, /^units$/, /^amount$/],
  entry: [/^entry( price)?$/, /^open ?price$/, /^price ?in$/, /^avg ?entry( price)?$/, /^buy ?price$/],
  exit: [/^exit( price)?$/, /^close ?price$/, /^price ?out$/, /^avg ?exit( price)?$/, /^sell ?price$/],
  id: [/^id$/, /^trade ?id$/, /^ticket$/, /^trade ?#$/, /^trade ?(no\.?|number)$/, /^#$/],
  equity: [/^equity$/, /^balance$/, /^account ?value$/, /^value$/, /^nav$/, /^portfolio ?value$/, /^net ?liquidation( value)?$/],
  ret: [/^returns?$/, /^ret$/, /^daily ?returns?$/, /^returns? ?%$/, /^pct ?change$/, /^change ?%$/, /^%$/],
  cashflow: [/^cash ?flows?$/, /^deposits? ?\/ ?withdrawals?$/, /^flows?$/, /^net ?deposits?$/, /^transfers?$/, /^deposits?$/],
};

export function detectTrades(t: Table): number {
  const h = t.headers;
  const date = col(h, P.closeTime) ?? col(h, P.anyDate);
  const pnl = col(h, P.pnl);
  if (date == null || pnl == null) return 0;
  return 3 + (col(h, P.symbol) != null ? 1 : 0) + (col(h, P.openTime) != null ? 1 : 0);
}

export function mapTrades(t: Table): Mapping {
  const h = t.headers;
  return compact({
    closeTime: col(h, P.closeTime) ?? col(h, P.anyDate), openTime: col(h, P.openTime), pnl: col(h, P.pnl),
    fees: col(h, P.fees), symbol: col(h, P.symbol), side: col(h, P.side), size: col(h, P.size),
    entry: col(h, P.entry), exit: col(h, P.exit), id: col(h, P.id),
  });
}

export function buildTrades(t: Table, m: Mapping): { trades: Trade[]; warnings: string[] } {
  const r = reader(m);
  const df = dayFirstIn(t.rows, m.closeTime);
  const trades: Trade[] = [];
  let skipped = 0;
  for (const row of t.rows) {
    const closeTime = r.date(row, "closeTime", df);
    const pnl = r.num(row, "pnl");
    if (!closeTime || pnl == null) { skipped++; continue; }
    // A fees column is taken off the profit. Leave it unmapped if the profit already includes it.
    const fees = Math.abs(r.num(row, "fees") ?? 0);
    trades.push({
      id: r.text(row, "id"), openTime: r.date(row, "openTime", df) ?? undefined, closeTime,
      symbol: r.text(row, "symbol")?.toUpperCase(), side: sideOf(r.text(row, "side")),
      size: r.num(row, "size") ?? undefined, entry: r.num(row, "entry") ?? undefined, exit: r.num(row, "exit") ?? undefined,
      fees, pnl: pnl - fees,
    });
  }
  trades.sort((a, b) => (a.closeTime < b.closeTime ? -1 : a.closeTime > b.closeTime ? 1 : 0));
  return { trades, warnings: skipped ? [`${skipped} row${skipped === 1 ? " had" : "s had"} no readable date or profit and ${skipped === 1 ? "was" : "were"} skipped.`] : [] };
}

// ---------------------------------------------------------------- equity curves

export function detectEquity(t: Table): number {
  const h = t.headers;
  if (col(h, P.pnl) != null) return 0;
  const date = col(h, P.anyDate) ?? col(h, P.closeTime);
  if (date == null) return 0;
  return col(h, P.equity) != null || col(h, P.ret) != null ? 3 + (col(h, P.cashflow) != null ? 1 : 0) : 0;
}

export function mapEquity(t: Table): Mapping {
  const h = t.headers;
  return compact({ date: col(h, P.anyDate) ?? col(h, P.closeTime), equity: col(h, P.equity), ret: col(h, P.ret), cashflow: col(h, P.cashflow) });
}

export function buildEquity(t: Table, m: Mapping): { equity: EquityPoint[]; warnings: string[] } {
  const r = reader(m);
  const df = dayFirstIn(t.rows, m.date);
  // Returns written with a % sign, or bigger than 1.5 anywhere, are read as percents.
  const retCells = m.ret == null ? [] : t.rows.map((row) => row[m.ret!] ?? "");
  const pctRet = retCells.some((c) => c.includes("%")) || retCells.some((c) => Math.abs(Number(c.replace(/[%,\s]/g, ""))) > 1.5)
    || (m.ret != null && /%|pct|percent/i.test(t.headers[m.ret]));
  const byDay = new Map<string, EquityPoint>();
  let skipped = 0;
  for (const row of t.rows) {
    const d = r.date(row, "date", df);
    const equity = r.num(row, "equity");
    const ret = r.num(row, "ret");
    if (!d || (equity == null && ret == null)) { skipped++; continue; }
    const date = d.slice(0, 10);
    const cash = r.num(row, "cashflow");
    const prev = byDay.get(date);
    // Several rows on one day: keep the last value and add up the cash flows.
    byDay.set(date, {
      date,
      equity: equity ?? undefined,
      ret: ret == null ? undefined : pctRet ? ret / 100 : ret,
      cashflow: (prev?.cashflow ?? 0) + (cash ?? 0) || undefined,
    });
  }
  const equity = [...byDay.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
  return { equity, warnings: skipped ? [`${skipped} row${skipped === 1 ? " was" : "s were"} skipped: no readable date or value.`] : [] };
}
