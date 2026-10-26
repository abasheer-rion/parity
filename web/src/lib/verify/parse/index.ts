// Reading an uploaded file: CSV to a table, personal columns out, then the format is
// detected from the header row and the rows become trades or an equity curve. The
// person can pick another format or other columns, and the file is read again from
// the table (which no longer holds the personal columns). REF-0016, input A.
import { readTable } from "../csv";
import { FORMAT_LABEL, type Field, type FormatId, type Mapping, type Parsed, type Table, type Trade } from "../types";
import { dropPersonal } from "./common";
import { buildEquity, buildTrades, detectEquity, detectTrades, mapEquity, mapTrades } from "./generic";
import { buildMt4, detectMt4, mapMt4 } from "./mt4";
import { buildMt5, buildMt5Deals, detectMt5, detectMt5Deals, mapMt5, mapMt5Deals } from "./mt5";
import { buildTradingView, detectTradingView, mapTradingView } from "./tradingview";

const FORMATS: { id: FormatId; detect: (t: Table) => number; map: (t: Table) => Mapping }[] = [
  { id: "mt5deals", detect: detectMt5Deals, map: mapMt5Deals },
  { id: "mt5", detect: detectMt5, map: mapMt5 },
  { id: "mt4", detect: detectMt4, map: mapMt4 },
  { id: "tradingview", detect: detectTradingView, map: mapTradingView },
  { id: "trades", detect: detectTrades, map: mapTrades },
  { id: "equity", detect: detectEquity, map: mapEquity },
];

/** The fields each format reads, in the order the column picker shows them, and which are required. */
export const FIELDS: Record<FormatId, { field: Field; label: string; required?: boolean }[]> = {
  mt4: [
    { field: "closeTime", label: "Close time", required: true }, { field: "pnl", label: "Profit", required: true }, { field: "side", label: "Type (buy or sell)", required: true },
    { field: "openTime", label: "Open time" }, { field: "symbol", label: "Symbol" }, { field: "size", label: "Size" }, { field: "entry", label: "Open price" },
    { field: "exit", label: "Close price" }, { field: "commission", label: "Commission" }, { field: "swap", label: "Swap" }, { field: "fees", label: "Taxes" }, { field: "id", label: "Ticket" },
  ],
  mt5: [
    { field: "closeTime", label: "Close time", required: true }, { field: "pnl", label: "Profit", required: true }, { field: "side", label: "Type (buy or sell)", required: true },
    { field: "openTime", label: "Open time" }, { field: "symbol", label: "Symbol" }, { field: "size", label: "Volume" }, { field: "entry", label: "Open price" },
    { field: "exit", label: "Close price" }, { field: "commission", label: "Commission" }, { field: "swap", label: "Swap" }, { field: "fees", label: "Fee" }, { field: "id", label: "Position" },
  ],
  mt5deals: [
    { field: "closeTime", label: "Time", required: true }, { field: "side", label: "Type (buy or sell)", required: true }, { field: "direction", label: "Direction (in or out)", required: true },
    { field: "pnl", label: "Profit", required: true }, { field: "size", label: "Volume", required: true }, { field: "entry", label: "Price" }, { field: "symbol", label: "Symbol" },
    { field: "position", label: "Position" }, { field: "commission", label: "Commission" }, { field: "fees", label: "Fee" }, { field: "swap", label: "Swap" }, { field: "id", label: "Deal" },
  ],
  tradingview: [
    { field: "id", label: "Trade number", required: true }, { field: "tvType", label: "Type (entry or exit)", required: true }, { field: "closeTime", label: "Date and time", required: true },
    { field: "pnl", label: "Profit", required: true }, { field: "entry", label: "Price" }, { field: "size", label: "Contracts" }, { field: "symbol", label: "Symbol" },
  ],
  trades: [
    { field: "closeTime", label: "Close date", required: true }, { field: "pnl", label: "Profit per trade", required: true }, { field: "openTime", label: "Open date" },
    { field: "symbol", label: "Symbol" }, { field: "side", label: "Side" }, { field: "size", label: "Size" }, { field: "entry", label: "Entry price" },
    { field: "exit", label: "Exit price" }, { field: "fees", label: "Fees (taken off the profit)" }, { field: "id", label: "Trade id" },
  ],
  equity: [
    { field: "date", label: "Date", required: true }, { field: "equity", label: "Account value" }, { field: "ret", label: "Return" }, { field: "cashflow", label: "Deposits and withdrawals" },
  ],
};

export function detect(t: Table): { format: FormatId; mapping: Mapping } | null {
  let best: { id: FormatId; score: number; map: (t: Table) => Mapping } | null = null;
  for (const f of FORMATS) {
    const s = f.detect(t);
    if (s > 0 && (!best || s > best.score)) best = { id: f.id, score: s, map: f.map };
  }
  return best ? { format: best.id, mapping: best.map(t) } : null;
}

export function defaultMapping(format: FormatId, t: Table): Mapping {
  return FORMATS.find((f) => f.id === format)!.map(t);
}

/** Reads the rows of an already cleaned table with a chosen format and mapping. */
export function build(table: Table, format: FormatId, mapping: Mapping, dropped: string[] = []): Parsed {
  const out: Parsed = { format, table, mapping, dropped, warnings: [], backtestExport: format === "tradingview" };
  const missing = FIELDS[format].filter((f) => f.required && mapping[f.field] == null);
  if (format === "equity" && mapping.equity == null && mapping.ret == null) out.warnings.push("Pick a column with the account value or the return.");
  if (missing.length) { out.warnings.push(`Pick a column for: ${missing.map((f) => f.label.toLowerCase()).join(", ")}.`); return out; }
  if (format === "equity") {
    const e = buildEquity(table, mapping);
    out.equity = e.equity; out.warnings.push(...e.warnings);
    const first = e.equity.find((p) => p.equity != null);
    if (first?.equity && first.equity > 0) out.inferredBalance = first.equity;
    return out;
  }
  const res: { trades: Trade[]; warnings?: string[]; balance?: number } = format === "mt4" ? buildMt4(table, mapping)
    : format === "mt5" ? buildMt5(table, mapping)
    : format === "mt5deals" ? buildMt5Deals(table, mapping)
    : format === "tradingview" ? buildTradingView(table, mapping)
    : buildTrades(table, mapping);
  out.trades = res.trades;
  if (res.warnings) out.warnings.push(...res.warnings);
  if (res.balance) out.inferredBalance = res.balance;
  if (!res.trades.length) out.warnings.push("No closed trades could be read with these columns.");
  return out;
}

/**
 * The whole first read of a file's text. Personal columns are removed before the format
 * is detected, so nothing returned (or kept by the page) holds their values.
 */
export function parseText(text: string): Parsed {
  const raw = readTable(text);
  const { table, dropped } = dropPersonal(raw);
  const found = detect(table);
  if (!found) {
    return { format: "trades", table, mapping: mapTrades(table), dropped, backtestExport: false,
      warnings: ["We did not recognise this file's columns. Pick the close date and the profit per trade below, or the date and the account value for an equity curve."] };
  }
  return build(table, found.format, found.mapping, dropped);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const shortDate = (iso: string) => `${+iso.slice(8, 10)} ${MONTHS[+iso.slice(5, 7) - 1]} ${iso.slice(0, 4)}`;

/** "MetaTrader 5 history, 412 closed trades, EURUSD and XAUUSD, 3 Jan 2024 to 18 Oct 2026". */
export function describeParsed(p: Parsed): string {
  const parts: string[] = [FORMAT_LABEL[p.format]];
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
