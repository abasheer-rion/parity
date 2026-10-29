// Reading a CSV or tab separated file into rows, and reading dates and numbers out of
// the cells the way trading platforms write them. Runs in the browser only.
import type { Table } from "./types";

export const MAX_BYTES = 5 * 1024 * 1024;
export const MAX_ROWS = 50_000;

export class ParseError extends Error {}

/** The delimiter used most often (outside quotes) in the first lines: comma, semicolon or tab. */
export function sniffDelimiter(text: string): string {
  const head = text.split(/\r?\n/).slice(0, 20).join("\n");
  const count = (d: string) => {
    let n = 0, q = false;
    for (const ch of head) { if (ch === '"') q = !q; else if (!q && ch === d) n++; }
    return n;
  };
  const cands = [",", "\t", ";"].map((d) => [d, count(d)] as const).sort((a, b) => b[1] - a[1]);
  return cands[0][1] > 0 ? cands[0][0] : ",";
}

/** Splits text into rows of cells, honouring double quotes ("" is a quote inside one). */
export function splitRows(text: string, delim: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; } else q = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"' && cell.trim() === "") { q = true; cell = ""; }
    else if (ch === delim) { row.push(cell.trim()); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell.trim()); cell = "";
      if (row.some((c) => c !== "")) rows.push(row);
      row = [];
      if (rows.length > MAX_ROWS + 50) throw new ParseError(`The file has more than ${MAX_ROWS.toLocaleString()} rows, the most Verify reads for now.`);
    } else cell += ch;
  }
  row.push(cell.trim());
  if (row.some((c) => c !== "")) rows.push(row);
  return rows;
}

const looksLikeHeader = (r: string[]) => r.filter((c) => /[A-Za-z]/.test(c)).length >= 2 && r.filter((c) => c !== "").length >= 2;

/** Reads a file's text into a header row and data rows. The header is the first row with words in it. */
export function readTable(text: string): Table & { delimiter: string } {
  const clean = text.replace(/^﻿/, "");
  if (!clean.trim()) throw new ParseError("The file is empty.");
  const delimiter = sniffDelimiter(clean);
  const all = splitRows(clean, delimiter);
  const h = all.findIndex((r, i) => i < 15 && looksLikeHeader(r));
  if (h < 0) throw new ParseError("We could not find a header row (a first row with column names) in the first lines of the file.");
  const headers = all[h].map((c) => c.replace(/\s+/g, " ").trim());
  const rows = all.slice(h + 1).map((r) => (r.length < headers.length ? [...r, ...Array(headers.length - r.length).fill("")] : r.slice(0, headers.length)));
  if (rows.length > MAX_ROWS) throw new ParseError(`The file has ${rows.length.toLocaleString()} rows. Verify reads up to ${MAX_ROWS.toLocaleString()} for now.`);
  return { headers, rows, delimiter };
}

/**
 * A number as platforms write it: "1,234.56", "1 234.56", "1.234,56", "(12.5)", "-12.5 USD",
 * "12.5%". Percent signs are dropped; the caller decides what a percent means. Null when
 * the cell holds no number.
 */
export function num(cell: string | undefined, decimalComma = false): number | null {
  if (cell == null) return null;
  let s = cell.trim();
  if (!s) return null;
  let neg = false;
  // "$(25.00)" (Tradovate, NinjaTrader) and "-$25.00": a leading currency sign goes first.
  s = s.replace(/^([-−]?)\s*[$€£¥]\s*/, "$1");
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  s = s.replace(/[\s '$€£¥%]|USD|EUR|GBP|JPY|USDT/gi, "");
  s = s.replace(/^−/, "-");
  const lastDot = s.lastIndexOf("."), lastComma = s.lastIndexOf(",");
  if (lastDot >= 0 && lastComma >= 0) {
    s = lastComma > lastDot ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (lastComma >= 0) {
    const decimal = decimalComma || (/^-?\d+,\d{1,2}$/.test(s) && !/^-?\d{1,3}(,\d{3})+$/.test(s));
    s = decimal ? s.replace(",", ".") : s.replace(/,/g, "");
  }
  if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s)) return null;
  const v = Number(s);
  return Number.isFinite(v) ? (neg ? -v : v) : null;
}

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const pad = (n: number) => String(n).padStart(2, "0");

/**
 * A date and time as "YYYY-MM-DDTHH:MM:SS", or null. Reads 2024.01.03 10:15:00 (MetaTrader),
 * 2024-01-03 10:15, 2024-01-03T10:15:00Z, 2024/01/03, 03 Jan 2024, and day/month/year
 * forms. For a slash date like 03/04/2024 it reads month first (TradingView, US Excel)
 * unless `dayFirst` is set or the first number is above 12. Dotted short dates
 * (03.04.2024) are day first.
 */
export function parseDate(cell: string | undefined, dayFirst = false): string | null {
  if (!cell) return null;
  const s = cell.trim().replace(/^"|"$/g, "");
  if (!s) return null;
  let y: number, mo: number, d: number;
  let rest = "";
  let m = s.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})(.*)$/);
  // Compact forms: 20240103;101500 (Interactive Brokers Flex), 20240103 10:15:00, 20240103.
  const c = m ? null : s.match(/^(\d{4})(\d{2})(\d{2})(?:[;,T ]+(\d{2}):?(\d{2}):?(\d{2})?)?$/);
  if (m) { y = +m[1]; mo = +m[2]; d = +m[3]; rest = m[4]; }
  else if (c) { y = +c[1]; mo = +c[2]; d = +c[3]; rest = c[4] ? ` ${c[4]}:${c[5]}:${c[6] ?? "00"}` : ""; }
  else if ((m = s.match(/^(\d{1,2})[-./](\d{1,2})[-./](\d{2,4})(.*)$/))) {
    const a = +m[1], b = +m[2];
    y = +m[3] < 100 ? 2000 + +m[3] : +m[3];
    const df = dayFirst || a > 12 || s[m[1].length] === ".";
    [d, mo] = df ? [a, b] : [b, a];
    rest = m[4];
  } else if ((m = s.match(/^(\d{1,2})[ -]([A-Za-z]{3})[A-Za-z]*[ -,]+(\d{4})(.*)$/))) {
    d = +m[1]; mo = MONTHS[m[2].toLowerCase()] ?? 0; y = +m[3]; rest = m[4];
  } else if ((m = s.match(/^([A-Za-z]{3})[A-Za-z]* (\d{1,2}),? (\d{4})(.*)$/))) {
    mo = MONTHS[m[1].toLowerCase()] ?? 0; d = +m[2]; y = +m[3]; rest = m[4];
  } else return null;
  if (!(y > 1900 && y < 2200 && mo >= 1 && mo <= 12 && d >= 1 && d <= 31)) return null;
  const t = rest.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?/);
  let hh = 0, mm = 0, ss = 0;
  if (t) {
    hh = +t[1]; mm = +t[2]; ss = t[3] ? +t[3] : 0;
    if (t[4]) { const pm = /p/i.test(t[4]); if (hh === 12) hh = pm ? 12 : 0; else if (pm) hh += 12; }
  }
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCMonth() !== mo - 1) return null;
  return `${y}-${pad(mo)}-${pad(d)}T${pad(hh)}:${pad(mm)}:${pad(ss)}`;
}

/** The day part of an ISO date and time. */
export const day = (iso: string) => iso.slice(0, 10);
