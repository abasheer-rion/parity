// Trading platforms whose exports list closed trades, one row each, plus Tradovate's orders.
// Which layouts were checked against a real export is in supported.ts; the person can correct
// any column on the page.
//
//   cTrader, History tab (CSV, or an xlsx with one sheet "Records"): ID or Order ID, Symbol,
//     Opening Direction, (Opening Time,) Closing Time, sometimes with the zone as "(UTC+4)",
//     Entry Price, Closing Price, Closing Quantity ("0.5", "2.00 Lots"), Commission(s), Swap,
//     Gross USD, Net USD, Balance USD, Pips. Times "17/01/2026 01:54:32.633", day first. Net
//     already has commission and swap taken off; without it, profit is gross plus both.
//   NinjaTrader 8, Trade Performance, Trades grid: Trade number, Instrument ("NQ JUN25"),
//     Account, Strategy, Market pos., Qty, Entry price, Exit price, Entry time, Exit time
//     ("4/30/2025 9:45:30 AM"), Entry name, Exit name, Profit ("$285.00", "($510.00)"), Cum. net
//     profit, Commission, (Clearing Fee, Exchange Fee, IP Fee, NFA Fee,) MAE, MFE, ETD, Bars, and
//     a trailing comma. Profit already has the commission taken off.
//   Tradovate, Performance report: symbol, _priceFormat, _priceFormatType, _tickSize,
//     buyFillId, sellFillId, qty, buyPrice, sellPrice, pnl ("$(20.00)", "$2,200.00"),
//     boughtTimestamp, soldTimestamp, duration. Its pnl is before commissions and fees.
//   Tradovate, Position history: Position ID, ..., Contract, Product, Pair ID, Buy Fill ID,
//     Sell Fill ID, Paired Qty, Buy Price, Sell Price, P/L, Currency, Bought Timestamp,
//     Sold Timestamp. One row per paired round trip, P/L before commissions.
//   Tradovate, Orders: B/S (" Buy"), Contract, avgPrice, filledQty, Fill Time, Status
//     (" Filled"), ... Filled orders are fills, paired first in, first out, with the contract
//     size from futures.ts.
//   Myfxbook, Export CSV: Open Date, Close Date ("07/31/2025 13:58"), Symbol, Action (Buy,
//     Sell, Deposit, Withdrawal), Units/Lots, SL, TP, Open Price, Close Price, Commission,
//     Swap, Pips, Profit, Gain, ... Profit already has commission and swap taken off.
import type { Table, Trade } from "../types";
import { col, compact, dayFirstIn, reader, sideOf, skippedWarning, whyBad } from "./common";
import { pairFills, readFills } from "./fills";
import { FILL_FIELDS, score, TRADE_FIELDS, type FormatDef } from "./format";
import { pointValue } from "./futures";

type Bad = { k: number; why: string };
const byClose = (a: Trade, b: Trade) => (a.closeTime < b.closeTime ? -1 : a.closeTime > b.closeTime ? 1 : 0);
const need = (parts: [string, string, "date" | "number" | "text", boolean][]) => whyBad(parts.filter((p) => p[3]).map(([a, b, c]) => [a, b, c]));

export const ctrader: FormatDef = {
  id: "ctrader",
  detect: (t) => {
    const s = score(t, [[4, [/^opening direction$/]], [2, [/^closing time/]], [1, [/^net /, /^net$/, /^gross /]], [1, [/^entry price$/]], [1, [/^closing price$/]]]);
    return s >= 7 ? s + 2 : 0;
  },
  map: (t) => {
    const h = t.headers;
    return compact({
      symbol: col(h, [/^symbol$/]), side: col(h, [/^opening direction$/]), openTime: col(h, [/^opening time/]), closeTime: col(h, [/^closing time/]),
      entry: col(h, [/^entry price$/]), exit: col(h, [/^closing price$/]), size: col(h, [/^closing quantity$/, /^quantity$/, /^volume$/]),
      commission: col(h, [/^commissions?$/]), swap: col(h, [/^swap$/]), pnl: col(h, [/^net( [a-z$€£]{1,3}| \([a-z$€£]{1,3}\))?$/, /^net profit$/]), equity: col(h, [/^gross( [a-z$€£]{1,3}| \([a-z$€£]{1,3}\))?$/]),
      balance: col(h, [/^balance( [a-z$€£]{1,3}| \([a-z$€£]{1,3}\))?$/]),
    });
  },
  build: (t, m) => {
    const r = reader(m, t);
    const df = dayFirstIn(t.rows, m.closeTime);
    const trades: Trade[] = [];
    const bad: Bad[] = [];
    // The balance after the oldest trade, less that trade's profit, is the balance it started from.
    let oldest: { time: string; after: number; pnl: number } | null = null;
    t.rows.forEach((row, k) => {
      const closeTime = r.date(row, "closeTime", df);
      const costs = (r.loose(row, "commission") ?? 0) + (r.loose(row, "swap") ?? 0);
      const net = r.loose(row, "pnl");
      const gross = r.loose(row, "equity");
      const pnl = net ?? (gross != null ? gross + costs : null);
      if (!closeTime || pnl == null) { bad.push({ k, why: need([["closing time", r.cell(row, "closeTime"), "date", !closeTime], ["net profit", r.cell(row, "pnl"), "number", pnl == null]]) }); return; }
      const after = r.loose(row, "balance");
      if (after != null && (!oldest || closeTime < oldest.time)) oldest = { time: closeTime, after, pnl };
      trades.push({ closeTime, openTime: r.date(row, "openTime", df) ?? undefined, symbol: r.text(row, "symbol")?.toUpperCase(),
        side: sideOf(r.text(row, "side")), size: r.loose(row, "size") ?? undefined, entry: r.loose(row, "entry") ?? undefined,
        exit: r.loose(row, "exit") ?? undefined, fees: gross != null && net != null ? gross - net : -costs, pnl });
    });
    const start = oldest as { after: number; pnl: number } | null;
    return { trades: trades.sort(byClose), warnings: skippedWarning(t, bad), balance: start && start.after - start.pnl > 0 ? Math.round((start.after - start.pnl) * 100) / 100 : undefined };
  },
  fields: [...TRADE_FIELDS.map((f) => (f.field === "pnl" ? { ...f, label: "Net profit", required: false } : f)),
    { field: "equity", label: "Gross profit" }, { field: "commission", label: "Commission" }, { field: "swap", label: "Swap" }, { field: "balance", label: "Balance after the trade" }],
  drop: [/^(position ?|order ?)?id$/, /^comment$/, /^label$/],
};

export const ninjatrader: FormatDef = {
  id: "ninjatrader",
  detect: (t) => {
    const s = score(t, [[4, [/^market pos\.?$/]], [1, [/^instrument$/]], [1, [/^entry time$/]], [1, [/^exit time$/]], [1, [/^profit$/]], [1, [/^mae$/]]]);
    return s >= 7 ? s + 2 : 0;
  },
  map: (t) => {
    const h = t.headers;
    return compact({
      id: col(h, [/^trade number$/, /^trade #$/]), symbol: col(h, [/^instrument$/]), side: col(h, [/^market pos\.?$/]), size: col(h, [/^qty$/, /^quantity$/]),
      entry: col(h, [/^entry price$/]), exit: col(h, [/^exit price$/]), openTime: col(h, [/^entry time$/]), closeTime: col(h, [/^exit time$/]),
      pnl: col(h, [/^profit$/]), commission: col(h, [/^commission$/]), equity: col(h, [/^cum\.? net profit$/]),
    });
  },
  build: (t, m) => {
    const r = reader(m, t);
    const df = dayFirstIn(t.rows, m.closeTime);
    const trades: Trade[] = [];
    const net = m.equity != null;
    const bad: Bad[] = [];
    t.rows.forEach((row, k) => {
      const closeTime = r.date(row, "closeTime", df);
      const profit = r.loose(row, "pnl");
      if (!closeTime || profit == null) { bad.push({ k, why: need([["exit time", r.cell(row, "closeTime"), "date", !closeTime], ["profit", r.cell(row, "pnl"), "number", profit == null]]) }); return; }
      const commission = Math.abs(r.loose(row, "commission") ?? 0);
      const pnl = net ? profit : profit - commission;
      trades.push({ id: r.text(row, "id"), closeTime, openTime: r.date(row, "openTime", df) ?? undefined, symbol: r.text(row, "symbol")?.toUpperCase(),
        side: sideOf(r.text(row, "side")), size: r.loose(row, "size") ?? undefined, entry: r.loose(row, "entry") ?? undefined,
        exit: r.loose(row, "exit") ?? undefined, fees: commission, pnl });
    });
    return { trades: trades.sort(byClose), warnings: skippedWarning(t, bad) };
  },
  fields: [...TRADE_FIELDS, { field: "commission", label: "Commission" }, { field: "equity", label: "Cum. net profit (then the profit already has commission off)" }, { field: "id", label: "Trade number" }],
};

const tradovateNote = (n: number) => (n ? ["Tradovate's performance report gives profit before commissions and exchange fees, so the checks see the profit before costs."] : []);

export const tradovate: FormatDef = {
  id: "tradovate",
  detect: (t) => {
    const s = score(t, [[3, [/^boughttimestamp$/]], [3, [/^soldtimestamp$/]], [1, [/^buyprice$/]], [1, [/^sellprice$/]], [1, [/^pnl$/]]]);
    return s >= 7 ? s + 2 : 0;
  },
  map: (t) => {
    const h = t.headers;
    return compact({
      symbol: col(h, [/^symbol$/]), size: col(h, [/^qty$/]), entry: col(h, [/^buyprice$/]), exit: col(h, [/^sellprice$/]),
      openTime: col(h, [/^boughttimestamp$/]), closeTime: col(h, [/^soldtimestamp$/]), pnl: col(h, [/^pnl$/]),
    });
  },
  build: (t, m) => paired(t, m),
  fields: [
    { field: "openTime", label: "Bought time", required: true }, { field: "closeTime", label: "Sold time", required: true }, { field: "pnl", label: "Profit", required: true },
    { field: "entry", label: "Buy price" }, { field: "exit", label: "Sell price" }, { field: "size", label: "Quantity" }, { field: "symbol", label: "Symbol" },
  ],
  drop: [/^(buy|sell) ?fill ?id$/],
};

/** Tradovate's paired round trips: bought first is a long trade, sold first a short one. */
function paired(t: Table, m: Parameters<FormatDef["build"]>[1]) {
  const r = reader(m, t);
  const df = dayFirstIn(t.rows, m.closeTime) || dayFirstIn(t.rows, m.openTime);
  const trades: Trade[] = [];
  const bad: Bad[] = [];
  t.rows.forEach((row, k) => {
    const bought = r.date(row, "openTime", df), sold = r.date(row, "closeTime", df);
    const pnl = r.loose(row, "pnl");
    if (!bought || !sold || pnl == null) { bad.push({ k, why: need([["bought time", r.cell(row, "openTime"), "date", !bought], ["sold time", r.cell(row, "closeTime"), "date", !sold], ["profit", r.cell(row, "pnl"), "number", pnl == null]]) }); return; }
    const long = bought <= sold;
    const buy = r.loose(row, "entry") ?? undefined, sell = r.loose(row, "exit") ?? undefined;
    trades.push({ openTime: long ? bought : sold, closeTime: long ? sold : bought, symbol: r.text(row, "symbol")?.toUpperCase(),
      side: long ? "buy" : "sell", size: r.loose(row, "size") ?? undefined, entry: long ? buy : sell, exit: long ? sell : buy, fees: 0, pnl });
  });
  return { trades: trades.sort(byClose), warnings: [...skippedWarning(t, bad), ...tradovateNote(trades.length)] };
}

export const tradovatePositions: FormatDef = {
  id: "tradovate_positions",
  detect: (t) => (score(t, [[3, [/^bought timestamp$/]], [3, [/^sold timestamp$/]], [2, [/^paired qty$/]], [1, [/^p\/l$/]]]) >= 8 ? 11 : 0),
  map: (t) => {
    const h = t.headers;
    return compact({
      symbol: col(h, [/^contract$/, /^product$/]), size: col(h, [/^paired qty$/]), entry: col(h, [/^buy price$/]), exit: col(h, [/^sell price$/]),
      openTime: col(h, [/^bought timestamp$/]), closeTime: col(h, [/^sold timestamp$/]), pnl: col(h, [/^p\/l$/]), currency: col(h, [/^currency$/]),
    });
  },
  build: (t, m) => paired(t, m),
  fields: [
    { field: "openTime", label: "Bought Timestamp", required: true }, { field: "closeTime", label: "Sold Timestamp", required: true }, { field: "pnl", label: "P/L", required: true },
    { field: "entry", label: "Buy Price" }, { field: "exit", label: "Sell Price" }, { field: "size", label: "Paired Qty" }, { field: "symbol", label: "Contract" },
  ],
  drop: [/^position ?id$/, /^pair ?id$/, /^(buy|sell) ?fill ?id$/],
};

export const tradovateOrders: FormatDef = {
  id: "tradovate_orders",
  detect: (t) => (score(t, [[3, [/^b\/s$/]], [2, [/^fill time$/]], [2, [/^avgprice$/, /^avg fill price$/]], [2, [/^filledqty$/, /^filled qty$/]], [1, [/^contract$/]]]) >= 9 ? 12 : 0),
  map: (t) => {
    const h = t.headers;
    return compact({
      closeTime: col(h, [/^fill time$/]) ?? col(h, [/^timestamp$/]), side: col(h, [/^b\/s$/]), symbol: col(h, [/^contract$/]),
      size: col(h, [/^filledqty$/, /^filled qty$/]), entry: col(h, [/^avgprice$/, /^avg fill price$/]), rowType: col(h, [/^status$/]),
    });
  },
  build: (t, m) => {
    const { fills, warnings } = readFills(t, m, {
      skip: (_r, text) => (/filled/i.test(text("rowType") ?? "filled") ? null : "they are orders that did not fill"),
      multiplier: (row) => (m.symbol == null ? null : pointValue(row[m.symbol] ?? "")),
    });
    const res = pairFills(fills, { allowShort: true });
    return { trades: res.trades, warnings: [...warnings, ...res.warnings, ...(res.trades.length ? ["Tradovate's order list has no commissions, so the checks see the profit before costs."] : [])] };
  },
  fields: [...FILL_FIELDS.filter((f) => !["value", "multiplier", "feeCurrency", "realized", "fees"].includes(f.field)), { field: "rowType", label: "Status (Filled)" }],
  drop: [/^order ?id$/, /^orderid$/, /^lastcommandid$/, /^version id$/, /^spreaddefinitionid$/],
};

export const myfxbook: FormatDef = {
  id: "myfxbook",
  detect: (t) => (score(t, [[3, [/^units\/lots$/]], [2, [/^open date$/]], [2, [/^close date$/]], [1, [/^pips$/]], [1, [/^gain$/]], [1, [/^action$/]]]) >= 9 ? 12 : 0),
  map: (t) => {
    const h = t.headers;
    return compact({
      openTime: col(h, [/^open date$/]), closeTime: col(h, [/^close date$/]), symbol: col(h, [/^symbol$/]), side: col(h, [/^action$/]), size: col(h, [/^units\/lots$/]),
      entry: col(h, [/^open price$/]), exit: col(h, [/^close price$/]), commission: col(h, [/^commission$/]), swap: col(h, [/^swap$/]), pnl: col(h, [/^profit$/]),
    });
  },
  build: (t, m) => {
    const r = reader(m, t);
    const df = dayFirstIn(t.rows, m.closeTime);
    const trades: Trade[] = [];
    const bad: Bad[] = [];
    let balance: number | undefined, cash = 0;
    t.rows.forEach((row, k) => {
      const action = (r.text(row, "side") ?? "").toLowerCase();
      if (/deposit|withdraw|credit|balance/.test(action)) {
        const v = r.loose(row, "pnl");
        if (/deposit/.test(action) && v != null && v > 0 && balance == null && !trades.length) balance = v;
        cash++;
        return;
      }
      const closeTime = r.date(row, "closeTime", df);
      const pnl = r.loose(row, "pnl");
      if (!closeTime || pnl == null) { bad.push({ k, why: need([["close date", r.cell(row, "closeTime"), "date", !closeTime], ["profit", r.cell(row, "pnl"), "number", pnl == null]]) }); return; }
      const costs = (r.loose(row, "commission") ?? 0) + (r.loose(row, "swap") ?? 0);
      trades.push({ closeTime, openTime: r.date(row, "openTime", df) ?? undefined, symbol: r.text(row, "symbol")?.toUpperCase(), side: sideOf(action),
        size: r.loose(row, "size") ?? undefined, entry: r.loose(row, "entry") ?? undefined, exit: r.loose(row, "exit") ?? undefined, fees: -costs, pnl });
    });
    const warnings = skippedWarning(t, bad);
    if (cash) warnings.push(`${cash} deposit or withdrawal row${cash === 1 ? " is" : "s are"} not trades and ${cash === 1 ? "was" : "were"} left out.`);
    return { trades: trades.sort(byClose), warnings, balance };
  },
  fields: [...TRADE_FIELDS.map((f) => (f.field === "pnl" ? { ...f, label: "Profit (after commission and swap)" } : f)), { field: "commission", label: "Commission" }, { field: "swap", label: "Swap" }],
  drop: [/^ticket$/, /^magic number$/, /^comment$/],
};
