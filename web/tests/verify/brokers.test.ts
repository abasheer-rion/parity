// Broker and exchange imports (DEC-0081): each export is detected from its header row, fills
// are paired first in, first out into round trips, fees are taken off, and account numbers,
// names and order ids leave no trace after parsing. Every fixture is synthetic.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseText, SUPPORTED } from "../../src/lib/verify/parse";
import { pairFills, splitPair, type Fill } from "../../src/lib/verify/parse/fills";
import { FORMAT_LABEL, type FormatId, type Trade } from "../../src/lib/verify/types";

const fx = (name: string) => readFileSync(join(import.meta.dirname, "../fixtures/verify", name), "utf8");
const pnls = (ts: Trade[] | undefined) => (ts ?? []).map((t) => Math.round(t.pnl * 100) / 100);
const shape = (t: Trade) => ({ side: t.side, size: t.size, entry: t.entry, exit: t.exit, open: t.openTime?.slice(0, 16), close: t.closeTime.slice(0, 16) });

// The same five fills in every fills fixture: buy 2 at 100, sell 1 at 110, sell 1 at 95, then
// a short (sell 1 at 120, buy 1 at 115), with fees of 1, 0.5, 0.5, 0.6 and 0.6.
const ROUND_TRIPS = [
  { side: "buy", size: 1, entry: 100, exit: 110, open: "2024-01-03T10:00", close: "2024-01-03T15:00" },
  { side: "buy", size: 1, entry: 100, exit: 95, open: "2024-01-03T10:00", close: "2024-01-04T11:00" },
  { side: "sell", size: 1, entry: 120, exit: 115, open: "2024-01-05T09:00", close: "2024-01-05T14:00" },
];

describe("fills are paired into round trips", () => {
  const cases: [string, FormatId, number[], string[]][] = [
    ["ibkr-flex.csv", "ibkr", [9, -6, 3.8], ["ClientAccountID", "AccountAlias", "IBOrderID", "TradeID"]],
    ["ibkr-activity.csv", "ibkr_activity", [9, -6, 3.8], []],
    ["bybit-trades.csv", "bybit", [9, -6, 3.8], ["Order No."]],
  ];
  for (const [file, format, want, dropped] of cases) {
    it(`${file} is read as ${FORMAT_LABEL[format]}`, () => {
      const p = parseText(fx(file));
      expect(p.format).toBe(format);
      expect(p.warnings).toEqual([]);
      expect(pnls(p.trades)).toEqual(want);
      expect(p.trades!.map(shape)).toEqual(ROUND_TRIPS);
      for (const d of dropped) expect(p.dropped).toContain(d);
    });
  }

  it("a spot exchange never sells short: a sale with nothing open is left out and said so", () => {
    const p = parseText(fx("binance-spot.csv"));
    expect(p.format).toBe("binance_spot");
    // The first buy paid 0.01 BTC in fees, priced at the fill: 1 USDT.
    expect(pnls(p.trades)).toEqual([9, -6, -6.2]);
    expect(p.trades!.map((t) => t.side)).toEqual(["buy", "buy", "buy"]);
    expect(p.warnings).toEqual(["1 sell was left out: what was sold was bought before the file starts, so the profit is unknown."]);
  });

  it("Coinbase and Kraken are spot too", () => {
    for (const [file, format, sym] of [["coinbase.csv", "coinbase", "BTC-USD"], ["kraken.csv", "kraken", "XBTUSD"]] as const) {
      const p = parseText(fx(file));
      expect(p.format, file).toBe(format);
      expect(pnls(p.trades), file).toEqual([9, -6, -6.2]);
      expect(p.trades![0].symbol, file).toBe(sym);
      expect(p.warnings, file).toEqual([]);
    }
  });

  it("a futures close with no opening fill in the file uses the exchange's realized profit", () => {
    const p = parseText(fx("binance-futures.csv"));
    expect(p.format).toBe("binance_futures");
    expect(pnls(p.trades)).toEqual([-4.1, 9, -6, 3.8]);
    expect(p.dropped).toContain("Order No");
    expect(p.warnings).toEqual(["1 closing fill has no opening fill in the file. Their profit is the exchange's own realized profit, less the fee."]);
  });

  it("thinkorswim: only the trade history section is read, options count 100 shares, futures are left out", () => {
    const text = fx("thinkorswim.csv");
    const p = parseText(text);
    expect(p.format).toBe("tos");
    expect(pnls(p.trades)).toEqual([10, -5, 50]);
    expect(p.trades![2].symbol).toBe("AAPL 19 JAN 24 190 CALL");
    expect(p.warnings).toEqual([
      "1 row was skipped: futures need a contract size, which the statement does not give.",
      "thinkorswim lists fees apart from the trades, so they are not taken off the profit.",
    ]);
    expect(JSON.stringify(p)).not.toContain("123456789");
  });

  it("Alpaca: only FILL activities are trades, and sell_short opens a short", () => {
    const p = parseText(fx("alpaca.csv"));
    expect(p.format).toBe("alpaca");
    expect(pnls(p.trades)).toEqual([10, -5, 5]);
    expect(p.trades!.map(shape)).toEqual(ROUND_TRIPS);
    expect(p.dropped).toEqual(expect.arrayContaining(["id", "order_id"]));
    expect(p.warnings).toEqual(["1 row was skipped: they are not fills (fees, dividends, transfers)."]);
  });
});

describe("exports of closed trades", () => {
  it("cTrader: net profit, day-first dates, lots", () => {
    const p = parseText(fx("ctrader.csv"));
    expect(p.format).toBe("ctrader");
    expect(pnls(p.trades)).toEqual([243, -264.7, 566]);
    expect(p.trades![0]).toMatchObject({ side: "buy", size: 1, entry: 1.095, exit: 1.0975, fees: 7, openTime: "2024-01-03T09:15:00" });
    expect(p.trades![2].closeTime).toBe("2024-01-15T17:30:00");
    expect(p.dropped).toEqual(expect.arrayContaining(["ID", "Comment"]));
  });

  it("NinjaTrader: profit in brackets is a loss, the account column is dropped", () => {
    const p = parseText(fx("ninjatrader.csv"));
    expect(p.format).toBe("ninjatrader");
    expect(pnls(p.trades)).toEqual([495.7, -254.3]);
    expect(p.trades!.map((t) => t.side)).toEqual(["buy", "sell"]);
    expect(p.dropped).toContain("Account");
    expect(JSON.stringify(p)).not.toContain("Sim101");
  });

  it("NinjaTrader without a net column takes the commission off", () => {
    const text = fx("ninjatrader.csv").replace("Cum. net profit", "Cum. profit");
    expect(pnls(parseText(text).trades)).toEqual([491.4, -258.6]);
  });

  it("Tradovate: sold first is a short, and the profit is said to be before costs", () => {
    const p = parseText(fx("tradovate.csv"));
    expect(p.format).toBe("tradovate");
    expect(pnls(p.trades)).toEqual([50, -25]);
    expect(p.trades![1]).toMatchObject({ side: "sell", entry: 4720, exit: 4725, openTime: "2024-01-04T10:30:00", closeTime: "2024-01-04T11:00:00" });
    expect(p.warnings).toEqual(["Tradovate's performance report gives profit before commissions and exchange fees, so the checks see the profit before costs."]);
    expect(p.dropped).toEqual(expect.arrayContaining(["buyFillId", "sellFillId"]));
  });

  it("Bybit closed P&L: a sell closes a long", () => {
    const p = parseText(fx("bybit-closed-pnl.csv"));
    expect(p.format).toBe("bybit_pnl");
    expect(pnls(p.trades)).toEqual([9, -6, 3.8]);
    expect(p.trades!.map((t) => t.side)).toEqual(["buy", "buy", "sell"]);
  });
});

describe("personal data and account ids leave no trace", () => {
  const secrets: [string, string[]][] = [
    ["ibkr-flex.csv", ["U9876543", "Example Person", "700001", "900001"]],
    ["ibkr-activity.csv", ["U9876543", "Example Person"]],
    ["binance-futures.csv", ["8100001"]],
    ["bybit-trades.csv", ["b-0001"]],
    ["coinbase.csv", ["Example Person", "4001"]],
    ["kraken.csv", ["TQAAAA", "OQAAAA", "LQAAAA"]],
    ["ctrader.csv", ["Example Person", "3001"]],
    ["tradovate.csv", ["51001"]],
    ["alpaca.csv", ["ord-0001", "::a1"]],
  ];
  for (const [file, values] of secrets) {
    it(file, () => {
      const kept = JSON.stringify(parseText(fx(file)));
      for (const v of values) expect(kept, v).not.toContain(v);
    });
  }
});

describe("pairing rules", () => {
  const f = (time: string, side: "buy" | "sell", qty: number, price: number, fee = 0): Fill => ({ time, symbol: "X", side, qty, price, value: qty * price, fee });

  it("a fill that more than closes a position opens the other way with what is left", () => {
    const { trades, warnings } = pairFills([f("2024-01-01", "buy", 1, 10), f("2024-01-02", "sell", 3, 12), f("2024-01-03", "buy", 2, 11)], { allowShort: true });
    expect(trades.map((t) => [t.side, t.size, t.pnl])).toEqual([["buy", 1, 2], ["sell", 2, 2]]);
    expect(warnings).toEqual([]);
  });

  it("closes the oldest quantity first and shares an opening fee over what it opened", () => {
    const { trades } = pairFills([f("2024-01-01", "buy", 2, 10, 2), f("2024-01-02", "buy", 2, 20, 2), f("2024-01-03", "sell", 3, 30, 3)], { allowShort: false });
    // 2 at 10 and 1 at 20 close at 30: 40 + 10 gross; fees 2 + 1 (opening) + 3 (closing).
    expect(trades).toHaveLength(1);
    expect(trades[0]).toMatchObject({ size: 3, pnl: 44, fees: 6 });
    expect(trades[0].entry).toBeCloseTo(40 / 3, 8);
  });

  it("says when positions are still open at the end", () => {
    expect(pairFills([f("2024-01-01", "buy", 1, 10)], { allowShort: true }).warnings).toEqual(["1 position was still open at the end of the file and is left out."]);
  });

  it("splits pairs written with or without a separator", () => {
    expect(splitPair("BTC-USD")).toEqual({ base: "BTC", quote: "USD" });
    expect(splitPair("ETHUSDT")).toEqual({ base: "ETH", quote: "USDT" });
    expect(splitPair("AAPL")).toBeNull();
  });
});

describe("the supported files list", () => {
  it("names every format the parser reads, and marks unconfirmed layouts", () => {
    const ids = new Set(SUPPORTED.map((s) => s.id));
    for (const id of Object.keys(FORMAT_LABEL)) expect(ids.has(id as FormatId), id).toBe(true);
    const unverified = SUPPORTED.filter((s) => !s.verified).map((s) => s.id);
    expect(unverified).toEqual(expect.arrayContaining(["ibkr", "binance_spot", "binance_futures", "bybit", "coinbase", "kraken", "ctrader", "ninjatrader", "tradovate", "tos", "alpaca"]));
  });
});
