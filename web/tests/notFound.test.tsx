// Addresses that do not exist (DEC-0055): which paths get the 404 page, which app paths
// open the app at a hash, which hash routes each app does not know, the shared "not found"
// view, the 404 page itself, and the Verify badge function's 404. No network.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { onRequestGet as badgePage } from "../functions/v/[id]";
import { devFileExists } from "../plugins/notFound";
import { NotFound } from "../src/components/NotFound";
import { PAGES, PRIVATE } from "../src/lib/meta";
import { appHashRedirect, devPathAction, FUNCTION_PATHS, hashRoute } from "../src/lib/notFound";
import { unknownRoute } from "../src/lib/space";
import type { PublicBadge } from "../src/lib/verify/badge";

const web = (p: string) => resolve(import.meta.dirname, "..", p);

describe("a missing path under an app folder", () => {
  it("opens that app at the same hash route, keeping the query", () => {
    expect(appHashRedirect("/app/strategies")).toBe("/app/#/strategies");
    expect(appHashRedirect("/app/no-such-page/", "")).toBe("/app/#/no-such-page");
    expect(appHashRedirect("/research/doc/DEC-0001", "?x=1")).toBe("/research/#/doc/DEC-0001?x=1");
    for (const app of ["sim", "trade", "academy", "lab"]) expect(appHashRedirect(`/${app}/junk`)).toBe(`/${app}/#/junk`);
  });

  it("leaves files, assets and other folders alone", () => {
    expect(appHashRedirect("/app/")).toBeNull();
    expect(appHashRedirect("/app/assets/index-abc.js")).toBeNull();
    expect(appHashRedirect("/app/missing.png")).toBeNull();
    expect(appHashRedirect("/sim/manifest.webmanifest")).toBeNull();
    expect(appHashRedirect("/no-such-page/")).toBeNull();
    expect(appHashRedirect("/data/latest")).toBeNull();
    expect(appHashRedirect("/apps/x")).toBeNull();
    expect(appHashRedirect("/app/a//b")).toBeNull();
    expect(appHashRedirect("/app/a/../b")).toBeNull();
    expect(appHashRedirect("/app/<script>")).toBeNull();
  });
});

describe("the dev server answers like Cloudflare Pages", () => {
  const files = new Set(["index.html", "login/index.html", "legal/privacy/index.html", "app/index.html", "favicon.svg", "brand/2026-10-21-starburst/parity-mark.svg"]);
  const exists = (p: string) => files.has(p);

  it("serves real pages, files and functions as they are", () => {
    for (const p of ["/", "/login/", "/login", "/legal/privacy/", "/app/", "/favicon.svg", "/brand/2026-10-21-starburst/parity-mark.svg"]) {
      expect(devPathAction(p, "", exists), p).toEqual({ kind: "pass" });
    }
    for (const p of ["/v/AbCdEf123456", "/s/fx_carry", "/og/badge/x.png", "/badge/x.svg", "/local/latest.json", "/live/status", "/mcp", "/e", "/stats.json", "/.well-known/oauth-authorization-server"]) {
      expect(devPathAction(p, "", exists), p).toEqual({ kind: "pass" });
      expect(FUNCTION_PATHS.test(p), p).toBe(true);
    }
  });

  it("gives an unknown path the 404 page", () => {
    for (const p of ["/no-such-page-xyz/", "/no-such-page-xyz", "/legal/nope/", "/logins/", "/missing.png"]) {
      expect(devPathAction(p, "", exists), p).toEqual({ kind: "notfound" });
    }
  });

  it("sends a missing app path to the app's hash route", () => {
    expect(devPathAction("/app/nope", "?a=1", exists)).toEqual({ kind: "redirect", to: "/app/#/nope?a=1" });
  });

  it("finds files in web/ and web/public/ only", () => {
    expect(devFileExists("404.html")).toBe(true);
    expect(devFileExists("favicon.svg")).toBe(true);
    expect(devFileExists("login/index.html")).toBe(true);
    expect(devFileExists("no-such-file.html")).toBe(false);
    expect(devFileExists("login")).toBe(false);
    expect(devFileExists("../package.json")).toBe(false);
    expect(devFileExists("%2e%2e/package.json")).toBe(false);
  });
});

describe("hash routes the product and research apps do not know", () => {
  it("reads the route from the hash", () => {
    expect(hashRoute("#/strategy/fx_carry?q=1")).toBe("strategy");
    expect(hashRoute("#/")).toBe("");
    expect(hashRoute("#main")).toBe("");
    expect(hashRoute("")).toBe("");
  });

  it("knows every page of both sides", () => {
    for (const r of ["", "home", "strategies", "strategy", "news", "docs", "search", "ledger", "settings", "overview", "trade", "academy", "lab"]) {
      expect(unknownRoute(r, undefined, false), r).toBe(false);
    }
    expect(unknownRoute("doc", "DEC-0001", false)).toBe(false);
    expect(unknownRoute("pricing", undefined, true)).toBe(false);
  });

  it("does not know a made-up route, pricing with payments off, or a doc without its id", () => {
    expect(unknownRoute("no-such-page-xyz", undefined, false)).toBe(true);
    expect(unknownRoute("Strategies", undefined, false)).toBe(true);
    expect(unknownRoute("pricing", undefined, false)).toBe(true);
    expect(unknownRoute("doc", undefined, false)).toBe(true);
    expect(unknownRoute("algo", undefined, false)).toBe(true);
  });
});

describe("the shared not found view", () => {
  afterEach(cleanup);

  it("says the page does not exist, shows the address and offers Back and Home", () => {
    render(<NotFound address="#/nope" home="#/" homeLabel="Home" />);
    expect(screen.getByRole("heading", { level: 1, name: "This page does not exist" })).toBeInTheDocument();
    expect(screen.getByText("#/nope")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("href", "#/");
    expect(screen.getByRole("button", { name: /Back/ })).toBeInTheDocument();
  });

  it("goes back in history, or Home when the tab has none", () => {
    const back = vi.spyOn(window.history, "back").mockImplementation(() => {});
    vi.spyOn(window.history, "length", "get").mockReturnValue(3);
    render(<NotFound home="#/" />);
    fireEvent.click(screen.getByRole("button", { name: /Back/ }));
    expect(back).toHaveBeenCalled();
  });

  it("takes a custom Back, heading level and extra actions", () => {
    const onBack = vi.fn();
    render(<NotFound heading="h2" title="No record at this address" onBack={onBack}><button type="button">Search</button></NotFound>);
    expect(screen.getByRole("heading", { level: 2, name: "No record at this address" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Back/ }));
    expect(onBack).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Search" })).toBeInTheDocument();
  });
});

describe("the static 404 page", () => {
  const html = readFileSync(web("404.html"), "utf8");

  it("is out of search and has its own title", () => {
    expect(PAGES["404.html"]).toMatchObject({ title: "Page not found · Parity", robots: PRIVATE });
    expect(PAGES["404.html"].path).toBeUndefined();
  });

  it("says the page does not exist and links home and to search, with no script", () => {
    expect(html).toContain("This page does not exist");
    expect(html).toContain('href="/"');
    expect(html).toContain('href="/app/?search"');
    expect(html).toContain("/brand/2026-10-21-starburst/");
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/[\u2013\u2014]/);
  });

  it("is built into the site and left out of the sitemap", () => {
    expect(readFileSync(web("vite.config.ts"), "utf8")).toMatch(/SITE_PAGES = \[\s*"index", "404"/);
    const seo = readFileSync(web("../scripts/seo/build_public.py"), "utf8");
    const list = seo.match(/STATIC_PUBLIC = \[(.*)\]/)![1];
    expect(list).not.toContain("404");
  });
});

describe("the Verify badge function answers 404 for an unknown id", () => {
  const env = { ASSETS: { fetch: async () => new Response("<html><head><title>x</title></head><body></body></html>", { headers: { "Content-Type": "text/html" } }) } };
  const rows = (r: Partial<PublicBadge>[]) => vi.fn(async () => new Response(JSON.stringify(r), { status: 200 })) as unknown as typeof fetch;
  const call = (id: string, fetcher: typeof fetch) => badgePage({ request: new Request(`https://parity.endyland.com/v/${id}`), env, params: { id } }, fetcher);

  it("serves the page with 404 when no badge has the id", async () => {
    const res = await call("AbCdEf123456", rows([]));
    expect(res.status).toBe(404);
    expect(res.headers.get("Content-Type")).toContain("text/html");
    expect(res.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
  });

  it("serves the page with 404 for an address that is not a badge id", async () => {
    const fetcher = rows([]);
    const res = await call("nope", fetcher);
    expect(res.status).toBe(404);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("serves a real badge with 200, and keeps 200 when the lookup fails", async () => {
    expect((await call("AbCdEf123456", rows([{ id: "AbCdEf123456", verdict: "could_be_luck", survives_tries: 4, trade_count: 1 }]))).status).toBe(200);
    vi.spyOn(console, "error").mockImplementation(() => {});
    const down = vi.fn(async () => new Response("down", { status: 500 })) as unknown as typeof fetch;
    expect((await call("AbCdEf123456", down)).status).toBe(200);
  });
});
