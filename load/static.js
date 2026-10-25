// Anonymous visitors on public pages that never run a function (REF-0025): legal, blog,
// learn, ideas, notes, the public JSON files and a built asset. Pages serves these from
// its own edge store, so they cost nothing and count against no daily limit.
//   BASE=https://<preview>.parity-research.pages.dev STEPS=25,50,100,200 STEP_S=30 make load-static
import http from "k6/http";
import { check } from "k6";
import { base, stepRates, stepped, summarize } from "./lib.js";

const B = base();
const PATHS = [
  "/legal/", "/legal/privacy/", "/legal/terms/", "/legal/risk/", "/legal/regulatory/", "/legal/cookies/",
  "/blog/", "/blog/publish-the-failures-too/", "/news/",
  "/learn/", "/learn/a-book-and-b-book/", "/learn/accredited-investor/",
  "/ideas/avellaneda-stoikov-market-making/", "/ideas/betting-against-beta/",
  "/notes/dec-0001/", "/notes/dec-0002/",
  "/stats.json", "/news/index.json", "/blog/index.json", "/sitemap.xml", "/robots.txt", "/favicon.svg",
];
const ASSET = __ENV.ASSET || ""; // optional: one /assets/<hashed>.js from the deploy

export const options = stepped({ fn: "visit", rates: stepRates("25,50,100,200,400"), seconds: Number(__ENV.STEP_S || 30), fnShare: 0 });

export function visit() {
  const list = ASSET ? [...PATHS, ASSET] : PATHS;
  const p = list[Math.floor(Math.random() * list.length)];
  const r = http.get(B + p, { tags: { name: p.endsWith(".json") ? "json" : "page" }, redirects: 0 });
  check(r, { "200": (x) => x.status === 200 });
}

export function handleSummary(data) { return summarize("static", data); }
