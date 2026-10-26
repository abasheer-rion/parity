// Writes the small, made-up Parity Terminal export the E2E suite serves at /data/terminal/
// (e2e/data/terminal/). Seeded, so every run and every machine gets the same numbers.
//   node e2e/data/make-terminal.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const OUT = resolve(import.meta.dirname, "terminal");
const ASOF = "2026-10-23";
let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

const SERIES = [
  { key: "eq.US_MKT", label: "US stock market", short: "US market", group: "eq", class: "equities", start: 210, vol: 0.011, unit: "index" },
  { key: "fx.EUR", label: "Euro in US dollars", short: "EUR/USD", group: "fx", class: "fx", start: 1.12, vol: 0.005, unit: "USD" },
  { key: "crypto.BTC", label: "Bitcoin in US dollars", short: "BTC", group: "crypto", class: "crypto", start: 9000, vol: 0.035, unit: "USD" },
  { key: "cmd.WTI", label: "WTI crude oil", short: "WTI", group: "cmd", class: "commodities", start: 55, vol: 0.02, unit: "USD/bbl" },
  { key: "rate.UST10Y", label: "US 10-year yield", short: "UST 10Y", group: "rates", class: "rates", start: 2.1, vol: 0.02, unit: "%", kind: "level" },
];
const GROUPS = [
  { id: "eq", label: "Equities", class: "equities" }, { id: "fx", label: "Currencies", class: "fx" },
  { id: "crypto", label: "Crypto", class: "crypto" }, { id: "cmd", label: "Commodities", class: "commodities" },
  { id: "rates", label: "Rates", class: "rates" },
];

function days(from, to) {
  const out = [];
  for (let d = new Date(`${from}T00:00:00Z`); d <= new Date(`${to}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
    const w = d.getUTCDay();
    if (w !== 0 && w !== 6) out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

mkdirSync(resolve(OUT, "s"), { recursive: true });
const dates = days("2019-01-01", ASOF);
const index = { generated_at: `${ASOF}T22:00:00Z`, data_through: ASOF, groups: GROUPS, series: [] };
for (const s of SERIES) {
  let v = s.start;
  const points = dates.map((d) => { v = Math.max(0.01, v * (1 + (rand() - 0.48) * s.vol * 2)); return [d, Number(v.toPrecision(6))]; });
  const last = points.at(-1)[1];
  const back = (n) => points.at(-1 - n)[1];
  const pct = (a) => Number(((last / a - 1) * 100).toFixed(2));
  const file = `s/${s.key}.json`;
  writeFileSync(resolve(OUT, file), JSON.stringify({ key: s.key, points }));
  index.series.push({
    key: s.key, label: s.label, short: s.short, group: s.group, class: s.class, source: "Made-up test data", licence: "test only",
    kind: s.kind ?? "price", unit: s.unit, freq: "D", first: dates[0], asof: ASOF, last,
    chg: { d1: pct(back(1)), w1: pct(back(5)), m1: pct(back(21)), ytd: pct(back(200)) },
    vol: Number((s.vol * Math.sqrt(252) * 100).toFixed(1)), z: Number(((rand() - 0.5) * 3).toFixed(2)), pct1y: Math.round(rand() * 100),
    spark: points.slice(-60).map((p) => p[1]), file,
  });
}
writeFileSync(resolve(OUT, "index.json"), JSON.stringify(index));
console.log(`terminal fixture: ${SERIES.length} series, ${dates.length} days to ${ASOF}`);
