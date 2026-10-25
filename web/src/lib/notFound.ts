// What happens at an address that does not exist (DEC-0055). Pure functions, no DOM, so
// the Cloudflare middleware, the dev server plugin and the apps share one set of rules.
//
//   Public paths      Cloudflare Pages serves dist/404.html with status 404 for any path
//                     that is not a file, a page or a function (web/404.html).
//   App paths         /app/<x>, /research/<x>, /sim/<x>, /trade/<x>, /academy/<x> and
//                     /lab/<x> with no file behind them: the apps route by the hash, so a
//                     signed-in visitor goes to /<app>/#/<x>. A real page opens; anything
//                     else shows that app's own "not found" view. Files (a name with a dot,
//                     anything under assets/) keep their 404.
//   Hash routes       each app shows src/components/NotFound.tsx for a hash it does not know.

/** The signed-in apps, each served from its own folder. */
export const APP_DIRS = ["app", "research", "sim", "trade", "academy", "lab"] as const;

/**
 * Paths served by Pages Functions (functions/) or by the dev server's own plugins. The dev
 * server leaves these alone, as production does.
 */
export const FUNCTION_PATHS = /^\/(v|s|badge|og|live|data|api|desktop|local|\.well-known)(\/|$)|^\/(mcp|rum|stats\.json)$/;

/**
 * Where a missing path under an app folder should go: /<app>/#/<rest>, keeping the query.
 * Null for anything that is not an app page (a file, an asset, a path outside the apps).
 */
export function appHashRedirect(pathname: string, search = ""): string | null {
  const m = pathname.match(/^\/([a-z]+)\/(.+)$/);
  if (!m || !(APP_DIRS as readonly string[]).includes(m[1])) return null;
  const rest = m[2].replace(/\/+$/, "");
  if (!rest || rest.startsWith("assets/") || /\.[A-Za-z0-9]+$/.test(rest.split("/").pop() ?? "")) return null;
  if (!/^[A-Za-z0-9/_~%.-]+$/.test(rest) || rest.includes("//") || rest.split("/").includes("..")) return null;
  const q = search && search !== "?" ? `?${search.replace(/^\?/, "")}` : "";
  return `/${m[1]}/#/${rest}${q}`;
}

export type DevAction = { kind: "pass" } | { kind: "redirect"; to: string } | { kind: "notfound" };

/**
 * What the dev server should do with a page request, so it answers like Cloudflare Pages.
 * `exists(p)` says whether a file exists at web/p or web/public/p (p has no leading slash).
 * Only page requests come here: the plugin skips Vite's own module and asset requests.
 */
export function devPathAction(pathname: string, search: string, exists: (p: string) => boolean): DevAction {
  if (pathname === "/" || FUNCTION_PATHS.test(pathname)) return { kind: "pass" };
  const rel = pathname.replace(/^\/+/, "");
  if (exists(rel)) return { kind: "pass" };
  // A folder with an index page: /login/ and /login both open it (Pages adds the slash).
  const dir = rel.replace(/\/+$/, "");
  if (exists(`${dir}/index.html`)) return { kind: "pass" };
  const to = appHashRedirect(pathname, search);
  return to ? { kind: "redirect", to } : { kind: "notfound" };
}

/** The first part of a hash route: "#/strategy/x?q=1" is "strategy", "#/" and "#main" are "". */
export function hashRoute(hash: string): string {
  return hash.split("?")[0].split("/")[1] ?? "";
}
