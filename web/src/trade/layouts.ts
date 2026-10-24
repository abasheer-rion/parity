// Named Parity Trade layouts saved to the person's account (DEC-0038): the chart grid,
// its symbols and timeframes, indicators and panel sizes. The table is
// supabase/migrations/20261027000000_trade_layouts.sql; each person sees only their own
// rows, and the local preview keeps them in this browser (lib/userStore.ts).
import { table, type Row } from "../lib/userStore";
import type { Layout } from "./state";

export interface LayoutRow extends Row { name: string; state: Layout; position: number }

export const layoutsTable = table<LayoutRow>("trade_layouts");

export const MAX_LAYOUTS = 20;
