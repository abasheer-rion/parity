// What the suite serves at /data/ (the research files behind sign-in), /live/, /rum and /e.
// Real-shaped fixtures where a page needs them; the rest answer 404 the way a deploy that has
// not published them yet would, so the pages' "not published yet" states are covered too.
// Tests can make a file fail, hang or come late to check loading, error and Retry states.
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Route } from "@playwright/test";

const web = (p: string) => resolve(import.meta.dirname, "..", p);

const FILES: Record<string, string> = {
  "/data/latest.json": web("tests/fixtures/smoke/latest.json"),
  "/data/search.json": web("tests/fixtures/smoke/search.json"),
};
const INLINE: Record<string, unknown> = {
  // The front page's counters (scripts/export_site_data.py writes it at deploy).
  "/stats.json": { generated_at: "2026-10-23T22:00:00Z", strategies_tested: 8, strategies_beat_market: 1, variations_searched: 1200, search_passed_luck: 3 },
  "/data/batches.json": [],
  "/data/members.json": [],
};

type Override = { status?: number; abort?: boolean; delay?: number; hang?: boolean; body?: unknown };

export class DataStub {
  private overrides: { prefix: string; o: Override }[] = [];
  private missing = new Set<string>();
  /** Every /data/ path asked for, in order. */
  asked: string[] = [];

  /** Answer paths starting with prefix with this status (or a network failure with abort). */
  fail(prefix: string, status = 500) { this.overrides.unshift({ prefix, o: { status } }); }
  abort(prefix: string) { this.overrides.unshift({ prefix, o: { abort: true } }); }
  delay(prefix: string, ms: number) { this.overrides.unshift({ prefix, o: { delay: ms } }); }
  hang(prefix: string) { this.overrides.unshift({ prefix, o: { hang: true } }); }
  serve(prefix: string, body: unknown) { this.overrides.unshift({ prefix, o: { body } }); }
  /** Back to the normal answers. */
  reset() { this.overrides = []; }

  /** True when the stub answered this address with a 404 or an error on purpose. */
  leftOut(url: string): boolean {
    try { return this.missing.has(new URL(url).pathname); } catch { return false; }
  }

  async handle(route: Route) {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (path === "/rum" || path === "/e") return route.fulfill({ status: 204, body: "" });
    this.asked.push(path);
    if (path === "/stats.json") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(INLINE[path]) });
    const o = this.overrides.find((x) => path.startsWith(x.prefix))?.o;
    if (o?.hang) return; // never answered: the loading state stays up
    if (o?.delay) await new Promise((ok) => setTimeout(ok, o.delay));
    if (o?.abort) { this.missing.add(path); return route.abort("internetdisconnected"); }
    if (o?.status) { this.missing.add(path); return route.fulfill({ status: o.status, contentType: "text/plain", body: "stubbed failure" }); }
    if (o?.body !== undefined) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(o.body) });
    if (path in INLINE) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(INLINE[path]) });
    let file = FILES[path];
    if (!file && path.startsWith("/data/terminal/")) {
      const p = resolve(import.meta.dirname, "data/terminal", path.slice("/data/terminal/".length));
      if (p.startsWith(resolve(import.meta.dirname, "data/terminal")) && existsSync(p)) file = p;
    }
    if (file) return route.fulfill({ status: 200, contentType: "application/json", body: readFileSync(file) });
    this.missing.add(path);
    return route.fulfill({ status: 404, contentType: "text/plain", body: "Not published" });
  }
}
