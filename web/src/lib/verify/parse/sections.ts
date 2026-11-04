// Statements with many sections in one CSV file. Only the trades section is read; the
// rest (cash, positions, account details) is never turned into a table at all.
//   Interactive Brokers activity statement: every row starts with its section name and
//     Header or Data, e.g. "Trades,Header,DataDiscriminator,Asset Category,...".
//   Interactive Brokers Flex query with header and trailer records: rows start with
//     HEADER or DATA and the section code (TRNT for trades), between BOF, BOA, BOS and EOS,
//     EOA, EOF lines; with several accounts the header repeats.
//   thinkorswim account statement: a title line "Account Trade History", then a header row
//     and the trades until a blank line.
import { ParseError, readTable, splitRows } from "../csv";
import type { Table } from "../types";

export function tradesSection(text: string): Table | null {
  const clean = text.replace(/^﻿/, "");
  const head = clean.slice(0, 20000);
  if (/^"?Trades"?,"?Header"?,/m.test(head) || /^"?Statement"?,"?Header"?,/m.test(head)) return ibkrTrades(clean);
  if (/^"?(HEADER|BOF)"?,/m.test(head) && /^"?HEADER"?,"?TRNT"?,/m.test(clean)) return flexTrades(clean);
  if (/^\s*,?\s*Account Trade History\s*,*\s*$/m.test(clean)) return tosTrades(clean);
  return null;
}

function ibkrTrades(text: string): Table {
  let headers: string[] | null = null;
  // Each asset class may repeat the header with other columns; its rows are matched by name.
  let current: string[] | null = null;
  const out: string[][] = [], lines: number[] = [], at: number[] = [];
  splitRows(text, ",", at).forEach((r, k) => {
    if (r[0] !== "Trades") return;
    if (r[1] === "Header") {
      current = r.slice(2).map((c) => c.replace(/\s+/g, " ").trim());
      headers ??= current;
      return;
    }
    if (r[1] !== "Data" || !headers || !current) return;
    const cells = r.slice(2), from: string[] = current;
    out.push(from === headers ? cells : headers.map((h) => { const i = from.indexOf(h); return i >= 0 ? cells[i] ?? "" : ""; }));
    lines.push(at[k]);
  });
  if (!headers) throw new ParseError("This Interactive Brokers statement has no Trades section. Make the statement again with Trades ticked, or export a Flex query of trades.");
  return { headers, rows: out, lines };
}

function flexTrades(text: string): Table {
  let headers: string[] | null = null;
  const out: string[][] = [], lines: number[] = [], at: number[] = [];
  splitRows(text, ",", at).forEach((r, k) => {
    if (r[1] !== "TRNT") return;
    if (r[0] === "HEADER") { headers ??= r.slice(2); return; }
    if (r[0] === "DATA" && headers) { out.push(r.slice(2)); lines.push(at[k]); }
  });
  if (!headers) throw new ParseError("This Interactive Brokers Flex file has no trades section (TRNT). Add Trades to the Flex query and run it again.");
  return { headers, rows: out, lines };
}

function tosTrades(text: string): Table | null {
  const all = text.split(/\r?\n/);
  const start = all.findIndex((l) => /^\s*,?\s*Account Trade History\s*,*\s*$/.test(l));
  if (start < 0) return null;
  const body: string[] = [];
  let first = -1;
  for (let i = start + 1; i < all.length; i++) {
    if (!all[i].replace(/[,\s]/g, "")) { if (body.length) break; continue; }
    // The next section's title: one cell of words.
    if (body.length > 1 && !all[i].includes(",")) break;
    if (first < 0) first = i;
    body.push(all[i]);
  }
  if (!body.length) return null;
  const t = readTable(body.join("\n"));
  // Lines in the section are counted from its header row; turn them into lines of the file.
  return { headers: t.headers, rows: t.rows, lines: t.lines.map((n) => n + first) };
}
