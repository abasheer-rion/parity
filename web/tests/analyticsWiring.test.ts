// Every page and every route is wired to analytics (DEC-0053). Fails when:
//   - a new HTML page appears that analytics cannot name (add it to appOf in
//     src/lib/analytics/route.ts), or that opts out of the boot script
//   - a route of any app would be recorded as ":id" instead of its own name
//   - the Vite plugin stops adding the boot script
// The smoke test (scripts/smoke.mjs) also checks that the boot script ran on every route,
// and scripts/analytics-check.mjs checks every built HTML file after `npm run build`.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ANALYTICS_MARKER, parityAnalytics } from "../plugins/analytics";
import { APP_ROOTS, appOf, routeOf } from "../src/lib/analytics/route";
import type { App } from "../src/lib/analytics/schema";

const WEB = resolve(import.meta.dirname, "..");
const SKIP = new Set(["node_modules", "dist", "public", "tests", "live", "functions", "plugins", "scripts", "src"]);

function htmlPages(dir = WEB): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (!SKIP.has(name)) out.push(...htmlPages(p));
    } else if (name === "index.html") {
      out.push(relative(WEB, p));
    }
  }
  return out;
}

const read = (p: string) => readFileSync(join(WEB, p), "utf8");
const ids = (file: string) => [...read(file).matchAll(/\{ id: "([a-z]+)", label:/g)].map((m) => m[1]);

describe("analytics wiring", () => {
  const pages = htmlPages();

  it("finds the pages", () => {
    expect(pages.length).toBeGreaterThanOrEqual(20);
  });

  it.each(pages)("%s has a known app and no opt-out", (file) => {
    const html = read(file);
    const space = html.match(/<html[^>]*data-space="([a-z]+)"/)?.[1];
    const path = `/${file.replace(/index\.html$/, "")}`;
    expect(appOf(path, space), `add ${path} to appOf() in src/lib/analytics/route.ts`).not.toBeNull();
    expect(html).not.toContain(ANALYTICS_MARKER); // the plugin adds it; a page must not fake it
  });

  it("the plugin adds the boot script to any page", () => {
    const plugin = parityAnalytics();
    const hook = plugin.transformIndexHtml as { handler: (html: string) => string };
    const out = hook.handler("<html><head><title>x</title></head><body></body></html>");
    expect(out).toContain(ANALYTICS_MARKER);
    expect(out).toContain('src="/src/lib/analytics/boot.ts"');
    expect(hook.handler(out)).toBe(out);
  });

  const routes: [App, string][] = [];
  const space = read("src/lib/space.ts");
  const block = space.match(/export const ROUTES[^=]*=\s*\{([\s\S]*?)\};/)?.[1] ?? "";
  for (const m of block.matchAll(/(both|product|research):\s*\[([^\]]*)\]/g)) {
    for (const r of m[2].matchAll(/"([a-z]*)"/g)) {
      if (!r[1]) continue;
      if (m[1] !== "research") routes.push(["product", r[1]]);
      if (m[1] !== "product") routes.push(["research", r[1]]);
    }
  }
  for (const v of ids("src/trade/state.ts")) routes.push(["trade", v]);
  for (const v of ids("src/lab/state.ts")) routes.push(["lab", v]);
  for (const v of ids("src/terminal/layout.ts")) routes.push(["sim", v]);
  for (const v of ["progress", "settings"]) routes.push(["academy", v]);

  it("finds the routes", () => {
    expect(routes.length).toBeGreaterThan(40);
  });

  it.each(routes)("%s route %s is recorded by its name", (app, route) => {
    const root = APP_ROOTS[app]!;
    expect(routeOf(app, root, `#/${route}/abc_123?q=secret`)).toBe(`${root}#/${route}/:id`);
    expect(routeOf(app, root, `#/${route}`)).toBe(`${root}#/${route}`);
  });
});
