// Which side of Parity this page is (DEC-0015). The product app lives at /app/ and the
// research app at /research/; both load the same code, and each HTML file says which
// side it is with <html data-space="...">.
export type Space = "product" | "research";

export const SPACE: Space = document.documentElement.dataset.space === "research" ? "research" : "product";

export const SPACE_LABEL: Record<Space, string> = { product: "Product", research: "Research" };

/** Routes that belong to each side. A route from the other side redirects there. */
export const ROUTES: Record<Space | "both", string[]> = {
  both: ["start", "how", "learn", "settings", "ui"],
  product: ["", "home", "strategies", "strategy", "watchlist", "compare", "lab", "scenarios", "news", "markets", "academy"],
  research: ["", "home", "docs", "doc", "refs", "search", "ledger", "catalog", "algo", "sim", "signals", "explore", "data", "sources", "edges"],
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

const onEndyland = () => /(^|\.)endyland\.com$/.test(window.location.hostname);

/** Where Sim World opens: its own subdomain on endyland.com, /sim/ elsewhere (previews, localhost). */
export function simUrl(tab?: string): string {
  const hash = tab ? `#/${tab.replace(/^#?\/?/, "")}` : "";
  return onEndyland() ? `https://sim.endyland.com/${hash}` : `/sim/${hash}`;
}

/** A research page by its hash, from anywhere (Sim World links back to docs and strategies). */
export function researchUrl(hash = ""): string {
  return onEndyland() ? `https://parity.endyland.com/research/${hash}` : `/research/${hash}`;
}
