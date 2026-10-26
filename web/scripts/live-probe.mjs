// Probe of the public live feed (DEC-0063), as a signed-out visitor sees it: connect to
// /live/ws?src=onchain, subscribe, and count what arrives. Fails (exit 1) unless a price
// arrives within MAX_FIRST_MS and live updates keep coming. Prints one JSON line.
//   node scripts/live-probe.mjs [origin] [seconds] [symbols]
// The clock is set against the edge with ping and pong, so lag is block time to this client.
const ORIGIN = process.argv[2] || "wss://parity.endyland.com";
const SECS = Number(process.argv[3] || 60);
const SYMS = (process.argv[4] || "ETH-USD,BTC-USD,BNB-USD").split(",");
const MAX_FIRST_MS = 5_000;
const ws = new WebSocket(`${ORIGIN}/live/ws?src=onchain`);
const t0 = Date.now();
const log = [];
let live = 0, replayed = 0, first = null, best = { rtt: Infinity, off: 0 };
const lags = [];
ws.onopen = () => {
  ws.send(JSON.stringify({ op: "sub", s: SYMS }));
  setInterval(() => ws.send(JSON.stringify({ op: "ping", c: Date.now() })), 2000);
};
ws.onmessage = (e) => {
  const now = Date.now();
  const m = JSON.parse(e.data);
  if (m.op === "pong") { const r = now - m.c; if (r < best.rtt) best = { rtt: r, off: m.ts - (m.c + now) / 2 }; return; }
  if (m.op === "t") {
    for (const t of m.d) { if (t.r) replayed += 1; else { live += 1; lags.push(now + best.off - t.te); } first ??= now - t0; }
    return;
  }
  log.push(`${((now - t0) / 1000).toFixed(1)}s ${m.op}${m.up ? `:${m.up}` : ""}${m.why ? ` (${m.why})` : ""}`);
};
ws.onclose = (e) => log.push(`closed ${e.code}`);
setTimeout(() => {
  lags.sort((a, b) => a - b);
  const q = (p) => (lags.length ? Math.round(lags[Math.floor(p * (lags.length - 1))]) : null);
  const out = { origin: ORIGIN, secs: SECS, symbols: SYMS, firstPriceMs: first, replayed, live, perSec: +(live / SECS).toFixed(2), lagP50Ms: q(0.5), lagP95Ms: q(0.95), events: log };
  console.log(JSON.stringify(out));
  const ok = first != null && first <= MAX_FIRST_MS && live > 0;
  if (!ok) console.error(first == null ? "No price arrived." : first > MAX_FIRST_MS ? `First price took ${first} ms.` : "No live updates arrived.");
  process.exit(ok ? 0 : 1);
}, SECS * 1000);
