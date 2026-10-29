// Motion for the public front page (web/index.html, DEC-0039, DEC-0080). The page is complete
// without this script: every picture's finished state is the default. On top it adds:
//   - the hero field (field.ts), after first paint, where WebGL can run it well
//   - two scroll-driven scenes: Bot Battle's trades ticking in and the balance collapsing,
//     and a Verify check (file in, five checks, verdict, "survives up to N tries")
//   - counters and bars from /stats.json, and sections that fade up
//   - floating corner controls that step aside while you scroll down
//   - the sign-in panel (DEC-0044): Log in and Sign up fade the page out and the panel in,
//     over the same backdrop, with the form in the address (/#login, /#signup, /#reset)
import Lenis from "lenis";
import "./viewTransitions";
import { botTrades, TRADES } from "./botPath";
import { startPwa } from "../pwa/install";
import { startRum } from "../lib/rum";
import { isDesktop } from "../desktop/bridge";
import { motionLevel } from "../ui/motionCore";

startPwa();
startRum("site", { desktop: isDesktop() });

const root = document.documentElement;
// Reduced motion (the device asks, unless the Motion setting says Full; or the setting says
// Reduced, REF-0023): sections still fade in as they arrive (html.motion-lite, kit.css), but
// nothing rises, counts, pins or loops.
const reduce = motionLevel() === "reduced";
const $$ = <T extends HTMLElement = HTMLElement>(sel: string, el: ParentNode = document) => Array.from(el.querySelectorAll<T>(sel));
const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const fmt = (n: number) => Math.round(n).toLocaleString("en-US");
const money = (n: number) => `$${fmt(n)}`;

const lenis = reduce ? null : new Lenis({ autoRaf: true, lerp: 0.1, smoothWheel: true });
root.classList.add(reduce ? "motion-lite" : "motion");

// The corner controls: glass once the page scrolls, out of the way while scrolling down,
// back on the way up. Focus always brings them back (CSS :focus-within).
const corners = $$(".corner");
let lastY = window.scrollY;
const onCorner = () => {
  const y = window.scrollY;
  corners.forEach((c) => {
    c.classList.toggle("solid", y > 24);
    if (!reduce) c.classList.toggle("away", y > window.innerHeight * 0.9 && y > lastY + 2);
  });
  if (Math.abs(y - lastY) > 2) lastY = y;
};
window.addEventListener("scroll", onCorner, { passive: true });
onCorner();

// The sign-in panel (DEC-0044). Clicking Log in or Sign up adds #login or #signup to the
// address, fades the page out (CSS: html.auth-open) and loads the panel (src/auth/front.tsx),
// which fades in over the same backdrop. Back, Escape and the logo close it again. The
// links keep their /login/ and /signup/ addresses, so they still work with no script, in a
// new tab, or if the panel cannot load.
type AuthView = "login" | "signup" | "reset";
const AUTH_VIEWS: readonly string[] = ["login", "signup", "reset"];
const authHash = (): AuthView | null => {
  const v = window.location.hash.slice(1);
  return AUTH_VIEWS.includes(v) ? (v as AuthView) : null;
};
let authApi: Promise<import("../auth/front").FrontAuth> | null = null;
let opener: HTMLElement | null = null;
let pushed = false;
const loadAuth = () => (authApi ??= import("../auth/front").then(({ startFrontAuth }) => startFrontAuth(document.getElementById("auth-root")!, {
  // Closing undoes the history entry the click added, so Back and close agree.
  onClose: () => {
    if (pushed) { window.history.back(); return; }
    window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
    syncAuth();
  },
  // Switching between log in, sign up and reset inside the panel replaces the entry.
  onView: (view) => window.history.replaceState(window.history.state, "", `#${view}`),
  stopScroll: () => lenis?.stop(),
  startScroll: () => lenis?.start(),
})));
function syncAuth() {
  const view = authHash();
  if (view) {
    root.classList.add("auth-open");
    loadAuth().then((auth) => auth.open(view, opener)).catch(() => { window.location.href = `/${view}/`; });
  } else {
    pushed = false;
    authApi?.then((auth) => auth.close()).catch(() => undefined);
    if (!authApi) root.classList.remove("auth-open");
  }
}
for (const a of $$<HTMLAnchorElement>("a[data-auth]")) {
  // Start loading on hover or focus, so the panel is ready by the click.
  a.addEventListener("pointerenter", () => void loadAuth().catch(() => undefined), { once: true });
  a.addEventListener("focus", () => void loadAuth().catch(() => undefined), { once: true });
  a.addEventListener("click", (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    opener = a;
    if (authHash() !== a.dataset.auth) {
      window.history.pushState({ parityAuth: true }, "", `#${a.dataset.auth}`);
      pushed = true;
    }
    syncAuth();
  });
}
window.addEventListener("popstate", syncAuth);
window.addEventListener("hashchange", syncAuth);
if (authHash()) syncAuth();

// Reveals. Anything already on screen shows at once, so nothing visible blinks.
const seenOnce = (els: HTMLElement[], cls: string, margin = "0px 0px -10% 0px") => {
  if (!("IntersectionObserver" in window)) { els.forEach((el) => el.classList.add(cls)); return; }
  // Reduced motion: things are already visible, so fade them the moment they reach the edge.
  if (reduce) margin = "0px";
  const vh = window.innerHeight;
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add(cls); io.unobserve(e.target); }
  }, { rootMargin: margin });
  for (const el of els) {
    const r = el.getBoundingClientRect();
    if (r.top < vh && r.bottom > 0) el.classList.add(cls);
    else io.observe(el);
  }
};
seenOnce($$(".rv"), "in");

// Counters: the HTML holds a real number (written in at deploy) or a fallback word.
type Stats = Record<string, unknown>;
const counters = $$("[data-stat]");
const targets = new Map<HTMLElement, number>();
for (const el of counters) {
  const n = Number((el.dataset.count ?? "").replace(/,/g, "") || el.textContent?.replace(/,/g, ""));
  if (el.dataset.count != null && Number.isFinite(n) && n >= 0 && /^[\d,]+$/.test((el.textContent ?? "").trim())) targets.set(el, n);
}
for (const el of $$("[data-count]")) {
  if (el.dataset.stat) continue;
  const n = Number(el.dataset.count);
  if (Number.isFinite(n) && n > 0) targets.set(el, n);
}
function countUp(el: HTMLElement, target: number) {
  const text = fmt(target);
  el.style.minWidth = `${text.length}ch`;
  el.style.display = el.style.display || "inline-block";
  if (reduce || target === 0) { el.textContent = text; return; }
  const t0 = performance.now();
  const step = (t: number) => {
    const p = Math.min(1, (t - t0) / 1600);
    el.textContent = fmt(target * (1 - Math.pow(1 - p, 4)));
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
const counted = new Set<HTMLElement>();
const visible = new Set<HTMLElement>();
const tryCount = (el: HTMLElement) => {
  const n = targets.get(el);
  if (n != null && visible.has(el) && !counted.has(el)) { counted.add(el); countUp(el, n); }
};
const cio = new IntersectionObserver((entries) => {
  for (const e of entries) if (e.isIntersecting) { visible.add(e.target as HTMLElement); tryCount(e.target as HTMLElement); cio.unobserve(e.target); }
}, { threshold: 0.6 });
targets.forEach((_, el) => cio.observe(el));

function setBars(s: Stats) {
  const bars = $$("[data-bar]");
  const vals = bars.map((b) => Number(s[b.dataset.bar ?? ""]));
  const max = Math.max(...vals.filter((v) => Number.isFinite(v)), 1);
  bars.forEach((b, i) => {
    const v = vals[i];
    if (Number.isFinite(v)) b.style.setProperty("--w", String(Math.max(0.004, Math.log10(v + 1) / Math.log10(max + 1))));
  });
}

fetch("/stats.json", { cache: "no-cache" })
  .then((r) => (r.ok ? r.json() : null))
  .then((st: Stats | null) => {
    if (!st) return;
    for (const el of counters) {
      const key = el.dataset.stat!;
      const n = st[key];
      if (typeof n !== "number" || n < 0) continue;
      targets.set(el, n);
      if (!counted.has(el)) {
        el.textContent = fmt(n);
        el.style.minWidth = `${fmt(n).length}ch`;
        if (el.dataset.count != null) { cio.observe(el); tryCount(el); }
      }
    }
    setBars(st);
  })
  .catch(() => undefined);

// Scroll-driven scenes. A scene gets 0 at the top of its pinned run and 1 at the end.
type Scene = (p: number) => void;
const scenes: [HTMLElement, Scene][] = [];
function scrub(el: HTMLElement | null, scene: Scene) {
  if (!el) return;
  if (reduce) { scene(1); return; }
  scenes.push([el, scene]);
}
let ticking = false;
const runScenes = () => {
  ticking = false;
  const vh = window.innerHeight;
  for (const [el, scene] of scenes) {
    const r = el.getBoundingClientRect();
    if (r.bottom < -vh || r.top > vh * 2) continue;
    const span = Math.max(1, r.height - vh);
    scene(clamp(-r.top / span));
  }
};
const queue = () => { if (!ticking) { ticking = true; requestAnimationFrame(runScenes); } };
window.addEventListener("scroll", queue, { passive: true });
window.addEventListener("resize", queue);

// Bot Battle: the trades tick in, the win rate climbs to 99%, and the balance collapses.
const bot = document.getElementById("bots");
const chart = document.getElementById("bot-chart");
const wr = document.getElementById("bot-wr");
const bal = document.getElementById("bot-bal");
const meter = bot?.querySelector<HTMLElement>(".meter");
if (bot && chart && wr && bal) {
  const trades = botTrades();
  const wins: number[] = [];
  trades.reduce((w, t, i) => (wins[i] = w + (t.win ? 1 : 0)), 0);
  const tape = bot.querySelector<SVGElement>(".bot-tape");
  let lastN = -1;
  scrub(bot, (p) => {
    const f = clamp((p - 0.06) / 0.86);
    const n = Math.round(f * TRADES);
    chart.style.setProperty("--f", String(Math.max(0.002, n / TRADES)));
    tape?.style.setProperty("clip-path", `inset(0 ${((1 - n / TRADES) * 100).toFixed(2)}% 0 0)`);
    meter?.style.setProperty("--p", String(p));
    if (n === lastN) return;
    lastN = n;
    if (n === 0) { wr.textContent = "0.0%"; bal.textContent = money(10_000); bal.classList.remove("hit"); return; }
    wr.textContent = `${((wins[n - 1] / n) * 100).toFixed(1)}%`;
    bal.textContent = money(trades[n - 1].balance);
    bal.classList.toggle("hit", !trades[n - 1].win || n === TRADES || trades[n - 1].balance < 10_000);
  });
}

// Verify: the file drops in, the five checks light one by one, then the verdict and the
// number of tries it survives.
const verify = document.getElementById("verify");
if (verify) {
  const checks = $$("#vchecks li", verify);
  const verdict = document.getElementById("vverdict");
  const vn = document.getElementById("v-n");
  const steps = $$("#vsteps li", verify);
  document.getElementById("vsteps")?.classList.add("live");
  scrub(verify, (p) => {
    const s = p < 0.06 ? 0 : p < 0.24 ? 1 : p < 0.74 ? 2 : 3;
    verify.dataset.s = String(s);
    steps.forEach((li, i) => li.classList.toggle("on", i === Math.max(0, s - 1)));
    checks.forEach((li, i) => li.classList.toggle("lit", p > 0.26 + i * 0.09));
    verdict?.classList.toggle("lit", p > 0.76);
    if (vn) vn.textContent = String(Math.round(6 * clamp((p - 0.78) / 0.14)));
  });
}
runScenes();

// The hero field, after the page has loaded, where it can run well. Reduced motion, data
// saving, no WebGL or a low-power device keep the still picture.
const hero = document.getElementById("top");
const box = document.getElementById("field-box");
const nav = navigator as Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number };
const lowPower = !!nav.connection?.saveData || (nav.hardwareConcurrency ?? 8) <= 2 || (nav.deviceMemory ?? 8) <= 2;
const idle = (f: () => void) => (window.requestIdleCallback ? window.requestIdleCallback(f, { timeout: 1500 }) : setTimeout(f, 120));
if (hero && box && !reduce && !lowPower) {
  const start = () => idle(() => { import("./field").then(({ startField }) => startField(hero, box)).catch(() => undefined); });
  if (document.readyState === "complete") start();
  else window.addEventListener("load", start, { once: true });
}
