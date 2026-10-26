// Runs on every page (plugins/analytics.ts adds it to every HTML file, so a new page is
// covered with no work). Small on purpose: it reads the cookie choice and loads the tracker
// only when analytics is switched on. Switching it off stops the tracker and deletes the
// random ids it kept in this browser (DEC-0053).
import { allowed, onConsentChange } from "../../legal/consent";
import { isDesktop } from "../../desktop/bridge";
import type { AnalyticsGlobal } from "./index";
import { appOf } from "./route";

export const ID_KEYS = ["parity.a.vid", "parity.a.sid"];

function forgetIds() {
  try { for (const k of ID_KEYS) window.localStorage.removeItem(k); } catch { /* storage blocked */ }
}

function boot() {
  const g: AnalyticsGlobal = (window.__parityAnalytics ??= { booted: false, on: false, app: null, q: [] });
  if (g.booted) return;
  g.booted = true;
  const app = appOf(window.location.pathname, document.documentElement.dataset.space);
  g.app = app;
  if (!app) return;
  let stop: (() => void) | null = null;
  let loading = false;

  const start = async () => {
    if (stop || loading) return;
    loading = true;
    g.on = true;
    try {
      const { startTracker } = await import("./tracker");
      if (allowed("analytics")) stop = startTracker(app, { desktop: isDesktop() });
      else g.on = false;
    } catch {
      g.on = false; // a failed chunk load must never break the page
    } finally {
      loading = false;
    }
  };

  const sync = () => {
    if (allowed("analytics")) { void start(); return; }
    g.on = false;
    g.q.length = 0;
    stop?.();
    stop = null;
    forgetIds();
  };
  sync();
  onConsentChange(sync);
}

if (typeof window !== "undefined" && typeof document !== "undefined") boot();
