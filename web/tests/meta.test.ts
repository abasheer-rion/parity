// Page metadata, share cards and deep links (DEC-0038): one table gives every page its
// tags, the site's address is one constant, protected pages say noindex, hashes survive
// signing in, and short links point where they should. No network.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import site from "../src/lib/site.json";
import { HOST, mainHostFor, ORIGIN, originsFor, PAGES, parentDomain, PRIVATE, routeMeta, SIM_ORIGIN, SIM_TABS, SITE_DOMAIN, SITE_DOMAINS, siteDomainOf, withHead } from "../src/lib/meta";
import { shareUrl, withHashQuery } from "../src/lib/deeplink";
import { badgeCardSvg, cardSvg, textWidth, wrap } from "../src/lib/og/card";
import { badgeCard, badgeMeta, strategyCard, strategyMeta } from "../src/lib/og/share";
import { nextFromQuery, withHash } from "../src/auth/redirect";
import { LEGACY_TABS } from "../src/terminal/functions";
import { WORKSPACES } from "../src/terminal/layout";
import type { PublicBadge } from "../src/lib/verify/badge";
import { sharePage, onRequestGet as shortStrategy } from "../functions/s/[id]";
import { onRequestGet as shortSim } from "../functions/sim/[tab]";
import { onRequestGet as badgePage } from "../functions/v/[id]";

const web = (p: string) => resolve(import.meta.dirname, "..", p);

/** Every HTML entry the builds use: web/*.html and web/<dir>/**\/index.html. */
function htmlEntries(): string[] {
  const out: string[] = [];
  const walk = (dir: string, rel: string) => {
    for (const name of readdirSync(dir)) {
      if (["node_modules", "dist", "public", "src", "tests", "functions", "plugins", "scripts"].includes(name)) continue;
      const full = resolve(dir, name);
      const r = rel ? `${rel}/${name}` : name;
      if (statSync(full).isDirectory()) walk(full, r);
      else if (name.endsWith(".html")) out.push(r);
    }
  };
  walk(web(""), "");
  return out.sort();
}

const count = (html: string, re: RegExp) => (html.match(re) ?? []).length;

describe("the site address is one constant", () => {
  it("comes from site.json", () => {
    expect(ORIGIN).toBe(site.origin);
    expect(HOST).toBe("paritytrading.app");
    expect(SITE_DOMAIN).toBe("paritytrading.app");
    expect(SIM_ORIGIN).toBe("https://sim.paritytrading.app");
  });

  it("keeps the old domain working while it redirects (DEC-0069)", () => {
    expect(SITE_DOMAINS).toEqual(["paritytrading.app", "endyland.com"]);
    expect(siteDomainOf("trade.paritytrading.app")).toBe("paritytrading.app");
    expect(siteDomainOf("sim.endyland.com")).toBe("endyland.com");
    expect(siteDomainOf("evil-paritytrading.app")).toBeNull();
    expect(siteDomainOf("parity-research.pages.dev")).toBeNull();
    expect(mainHostFor("endyland.com")).toBe("parity.endyland.com");
    expect(mainHostFor("paritytrading.app")).toBe(HOST);
    expect(originsFor("lab.endyland.com")).toEqual({ main: "https://parity.endyland.com", sim: "https://sim.endyland.com", trade: "https://trade.endyland.com", academy: "https://academy.endyland.com", lab: "https://lab.endyland.com" });
    expect(originsFor("paritytrading.app").sim).toBe("https://sim.paritytrading.app");
    expect(originsFor("127.0.0.1").main).toBe(ORIGIN);
  });

  it("works for an apex domain too", () => {
    expect(parentDomain("paritytrading.ai")).toBe("paritytrading.ai");
    expect(parentDomain("app.paritytrading.ai")).toBe("paritytrading.ai");
  });

  it("is not written out anywhere else in the page sources", () => {
    for (const f of ["src/lib/meta.ts", "plugins/meta.ts", "plugins/legal.ts", "src/lib/space.ts", "src/auth/redirect.ts", "src/auth/client.ts", "functions/_middleware.ts"]) {
      expect(readFileSync(web(f), "utf8"), f).not.toMatch(/https:\/\/(parity|sim)\.endyland\.com|https:\/\/(sim\.)?paritytrading\.app|"(endyland\.com|paritytrading\.app)"/);
    }
  });
});

describe("every page gets its tags from the table", () => {
  it("has an entry for every HTML file", () => {
    for (const f of htmlEntries()) expect(PAGES[f], f).toBeDefined();
  });

  it.each(htmlEntries())("%s ends up with one set of tags", (f) => {
    const html = withHead(readFileSync(web(f), "utf8"), PAGES[f]);
    expect(count(html, /<title>/g)).toBe(1);
    expect(count(html, /name="description"/g)).toBe(1);
    expect(count(html, /property="og:title"/g)).toBe(1);
    expect(count(html, /property="og:image"/g)).toBe(1);
    expect(count(html, /name="twitter:card"/g)).toBe(1);
    expect(count(html, /name="theme-color"/g)).toBe(1);
    expect(count(html, /rel="icon"/g)).toBe(2);
    expect(count(html, /rel="canonical"/g)).toBeLessThanOrEqual(1);
    expect(html).toContain(`content="${ORIGIN}/og/`);
    // Applying it twice changes nothing.
    expect(withHead(html, PAGES[f])).toBe(html);
  });

  it("puts Organization, WebSite and SoftwareApplication on the front page", () => {
    const html = withHead(readFileSync(web("index.html"), "utf8"), PAGES["index.html"]);
    const ld = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/)![1]);
    const types = ld["@graph"].map((n: { "@type": string }) => n["@type"]);
    expect(types).toEqual(["Organization", "WebSite", "SoftwareApplication"]);
    expect(ld["@graph"][0].name).toBe("Parity Trading, Inc.");
    expect(html).toContain('<link rel="canonical" href="https://paritytrading.app/" />');
  });

  it("marks the signed-in apps noindex and leaves public pages alone", () => {
    for (const f of ["app/index.html", "research/index.html", "sim/index.html", "trade/index.html"]) expect(PAGES[f].robots, f).toBe(PRIVATE);
    for (const f of ["index.html", "legal/index.html", "legal/privacy/index.html", "login/index.html"]) expect(PAGES[f].robots, f).toBeUndefined();
  });
});

describe("in-app pages", () => {
  it("name the page, the strategy and the side", () => {
    expect(routeMeta("product", "strategy", "fx_carry", "Currency carry")).toMatchObject({
      title: "Currency carry · Parity", image: `${ORIGIN}/og/strategy/fx_carry.png`,
    });
    expect(routeMeta("product", "verify").title).toBe("Verify · Parity");
    expect(routeMeta("research", "doc", "DEC-0023").title).toBe("DEC-0023 · Parity Research");
    expect(routeMeta("research", "").title).toBe("Parity Research");
    expect(routeMeta("sim", "simlab").title).toBe("Sim lab · Parity Terminal");
  });

  it("knows every Terminal workspace and old Sim World tab", () => {
    expect(Object.keys(SIM_TABS).sort()).toEqual([...new Set([...WORKSPACES.map((w) => w.id), ...Object.keys(LEGACY_TABS)])].sort());
  });
});

describe("deep links survive signing in", () => {
  const at = { origin: "https://paritytrading.app", hostname: "paritytrading.app" };

  it("puts the hash the browser carried back onto next", () => {
    expect(nextFromQuery("?next=%2Fapp%2F", at, "#/strategy/fx_carry")).toBe("/app/#/strategy/fx_carry");
    expect(nextFromQuery("?next=%2Fresearch%2F", at, "#/search?asset=fx&q=carry")).toBe("/research/#/search?asset=fx&q=carry");
  });

  it("keeps a next that already has its hash, and ignores other hashes", () => {
    expect(withHash("/app/#/verify", "#/strategy/x")).toBe("/app/#/verify");
    expect(withHash("/app/", "#access_token=abc")).toBe("/app/");
    expect(withHash(null, "#/strategy/x")).toBeNull();
    expect(nextFromQuery("", at, "#/strategy/x")).toBe("/app/");
  });

  it("still refuses other sites", () => {
    expect(nextFromQuery("?next=%2F%2Fevil.com", at, "#/x")).toBe("/app/");
  });
});

describe("short links", () => {
  it("turns a strategy page into /s/<id> and a Terminal view into /sim/<tab>", () => {
    expect(shareUrl("https://paritytrading.app/app/#/strategy/fx_carry")).toBe("https://paritytrading.app/s/fx_carry");
    expect(shareUrl("https://sim.paritytrading.app/#/scenario?type=war")).toBe("https://sim.paritytrading.app/sim/scenario?type=war");
    expect(shareUrl("https://paritytrading.app/sim/#/fx")).toBe("https://paritytrading.app/sim/fx");
    expect(shareUrl("https://paritytrading.app/research/#/search?asset=fx")).toBe("https://paritytrading.app/research/#/search?asset=fx");
  });

  it("edits the hash query", () => {
    expect(withHashQuery("#/search", { asset: "fx", q: "" })).toBe("#/search?asset=fx");
    expect(withHashQuery("#/search?asset=fx&q=carry", { asset: null })).toBe("#/search?q=carry");
  });

  it("/s/<id> previews the strategy and sends people on to the app", async () => {
    const res = await shortStrategy({ params: { id: "fx_carry" } });
    const html = await res.text();
    expect(res.headers.get("X-Robots-Tag")).toContain("noindex");
    expect(html).toContain("<title>Currency carry · Parity</title>");
    expect(html).toContain(`content="${ORIGIN}/og/strategy/fx_carry.png"`);
    expect(html).toContain('url=/app/#/strategy/fx_carry');
    expect(sharePage("fx_carry")).toBe(html);
    const bad = await shortStrategy({ params: { id: "<script>" } });
    expect(bad.status).toBe(302);
    expect(bad.headers.get("Location")).toBe("/app/#/strategies");
  });

  it("/sim/<tab> opens that workspace and passes other files through", async () => {
    const next = vi.fn(async () => new Response("asset"));
    const res = await shortSim({ request: new Request("https://paritytrading.app/sim/scenario?type=war&r=gulf"), params: { tab: "scenario" }, next });
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/sim/#/scenario?type=war&r=gulf");
    expect(await (await shortSim({ request: new Request("https://paritytrading.app/sim/sw.js"), params: { tab: "sw.js" }, next })).text()).toBe("asset");
    expect(await (await shortSim({ request: new Request("https://paritytrading.app/sim/toString"), params: { tab: "toString" }, next })).text()).toBe("asset");
  });
});

const badge = (over: Partial<PublicBadge> = {}): PublicBadge => ({
  id: "AbCdEf123456", created_at: "2026-10-20T00:00:00Z", withdrawn_at: null, name: null, input_kind: "backtest", stated_tries: 10,
  date_from: "2020-01-02", date_to: "2024-03-28", trade_count: 212, verdict: "could_be_luck", survives_tries: 4, cards: null,
  method_version: "1", file_sha256: null, ...over,
});

describe("share cards", () => {
  it("wraps long titles and cuts with an ellipsis", () => {
    const lines = wrap("one two three four five six seven eight nine ten eleven twelve", 66, 300, 2, true);
    expect(lines).toHaveLength(2);
    expect(lines[1].endsWith("…")).toBe(true);
    for (const l of lines) expect(textWidth(l, 66, true)).toBeLessThanOrEqual(300 + 66);
  });

  it("shows a badge's verdict and how many tries it survives", () => {
    const c = badgeCard(badge(), "AbCdEf123456");
    expect(c).toMatchObject({ verdict: "Could be luck", survives: "Survives up to 4 tries" });
    expect(c.detail).toBe("Self-reported backtest · 212 trades · 2020-01-02 to 2024-03-28");
    const svg = badgeCardSvg(c, '<svg viewBox="0 0 10 10"></svg>');
    expect(svg).toContain("Could be luck");
    expect(svg).toContain("paritytrading.app/v/AbCdEf123456");
    expect(badgeMeta(badge(), "AbCdEf123456").title).toBe("Could be luck: survives up to 4 tries · Parity Verify");
  });

  it("never shows a withdrawn badge's old verdict", () => {
    const c = badgeCard(badge({ withdrawn_at: "2026-10-22T10:00:00Z" }), "AbCdEf123456");
    expect(c.verdict).toBe("Withdrawn");
    expect(JSON.stringify(c)).not.toContain("luck");
    expect(badgeCard(null, "AbCdEf123456").verdict).toBe("No such record");
  });

  it("gives a strategy its name and kind, not its results", () => {
    expect(strategyCard("fx_carry")).toMatchObject({ title: "Currency carry", kicker: "Parity strategy · Carry · Currencies · monthly" });
    expect(strategyCard("new_idea").title).toBe("New idea");
    expect(strategyMeta("fx_carry").path).toBe("/s/fx_carry");
    expect(cardSvg(strategyCard("fx_carry"), "<svg></svg>")).toContain("Currency carry");
  });
});

describe("badge pages carry their own tags", () => {
  const page = withHead(readFileSync(web("v/index.html"), "utf8"), PAGES["v/index.html"]);
  const env = { ASSETS: { fetch: async () => new Response(page, { headers: { "Content-Type": "text/html", ETag: '"x"' } }) } };

  it("puts the verdict in the title and the badge's card in og:image", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify([badge()]), { status: 200 })) as unknown as typeof fetch;
    const res = await badgePage({ request: new Request("https://paritytrading.app/v/AbCdEf123456"), env, params: { id: "AbCdEf123456" } }, fetcher);
    const html = await res.text();
    expect(html).toContain("<title>Could be luck: survives up to 4 tries · Parity Verify</title>");
    expect(html).toContain(`content="${ORIGIN}/og/badge/AbCdEf123456.png"`);
    expect(count(html, /<title>/g)).toBe(1);
    expect(res.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
    expect(res.headers.get("ETag")).toBeNull();
  });

  it("falls back to the general tags when the lookup fails", async () => {
    const fetcher = vi.fn(async () => new Response("down", { status: 500 })) as unknown as typeof fetch;
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await badgePage({ request: new Request("https://paritytrading.app/v/AbCdEf123456"), env, params: { id: "AbCdEf123456" } }, fetcher);
    expect(await res.text()).toContain("<title>Verified record · Parity</title>");
  });
});
