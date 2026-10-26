// Latency tracking (DEC-0045): the browser beacon stays small and anonymous, the /rum
// function drops anything unexpected and limits each address, and the latency page reads
// ages, statuses and percentiles the same way as the engine and the database.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { _queued, _reset, endpointOf, onResource, optedOut, payload, rumAge, rumRefresh, type RumEvent } from "../src/lib/rum";
import { addBins, binMid, binOf, bySource, dur, healthExtras, percentile, status, type FreshRow, type StepRow } from "../src/lib/latency";
import { allow, clean, onRequest, PER_MINUTE } from "../functions/rum";

const NOW = Date.parse("2026-10-25T12:00:00Z");
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString();

const row = (over: Partial<FreshRow>): FreshRow => ({
  source: "fred", series: "fx.EUR", label: "", kind: "prices", basis: "source", cadence_hours: 24,
  source_at: hoursAgo(1), fetched_at: hoursAgo(1), published_at: null, ok: true, reported_at: hoursAgo(0), ...over,
});

describe("the beacon", () => {
  beforeEach(() => _reset());

  it("keeps only data requests, as path patterns without ids", () => {
    const here = "https://parity.endyland.com/trade/";
    expect(endpointOf("/data/terminal/index.json", here)).toBe("/data/terminal/index.json");
    expect(endpointOf("/data/terminal/fx.EUR.json", here)).toBe("/data/terminal/:id.json");
    expect(endpointOf("/data/batch/7f3c2a91-1111.json", here)).toBe("/data/batch/:id.json");
    expect(endpointOf("/data/news/archive/2024.json?x=1", here)).toBe("/data/news/archive/:id.json");
    expect(endpointOf("/local/search.json", here)).toBe("/data/search.json");
    expect(endpointOf("https://ttqvpxvctnomfbeoqbbs.supabase.co/rest/v1/service_heartbeats?select=*", here)).toBe("db:service_heartbeats");
    expect(endpointOf("https://ttqvpxvctnomfbeoqbbs.supabase.co/rest/v1/rpc/verify_badge_public", here)).toBe("db:rpc/verify_badge_public");
    expect(endpointOf("https://ttqvpxvctnomfbeoqbbs.supabase.co/auth/v1/token", here)).toBe("db:auth");
    expect(endpointOf("/assets/index-abc.js", here)).toBeNull();
    expect(endpointOf("https://fonts.googleapis.com/css2", here)).toBeNull();
  });

  it("is off when the browser asks not to be tracked", () => {
    expect(optedOut({ doNotTrack: "1" }, {})).toBe(true);
    expect(optedOut({ globalPrivacyControl: true }, {})).toBe(true);
    expect(optedOut({}, { doNotTrack: "1" })).toBe(true);
    expect(optedOut({ doNotTrack: "0" }, {})).toBe(false);
  });

  it("records nothing until sampled in", () => {
    rumAge("terminal/index", "2026-10-23");
    onResource({ name: "https://parity.endyland.com/data/latest.json", responseEnd: 300, duration: 120, encodedBodySize: 5000, transferSize: 5300 });
    expect(_queued()).toEqual([]);
  });

  it("notes time to first data once, each request, its size and cache hits", () => {
    _reset("trade");
    const r = (name: string, end: number, enc: number, tx: number) => ({ name: `https://parity.endyland.com${name}`, responseEnd: end, duration: 80, encodedBodySize: enc, transferSize: tx });
    onResource(r("/assets/app.js", 100, 9000, 9300));
    onResource(r("/data/terminal/index.json", 420, 40_000, 40_300));
    onResource(r("/data/terminal/fx.EUR.json", 600, 8000, 300));
    const q = _queued();
    expect(q.filter((e) => e.m === "ttd")).toEqual([{ m: "ttd", v: 420 }]);
    expect(q.filter((e) => e.m === "fetch").map((e) => [e.e, e.h])).toEqual([["/data/terminal/index.json", undefined], ["/data/terminal/:id.json", 1]]);
    expect(q.find((e) => e.m === "bytes")?.v).toBe(40_000);
  });

  it("caps requests per endpoint and the whole payload", () => {
    _reset("sim");
    for (let i = 0; i < 20; i++) onResource({ name: `https://parity.endyland.com/data/terminal/s${i}.json`, responseEnd: 10, duration: 5, encodedBodySize: 0, transferSize: 0 });
    expect(_queued().filter((e) => e.m === "fetch")).toHaveLength(3);
    const many: RumEvent[] = Array.from({ length: 70 }, (_, i) => ({ m: "fetch", e: "/data/x.json", v: i }));
    const body = payload("sim", [...many, { m: "ttd", v: 5 }]);
    const doc = JSON.parse(body) as { a: string; ev: RumEvent[] };
    expect(doc.ev).toHaveLength(40);
    expect(doc.ev[0].m).toBe("ttd");
    expect(body.length).toBeLessThan(2000);
    expect(body).not.toMatch(/parity\.endyland|user|cookie|token/i);
  });

  it("measures the age of what is shown and how late refreshes run", () => {
    _reset("product");
    rumAge("News/latest.json", hoursAgo(2), NOW);
    expect(_queued()).toEqual([{ m: "age", e: "news/latest.json", v: 7200 }]);
    _reset("trade");
    let t = 0;
    vi.spyOn(performance, "now").mockImplementation(() => t);
    const tick = rumRefresh("trade/alerts", 1000, true);
    tick();
    t = 1500;
    tick();
    expect(_queued()).toEqual([{ m: "lag", e: "trade/alerts", v: 500 }, { m: "gap", e: "trade/alerts", v: 1500 }]);
  });
});

describe("the /rum function", () => {
  it("keeps only known apps, metrics and clean endpoints", () => {
    const body = JSON.stringify({ a: "trade", ev: [
      { m: "ttd", v: 420 }, { m: "fetch", e: "/data/x.json", v: 80, h: 1 }, { m: "nope", v: 1 },
      { m: "fetch", e: "/Data/With Space", v: 1 }, { m: "lcp", v: -5 }, { m: "inp", v: "9" }, { m: "age", v: 1e12 },
    ] });
    expect(clean(body, "NA")).toEqual({ app: "trade", region: "NA", events: [{ m: "ttd", e: "", v: 420 }, { m: "fetch", e: "/data/x.json", v: 80, h: 1 }] });
    expect(clean(body, "north america")?.region).toBe("XX");
    expect(clean(JSON.stringify({ a: "evil", ev: [{ m: "ttd", v: 1 }] }))).toBeNull();
    expect(clean("not json")).toBeNull();
    expect(clean("x".repeat(7000))).toBeNull();
  });

  it("limits each address per minute", () => {
    for (let i = 0; i < PER_MINUTE; i++) expect(allow("1.2.3.4", NOW)).toBe(true);
    expect(allow("1.2.3.4", NOW)).toBe(false);
    expect(allow("1.2.3.4", NOW + 61_000)).toBe(true);
    expect(allow("5.6.7.8", NOW)).toBe(true);
  });

  it("answers 204 and hands only the clean events to the database", async () => {
    const fetcher = vi.fn(async () => new Response("1"));
    const waits: Promise<unknown>[] = [];
    const request = Object.assign(new Request("https://parity.endyland.com/rum", {
      method: "POST", body: JSON.stringify({ a: "site", ev: [{ m: "lcp", v: 900 }] }),
      headers: { "CF-Connecting-IP": "9.9.9.9", Cookie: "secret=1", "User-Agent": "UA" },
    }), { cf: { continent: "EU" } });
    const res = await onRequest({ request, waitUntil: (p) => waits.push(p) }, fetcher as unknown as typeof fetch);
    await Promise.all(waits);
    expect(res.status).toBe(204);
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/\/rest\/v1\/rpc\/rum_ingest$/);
    expect(JSON.parse(init.body as string)).toEqual({ p_app: "site", p_region: "EU", p_events: [{ m: "lcp", e: "", v: 900 }] });
    expect(String(init.body)).not.toMatch(/9\.9\.9\.9|secret|UA/);
    const get = await onRequest({ request: new Request("https://parity.endyland.com/rum"), waitUntil: () => {} }, fetcher as unknown as typeof fetch);
    expect(get.status).toBe(405);
  });
});

describe("the latency page", () => {
  it("judges each row against its cadence and basis", () => {
    expect(status(row({ source_at: hoursAgo(20) }), NOW)).toBe("ok");
    expect(status(row({ source_at: hoursAgo(30) }), NOW)).toBe("late");
    expect(status(row({ source_at: hoursAgo(50) }), NOW)).toBe("stale");
    expect(status(row({ ok: false }), NOW)).toBe("stale");
    const quietFeed = row({ kind: "news", basis: "fetch", cadence_hours: 1.5, source_at: hoursAgo(200), fetched_at: hoursAgo(0.5) });
    expect(status(quietFeed, NOW)).toBe("ok");
    expect(status(row({ basis: "fetch", fetched_at: null }), NOW)).toBe("unknown");
  });

  it("puts the worst source first and names its worst series", () => {
    const groups = bySource([
      row({ series: "a" }), row({ series: "b", source_at: hoursAgo(60) }),
      row({ source: "ecb", series: "c" }),
    ], NOW);
    expect(groups.map((g) => [g.source, g.status, g.worst?.series])).toEqual([["fred", "stale", "b"], ["ecb", "ok", "c"]]);
  });

  it("bins like the database and reads percentiles back within a bin", () => {
    expect([0.5, 1, 9.99, 10, 120, 1e9].map(binOf)).toEqual([0, 1, 8, 9, 17, 63]);
    let bins: number[] = [];
    for (let v = 1; v <= 1000; v++) { const b = new Array(64).fill(0); b[binOf(v)] = 1; bins = addBins(bins, b); }
    const p50 = percentile(bins, 0.5)!, p95 = percentile(bins, 0.95)!;
    expect(Math.abs(p50 / 500 - 1)).toBeLessThan(0.16);
    expect(Math.abs(p95 / 950 - 1)).toBeLessThan(0.16);
    expect(percentile(new Array(64).fill(0), 0.5)).toBeNull();
    expect(binMid(0)).toBe(0.5);
  });

  it("adds data age and refresh lag to the health line", () => {
    const steps: StepRow[] = [{ pipeline: "gha:news", run_key: "1", step: "_queue", started_at: hoursAgo(2), finished_at: hoursAgo(1.6), seconds: 1440, ok: true, detail: {} }];
    const extras = healthExtras([
      row({ kind: "news", series: "fed", fetched_at: hoursAgo(0.75) }),
      row({ series: "curve.UST_10Y", source_at: hoursAgo(50) }),
    ], steps, NOW);
    expect(extras).toEqual([{ text: "data age: news 45 min, prices 2 days", stale: false }, { text: "refresh lag: 24 min", stale: false }]);
    expect(healthExtras([], [], NOW)).toEqual([]);
  });

  it("writes durations plainly", () => {
    expect([0.25, 4.2, 75, 1500, 12_000, 400_000, null].map(dur)).toEqual(["250 ms", "4.2 s", "75 s", "25 min", "3.3 h", "5 days", "n/a"]);
  });
});
