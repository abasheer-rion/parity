// "New version, reload" (DEC-0086). The desktop app and the installed site load the live
// site and keep pages open for days, so a page asks /version.json every few minutes and
// when it comes back into focus. When a newer deploy is live it shows a small card:
// "A new version of Parity is ready" with Reload. Reload keeps the page and its address
// (path and hash) and puts back what was typed into the page's fields, then the scroll.
// Nothing reloads by itself, so nobody loses what they were doing.
//
// Plain DOM, so every app and the front page can use it. No-op in the dev server.
import { isDesktop } from "../desktop/bridge";

declare const __PARITY_BUILD__: string;

export const BUILD: string = typeof __PARITY_BUILD__ === "string" ? __PARITY_BUILD__ : "dev";
const EVERY_MS = 5 * 60 * 1000;
/** Focus checks at most this often. */
const FOCUS_GAP_MS = 60 * 1000;
const STATE_KEY = "parity.reload.state";
const SKIP_KEY = "parity.reload.skip";

/** Is the build in /version.json a different deploy from the one this page runs? */
export function isNewer(live: unknown, own: string = BUILD): boolean {
  if (!live || typeof live !== "object") return false;
  const b = (live as { build?: unknown }).build;
  return typeof b === "string" && /^[A-Za-z0-9._-]{1,64}$/.test(b) && b !== own && own !== "dev" && b !== "dev";
}

interface Field { key: string; value?: string; checked?: boolean }
interface Saved { at: number; url: string; scroll: number; fields: Field[] }

/** A stable name for a field: its id, else its name and place among fields of that name. */
function keyOf(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, seen: Map<string, number>): string | null {
  if (el.id) return `#${el.id}`;
  if (!el.name) return null;
  const n = seen.get(el.name) ?? 0;
  seen.set(el.name, n + 1);
  return `${el.name}@${n}`;
}

const SKIP_TYPES = new Set(["password", "hidden", "file", "submit", "button", "reset", "image"]);

/** What was typed into the page's fields, never passwords or one-time codes. */
export function captureFields(root: ParentNode = document): Field[] {
  const out: Field[] = [];
  const seen = new Map<string, number>();
  for (const el of Array.from(root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("input, textarea, select"))) {
    if (el instanceof HTMLInputElement && (SKIP_TYPES.has(el.type) || el.autocomplete === "one-time-code")) continue;
    if (el.closest("[data-no-restore]")) continue;
    const key = keyOf(el, seen);
    if (!key) continue;
    if (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio")) out.push({ key, checked: el.checked });
    else if (el.value) out.push({ key, value: el.value.slice(0, 20000) });
  }
  return out;
}

/** Puts values back so React and other frameworks see them (the native setter, then an input event). */
export function restoreFields(fields: Field[], root: ParentNode = document): number {
  const seen = new Map<string, number>();
  const byKey = new Map<string, HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>();
  for (const el of Array.from(root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("input, textarea, select"))) {
    const k = keyOf(el, seen);
    if (k) byKey.set(k, el);
  }
  let n = 0;
  for (const f of fields) {
    const el = byKey.get(f.key);
    if (!el) continue;
    if (f.checked != null && el instanceof HTMLInputElement) {
      if (el.checked !== f.checked) { el.click(); n++; }
      continue;
    }
    if (f.value == null || el.value === f.value) continue;
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, f.value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    n++;
  }
  return n;
}

/** Saves the page's fields and scroll, then reloads in place. */
export function reloadInPlace() {
  try {
    const saved: Saved = { at: Date.now(), url: location.pathname + location.search + location.hash, scroll: window.scrollY, fields: captureFields() };
    sessionStorage.setItem(STATE_KEY, JSON.stringify(saved));
  } catch { /* storage blocked: reload anyway */ }
  location.reload();
}

/** After a reload: put the fields back once the app has drawn them (it may take a moment). */
function restoreAfterReload() {
  let saved: Saved | null = null;
  try {
    const raw = sessionStorage.getItem(STATE_KEY);
    sessionStorage.removeItem(STATE_KEY);
    saved = raw ? (JSON.parse(raw) as Saved) : null;
  } catch { return; }
  if (!saved || Date.now() - saved.at > 60000 || saved.url !== location.pathname + location.search + location.hash) return;
  const s = saved;
  let left = s.fields.slice();
  for (const ms of [300, 1000, 2500, 5000]) {
    window.setTimeout(() => {
      if (left.length) {
        restoreFields(left);
        left = left.filter((f) => !document.querySelector(f.key.startsWith("#") ? `[id="${CSS.escape(f.key.slice(1))}"]` : `[name="${CSS.escape(f.key.split("@")[0])}"]`));
      }
      if (ms <= 1000 && s.scroll > 0) window.scrollTo(0, s.scroll);
    }, ms);
  }
}

const CSS_TEXT = `
.pv-card { position: fixed; z-index: var(--z-top); left: 50%; bottom: max(16px, env(safe-area-inset-bottom)); transform: translateX(-50%);
  display: flex; align-items: center; gap: 12px; max-width: calc(100vw - 32px); box-sizing: border-box; padding: 10px 10px 10px 16px;
  border-radius: var(--radius-pill); background: var(--color-surface-raised); color: var(--color-text);
  border: 1px solid var(--color-fill-strong); box-shadow: var(--shadow-3); font: var(--type-md)/1.4 var(--font-text);
  animation: pv-in var(--dur-3) var(--ease-out); }
.pv-card p { margin: 0; }
.pv-card button { font: inherit; font-size: var(--type-sm); color: var(--color-text); background: var(--color-fill); border: 1px solid var(--color-fill-strong);
  border-radius: var(--radius-pill); padding: 6px 14px; min-height: 32px; cursor: pointer; white-space: nowrap; }
.pv-card button.pv-go { background: var(--color-primary); border-color: var(--color-primary); color: var(--color-on-primary); }
.pv-card button:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 2px; }
@keyframes pv-in { from { opacity: 0; } }
@media (prefers-reduced-motion: reduce) { :root:not([data-motion="full"]) .pv-card { animation: none; } }
:root[data-motion="reduced"] .pv-card { animation: none; }
`;

/** Shows the card once per new build. Returns false when it is already showing. */
export function showReloadCard(build: string): boolean {
  if (document.querySelector(".pv-card")) return false;
  if (!document.getElementById("pv-style")) document.head.appendChild(Object.assign(document.createElement("style"), { id: "pv-style", textContent: CSS_TEXT }));
  const card = document.createElement("aside");
  card.className = "pv-card";
  card.setAttribute("role", "status");
  card.setAttribute("aria-label", "New version");
  const text = Object.assign(document.createElement("p"), { textContent: "A new version of Parity is ready." });
  const go = Object.assign(document.createElement("button"), { type: "button", className: "pv-go", textContent: "Reload" });
  go.addEventListener("click", reloadInPlace);
  const later = Object.assign(document.createElement("button"), { type: "button", textContent: "Later" });
  later.addEventListener("click", () => {
    try { sessionStorage.setItem(SKIP_KEY, build); } catch { /* fine */ }
    card.remove();
  });
  card.append(text, go, later);
  document.body.appendChild(card);
  return true;
}

let started = false;

/** Starts the checks: in the desktop app and the installed site, and when asked (`force`). */
export function startUpdateCheck({ force = false, fetcher = fetch }: { force?: boolean; fetcher?: typeof fetch } = {}) {
  if (started || typeof window === "undefined") return;
  restoreAfterReload();
  const installed = !!window.matchMedia?.("(display-mode: standalone)").matches;
  if (BUILD === "dev" || !(force || isDesktop() || installed)) return;
  started = true;
  let last = 0;
  const check = async () => {
    if (document.hidden || !navigator.onLine) return;
    last = Date.now();
    try {
      const res = await fetcher(`/version.json?t=${Date.now()}`, { cache: "no-store", credentials: "omit" });
      if (!res.ok) return;
      const live = await res.json();
      if (!isNewer(live)) return;
      let skipped = "";
      try { skipped = sessionStorage.getItem(SKIP_KEY) ?? ""; } catch { /* fine */ }
      if (skipped !== live.build) showReloadCard(live.build);
    } catch { /* offline or the saved copy: try again later */ }
  };
  window.setInterval(check, EVERY_MS);
  const soon = () => { if (Date.now() - last > FOCUS_GAP_MS) void check(); };
  window.addEventListener("focus", soon);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) soon(); });
  window.setTimeout(check, 20000);
}
