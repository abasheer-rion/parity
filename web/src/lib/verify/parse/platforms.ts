// Trading platforms whose exports list closed trades, one row each. Each is an unverified
// layout: written from the platforms' help pages and journal apps' import guides, not
// checked against an official export file. The person can correct any column on the page.
//
//   cTrader, History tab: ID or Position ID, Symbol, Opening Direction, Opening Time,
//     Closing Time, Entry Price, Closing Price, Closing Quantity ("0.10 Lots"),
//     Commission(s), Swap, Gross USD, Net USD, Balance USD. Net already has commission and
//     swap taken off; without a net column, profit is gross plus commission and swap.
//   NinjaTrader 8, Trade Performance, Trades grid: Trade number, Instrument, Account,
//     Strategy, Market pos., Qty, Entry price, Exit price, Entry time, Exit time, Entry name,
//     Exit name, Profit, Cum. net profit, Commission, MAE, MFE, ETD, Bars. When the file has a
//     "Cum. net profit" column, Profit is taken as already net of commission; otherwise the
//     Commission column is taken off it.
//   Tradovate, Performance report: symbol, _priceFormat, _priceFormatType, _tickSize,
//     buyFillId, sellFillId, qty, buyPrice, sellPrice, pnl ("$(25.00)"), boughtTimestamp,
//     soldTimestamp, duration. Its pnl is before commissions and fees.
import type { Trade } from "../types";
import { col, compact, dayFirstIn, reader, sideOf } from "./common";
import { score, TRADE_FIELDS, type FormatDef } from "./format";

const byClose = (a: Trade, b: Trade) => (a.closeTime < b.closeTime ? -1 : a.closeTime > b.closeTime ? 1 : 0);
const skippedNote = (n: number) => (n ? [`${n} row${n === 1 ? " had" : "s had"} no readable close time or profit and ${n === 1 ? "was" : "were"} skipped.`] : []);

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
    });
  },
  build: (t, m) => {
    const r = reader(m);
    const df = dayFirstIn(t.rows, m.closeTime);
    const trades: Trade[] = [];
    let skipped = 0;
    for (const row of t.rows) {
      const closeTime = r.date(row, "closeTime", df);
      const costs = (r.loose(row, "commission") ?? 0) + (r.loose(row, "swap") ?? 0);
      const net = r.loose(row, "pnl");
      const gross = r.loose(row, "equity");
      const pnl = net ?? (gross != null ? gross + costs : null);
      if (!closeTime || pnl == null) { skipped++; continue; }
      trades.push({ closeTime, openTime: r.date(row, "openTime", df) ?? undefined, symbol: r.text(row, "symbol")?.toUpperCase(),
        side: sideOf(r.text(row, "side")), size: r.loose(row, "size") ?? undefined, entry: r.loose(row, "entry") ?? undefined,
        exit: r.loose(row, "exit") ?? undefined, fees: gross != null && net != null ? gross - net : -costs, pnl });
    }
    return { trades: trades.sort(byClose), warnings: skippedNote(skipped) };
  },
  fields: [...TRADE_FIELDS.map((f) => (f.field === "pnl" ? { ...f, label: "Net profit", required: false } : f)),
    { field: "equity", label: "Gross profit" }, { field: "commission", label: "Commission" }, { field: "swap", label: "Swap" }],
  drop: [/^(position ?)?id$/, /^order ?id$/, /^comment$/],
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
    const r = reader(m);
    const df = dayFirstIn(t.rows, m.closeTime);
    const trades: Trade[] = [];
    const net = m.equity != null;
    let skipped = 0;
    for (const row of t.rows) {
      const closeTime = r.date(row, "closeTime", df);
      const profit = r.loose(row, "pnl");
      if (!closeTime || profit == null) { skipped++; continue; }
      const commission = Math.abs(r.loose(row, "commission") ?? 0);
      const pnl = net ? profit : profit - commission;
      trades.push({ id: r.text(row, "id"), closeTime, openTime: r.date(row, "openTime", df) ?? undefined, symbol: r.text(row, "symbol")?.toUpperCase(),
        side: sideOf(r.text(row, "side")), size: r.loose(row, "size") ?? undefined, entry: r.loose(row, "entry") ?? undefined,
        exit: r.loose(row, "exit") ?? undefined, fees: commission, pnl });
    }
    return { trades: trades.sort(byClose), warnings: skippedNote(skipped) };
  },
  fields: [...TRADE_FIELDS, { field: "commission", label: "Commission" }, { field: "equity", label: "Cum. net profit (then the profit already has commission off)" }, { field: "id", label: "Trade number" }],
};

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
  build: (t, m) => {
    const r = reader(m);
    const df = dayFirstIn(t.rows, m.closeTime) || dayFirstIn(t.rows, m.openTime);
    const trades: Trade[] = [];
    let skipped = 0;
    for (const row of t.rows) {
      const bought = r.date(row, "openTime", df), sold = r.date(row, "closeTime", df);
      const pnl = r.loose(row, "pnl");
      if (!bought || !sold || pnl == null) { skipped++; continue; }
      // Bought first is a long trade; sold first is a short one.
      const long = bought <= sold;
      const buy = r.loose(row, "entry") ?? undefined, sell = r.loose(row, "exit") ?? undefined;
      trades.push({ openTime: long ? bought : sold, closeTime: long ? sold : bought, symbol: r.text(row, "symbol")?.toUpperCase(),
        side: long ? "buy" : "sell", size: r.loose(row, "size") ?? undefined, entry: long ? buy : sell, exit: long ? sell : buy, fees: 0, pnl });
    }
    const warnings = [...skippedNote(skipped)];
    if (trades.length) warnings.push("Tradovate's performance report gives profit before commissions and exchange fees, so the checks see the profit before costs.");
    return { trades: trades.sort(byClose), warnings };
  },
  fields: [
    { field: "openTime", label: "Bought time", required: true }, { field: "closeTime", label: "Sold time", required: true }, { field: "pnl", label: "Profit", required: true },
    { field: "entry", label: "Buy price" }, { field: "exit", label: "Sell price" }, { field: "size", label: "Quantity" }, { field: "symbol", label: "Symbol" },
  ],
  drop: [/^(buy|sell) ?fill ?id$/],
};
