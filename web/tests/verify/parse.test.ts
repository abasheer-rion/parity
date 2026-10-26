// REF-0016 acceptance tests 5 and 6: each format parses to the same trade list, and a
// file's personal columns leave no trace after parsing. All fixtures are synthetic.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { num, parseDate, readTable } from "../../src/lib/verify/csv";
import { describeParsed, parseText } from "../../src/lib/verify/parse";
import { isPersonalHeader } from "../../src/lib/verify/parse/common";
import type { Trade } from "../../src/lib/verify/types";

const fx = (name: string) => readFileSync(join(import.meta.dirname, "../fixtures/verify", name), "utf8");

const core = (t: Trade, withSymbol = true) => ({
  closeTime: t.closeTime.slice(0, 16), openTime: t.openTime?.slice(0, 16), side: t.side, size: t.size,
  entry: t.entry, exit: t.exit, pnl: Math.round(t.pnl * 100) / 100, ...(withSymbol ? { symbol: t.symbol } : {}),
});

const EXPECTED = [
  { closeTime: "2024-01-03T15:40", openTime: "2024-01-03T09:15", side: "buy", size: 1, entry: 1.095, exit: 1.0975, pnl: 243, symbol: "EURUSD" },
  { closeTime: "2024-01-05T11:20", openTime: "2024-01-04T10:00", side: "sell", size: 0.5, entry: 2045.1, exit: 2050.3, pnl: -264.7, symbol: "XAUUSD" },
  { closeTime: "2024-01-08T17:30", openTime: "2024-01-08T08:05", side: "sell", size: 2, entry: 1.096, exit: 1.0931, pnl: 566, symbol: "EURUSD" },
  { closeTime: "2024-01-10T09:45", openTime: "2024-01-09T12:00", side: "buy", size: 1, entry: 1.271, exit: 1.2688, pnl: -227.8, symbol: "GBPUSD" },
  { closeTime: "2024-01-11T20:10", openTime: "2024-01-11T14:30", side: "buy", size: 0.3, entry: 2028.4, exit: 2035.9, pnl: 222.9, symbol: "XAUUSD" },
  { closeTime: "2024-01-12T16:05", openTime: "2024-01-12T07:50", side: "buy", size: 1.5, entry: 1.0955, exit: 1.0949, pnl: -100.5, symbol: "EURUSD" },
];

describe("each format parses to the same trade list (test 5)", () => {
  const cases: [string, string, string][] = [
    ["mt4.csv", "mt4", "MetaTrader 4 history"],
    ["mt5.csv", "mt5", "MetaTrader 5 history"],
    ["mt5-deals.csv", "mt5deals", "MetaTrader 5 deals"],
    ["generic.csv", "trades", "Trade list"],
  ];
  for (const [file, format, label] of cases) {
    it(`${file} is read as ${label}`, () => {
      const p = parseText(fx(file));
      expect(p.format).toBe(format);
      expect(p.warnings).toEqual([]);
      expect(p.trades!.map((t) => core(t))).toEqual(EXPECTED);
      expect(describeParsed(p)).toBe(`${label}, 6 closed trades, EURUSD, XAUUSD, GBPUSD, 3 Jan 2024 to 12 Jan 2024`);
    });
  }

  it("tradingview.csv pairs entries with exits, puts them in time order and is marked a backtest", () => {
    const p = parseText(fx("tradingview.csv"));
    expect(p.format).toBe("tradingview");
    expect(p.backtestExport).toBe(true);
    // A TradingView list of trades has no symbol column.
    expect(p.trades!.map((t) => core(t, false))).toEqual(EXPECTED.map(({ symbol: _s, ...rest }) => rest));
  });

  it("reads the starting balance from a deposit row", () => {
    expect(parseText(fx("mt4.csv")).inferredBalance).toBe(10000);
    expect(parseText(fx("mt5-deals.csv")).inferredBalance).toBe(10000);
  });
});

describe("personal columns are dropped on parse (test 6)", () => {
  it("removes account, name, email and server before anything else reads the file", () => {
    const p = parseText(fx("personal.csv"));
    expect(p.dropped).toEqual(["Account", "Name", "Email", "Server"]);
    expect(p.table.headers).toEqual(["close_time", "symbol", "pnl"]);
    expect(p.trades).toHaveLength(3);
    const everything = JSON.stringify(p);
    for (const secret of ["88001234", "Test Person", "someone@example.com", "Demo-Server01"]) expect(everything).not.toContain(secret);
  });

  it("knows personal header names and leaves trading ones alone", () => {
    for (const h of ["Account", "Account Number", "Login", "E-mail", "IP Address", "Broker Server", "Client Name", "Name"]) expect(isPersonalHeader(h), h).toBe(true);
    for (const h of ["Symbol", "Item", "Profit", "Account Value", "Signal", "Type", "Balance", "Comment"]) expect(isPersonalHeader(h), h).toBe(false);
  });

  it("drops a column of email addresses whatever its header says", () => {
    const p = parseText("close_time,pnl,contact\n2024-01-02,10,a@b.co\n2024-01-03,-5,c@d.co\n");
    expect(p.dropped).toEqual(["contact"]);
    expect(JSON.stringify(p)).not.toContain("@");
  });
});

describe("reading cells", () => {
  it("reads numbers the way platforms write them", () => {
    expect(num("1,234.56")).toBe(1234.56);
    expect(num("1.234,56")).toBe(1234.56);
    expect(num("(12.50)")).toBe(-12.5);
    expect(num("-7.00 USD")).toBe(-7);
    expect(num("12,5", true)).toBe(12.5);
    expect(num("1,234")).toBe(1234);
    expect(num("abc")).toBeNull();
  });

  it("reads dates the way platforms write them", () => {
    expect(parseDate("2024.01.03 09:15:00")).toBe("2024-01-03T09:15:00");
    expect(parseDate("2024-01-03T09:15:00Z")).toBe("2024-01-03T09:15:00");
    expect(parseDate("01/03/2024 2:05 PM")).toBe("2024-01-03T14:05:00");
    expect(parseDate("13/03/2024")).toBe("2024-03-13T00:00:00");
    expect(parseDate("03.04.2024")).toBe("2024-04-03T00:00:00");
    expect(parseDate("3 Jan 2024")).toBe("2024-01-03T00:00:00");
    expect(parseDate("2024-02-30")).toBeNull();
  });

  it("finds the header row under a title line and reads tab separated files", () => {
    const t = readTable("Account history\nclose_time\tpnl\n2024-01-02\t10\n");
    expect(t.delimiter).toBe("\t");
    expect(t.headers).toEqual(["close_time", "pnl"]);
    expect(t.rows).toEqual([["2024-01-02", "10"]]);
  });

  it("reads an equity curve with deposits marked", () => {
    const p = parseText("date,equity,cashflow\n2024-01-02,1000,\n2024-01-03,1010,\n2024-01-04,1520,500\n");
    expect(p.format).toBe("equity");
    expect(p.equity).toHaveLength(3);
    expect(p.inferredBalance).toBe(1000);
  });
});
