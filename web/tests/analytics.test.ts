// Product analytics (DEC-0053): nothing runs without an opt-in, events carry no personal
// data, and /e drops what it should.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { allowed, privacySignal, resetConsent, setConsent } from "../src/legal/consent";
import { track } from "../src/lib/analytics";
import { appOf, deviceOf, referrerHost, routeOf } from "../src/lib/analytics/route";
import { cleanBatch, cleanEvent, scrub } from "../src/lib/analytics/schema";
import { ids, labelOf, startTracker } from "../src/lib/analytics/tracker";
import { allow, ignore, liveToken, onRequest, PER_MINUTE, truncateIp } from "../functions/e";

const SID = "10000000-0000-4000-8000-000000000001";
const VID = "20000000-0000-4000-8000-000000000001";

/** Puts fixed test markup on the page. */
function page(markup: string) {
  document.body.replaceChildren(document.createRange().createContextualFragment(markup));
}

function visibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", { value: state, configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
}

afterEach(() => {
  resetConsent();
  localStorage.clear();
  delete window.__parityAnalytics;
  Object.defineProperty(navigator, "doNotTrack", { value: null, configurable: true });
  Object.defineProperty(navigator, "globalPrivacyControl", { value: undefined, configurable: true });
  Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
});

describe("consent for analytics", () => {
  it("is off until the person switches it on", () => {
    expect(allowed("analytics")).toBe(false);
    setConsent({ analytics: false });
    expect(allowed("analytics")).toBe(false);
    setConsent({ analytics: true });
    expect(allowed("analytics")).toBe(true);
  });

  it("stays off when the browser sends Do Not Track or Global Privacy Control", () => {
    Object.defineProperty(navigator, "globalPrivacyControl", { value: true, configurable: true });
    expect(privacySignal()).toBe(true);
    expect(setConsent({ analytics: true }).analytics).toBe(false);
    expect(allowed("analytics")).toBe(false);
    Object.defineProperty(navigator, "globalPrivacyControl", { value: undefined, configurable: true });
    Object.defineProperty(navigator, "doNotTrack", { value: "1", configurable: true });
    expect(allowed("analytics")).toBe(false);
  });

  it("track() does nothing while analytics is off", () => {
    window.__parityAnalytics = { booted: true, on: false, app: "product", q: [] };
    track("verify_run", { rows: 3 });
    expect(window.__parityAnalytics.q).toHaveLength(0);
  });
});

describe("routes and apps", () => {
  it("names every kind of page", () => {
    expect(appOf("/", undefined)).toBe("site");
    expect(appOf("/signup/", undefined)).toBe("auth");
    expect(appOf("/legal/privacy/", undefined)).toBe("legal");
    expect(appOf("/oauth/consent/", undefined)).toBe("connect");
    expect(appOf("/v/AbC123dEf456", undefined)).toBe("badge");
    expect(appOf("/", "trade")).toBe("trade");
    expect(appOf("/nowhere/", undefined)).toBeNull();
  });

  it("keeps patterns, never ids, names or queries", () => {
    expect(routeOf("product", "/app/", "#/strategy/fx_carry?tab=risk")).toBe("/app/#/strategy/:id");
    expect(routeOf("product", "/app/", "#/news/archive?q=my+search")).toBe("/app/#/news/archive");
    expect(routeOf("research", "/research/", "#/doc/0003-commodity-currencies")).toBe("/research/#/doc/:id");
    expect(routeOf("product", "/app/", "")).toBe("/app/#/");
    expect(routeOf("trade", "/", "#/chart?s=EURUSD")).toBe("/trade/#/chart");
    expect(routeOf("badge", "/v/AbC123dEf456", "")).toBe("/v/:id");
    expect(routeOf("legal", "/legal/privacy/", "")).toBe("/legal/privacy/");
    expect(routeOf("site", "/", "#features")).toBe("/");
    expect(routeOf("product", "/app/", "#/user/someone%40example.com")).toBe("/app/#/user/:id");
  });

  it("keeps only outside referrers, and a coarse screen class", () => {
    expect(referrerHost("https://news.ycombinator.com/item?id=1", "endyland.com")).toBe("news.ycombinator.com");
    expect(referrerHost("https://trade.endyland.com/", "endyland.com")).toBe("");
    expect(deviceOf(390)).toBe("phone");
    expect(deviceOf(800)).toBe("tablet");
    expect(deviceOf(1440)).toBe("desktop");
  });
});

describe("the batch rules", () => {
  it("masks emails, addresses and long numbers", () => {
    expect(scrub("Pay 4242424242424242 to a@b.co via https://x.y/z?q=1")).toBe("Pay # to (email) via (url)");
  });

  it("drops bad events and bad batches", () => {
    expect(cleanEvent({ k: "custom", r: "/", n: "Not A Name" })).toBeNull();
    expect(cleanEvent({ k: "pageview", r: "/<x>" })).toBeNull();
    expect(cleanEvent({ k: "custom", r: "/", n: "verify_run", p: { rows: 3, Email: "x", nested: { a: 1 } } })).toEqual({ k: "custom", r: "/", n: "verify_run", p: { rows: 3 } });
    expect(cleanBatch({ app: "nope", sid: SID, vid: VID, ev: [{ k: "pageview", r: "/" }] })).toBeNull();
    expect(cleanBatch({ app: "site", sid: "x", vid: VID, ev: [{ k: "pageview", r: "/" }] })).toBeNull();
    const b = cleanBatch({ app: "site", sid: SID, vid: VID, ref: "Example.COM", ev: [{ k: "pageview", r: "/" }, { k: "oops", r: "/" }] });
    expect(b?.ev).toHaveLength(1);
    expect(b?.ref).toBe("example.com");
  });
});

describe("the tracker", () => {
  let sent: { url: string; body: Record<string, unknown> }[];
  let stop: (() => void) | undefined;
  let t: number;
  beforeEach(() => {
    sent = [];
    t = 1_000_000;
    window.location.hash = "";
    window.__parityAnalytics = { booted: true, on: true, app: "product", q: [["verify_run", { rows: 2 }]] };
  });
  afterEach(() => { stop?.(); stop = undefined; });

  const start = (desktop = false) => {
    stop = startTracker("product", { desktop, now: () => t, send: (url, body) => sent.push({ url, body: JSON.parse(body) }) });
  };
  const flush = () => { visibility("hidden"); visibility("visible"); };
  const events = () => sent.flatMap((s) => s.body.ev as Record<string, unknown>[]);

  it("records a page view, queued calls, clicks with labels and never field values", () => {
    start();
    page(`<button data-track="Run checks">Run</button><a href="#/x" aria-label="Docs"><svg></svg></a>
      <label for="f">Email</label><input id="f" type="text" value="me@example.com"><input id="c" type="checkbox"><label for="c">Remember me</label>`);
    (document.querySelector("button") as HTMLElement).click();
    document.querySelector("a")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    (document.querySelector("#f") as HTMLElement).click();
    (document.querySelector("#c") as HTMLElement).click();
    flush();
    const ev = events();
    expect(ev[0]).toMatchObject({ k: "pageview", r: "/app/#/" });
    expect(ev.find((e) => e.k === "custom")).toMatchObject({ n: "verify_run", p: { rows: 2 } });
    const clicks = ev.filter((e) => e.k === "click").map((e) => e.n);
    expect(clicks).toContain("button:Run checks");
    expect(clicks).toContain("link:Docs");
    expect(clicks).toContain("checkbox:Remember me");
    expect(JSON.stringify(sent)).not.toContain("me@example.com");
    expect(sent[0].url).toBe("/e");
    expect(sent[0].body).toMatchObject({ app: "product", device: "desktop" });
  });

  it("counts visible time only, and sends a leave and a new page view on a route change", () => {
    start();
    t += 5000;
    visibility("hidden");
    t += 60_000; // hidden time does not count
    visibility("visible");
    t += 2000;
    window.location.hash = "#/strategy/fx_carry";
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    visibility("hidden");
    visibility("visible");
    const leaves = events().filter((e) => e.k === "leave").map((e) => e.ms);
    expect(leaves).toEqual([5000, 2000]);
    expect(events().filter((e) => e.k === "pageview").map((e) => e.r)).toEqual(["/app/#/", "/app/#/strategy/:id"]);
  });

  it("spots rage clicks", () => {
    start();
    page(`<button>Save</button>`);
    const b = document.querySelector("button")!;
    for (let i = 0; i < 4; i++) { t += 100; b.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: 10, clientY: 10 })); }
    flush();
    expect(events().filter((e) => e.k === "rage")).toHaveLength(1);
  });

  it("reports the desktop app as app=desktop with the window's app as surface", () => {
    start(true);
    flush();
    expect(sent[0].body).toMatchObject({ app: "desktop", surface: "product" });
  });

  it("drops everything unsent when stopped", () => {
    start();
    stop!();
    flush();
    expect(sent).toHaveLength(0);
  });

  it("keeps a visitor id, and starts a new session after 30 idle minutes", () => {
    const a = ids(0);
    const b = ids(10 * 60_000);
    const c = ids(50 * 60_000);
    expect(b.vid).toBe(a.vid);
    expect(b.sid).toBe(a.sid);
    expect(c.sid).not.toBe(a.sid);
  });

  it("labels controls by role and text", () => {
    page(`<div role="tab">Risk  <b>tab</b></div>`);
    expect(labelOf(document.querySelector("[role=tab]")!)).toBe("tab:Risk tab");
  });
});

describe("boot", () => {
  it("loads the tracker only after an opt-in, and deletes the ids on opt-out", async () => {
    vi.resetModules();
    localStorage.setItem("parity.a.vid", VID);
    const consent = await import("../src/legal/consent");
    await import("../src/lib/analytics/boot");
    const g = window.__parityAnalytics!;
    expect(g.booted).toBe(true);
    expect(g.on).toBe(false);
    expect(localStorage.getItem("parity.a.vid")).toBeNull();
    consent.setConsent({ analytics: true });
    expect(g.on).toBe(true);
    await vi.waitFor(() => expect(g.track).toBeTypeOf("function"));
    consent.setConsent({ analytics: false });
    expect(g.on).toBe(false);
    expect(g.track).toBeUndefined();
    expect(localStorage.getItem("parity.a.vid")).toBeNull();
    consent.resetConsent();
  });
});

describe("POST /e", () => {
  const body = JSON.stringify({ app: "site", sid: SID, vid: VID, ev: [{ k: "pageview", r: "/" }] });
  const req = (headers: Record<string, string> = {}, b = body) =>
    Object.assign(new Request("https://parity.endyland.com/e", { method: "POST", body: b, headers: { "User-Agent": "Mozilla/5.0 Chrome/130", "CF-Connecting-IP": "203.0.113.9", ...headers } }), { cf: { country: "GB" } });

  it("forwards a clean batch with the country, and never the address or user agent", async () => {
    const waits: Promise<unknown>[] = [];
    const fetcher = vi.fn(async () => new Response(null, { status: 200 }));
    const res = await onRequest({ request: req({ "CF-Connecting-IP": "198.51.100.1" }), waitUntil: (p) => waits.push(p) }, fetcher as unknown as typeof fetch);
    await Promise.all(waits);
    expect(res.status).toBe(204);
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/rpc/analytics_ingest");
    const sentBody = String(init.body);
    expect(JSON.parse(sentBody)).toMatchObject({ p_country: "GB", p_batch: { app: "site" } });
    expect(sentBody).not.toContain("198.51.100");
    expect(sentBody).not.toContain("Mozilla");
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it("drops privacy signals, bots and junk", async () => {
    const fetcher = vi.fn();
    const run = (r: Request) => onRequest({ request: r as never, waitUntil: () => {} }, fetcher as unknown as typeof fetch);
    await run(req({ "Sec-GPC": "1" }));
    await run(req({ DNT: "1" }));
    await run(req({ "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1)" }));
    await run(req({ "User-Agent": "Mozilla/5.0 HeadlessChrome/130" }));
    await run(req({}, "not json"));
    await run(req({}, JSON.stringify({ app: "site", sid: SID, vid: VID, ev: [{ k: "custom", r: "/", n: "Bad Name" }] })));
    expect(fetcher).not.toHaveBeenCalled();
    expect(ignore(req())).toBe(false);
  });

  it("limits each network per minute, by a shortened address", () => {
    expect(truncateIp("203.0.113.9")).toBe("203.0.113");
    expect(truncateIp("2001:db8:abcd:12::1")).toBe("2001:db8:abcd");
    for (let i = 0; i < PER_MINUTE; i++) expect(allow("net-a", 0)).toBe(true);
    expect(allow("net-a", 1)).toBe(false);
    expect(allow("net-a", 61_000)).toBe(true);
  });

  it("passes on a live sign-in token so the database can hash the user id, and never an expired one", () => {
    const tok = (exp: number) => `x.${btoa(JSON.stringify({ role: "authenticated", exp })).replace(/=+$/, "")}.y`;
    const live = tok(Math.floor(Date.now() / 1000) + 600);
    expect(liveToken(new Request("https://x/e", { headers: { Authorization: `Bearer ${live}` } }))).toBe(live);
    expect(liveToken(new Request("https://x/e", { headers: { Authorization: `Bearer ${tok(1)}` } }))).toBeNull();
  });
});
