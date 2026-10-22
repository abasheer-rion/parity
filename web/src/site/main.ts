// Motion for the public front page (web/index.html). The page is complete without
// this script; it only adds movement on top:
//   - sections fade up as they scroll into view
//   - counters count up once, from /stats.json when it is there
//   - the "how an idea becomes a result" story follows the scroll
//   - the app preview loops only while it is on screen
//   - cards lean toward the pointer
//   - the 3D hero loads after first paint, never for people who ask for reduced motion
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
fetch("/stats.json", { cache: "no-cache" })
  .then((r) => (r.ok ? r.json() : null))
  .then((s: Record<string, number> | null) => {
    if (!s) return;
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
  .catch(() => undefined);

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

// The 3D hero, after first paint and only where it can run well.
function webgl(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch { return false; }
}
const art = document.getElementById("hero-art");
if (art && !reduce && !saveData) {
  afterLoad(() => {
    if (!webgl()) return;
    import("./hero3d").then(({ startHero }) => startHero(art, document.querySelector<HTMLElement>(".hero") ?? art)).catch(() => undefined);
  });
}
