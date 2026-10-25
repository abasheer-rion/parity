// Live data fan-out (REF-0025): many viewers on one public delayed feed (CoinGecko, served
// from the parity-live Durable Object). The object holds one upstream line per source and
// relays to every viewer, so this tests our fan-out, not CoinGecko: the number of viewers
// never changes what is asked upstream (one market list every 30 s).
// Each viewer opens /live/ws?src=coingecko, subscribes to the market overview ("*"), pings
// every 15 s like the site does, and measures:
//   ws_connect_ms   time to an open socket
//   ws_delivery_ms  our receive time minus the edge's send time (ts) on each update; includes
//                   any clock difference between this machine and Cloudflare (a few ms)
//   ws_rtt_ms       ping to pong
//   ws_msgs         messages received
//   ws_open_fail    sockets that failed to open or were refused
// Viewers ramp in steps (STEPS, held STEP_S seconds each). The object refuses viewers past
// 500 per source (MAX_VIEWERS in web/live/src/hub.ts); stay well under it on the live object.
//   BASE=https://<preview>.parity-research.pages.dev STEPS=50,100,200 STEP_S=90 make load-ws
import { WebSocket } from "k6/websockets";
import { Counter, Rate, Trend } from "k6/metrics";
import { base, stepRates } from "./lib.js";
import { summarize } from "./lib.js";

const B = base().replace(/^http/, "ws");
const SRC = __ENV.SRC || "coingecko";
const connect = new Trend("ws_connect_ms", true);
const delivery = new Trend("ws_delivery_ms", true);
const rtt = new Trend("ws_rtt_ms", true);
const msgs = new Counter("ws_msgs");
const fail = new Rate("ws_open_fail");

const rates = stepRates("50,100,200");
const hold = Number(__ENV.STEP_S || 90);
const stages = [];
for (const n of rates) stages.push({ duration: "10s", target: n }, { duration: `${hold}s`, target: n });
stages.push({ duration: "10s", target: 0 });
if (Math.max(...rates) > 450) throw new Error("Over 450 viewers would crowd out real ones (the object stops at 500).");

export const options = {
  scenarios: { viewers: { executor: "ramping-vus", startVUs: 0, stages, gracefulRampDown: "5s", gracefulStop: "10s" } },
  thresholds: {
    ws_open_fail: [{ threshold: "rate<0.02", abortOnFail: true, delayAbortEval: "20s" }],
    ws_delivery_ms: [{ threshold: "p(95)<2000", abortOnFail: true, delayAbortEval: "60s" }],
  },
  summaryTrendStats: ["avg", "med", "p(95)", "p(99)", "max"],
};

export default function () {
  const t0 = Date.now();
  const ws = new WebSocket(`${B}/live/ws?src=${SRC}`);
  let opened = false;
  let pinger = null;
  let c = 0;
  const sent = new Map();
  ws.onopen = () => {
    opened = true;
    connect.add(Date.now() - t0);
    fail.add(false);
    ws.send(JSON.stringify({ op: "sub", s: ["*"] }));
    pinger = setInterval(() => { c += 1; sent.set(c, Date.now()); ws.send(JSON.stringify({ op: "ping", c })); }, 15000);
  };
  ws.onmessage = (e) => {
    const now = Date.now();
    msgs.add(1);
    let m;
    try { m = JSON.parse(e.data); } catch { return; }
    if (m.op === "pong" && sent.has(m.c)) { rtt.add(now - sent.get(m.c)); sent.delete(m.c); return; }
    if ((m.op === "r" || m.op === "t") && typeof m.ts === "number" && !m.full) delivery.add(now - m.ts);
  };
  ws.onerror = () => { if (!opened) fail.add(true); };
  ws.onclose = () => { if (pinger) clearInterval(pinger); if (!opened) fail.add(true); };
  // Each viewer stays for the rest of its step, then the next iteration opens a new one.
  setTimeout(() => ws.close(), (hold + 10) * 1000);
}

export function handleSummary(data) { return summarize("ws", data); }
