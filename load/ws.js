// Live data fan-out (REF-0025): many viewers on one public delayed feed (CoinGecko, served
// from the parity-live Durable Object). The object holds one upstream line per source and
// relays to every viewer, so this tests our fan-out, not CoinGecko: the number of viewers
// never changes what is asked upstream (one market list every 30 s).
// Each viewer opens /live/ws?src=coingecko, subscribes to the market overview ("*"), pings
// every 15 s like the site does, and measures:
//   ws_connect_ms   time to an open socket
//   ws_delivery_ms  our receive time minus the edge's send time (ts) on each live update,
//                   corrected by the clock offset each viewer measures with ping and pong
//                   (this machine's clock can be seconds off Cloudflare's, as the site's is)
//   ws_rtt_ms       ping to pong
//   ws_msgs         messages received
//   ws_open_fail    sockets that failed to open or were refused
// Viewers ramp in steps (STEPS, held STEP_S seconds each). The object refuses viewers past
// 500 per source (MAX_VIEWERS in web/live/src/hub.ts); stay well under it on the live object.
//   BASE=https://<preview>.parity-research.pages.dev STEPS=50,100,200 STEP_S=90 make load-ws
import { WebSocket } from "k6/websockets";
import exec from "k6/execution";
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
// Which step (viewer count) a moment belongs to, so delivery is reported per step. The 10 s
// ramp before each hold counts toward the step it ramps to.
const stepAt = (ms) => {
  let t = 0;
  for (const n of rates) { t += (10 + hold) * 1000; if (ms < t) return n; }
  return rates[rates.length - 1];
};
const perStep = Object.fromEntries(rates.flatMap((n) => [[`ws_delivery_ms{step:${n}}`, ["max>=0"]], [`ws_connect_ms{step:${n}}`, ["max>=0"]]]));
if (Math.max(...rates) > 450) throw new Error("Over 450 viewers would crowd out real ones (the object stops at 500).");

export const options = {
  scenarios: { viewers: { executor: "ramping-vus", startVUs: 0, stages, gracefulRampDown: "5s", gracefulStop: "10s" } },
  thresholds: {
    ws_open_fail: [{ threshold: "rate<0.02", abortOnFail: true, delayAbortEval: "20s" }],
    ws_delivery_ms: [{ threshold: "p(95)<2000", abortOnFail: true, delayAbortEval: "60s" }],
    ...perStep,
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
  let offset = null; // edge clock minus ours, from the first pong
  let openedAt = 0;
  const ping = () => { c += 1; sent.set(c, Date.now()); ws.send(JSON.stringify({ op: "ping", c })); };
  ws.onopen = () => {
    openedAt = Date.now();
    opened = true;
    connect.add(Date.now() - t0, { step: String(stepAt(Date.now() - exec.scenario.startTime)) });
    fail.add(false);
    ws.send(JSON.stringify({ op: "sub", s: ["*"] }));
    ping();
    pinger = setInterval(ping, 15000);
  };
  ws.onmessage = (e) => {
    const now = Date.now();
    msgs.add(1);
    let m;
    try { m = JSON.parse(e.data); } catch { return; }
    if (m.op === "pong" && sent.has(m.c)) {
      const t = sent.get(m.c);
      rtt.add(now - t);
      if (offset === null) offset = m.ts - (t + now) / 2;
      sent.delete(m.c);
      return;
    }
    // Live updates only: the catch-up a viewer gets on subscribing comes within a moment of opening.
    if ((m.op === "r" || m.op === "t") && typeof m.ts === "number" && offset !== null && now - openedAt > 2000) delivery.add(Math.max(0, now + offset - m.ts), { step: String(stepAt(now - exec.scenario.startTime)) });
  };
  ws.onerror = () => { if (!opened) fail.add(true); };
  ws.onclose = () => { if (pinger) clearInterval(pinger); if (!opened) fail.add(true); };
  // Each viewer stays for the rest of its step, then the next iteration opens a new one.
  setTimeout(() => ws.close(), (hold + 10) * 1000);
}

export function handleSummary(data) { return summarize("ws", data); }
