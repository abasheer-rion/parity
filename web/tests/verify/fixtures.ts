// Synthetic records for Verify's acceptance tests (REF-0016). Every number is made up;
// no real account or customer data is used anywhere.
import type { PriceBook } from "../../src/lib/verify/prices";

/** Weekdays from a start date, as YYYY-MM-DD. */
export function weekdays(start: string, n: number): string[] {
  const out: string[] = [];
  const d = new Date(`${start}T00:00:00Z`);
  while (out.length < n) {
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

const csv = (header: string, rows: (string | number)[][]) => [header, ...rows.map((r) => r.join(","))].join("\n") + "\n";

/** Test 1: 1,000 trades, 99% winners of +1 and 1% losers of -150, losers spread evenly. */
export function bot99(): string {
  const days = weekdays("2023-01-02", 1000);
  return csv("close_time,symbol,pnl", days.map((d, i) => [`${d} 16:00:00`, "BTCUSD", i % 100 === 50 ? -150 : 1]));
}

/** Test 2: 500 trades over two years, 56% winners, payoff ratio 1.0, wins spread evenly. */
export function honestEdge(): string {
  const days = weekdays("2023-01-02", 522);
  const rows: (string | number)[][] = [];
  for (let i = 0; i < 500; i++) {
    const win = Math.floor((i + 1) * 0.56) > Math.floor(i * 0.56);
    rows.push([`${days[Math.floor((i * 522) / 500)]} 15:30:00`, "EURUSD", win ? 100 : -100]);
  }
  return csv("close_time,symbol,pnl", rows);
}

/** Test 3: doubles size after each loss, back to 1 after a win. Profitable overall. */
export function martingaleLog(): string {
  const days = weekdays("2024-01-01", 240);
  // Losing streaks of 1 to 3 trades between runs of wins.
  const pattern = ["W", "W", "W", "L", "W", "W", "L", "L", "W", "W", "W", "W", "L", "L", "L", "W", "W", "W"];
  const rows: (string | number)[][] = [];
  let size = 1;
  days.forEach((d, i) => {
    const win = pattern[i % pattern.length] === "W";
    rows.push([i + 1, `${d} 10:00:00`, `${d} 18:00:00`, "GBPUSD", "buy", size, win ? 10 * size : -10 * size]);
    size = win ? 1 : size * 2;
  });
  return csv("trade_id,open_time,close_time,symbol,side,size,pnl", rows);
}

/** Test 4: a backtest whose buys enter at the day's low on 80% of trades, with the day ranges it was run on. */
export function peekingLog(): { text: string; prices: PriceBook } {
  const days = weekdays("2024-03-01", 60);
  const map = new Map<string, [number, number]>();
  const rows: (string | number)[][] = [];
  days.forEach((d, i) => {
    const lo = +(1.07 + (i % 7) * 0.002).toFixed(4);
    const hi = +(lo + 0.008).toFixed(4);
    map.set(d, [lo, hi]);
    const entry = i % 5 === 4 ? +(lo + 0.004).toFixed(4) : lo; // 4 in 5 at the very low
    const exit = +(lo + 0.006).toFixed(4);
    rows.push([i + 1, `${d} 09:00:00`, `${d} 20:00:00`, "EURUSD", "buy", 1, entry, exit, Math.round((exit - entry) * 100000)]);
  });
  return {
    text: csv("trade_id,open_time,close_time,symbol,side,size,entry,exit,pnl", rows),
    prices: { EURUSD: { kind: "hl", days: map, source: "test ranges" } },
  };
}
