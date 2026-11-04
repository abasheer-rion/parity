// The fill price check (DEC-0092): was each fill's price one the market actually traded at
// that time? The browser sends only the symbol, the time and the price of each fill; the
// server compares them with market data (minute bars where it has them, else the day's low
// and high) and sends back one answer per fill. The bars themselves never leave the server:
// they are used for this computation only, never shown and never passed on.

/** Bump with any change to a tolerance, a window or a source, so a result says which rules made it. */
export const RANGE_VERSION = "fills-1.0";

/**
 * Which clock the file's times are written in. "utc" when the file says so (a header such as
 * "Date(UTC)", a zone in the cell, or a venue that always writes UTC); "new_york" for
 * Interactive Brokers; otherwise "unknown", and the server tries every time zone.
 */
export type Clock = "utc" | "new_york" | "unknown";

/** One fill as it leaves the browser: symbol, time and price, nothing else. */
export interface FillPoint {
  /** The symbol as the file writes it. */
  s: string;
  /** Wall time in the request's clock, "YYYY-MM-DDTHH:MM" or with seconds. */
  t: string;
  /** Price per unit. */
  p: number;
}

export interface RangeRequest {
  clock: Clock;
  fills: FillPoint[];
}

/**
 * The answer for one fill:
 * - "in": inside the traded range, with the tolerance below.
 * - "out": outside it, by more than the tolerance.
 * - "closed": timed when the market was closed (US stocks on a weekend or a market holiday).
 * - "none": not checked, with why in `n`.
 */
export type FillStatus = "in" | "out" | "closed" | "none";

/**
 * Why a fill was not checked: "sym" no source we may use covers the symbol; "data" the source
 * had no trading near that time; "late" too recent for the source; "busy" the source refused
 * or failed; "more" this request's budget ran out (send it again); "time" the source can only
 * be read around an exact time, and the fill has no time of day or no known time zone; "old"
 * older than the source keeps.
 */
export type NoneWhy = "sym" | "data" | "late" | "busy" | "more" | "time" | "old";

export interface FillAnswer {
  r: FillStatus;
  n?: NoneWhy;
  /**
   * Against the day's range on our source: at (within 0.05% of, or past) its high ("h") or its
   * low ("l"), or neither ("n"). Absent when the day's range is not known for this fill.
   */
  e?: "h" | "l" | "n";
  /** Bars used: "m" minute bars around the time, "d" the day's low and high. */
  b?: "m" | "d";
  /** Which source answered, an id from SOURCES. */
  src?: string;
}

export interface RangeAnswer {
  v: typeof RANGE_VERSION;
  /** One answer per fill, in the order sent. */
  fills: FillAnswer[];
  /**
   * For an unknown clock: the time zone that fits the most fills, as minutes east of UTC
   * (120 for UTC+2), or null when there were too few fills to tell.
   */
  offset: number | null;
  /** Symbols no source we may use covers. */
  unsupported: string[];
}

/** How much one request may do. The page sends the fills again in parts until all are answered. */
export const LIMITS = {
  /** Fills in one request. */
  fills: 1000,
  /** Different symbols in one request. */
  symbols: 60,
  /** Calls to market data sources in one request. */
  upstream: 120,
  /** Time spent fetching in one request, ms. */
  fetchMs: 20_000,
  /** Times the page sends what is left. */
  rounds: 8,
} as const;

/** Fewest fills with an unknown clock before the server picks a time zone for them. */
export const MIN_FOR_OFFSET = 5;

/** Within this of the day's high or low counts as "at" it (and as the day's best price for "perfect timing"). */
export const EDGE = 0.0005;
