// Which side of Parity this page is (DEC-0015). The product app lives at /app/ and the
// research app at /research/; both load the same code, and each HTML file says which
// side it is with <html data-space="...">.
import { ACADEMY_ORIGIN, LAB_ORIGIN, ORIGIN, SIM_ORIGIN, SITE_DOMAIN, TRADE_ORIGIN } from "./meta";

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

// ---------- Parity Trade, its own full-screen app (DEC-0040) ----------
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

// ---------- Parity Academy, its own full-screen course player (DEC-0042) ----------
// /academy/ serves web/academy/index.html, marked <html data-space="academy">: the course
// library, a lesson player and progress saved to the account. It signs in like the other sides.

/** True on the full-screen Parity Academy app. */
export const IS_ACADEMY = document.documentElement.dataset.space === "academy";

/** academy.<domain> is live (owner approved and set up academy.endyland.com, 2026-10-24). Set false to fall back to /academy/. */
export const ACADEMY_SUBDOMAIN = true;

/** Where Parity Academy opens: its own subdomain on the site's domain, /academy/ elsewhere (previews, localhost). */
export function academyUrl(hash = ""): string {
  const h = hash ? `#/${hash.replace(/^#?\/?/, "")}` : "";
  return ACADEMY_SUBDOMAIN && onSiteDomain() ? `${ACADEMY_ORIGIN}/${h}` : `/academy/${h}`;
}

/** Where an old #/academy link of the product app now lives inside Parity Academy: #/academy/<course>/<lesson> becomes <course>/<lesson>. */
export function academyHashFor(oldHash: string): string {
  const path = oldHash.replace(/^#/, "").split("?")[0];
  const parts = path.split("/").filter(Boolean);
  if (parts[0] !== "academy") return "";
  return parts.slice(1, 3).filter((p) => /^[a-z0-9][a-z0-9-]*$/.test(p)).join("/");
}

/**
 * A page of any Parity app, from one of the full-screen apps: product and research pages
 * by their hash, and the routes that moved to their own app (Trade, Terminal, Academy,
 * Workbench) straight to that app.
 */
export function appLink(space: Space | "both", hash: string): string {
  const route = hash.replace(/^#\/?/, "").split(/[/?]/)[0];
  if (route === "trade") return tradeUrl(tradeHashFor(hash));
  if (route === "sim") return simUrl(hash.replace(/^#\/?/, "").split(/[/?]/)[1]);
  if (route === "academy") return academyUrl(academyHashFor(hash));
  if (LAB_ROUTES.includes(route)) return labUrl(labHashFor(hash));
  return space === "research" ? researchUrl(hash) : productUrl(hash);
}

// ---------- Parity Workbench, its own full-screen strategy workbench (DEC-0043) ----------
// /lab/ serves web/lab/index.html, marked <html data-space="lab">: Try settings, What if,
// Compare, Strategy search and the Edge Lab in one tool. Research numbers are shown read
// only; nothing done here is written to the research side (DEC-0015).

/** True on the full-screen Parity Workbench app. */
export const IS_LAB = document.documentElement.dataset.space === "lab";

/** lab.<domain> is live (owner approved and set up lab.endyland.com, 2026-10-24). Set false to fall back to /lab/. */
export const LAB_SUBDOMAIN = true;

/** Where Parity Workbench opens: its own subdomain on the site's domain, /lab/ elsewhere (previews, localhost). */
export function labUrl(hash = ""): string {
  const h = hash ? `#/${hash.replace(/^#?\/?/, "")}` : "";
  return LAB_SUBDOMAIN && onSiteDomain() ? `${LAB_ORIGIN}/${h}` : `/lab/${h}`;
}

/** The product and research routes that now live in Parity Workbench, and the view each opens. */
export const LAB_VIEWS: Record<string, string> = { lab: "try", scenarios: "whatif", compare: "compare", search: "search", edges: "edges" };
export const LAB_ROUTES = Object.keys(LAB_VIEWS);

/**
 * Where an old product or research link now lives inside Parity Workbench: #/lab opens Try
 * settings, #/scenarios?... What if with the same scenario, #/compare Compare, #/search?...
 * the search with the same filters and #/edges/<lesson> that Edge Lab lesson.
 */
export function labHashFor(oldHash: string): string {
  const [path, query = ""] = oldHash.replace(/^#/, "").split("?");
  const parts = path.split("/").filter(Boolean);
  const view = LAB_VIEWS[parts[0] ?? ""];
  if (!view) return "";
  const lesson = view === "edges" && parts[1] && /^[a-z0-9-]+$/.test(parts[1]) ? `/${parts[1]}` : "";
  const keep = view === "whatif" || view === "search" ? query : "";
  return `${view}${lesson}${keep ? `?${keep}` : ""}`;
}
