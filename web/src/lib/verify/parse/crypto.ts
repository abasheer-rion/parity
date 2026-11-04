// Crypto exchanges. Which layouts were checked against a real export is in supported.ts and
// tests/fixtures/verify/real/SOURCES.md; the person can correct any column on the page.
//
//   Binance spot, Trade History: Date(UTC), Pair, Side, Price, Executed ("6023A2Z"),
//     Amount ("43.455945USDT"), Fee ("0.00049464BNB"): every cell quoted, units glued to the
//     numbers, and tickers may hold digits (A2Z, USD1), so the unit is peeled off by name.
//     The header says another zone when the person set one: Date(UTC+1). The older layout:
//     Date(UTC), Market, Type, Price, Amount, Total, Fee, Fee Coin. Fills; spot cannot be sold
//     short.
//   Binance futures (USDS-M), Trade History: Uid, Time(UTC), Symbol, Side, Position Side,
//     Price, Quantity, Amount, Fee ("-0.00026595 BNB", negative is a cost), Realized Profit
//     (before fees, "0E-8" for zero), Buyer, Maker, Trade Id, Order Id. Fills; shorts allowed.
//   Binance "Generate all statements": User_ID, UTC_Time, Account, Operation, Coin, Change,
//     Remark. One trade is several rows (what was spent, what was received, the fee) sharing
//     a time or a remark; they are put back together into fills.
//   Bybit, Trade History: Symbol or Spot Pairs or Contracts, Direction or Side, Filled
//     Price or Exec Price, Filled Quantity or Exec Qty, Filled Value, Fees or Exec Fee,
//     Timestamp (UTC) or Transaction Time(UTC+0). Fills.
//   Bybit, Closed P&L: Contracts, Closing Direction, Qty, Entry Price, Exit Price,
//     Closed P&L, Trade Time(UTC+0). Closed trades; the profit is taken as Bybit gives it.
//     Written from help pages; no real export with these columns was found (DEC-0088).
//   Bybit, closed positions (Unified Trading Account, what Bybit exports today): Market,
//     Quantity, Direction (Long or Short), avgEntryPrice, avgExitPrice, Realized P&L, Opening
//     Fee, Closing Fee, Funding Fee, two fee cells as JSON, Open Time, Open Duration, Close Time,
//     times written "08:02 2026-11-02" in UTC, zero sometimes "0E-8". Realized P&L is after
//     the opening, closing and funding fees: Bybit's help centre says so, and a real export's
//     columns add up that way. Layout copied from a real export we could see but not publish.
//   Coinbase fills (Coinbase Pro's fills.csv): portfolio, trade id, product (BTC-USD), side,
//     created at, size, size unit, price, fee, total, price/fee/total unit. Fills; spot.
//   Coinbase transaction report, what Coinbase gives today: a few lines of preamble, then
//     (ID,) Timestamp, Transaction Type, Asset, Quantity Transacted, (Spot) Price Currency,
//     (Spot) Price at Transaction, Subtotal, Total (inclusive of fees (and/or spread)), Fees
//     (and/or Spread), Notes. Buy, Sell and Advance(d) Trade rows are fills; a Convert is a
//     sale of one coin and a purchase of another at the same value. Sends, receives, rewards
//     and staking are not trades.
//   Kraken trades.csv: txid, ordertxid, pair (XXBTZUSD), time, type, ordertype, price,
//     cost, fee, vol, margin, misc, ledgers. Fills; shorts only on margin.
import { num } from "../csv";
import type { Table, Trade } from "../types";
import { col, compact, dayFirstIn, reader, skippedWarning, whyBad } from "./common";
import { pairFills, readFills, splitPair, type Fill } from "./fills";
import { FILL_FIELDS, score, TRADE_FIELDS, type BuildOut, type FormatDef } from "./format";

const IDS = [/^order ?(no\.?|number|id)$/, /^trade ?id$/, /^transaction ?id$/, /^exec ?id$/, /^txid$/, /^ordertxid$/, /^postx?txid$/, /^refid$/, /^ledgers$/, /^portfolio$/, /^trades$/, /^user ?id$/, /^uid$/];
const hasCol = (t: Table, p: RegExp[]) => col(t.headers, p) != null;
const fillsBuild = (allowShort: (t: Table) => boolean, symbol?: (s: string) => string) => (t: Table, m: Parameters<FormatDef["build"]>[1]): BuildOut => {
  const { fills, warnings } = readFills(t, m, { symbol });
  const res = pairFills(fills, { allowShort: allowShort(t) });
  return { trades: res.trades, warnings: [...warnings, ...res.warnings] };
};

const BINANCE_DATE = [/^(date|time) ?\(utc[^)]*\)$/];

/**
 * A Binance cell with its unit glued on: "6023A2Z" with the pair A2ZUSDT gives 6023 A2Z. The
 * unit is matched by name against the pair's two assets and BNB first, because a ticker can
 * hold digits; otherwise the trailing letters are taken.
 */
export function binanceAmount(cell: string | undefined, assets: string[]): { value: number | null; unit?: string } {
  const c = (cell ?? "").trim().replace(/\s+/g, "");
  if (!c) return { value: null };
  for (const a of assets) if (a && c.toUpperCase().endsWith(a) && c.length > a.length) { const v = num(c.slice(0, -a.length)); if (v != null) return { value: v, unit: a }; }
  const m = c.match(/^([-+]?[\d.,]+(?:e[-+]?\d+)?)([A-Za-z][A-Za-z0-9]*)?$/i);
  return m ? { value: num(m[1]), unit: m[2]?.toUpperCase() } : { value: num(c) };
}

/** Binance's old spot layout, with units glued to the numbers. */
function buildBinanceGlued(t: Table, m: Parameters<FormatDef["build"]>[1]): BuildOut {
  const r = reader(m, t);
  const fills: Fill[] = [];
  const bad: { k: number; why: string }[] = [];
  let otherFee = 0;
  const coins = new Set<string>();
  t.rows.forEach((row, k) => {
    const time = r.date(row, "closeTime");
    const sym = r.text(row, "symbol")?.toUpperCase();
    const pair = sym ? splitPair(sym) : null;
    const price = r.num(row, "entry");
    const assets = pair ? [pair.base, pair.quote, "BNB"] : ["BNB"];
    const qty = binanceAmount(r.cell(row, "size"), assets).value;
    if (!time || !sym || price == null || !(qty != null && qty > 0)) {
      bad.push({ k, why: whyBad([...(!time ? [["time", r.cell(row, "closeTime"), "date"]] : []), ...(!sym ? [["pair", "", "text"]] : []), ...(price == null ? [["price", r.cell(row, "entry"), "number"]] : []), ...(!(qty != null && qty > 0) ? [["quantity", r.cell(row, "size"), "number"]] : [])] as [string, string, "date" | "number" | "text"][]) });
      return;
    }
    const value = binanceAmount(r.cell(row, "value"), assets).value ?? qty * price;
    const f = binanceAmount(r.cell(row, "fees"), assets);
    let fee = Math.abs(f.value ?? 0);
    if (fee && f.unit && pair) {
      if (f.unit === pair.base) fee *= price;
      else if (f.unit !== pair.quote) { otherFee++; coins.add(f.unit); fee = 0; }
    }
    const side = (r.text(row, "side") ?? "").toLowerCase().startsWith("sell") ? "sell" : "buy";
    fills.push({ time, symbol: sym, side, qty, price, value: Math.abs(value), fee });
  });
  const res = pairFills(fills, { allowShort: false });
  const warnings = [...skippedWarning(t, bad)];
  if (otherFee) warnings.push(`${otherFee} fee${otherFee === 1 ? " was" : "s were"} paid in ${[...coins].join(" and ")}, which we cannot price, so ${otherFee === 1 ? "it is" : "they are"} not taken off the profit.`);
  return { trades: res.trades, warnings: [...warnings, ...res.warnings] };
}

export const binanceSpot: FormatDef = {
  id: "binance_spot",
  detect: (t) => {
    if (hasCol(t, [/^realized profit$/])) return 0;
    const s = score(t, [[3, BINANCE_DATE], [2, [/^pair$/, /^market$/]], [1, [/^price$/]], [1, [/^fee$/]], [2, [/^executed$/, /^total$/]]]);
    return s >= 8 ? s + 2 : 0;
  },
  map: (t) => {
    const h = t.headers;
    const executed = col(h, [/^executed$/]);
    return compact({
      closeTime: col(h, BINANCE_DATE), symbol: col(h, [/^pair$/, /^market$/]), side: col(h, [/^side$/, /^type$/]),
      entry: col(h, [/^price$/]), size: executed ?? col(h, [/^amount$/]), value: executed != null ? col(h, [/^amount$/]) : col(h, [/^total$/]),
      fees: col(h, [/^fee$/]), feeCurrency: col(h, [/^fee coin$/, /^fee asset$/]),
    });
  },
  // The layout with Executed glues units to the numbers; the one with Market and Fee Coin does not.
  build: (t, m) => (m.feeCurrency == null && hasCol(t, [/^executed$/]) ? buildBinanceGlued(t, m) : fillsBuild(() => false)(t, m)),
  fields: FILL_FIELDS,
  drop: IDS,
};

export const binanceFutures: FormatDef = {
  id: "binance_futures",
  detect: (t) => {
    const s = score(t, [[3, [...BINANCE_DATE, /^time$/]], [4, [/^realized profit$/]], [1, [/^symbol$/]], [1, [/^quantity$/, /^qty$/]]]);
    return s >= 8 ? s + 2 : 0;
  },
  map: (t) => {
    const h = t.headers;
    return compact({
      closeTime: col(h, [...BINANCE_DATE, /^time$/]), symbol: col(h, [/^symbol$/]), side: col(h, [/^side$/]), entry: col(h, [/^price$/]),
      size: col(h, [/^quantity$/, /^qty$/]), value: col(h, [/^amount$/, /^quote qty$/]), fees: col(h, [/^fee$/, /^commission$/]),
      feeCurrency: col(h, [/^fee coin$/, /^fee asset$/, /^commission asset$/]), realized: col(h, [/^realized profit$/]),
    });
  },
  // Realized Profit is before fees.
  build: fillsBuild(() => true),
  fields: FILL_FIELDS,
  drop: [...IDS, /^uid$/, /^buyer$/, /^maker$/],
};

const BYBIT_TIME = [/^timestamp ?\(utc/, /^transaction time/, /^trade time/, /^filled time/, /^exec time/, /^create(d)? time/, /^order time/];

export const bybitFills: FormatDef = {
  id: "bybit",
  detect: (t) => {
    if (hasCol(t, [/^closed p&l$/])) return 0;
    const s = score(t, [[3, [/^filled price$/, /^exec price$/, /^avg\. filled price$/]], [3, [/^filled (qty|quantity)$/, /^exec qty$/]], [1, [/^direction$/, /^side$/]], [1, BYBIT_TIME]]);
    return s >= 7 ? s + 2 : 0;
  },
  map: (t) => {
    const h = t.headers;
    return compact({
      closeTime: col(h, BYBIT_TIME), symbol: col(h, [/^spot pairs$/, /^symbol$/, /^contracts$/, /^market$/]), side: col(h, [/^direction$/, /^side$/]),
      entry: col(h, [/^filled price$/, /^exec price$/, /^avg\. filled price$/]), size: col(h, [/^filled (qty|quantity)$/, /^exec qty$/]),
      value: col(h, [/^filled value$/, /^exec value$/]), fees: col(h, [/^fees?$/, /^trading fee$/, /^exec fee$/]), feeCurrency: col(h, [/^fee (currency|coin)$/]),
    });
  },
  build: fillsBuild((t) => !hasCol(t, [/^spot pairs$/])),
  fields: FILL_FIELDS,
  drop: IDS,
};

export const bybitPnl: FormatDef = {
  id: "bybit_pnl",
  detect: (t) => {
    const s = score(t, [[4, [/^closed p&l$/, /^closed pnl$/]], [1, [/^closing direction$/, /^direction$/, /^side$/]], [1, [/^entry price$/]], [1, [/^exit price$/]], [1, [/^qty$/, /^quantity$/]]]);
    return s >= 7 ? s + 2 : 0;
  },
  map: (t) => {
    const h = t.headers;
    return compact({
      closeTime: col(h, BYBIT_TIME), symbol: col(h, [/^contracts$/, /^symbol$/, /^market$/]), side: col(h, [/^closing direction$/, /^direction$/, /^side$/]),
      size: col(h, [/^qty$/, /^quantity$/]), entry: col(h, [/^entry price$/]), exit: col(h, [/^exit price$/]), pnl: col(h, [/^closed p&l$/, /^closed pnl$/]),
    });
  },
  build: (t, m) => {
    const r = reader(m);
    const df = dayFirstIn(t.rows, m.closeTime);
    let skipped = 0;
    const trades: Trade[] = [];
    for (const row of t.rows) {
      const closeTime = r.date(row, "closeTime", df);
      const pnl = r.loose(row, "pnl");
      if (!closeTime || pnl == null) { skipped++; continue; }
      // The direction of the closing order: a sell closes a long position.
      const d = (r.text(row, "side") ?? "").toLowerCase();
      const side: "buy" | "sell" | undefined = /close long|^sell/.test(d) ? "buy" : /close short|^buy/.test(d) ? "sell" : undefined;
      trades.push({ closeTime, symbol: r.text(row, "symbol")?.toUpperCase(), side, size: r.loose(row, "size") ?? undefined,
        entry: r.loose(row, "entry") ?? undefined, exit: r.loose(row, "exit") ?? undefined, fees: 0, pnl });
    }
    trades.sort((a, b) => (a.closeTime < b.closeTime ? -1 : a.closeTime > b.closeTime ? 1 : 0));
    return { trades, warnings: skipped ? [`${skipped} row${skipped === 1 ? " had" : "s had"} no readable time or profit and ${skipped === 1 ? "was" : "were"} skipped.`] : [] };
  },
  fields: TRADE_FIELDS,
  drop: IDS,
};

export const bybitClosed: FormatDef = {
  id: "bybit_closed",
  detect: (t) => {
    const s = score(t, [[4, [/^realized p&l$/, /^realized pnl$/]], [2, [/^avgentryprice$/, /^avg\.? entry price$/]], [2, [/^avgexitprice$/, /^avg\.? exit price$/]], [1, [/^opening fee$/]], [1, [/^closing fee$/]], [1, [/^close time/]]]);
    return s >= 9 ? s + 2 : 0;
  },
  map: (t) => {
    const h = t.headers;
    return compact({
      closeTime: col(h, [/^close time/]), openTime: col(h, [/^open time/]), symbol: col(h, [/^market$/, /^contracts?$/, /^symbol$/]),
      side: col(h, [/^direction$/]), size: col(h, [/^quantity$/, /^qty$/]), entry: col(h, [/^avgentryprice$/, /^avg\.? entry price$/]),
      exit: col(h, [/^avgexitprice$/, /^avg\.? exit price$/]), pnl: col(h, [/^realized p&l$/, /^realized pnl$/]),
    });
  },
  build: (t, m) => {
    const r = reader(m, t);
    const fees = [/^opening fee$/, /^closing fee$/, /^funding fee$/].map((re) => col(t.headers, [re]));
    const skipped: { k: number; why: string }[] = [];
    const trades: Trade[] = [];
    t.rows.forEach((row, k) => {
      const closeTime = r.date(row, "closeTime");
      const pnl = r.loose(row, "pnl");
      if (!closeTime || pnl == null) {
        skipped.push({ k, why: whyBad([...(!closeTime ? [["close time", r.cell(row, "closeTime"), "date"] as [string, string, "date"]] : []), ...(pnl == null ? [["realized profit", r.cell(row, "pnl"), "number"] as [string, string, "number"]] : [])]) });
        return;
      }
      // Direction is the position's: Long was bought first, Short was sold first.
      const d = (r.text(row, "side") ?? "").toLowerCase();
      const side: "buy" | "sell" | undefined = d.startsWith("long") ? "buy" : d.startsWith("short") ? "sell" : undefined;
      const cost = fees.reduce<number>((sum, i) => sum + (i == null ? 0 : num(row[i]) ?? 0), 0);
      trades.push({ openTime: r.date(row, "openTime") ?? undefined, closeTime, symbol: r.text(row, "symbol")?.toUpperCase(), side, size: r.loose(row, "size") ?? undefined,
        entry: r.loose(row, "entry") ?? undefined, exit: r.loose(row, "exit") ?? undefined, fees: Math.round(cost * 1e8) / 1e8, pnl });
    });
    trades.sort((a, b) => (a.closeTime < b.closeTime ? -1 : a.closeTime > b.closeTime ? 1 : 0));
    return { trades, warnings: skippedWarning(t, skipped), notes: ["Bybit writes these times in UTC. The realized profit is used as Bybit gives it, after opening, closing and funding fees."] };
  },
  fields: TRADE_FIELDS,
  drop: IDS,
};

export const coinbase: FormatDef = {
  id: "coinbase",
  detect: (t) => {
    const s = score(t, [[2, [/^product$/]], [2, [/^created at$/]], [1, [/^size$/]], [2, [/^size unit$/, /^price\/fee\/total unit$/]], [1, [/^fee$/]], [1, [/^side$/]]]);
    return s >= 7 ? s + 2 : 0;
  },
  map: (t) => {
    const h = t.headers;
    return compact({
      closeTime: col(h, [/^created at$/]), symbol: col(h, [/^product$/]), side: col(h, [/^side$/]), size: col(h, [/^size$/]),
      entry: col(h, [/^price$/]), fees: col(h, [/^fee$/]),
    });
  },
  build: fillsBuild(() => false),
  fields: FILL_FIELDS,
  drop: IDS,
};

/** Kraken's pair names: XXBTZUSD to XBTUSD, XETHZEUR to ETHEUR, XBT/USD to XBTUSD. */
export function krakenPair(s: string): string {
  const v = s.toUpperCase().replace(/[/\s]/g, "");
  const m = v.match(/^X([A-Z]{3})Z([A-Z]{3})$/);
  return m ? `${m[1]}${m[2]}` : v;
}

export const kraken: FormatDef = {
  id: "kraken",
  detect: (t) => {
    const s = score(t, [[3, [/^ordertxid$/]], [1, [/^pair$/]], [2, [/^vol$/]], [1, [/^cost$/]], [1, [/^ordertype$/]], [1, [/^ledgers$/]]]);
    return s >= 7 ? s + 2 : 0;
  },
  map: (t) => {
    const h = t.headers;
    return compact({
      closeTime: col(h, [/^time$/]), symbol: col(h, [/^pair$/]), side: col(h, [/^type$/]), entry: col(h, [/^price$/]),
      size: col(h, [/^vol$/]), value: col(h, [/^cost$/]), fees: col(h, [/^fee$/]),
    });
  },
  // A sale with nothing open is a short only on margin.
  build: fillsBuild((t) => { const i = col(t.headers, [/^margin$/]); return i != null && t.rows.some((r) => Math.abs(Number(r[i])) > 0); }, krakenPair),
  fields: FILL_FIELDS,
  drop: IDS,
};

// ---------------------------------------------------------------- Binance statements

/** Coins a trade is priced in. In a statement row group, the one of these is the money side. */
const MONEY = ["USD", "EUR", "GBP", "TRY", "BRL", "AUD", "CAD", "CHF", "JPY", "PLN", "RON", "UAH", "NGN", "ZAR", "USDT", "USDC", "BUSD", "FDUSD", "TUSD", "DAI", "USD1"];
const STATEMENT_TRADE = /^(transaction related|transaction (buy|spend|sold|revenue|fee)|buy|sell|fee|buy crypto with (card|fiat)|binance convert|large otc trading|small assets exchange bnb)$/i;

export const binanceStatement: FormatDef = {
  id: "binance_statement",
  detect: (t) => (score(t, [[3, [/^utc[ _]time$/]], [3, [/^operation$/]], [2, [/^coin$/]], [2, [/^change$/]]]) >= 9 ? 12 : 0),
  map: (t) => {
    const h = t.headers;
    return compact({ closeTime: col(h, [/^utc[ _]time$/]), rowType: col(h, [/^operation$/]), symbol: col(h, [/^coin$/]), size: col(h, [/^change$/]), id: col(h, [/^remark$/]), assetType: col(h, [/^account$/]) });
  },
  build: (t, m) => {
    const r = reader(m, t);
    // Rows of one trade share a remark, or else a time.
    const groups = new Map<string, { time: string; k: number; parts: { coin: string; change: number; op: string }[] }>();
    const bad: { k: number; why: string }[] = [];
    let notTrades = 0;
    t.rows.forEach((row, k) => {
      const op = r.text(row, "rowType") ?? "";
      if (!STATEMENT_TRADE.test(op)) { notTrades++; return; }
      const time = r.date(row, "closeTime");
      const coin = r.text(row, "symbol")?.toUpperCase();
      const change = r.num(row, "size");
      if (!time || !coin || change == null) { bad.push({ k, why: whyBad([...(!time ? [["time", r.cell(row, "closeTime"), "date"]] : []), ...(!coin ? [["coin", "", "text"]] : []), ...(change == null ? [["change", r.cell(row, "size"), "number"]] : [])] as [string, string, "date" | "number" | "text"][]) }); return; }
      const remark = r.text(row, "id");
      const key = remark && remark.length > 6 ? `r:${remark}` : `t:${time}`;
      const g = groups.get(key) ?? { time, k, parts: [] };
      g.parts.push({ coin, change, op });
      groups.set(key, g);
    });
    const fills: Fill[] = [];
    let unpaired = 0;
    for (const g of groups.values()) {
      const fees = g.parts.filter((p) => /fee/i.test(p.op));
      const legs = g.parts.filter((p) => !/fee/i.test(p.op));
      const got = new Map<string, number>();
      for (const p of legs) got.set(p.coin, (got.get(p.coin) ?? 0) + p.change);
      const plus = [...got].filter(([, v]) => v > 0), minus = [...got].filter(([, v]) => v < 0);
      if (plus.length !== 1 || minus.length !== 1) { unpaired++; continue; }
      const [[inCoin, inAmt]] = plus, [[outCoin, outAmt]] = minus;
      const buy = MONEY.includes(outCoin) && !MONEY.includes(inCoin);
      const sell = MONEY.includes(inCoin) && !MONEY.includes(outCoin);
      if (!buy && !sell) { unpaired++; continue; }
      const coin = buy ? inCoin : outCoin, money = buy ? outCoin : inCoin;
      const qty = Math.abs(buy ? inAmt : outAmt), value = Math.abs(buy ? outAmt : inAmt);
      const price = value / qty;
      let fee = 0;
      for (const f of fees) fee += f.coin === money ? Math.abs(f.change) : f.coin === coin ? Math.abs(f.change) * price : 0;
      fills.push({ time: g.time, symbol: `${coin}${money}`, side: buy ? "buy" : "sell", qty, price, value, fee });
    }
    const res = pairFills(fills, { allowShort: false });
    const warnings = [...skippedWarning(t, bad)];
    if (notTrades) warnings.push(`${notTrades} row${notTrades === 1 ? " is" : "s are"} deposits, withdrawals, interest or transfers, not trades, and ${notTrades === 1 ? "was" : "were"} left out.`);
    if (unpaired) warnings.push(`${unpaired} trade${unpaired === 1 ? "" : "s"} could not be put back together from the statement (more than two coins at one time, or coin for coin) and ${unpaired === 1 ? "was" : "were"} left out.`);
    return { trades: res.trades, warnings: [...warnings, ...res.warnings] };
  },
  fields: [
    { field: "closeTime", label: "UTC_Time", required: true }, { field: "rowType", label: "Operation", required: true }, { field: "symbol", label: "Coin", required: true },
    { field: "size", label: "Change", required: true }, { field: "id", label: "Remark" },
  ],
  drop: [/^user ?_?id$/, /^account$/],
};

// ---------------------------------------------------------------- Coinbase transaction report

export const coinbaseReport: FormatDef = {
  id: "coinbase_tx",
  detect: (t) => (score(t, [[3, [/^transaction type$/]], [3, [/^quantity transacted$/]], [2, [/^(spot )?price at transaction$/]], [1, [/^subtotal$/]], [1, [/^timestamp$/]]]) >= 9 ? 12 : 0),
  map: (t) => {
    const h = t.headers;
    return compact({
      closeTime: col(h, [/^timestamp$/]), rowType: col(h, [/^transaction type$/]), symbol: col(h, [/^asset$/]), size: col(h, [/^quantity transacted$/]),
      currency: col(h, [/^(spot )?price currency$/]), entry: col(h, [/^(spot )?price at transaction$/]), value: col(h, [/^subtotal$/]),
      fees: col(h, [/^fees( and\/or spread)?$/]), id: col(h, [/^notes$/]),
    });
  },
  build: (t, m) => {
    const r = reader(m, t);
    const fills: Fill[] = [];
    const bad: { k: number; why: string }[] = [];
    const other = new Map<string, number>();
    t.rows.forEach((row, k) => {
      const type = (r.text(row, "rowType") ?? "").toLowerCase();
      const isTrade = /^(buy|sell|advanced? trade (buy|sell)|convert)$/.test(type);
      if (!isTrade) { if (type) other.set(type, (other.get(type) ?? 0) + 1); return; }
      const time = r.date(row, "closeTime");
      const coin = r.text(row, "symbol")?.toUpperCase();
      const qty = r.loose(row, "size"), price = r.loose(row, "entry");
      const money = (r.text(row, "currency") ?? "USD").toUpperCase();
      if (!time || !coin || qty == null || qty === 0 || price == null) {
        bad.push({ k, why: whyBad([...(!time ? [["time", r.cell(row, "closeTime"), "date"]] : []), ...(qty == null || qty === 0 ? [["quantity", r.cell(row, "size"), "number"]] : []), ...(price == null ? [["price", r.cell(row, "entry"), "number"]] : [])] as [string, string, "date" | "number" | "text"][]) });
        return;
      }
      const value = Math.abs(r.loose(row, "value") ?? qty * price);
      const fee = Math.max(0, r.loose(row, "fees") ?? 0);
      if (type === "convert") {
        // "Converted 0.0005 BTC to 0.0126 ETH": a sale of one coin and a purchase of the other, at the same value.
        fills.push({ time, symbol: `${coin}-${money}`, side: "sell", qty: Math.abs(qty), price, value, fee });
        const to = (r.text(row, "id") ?? "").match(/to\s+([\d.,]+)\s+([A-Za-z0-9]+)/i);
        const toQty = to ? num(to[1]) : null;
        if (to && toQty) fills.push({ time, symbol: `${to[2].toUpperCase()}-${money}`, side: "buy", qty: toQty, price: value / toQty, value, fee: 0 });
        return;
      }
      fills.push({ time, symbol: `${coin}-${money}`, side: /sell/.test(type) ? "sell" : "buy", qty: Math.abs(qty), price, value, fee });
    });
    const res = pairFills(fills, { allowShort: false });
    const warnings = [...skippedWarning(t, bad)];
    if (other.size) {
      const n = [...other.values()].reduce((a, b) => a + b, 0);
      warnings.push(`${n} row${n === 1 ? " is" : "s are"} not trades (${[...other.keys()].join(", ")}) and ${n === 1 ? "was" : "were"} left out.`);
    }
    return { trades: res.trades, warnings: [...warnings, ...res.warnings] };
  },
  fields: [
    { field: "closeTime", label: "Timestamp", required: true }, { field: "rowType", label: "Transaction Type", required: true }, { field: "symbol", label: "Asset", required: true },
    { field: "size", label: "Quantity Transacted", required: true }, { field: "entry", label: "Price at Transaction", required: true }, { field: "value", label: "Subtotal" },
    { field: "fees", label: "Fees" }, { field: "currency", label: "Price Currency" }, { field: "id", label: "Notes" },
  ],
  drop: [/^id$/],
};

