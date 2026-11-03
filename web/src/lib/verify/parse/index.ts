// Reading an uploaded file: CSV to a table, personal columns out, then the format is
// detected from the header row and the rows become trades or an equity curve. The
// person can pick another format or other columns, and the file is read again from
// the table (which no longer holds the personal columns). REF-0016, input A.
import { decodeBytes, ParseError, readTable, tableFromRows } from "../csv";
import { FORMAT_LABEL, type FormatId, type Mapping, type Parsed, type Table, type Trade } from "../types";
import { dropColumns, dropPersonal } from "./common";
import { binanceFutures, binanceSpot, binanceStatement, bybitFills, bybitPnl, coinbase, coinbaseReport, kraken } from "./crypto";
import type { BuildOut, FieldDef, FormatDef } from "./format";
import { buildEquity, buildTrades, detectEquity, detectTrades, mapEquity, mapTrades } from "./generic";
import { ibkrActivity, ibkrFlex } from "./ibkr";
import { buildMt4, buildMt4Tester, detectMt4, mapMt4 } from "./mt4";
import { htmlRows, looksLikeHtml, metaTraderRows, type MetaTraderRead } from "./html";
import { isZip, readXlsx } from "./xlsx";
import { buildMt5, buildMt5Deals, detectMt5, detectMt5Deals, mapMt5, mapMt5Deals } from "./mt5";
import { ctrader, myfxbook, ninjatrader, tradovate, tradovateOrders, tradovatePositions } from "./platforms";
import { tradesSection } from "./sections";
import { alpaca, thinkorswim } from "./stocks";
import { buildTradingView, detectTradingView, mapTradingView } from "./tradingview";

export { SUPPORTED } from "./supported";

const noTrades = (): BuildOut => ({ trades: [] });

/** Every format, in the order the detector tries them; the highest score wins. */
const FORMATS: FormatDef[] = [
  { id: "mt5deals", detect: detectMt5Deals, map: mapMt5Deals, build: buildMt5Deals, fields: [
    { field: "closeTime", label: "Time", required: true }, { field: "side", label: "Type (buy or sell)", required: true }, { field: "direction", label: "Direction (in or out)", required: true },
    { field: "pnl", label: "Profit", required: true }, { field: "size", label: "Volume", required: true }, { field: "entry", label: "Price" }, { field: "symbol", label: "Symbol" },
    { field: "position", label: "Position" }, { field: "commission", label: "Commission" }, { field: "fees", label: "Fee" }, { field: "swap", label: "Swap" }, { field: "id", label: "Deal" },
  ] },
  { id: "mt5", detect: detectMt5, map: mapMt5, build: buildMt5, fields: [
    { field: "closeTime", label: "Close time", required: true }, { field: "pnl", label: "Profit", required: true }, { field: "side", label: "Type (buy or sell)", required: true },
    { field: "openTime", label: "Open time" }, { field: "symbol", label: "Symbol" }, { field: "size", label: "Volume" }, { field: "entry", label: "Open price" },
    { field: "exit", label: "Close price" }, { field: "commission", label: "Commission" }, { field: "swap", label: "Swap" }, { field: "fees", label: "Fee" }, { field: "id", label: "Position" },
  ] },
  { id: "mt4", detect: detectMt4, map: mapMt4, build: buildMt4, fields: [
    { field: "closeTime", label: "Close time", required: true }, { field: "pnl", label: "Profit", required: true }, { field: "side", label: "Type (buy or sell)", required: true },
    { field: "openTime", label: "Open time" }, { field: "symbol", label: "Symbol" }, { field: "size", label: "Size" }, { field: "entry", label: "Open price" },
    { field: "exit", label: "Close price" }, { field: "commission", label: "Commission" }, { field: "swap", label: "Swap" }, { field: "fees", label: "Taxes" }, { field: "id", label: "Ticket" },
  ] },
  { id: "tradingview", detect: detectTradingView, map: mapTradingView, build: buildTradingView, fields: [
    { field: "id", label: "Trade number", required: true }, { field: "tvType", label: "Type (entry or exit)", required: true }, { field: "closeTime", label: "Date and time", required: true },
    { field: "pnl", label: "Profit", required: true }, { field: "entry", label: "Price" }, { field: "size", label: "Contracts" }, { field: "symbol", label: "Symbol" },
  ] },
  { id: "mt4tester", detect: () => 0, map: () => ({}), build: (t) => buildMt4Tester(t), fields: [] },
  ibkrFlex, ibkrActivity, binanceSpot, binanceFutures, binanceStatement, bybitFills, bybitPnl, coinbase, coinbaseReport, kraken,
  ctrader, ninjatrader, tradovate, tradovatePositions, tradovateOrders, myfxbook, thinkorswim, alpaca,
  { id: "trades", detect: detectTrades, map: mapTrades, build: buildTrades, fields: [
    { field: "closeTime", label: "Close date", required: true }, { field: "pnl", label: "Profit per trade", required: true }, { field: "openTime", label: "Open date" },
    { field: "symbol", label: "Symbol" }, { field: "side", label: "Side" }, { field: "size", label: "Size" }, { field: "entry", label: "Entry price" },
    { field: "exit", label: "Exit price" }, { field: "fees", label: "Fees (taken off the profit)" }, { field: "id", label: "Trade id" },
  ] },
  { id: "equity", detect: detectEquity, map: mapEquity, build: noTrades, fields: [
    { field: "date", label: "Date", required: true }, { field: "equity", label: "Account value" }, { field: "ret", label: "Return" }, { field: "cashflow", label: "Deposits and withdrawals" },
  ] },
];

const BY_ID = Object.fromEntries(FORMATS.map((f) => [f.id, f])) as Record<FormatId, FormatDef>;

/** The fields each format reads, in the order the column picker shows them, and which are required. */
export const FIELDS: Record<FormatId, FieldDef[]> = Object.fromEntries(FORMATS.map((f) => [f.id, f.fields])) as Record<FormatId, FieldDef[]>;

export function detect(t: Table): { format: FormatId; mapping: Mapping } | null {
  let best: { def: FormatDef; score: number } | null = null;
  for (const f of FORMATS) {
    const s = f.detect(t);
    if (s > 0 && (!best || s > best.score)) best = { def: f, score: s };
  }
  return best ? { format: best.def.id, mapping: best.def.map(t) } : null;
}

export function defaultMapping(format: FormatId, t: Table): Mapping {
  return BY_ID[format].map(t);
}

/** Reads the rows of an already cleaned table with a chosen format and mapping. */
export function build(table: Table, format: FormatId, mapping: Mapping, dropped: string[] = []): Parsed {
  const out: Parsed = { format, table, mapping, dropped, warnings: [], backtestExport: format === "tradingview" };
  const missing = FIELDS[format].filter((f) => f.required && mapping[f.field] == null);
  if (format === "equity" && mapping.equity == null && mapping.ret == null) out.warnings.push("Pick a column with the account value or the return.");
  if (format === "ctrader" && mapping.pnl == null && mapping.equity == null) out.warnings.push("Pick a column with the net or the gross profit.");
  if (missing.length) { out.warnings.push(`Pick a column for: ${missing.map((f) => f.label.toLowerCase()).join(", ")}.`); return out; }
  if (format === "equity") {
    const e = buildEquity(table, mapping);
    out.equity = e.equity; out.warnings.push(...e.warnings);
    const first = e.equity.find((p) => p.equity != null);
    if (first?.equity && first.equity > 0) out.inferredBalance = first.equity;
    return out;
  }
  const res: { trades: Trade[]; warnings?: string[]; notes?: string[]; balance?: number } = BY_ID[format].build(table, mapping);
  out.trades = res.trades;
  if (res.warnings) out.warnings.push(...res.warnings);
  if (res.notes?.length) out.notes = res.notes;
  if (res.balance) out.inferredBalance = res.balance;
  if (!res.trades.length) {
    const fillsFormat = !["mt4", "mt5", "tradingview", "trades", "ctrader", "ninjatrader", "tradovate", "tradovate_positions", "bybit_pnl", "myfxbook"].includes(format);
    out.warnings.push(fillsFormat && table.rows.length
      ? "No round trips: none of the fills in the file closes a position that was opened in it. Export a longer period, from before the first purchase."
      : "No closed trades could be read with these columns.");
  }
  return out;
}

/**
 * The whole first read of a file's text. Personal columns are removed before the format
 * is detected, and a format's account-linked ids right after, so nothing returned (or kept
 * by the page) holds their values. Statements with several sections (Interactive Brokers,
 * thinkorswim) are cut down to their trades section first.
 */
export function parseText(text: string): Parsed {
  const clean = text.replace(/^\uFEFF/, "");
  if (looksLikeHtml(clean)) return parseHtml(clean);
  if (/^\s*[[{]/.test(clean)) { const j = jsonTable(clean); if (j) return parseTable(j); }
  return parseTable(tradesSection(clean) ?? readTable(clean));
}

/** Exports that are not trade lists, with what to download instead. */
const NOT_TRADES: { test: (t: Table) => boolean; why: string }[] = [
  { test: (t) => has(t, /^refid$/) && has(t, /^asset$/) && has(t, /^amount$/) && has(t, /^balance$/), why: "This is a Kraken ledger (ledgers.csv), which lists money moving, not trades. Export History, Trades instead: trades.csv." },
  { test: (t) => has(t, /^transaction id$/) && has(t, /^type$/) && has(t, /^asset$/) && has(t, /^symbol$/) && !has(t, /^price$/), why: "This is a Binance futures transaction history (funding, fees and realized profit), not trades. Export Orders, Futures, Trade History instead." },
  { test: (t) => has(t, /^(order|open) ?(time|date)$/) && has(t, /^status$/) && !has(t, /^(fill|filled)/) && has(t, /^(order )?type$/) && !has(t, /profit|p&l|pnl/), why: "This looks like a list of orders, not of fills or closed trades. Export the trade history instead." },
];
const has = (t: Table, re: RegExp) => t.headers.some((h) => re.test(h.toLowerCase().replace(/[_]+/g, " ").trim()));

/** Reads a table that has its header: personal columns out, format found, account ids out, rows read. */
export function parseTable(raw: Table): Parsed {
  const first = dropPersonal(raw);
  const refuse = NOT_TRADES.find((x) => x.test(first.table));
  const found = refuse ? null : detect(first.table);
  if (!found) {
    return { format: "trades", table: first.table, mapping: mapTrades(first.table), dropped: first.dropped, backtestExport: false,
      warnings: [refuse?.why ?? "We did not recognise this file's columns. Pick the close date and the profit per trade below, or the date and the account value for an equity curve."] };
  }
  const ids = dropColumns(first.table, BY_ID[found.format].drop ?? []);
  const mapping = ids.dropped.length ? BY_ID[found.format].map(ids.table) : found.mapping;
  return build(ids.table, found.format, mapping, [...first.dropped, ...ids.dropped]);
}

/** A table that is already known to be MetaTrader's, from a report or a spreadsheet. */
function parseMetaTrader(mt: MetaTraderRead): Parsed {
  const p = mt.format === "mt4tester"
    ? (() => { const res = buildMt4Tester(mt.table); return { format: mt.format, table: mt.table, mapping: {}, dropped: [], trades: res.trades, warnings: res.warnings, notes: res.notes, backtestExport: true, inferredBalance: res.balance } as Parsed; })()
    : build(mt.table, mt.format, defaultMapping(mt.format, mt.table), []);
  p.what = mt.what;
  if (mt.backtest) { p.backtestExport = true; if (mt.format !== "mt4tester") p.notes = [...(p.notes ?? []), "A Strategy Tester report is a backtest: rules run on past prices, not real trading."]; }
  if (!p.trades?.length && !p.warnings.some((w) => /No closed trades/.test(w))) p.warnings.push("No closed trades could be read from this report.");
  return p;
}

function parseHtml(html: string): Parsed {
  const rows = htmlRows(html);
  const mt = metaTraderRows(rows);
  if (mt) return parseMetaTrader(mt);
  if (!rows.length) throw new ParseError("This is a web page with no table in it. Export the trade history as CSV, or save the platform's report as HTML.");
  // Another platform's HTML statement (cTrader, say): read its widest table like a CSV.
  return parseTable(tableFromRows(rows.filter((r) => r.length > 1)));
}

/** A JSON list of objects (Alpaca's account activities), or an object holding one, as a table. */
function jsonTable(text: string): Table | null {
  let v: unknown;
  try { v = JSON.parse(text); } catch { throw new ParseError("This looks like JSON, but it cannot be read. Check that the file is complete."); }
  const list = Array.isArray(v) ? v : v && typeof v === "object" ? Object.values(v as Record<string, unknown>).find(Array.isArray) : null;
  if (!Array.isArray(list) || !list.length || typeof list[0] !== "object") return null;
  const headers = [...new Set(list.flatMap((o) => (o && typeof o === "object" ? Object.keys(o as object) : [])))];
  const rows = list.map((o) => headers.map((h) => { const x = (o as Record<string, unknown>)[h]; return x == null ? "" : typeof x === "object" ? JSON.stringify(x) : String(x); }));
  return { headers, rows, unit: "row" };
}

/**
 * The first read of a file's bytes: an Excel workbook (TradingView, cTrader, MetaTrader 5
 * Open XML), a MetaTrader HTML report (UTF-8 or UTF-16), JSON, or CSV and tab separated text.
 */
export async function parseFile(buf: ArrayBuffer): Promise<Parsed> {
  if (isZip(buf)) {
    const sheets = await readXlsx(buf);
    const list = sheets.find((s) => /list of trades/i.test(s.name));
    if (list) return parseTable({ ...tableFromRows(list.rows), unit: "row" });
    for (const s of sheets) { const mt = metaTraderRows(s.rows); if (mt) return parseMetaTrader(mt); }
    const best = [...sheets].sort((a, b) => b.rows.length - a.rows.length)[0];
    if (!best?.rows.length) throw new ParseError("This Excel file has no rows to read.");
    return parseTable({ ...tableFromRows(best.rows), unit: "row" });
  }
  return parseText(decodeBytes(buf));
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const shortDate = (iso: string) => `${+iso.slice(8, 10)} ${MONTHS[+iso.slice(5, 7) - 1]} ${iso.slice(0, 4)}`;

/** "MetaTrader 5 history, 412 closed trades, EURUSD and XAUUSD, 3 Jan 2024 to 18 Oct 2026". */
export function describeParsed(p: Parsed): string {
  const parts: string[] = [p.what ?? FORMAT_LABEL[p.format]];
  if (p.trades) {
    const n = p.trades.length;
    parts.push(`${n.toLocaleString("en-US")} closed trade${n === 1 ? "" : "s"}`);
    const syms = [...new Set(p.trades.map((t) => t.symbol).filter((s): s is string => !!s))];
    if (syms.length) parts.push(syms.length <= 3 ? syms.join(syms.length === 2 ? " and " : ", ") : `${syms.slice(0, 2).join(", ")} and ${syms.length - 2} more symbols`);
    if (n) parts.push(`${shortDate(p.trades[0].closeTime)} to ${shortDate(p.trades[n - 1].closeTime)}`);
  } else if (p.equity) {
    const n = p.equity.length;
    parts.push(`${n.toLocaleString("en-US")} dated values`);
    if (n) parts.push(`${shortDate(p.equity[0].date)} to ${shortDate(p.equity[n - 1].date)}`);
  }
  return parts.join(", ");
}
