// Interactive Brokers. Two exports, both lists of fills, paired first in, first out (fills.ts):
//
//   Flex Query, Trades section, as CSV (unverified layout: Flex columns are chosen by the
//   person, so names follow IBKR's field names): ClientAccountID, Symbol, AssetClass,
//   DateTime ("20240103;101500"), Buy/Sell, Quantity (negative for sales), TradePrice,
//   Multiplier, Proceeds, IBCommission (negative), FifoPnlRealized, IBOrderID, TradeID.
//   Activity statement, Trades section (unverified layout): rows of "Trades,Data,Order,
//   Stocks,USD,AAPL,"2024-01-03, 10:15:00",100,185.5,...", read by sections.ts. Columns
//   DataDiscriminator, Asset Category, Currency, Symbol, Date/Time, Quantity, T. Price,
//   C. Price, Proceeds, Comm/Fee, Basis, Realized P/L, MTM P/L, Code.
//
// Profit is worked out from the fills (Proceeds carries the contract multiplier for options
// and futures). IBKR's own realized profit is used only for a closing fill whose opening
// fill is before the file starts.
import type { Mapping, Table } from "../types";
import { col, compact } from "./common";
import { pairFills, readFills } from "./fills";
import { FILL_FIELDS, score, type BuildOut, type FormatDef } from "./format";

const ACCOUNT_IDS = [/^client ?account ?id$/i, /^account ?alias$/, /^acct ?alias$/, /^(ib)?order ?id$/, /^trade ?id$/, /^(ib)?exec ?id$/, /^order ?reference$/, /^brokerage ?order ?id$/, /^ext ?exec ?id$/];

export const ibkrFlex: FormatDef = {
  id: "ibkr",
  detect: (t) => {
    const s = score(t, [[3, [/^tradeprice$/, /^trade price$/]], [3, [/^ibcommission$/, /^ib commission$/]], [1, [/^quantity$/]], [1, [/^symbol$/]], [1, [/^datetime$/, /^date\/time$/, /^tradedate$/]]]);
    return s >= 7 ? s + 2 : 0;
  },
  map: (t: Table): Mapping => {
    const h = t.headers;
    return compact({
      closeTime: col(h, [/^datetime$/, /^date\/time$/, /^tradedate$/, /^trade date$/]), symbol: col(h, [/^symbol$/]),
      side: col(h, [/^buy\/sell$/]), size: col(h, [/^quantity$/]), entry: col(h, [/^tradeprice$/, /^trade price$/]),
      value: col(h, [/^proceeds$/]), multiplier: col(h, [/^multiplier$/]), fees: col(h, [/^ibcommission$/, /^ib commission$/]),
      realized: col(h, [/^fifopnlrealized$/, /^fifo pnl realized$/]), feeCurrency: col(h, [/^ibcommissioncurrency$/]),
    });
  },
  build: (t, m): BuildOut => {
    // The commission currency is the account's, not a coin: only a column for it is read.
    const { fills, warnings } = readFills(t, { ...m, feeCurrency: undefined });
    const res = pairFills(fills, { allowShort: true });
    return { trades: res.trades, warnings: [...warnings, ...res.warnings] };
  },
  fields: FILL_FIELDS,
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
      fees: col(h, [/^comm\/fee$/, /^comm in [a-z]{3}$/]), realized: col(h, [/^realized p\/l$/]),
    });
  },
  build: (t, m) => {
    const { fills, warnings } = readFills(t, m, {
      // "Order" rows are the trades; "ClosedLot" rows repeat them lot by lot.
      skip: (_row, text) => { const k = (text("rowType") ?? "").toLowerCase(); return k && k !== "order" && k !== "trade" ? "they repeat a trade lot by lot" : null; },
    });
    const res = pairFills(fills, { allowShort: true });
    return { trades: res.trades, warnings: [...warnings.filter((w) => !/repeat a trade/.test(w)), ...res.warnings] };
  },
  fields: [...FILL_FIELDS, { field: "rowType", label: "Row kind (Order or ClosedLot)" }],
  drop: ACCOUNT_IDS,
};
