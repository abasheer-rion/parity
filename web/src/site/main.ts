// Motion for the public front page (web/index.html). The page is complete without
// this script; it only adds movement on top:
//   - sections fade up as they scroll into view
//   - counters count up once, from /stats.json when it is there
//   - the "how an idea becomes a result" story follows the scroll
//   - the app preview and the terminal preview loop only while they are on screen
//   - the terminal preview and the market tape fill in with real closes from
//     /stats.json (DEC-0021); until then the preview says it shows example values
//   - cards lean toward the pointer
//   - the 3D globe loads when its section comes near, never for reduced motion
//   - the large scale sim loads when its section comes near the screen
// The rules are in the motion decision (DEC-0017).
// Lenis is imported directly (not through lib/scroll) so no stylesheet is linked;
// its few rules are inlined in index.html.
import Lenis from "lenis";

const root = document.documentElement;
const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
const $$ = <T extends Element = HTMLElement>(sel: string) => Array.from(document.querySelectorAll<T & Element>(sel)) as T[];

if (!reduce) new Lenis({ autoRaf: true, lerp: 0.11, smoothWheel: true });

// Header gains a backdrop once the page has scrolled.
const header = document.querySelector("header");
const onScroll = () => header?.classList.toggle("scrolled", window.scrollY > 8);
window.addEventListener("scroll", onScroll, { passive: true });
onScroll();

// Reveals. Anything already on screen is shown at once, so nothing visible blinks.
const reveals = $$(".rv");
if (!reduce && "IntersectionObserver" in window) {
  const vh = window.innerHeight;
  for (const el of reveals) {
    const r = el.getBoundingClientRect();
    if (r.top < vh && r.bottom > 0) el.classList.add("in");
  }
  root.classList.add("motion");
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
  }, { rootMargin: "0px 0px -8% 0px" });
  reveals.filter((el) => !el.classList.contains("in")).forEach((el) => io.observe(el));
}

// Counters. The HTML already holds a true value or a rounded, labelled one.
const fmt = (n: number) => Math.round(n).toLocaleString("en-US");
function countUp(el: HTMLElement, target: number) {
  const text = fmt(target);
  el.style.minWidth = `${text.length}ch`;
  if (reduce) { el.textContent = text; return; }
  const t0 = performance.now();
  const ms = 1400;
  const step = (t: number) => {
    const p = Math.min(1, (t - t0) / ms);
    el.textContent = fmt(target * (1 - Math.pow(1 - p, 3)));
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
const counters = $$("[data-count]");
const targets = new Map<HTMLElement, number>();
for (const el of counters) {
  const n = Number(el.dataset.count);
  if (Number.isFinite(n) && n > 0) targets.set(el, n);
}
const seen = new Set<HTMLElement>();
const tryCount = (el: HTMLElement) => {
  const n = targets.get(el);
  if (n != null && seen.has(el) && !el.dataset.done) { el.dataset.done = "1"; countUp(el, n); }
};
const cio = new IntersectionObserver((entries) => {
  for (const e of entries) if (e.isIntersecting) { seen.add(e.target as HTMLElement); tryCount(e.target as HTMLElement); cio.unobserve(e.target); }
}, { threshold: 0.6 });
counters.forEach((el) => cio.observe(el));
interface StripItem { k: string; n: string; v: number | null; kind: string; d1: number | null; asof: string | null; s: (number | null)[]; src: string }
type Stats = Record<string, unknown> & { strip?: StripItem[]; data_through?: string | null };

fetch("/stats.json", { cache: "no-cache" })
  .then((r) => (r.ok ? r.json() : null))
  .then((st: Stats | null) => {
    fillStrip(st?.strip ?? [], st?.data_through ?? null);
    if (!st) return;
    const s = st as Record<string, unknown>;
    // Each tested strategy is rerun on 1,000 reshuffled histories and 500 with its
    // timing scrambled (N_BOOTSTRAP and N_PLACEBO in engine/src/parity/gauntlet.py).
    if (typeof s.strategies_tested === "number") s.histories_per_run = s.strategies_tested * 1500;
    for (const el of counters) {
      const key = el.dataset.stat;
      const n = key ? s[key] : undefined;
      if (typeof n === "number" && n > 0) {
        targets.set(el, n);
        el.closest(".stat")?.classList.add("live");
        if (!seen.has(el)) el.textContent = fmt(n);
        tryCount(el);
      }
    }
  })
  .catch(() => fillStrip([], null));

// The market strip: real daily closes, in the terminal preview and the tape. Rows and the
// tape have fixed heights, so filling them in moves nothing (DEC-0030).
const day = (iso: string | null) => (iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }) : "");
const fmtLast = (v: number | null, kind: string) => {
  if (v == null) return "-";
  if (kind === "level") return v.toFixed(2);
  const a = Math.abs(v);
  return a >= 1000 ? Math.round(v).toLocaleString("en-US") : v.toFixed(a >= 10 ? 2 : 4);
};
const fmtChg = (d: number | null, kind: string) => (d == null ? "-" : `${d > 0 ? "+" : ""}${d.toFixed(2)}${kind === "level" ? "" : "%"}`);
const tone = (d: number | null) => (d == null || d === 0 ? "" : d > 0 ? "up" : "dn");
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text = "") => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
};
function spark(values: (number | null)[]): SVGSVGElement {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 60 18");
  svg.setAttribute("preserveAspectRatio", "none");
  const v = values.filter((x): x is number => x != null);
  if (v.length > 1) {
    const lo = Math.min(...v), hi = Math.max(...v), span = hi - lo || 1;
    const line = document.createElementNS(ns, "polyline");
    line.setAttribute("points", v.map((x, i) => `${((i * 60) / (v.length - 1)).toFixed(1)},${(17 - ((x - lo) / span) * 16).toFixed(1)}`).join(" "));
    line.setAttribute("stroke", v[v.length - 1] >= v[0] ? "#36d07c" : "#ff5b52");
    svg.append(line);
  }
  return svg;
}
function fillStrip(items: StripItem[], through: string | null) {
  const tapeAsof = document.getElementById("tape-asof");
  const run = document.getElementById("tape-run");
  const tape = document.getElementById("tape");
  if (!items.length) {
    if (tapeAsof) tapeAsof.textContent = "not loaded";
    if (run) run.replaceChildren(el("span", "ti", "The market strip fills in when the site is deployed with the latest data."));
    return;
  }
  const newest = items.reduce((m, it) => (it.asof && it.asof > m ? it.asof : m), "");
  if (tapeAsof) tapeAsof.textContent = day(through ?? newest);
  // The terminal preview: the first eight series, in place of the example rows.
  const rows = document.getElementById("tp-rows");
  const tp = document.getElementById("tp");
  if (rows && tp) {
    rows.replaceChildren(...items.slice(0, rows.children.length || 8).map((it) => {
      const row = el("div", "tp-row");
      row.append(el("b", "", it.k), el("span", "nm", it.n), el("span", "r", fmtLast(it.v, it.kind)), el("span", `r ${tone(it.d1)}`, fmtChg(it.d1, it.kind)), spark(it.s));
      return row;
    }));
    tp.classList.add("real");
    const asof = document.getElementById("tp-asof");
    if (asof) asof.textContent = `DATA THROUGH ${day(through ?? newest).toUpperCase()}`;
    const src = document.getElementById("tp-src");
    if (src) {
      const names = [...new Set(items.slice(0, 8).map((it) => it.src.replace(/\s*\(.*\)$/, "")))].join(", ");
      src.replaceChildren(el("span", "tp-tag", "REAL"), document.createTextNode(`Daily closes from ${names}`));
    }
    tp.setAttribute("aria-label", `A preview of Parity Terminal's market monitor with real daily closes as of ${day(through ?? newest)}: ${items.slice(0, 8).map((it) => `${it.n} ${fmtLast(it.v, it.kind)}`).join(", ")}.`);
  }
  // The tape: every series, twice over, so the loop is seamless.
  if (run && tape) {
    const make = () => items.map((it) => {
      const t = el("span", "ti");
      t.append(el("b", "", it.k), document.createTextNode(fmtLast(it.v, it.kind)), el("em", tone(it.d1), fmtChg(it.d1, it.kind)), el("small", "", day(it.asof)));
      t.querySelector("em")!.style.fontStyle = "normal";
      return t;
    });
    const first = make();
    const second = make();
    second.forEach((t) => t.setAttribute("aria-hidden", "true"));
    run.replaceChildren(...first, ...second);
    if (!reduce) {
      tape.style.setProperty("--tape-s", `${items.length * 4}s`);
      tape.classList.add("moving");
    }
  }
}

// The scroll story: the step nearest the middle of the screen drives the picture.
const story = document.querySelector<HTMLElement>(".story");
if (story) {
  const steps = $$(".story-step");
  const setStep = (i: number) => {
    story.dataset.step = String(i);
    steps.forEach((s, k) => s.classList.toggle("on", k === i));
  };
  setStep(0);
  const sio = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) setStep(steps.indexOf(e.target as HTMLElement));
  // On narrow screens the picture sits on top, so the step below it is the one in view.
  }, { rootMargin: window.matchMedia("(max-width: 960px)").matches ? "-62% 0px -30% 0px" : "-48% 0px -48% 0px" });
  steps.forEach((s) => sio.observe(s));
}

// The app preview loops only while someone can see it.
const device = document.querySelector(".device");
if (device && !reduce) {
  new IntersectionObserver(([e]) => device.classList.toggle("playing", e.isIntersecting), { threshold: 0.25 }).observe(device);
}

// The terminal preview: the command types itself, and the selection cursor walks the rows
// as it would under the arrow keys. The values never change: they are the last closes.
const tpEl = document.getElementById("tp");
if (tpEl && !reduce) {
  let timer = 0, at = 0;
  const walk = () => {
    const rows = Array.from(tpEl.querySelectorAll(".tp-row"));
    rows.forEach((r, i) => r.classList.toggle("sel", i === at % rows.length));
    at++;
  };
  new IntersectionObserver(([e]) => {
    tpEl.classList.toggle("playing", e.isIntersecting);
    window.clearInterval(timer);
    if (e.isIntersecting) { walk(); timer = window.setInterval(walk, 1800); }
  }, { threshold: 0.25 }).observe(tpEl);
}

// Cards lean a few degrees toward the pointer.
if (finePointer && !reduce) {
  for (const el of $$("[data-tilt]")) {
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      el.style.setProperty("--rx", `${(-y * 6).toFixed(2)}deg`);
      el.style.setProperty("--ry", `${(x * 8).toFixed(2)}deg`);
      el.style.setProperty("--gx", `${((x + 0.5) * 100).toFixed(1)}%`);
      el.style.setProperty("--gy", `${((y + 0.5) * 100).toFixed(1)}%`);
    });
    el.addEventListener("pointerleave", () => { el.style.setProperty("--rx", "0deg"); el.style.setProperty("--ry", "0deg"); });
  }
}

// After the page has loaded and the browser is idle.
const idle = (f: () => void) => (window.requestIdleCallback ? window.requestIdleCallback(f, { timeout: 2000 }) : setTimeout(f, 200));
const afterLoad = (f: () => void) => {
  if (document.readyState === "complete") idle(f);
  else window.addEventListener("load", () => idle(f), { once: true });
};

// The large scale sim, loaded only when its section comes near the screen. With
// reduced motion it draws one still picture. Rules: DEC-0021.
const simStage = document.getElementById("sim-stage");
const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
if (simStage && !saveData && "IntersectionObserver" in window) {
  const drawn = document.getElementById("sim-drawn");
  const scn = document.getElementById("sim-scn");
  const load = () => import("./paths").then(({ startSim }) => startSim(simStage, {
    reduce,
    onScenario: (label) => { if (scn) scn.textContent = `Illustrative paths: ${label.toLowerCase()}`; },
    onDrawn: (n) => { if (drawn) drawn.textContent = fmt(n); },
  })).catch(() => undefined);
  const near = new IntersectionObserver(([e]) => {
    if (e.isIntersecting) { near.disconnect(); afterLoad(load); }
  }, { rootMargin: "400px 0px" });
  near.observe(simStage);
}

// The 3D globe, when its section comes near and only where it can run well.
function webgl(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch { return false; }
}
const art = document.getElementById("hero-art");
if (art && !reduce && !saveData && "IntersectionObserver" in window) {
  const near = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return;
    near.disconnect();
    afterLoad(() => {
      if (!webgl()) return;
      import("./hero3d").then(({ startHero }) => startHero(art, art.closest<HTMLElement>("section") ?? art)).catch(() => undefined);
    });
  }, { rootMargin: "300px 0px" });
  near.observe(art);
}
