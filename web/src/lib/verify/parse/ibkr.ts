// Interactive Brokers. Two exports, both lists of fills, paired first in, first out (fills.ts).
// Checked against real exports (tests/fixtures/verify/real/SOURCES.md):
//
//   Flex Query, Trades section, as CSV: ClientAccountID, CurrencyPrimary, FXRateToBase,
//   AssetClass, Symbol, Multiplier, DateTime ("2021-10-31;21:37:35", or "20201102;143920"),
//   Quantity (negative for sales), TradePrice, Proceeds, Taxes, IBCommission (negative is a
//   cost, positive a rebate), Open/CloseIndicator, FifoPnlRealized, Buy/Sell, order and trade
//   ids. With header and trailer records on, every row starts with HEADER or DATA and TRNT
//   (sections.ts). Amounts are turned into the base currency with FXRateToBase.
//   Activity statement, Trades section: rows of "Trades,Data,Order,Stocks,USD,AAPL,"2024-01-03,
//   10:15:00",100,185.5,...", read by sections.ts. Columns DataDiscriminator, Asset Category,
//   Currency, (Account), Symbol, Date/Time, Quantity, T. Price, C. Price, Proceeds, Comm/Fee
//   (or "Comm in USD" for Forex), Basis, Realized P/L, MTM P/L, Code. It gives no exchange
//   rates, so a statement in several currencies is flagged.
//
// Profit is worked out from the fills (Proceeds carries the contract multiplier for options
// and futures). IBKR's own realized profit, which already has commissions taken off, is used
// only for a closing fill whose opening fill is before the file starts. Times are as IBKR
// writes them, in US Eastern time.
import type { Mapping, Table } from "../types";
import { col, compact } from "./common";
import { pairFills, readFills } from "./fills";
import { FILL_FIELDS, score, type BuildOut, type FormatDef } from "./format";

const ACCOUNT_IDS = [/^client ?account ?id$/i, /^account ?alias$/, /^acct ?alias$/, /^(ib)?order ?id$/, /^trade ?id$/, /^(ib)?exec ?id$/, /^order ?reference$/, /^brokerage ?order ?id$/, /^ext ?exec ?id$/, /^orig ?(trade|order|transaction) ?id$/, /^transaction ?id$/, /^related ?trade ?id$/, /^ib ?exec ?id$/];

const EASTERN = "Interactive Brokers writes times in US Eastern time; days are counted in that time.";

export const ibkrFlex: FormatDef = {
  id: "ibkr",
  detect: (t) => {
    const s = score(t, [[3, [/^tradeprice$/, /^trade price$/]], [3, [/^ibcommission$/, /^ib commission$/]], [1, [/^quantity$/]], [1, [/^symbol$/]], [1, [/^datetime$/, /^date\/time$/, /^tradedate$/]]]);
    return s >= 7 ? s + 2 : 0;
  },
  map: (t: Table): Mapping => {
    const h = t.headers;
    return compact({
      closeTime: col(h, [/^datetime$/, /^date\/time$/]) ?? col(h, [/^tradedate$/, /^trade date$/]), symbol: col(h, [/^symbol$/]),
      side: col(h, [/^buy\/sell$/]), size: col(h, [/^quantity$/]), entry: col(h, [/^tradeprice$/, /^trade price$/]),
      value: col(h, [/^proceeds$/]), multiplier: col(h, [/^multiplier$/]), fees: col(h, [/^ibcommission$/, /^ib commission$/]), tax: col(h, [/^taxes$/]),
      realized: col(h, [/^fifopnlrealized$/, /^fifo pnl realized$/]), currency: col(h, [/^currencyprimary$/, /^currency$/]), fxRate: col(h, [/^fxratetobase$/, /^fx rate to base$/]),
    });
  },
  build: (t, m): BuildOut => {
    // The commission currency is the account's, not a coin: only a column for it is read.
    const { fills, warnings } = readFills(t, { ...m, feeCurrency: undefined }, { feeNegative: true });
    const res = pairFills(fills, { allowShort: true, realizedNet: true });
    return { trades: res.trades, warnings: [...warnings, ...res.warnings], notes: [EASTERN] };
  },
  fields: [...FILL_FIELDS, { field: "tax", label: "Taxes" }, { field: "currency", label: "Currency" }, { field: "fxRate", label: "Rate to base currency" }],
  drop: ACCOUNT_IDS,
};

export const ibkrActivity: FormatDef = {
  id: "ibkr_activity",
  detect: (t) => {
    const s = score(t, [[3, [/^t\. price$/]], [3, [/^comm\/fee$/, /^comm in [a-z]{3}$/]], [1, [/^date\/time$/]], [1, [/^proceeds$/]], [1, [/^datadiscriminator$/]]]);
    return s >= 7 ? s + 2 : 0;
  },
  map: (t) => {
    const h = t.headers;
    return compact({
      rowType: col(h, [/^datadiscriminator$/]), assetType: col(h, [/^asset category$/]), closeTime: col(h, [/^date\/time$/]),
      symbol: col(h, [/^symbol$/]), size: col(h, [/^quantity$/]), entry: col(h, [/^t\. price$/]), value: col(h, [/^proceeds$/]),
      fees: col(h, [/^comm\/fee$/, /^comm in [a-z]{3}$/]), realized: col(h, [/^realized p\/l$/]), currency: col(h, [/^currency$/]),
    });
  },
  build: (t, m) => {
    const { fills, warnings } = readFills(t, m, {
      feeNegative: true,
      // "Order" rows are the trades; "ClosedLot" rows repeat them lot by lot.
      skip: (_row, text) => { const k = (text("rowType") ?? "").toLowerCase(); return k && k !== "order" && k !== "trade" ? "they repeat a trade lot by lot" : null; },
    });
    const res = pairFills(fills, { allowShort: true, realizedNet: true });
    return { trades: res.trades, warnings: [...warnings.filter((w) => !/repeat a trade/.test(w)), ...res.warnings], notes: [EASTERN] };
  },
  fields: [...FILL_FIELDS, { field: "rowType", label: "Row kind (Order or ClosedLot)" }, { field: "currency", label: "Currency" }],
  drop: ACCOUNT_IDS,
};
