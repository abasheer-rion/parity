// Statements with many sections in one CSV file. Only the trades section is read; the
// rest (cash, positions, account details) is never turned into a table at all.
//   Interactive Brokers activity statement: every row starts with its section name and
//     Header or Data, e.g. "Trades,Header,DataDiscriminator,Asset Category,...".
//   thinkorswim account statement: a title line "Account Trade History", then a header row
//     and the trades until a blank line.
import { readTable, splitRows } from "../csv";
import type { Table } from "../types";

export function tradesSection(text: string): Table | null {
  const clean = text.replace(/^﻿/, "");
  const head = clean.slice(0, 20000);
  if (/^Trades,Header,/m.test(head) || /^"?Statement"?,"?Header"?,/m.test(head)) return ibkrTrades(clean);
  if (/^\s*,?\s*Account Trade History\s*,*\s*$/m.test(clean)) return tosTrades(clean);
  return null;
}

function ibkrTrades(text: string): Table | null {
  let headers: string[] | null = null;
  // Each asset class may repeat the header with other columns; its rows are matched by name.
  let current: string[] | null = null;
  const out: string[][] = [];
  for (const r of splitRows(text, ",")) {
    if (r[0] !== "Trades") continue;
    if (r[1] === "Header") {
      current = r.slice(2).map((c) => c.replace(/\s+/g, " ").trim());
      headers ??= current;
      continue;
    }
    if (r[1] !== "Data" || !headers || !current) continue;
    const cells = r.slice(2), from = current;
    out.push(from === headers ? cells : headers.map((h) => { const i = from.indexOf(h); return i >= 0 ? cells[i] ?? "" : ""; }));
  }
  return headers ? { headers, rows: out } : null;
}

function tosTrades(text: string): Table | null {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((l) => /^\s*,?\s*Account Trade History\s*,*\s*$/.test(l));
  if (start < 0) return null;
  const body: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (!lines[i].replace(/[,\s]/g, "")) { if (body.length) break; continue; }
    // The next section's title: one cell of words.
    if (body.length > 1 && !lines[i].includes(",")) break;
    body.push(lines[i]);
  }
  if (!body.length) return null;
  const sub = body.join("\n");
  const t = readTable(sub);
  return { headers: t.headers, rows: t.rows };
}
