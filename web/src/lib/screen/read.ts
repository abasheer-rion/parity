// Reading a firm's upload into accounts for the batch screen (DEC-0087). Three shapes work:
//   - one long CSV with an account column and one row per trade
//   - a zip (or several files) with one trade file per account, named by the account
//   - either of those plus an optional details file: one row per account with any of the
//     starting balance, attempts, whether it passed, and what happened later (the outcome)
// Each account's rows go through Verify's own readers (REF-0016), so every broker format
// Verify reads works here too, and personal columns are dropped the same way. Runs in the
// browser: nothing here sends anything anywhere.
import { num, ParseError, readTable } from "../verify/csv";
import { parseTable, parseText } from "../verify/parse";
import type { Table } from "../verify/types";
import type { AccountInput, Outcome } from "./score";
import { isZip, readZip } from "./unzip";

export const MAX_ACCOUNTS = 5_000;
export const MAX_BATCH_ROWS = 1_000_000;

const norm = (h: string) => h.toLowerCase().replace(/[_.-]+/g, " ").replace(/\s+/g, " ").trim();

const ACCOUNT = /^(account|account ?(id|number|no|num|#|login|name)|acct( ?id)?|login|trader( ?id)?|user ?id|challenge( ?id| ?account)?)$/;
/** Columns that describe the account, not a trade. In a trade file only the explicit names count. */
const META_TRADE_FILE = {
  balance: /^(starting ?balance|start ?balance|initial ?balance|account ?size|challenge ?size)$/,
  tries: /^(attempts?|tries|challenge ?attempts?|challenges ?taken|resets?)$/,
  passed: /^(passed|challenge ?(passed|result|status))$/,
  outcome: /^(outcome|later ?outcome|funded ?(outcome|result)|after ?funding)$/,
};
const META_DETAILS = {
  ...META_TRADE_FILE,
  balance: /^(starting ?balance|start ?balance|initial ?balance|account ?size|challenge ?size|balance|size)$/,
  passed: /^(passed|pass|challenge ?(passed|result|status)|status|result)$/,
};
type MetaKey = keyof typeof META_TRADE_FILE;

export function passedOf(cell: string | undefined): boolean | null {
  const s = (cell ?? "").trim().toLowerCase();
  if (/^(y|yes|true|1|pass|passed|funded)$/.test(s)) return true;
  if (/^(n|no|false|0|fail|failed|breached|not passed|did not pass)$/.test(s)) return false;
  return null;
}

export function outcomeOf(cell: string | undefined): Outcome | null {
  const s = (cell ?? "").trim().toLowerCase();
  if (!s) return null;
  if (/blow|breach|fail|terminat|bust|liquidat|^loss|^bad$|^lost$/.test(s)) return "blowup";
  if (/payout|paid|withdr|profit|success|^good$|^win/.test(s)) return "payout";
  return null;
}

interface Meta { balance?: number; tries?: number; passed?: boolean; outcome?: Outcome }

function metaFrom(row: string[], cols: Partial<Record<MetaKey, number>>): Meta {
  const m: Meta = {};
  if (cols.balance != null) { const v = num(row[cols.balance]); if (v != null && v > 0) m.balance = v; }
  if (cols.tries != null) { const v = num(row[cols.tries]); if (v != null && v >= 1) m.tries = Math.round(v); }
  if (cols.passed != null) { const v = passedOf(row[cols.passed]); if (v != null) m.passed = v; }
  if (cols.outcome != null) { const v = outcomeOf(row[cols.outcome]); if (v) m.outcome = v; }
  return m;
}

function findCols(headers: string[], pats: Record<MetaKey, RegExp>): { account?: number; meta: Partial<Record<MetaKey, number>> } {
  const meta: Partial<Record<MetaKey, number>> = {};
  let account: number | undefined;
  headers.forEach((h, i) => {
    const n = norm(h);
    if (account == null && ACCOUNT.test(n)) { account = i; return; }
    for (const k of Object.keys(pats) as MetaKey[]) if (meta[k] == null && pats[k].test(n)) { meta[k] = i; return; }
  });
  return { account, meta };
}

const without = (t: Table, drop: number[]): Table => {
  const keep = t.headers.map((_, i) => i).filter((i) => !drop.includes(i));
  return { headers: keep.map((i) => t.headers[i]), rows: t.rows.map((r) => keep.map((i) => r[i] ?? "")) };
};

export interface FileIn { name: string; bytes: Uint8Array }

export interface ReadResult {
  accounts: AccountInput[];
  /** Accounts that could not be read, and why. */
  skipped: { id: string; why: string }[];
  /** Things worth saying about the upload as a whole. */
  notes: string[];
  /** How the accounts were found: one long file, one file per account, or both. */
  shape: "long" | "per-file" | "mixed";
  /** Whether a details file (balance, attempts, passed, outcome) was found. */
  details: boolean;
}

const decode = (b: Uint8Array) => new TextDecoder("utf-8").decode(b);
const baseName = (name: string) => (name.split("/").pop() ?? name).replace(/\.(csv|tsv|txt)$/i, "");

/** Files out of the upload, with zips opened. */
async function expand(files: readonly FileIn[]): Promise<FileIn[]> {
  const out: FileIn[] = [];
  for (const f of files) {
    if (isZip(f.bytes)) out.push(...(await readZip(f.bytes)));
    else out.push(f);
  }
  return out.filter((f) => /\.(csv|tsv|txt)$/i.test(f.name) || !/\.[a-z0-9]{2,5}$/i.test(f.name));
}

/**
 * Reads the upload. `files` are the trade files (CSV, or zips of them); `detailsFile` is the
 * optional one-row-per-account file. A details file can also sit inside the zip or among
 * the files: any file with an account column and no trade columns is read as one.
 */
export async function readBatch(files: readonly FileIn[], detailsFile?: FileIn | null): Promise<ReadResult> {
  const all = await expand(files);
  const skipped: ReadResult["skipped"] = [];
  const notes: string[] = [];
  const trades = new Map<string, Table | string>();
  const meta = new Map<string, Meta>();
  const addMeta = (id: string, m: Meta) => meta.set(id, { ...m, ...meta.get(id) });
  let long = false, perFile = false, details = false;

  const readDetails = (t: Table, cols: ReturnType<typeof findCols>) => {
    details = true;
    for (const row of t.rows) {
      const id = (row[cols.account!] ?? "").trim();
      if (id) addMeta(id, metaFrom(row, cols.meta));
    }
  };

  if (detailsFile) {
    const t = readTable(decode((await expand([detailsFile]))[0]?.bytes ?? detailsFile.bytes), MAX_BATCH_ROWS);
    const cols = findCols(t.headers, META_DETAILS);
    if (cols.account == null) throw new ParseError("The details file needs an account column (account, account id, login or trader id).");
    readDetails(t, cols);
  }

  for (const f of all) {
    let t: Table;
    try {
      t = readTable(decode(f.bytes), MAX_BATCH_ROWS);
    } catch (e) {
      skipped.push({ id: baseName(f.name), why: e instanceof Error ? e.message : String(e) });
      continue;
    }
    const cols = findCols(t.headers, META_TRADE_FILE);
    if (cols.account != null) {
      const rest = without(t, [cols.account, ...Object.values(cols.meta)]);
      // An account column and nothing that reads as trades: a details file.
      const probe = parseTable({ headers: rest.headers, rows: rest.rows.slice(0, 200) });
      if (!probe.trades?.length) {
        readDetails(t, findCols(t.headers, META_DETAILS));
        continue;
      }
      long = true;
      const groups = new Map<string, string[][]>();
      t.rows.forEach((row, i) => {
        const id = (row[cols.account!] ?? "").trim();
        if (!id) return;
        if (!groups.has(id)) groups.set(id, []);
        groups.get(id)!.push(rest.rows[i]);
        addMeta(id, metaFrom(row, cols.meta));
      });
      for (const [id, rows] of groups) {
        const prev = trades.get(id);
        trades.set(id, { headers: rest.headers, rows: prev && typeof prev !== "string" ? [...prev.rows, ...rows] : rows });
      }
    } else {
      perFile = true;
      const id = baseName(f.name);
      if (trades.has(id)) { skipped.push({ id, why: "Two files have this name; the second was left out." }); continue; }
      // The whole text, so statements with several sections are read the way Verify reads them.
      trades.set(id, decode(f.bytes));
    }
    if (trades.size > MAX_ACCOUNTS) throw new ParseError(`More than ${MAX_ACCOUNTS.toLocaleString("en-US")} accounts. Split the batch, or use the API.`);
  }

  const accounts: AccountInput[] = [];
  for (const [id, t] of trades) {
    let p;
    try {
      p = typeof t === "string" ? parseText(t) : parseTable(t);
    } catch (e) {
      skipped.push({ id, why: e instanceof Error ? e.message : String(e) });
      continue;
    }
    const list = p.trades ?? [];
    if (!list.length) {
      skipped.push({ id, why: p.equity?.length ? "This is an equity curve. The screen needs closed trades." : p.warnings[0] ?? "No closed trades could be read." });
      continue;
    }
    const m = meta.get(id) ?? {};
    accounts.push({
      id, trades: list,
      balance: m.balance ?? p.inferredBalance ?? null,
      tries: m.tries ?? null, passed: m.passed ?? null, outcome: m.outcome ?? null,
    });
  }
  const noTrades = [...meta.keys()].filter((id) => !trades.has(id));
  if (noTrades.length) {
    const one = noTrades.length === 1;
    notes.push(`${noTrades.length.toLocaleString("en-US")} ${one ? "account is" : "accounts are"} in the details but ${one ? "has" : "have"} no trades, and ${one ? "is" : "are"} left out.`);
  }
  if (!accounts.length && !skipped.length) throw new ParseError("No trade files were found. Upload a CSV with an account column, or a zip of one trade file per account.");
  accounts.sort((a, b) => a.id.localeCompare(b.id, "en", { numeric: true }));
  return { accounts, skipped, notes, shape: long && perFile ? "mixed" : long ? "long" : "per-file", details };
}
