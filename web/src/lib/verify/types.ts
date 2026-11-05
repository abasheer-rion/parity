// Shapes shared by Verify's parsers, checks and page (REF-0016). Everything here lives
// in the browser only: a parsed file is never sent anywhere.

/** Bump when a check or a threshold changes, so a badge says which rules judged it. */
export const METHOD_VERSION = "verify-1.3";

/**
 * Every method version, newest first, with the date it took effect and what changed. The
 * public methodology page (/methodology/) prints this list, so add a row whenever
 * METHOD_VERSION changes (a test checks the first row matches it).
 */
export const METHOD_CHANGELOG: { version: string; date: string; changes: string }[] = [
  { version: "verify-1.3", date: "2026-11-04", changes: "Fill prices against market data: with the person's leave, the symbol, time and price of each fill go to our server, which compares them with the range traded at that time (IEX exchange trades for US stocks once switched on, swaps in our on-chain pools for crypto) and counts fills outside it, at the day's exact high or low, and timed while the market was closed. Two new rows on card 4, \"fill prices against the traded range\" and \"fills while the market was closed\", each failing when more than 2 in 100 checked fills, and at least 2, are outside or closed. \"Perfect timing\" uses the day's real low and high from this check when at least 10 entries have one." },
  { version: "verify-1.2", date: "2026-11-03", changes: "Claims can be read from a seller's page or words, each with the words it came from. \"Claim against file\" also compares the total return: it fails when the file is more than 5 points and more than a tenth away from the claim, unless the claim names a length of time more than a quarter away from the record's. The report draws the record against the S&P 500 when our daily prices are loaded, and the spread of profit per trade for a trade list without a balance." },
  { version: "verify-1.1", date: "2026-11-03", changes: "Strategy code: Pine Script, Python and rules are run on our daily closes with retail costs. The luck check counts the stated tries plus the nearby settings we ran. Two checks for code: \"perfect timing\" compares a run filled one day late, and \"settings next to yours\" fails when fewer than half of the nearby settings make money. \"Many settings, few trades\" now applies to code too." },
  { version: "verify-1.0", date: "2026-10-24", changes: "First version: five verdicts in a fixed order, five check cards, the luck check (deflated Sharpe ratio) with \"survives up to N tries\", claim arithmetic, and fill checks against one price a day." },
];

export type InputKind = "real" | "demo" | "backtest";
export type Source = "file" | "description" | "strategy" | "code";

/** One closed trade, after personal columns were dropped. Money is in the account's currency. */
export interface Trade {
  /** Ticket, position or trade number, when the file has one. */
  id?: string;
  openTime?: string;
  /** ISO date and time, "YYYY-MM-DDTHH:MM:SS" (the file's own clock, no time zone). */
  closeTime: string;
  symbol?: string;
  side?: "buy" | "sell";
  size?: number;
  entry?: number;
  /** True when the entry is the average of opening fills at different prices, so no fill was at it. */
  entryMixed?: boolean;
  exit?: number;
  /** Commission, swap and fees, as a cost (negative when a swap paid the account). */
  fees: number;
  /** Profit after fees. */
  pnl: number;
}

/** One row of an equity curve: a value, or a return, plus any money paid in (+) or out (-). */
export interface EquityPoint { date: string; equity?: number; ret?: number; cashflow?: number }

export type FormatId =
  | "mt4" | "mt5" | "mt5deals" | "tradingview"
  | "ibkr" | "ibkr_activity" | "binance_spot" | "binance_futures" | "bybit" | "bybit_pnl" | "bybit_closed" | "coinbase" | "kraken"
  | "ctrader" | "ninjatrader" | "tradovate" | "tos" | "alpaca"
  | "binance_statement" | "coinbase_tx" | "myfxbook" | "mt4tester" | "tradovate_positions" | "tradovate_orders"
  | "trades" | "equity";

export const FORMAT_LABEL: Record<FormatId, string> = {
  mt4: "MetaTrader 4 history",
  mt5: "MetaTrader 5 history",
  mt5deals: "MetaTrader 5 deals",
  tradingview: "TradingView list of trades",
  ibkr: "Interactive Brokers Flex trades",
  ibkr_activity: "Interactive Brokers activity statement",
  binance_spot: "Binance spot trade history",
  binance_futures: "Binance futures trade history",
  bybit: "Bybit trade history",
  bybit_pnl: "Bybit closed P&L",
  bybit_closed: "Bybit closed positions",
  coinbase: "Coinbase fills",
  kraken: "Kraken trades",
  ctrader: "cTrader history",
  ninjatrader: "NinjaTrader trades",
  tradovate: "Tradovate performance",
  tos: "thinkorswim trade history",
  alpaca: "Alpaca activities",
  binance_statement: "Binance account statement",
  coinbase_tx: "Coinbase transaction report",
  myfxbook: "Myfxbook trade history",
  mt4tester: "MetaTrader 4 Strategy Tester report",
  tradovate_positions: "Tradovate position history",
  tradovate_orders: "Tradovate orders",
  trades: "Trade list",
  equity: "Equity curve",
};

/** The fields a column can be mapped to. */
export type Field =
  | "id" | "openTime" | "closeTime" | "symbol" | "side" | "size" | "entry" | "exit" | "commission" | "swap" | "fees" | "pnl"
  | "date" | "equity" | "ret" | "cashflow" | "direction" | "tvType" | "position"
  | "value" | "multiplier" | "realized" | "feeCurrency" | "rowType" | "expiry" | "strike" | "assetType"
  | "fxRate" | "currency" | "tax" | "balance";

export type Mapping = Partial<Record<Field, number>>;

/**
 * A table read from a file, after personal columns were removed. `lines` holds where each
 * row is in the file (a CSV line, or a sheet or HTML table row), so a problem can name it.
 */
export interface Table { headers: string[]; rows: string[][]; lines?: number[]; unit?: "line" | "row" }

export interface Parsed {
  format: FormatId;
  table: Table;
  mapping: Mapping;
  /** Names of the columns removed because they look personal. Names only, never values. */
  dropped: string[];
  trades?: Trade[];
  equity?: EquityPoint[];
  warnings: string[];
  /** How the file was read, in words, for information: "times are the broker's server time". */
  notes?: string[];
  /** True for a Strategy Tester export (TradingView, MetaTrader): a backtest, not real trading. */
  backtestExport: boolean;
  /** What the file is, in words, when it says more than the format's label ("MetaTrader 5 Strategy Tester report"). */
  what?: string;
  /** First equity value or balance found in the file, if any. */
  inferredBalance?: number;
}

/** The four questions asked before any check runs (REF-0016, input A). */
export interface Answers {
  kind: InputKind;
  /** Starting balance; null when unknown (then only per-trade checks run). */
  balance: number | null;
  /** How many strategies, bots or settings were tried before this one. */
  tries: number;
  claim: Claim;
  /** For equity curves with no cash flow column: the person confirmed there were none. */
  noCashflows?: boolean;
}

/** What was claimed, for example on a seller's page. Rates are fractions (0.92 = 92%). */
export interface Claim {
  winRate?: number;
  monthlyReturn?: number;
  /** Total return over the whole record, as a fraction (3.4 = +340%). */
  totalReturn?: number;
  /** Return a year, as the seller states it. */
  yearlyReturn?: number;
  profitFactor?: number;
  /** The day the record is said to start, YYYY-MM-DD. */
  startDate?: string;
  maxDrawdown?: number;
  /** Take-profit and stop-loss as a share of the position (0.05 = 5%). */
  takeProfit?: number;
  stopLoss?: number;
  avgLoss?: number;
  /** Largest single loss, as a share of the account. */
  maxLoss?: number;
  tradesPerMonth?: number;
  trades?: number;
  months?: number;
  leverage?: number;
  holding?: string;
  grid?: boolean;
  martingale?: boolean;
  maxLossCapped?: boolean;
}
