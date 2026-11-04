// From what a venue sent to a checked, signed record (DEC-0091). The trades a venue sends go
// through the same pairing and the same checks as an uploaded file (the current method version), on
// the server, so the person cannot change a number between the venue and the badge. The
// result is signed (attest.ts). Nothing here is stored: the caller returns it to the person,
// who may publish it as a badge.
import { pairFills, splitPair, type Fill } from "../verify/parse/fills";
import { checkFile, type Result } from "../verify/checks";
import { clockOf } from "../verify/range/clock";
import { planFills, type Planned, type RangeOutcome } from "../verify/range/client";
import type { PriceBook } from "../verify/prices";
import { publicCards, type PublicCards } from "../verify/publish";
import type { Parsed, Trade } from "../verify/types";
import { accountCode, cardsHash, newJti, ownHash, signRecord, type RecordClaims } from "./attest";
import { sha256Hex } from "./bytes";
import type { Range, VenueRead } from "./types";
import { VENUES } from "./venues";

/** Quote currencies counted as US dollars, one to one. */
const USD_LIKE = new Set(["USD", "USDT", "USDC", "FDUSD", "BUSD", "TUSD", "USD1", "USDP", "ZUSD"]);

/**
 * Keeps the fills in the record's main money. Crypto pairs are priced in different coins
 * (BTC-USD, ETH-BTC, SOL-EUR): profit in euros and profit in bitcoin cannot be added. Dollar
 * coins count as dollars; fills in any other money are left out and named.
 */
export function oneMoney(fills: Fill[], accountMoney = "USD"): { fills: Fill[]; money: string | null; note: string | null } {
  const quoteOf = (f: Fill) => {
    // A symbol that is not a pair (a stock, AAPL) is in the account's own money.
    const q = splitPair(f.symbol)?.quote ?? accountMoney.toUpperCase();
    return USD_LIKE.has(q) ? "USD" : q;
  };
  const count = new Map<string, number>();
  for (const f of fills) { const q = quoteOf(f); count.set(q, (count.get(q) ?? 0) + 1); }
  if (count.size <= 1) return { fills, money: [...count.keys()][0] || null, note: null };
  const main = [...count.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const left = [...count.entries()].filter(([q]) => q !== main);
  const n = left.reduce((s, [, k]) => s + k, 0);
  return {
    fills: fills.filter((f) => quoteOf(f) === main),
    money: main || null,
    note: `${n} fill${n === 1 ? "" : "s"} priced in ${left.map(([q]) => q || "another currency").join(", ")} ${n === 1 ? "was" : "were"} left out: profit in different money cannot be added up. The record is in ${main}${main === "USD" ? " (dollar coins counted as dollars)" : ""}.`,
  };
}

const csvCell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** The trades Parity read, as a CSV anyone can upload to Verify again. Its SHA-256 is on the badge. */
export function tradesCsv(trades: readonly Trade[]): string {
  const head = "open_time,close_time,symbol,side,size,entry,exit,fees,pnl";
  return [head, ...trades.map((t) => [t.openTime, t.closeTime, t.symbol, t.side, t.size, t.entry, t.exit, t.fees, t.pnl].map(csvCell).join(","))].join("\n") + "\n";
}

export interface RecordInput {
  venue: VenueRead;
  venueId: string;
  range: Range;
  tries: number;
  balance: number | null;
  userId: string;
  seed: Uint8Array;
  prices: PriceBook | null;
  now: number;
  /**
   * The fill price check (DEC-0092), run here on the server: nothing comes from a page. On
   * trades read from the broker it should pass, so it doubles as a test of our data.
   */
  fillCheck?: (plan: Planned) => Promise<RangeOutcome>;
}

export interface ConnectedRecord {
  result: Result;
  /** The badge's cards exactly as signed: publish these, not ones rebuilt in the browser. */
  cards: PublicCards;
  attestation: string;
  claims: RecordClaims;
  csv: string;
  notes: string[];
}

export async function buildRecord(x: RecordInput): Promise<ConnectedRecord> {
  const v = x.venue;
  const notes = [...v.notes];
  let trades: Trade[];
  if (v.trades) {
    trades = v.trades;
  } else {
    const groups = v.fillGroups ?? [{ fills: v.fills ?? [], allowShort: v.allowShort }];
    // One money for the whole record, chosen over every fill; then each group is paired on its own.
    const money = oneMoney(groups.flatMap((g) => g.fills), v.currency);
    if (money.note) notes.push(money.note);
    const keep = new Set(money.fills);
    trades = [];
    for (const g of groups) {
      const paired = pairFills(g.fills.filter((f) => keep.has(f)), { allowShort: g.allowShort });
      trades.push(...paired.trades);
      notes.push(...paired.warnings);
    }
    trades.sort((a, b) => (a.closeTime < b.closeTime ? -1 : a.closeTime > b.closeTime ? 1 : 0));
  }
  const name = VENUES[x.venueId as keyof typeof VENUES]?.name ?? x.venueId;
  const parsed: Parsed = {
    format: v.sameAs, table: { headers: [], rows: [] }, mapping: {}, dropped: [], trades, warnings: notes, backtestExport: false,
    what: `${name} trades, read by Parity through a read-only connection`,
  };
  const kind = v.env === "live" ? "real" : "demo";
  let ranges: RangeOutcome | null = null;
  if (x.fillCheck) {
    const plan = planFills(trades, v.sameAs, clockOf(parsed));
    ranges = plan.points.length ? await x.fillCheck(plan).catch((): RangeOutcome => ({ ran: false, why: "failed", message: "the fill price check could not run during this read." })) : { ran: false, why: "nothing" };
  }
  const result = checkFile({ parsed, prices: x.prices, triesDefaulted: x.tries === 1, answers: { kind, balance: x.balance, tries: x.tries, claim: {} }, ranges });
  result.notes = [...notes, ...result.notes];
  // Round trip through JSON so the signed hash is of exactly what the database will hold.
  const cards = JSON.parse(JSON.stringify(publicCards(result))) as PublicCards;
  const csv = tradesCsv(trades);
  const jti = newJti();
  const claims: RecordClaims = {
    v: 1, jti, iat: Math.floor(x.now / 1000), venue: x.venueId, env: v.env,
    account: await accountCode(x.seed, x.venueId, v.account), fetched_at: new Date(x.now).toISOString(),
    from: x.range.from, to: x.range.to, kind, tries: result.tries, balance: x.balance != null,
    trades: result.trades, date_from: result.dateFrom, date_to: result.dateTo, verdict: result.verdict.id,
    survives: result.card3?.survives ?? null, method: result.methodVersion,
    cards: await cardsHash(cards), file: await sha256Hex(csv), own: await ownHash(x.userId, jti),
  };
  return { result, cards, attestation: await signRecord(claims, x.seed), claims, csv, notes };
}
