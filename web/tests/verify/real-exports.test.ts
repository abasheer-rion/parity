// Real exports (tests/fixtures/verify/real, SOURCES.md says where each came from and under
// which licence) and fixtures that copy a real export's layout with made-up numbers
// (tests/fixtures/verify/layout). Each is read the way the page reads a file, and the trades
// are checked against numbers worked out by hand from the rows.
// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { decodeBytes, headerOffset, parseDate } from "../../src/lib/verify/csv";
import { parseFile, parseText } from "../../src/lib/verify/parse";
import { pointValue } from "../../src/lib/verify/parse/futures";
import type { Parsed } from "../../src/lib/verify/types";

const base = join(import.meta.dirname, "../fixtures/verify");
async function read(path: string): Promise<Parsed> {
  const b = readFileSync(join(base, path));
  return parseFile(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
}
const cents = (p: Parsed) => (p.trades ?? []).map((t) => Math.round(t.pnl * 100) / 100);
const all = (p: Parsed) => [...p.warnings, ...(p.notes ?? [])].join(" ");

describe("MetaTrader reports, as saved by the terminal", () => {
  it("MetaTrader 4 Detailed Statement (HTML): closed trades, close-by rows left out, server time", async () => {
    const p = await read("real/mt4_detailed_statement.htm");
    expect(p.format).toBe("mt4");
    expect(p.what).toBe("MetaTrader 4 statement");
    expect(cents(p)).toEqual([14.4, 13, 32.4, -4.1, 143.82, -19.92, 58.96, 12.6]);
    expect(p.trades![0].symbol).toBe("GBPUSD");
    expect(all(p)).toContain('2 rows have size 0 and no profit: what "close by" leaves behind.');
    expect(all(p)).toContain("broker's server time");
    expect(JSON.stringify(p)).not.toContain("Demo Trader");
  });

  it("MetaTrader 4 Strategy Tester (HTML, Indonesian): a backtest, with the starting deposit", async () => {
    const p = await read("real/mt4_strategy_tester_id.htm");
    expect(p.format).toBe("mt4tester");
    expect(p.backtestExport).toBe(true);
    expect(p.inferredBalance).toBe(10000);
    expect(cents(p).slice(0, 4)).toEqual([115.68, 117.76, 122.14, 432.03]);
    expect(p.trades).toHaveLength(10);
  });

  it("MetaTrader 5 History Report (HTML): closed positions with swap and commission, the deposit, in UTF-8 and UTF-16", async () => {
    const want = [0.28, 0.46, 1.71, 1.46, -6.69, -5.75, 2.31, -5.4];
    for (const f of ["real/mt5_report_history_en.html", "real/mt5_report_history_en.utf16le.html"]) {
      const p = await read(f);
      expect(p.format, f).toBe("mt5");
      expect(p.inferredBalance, f).toBe(10000);
      expect(cents(p).slice(0, 8), f).toEqual(want);
      expect(p.trades, f).toHaveLength(10);
    }
  });

  it("MetaTrader 5 History Report in Spanish: found by the shape of its rows", async () => {
    const p = await read("real/mt5_report_history_es.html");
    expect(p.format).toBe("mt5");
    expect(cents(p)).toEqual([-530.5, -476.7]);
    expect(p.inferredBalance).toBe(100000);
  });

  it("MetaTrader 5 Strategy Tester (HTML, UTF-16): deals paired into trades, a backtest", async () => {
    const p = await read("real/mt5_strategy_tester.html");
    expect(p.format).toBe("mt5deals");
    expect(p.what).toBe("MetaTrader 5 Strategy Tester report");
    expect(p.backtestExport).toBe(true);
    expect(p.inferredBalance).toBe(5000);
    expect(cents(p).slice(0, 4)).toEqual([-1.4, 0.16, -18.27, -12.68]);
  });

  it("MetaTrader 5 Open XML (xlsx): positions, partial volumes read as the filled part", async () => {
    const p = await read("real/mt5_open_xml_positions.xlsx");
    expect(p.format).toBe("mt5");
    expect(p.trades).toHaveLength(14);
    expect(cents(p).slice(0, 4)).toEqual([30.62, 3.31, 45.48, 192.59]);
  });

  it("Myfxbook CSV: profit already has commission and swap off; deposits are not trades", async () => {
    const p = await read("real/myfxbook_export.csv");
    expect(p.format).toBe("myfxbook");
    expect(p.trades).toHaveLength(10);
    // 1.36 lots of XAUUSD from 3295.61 to 3296.46, in a EUR account, after -13.60 commission.
    expect(p.trades!.find((t) => t.entry === 3295.61)).toMatchObject({ pnl: 87.45, fees: 13.6, side: "buy" });
    expect(all(p)).toContain("3 deposit or withdrawal rows are not trades");
  });
});

describe("TradingView, every header version", () => {
  it("2026 layout: Net PnL, exit rows first, the open trade left out", async () => {
    const p = await read("real/tradingview-pineforge-2026.csv");
    expect(p.format).toBe("tradingview");
    expect(p.backtestExport).toBe(true);
    expect(cents(p)).toEqual([-266.68, -152.52, -18.07, -99.39, 73.06, 375.67]);
    expect(p.trades![0]).toMatchObject({ side: "buy", entry: 1902.21, exit: 1837.51, openTime: "2025-04-03T00:45:00", closeTime: "2025-04-03T06:00:00" });
    expect(p.warnings).toContain("1 trade was still open at the end of the test and left out.");
  });

  it("2025 layout: Net P&L, shorts", async () => {
    const p = await read("real/tradingview-aleksdrozy-2025.csv");
    expect(cents(p)).toEqual([-1320, 525, 2310, 665, 1365, -1250, 1165]);
    expect(p.trades![0].side).toBe("sell");
  });
});

describe("brokers and platforms", () => {
  it("Interactive Brokers Flex: several currencies to base, taxes and commission rebates, realized profit for closes opened before the file", async () => {
    const p = await read("real/ibkr-flex-agusalex-taxcalc.csv");
    expect(p.format).toBe("ibkr");
    // RE4: 9000 bought at 0.34 SGD (rate 0.63933), sold at 0.345 (rate 0.65004), 2.5 SGD each side.
    // VIPS puts: sold 2 at 1.85, bought back at 2.40, commissions +0.151413 and +0.3573 (rebates).
    expect(p.trades!.map((t) => Math.round(t.pnl * 1e6) / 1e6)).toEqual([58.800975, -63.114351, -32.212754, -109.491287]);
    expect(p.warnings).toContain("The trades are in HKD, PLN, SGD and USD. Every amount was turned into the account's base currency with the rate the file gives for that day.");
    expect(p.dropped).toEqual(expect.arrayContaining(["ClientAccountID", "IBOrderID", "TradeID", "IBExecID"]));
    expect(JSON.stringify(p)).not.toContain("U1234567");
  });

  it("Interactive Brokers Flex with header and trailer records (BOF, BOS, EOF) and compact times", async () => {
    const p = await read("layout/ibkr-flex-wrapped.csv");
    expect(p.format).toBe("ibkr");
    expect(p.trades).toEqual([expect.objectContaining({ pnl: 73.4965, openTime: "2020-11-02T14:39:20", closeTime: "2020-11-10T09:31:00" })]);
  });

  it("Interactive Brokers: a file with only purchases says there are no round trips", async () => {
    const p = await read("real/ibkr-flex-fingather.csv");
    expect(p.trades).toEqual([]);
    expect(p.warnings.at(-1)).toMatch(/^No round trips: none of the fills/);
  });

  it("Interactive Brokers activity statement: SubTotal and Total rows ignored, mixed currencies flagged, the account column dropped", async () => {
    const p = await read("real/ibkr-activity-maisvalias.csv");
    expect(p.format).toBe("ibkr_activity");
    expect(cents(p)).toEqual([-14.34]);
    expect(p.warnings[0]).toMatch(/^The trades are in EUR and USD\. The file gives no exchange rates/);
    expect(p.dropped).toContain("Account");
    const fx = await read("real/ibkr-activity-binnaculum.csv");
    expect(fx.trades).toEqual([]);
  });

  it("thinkorswim: the trade history section of a real statement", async () => {
    const p = await read("real/tos-redbean87.csv");
    expect(p.format).toBe("tos");
    expect(cents(p)).toEqual([35.52, 11.3, 4.14, 0.4, 9.65, -26.94, 5.54]);
    expect(p.trades![0]).toMatchObject({ symbol: "CANF", size: 150 });
  });

  it("thinkorswim: spread legs take the time above them, and futures use the contract size", async () => {
    const p = await read("layout/thinkorswim-spreads-futures.csv");
    // /ES: 10.25 points x 50; the 470 call: 0.90 x 100; the short 475 call: -0.60 x 100.
    expect(cents(p)).toEqual([512.5, 90, -60]);
    expect(p.trades!.map((t) => t.symbol)).toEqual(["ESH24", "SPY 19 JAN 24 470 CALL", "SPY 19 JAN 24 475 CALL"]);
    expect(pointValue("/ESH24")).toBe(50);
    expect(pointValue("MNQU6")).toBe(2);
    expect(pointValue("AAPL")).toBeNull();
  });

  it("NinjaTrader 8: dollar amounts, AM and PM times, a trailing comma", async () => {
    const p = await read("real/ninjatrader-toinetrades-2025.csv");
    expect(p.format).toBe("ninjatrader");
    expect(cents(p)).toEqual([285, 78.5, 77, 108, -98.5, -50, -52.5, 4.5, expect.any(Number)]);
    expect(p.trades![0]).toMatchObject({ symbol: "NQ JUN25", openTime: "2025-04-30T09:45:30", closeTime: "2025-04-30T09:45:42" });
  });

  it("cTrader (xlsx): net profit, day-first times with milliseconds, the starting balance from the balance column", async () => {
    const p = await read("real/ctrader-abhidp-2026.xlsx");
    expect(p.format).toBe("ctrader");
    expect(p.trades).toHaveLength(51);
    expect(cents(p)[0]).toBe(-205.62);
    expect(p.inferredBalance).toBe(13196.16);
    expect(p.trades!.at(-1)).toMatchObject({ symbol: "CADJPY", pnl: -350.39, closeTime: "2026-01-17T01:54:32" });
  });

  it("Tradovate: position history, orders and the performance report", async () => {
    const pos = await read("real/tradovate-positionhistory-tradetally-2026.csv");
    expect(pos.format).toBe("tradovate_positions");
    expect(cents(pos)).toEqual([-90, -52, -39, -24.5, -12.5]);
    const orders = await read("real/tradovate-orders-drasticstatic-2026.csv");
    expect(orders.format).toBe("tradovate_orders");
    // One Micro Russell short: 2962.5 to 2961.8 is 0.7 points at $5.
    expect(cents(orders)).toEqual([3.5]);
    expect(orders.warnings[0]).toBe("9 rows were left out: they are orders that did not fill.");
    const perf = await read("layout/tradovate-performance.csv");
    expect(cents(perf)).toEqual([-20, 2200, -1305]);
    expect(perf.trades![2].side).toBe("sell");
  });

  it("Alpaca account activities (JSON from the API): fills paired, partial fills kept apart", async () => {
    const p = await read("real/alpaca-activities-alpacapy.json");
    expect(p.format).toBe("alpaca");
    // GOOGL: 0.058773239 sold at 2644.84 of 9 bought at 2630.95.
    expect(cents(p)).toEqual([0.82]);
    expect(p.dropped).toEqual(expect.arrayContaining(["account_id", "order_id"]));
  });
});

describe("crypto exchanges", () => {
  it("Binance spot, Market layout: fees in the coin bought are priced, BNB fees are not", async () => {
    const p = await read("real/binance-spot-trades-market-moonstats-2022.csv");
    expect(p.format).toBe("binance_spot");
    expect(cents(p)).toEqual([1.41, 0.9, -2.08, -2.8, 0.21]);
    expect(p.warnings[0]).toBe("6 fees were paid in BNB, which we cannot price, so they are not taken off the profit.");
  });

  it("Binance spot, Pair layout: quoted cells, units glued on, tickers with digits", async () => {
    const p = await read("layout/binance-spot-pair.csv");
    // A2Z: 45 - 42, less 6 A2Z at 0.007 and 0.045 USDT. BTC: 950 - 900 - 0.95 (the BNB fee cannot be priced).
    expect(p.trades!.map((t) => Math.round(t.pnl * 1e6) / 1e6)).toEqual([2.913, 49.05]);
  });

  it("Binance futures: fees written negative with a unit, realized profit before fees, 0E-8", async () => {
    const p = await read("layout/binance-futures.csv");
    expect(p.format).toBe("binance_futures");
    expect(p.trades!.map((t) => Math.round(t.pnl * 1e6) / 1e6)).toEqual([19.352, 49.6]);
    expect(p.dropped).toEqual(expect.arrayContaining(["Uid", "Trade Id", "Order Id"]));
  });

  it("Binance account statement: rows of one trade are put back together", async () => {
    const p = await read("real/binance-statement-fingather-2022.csv");
    expect(p.format).toBe("binance_statement");
    expect(p.trades).toEqual([]);
    expect(all(p)).toContain("1 row is deposits, withdrawals, interest or transfers, not trades");
    const sold = parseText(`"User_ID","UTC_Time","Account","Operation","Coin","Change","Remark"
"1","2024-01-02 10:00:00","Spot","Transaction Spend","USDT","-100.00000000",""
"1","2024-01-02 10:00:00","Spot","Transaction Buy","BTC","0.00250000",""
"1","2024-01-02 10:00:00","Spot","Transaction Fee","BTC","-0.00000250",""
"1","2024-01-09 10:00:00","Spot","Transaction Sold","BTC","-0.00250000",""
"1","2024-01-09 10:00:00","Spot","Transaction Revenue","USDT","110.00000000",""
"1","2024-01-09 10:00:00","Spot","Transaction Fee","USDT","-0.11000000",""`);
    // 110 - 100, less 0.0000025 BTC at 40,000 (0.10) and 0.11 USDT.
    expect(cents(sold)).toEqual([9.79]);
  });

  it("Coinbase transaction reports (2022, 2024, 2025): buys and sells paired, converts are two trades, sends and rewards left out", async () => {
    const a = await read("real/coinbase-transactions-canion3d-2022.csv");
    expect(a.format).toBe("coinbase_tx");
    expect(cents(a)).toEqual([-17.24, -6.39]);
    expect(a.warnings[0]).toBe("2 rows are not trades (learning reward, receive) and were left out.");
    expect(cents(await read("real/coinbase-transactions-delta-2024.csv"))).toEqual([30.67]);
    expect(cents(await read("real/coinbase-transactions-dickwolff-2025.csv"))).toEqual([85.67]);
  });

  it("Coinbase Pro fills: the opening fee is shared over what each sale closes", async () => {
    const p = await read("real/coinbase-pro-fills-gocryptoadmin-2019.csv");
    // 131 XLM: 131 x (0.11375 - 0.112815) less 131/1782 of 0.301554495 and 0.022351875.
    expect(p.trades!.map((t) => Math.round(t.pnl * 1e8) / 1e8)).toEqual([0.07796498, 0.26127195]);
  });

  it("Kraken trades.csv, 2017 and 2026 layouts; a ledger is refused with what to export instead", async () => {
    const old = await read("real/kraken-trades-gocryptoadmin-2017.csv");
    expect(old.format).toBe("kraken");
    expect(old.trades).toHaveLength(7);
    expect(old.trades![0]).toMatchObject({ symbol: "ETHEUR", entry: 245.7, exit: 203.26 });
    const now = await read("layout/kraken-trades-2026.csv");
    expect(cents(now)).toEqual([178.68]);
    const ledger = await read("real/kraken-ledgers-vergi-2021.csv");
    expect(ledger.trades).toBeUndefined();
    expect(ledger.warnings).toEqual(["This is a Kraken ledger (ledgers.csv), which lists money moving, not trades. Export History, Trades instead: trades.csv."]);
  });
});

describe("reading files and cells", () => {
  it("time zones: a zone in the cell or the header gives UTC; a date with dashes is never read as one", () => {
    expect(parseDate("2024-05-30 07:19:59 UTC")).toBe("2024-05-30T07:19:59");
    expect(parseDate("2023-11-15, 04:35:54 EST")).toBe("2023-11-15T09:35:54");
    expect(parseDate("2024-01-03T10:15:00+02:00")).toBe("2024-01-03T08:15:00");
    expect(parseDate("2022-03-04T18:54:20.903569Z")).toBe("2022-03-04T18:54:20");
    expect(parseDate("03-01-2024")).toBe("2024-03-01T00:00:00");
    expect(headerOffset("Closing Time (UTC-7)")).toBe(-420);
    expect(headerOffset("Date(UTC+1)")).toBe(60);
    expect(headerOffset("Date(UTC)")).toBe(0);
    expect(headerOffset("Close time")).toBeUndefined();
    const p = parseText("Opening Direction,Closing Time (UTC-7),Entry Price,Closing Price,Net USD\nBuy,03/01/2024 20:00:00,1.1,1.2,10\n");
    expect(p.trades![0].closeTime).toBe("2024-03-02T03:00:00");
  });

  it("a bad row is named by its line, with the cell that could not be read", () => {
    const p = parseText("close_time,pnl\n2024-01-02,10\n2024-13-45,5\n2024-01-04,abc\n2024-01-05,7\n");
    expect(p.trades).toHaveLength(2);
    expect(p.warnings).toEqual(['2 rows were skipped. Line 3: the close date "2024-13-45" is not a date we can read. Line 4: the profit "abc" is not a number.']);
  });

  it("UTF-16 with or without its mark, and old Windows text", () => {
    const enc16 = (s: string, bom: boolean) => { const b = new Uint8Array((bom ? 2 : 0) + s.length * 2); if (bom) { b[0] = 0xff; b[1] = 0xfe; } for (let i = 0; i < s.length; i++) b[(bom ? 2 : 0) + i * 2] = s.charCodeAt(i); return b.buffer; };
    const text = "close_time,pnl\n2024-01-02,10\n2024-01-03,-4\n";
    expect(decodeBytes(enc16(text, true))).toBe(text);
    expect(decodeBytes(enc16(text, false))).toBe(text);
    expect(decodeBytes(new Uint8Array([0x63, 0x61, 0x66, 0xe9]).buffer)).toBe("café");
  });
});
