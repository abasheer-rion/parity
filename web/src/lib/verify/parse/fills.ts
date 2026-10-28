// Exports that list fills (one row per execution) instead of closed trades: Interactive
// Brokers, Binance, Bybit, Coinbase, Kraken, thinkorswim and Alpaca. Fills are paired into
// round trips first in, first out, per symbol: a fill against the open position closes the
// oldest open quantity first, and each closing fill is one trade (a partial close is its own
// trade, as for MetaTrader deals). Fees are costs: an opening fill's fee is shared out over
// the quantity it opened and charged to the trades that close it. Runs in the browser only.
import type { Mapping, Table, Trade } from "../types";
import { dayFirstIn, reader, sideOf, unitOf } from "./common";

export interface Fill {
  time: string;
  symbol: string;
  side: "buy" | "sell";
  /** Quantity, always positive. */
  qty: number;
  /** Price per unit as the file writes it (for display). */
  price: number;
  /** What the quantity is worth in money: qty x price x contract multiplier, positive. */
  value: number;
  /** Fee as a cost in the account's money, positive. */
  fee: number;
  /** The exchange's own realized profit for this fill, when the file has one. */
  realized?: number | null;
}

export interface PairOptions {
  /** Spot markets cannot be sold short: a sell with nothing open closes a position bought before the file starts. */
  allowShort: boolean;
}

interface Lot { time: string; qty: number; unit: number; price: number; feeUnit: number; dir: 1 | -1 }

const EPS = 1e-9;

/** Pairs fills into round-trip trades. Returns the trades in time order and warnings in words. */
export function pairFills(fills: readonly Fill[], opt: PairOptions): { trades: Trade[]; warnings: string[] } {
  const sorted = [...fills].sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));
  const book = new Map<string, Lot[]>();
  const trades: Trade[] = [];
  let unmatched = 0, fromRealized = 0;
  for (const f of sorted) {
    if (!(f.qty > 0) || !Number.isFinite(f.value)) continue;
    const lots = book.get(f.symbol) ?? [];
    book.set(f.symbol, lots);
    const dir: 1 | -1 = f.side === "buy" ? 1 : -1;
    const unit = f.value / f.qty;
    const feeUnit = f.fee / f.qty;
    let left = f.qty;
    if (lots.length && lots[0].dir !== dir) {
      const lotDir = lots[0].dir;
      const first = lots[0];
      let matched = 0, openValue = 0, openPrice = 0, openFee = 0;
      while (left > EPS && lots.length) {
        const o = lots[0];
        const take = Math.min(o.qty, left);
        matched += take; openValue += take * o.unit; openPrice += take * o.price; openFee += take * o.feeUnit;
        o.qty -= take; left -= take;
        if (o.qty <= EPS * Math.max(1, take)) lots.shift();
      }
      const gross = (unit * matched - openValue) * lotDir;
      const fees = openFee + feeUnit * matched;
      trades.push({
        openTime: first.time, closeTime: f.time, symbol: f.symbol, side: lotDir > 0 ? "buy" : "sell",
        size: round(matched), entry: round(openPrice / matched), exit: f.price, fees: round(fees), pnl: round(gross - fees),
      });
    }
    if (left <= EPS) continue;
    const realized = f.realized != null && f.realized !== 0 ? f.realized : null;
    if (!lots.length && realized != null) {
      // A closing fill whose opening fill is before the file starts: the exchange's realized
      // profit still says what it made.
      const fee = feeUnit * left;
      trades.push({ closeTime: f.time, symbol: f.symbol, side: dir > 0 ? "sell" : "buy", size: round(left), exit: f.price, fees: round(fee), pnl: round(realized * (left / f.qty) - fee) });
      fromRealized++;
      continue;
    }
    if (!lots.length && dir < 0 && !opt.allowShort) { unmatched++; continue; }
    lots.push({ time: f.time, qty: left, unit, price: f.price, feeUnit, dir });
  }
  const open = [...book.values()].filter((l) => l.length).length;
  const warnings: string[] = [];
  if (unmatched) warnings.push(`${unmatched} sell${unmatched === 1 ? " was" : "s were"} left out: what was sold was bought before the file starts, so the profit is unknown.`);
  if (fromRealized) warnings.push(`${fromRealized} closing fill${fromRealized === 1 ? " has" : "s have"} no opening fill in the file. Their profit is the exchange's own realized profit, less the fee.`);
  if (open) warnings.push(`${open} position${open === 1 ? " was" : "s were"} still open at the end of the file and ${open === 1 ? "is" : "are"} left out.`);
  trades.sort((a, b) => (a.closeTime < b.closeTime ? -1 : a.closeTime > b.closeTime ? 1 : 0));
  return { trades, warnings };
}

const round = (v: number) => Math.round(v * 1e8) / 1e8;

/** Quote currencies, longest first, to split a pair written without a separator (BTCUSDT). */
const QUOTES = ["FDUSD", "USDT", "USDC", "BUSD", "TUSD", "USD", "EUR", "GBP", "JPY", "TRY", "BRL", "AUD", "CAD", "CHF", "BTC", "ETH", "BNB"];

/** Base and quote of a pair: BTC-USD, BTC/USD, BTCUSDT. */
export function splitPair(sym: string): { base: string; quote: string } | null {
  const s = sym.toUpperCase();
  const sep = s.match(/^([A-Z0-9]+)[-/_]([A-Z0-9]+)$/);
  if (sep) return { base: sep[1], quote: sep[2] };
  const q = QUOTES.find((x) => s.endsWith(x) && s.length > x.length);
  return q ? { base: s.slice(0, -q.length), quote: q } : null;
}

export interface FillRead {
  /** Turns the file's symbol into the one shown (Kraken's XXBTZUSD to XBTUSD, say). */
  symbol?: (s: string) => string;
  /** Rows to skip, for example Alpaca activities that are not fills. */
  skip?: (row: string[], text: (f: "rowType" | "assetType") => string | undefined) => string | null;
  /** Contract multiplier for a row when the file has no column for it (options: 100). */
  multiplier?: (row: string[], text: (f: "assetType") => string | undefined) => number | null;
  /** Builds the symbol from several columns (thinkorswim options). */
  fullSymbol?: (row: string[], text: (f: "symbol" | "expiry" | "strike" | "assetType") => string | undefined) => string | undefined;
}

/**
 * Reads mapped fill rows. Quantity may be signed (a sale is negative) when there is no side
 * column. A fee paid in the quote currency is taken off as it is, one paid in the base asset
 * is turned into money at the fill's price, and one paid in anything else (BNB, say) cannot
 * be priced and is left out with a warning.
 */
export function readFills(t: Table, m: Mapping, x: FillRead = {}): { fills: Fill[]; warnings: string[] } {
  const r = reader(m);
  const df = dayFirstIn(t.rows, m.closeTime);
  const fills: Fill[] = [];
  let skipped = 0, otherFee = 0;
  const skipWhy = new Map<string, number>();
  const otherCoins = new Set<string>();
  for (const row of t.rows) {
    const textOf = (f: "rowType" | "assetType" | "symbol" | "expiry" | "strike") => r.text(row, f);
    const why = x.skip?.(row, textOf);
    if (why) { skipWhy.set(why, (skipWhy.get(why) ?? 0) + 1); continue; }
    const time = r.date(row, "closeTime", df);
    const rawSym = x.fullSymbol ? x.fullSymbol(row, textOf) : r.text(row, "symbol");
    const q = r.loose(row, "size");
    const price = r.loose(row, "entry");
    if (!time || !rawSym || q == null || q === 0 || price == null) { skipped++; continue; }
    const sideText = r.text(row, "side")?.toLowerCase();
    const side: "buy" | "sell" | undefined = sideText?.startsWith("sell") || sideText === "s" ? "sell" : sideText?.startsWith("buy") || sideText === "b" ? "buy" : sideOf(sideText) ?? (q < 0 ? "sell" : "buy");
    const qty = Math.abs(q);
    const mult = r.loose(row, "multiplier") ?? x.multiplier?.(row, textOf) ?? 1;
    if (!(mult > 0)) { skipped++; continue; }
    const v = r.loose(row, "value");
    const value = v != null && v !== 0 ? Math.abs(v) : qty * price * mult;
    const symbol = (x.symbol ? x.symbol(rawSym) : rawSym).toUpperCase();
    // Fee and the currency it was paid in: a fee column, or a unit written in the cell.
    const feeCell = m.fees == null ? undefined : row[m.fees];
    let fee = Math.abs(r.loose(row, "fees") ?? 0);
    const feeCcy = (r.text(row, "feeCurrency") ?? unitOf(feeCell))?.toUpperCase();
    if (fee && feeCcy) {
      const pair = splitPair(symbol);
      const quote = unitOf(m.value == null ? undefined : row[m.value]) ?? pair?.quote;
      if (pair && feeCcy === pair.base) fee *= price;
      else if (quote && feeCcy !== quote && !["USD", "USDT", "USDC"].includes(feeCcy)) { otherFee++; otherCoins.add(feeCcy); fee = 0; }
    }
    fills.push({ time, symbol, side, qty, price, value, fee, realized: r.loose(row, "realized") });
  }
  const warnings: string[] = [];
  if (skipped) warnings.push(`${skipped} row${skipped === 1 ? " had" : "s had"} no readable time, symbol, quantity or price and ${skipped === 1 ? "was" : "were"} skipped.`);
  for (const [why, n] of skipWhy) warnings.push(`${n} row${n === 1 ? " was" : "s were"} skipped: ${why}.`);
  if (otherFee) warnings.push(`${otherFee} fee${otherFee === 1 ? " was" : "s were"} paid in ${[...otherCoins].join(" and ")}, which we cannot price, so ${otherFee === 1 ? "it is" : "they are"} not taken off the profit.`);
  return { fills, warnings };
}
