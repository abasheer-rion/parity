// The files Verify reads, in words, for the "Supported files" list on /verify/ and the
// methodology page, with how far each layout has been checked:
//   tested  a real export of this kind is in tests/fixtures/verify/real (SOURCES.md says where
//           it came from, under which licence) and the tests check the trades read from it;
//   layout  the header and cell formats were copied from a real export we could see but not
//           publish, into a fixture with made-up numbers (tests/fixtures/verify/layout);
//   docs    written from the platform's help pages and journal apps' import guides only:
//           shown as "unverified layout".
import type { FormatId } from "../types";

export type Checked = "tested" | "layout" | "docs";

export interface Supported {
  id: FormatId;
  name: string;
  /** Where the person gets the file. */
  how: string;
  /** "fills" are paired first in, first out into round trips; "trades" are already round trips. */
  rows: "fills" | "trades" | "deals" | "equity";
  checked: Checked;
  /** True unless the layout comes from help pages only. */
  verified: boolean;
  /** What is not taken off or cannot be read, in words. */
  note?: string;
}

const S = (id: FormatId, name: string, how: string, rows: Supported["rows"], checked: Checked, note?: string): Supported =>
  ({ id, name, how, rows, checked, verified: checked !== "docs", ...(note ? { note } : {}) });

export const SUPPORTED: Supported[] = [
  S("mt4", "MetaTrader 4 statement", "Account History, right click, Save as Report or Save as Detailed Report (HTML). A CSV with the same columns works too.", "trades", "tested", "Times are the broker's server time."),
  S("mt4tester", "MetaTrader 4 Strategy Tester report", "Strategy Tester, Report, right click, Save as Report. Always a backtest.", "trades", "tested"),
  S("mt5", "MetaTrader 5 report", "History tab, right click, Report, HTML or Open XML. Read in any language the terminal uses.", "trades", "tested", "Times are the broker's server time."),
  S("mt5deals", "MetaTrader 5 deals and Strategy Tester report", "A deals table, or Strategy Tester, Backtest, right click, Report, HTML. A tester report is always a backtest.", "deals", "tested"),
  S("tradingview", "TradingView list of trades", "Strategy Tester, List of trades, Export (CSV, or the Excel download). Always a backtest.", "trades", "tested"),
  S("myfxbook", "Myfxbook trade history", "Your portfolio, History, Export, CSV.", "trades", "tested"),
  S("ibkr", "Interactive Brokers, Flex Query trades", "Performance & Reports, Flex Queries, a Trades query saved as CSV, with or without header and trailer records.", "fills", "tested", "Amounts in other currencies are turned into the base currency with the rate in the file."),
  S("ibkr_activity", "Interactive Brokers, activity statement", "Performance & Reports, Statements, Activity, download as CSV. Only the Trades section is read.", "fills", "tested", "The statement has no exchange rates, so several currencies are flagged."),
  S("binance_spot", "Binance spot trade history", "Orders, Spot Order, Trade History, Export.", "fills", "tested", "Fees paid in BNB cannot be priced and are not taken off."),
  S("binance_statement", "Binance account statement", "Wallet, Transaction History, Generate all statements.", "fills", "tested"),
  S("binance_futures", "Binance futures trade history", "Orders, Futures, Trade History, Export (USDS-M).", "fills", "layout", "Fees paid in BNB cannot be priced and are not taken off."),
  S("bybit", "Bybit trade history", "Orders, Trade History, Export, spot or derivatives.", "fills", "docs"),
  S("bybit_pnl", "Bybit closed P&L", "Orders, Derivatives, Closed P&L, Export.", "trades", "docs", "It is not known whether Bybit's closed profit has fees taken off."),
  S("coinbase_tx", "Coinbase transaction report", "Profile, Statements, Transaction history, Generate report (CSV).", "fills", "tested", "Sends, receives, rewards and staking are not trades and are left out."),
  S("coinbase", "Coinbase Pro fills", "The fills.csv of Coinbase Pro (now Advanced Trade).", "fills", "tested"),
  S("kraken", "Kraken trades", "History, Export, Trades (trades.csv). Not ledgers.csv.", "fills", "tested"),
  S("ctrader", "cTrader history", "History tab, export the closed positions (Excel or CSV).", "trades", "tested"),
  S("ninjatrader", "NinjaTrader 8 trade performance", "Trade Performance, Trades, right click, Export.", "trades", "tested"),
  S("tradovate", "Tradovate performance", "Reports, Performance, Download.", "trades", "layout", "Profit is before commissions and exchange fees."),
  S("tradovate_positions", "Tradovate position history", "Reports, Position History, Download.", "trades", "tested", "Profit is before commissions and exchange fees."),
  S("tradovate_orders", "Tradovate orders", "Orders, Download. Filled orders are paired into round trips.", "fills", "tested", "No commissions in this list; futures use the exchange's contract size."),
  S("tos", "thinkorswim account statement", "Monitor, Account Statement, Export to File. Only the Account Trade History section is read.", "fills", "tested", "Fees are not taken off. Futures use the exchange's contract size."),
  S("alpaca", "Alpaca account activities", "Account activities from the API (JSON) or a CSV with activity_type, transaction_time, symbol, side, qty and price.", "fills", "tested"),
  S("trades", "Any trade list", "A CSV with a close date and a profit per trade.", "trades", "tested"),
  S("equity", "Any equity curve", "A CSV with a date and an account value or a return.", "equity", "tested"),
];

export const CHECKED_TEXT: Record<Checked, string> = {
  tested: "Tested on a real export",
  layout: "Layout copied from a real export",
  docs: "Unverified layout",
};
