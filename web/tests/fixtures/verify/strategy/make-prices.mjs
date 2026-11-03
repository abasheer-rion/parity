// Writes prices.json: a made-up daily price file in the shape of /data/verify/prices.json, for
// the strategy tests and the end-to-end suite. Seeded random walks, so it is the same every
// time; levels and swings are roughly those of the real markets. Not real prices.
//   node tests/fixtures/verify/strategy/make-prices.mjs
import { writeFileSync } from "node:fs";
import { join } from "node:path";

let seed = 20261103;
const rand = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const normal = () => { const u = Math.max(rand(), 1e-12), v = rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

function walk({ start, drift, vol, weekends }) {
  const rows = [];
  let p = start;
  const perYear = weekends ? 365 : 252;
  for (let ms = Date.UTC(2016, 0, 4); ms <= Date.UTC(2026, 9, 30); ms += 86_400_000) {
    const dow = new Date(ms).getUTCDay();
    if (!weekends && (dow === 0 || dow === 6)) continue;
    rows.push([new Date(ms).toISOString().slice(0, 10), Number(p.toPrecision(7))]);
    p *= Math.exp((drift - vol * vol / 2) / perYear + (vol / Math.sqrt(perYear)) * normal());
  }
  return rows;
}

const doc = {
  generated_at: "2026-11-03T00:00:00+00:00",
  symbols: {
    EURUSD: { kind: "price", source: "Test prices (made up)", rows: walk({ start: 1.0862, drift: 0, vol: 0.07, weekends: false }) },
    BTCUSD: { kind: "price", source: "Test prices (made up)", rows: walk({ start: 433, drift: 0.45, vol: 0.7, weekends: true }) },
    SPX: { kind: "price", source: "Test prices (made up)", rows: walk({ start: 2012, drift: 0.09, vol: 0.17, weekends: false }) },
  },
};
writeFileSync(join(import.meta.dirname, "prices.json"), JSON.stringify(doc));
