// The installable site (DEC-0041): registers the service worker (public/sw.js) and offers
// to install Parity once, on the front page and inside the apps.
//
// Chrome and Edge fire `beforeinstallprompt`, so the card's button opens their own install
// dialog. Safari has no such event; on an iPhone or iPad the card says how to add Parity to
// the home screen instead. Nothing shows when Parity is already installed, inside the
// iOS or Android app, or after someone says "Not now" (for 30 days).
//
// The card is fixed to the corner of the screen, so it never moves the page (CLS).

interface InstallEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

const KEY = "parity.install.dismissed";
const QUIET_DAYS = 30;

export const isNativeApp = (): boolean =>
  !!(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.();

export const isInstalled = (): boolean =>
  !!window.matchMedia?.("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;

function dismissedRecently(): boolean {
  try {
    const at = Number(localStorage.getItem(KEY) ?? 0);
    return at > 0 && Date.now() - at < QUIET_DAYS * 864e5;
  } catch {
    return false;
  }
}

function remember() {
  try { localStorage.setItem(KEY, String(Date.now())); } catch { /* private mode */ }
}

/** iPhone or iPad Safari, which can install but never fires beforeinstallprompt. */
export function isIosSafari(ua: string = navigator.userAgent, touch = navigator.maxTouchPoints): boolean {
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && touch > 1);
  return ios && /Safari\//.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
}

const CSS = `
.pwa-card { position: fixed; z-index: 2147483000; right: max(16px, env(safe-area-inset-right)); bottom: max(16px, env(safe-area-inset-bottom));
  width: min(340px, calc(100vw - 32px)); box-sizing: border-box; padding: 14px 16px; border-radius: 14px;
  background: #101118; color: #f4f5f8; border: 1px solid rgb(255 255 255 / .12); box-shadow: 0 12px 40px rgb(0 0 0 / .5);
  font: 14px/1.5 Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  display: grid; grid-template-columns: 36px 1fr; gap: 4px 12px; animation: pwa-in .25s ease-out; }
.pwa-card img { width: 36px; height: 36px; border-radius: 8px; grid-row: span 2; }
.pwa-card strong { font-weight: 600; font-size: 15px; }
.pwa-card p { margin: 0; color: #a4a8b6; }
.pwa-card .pwa-row { grid-column: 2; display: flex; gap: 8px; margin-top: 8px; }
.pwa-card button { font: inherit; color: #f4f5f8; background: #151720; border: 1px solid rgb(255 255 255 / .12); border-radius: 8px; padding: 6px 12px; cursor: pointer; }
.pwa-card button.pwa-go { background: #1f78c8; border-color: #1f78c8; }
.pwa-card button:focus-visible { outline: 2px solid #5cc2f5; outline-offset: 2px; }
@keyframes pwa-in { from { opacity: 0; transform: translateY(8px); } }
@media (prefers-reduced-motion: reduce) { .pwa-card { animation: none; } }
`;

function make<K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}): HTMLElementTagNameMap[K] {
  return Object.assign(document.createElement(tag), props);
}

/** Shows the install card. Returns false when one is already showing. */
export function showCard(text: string, onInstall: (() => void) | null): boolean {
  if (document.querySelector(".pwa-card")) return false;
  document.head.appendChild(make("style", { textContent: CSS }));
  const el = make("aside", { className: "pwa-card" });
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-label", "Install Parity");
  const icon = make("img", { src: "/icon-192.png", alt: "", width: 36, height: 36 });
  const row = make("div", { className: "pwa-row" });
  el.append(icon, make("strong", { textContent: "Install Parity" }), make("p", { textContent: text }), row);
  if (onInstall) {
    row.appendChild(make("button", {
      type: "button", className: "pwa-go", textContent: "Install",
      onclick: () => { el.remove(); onInstall(); },
    }));
  }
  row.appendChild(make("button", {
    type: "button", textContent: onInstall ? "Not now" : "OK",
    onclick: () => { remember(); el.remove(); },
  }));
  document.body.appendChild(el);
  return true;
}

let started = false;

/** Call once per page. Does nothing in the native app, where there is nothing to install. */
export function startPwa({ offer = true }: { offer?: boolean } = {}) {
  if (started || typeof window === "undefined" || isNativeApp()) return;
  started = true;
  if (import.meta.env.PROD && "serviceWorker" in navigator) {
    const register = () => { navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {}); };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }
  if (!offer || isInstalled() || dismissedRecently()) return;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    const ev = e as InstallEvent;
    showCard("Open Parity in its own window. Pages you have opened still load without a connection.", () => {
      void ev.prompt();
      void ev.userChoice.then((c) => { if (c.outcome !== "accepted") remember(); });
    });
  });
  window.addEventListener("appinstalled", () => { remember(); document.querySelector(".pwa-card")?.remove(); });
  if (isIosSafari()) {
    window.setTimeout(() => showCard("Tap the Share button, then Add to Home Screen.", null), 4000);
  }
}
