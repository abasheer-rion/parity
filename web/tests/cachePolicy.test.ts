// Public caching (DEC-0072): which public answers browsers and Cloudflare may keep, and for
// how long. public/_headers must give the same values as src/lib/cachePolicy.ts, with
// exactly one Cache-Control per path (Pages joins two matching values with a comma).
// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CACHE, publicCacheFor, THREE_DAYS } from "../src/lib/cachePolicy";
import { withPublicCache } from "../functions/_middleware";

describe("publicCacheFor", () => {
  it("keeps public pages up to 3 days with a background refresh", () => {
    for (const p of ["/", "/index.html", "/legal/", "/legal/privacy/", "/learn/x/", "/news/", "/blog/a/", "/download/", "/developers/"]) expect(publicCacheFor(p)).toBe(CACHE.page);
    expect(CACHE.page).toContain(`stale-while-revalidate=${THREE_DAYS}`);
  });
  it("keeps built files a year and pictures a day", () => {
    expect(publicCacheFor("/assets/index-AbCd1234.js")).toBe(CACHE.immutable);
    expect(publicCacheFor("/brand/x.svg")).toBe(CACHE.media);
    expect(publicCacheFor("/favicon.svg")).toBe(CACHE.media);
  });
  it("gives hourly data a minute", () => {
    expect(publicCacheFor("/stats.json")).toBe(CACHE.hourlyData);
  });
  it("never keeps sign-in pages, and leaves everything else alone", () => {
    for (const p of ["/login/", "/signup/", "/reset/", "/verify/", "/connect/", "/oauth/consent/"]) expect(publicCacheFor(p)).toBe("no-store");
    expect(publicCacheFor("/app/")).toBeNull();
    expect(publicCacheFor("/data/latest.json")).toBeNull();
    expect(publicCacheFor("/live/status")).toBeNull();
    expect(publicCacheFor("/download/latest/windows")).toBeNull();
    expect(publicCacheFor("/legal/", 404)).toBeNull();
  });
});

describe("withPublicCache", () => {
  it("replaces Pages' default on the front page", () => {
    const res = withPublicCache("/", new Response("x", { headers: { "Cache-Control": "public, max-age=0, must-revalidate" } }));
    expect(res.headers.get("Cache-Control")).toBe(CACHE.page);
  });
  it("keeps a Function's own value", () => {
    const res = withPublicCache("/legal/", new Response("x", { headers: { "Cache-Control": "public, max-age=5" } }));
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=5");
  });
});

describe("public/_headers", () => {
  const text = readFileSync(resolve(import.meta.dirname, "../public/_headers"), "utf8");
  const rules = new Map<string, string[]>();
  let path = "";
  for (const line of text.split("\n")) {
    if (!line.trim() || line.startsWith("#")) continue;
    if (!line.startsWith(" ")) { path = line.trim(); continue; }
    const m = line.trim().match(/^Cache-Control:\s*(.+)$/);
    if (m) rules.set(path, [...(rules.get(path) ?? []), m[1]]);
  }
  it("sets Cache-Control once per path, matching the policy", () => {
    for (const [p, values] of rules) expect(values, p).toHaveLength(1);
    expect(rules.get("/legal/*")?.[0]).toBe(CACHE.page);
    expect(rules.get("/brand/*")?.[0]).toBe(CACHE.media);
    expect(rules.get("/stats.json")?.[0]).toBe(CACHE.hourlyData);
    expect(rules.get("/assets/*")?.[0]).toBe(CACHE.immutable);
    expect(rules.get("/login/*")?.[0]).toBe("no-store");
    expect(rules.has("/*")).toBe(false);
  });
});
