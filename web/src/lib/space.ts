// Which side of Parity this page is (DEC-0015). The product app lives at /app/ and the
// research app at /research/; both load the same code, and each HTML file says which
// side it is with <html data-space="...">.
import { ORIGIN, SIM_ORIGIN, SITE_DOMAIN, TRADE_ORIGIN } from "./meta";

export type Space = "product" | "research";

export const SPACE: Space = document.documentElement.dataset.space === "research" ? "research" : "product";

export const SPACE_LABEL: Record<Space, string> = { product: "Product", research: "Research" };

/** Routes that belong to each side. A route from the other side redirects there. */
export const ROUTES: Record<Space | "both", string[]> = {
  both: ["start", "how", "learn", "settings", "ui"],
  product: ["", "home", "strategies", "strategy", "watchlist", "compare", "lab", "scenarios", "news", "markets", "trade", "academy", "verify"],
  research: ["", "home", "docs", "doc", "refs", "search", "ledger", "catalog", "algo", "sim", "signals", "explore", "data", "sources", "edges", "private"],
};

/** Where a route lives, or null if it is on this side (or both). */
export function otherSide(route: string): Space | null {
  if (ROUTES.both.includes(route) || ROUTES[SPACE].includes(route)) return null;
  const other: Space = SPACE === "product" ? "research" : "product";
  return ROUTES[other].includes(route) ? other : null;
}

export const SPACE_ROOT: Record<Space, string> = { product: "/app/", research: "/research/" };

// ---------- Sim World, its own full-screen site (DEC-0020) ----------
// sim.endyland.com serves web/sim/index.html, marked <html data-space="sim">. It shows only
// Sim World and one Back button; it still signs in and loads data like the other sides.

/** True on the full-screen Sim World site. */
export const IS_SIM = document.documentElement.dataset.space === "sim";

// The addresses come from src/lib/site.json (DEC-0038), so a new domain is one edit there.
const onSiteDomain = () => window.location.hostname === SITE_DOMAIN || window.location.hostname.endsWith(`.${SITE_DOMAIN}`);

/** Where Sim World opens: its own subdomain on the site's domain, /sim/ elsewhere (previews, localhost). */
export function simUrl(tab?: string): string {
  const hash = tab ? `#/${tab.replace(/^#?\/?/, "")}` : "";
  return onSiteDomain() ? `${SIM_ORIGIN}/${hash}` : `/sim/${hash}`;
}

/** A research page by its hash, from anywhere (Sim World links back to docs and strategies). */
export function researchUrl(hash = ""): string {
  return onSiteDomain() ? `${ORIGIN}/research/${hash}` : `/research/${hash}`;
}

// ---------- Parity Trade, its own full-screen app (DEC-0039) ----------
// /trade/ serves web/trade/index.html, marked <html data-space="trade">: a trading workspace
// with its own rail, settings and keys. It signs in like the other sides.

/** True on the full-screen Parity Trade app. */
export const IS_TRADE = document.documentElement.dataset.space === "trade";

/** trade.<domain> is live (owner approved trade.endyland.com, 2026-10-24). Set false to fall back to /trade/. */
export const TRADE_SUBDOMAIN = true;

/** Where Parity Trade opens: its own subdomain on the site's domain, /trade/ elsewhere (previews, localhost). */
export function tradeUrl(hash = ""): string {
  const h = hash ? `#/${hash.replace(/^#?\/?/, "")}` : "";
  return TRADE_SUBDOMAIN && onSiteDomain() ? `${TRADE_ORIGIN}/${h}` : `/trade/${h}`;
}

/** A product app page by its hash, from anywhere (Parity Trade's Back button). */
export function productUrl(hash = ""): string {
  return onSiteDomain() ? `${ORIGIN}/app/${hash}` : `/app/${hash}`;
}

/** Where an old #/trade link of the product app now lives inside Parity Trade. */
export function tradeHashFor(oldHash: string): string {
  const [path, query = ""] = oldHash.replace(/^#/, "").split("?");
  const view = path.split("/")[2] ?? "";
  const map: Record<string, string> = { "": "chart", watchlists: "watchlists", screener: "screener", demo: "portfolio" };
  const q = new URLSearchParams(query);
  const keep = new URLSearchParams();
  for (const k of ["s", "tf"]) { const v = q.get(k); if (v) keep.set(k, v); }
  const rest = keep.toString();
  return `${map[view] ?? "chart"}${rest ? `?${rest}` : ""}`;
}
