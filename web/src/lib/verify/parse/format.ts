// What every format parser provides, so the list of formats is one table (index.ts).
import type { Field, FormatId, Mapping, Table, Trade } from "../types";
import { col } from "./common";

export interface FieldDef { field: Field; label: string; required?: boolean }
export interface BuildOut { trades: Trade[]; warnings?: string[]; balance?: number }

export interface FormatDef {
  id: FormatId;
  /** A score from the header row; 0 when the file is not this format. The highest score wins. */
  detect: (t: Table) => number;
  map: (t: Table) => Mapping;
  build: (t: Table, m: Mapping) => BuildOut;
  /** The fields the column picker shows, in order. */
  fields: FieldDef[];
  /**
   * Columns removed once the format is known: order, fill and transaction ids that can be
   * traced back to an account at the broker. Nothing reads them.
   */
  drop?: RegExp[];
}

/** Adds up the points of the header patterns found. */
export function score(t: Table, parts: [number, RegExp[]][]): number {
  return parts.reduce((s, [pts, p]) => s + (col(t.headers, p) != null ? pts : 0), 0);
}

/** The fields of an export that lists fills. */
export const FILL_FIELDS: FieldDef[] = [
  { field: "closeTime", label: "Time", required: true }, { field: "symbol", label: "Symbol", required: true },
  { field: "size", label: "Quantity", required: true }, { field: "entry", label: "Price", required: true },
  { field: "side", label: "Side (buy or sell; else the sign of the quantity)" }, { field: "value", label: "Value (quantity x price)" },
  { field: "multiplier", label: "Contract multiplier" }, { field: "fees", label: "Fee" }, { field: "feeCurrency", label: "Fee currency" },
  { field: "realized", label: "Realized profit" },
];

/** The fields of an export that lists closed trades. */
export const TRADE_FIELDS: FieldDef[] = [
  { field: "closeTime", label: "Close time", required: true }, { field: "pnl", label: "Profit", required: true },
  { field: "side", label: "Side" }, { field: "openTime", label: "Open time" }, { field: "symbol", label: "Symbol" },
  { field: "size", label: "Quantity" }, { field: "entry", label: "Entry price" }, { field: "exit", label: "Exit price" },
];
