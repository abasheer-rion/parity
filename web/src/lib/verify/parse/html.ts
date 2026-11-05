// MetaTrader's own reports, read as they are saved: HTML from MetaTrader 4 (Statement,
// Detailed Statement, Strategy Tester) and MetaTrader 5 (History Report, Strategy Tester),
// and MetaTrader 5's "Open XML" spreadsheet (xlsx.ts gives its rows). Checked against real
// reports (tests/fixtures/verify/real/SOURCES.md).
//
// MetaTrader 5 writes the headers and section names in the terminal's language, so tables are
// found by the shape of their rows, never by header words: a closed position is 13 cells with
// a date first and ninth and "buy" or "sell" fourth, a deal 13 or 14 cells with "in" or "out"
// fifth, and so on. Cell values stay in English in every language. Cells MetaTrader hides
// (class "hidden") are left out, as the browser does. The rows become a table in the shape the
// CSV readers already take (mt4.ts, mt5.ts), so there is one way to turn them into trades.
import type { FormatId, Table } from "../types";

/** The visible cells of every row of every table in an HTML page, as plain text. */
export function htmlRows(html: string): string[][] {
  const out: string[][] = [];
  const rows = html.split(/<tr\b[^>]*>/i).slice(1);
  for (const r of rows) {
    const body = r.split(/<\/tr>/i)[0];
    const cells: string[] = [];
    for (const m of body.matchAll(/<t([dh])\b([^>]*)>([\s\S]*?)(?=<t[dh]\b|<\/t[dh]>|$)/gi)) {
      if (/class\s*=\s*["']?[^"'>]*\bhidden\b/i.test(m[2])) continue;
      cells.push(text(m[3]));
    }
    if (cells.length) out.push(cells);
  }
  return out;
}

const ENT: Record<string, string> = { nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function text(h: string): string {
  return h.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]*>/g, "")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (_, e: string) => (e[0] === "#" ? String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : +e.slice(1)) : ENT[e.toLowerCase()] ?? `&${e};`))
    .replace(/\s+/g, " ").trim();
}

const DATE = /^\d{4}\.\d{2}\.\d{2}( \d{2}:\d{2}(:\d{2})?)?$/;
const isDate = (c: string | undefined) => !!c && DATE.test(c);
const isSide = (c: string | undefined) => c === "buy" || c === "sell";
const isNum = (c: string | undefined) => !!c && /^-?[\d\s]*\.?\d+$/.test(c.replace(/ /g, " "));
/** "0.09 / 0.1" (MetaTrader 5's filled / ordered volume) to its first number. */
const firstNum = (c: string) => c.split("/")[0].trim();

export interface MetaTraderRead { format: FormatId; table: Table; backtest: boolean; what: string }

/**
 * MetaTrader rows to one of the CSV shapes. Closed positions are preferred over deals,
 * because a position row already has its open and close; deals are paired otherwise.
 */
export function metaTraderRows(rows: string[][], unit: "row" | "line" = "row"): MetaTraderRead | null {
  const at = (pick: (r: string[]) => boolean) => rows.map((r, i) => (pick(r) ? i : -1)).filter((i) => i >= 0);

  // MetaTrader 5 positions: Time, Position, Symbol, Type, Volume, Price, S / L, T / P, Time, Price, Commission, Swap, Profit.
  const pos = at((r) => r.length >= 13 && isDate(r[0]) && isSide(r[3]) && isDate(r[8]) && isNum(r[12]));
  // MetaTrader 5 deals: Time, Deal, Symbol, Type, Direction, Volume, Price, Order, Commission, (Fee,) Swap, Profit, Balance, Comment.
  const deals = at((r) => (r.length === 13 || r.length === 14) && isDate(r[0]) && ((isSide(r[3]) && /^(in|out|in\/out|out by)$/.test(r[4])) || r[3] === "balance" || r[3] === "credit"));
  if (pos.length) {
    const headers = ["Time", "Position", "Symbol", "Type", "Volume", "Price", "S / L", "T / P", "Time", "Price", "Commission", "Swap", "Profit"];
    const body = pos.map((i) => { const r = rows[i].slice(0, 13); r[4] = firstNum(r[4]); return r; });
    const lines = pos.map((i) => i + 1);
    // The first deposit, from the deals table, as a balance row the positions reader knows.
    const dep = deals.find((i) => rows[i][3] === "balance");
    if (dep != null) { const r = rows[dep]; body.unshift([r[0], "", "", "balance", "", "", "", "", r[0], "", "0", "0", r[r.length === 14 ? 11 : 10]]); lines.unshift(dep + 1); }
    return { format: "mt5", table: { headers, rows: body, lines, unit }, backtest: false, what: "MetaTrader 5 report, closed positions" };
  }
  if (deals.length) {
    const wide = rows[deals[0]].length === 14;
    const headers = wide
      ? ["Time", "Deal", "Symbol", "Type", "Direction", "Volume", "Price", "Order", "Commission", "Fee", "Swap", "Profit", "Balance", "Comment"]
      : ["Time", "Deal", "Symbol", "Type", "Direction", "Volume", "Price", "Order", "Commission", "Swap", "Profit", "Balance", "Comment"];
    // A Strategy Tester report has deals only, 13 cells: a backtest.
    return { format: "mt5deals", table: { headers, rows: deals.map((i) => rows[i]), lines: deals.map((i) => i + 1), unit }, backtest: !wide, what: wide ? "MetaTrader 5 report, deals" : "MetaTrader 5 Strategy Tester report" };
  }

  // MetaTrader 4 statement: Ticket, Open Time, Type, Size, Item, Price, S / L, T / P, Close Time, Price, Commission, Taxes, Swap, Profit.
  const mt4 = at((r) => r.length >= 14 && isDate(r[1]) && isSide(r[2]) && isDate(r[8]));
  const cash = at((r) => r.length >= 4 && r.length < 14 && isDate(r[1]) && (r[2] === "balance" || r[2] === "credit"));
  if (mt4.length) {
    const headers = ["Ticket", "Open Time", "Type", "Size", "Item", "Price", "S / L", "T / P", "Close Time", "Price", "Commission", "Taxes", "Swap", "Profit"];
    const all = [...mt4, ...cash].sort((a, b) => a - b);
    const body = all.map((i) => {
      const r = rows[i];
      return r.length >= 14 ? r.slice(0, 14) : [r[0], r[1], r[2], "", "", "", "", "", r[1], "", "0", "0", "0", r[r.length - 1]];
    });
    return { format: "mt4", table: { headers, rows: body, lines: all.map((i) => i + 1), unit }, backtest: false, what: "MetaTrader 4 statement" };
  }

  // MetaTrader 4 Strategy Tester: #, Time, Type, Order, Size, Price, S / L, T / P, Profit, Balance.
  const tester = at((r) => r.length >= 10 && /^\d+$/.test(r[0]) && isDate(r[1]) && /^(buy|sell|close|t\/p|s\/l|close at stop|modify|delete|buy (limit|stop)|sell (limit|stop))$/.test(r[2]));
  if (tester.length) {
    const headers = ["#", "Time", "Type", "Order", "Size", "Price", "S / L", "T / P", "Profit", "Balance"];
    return { format: "mt4tester", table: { headers, rows: tester.map((i) => rows[i].slice(0, 10)), lines: tester.map((i) => i + 1), unit }, backtest: true, what: "MetaTrader 4 Strategy Tester report" };
  }
  return null;
}

/** True when text is an HTML page rather than a CSV. */
export const looksLikeHtml = (s: string) => /^\s*(<!doctype html|<html|<head|<meta|<table|<\?xml[^>]*>\s*<html)/i.test(s) || /<table[\s>]/i.test(s.slice(0, 5000));
