// US stock brokers that list fills. Checked against real exports (supported.ts):
//
//   thinkorswim (Schwab), Account Statement, "Account Trade History" section (sections.ts):
//     (blank), Exec Time ("7/1/26 07:53:29"), Spread, Side, Qty ("+100", "-2"), Pos Effect,
//     Symbol, Exp, Strike, Type (STOCK, ETF, CALL, PUT, FUTURE), Price, Net Price, Order Type.
//     The later legs of a spread leave the time blank and take the one above. Options count
//     100 shares a contract; futures ("/ESM19") use the contract size from futures.ts, and an
//     unknown contract is left out. Fees are listed in the statement's cash section, not with
//     the trades, so they are not taken off.
//   Alpaca, account activities, as the API returns them (a JSON list, or the same fields as a
//     CSV): id, activity_type, transaction_time ("2022-03-04T18:54:20.903569Z"), type (fill,
//     partial_fill), price, qty, side (buy, sell, sell_short), symbol, leaves_qty, order_id,
//     cum_qty, order_status. Only FILL rows are trades. Alpaca charges no commission;
//     regulatory fees are separate FEE activities and are not taken off.
import { col, compact } from "./common";
import { pairFills, readFills } from "./fills";
import { FILL_FIELDS, score, type FormatDef } from "./format";
import { pointValue } from "./futures";

export const thinkorswim: FormatDef = {
  id: "tos",
  detect: (t) => {
    const s = score(t, [[3, [/^exec time$/]], [3, [/^pos effect$/]], [1, [/^net price$/]], [1, [/^side$/]], [1, [/^spread$/]]]);
    return s >= 7 ? s + 2 : 0;
  },
  map: (t) => {
    const h = t.headers;
    return compact({
      closeTime: col(h, [/^exec time$/]), side: col(h, [/^side$/]), size: col(h, [/^qty$/]), symbol: col(h, [/^symbol$/]),
      expiry: col(h, [/^exp$/]), strike: col(h, [/^strike$/]), assetType: col(h, [/^type$/]), entry: col(h, [/^price$/]),
    });
  },
  build: (t, m) => {
    const sym = (row: string[]) => (m.symbol == null ? "" : row[m.symbol] ?? "");
    const { fills, warnings } = readFills(t, m, {
      inheritTime: true,
      skip: (row, text) => (/^FUTURE/i.test(text("assetType") ?? "") && pointValue(sym(row)) == null ? "they are futures whose contract size we do not know" : null),
      multiplier: (row, text) => { const k = (text("assetType") ?? "").toUpperCase(); return k === "CALL" || k === "PUT" ? 100 : k.startsWith("FUTURE") ? pointValue(sym(row)) : 1; },
      fullSymbol: (_r, text) => {
        const s = text("symbol");
        const type = (text("assetType") ?? "").toUpperCase();
        return s && (type === "CALL" || type === "PUT") ? `${s} ${text("expiry") ?? ""} ${text("strike") ?? ""} ${type}`.replace(/\s+/g, " ") : s?.replace(/^\//, "");
      },
    });
    const res = pairFills(fills, { allowShort: true });
    const out = [...warnings, ...res.warnings];
    if (res.trades.length) out.push("thinkorswim lists fees apart from the trades, so they are not taken off the profit.");
    return { trades: res.trades, warnings: out };
  },
  fields: [...FILL_FIELDS.filter((f) => f.field !== "multiplier" && f.field !== "value"), { field: "assetType", label: "Type (STOCK, CALL, PUT)" }, { field: "expiry", label: "Expiry" }, { field: "strike", label: "Strike" }],
};

export const alpaca: FormatDef = {
  id: "alpaca",
  detect: (t) => {
    const s = score(t, [[3, [/^activity type$/]], [3, [/^transaction time$/]], [1, [/^qty$/]], [1, [/^price$/]], [1, [/^side$/]]]);
    return s >= 7 ? s + 2 : 0;
  },
  map: (t) => {
    const h = t.headers;
    return compact({
      rowType: col(h, [/^activity type$/]), closeTime: col(h, [/^transaction time$/]), symbol: col(h, [/^symbol$/]), side: col(h, [/^side$/]),
      size: col(h, [/^qty$/]), entry: col(h, [/^price$/]),
    });
  },
  build: (t, m) => {
    const { fills, warnings } = readFills(t, m, {
      skip: (_r, text) => { const k = (text("rowType") ?? "").toUpperCase(); return k && k !== "FILL" ? "they are not fills (fees, dividends, transfers)" : null; },
    });
    const res = pairFills(fills, { allowShort: true });
    return { trades: res.trades, warnings: [...warnings, ...res.warnings] };
  },
  fields: [...FILL_FIELDS.filter((f) => !["multiplier", "value", "feeCurrency", "realized"].includes(f.field)), { field: "rowType", label: "Activity type (FILL)" }],
  drop: [/^id$/, /^order ?id$/, /^client ?order ?id$/],
};
