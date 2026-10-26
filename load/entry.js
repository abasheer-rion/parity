// The front page and the signed-out app entry (REF-0025). Each of these runs the site's
// function (functions/_middleware.ts): "/" on every host (for the sim., trade., academy. and
// lab. addresses), and each app address, which sends a signed-out visitor to /login/?next=.
// Every request here counts against the free plan's 100,000 function requests a day.
//   BASE=https://<preview>.parity-research.pages.dev STEPS=10,25,50 STEP_S=30 make load-entry
import http from "k6/http";
import { check } from "k6";
import { base, byName, stepRates, stepped, summarize } from "./lib.js";

const B = base();
const APPS = ["/app/", "/research/", "/sim/", "/trade/", "/academy/", "/lab/", "/trade/#/markets", "/app/strategies", "/academy/x/y"];

export const options = stepped({ fn: "enter", rates: stepRates("10,25,50,100"), seconds: Number(__ENV.STEP_S || 30), fnShare: 1, extraThresholds: byName(["front", "app-signed-out"]) });

export function enter() {
  if (Math.random() < 0.5) {
    const r = http.get(B + "/", { tags: { name: "front" }, redirects: 0 });
    check(r, { "front 200": (x) => x.status === 200 && x.body.length > 10000 });
    return;
  }
  const p = APPS[Math.floor(Math.random() * APPS.length)];
  const r = http.get(B + p, { tags: { name: "app-signed-out" }, redirects: 0 });
  check(r, { "to log in": (x) => x.status === 302 && String(x.headers.Location || "").startsWith("/login/?next=") });
}

export function handleSummary(data) { return summarize("entry", data); }
