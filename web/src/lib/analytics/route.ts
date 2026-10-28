// Which app and which page an address is, as analytics records it (DEC-0053). A page is a
// pattern, not an address: ids, names and anything a person typed become ":id" or are
// dropped, and query strings are never kept. No browser globals.
import type { App } from "./schema";

/** The app roots: the hash routes of each app hang off these. */
export const APP_ROOTS: Partial<Record<App, string>> = {
  product: "/app/", research: "/research/", sim: "/sim/", trade: "/trade/", academy: "/academy/", lab: "/lab/",
};

const SPACES = new Set(["product", "research", "sim", "trade", "academy", "lab"]);

/**
 * The app for a page: the signed-in apps say which they are with <html data-space>, the
 * public pages are known by their path. Returns null for a page analytics does not know,
 * which the wiring test (tests/analyticsWiring.test.ts) turns into a failure.
 */
export function appOf(pathname: string, space?: string | null): App | null {
  if (space && SPACES.has(space)) return space as App;
  const p = pathname.toLowerCase();
  if (p === "/" || p === "/index.html" || /^\/(learn|ideas|notes|download)(\/|$)/.test(p)) return "site";
  if (/^\/(login|signup|reset|verify)(\/|$)/.test(p)) return "auth";
  if (/^\/legal(\/|$)/.test(p)) return "legal";
  // The API guide sits with Connect your AI: both are about other programs reaching Parity.
  if (/^\/(connect|oauth|developers)(\/|$)/.test(p)) return "connect";
  if (/^\/v(\/|$)/.test(p)) return "badge";
  for (const [app, root] of Object.entries(APP_ROOTS)) if (p.startsWith(root!)) return app as App;
  return null;
}

/** A path segment worth keeping as written: short, lowercase words only. */
const WORD = /^[a-z][a-z-]{0,31}$/;
/** The first segment of a hash route may also hold digits (a route id such as "news2"). */
const FIRST = /^[a-z][a-z0-9-]{0,31}$/;

function segments(path: string, first: RegExp): string[] {
  const parts = path.split("/").filter(Boolean).slice(0, 3);
  return parts.map((seg, i) => {
    let s = seg;
    try { s = decodeURIComponent(seg); } catch { /* keep as is */ }
    return (i === 0 ? first : WORD).test(s) ? s : ":id";
  });
}

/**
 * The page pattern for an address. Signed-in apps: the app root plus the hash route, as
 * "/app/#/strategy/:id". Public pages: the path, as "/legal/privacy/" or "/v/:id".
 */
export function routeOf(app: App, pathname: string, hash: string): string {
  const root = APP_ROOTS[app];
  const h = hash.replace(/^#/, "").split("?")[0];
  const hashPart = h.startsWith("/") || root ? `#/${segments(h, FIRST).join("/")}` : "";
  if (root) return `${root}${hashPart}`.slice(0, 120);
  const p = pathname.replace(/\/index\.html$/, "/");
  const path = `/${segments(p, WORD).join("/")}`;
  const withSlash = path === "/" || p.endsWith("/") ? `${path.replace(/\/$/, "")}/` : path;
  return `${withSlash}${hashPart && hashPart !== "#/" ? hashPart : ""}`.slice(0, 120);
}

/** The referring site's host, or "" when it is one of ours or there is none. */
export function referrerHost(referrer: string, siteDomain: string): string {
  if (!referrer) return "";
  try {
    const host = new URL(referrer).hostname.toLowerCase();
    if (host === siteDomain || host.endsWith(`.${siteDomain}`) || host === "localhost" || host.endsWith(".pages.dev")) return "";
    return /^[a-z0-9.-]{1,80}$/.test(host) ? host : "";
  } catch {
    return "";
  }
}

/** A coarse screen class from the window width. Never the exact size. */
export function deviceOf(width: number): "phone" | "tablet" | "desktop" {
  return width < 640 ? "phone" : width < 1024 ? "tablet" : "desktop";
}
