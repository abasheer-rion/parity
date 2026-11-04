// Claims read from a seller's page or words (DEC-0088): the fixed patterns on saved sample
// pages (tests/fixtures/verify/pages, SOURCES.md), robots.txt, the safe fetcher on a fake
// network, the public endpoint's limits, the person's own model and the comparison with a
// record. No test talks to the network.
// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { MinuteLimiter } from "../../src/lib/api/policy";
import { againstSummary, claimsAgainst } from "../../src/lib/verify/claims/against";
import { handleClaimUrl, PER_ADDRESS } from "../../src/lib/verify/claims/endpoint";
import { chosen, claimFrom, extractClaims, parseDate, parseNumber, textFragmentUrl, type FoundClaim } from "../../src/lib/verify/claims/extract";
import { checkUrl, fetchPage, FETCH_LIMITS, USER_AGENT } from "../../src/lib/verify/claims/fetch";
import { mergeFound, modelPrompt, readModelAnswer } from "../../src/lib/verify/claims/model";
import { robotsAllows } from "../../src/lib/verify/claims/robots";
import { htmlToText, plainText } from "../../src/lib/verify/claims/text";
import { checkDescription, checkFile } from "../../src/lib/verify/checks";
import { parseText } from "../../src/lib/verify/parse";

const PAGES = resolve(import.meta.dirname, "../fixtures/verify/pages");
const page = (f: string) => readFileSync(resolve(PAGES, f), "utf8");
const textOf = (f: string) => (f.endsWith(".html") ? htmlToText(page(f)).text : plainText(page(f)));
const round = <T extends object>(o: T) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === "number" ? Number(v.toFixed(6)) : v]));
const fields = (found: FoundClaim[]) => found.map((c) => `${c.field}=${typeof c.value === "number" ? Number(c.value.toFixed(4)) : c.value}`);

describe("numbers and dates as pages write them", () => {
  it("reads thousands separators, decimal commas and signs", () => {
    expect(parseNumber("1 602.85")).toBe(1602.85);
    expect(parseNumber("1,602.85")).toBe(1602.85);
    expect(parseNumber("1.602,85")).toBe(1602.85);
    expect(parseNumber("12,5")).toBe(12.5);
    expect(parseNumber("1,200")).toBe(1200);
    expect(parseNumber("+340")).toBe(340);
    expect(parseNumber("-2.80")).toBe(-2.8);
    expect(parseNumber("1.602.000")).toBe(1602000);
  });
  it("reads dates in the common shapes, to the first of the month or year when that is all there is", () => {
    expect(parseDate("2024.10.22")).toBe("2024-10-22");
    expect(parseDate("Mar 3, 2024")).toBe("2024-03-03");
    expect(parseDate("3 March 2024")).toBe("2024-03-03");
    expect(parseDate("March 2023")).toBe("2023-03-01");
    expect(parseDate("2023")).toBe("2023-01-01");
    expect(parseDate("2023.13.40")).toBeNull();
  });
});

describe("the fixed patterns on sample pages", () => {
  it("reads a statistics page's labels and values (MQL5 signal layout, made-up numbers)", () => {
    const found = extractClaims(textOf("mql5-signal.html"));
    expect(fields(found)).toEqual([
      "totalReturn=2.1248", "tradesPerMonth=30.3333", "months=21.6163", "startDate=2024-12-30", "trades=702", "winRate=0.6852",
      "sharpe=0.18", "profitFactor=2.11", "monthlyReturn=0.041", "maxDrawdown=0.114", "maxDrawdown=0.1475",
    ]);
    // A forecast, the share of growth in 21 days, algo trading 97%, gross pips and the script's data are not claims.
    const words = found.map((c) => c.quote).join(" | ");
    expect(words).not.toMatch(/Forecast|achieved within|Algo trading|999/);
    // Each claim keeps the words it came from and how it was read.
    const win = found.find((c) => c.field === "winRate")!;
    expect(win).toMatchObject({ shown: "68.52%", rule: 'Next to "Profit Trades"', how: "pattern" });
    expect(win.quote).toBe("Profit Trades: 481 (68.52%)");
    // Of several drawdowns, the claim used is the largest, the kindest reading for the seller.
    expect(round(claimFrom(found))).toMatchObject({ totalReturn: 2.1248, winRate: 0.6852, maxDrawdown: 0.1475, trades: 702, profitFactor: 2.11, startDate: "2024-12-30" });
  });

  it("reads a sales page's sentences and leaves out risk, leverage, fees and a refund period", () => {
    const found = extractClaims(textOf("sales-page.html"));
    const c = claimFrom(found);
    expect(c).toMatchObject({ winRate: 0.92, totalReturn: 3.4, months: 12, maxDrawdown: 0.08, trades: 1200, startDate: "2023-03-01", monthlyReturn: 0.095, profitFactor: 2.8 });
    // "No martingale, no grid" is a negation, not a claim of either.
    expect(c.grid).toBeUndefined();
    expect(c.martingale).toBeUndefined();
    expect(found.some((f) => /Risk 2%|0\.1% per side|money-back/.test(f.shown))).toBe(false);
    // The description in the page's head is read too, and the same words are not counted twice.
    expect(found.filter((f) => f.field === "winRate")).toHaveLength(2);
  });

  it("reads a pasted post", () => {
    const c = claimFrom(extractClaims(textOf("post.txt")));
    expect(round(c)).toEqual({ totalReturn: 1.74, winRate: 0.71, maxDrawdown: 0.112, trades: 500, profitFactor: 2.3, startDate: "2024-01-01", stopLoss: 0.015 });
  });

  it("reads text copied from a statistics page, without the long and short sides or the absolute gain", () => {
    const found = extractClaims(textOf("stats-page-copied.txt"));
    expect(round(claimFrom(found))).toEqual({ totalReturn: 1.284, monthlyReturn: 0.0395, winRate: 0.89, maxDrawdown: 0.1862, trades: 1204, profitFactor: 1.61, startDate: "2024-03-03" });
    expect(found.filter((f) => f.field === "totalReturn")).toHaveLength(1);
    expect(found.some((f) => f.quote.includes("Longs Won") && f.field === "winRate")).toBe(false);
  });

  it("reads a signals channel's claims", () => {
    expect(claimFrom(extractClaims(textOf("signal-channel.txt")))).toMatchObject({ winRate: 0.87, totalReturn: 0.62 });
  });

  it("finds no performance claim on a page of broker conditions", () => {
    const c = claimFrom(extractClaims(textOf("noise.html")));
    for (const k of ["totalReturn", "monthlyReturn", "yearlyReturn", "winRate", "maxDrawdown", "trades", "takeProfit", "stopLoss"] as const) expect(c[k], k).toBeUndefined();
  });

  it("says when a page builds its numbers with scripts", () => {
    const t = htmlToText(page("scripted-shell.html"));
    expect(t.scripted).toBe(true);
    expect(extractClaims(t.text)).toEqual([]);
    expect(htmlToText(page("mql5-signal.html")).scripted).toBe(false);
  });

  it("does not read a length of time or a count out of running text", () => {
    const found = extractClaims("Reliability 105 weeks 53 subscribers. Subscription lets you copy trades within 1 month.");
    expect(found.filter((f) => f.field === "months")).toEqual([]);
  });

  it("gives the same claims every time", () => {
    const t = textOf("mql5-signal.html");
    expect(extractClaims(t)).toEqual(extractClaims(t));
  });

  it("links to the words on the seller's page", () => {
    const f = extractClaims("Our record: 92% win rate over 1,200 trades").find((x) => x.field === "winRate")!;
    expect(textFragmentUrl("https://example.com/bot#top", f)).toBe("https://example.com/bot#:~:text=Our%20record%3A%2092%25");
  });
});

describe("robots.txt (RFC 9309)", () => {
  const txt = ["User-agent: *", "Disallow: /user/", "Allow: /user/public$", "", "User-agent: OtherBot", "Disallow: /"].join("\n");
  it("uses the * group when ours is not named, longest match first, allow on a tie", () => {
    expect(robotsAllows(txt, "/users/fxblue_demo")).toBe(true);
    expect(robotsAllows(txt, "/user/abc")).toBe(false);
    expect(robotsAllows(txt, "/user/public")).toBe(true);
    expect(robotsAllows(txt, "/user/public/more")).toBe(false);
    expect(robotsAllows("User-agent: *\nDisallow: /p\nAllow: /p", "/page")).toBe(true);
  });
  it("uses our own group when it is named, and * wildcards", () => {
    const ours = "User-agent: *\nDisallow: /\n\nUser-agent: ParityVerify\nDisallow: /*/deals/page*\nDisallow: /private$";
    expect(robotsAllows(ours, "/en/signals/2265877")).toBe(true);
    expect(robotsAllows(ours, "/en/signals/2265877/deals/page2")).toBe(false);
    expect(robotsAllows(ours, "/private")).toBe(false);
    expect(robotsAllows(ours, "/private/x")).toBe(true);
  });
  it("treats an empty disallow as allow-all and X's real rule as no", () => {
    expect(robotsAllows("User-agent: *\nDisallow:", "/anything")).toBe(true);
    expect(robotsAllows("User-agent: *\nDisallow: /", "/someone/status/1")).toBe(false);
  });
});

// ------------------------------------------------------------------ the fetcher

type Route = (url: URL, init: RequestInit) => Response | Promise<Response>;
function fakeNet(routes: Record<string, Route>) {
  const calls: { url: string; headers: Record<string, string> }[] = [];
  const f = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input));
    calls.push({ url: url.toString(), headers: Object.fromEntries(new Headers(init.headers).entries()) });
    const r = routes[url.origin + url.pathname] ?? routes[url.origin + "/*"];
    if (!r) return new Response("not here", { status: 404 });
    return r(url, init);
  }) as typeof fetch;
  return { f, calls };
}
const html = (body: string, status = 200, headers: Record<string, string> = {}) => new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8", ...headers } });
const robots = (txt: string) => () => new Response(txt, { headers: { "content-type": "text/plain" } });

describe("fetching a seller's page", () => {
  it("refuses addresses that are not public web pages, without fetching anything", () => {
    for (const bad of ["ftp://example.com/x", "http://localhost:8080/", "http://127.0.0.1/", "https://10.0.0.1/", "http://[::1]/", "http://169.254.169.254/latest/meta-data", "https://user:pw@example.com/", "https://example.com:8443/", "http://intranet/", "http://printer.local/", "http://2130706433/", "http://0x7f000001/"]) {
      expect(checkUrl(bad).ok, bad).toBe(false);
    }
    expect(checkUrl("www.mql5.com/en/signals/1").ok).toBe(true);
  });

  it("reads robots.txt first, sends our name and no login, and returns the page's words", async () => {
    const net = fakeNet({
      "https://shop.example.com/robots.txt": robots("User-agent: *\nDisallow: /admin"),
      "https://shop.example.com/bot": () => html(page("sales-page.html")),
    });
    const r = await fetchPage("https://shop.example.com/bot#reviews", { fetch: net.f, robotsCache: new Map() });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.finalUrl).toBe("https://shop.example.com/bot");
    expect(r.title).toBe("AuroraFX Pro EA | The gold robot that wins");
    expect(claimFrom(extractClaims(r.text)).winRate).toBe(0.92);
    expect(net.calls.map((c) => c.url)).toEqual(["https://shop.example.com/robots.txt", "https://shop.example.com/bot"]);
    for (const c of net.calls) {
      expect(c.headers["user-agent"]).toBe(USER_AGENT);
      expect(c.headers.cookie).toBeUndefined();
      expect(c.headers.authorization).toBeUndefined();
    }
  });

  it("does not open a page robots.txt rules out, and never asks X at all", async () => {
    const net = fakeNet({ "https://shop.example.com/robots.txt": robots("User-agent: *\nDisallow: /private") });
    const r = await fetchPage("https://shop.example.com/private/page", { fetch: net.f, robotsCache: new Map() });
    expect(r).toMatchObject({ ok: false, reason: "robots" });
    expect(net.calls).toHaveLength(1);
    const x = await fetchPage("https://x.com/someone/status/123", { fetch: net.f, robotsCache: new Map() });
    expect(x).toMatchObject({ ok: false, reason: "robots" });
    expect(!x.ok && x.detail).toMatch(/paste/);
    expect(net.calls).toHaveLength(1);
  });

  it("does not fetch when robots.txt cannot be read (5xx), and fetches when there is none (404)", async () => {
    const down = fakeNet({ "https://a.example.com/robots.txt": () => new Response("", { status: 503 }), "https://a.example.com/p": () => html("<p>92% win rate</p>") });
    expect(await fetchPage("https://a.example.com/p", { fetch: down.f, robotsCache: new Map() })).toMatchObject({ ok: false, reason: "robots_unreachable" });
    const none = fakeNet({ "https://a.example.com/p": () => html("<p>92% win rate</p>") });
    expect(await fetchPage("https://a.example.com/p", { fetch: none.f, robotsCache: new Map() })).toMatchObject({ ok: true });
  });

  it("follows at most 3 redirects, each checked again, and never to a private address", async () => {
    const hop = (to: string) => () => new Response(null, { status: 302, headers: { location: to } });
    const loop = fakeNet({ "https://a.example.com/1": hop("/2"), "https://a.example.com/2": hop("/3"), "https://a.example.com/3": hop("/4"), "https://a.example.com/4": hop("/5") });
    expect(await fetchPage("https://a.example.com/1", { fetch: loop.f, robotsCache: new Map() })).toMatchObject({ ok: false, reason: "redirects" });
    const inside = fakeNet({ "https://a.example.com/go": hop("http://169.254.169.254/latest") });
    expect(await fetchPage("https://a.example.com/go", { fetch: inside.f, robotsCache: new Map() })).toMatchObject({ ok: false, reason: "not_allowed_address" });
    expect(inside.calls.some((c) => c.url.includes("169.254"))).toBe(false);
    const moved = fakeNet({ "https://a.example.com/old": hop("https://b.example.com/new"), "https://b.example.com/robots.txt": robots("User-agent: *\nDisallow: /new"), "https://b.example.com/new": () => html("<p>x</p>") });
    expect(await fetchPage("https://a.example.com/old", { fetch: moved.f, robotsCache: new Map() })).toMatchObject({ ok: false, reason: "robots" });
  });

  it("names a bot check and a login wall instead of working round them", async () => {
    const cf = fakeNet({ "https://m.example.com/x": () => html("<html><head><title>Just a moment...</title></head><body>challenge-platform</body></html>", 403, { "cf-mitigated": "challenge" }) });
    expect(await fetchPage("https://m.example.com/x", { fetch: cf.f, robotsCache: new Map() })).toMatchObject({ ok: false, reason: "bot_check" });
    const login = fakeNet({ "https://m.example.com/x": () => html("<p>Please log in</p>", 401) });
    expect(await fetchPage("https://m.example.com/x", { fetch: login.f, robotsCache: new Map() })).toMatchObject({ ok: false, reason: "login" });
  });

  it("reads only the first 2 MB, refuses a page that says it is over 15 MB and stops after 8 seconds", async () => {
    const big = "<p>win rate 61%</p>" + "x".repeat(FETCH_LIMITS.bytes + 5000);
    const net = fakeNet({ "https://b.example.com/big": () => html(big) });
    const r = await fetchPage("https://b.example.com/big", { fetch: net.f, robotsCache: new Map() });
    expect(r).toMatchObject({ ok: true, truncated: true, bytes: FETCH_LIMITS.bytes });
    const huge = fakeNet({ "https://b.example.com/huge": () => html("<p>x</p>", 200, { "content-length": "20000000" }) });
    expect(await fetchPage("https://b.example.com/huge", { fetch: huge.f, robotsCache: new Map() })).toMatchObject({ ok: false, reason: "too_large" });
    const slow = fakeNet({ "https://b.example.com/slow": (_u, init) => new Promise<Response>((_, fail) => init.signal?.addEventListener("abort", () => fail(Object.assign(new Error("t"), { name: "TimeoutError" })))) });
    const t0 = Date.now();
    const s = await fetchPage("https://b.example.com/slow", { fetch: slow.f, robotsCache: new Map() });
    expect(s).toMatchObject({ ok: false, reason: "timeout" });
    expect(Date.now() - t0).toBeLessThan(FETCH_LIMITS.pageMs + FETCH_LIMITS.robotsMs + 1500);
  }, 20_000);

  it("refuses a file that is not a web page, and decodes the page's own charset", async () => {
    const pdf = fakeNet({ "https://c.example.com/r.pdf": () => new Response("%PDF", { headers: { "content-type": "application/pdf" } }) });
    expect(await fetchPage("https://c.example.com/r.pdf", { fetch: pdf.f, robotsCache: new Map() })).toMatchObject({ ok: false, reason: "not_a_page" });
    const latin = new Uint8Array([...new TextEncoder().encode("<p>Gain: 12"), 0xb7, ...new TextEncoder().encode("5% Caf"), 0xe9, ...new TextEncoder().encode("</p>")]);
    const l1 = fakeNet({ "https://c.example.com/l": () => new Response(latin, { headers: { "content-type": "text/html; charset=iso-8859-1" } }) });
    const r = await fetchPage("https://c.example.com/l", { fetch: l1.f, robotsCache: new Map() });
    expect(r.ok && r.text).toContain("Café");
  });
});

describe("the public endpoint", () => {
  const SITE = "https://paritytrading.app";
  const req = (body: unknown, origin: string | null = SITE, ip = "1.2.3.4") => new Request(`${SITE}/api/verify/claim-url`, {
    method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json", ...(origin ? { origin } : {}), "cf-connecting-ip": ip },
  });
  const net = fakeNet({ "https://shop.example.com/bot": () => html(page("sales-page.html")) });
  const deps = (limiter = new MinuteLimiter()) => ({ fetch: net.f, siteDomain: "paritytrading.app", limiter, robotsCache: new Map(), log: () => {} });

  it("answers our pages with the claims and their words, and the text only when asked", async () => {
    const res = await handleClaimUrl(req({ url: "https://shop.example.com/bot" }), deps());
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const a = await res.json();
    expect(a.claim.winRate).toBe(0.92);
    expect(a.found[0]).toHaveProperty("quote");
    expect(a).not.toHaveProperty("text");
    const withText = await (await handleClaimUrl(req({ url: "https://shop.example.com/bot", with_text: true }), deps())).json();
    expect(withText.text).toContain("AuroraFX");
  });

  it("refuses other sites and calls with no Origin, and limits each address", async () => {
    expect((await handleClaimUrl(req({ url: "https://shop.example.com/bot" }, "https://evil.example.com"), deps())).status).toBe(403);
    expect((await handleClaimUrl(req({ url: "https://shop.example.com/bot" }, null), deps())).status).toBe(403);
    const lim = new MinuteLimiter();
    for (let i = 0; i < PER_ADDRESS; i++) expect((await handleClaimUrl(req({ url: "https://shop.example.com/bot" }), deps(lim))).status).toBe(200);
    const res = await handleClaimUrl(req({ url: "https://shop.example.com/bot" }), deps(lim));
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toMatch(/^\d+$/);
    expect((await handleClaimUrl(req({ url: "https://shop.example.com/bot" }, SITE, "5.6.7.8"), deps(lim))).status).toBe(200);
  });

  it("says why in plain words when it cannot read the page", async () => {
    const res = await handleClaimUrl(req({ url: "http://127.0.0.1/" }), deps());
    expect(res.status).toBe(400);
    expect((await res.json()).detail).toMatch(/IP address/);
  });
});

describe("the person's own model", () => {
  const text = textOf("sales-page.html");
  it("sends at most 24,000 characters and asks for quotes", () => {
    const p = modelPrompt("x".repeat(50_000));
    expect(p.prompt.length).toBeLessThan(25_500);
    expect(p.prompt).toMatch(/exact words/);
  });
  it("keeps only claims whose quote is on the page", () => {
    const answer = 'Here: [{"field":"winRate","value":92,"quote":"has a 92% win rate"},{"field":"totalReturn","value":900,"quote":"+900% in a week"},{"field":"yearlyReturn","value":"55%","quote":"Average monthly return of 9.5%"},{"field":"nonsense","value":1,"quote":"x"}]';
    const r = readModelAnswer(answer, text);
    expect(r.found.map((f) => [f.field, f.value, f.how])).toEqual([["winRate", 0.92, "model"], ["yearlyReturn", 0.55, "model"]]);
    expect(r.dropped).toBe(2);
    // The patterns' own reading wins for a field both found.
    const merged = mergeFound(extractClaims(text), r.found);
    expect(merged.filter((f) => f.field === "winRate").every((f) => f.how === "pattern")).toBe(true);
    expect(merged.some((f) => f.field === "yearlyReturn" && f.how === "model")).toBe(true);
    expect(readModelAnswer("not json", text)).toEqual({ found: [], dropped: 0 });
  });
});

describe("claims against a record", () => {
  // 60 weekdays of trades on a 10,000 account: 40 wins of 40 and 20 losses of 50, so a 66.7% win rate.
  const rows = ["close_time,pnl"];
  for (let i = 0, d = Date.UTC(2025, 0, 6); rows.length <= 60; d += 86_400_000) {
    const day = new Date(d);
    if (day.getUTCDay() === 0 || day.getUTCDay() === 6) continue;
    rows.push(`${day.toISOString().slice(0, 10)},${i++ % 3 === 2 ? -50 : 40}`);
  }
  const found = extractClaims("Live since January 2025. 67% win rate, total return +3% so far, max drawdown 1%, over 60 trades. Profit factor 1.6. 5 pips a day.");
  const r = checkFile({ parsed: parseText(rows.join("\n")), answers: { kind: "real", balance: 10_000, tries: 1, claim: claimFrom(found) }, prices: null });

  it("says for each claim what the record shows and whether they agree", () => {
    const a = claimsAgainst(found, r);
    const by = Object.fromEntries(a.map((x) => [x.field, x]));
    expect(by.winRate).toMatchObject({ status: "agrees", record: "66.7%", decides: true });
    expect(by.trades).toMatchObject({ status: "agrees", record: "60" });
    expect(by.totalReturn.status).toBe("agrees");
    expect(by.profitFactor).toMatchObject({ status: "agrees", record: "1.60" });
    expect(by.startDate).toMatchObject({ status: "agrees", record: "2025-01-06" });
    expect(by.pips.status).toBe("not_compared");
    expect(againstSummary(a)).toMatch(/compared: \d+ agree with the record/);
  });

  it("a total return far from the record changes the verdict (method verify-1.2)", () => {
    const bold = extractClaims("Total return of 340% so far.");
    const r2 = checkFile({ parsed: parseText(rows.join("\n")), answers: { kind: "real", balance: 10_000, tries: 1, claim: claimFrom(bold) }, prices: null });
    expect(r2.verdict.id).toBe("does_not_hold_up");
    expect(r2.verdict.sentence).toMatch(/total return: claimed 340\.0%, file 6\.0%/);
    expect(claimsAgainst(bold, r2)[0]).toMatchObject({ status: "differs", decides: true });
    // A small gap on a large return is within a tenth, so it agrees.
    const near = r2.facts!.totalReturn! * 1.05;
    expect(claimsAgainst([{ ...bold[0], value: near }], r2)[0].status).toBe("agrees");
  });

  it("without a record, says what is needed to check each claim", () => {
    const d = checkDescription({ text: "x", claim: claimFrom(found), settings: null, trades: null });
    const a = claimsAgainst(found, d);
    expect(a.filter((x) => x.status === "needs_record").length).toBeGreaterThanOrEqual(5);
    expect(a.find((x) => x.field === "winRate")!.why).toMatch(/upload the account's trade history/);
    expect(againstSummary(a)).toMatch(/None can be checked without the record/);
  });

  it("keeps one value per field: the label first, then the page's first sentence", () => {
    const f = extractClaims("Our bot: 80% win rate.\nWin rate: 71%");
    expect(chosen(f).get("winRate")!.value).toBe(0.71);
  });
});
