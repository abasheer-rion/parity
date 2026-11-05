// Shared shapes for the read-only broker connectors (DEC-0091). Server side only: these run
// in the Pages Function at /api/connect, never in the browser, because a credential must not
// sit in a page's memory longer than one request, and some venues refuse calls from browsers.
import type { Fill } from "../verify/parse/fills";
import type { FormatId, Trade } from "../verify/types";

export type VenueId = "ibkr" | "alpaca" | "coinbase" | "kraken" | "binance" | "binance_us" | "bybit";

export const VENUE_IDS: readonly VenueId[] = ["ibkr", "alpaca", "coinbase", "kraken", "binance", "binance_us", "bybit"];
export const isVenue = (v: unknown): v is VenueId => typeof v === "string" && (VENUE_IDS as readonly string[]).includes(v);

/** The dates to read, YYYY-MM-DD, both included. */
export interface Range { from: string; to: string }

/** What a connector needs from the outside world. Tests pass recorded answers instead of the network. */
export interface VenueCtx {
  fetch: typeof fetch;
  now: () => number;
  sleep: (ms: number) => Promise<void>;
  /** Milliseconds since the epoch after which the read stops and says so. */
  deadline: number;
  /** Counts requests made to the venue, for the limit below and the log. */
  requests: { n: number };
}

/** At most this many requests to a venue for one read, whatever the venue allows. */
export const MAX_REQUESTS = 300;
/** At most this many fills in one read: the same ceiling as a file upload's rows. */
export const MAX_FILLS = 50_000;

export interface VenueRead {
  /** The venue's own account id, before it is turned into a one-way code. Never stored or returned. */
  account: string;
  env: "live" | "paper";
  /** Fills to pair first in, first out, or trades already closed (Interactive Brokers' file). */
  fills?: Fill[];
  /** Fills in groups paired apart, when some markets can be sold short and some cannot (Bybit spot and contracts). */
  fillGroups?: { fills: Fill[]; allowShort: boolean }[];
  trades?: Trade[];
  /** Spot markets cannot be sold short (a sell with nothing open closes a position from before the range). */
  allowShort: boolean;
  /** The file import whose reader matches this venue's rows, so both paths share the same checks. */
  sameAs: FormatId;
  /** Plain-words notes about what was read and what was left out. */
  notes: string[];
  /** The account's money, when the venue says. */
  currency?: string;
}

export interface Connector<C> {
  id: VenueId;
  /** Checks the shape of what the person typed. Throws ConnectError(400) in plain words. Never echoes a value. */
  credentials(raw: unknown): C;
  /** Asks the venue what the credential may do and refuses anything that can trade, move or withdraw money. */
  check(c: C, ctx: VenueCtx): Promise<void>;
  read(c: C, range: Range, ctx: VenueCtx, opts: ReadOptions): Promise<VenueRead>;
}

export interface ReadOptions {
  /** Binance only: the markets to read (Binance has no "all my trades" call). */
  symbols?: string[];
}

export type ErrorCode = "bad_input" | "refused" | "venue_auth" | "venue_limit" | "venue_down" | "too_big" | "not_set_up" | "rate_limited" | "signed_out" | "off";

/** An error whose message is safe to show the person: plain words, never a credential or a raw venue reply. */
export class ConnectError extends Error {
  constructor(public status: number, message: string, public code: ErrorCode = "bad_input") { super(message); }
}

/** A refused credential: it can do more than read. */
export const refused = (venue: string, what: string) => new ConnectError(403,
  `This ${venue} key can ${what}. Parity only takes keys that can read and nothing else. Make a new key with read access only and try again. We did not keep the key you sent.`, "refused");

export function text(raw: unknown, name: string, re: RegExp, max = 4096): string {
  const v = typeof raw === "string" ? raw.trim() : "";
  if (!v) throw new ConnectError(400, `Fill in ${name}.`);
  if (v.length > max || !re.test(v)) throw new ConnectError(400, `${name[0].toUpperCase()}${name.slice(1)} does not look right. Copy it again from the venue's page, with nothing before or after it.`);
  return v;
}

export const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);
/** "2026-01-05T14:03:09" in UTC: the clock every import uses. */
export const isoTime = (ms: number) => new Date(ms).toISOString().slice(0, 19);
export const dayStart = (d: string) => Date.parse(`${d}T00:00:00Z`);
export const dayEnd = (d: string) => Date.parse(`${d}T23:59:59.999Z`);
