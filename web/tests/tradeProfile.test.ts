// The trade profile's pure rules: the month calendar, week totals, streaks, the trade
// return formula, ranking, the region filter and re-rank, initials, handle checks, the
// luck check, the region list, and the contrast of the strongest calendar colours.
import { describe, expect, it } from "vitest";
import { RAW } from "../src/ui/tokens.gen";
import { countries, regionOf, REGIONS } from "../src/lib/tradeProfile/countries";
import {
  boardFor, buildMonth, closedTrades, dailyPnl, handleError, initials, inPeriod, luck, marketOf, pct, rankTrades, shiftMonth, streaks, tradeReturn, usd, usdShort,
  type BoardRow, type Day, type FillLike,
} from "../src/lib/tradeProfile/logic";
import { applyFill, emptyBook } from "../src/lib/paper/matching";

const fill = (id: string, date: string, pnl: number | null, extra: Partial<FillLike> = {}): FillLike =>
  ({ id, account_id: "a1", symbol: "eq.US_MKT", side: pnl == null ? "buy" : "sell", qty: 1, price: 100, fee: 1, bar_date: date, realized_pnl: pnl, ...extra });
const days = (entries: [string, number][]) => new Map<string, Day>(entries.map(([d, pnl]) => [d, { pnl, trades: 1 }]));

describe("trade return", () => {
  it("matches the engine's cost basis, fees included", () => {
    // Buy 10 at 100 with a 1 fee, sell 10 at 110 with a 1 fee.
    let book = emptyBook(10_000);
    const b = applyFill(book, { order_id: "o1", symbol: "X", side: "buy", qty: 10, price: 100, fee: 1, bar_date: "2026-10-01" });
    if ("error" in b) throw new Error(b.error);
    book = b.book;
    const s = applyFill(book, { order_id: "o2", symbol: "X", side: "sell", qty: 10, price: 110, fee: 1, bar_date: "2026-10-02" });
    if ("error" in s) throw new Error(s.error);
    expect(s.realized).toBeCloseTo(98);
    // Cost of the shares sold was 1001 (1000 plus the buy fee).
    expect(tradeReturn(10, 110, 1, s.realized!)).toBeCloseTo(98 / 1001, 10);
  });
  it("is null when the cost basis is not positive", () => {
    expect(tradeReturn(0, 100, 0, 0)).toBeNull();
  });
});

describe("closed trades and daily P&L", () => {
  it("keeps only fills with a realized P&L and sums them per day without taking the fee again", () => {
    const t = closedTrades([fill("b", "2026-10-01", null), fill("s1", "2026-10-02", 10), fill("s2", "2026-10-02", "-4" as unknown as number), fill("s3", "2026-10-05", 3)]);
    expect(t.map((x) => x.id)).toEqual(["s3", "s1", "s2"]);
    const d = dailyPnl(t);
    expect(d.get("2026-10-02")).toEqual({ pnl: 6, trades: 2 });
    expect(d.get("2026-10-05")).toEqual({ pnl: 3, trades: 1 });
  });
  it("names the market from the symbol", () => {
    expect(marketOf("crypto.BTC")).toBe("Crypto");
    expect(marketOf("fx.EUR")).toBe("Currencies (FX)");
    expect(marketOf("ABC")).toBe("Other");
  });
});

describe("month calendar", () => {
  const v = buildMonth("2026-10", days([["2026-10-01", 100], ["2026-10-02", -50], ["2026-10-05", 200], ["2026-10-31", -10]]));
  it("lays out Monday to Sunday weeks with blanks outside the month", () => {
    // 1 October 2026 is a Thursday.
    expect(v.weeks[0].cells.slice(0, 3)).toEqual([null, null, null]);
    expect(v.weeks[0].cells[3]?.date).toBe("2026-10-01");
    expect(v.weeks.length).toBe(5);
    expect(v.weeks[4].cells[5]?.date).toBe("2026-10-31");
    expect(v.weeks[4].cells[6]).toBeNull();
  });
  it("totals each week, the month, win and loss days, best and worst", () => {
    expect(v.weeks[0].pnl).toBe(50);
    expect(v.weeks[1].pnl).toBe(200);
    expect(v.pnl).toBe(240);
    expect(v.winDays).toBe(2);
    expect(v.lossDays).toBe(2);
    expect(v.best?.date).toBe("2026-10-05");
    expect(v.worst?.date).toBe("2026-10-02");
  });
  it("scales heat to the month's largest absolute day", () => {
    expect(v.maxAbs).toBe(200);
    expect(v.weeks[1].cells[0]?.heat).toBe(1);
    expect(v.weeks[0].cells[4]?.heat).toBe(0.25);
  });
  it("moves between months across a year", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });
});

describe("streaks", () => {
  it("counts current and longest win and loss runs, skipping days without trades", () => {
    const s = streaks(days([["2026-10-01", 5], ["2026-10-02", 3], ["2026-10-06", 1], ["2026-10-07", -2], ["2026-10-08", -1]]));
    expect(s).toEqual({ current: { kind: "loss", days: 2 }, longestWin: 3, longestLoss: 2 });
  });
  it("ends a streak on a day at exactly zero", () => {
    expect(streaks(days([["2026-10-01", 5], ["2026-10-02", 0]])).current).toEqual({ kind: null, days: 0 });
  });
});

describe("ranked trades", () => {
  const t = closedTrades([fill("a", "2026-10-20", 50, { qty: 1, price: 150 }), fill("b", "2026-10-21", 20, { qty: 1, price: 40 }), fill("c", "2026-09-01", -5)]);
  it("ranks by P&L or by return, best first", () => {
    expect([...rankTrades(t, "pnl")]).toEqual([["a", 1], ["b", 2], ["c", 3]]);
    expect(rankTrades(t, "ret").get("b")).toBe(1);
  });
  it("filters by period the way the database counts days", () => {
    expect(inPeriod("2026-10-21", "week", "2026-10-27")).toBe(true);
    expect(inPeriod("2026-10-20", "week", "2026-10-27")).toBe(false);
    expect(inPeriod("2026-09-01", "month", "2026-10-27")).toBe(false);
    expect(inPeriod("2020-01-01", "all", "2026-10-27")).toBe(true);
  });
});

describe("leaderboard region filter", () => {
  const row = (handle: string, rank: number, score: number, trades: number, country: string): BoardRow => ({
    period: "all", rank, handle, display_name: null, initials: "", country, region: regionOf(country), trades, active_days: 5, total_return: 0,
    risk_adjusted: score, win_rate: null, max_drawdown: null, min_trades: 20, is_you: false,
  });
  const rows = [row("a", 1, 3, 30, "US"), row("b", 2, 2.5, 25, "DE"), row("c", 3, 2, 40, "FR"), row("d", 3, 2, 40, "GB"), row("e", 5, 1, 20, "FR")];
  it("re-ranks inside a region, ties sharing a rank", () => {
    expect(boardFor(rows, "Europe").map((r) => [r.handle, r.rank])).toEqual([["b", 1], ["c", 2], ["d", 2], ["e", 4]]);
    expect(boardFor(rows, "North America").map((r) => r.rank)).toEqual([1]);
    expect(boardFor(rows, "all").map((r) => r.rank)).toEqual([1, 2, 3, 3, 5]);
  });
});

describe("profile rules", () => {
  it("makes initials like the database", () => {
    expect(initials("Ada Byron Lovelace", "ada")).toBe("AL");
    expect(initials("ada", "zz")).toBe("AD");
    expect(initials(null, "q_trader")).toBe("QT");
    expect(initials("", "x9")).toBe("X9");
  });
  it("checks handles", () => {
    expect(handleError("ab")).toMatch(/at least 3/);
    expect(handleError("a".repeat(21))).toMatch(/20 characters/);
    expect(handleError("bad handle")).toMatch(/letters, digits/);
    expect(handleError("good_handle_1")).toBeNull();
  });
  it("says when a result could be luck", () => {
    expect(luck(5, 20, 3)).toBe("few");
    expect(luck(30, 20, null)).toBe("few");
    expect(luck(30, 20, 1.9)).toBe("luck");
    expect(luck(30, 20, 2)).toBe("less-likely");
  });
  it("writes amounts with plain signs and no dash characters", () => {
    expect(usd(1234.5)).toBe("+$1,234.50");
    expect(usd(-80)).toBe("-$80.00");
    expect(usdShort(1234)).toBe("+$1.2k");
    expect(usdShort(-350)).toBe("-$350");
    expect(usdShort(25_000)).toBe("+$25k");
    expect(pct(-0.0123, 2)).toBe("-1.23%");
    expect([usd(-1), usdShort(-1), pct(-1)].join("")).not.toMatch(/[\u2012-\u2015\u2212]/);
  });
});

describe("countries", () => {
  it("puts every offered country in one of the seven regions", () => {
    const list = countries();
    expect(list.length).toBeGreaterThan(240);
    for (const c of list) expect(REGIONS).toContain(c.region);
    expect(regionOf("us")).toBe("North America");
    expect(regionOf("MX")).toBe("Latin America");
    expect(regionOf("TR")).toBe("Europe");
    expect(regionOf("EG")).toBe("Africa");
    expect(regionOf(null)).toBeNull();
    expect(regionOf("ZZ")).toBeNull();
  });
});

// The strongest day colour is 45% of the positive or negative token mixed into the surface
// (tradeProfile.css). The cell text must stay at 4.5:1 or better on it.
describe("calendar contrast", () => {
  const hex = (name: string) => {
    const h = (RAW as Record<string, string>)[name].replace("#", "");
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  };
  const lum = (c: number[]) => {
    const [r, g, b] = c.map((v) => { const x = v / 255; return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const mix = (a: number[], b: number[], p: number) => a.map((v, i) => v * p + b[i] * (1 - p));
  for (const tone of ["color-positive", "color-negative"]) {
    it(`text on the strongest ${tone} day is AA`, () => {
      for (const p of [0.1, 0.45]) {
        const bg = mix(hex(tone), hex("color-surface"), p);
        const [l1, l2] = [lum(hex("color-text")), lum(bg)].sort((x, y) => y - x);
        expect((l1 + 0.05) / (l2 + 0.05)).toBeGreaterThanOrEqual(4.5);
      }
    });
  }
});
