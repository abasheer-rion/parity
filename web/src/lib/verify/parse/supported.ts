// The files Verify reads, in words, for the "Supported files" list on /verify/ and the
// methodology page. `verified` is true only for a layout checked against an official export
// file; every other layout is written from the platform's help pages and journal apps'
// import guides, and is shown as "unverified layout".
import type { FormatId } from "../types";

export interface Supported {
  id: FormatId;
  name: string;
  /** Where the person gets the file. */
  how: string;
  /** "fills" are paired first in, first out into round trips; "trades" are already round trips. */
  rows: "fills" | "trades" | "deals" | "equity";
  verified: boolean;
  /** What is not taken off or cannot be read, in words. */
  note?: string;
}

export const SUPPORTED: Supported[] = [
  { id: "ibkr", name: "Interactive Brokers, Flex Query trades", how: "Reports, Flex Queries, a Trades query saved as CSV.", rows: "fills", verified: false },
  { id: "ibkr_activity", name: "Interactive Brokers, activity statement", how: "Reports, Statements, Activity, download as CSV. Only the Trades section is read.", rows: "fills", verified: false },
  { id: "binance_spot", name: "Binance spot trade history", how: "Orders, Spot Order, Trade History, Export.", rows: "fills", verified: false, note: "Fees paid in BNB cannot be priced and are not taken off." },
  { id: "binance_futures", name: "Binance futures trade history", how: "Orders, Futures, Trade History, Export (USDS-M).", rows: "fills", verified: false },
  { id: "bybit", name: "Bybit trade history", how: "Orders, Trade History, Export, spot or derivatives.", rows: "fills", verified: false },
  { id: "bybit_pnl", name: "Bybit closed P&L", how: "Orders, Derivatives, Closed P&L, Export.", rows: "trades", verified: false },
  { id: "coinbase", name: "Coinbase Advanced trade fills", how: "Advanced trade, Orders, Fills, Download CSV.", rows: "fills", verified: false },
  { id: "kraken", name: "Kraken trades", how: "History, Export, Trades (trades.csv).", rows: "fills", verified: false },
  { id: "ctrader", name: "cTrader history", how: "History tab, right click, export the closed positions.", rows: "trades", verified: false },
  { id: "ninjatrader", name: "NinjaTrader 8 trade performance", how: "Trade Performance, Trades, right click, Export.", rows: "trades", verified: false },
  { id: "tradovate", name: "Tradovate performance", how: "Reports, Performance, Download.", rows: "trades", verified: false, note: "Profit is before commissions and exchange fees." },
  { id: "tos", name: "thinkorswim account statement", how: "Monitor, Account Statement, Export to File. Only the Account Trade History section is read.", rows: "fills", verified: false, note: "Fees are not taken off. Futures rows are left out." },
  { id: "alpaca", name: "Alpaca account activities", how: "Account activities with activity_type, transaction_time, symbol, side, qty and price.", rows: "fills", verified: false },
  { id: "mt5deals", name: "MetaTrader 5 deals", how: "History tab, Report, saved as CSV.", rows: "deals", verified: false },
  { id: "mt5", name: "MetaTrader 5 positions", how: "History tab, Report, saved as CSV.", rows: "trades", verified: false },
  { id: "mt4", name: "MetaTrader 4 history", how: "Account History, Save as Detailed Report, saved as CSV.", rows: "trades", verified: false },
  { id: "tradingview", name: "TradingView list of trades", how: "Strategy Tester, List of trades, Export. Always a backtest.", rows: "trades", verified: false },
  { id: "trades", name: "Any trade list", how: "A CSV with a close date and a profit per trade.", rows: "trades", verified: true },
  { id: "equity", name: "Any equity curve", how: "A CSV with a date and an account value or a return.", rows: "equity", verified: true },
];
