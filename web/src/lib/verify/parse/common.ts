// Helpers every format parser shares: finding columns by name, dropping personal
// columns, and reading a mapped cell. Personal columns go before anything else reads
// the table, so no later step ever holds their values (REF-0016, data handling 2).
import { num, parseDate } from "../csv";
import type { Field, Mapping, Table } from "../types";

/** Header names that look personal: account number, name, email, server, login, IP and the like. */
const PII_NAME = /^(account|acct|account ?(number|no\.?|num|id|#|name|holder)|login|user ?(name|id)?|name|full ?name|first ?name|last ?name|client( ?(name|id|number))?|customer( ?(name|id))?|trader( ?name)?|owner|e-?mail( ?address)?|server|broker ?server|trade ?server|ip|ip ?address|phone( ?number)?|address|country|city)$/i;
const PII_PART = /\b(e-?mail|ip ?address|(account|acct) ?(number|no|num|id|holder|name|alias)|login|server|phone|passport|tax ?id)\b/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const IPV4 = /^(\d{1,3}\.){3}\d{1,3}(:\d+)?$/;

/** True when a header name looks like personal data. */
export function isPersonalHeader(h: string): boolean {
  const s = h.trim().replace(/[_]+/g, " ").replace(/\s+/g, " ");
  // Also with camelCase split, so ClientAccountID and AccountAlias (Interactive Brokers) are caught.
  const split = s.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2");
  return PII_NAME.test(s) || PII_PART.test(s) || PII_NAME.test(split) || PII_PART.test(split);
}

/** Removes the columns whose header matches any pattern (a format's order and fill ids), returning their names. */
export function dropColumns(t: Table, patterns: RegExp[]): { table: Table; dropped: string[] } {
  const drop = t.headers.map((h, i) => (patterns.some((p) => p.test(norm(h))) ? i : -1)).filter((i) => i >= 0);
  if (!drop.length) return { table: t, dropped: [] };
  const keep = t.headers.map((_, i) => i).filter((i) => !drop.includes(i));
  return { table: { headers: keep.map((i) => t.headers[i]), rows: t.rows.map((r) => keep.map((i) => r[i] ?? "")) }, dropped: drop.map((i) => t.headers[i]) };
}

/** A number with a unit written next to it: "0.0100000000BTC", "1.00 Lots", "USDT 25". */
export function numLoose(cell: string | undefined): number | null {
  if (cell == null) return null;
  return num(cell.trim().replace(/^[A-Za-z]{2,10}\s+/, "").replace(/\s*[A-Za-z]{2,10}$/, ""));
}

/** The unit written after a number, upper case: "0.00001BNB" gives "BNB". */
export function unitOf(cell: string | undefined): string | undefined {
  const m = (cell ?? "").trim().match(/[\d.)]\s*([A-Za-z]{2,10})$/);
  return m ? m[1].toUpperCase() : undefined;
}

/**
 * A new table without the personal columns, plus their names. Columns are also dropped
 * when most of their values are email or IP addresses, whatever the header says. The
 * returned rows are fresh arrays, so the caller can let go of the original table.
 */
export function dropPersonal(t: Table): { table: Table; dropped: string[] } {
  const drop = new Set<number>();
  t.headers.forEach((h, i) => {
    if (isPersonalHeader(h)) { drop.add(i); return; }
    const vals = t.rows.slice(0, 200).map((r) => r[i]).filter((v) => v);
    if (vals.length && vals.filter((v) => EMAIL.test(v) || IPV4.test(v)).length >= vals.length / 2) drop.add(i);
  });
  const keep = t.headers.map((_, i) => i).filter((i) => !drop.has(i));
  return {
    table: { headers: keep.map((i) => t.headers[i]), rows: t.rows.map((r) => keep.map((i) => r[i] ?? "")) },
    dropped: [...drop].map((i) => t.headers[i] || `column ${i + 1}`),
  };
}

const norm = (h: string) => h.toLowerCase().replace(/[_]+/g, " ").replace(/\s+/g, " ").trim();

/** Index of the nth (0-based) header matching any pattern, or undefined. */
export function col(headers: string[], patterns: RegExp[], nth = 0, after = -1): number | undefined {
  let seen = 0;
  for (let i = after + 1; i < headers.length; i++) {
    if (patterns.some((p) => p.test(norm(headers[i])))) {
      if (seen === nth) return i;
      seen++;
    }
  }
  return undefined;
}

/** Drops undefined entries so a mapping only lists the columns that were found. */
export function compact(m: Partial<Record<Field, number | undefined>>): Mapping {
  const out: Mapping = {};
  for (const [k, v] of Object.entries(m)) if (v != null) out[k as Field] = v;
  return out;
}

/** Reads mapped cells from one row. */
export function reader(m: Mapping, decimalComma = false) {
  return {
    text: (r: string[], f: Field) => (m[f] == null ? undefined : (r[m[f]!] ?? "").trim() || undefined),
    num: (r: string[], f: Field) => (m[f] == null ? null : num(r[m[f]!], decimalComma)),
    loose: (r: string[], f: Field) => (m[f] == null ? null : numLoose(r[m[f]!])),
    date: (r: string[], f: Field, dayFirst = false) => (m[f] == null ? null : parseDate(r[m[f]!], dayFirst)),
  };
}

/** "buy" or "sell" from the words platforms use, or undefined. */
export function sideOf(s: string | undefined): "buy" | "sell" | undefined {
  if (!s) return undefined;
  const v = s.toLowerCase();
  if (/\b(buy|long|bought|b)\b/.test(v)) return "buy";
  if (/\b(sell|short|sold|s)\b/.test(v)) return "sell";
  return undefined;
}

/** Whether slash dates in a column read day first: true when any first number is above 12. */
export function dayFirstIn(rows: string[][], i: number | undefined): boolean {
  if (i == null) return false;
  return rows.some((r) => { const m = (r[i] ?? "").match(/^(\d{1,2})\/(\d{1,2})\//); return !!m && +m[1] > 12; });
}
