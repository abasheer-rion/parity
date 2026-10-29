// Shapes shared by Verify's parsers, checks and page (REF-0016). Everything here lives
// in the browser only: a parsed file is never sent anywhere.

/** Bump when a check or a threshold changes, so a badge says which rules judged it. */
export const METHOD_VERSION = "verify-1.0";

/**
 * Every method version, newest first, with the date it took effect and what changed. The
 * public methodology page (/methodology/) prints this list, so add a row whenever
 * METHOD_VERSION changes (a test checks the first row matches it).
 */
export const METHOD_CHANGELOG: { version: string; date: string; changes: string }[] = [
  { version: "verify-1.0", date: "2026-10-24", changes: "First version: five verdicts in a fixed order, five check cards, the luck check (deflated Sharpe ratio) with \"survives up to N tries\", claim arithmetic, and fill checks against one price a day." },
];

export type InputKind = "real" | "demo" | "backtest";
export type Source = "file" | "description" | "strategy";

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
  | "ibkr" | "ibkr_activity" | "binance_spot" | "binance_futures" | "bybit" | "bybit_pnl" | "coinbase" | "kraken"
  | "ctrader" | "ninjatrader" | "tradovate" | "tos" | "alpaca"
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
  coinbase: "Coinbase fills",
  kraken: "Kraken trades",
  ctrader: "cTrader history",
  ninjatrader: "NinjaTrader trades",
  tradovate: "Tradovate performance",
  tos: "thinkorswim trade history",
  alpaca: "Alpaca activities",
  trades: "Trade list",
  equity: "Equity curve",
};

/** The fields a column can be mapped to. */
export type Field =
  | "id" | "openTime" | "closeTime" | "symbol" | "side" | "size" | "entry" | "exit" | "commission" | "swap" | "fees" | "pnl"
  | "date" | "equity" | "ret" | "cashflow" | "direction" | "tvType" | "position"
  | "value" | "multiplier" | "realized" | "feeCurrency" | "rowType" | "expiry" | "strike" | "assetType";

export type Mapping = Partial<Record<Field, number>>;

/** A table read from a CSV file, after personal columns were removed. */
export interface Table { headers: string[]; rows: string[][] }

export interface Parsed {
  format: FormatId;
  table: Table;
  mapping: Mapping;
  /** Names of the columns removed because they look personal. Names only, never values. */
  dropped: string[];
  trades?: Trade[];
  equity?: EquityPoint[];
  warnings: string[];
  /** True for a TradingView Strategy Tester export: a backtest, not real trading. */
  backtestExport: boolean;
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
