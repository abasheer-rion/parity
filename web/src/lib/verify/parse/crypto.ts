// Crypto exchanges. Each layout below is an unverified layout: written from the exchanges'
// help pages and journal apps' import guides, not checked against an official export file.
// The person can correct any column on the page.
//
//   Binance spot, Trade History: Date(UTC), Pair, Side, Price, Executed ("0.01BTC"),
//     Amount ("420.5USDT"), Fee ("0.00001BTC"); newer files: Date(UTC), Market, Type,
//     Price, Amount, Total, Fee, Fee Coin. Fills; spot cannot be sold short.
//   Binance futures (USDS-M), Trade History: Date(UTC), Symbol, Side, Price, Quantity,
//     Amount, Fee, Realized Profit. Fills; shorts allowed.
//   Bybit, Trade History: Symbol or Spot Pairs or Contracts, Direction or Side, Filled
//     Price or Exec Price, Filled Quantity or Exec Qty, Filled Value, Fees or Exec Fee,
//     Timestamp (UTC) or Transaction Time(UTC+0). Fills.
//   Bybit, Closed P&L: Contracts, Closing Direction, Qty, Entry Price, Exit Price,
//     Closed P&L, Trade Time(UTC+0). Closed trades; the profit is taken as Bybit gives it.
//   Coinbase fills (Advanced Trade, and Coinbase Pro's fills.csv): portfolio, trade id,
//     product (BTC-USD), side, created at, size, size unit, price, fee, total,
//     price/fee/total unit. Fills; spot.
//   Kraken trades.csv: txid, ordertxid, pair (XXBTZUSD), time, type, ordertype, price,
//     cost, fee, vol, margin, misc, ledgers. Fills; shorts only on margin.
import type { Table, Trade } from "../types";
import { col, compact, dayFirstIn, reader } from "./common";
import { pairFills, readFills } from "./fills";
import { FILL_FIELDS, score, TRADE_FIELDS, type BuildOut, type FormatDef } from "./format";

const IDS = [/^order ?(no\.?|number|id)$/, /^trade ?id$/, /^transaction ?id$/, /^exec ?id$/, /^txid$/, /^ordertxid$/, /^postxid$/, /^ledgers$/, /^portfolio$/, /^trades$/, /^user ?id$/, /^uid$/];
const hasCol = (t: Table, p: RegExp[]) => col(t.headers, p) != null;
const fillsBuild = (allowShort: (t: Table) => boolean, symbol?: (s: string) => string) => (t: Table, m: Parameters<FormatDef["build"]>[1]): BuildOut => {
  const { fills, warnings } = readFills(t, m, { symbol });
  const res = pairFills(fills, { allowShort: allowShort(t) });
  return { trades: res.trades, warnings: [...warnings, ...res.warnings] };
};

export const binanceSpot: FormatDef = {
  id: "binance_spot",
  detect: (t) => {
    if (hasCol(t, [/^realized profit$/])) return 0;
    const s = score(t, [[3, [/^date\(utc\)$/, /^date \(utc\)$/]], [2, [/^pair$/, /^market$/]], [1, [/^price$/]], [1, [/^fee$/]], [2, [/^executed$/, /^total$/]]]);
    return s >= 8 ? s + 2 : 0;
  },
  map: (t) => {
    const h = t.headers;
    const executed = col(h, [/^executed$/]);
    return compact({
      closeTime: col(h, [/^date ?\(utc\)$/]), symbol: col(h, [/^pair$/, /^market$/]), side: col(h, [/^side$/, /^type$/]),
      entry: col(h, [/^price$/]), size: executed ?? col(h, [/^amount$/]), value: executed != null ? col(h, [/^amount$/]) : col(h, [/^total$/]),
      fees: col(h, [/^fee$/]), feeCurrency: col(h, [/^fee coin$/, /^fee asset$/]),
    });
  },
  build: fillsBuild(() => false),
  fields: FILL_FIELDS,
  drop: IDS,
};

export const binanceFutures: FormatDef = {
  id: "binance_futures",
  detect: (t) => {
    const s = score(t, [[3, [/^date ?\(utc\)$/, /^time$/]], [4, [/^realized profit$/]], [1, [/^symbol$/]], [1, [/^quantity$/, /^qty$/]]]);
    return s >= 8 ? s + 2 : 0;
  },
  map: (t) => {
    const h = t.headers;
    return compact({
      closeTime: col(h, [/^date ?\(utc\)$/, /^time$/]), symbol: col(h, [/^symbol$/]), side: col(h, [/^side$/]), entry: col(h, [/^price$/]),
      size: col(h, [/^quantity$/, /^qty$/]), value: col(h, [/^amount$/, /^quote qty$/]), fees: col(h, [/^fee$/, /^commission$/]),
      feeCurrency: col(h, [/^fee coin$/, /^fee asset$/, /^commission asset$/]), realized: col(h, [/^realized profit$/]),
    });
  },
  build: fillsBuild(() => true),
  fields: FILL_FIELDS,
  drop: IDS,
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
