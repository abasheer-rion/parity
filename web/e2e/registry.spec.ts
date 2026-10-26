// The data registry pages (DEC-0064), signed in, with registry rows in the Supabase stand-in:
// the catalog's search and filters, a series page with its chart, lineage, tests and log,
// the candidates queue with its reasons, and the Data health page.
import type { Page } from "@playwright/test";
import { badValues, expect, open, settled, sideways, test } from "./fixtures";
import type { FakeDb } from "./supabase";

const DAY = new Date().toISOString().slice(0, 10);
const base = {
  code: "", symbol: "", region: "US", units: "", start_date: "2000-01-03", end_date: DAY, published_after: null, lag_days: 0,
  labels: { theme: "fx", by: "rule" }, quality: 0.95, origin: "catalog", intended_use: "research", required: false, reason: "",
  discovered_by: "", discovered_at: null, enrolled_at: "2026-10-26T08:00:00Z", health_checked_at: "2026-10-26T09:00:00Z",
  health_detail: { age_hours: 30, cadence_hours: 144 }, last_obs: DAY, backup_id: null, updated_at: "2026-10-26T09:00:00Z",
};

function seed(db: FakeDb) {
  db.seed("data_sources", [
    { id: "fred", name: "FRED, St. Louis Fed", provider: "FRED", access_method: "CSV download", licence: "Free; check each series", display_rights: "public", terms_url: "https://fred.stlouisfed.org/legal/", terms_read_on: "2026-10-22", cost: "free", rate_limit: "120 a minute", status: "on", note: "", updated_at: "" },
    { id: "kraken", name: "Kraken public REST", provider: "Kraken", access_method: "public REST", licence: "Use for your own benefit", display_rights: "internal", terms_url: "https://www.kraken.com/legal/global-terms", terms_read_on: "2026-10-25", cost: "free", rate_limit: "1 a second", status: "team", note: "", updated_at: "" },
    { id: "bis", name: "BIS data portal", provider: "BIS", access_method: "SDMX", licence: "Reuse with the BIS named", display_rights: "public", terms_url: "https://data.bis.org/help/legal", terms_read_on: "2026-10-22", cost: "free", rate_limit: "", status: "on", note: "", updated_at: "" },
  ]);
  db.seed("data_series", [
    { ...base, id: "fx.EUR", source_id: "fred", code: "DEXUSEU", name: "USD per EUR (Fed H.10)", asset_class: "fx", frequency: "D", tags: ["fx", "daily", "g10", "tier1"], status: "live", display_rights: "public", required: true, health: "ok", backup_id: "xfx.EUR" },
    { ...base, id: "rate.GBP", source_id: "fred", code: "IR3TIB01GBM156N", name: "GBP 3-month interbank rate", asset_class: "rates", frequency: "M", published_after: 5, tags: ["rates", "monthly"], status: "degraded", display_rights: "public", health: "stale", health_detail: { age_hours: 7161, cadence_hours: 3048 } },
    { ...base, id: "kraken.XBTUSD", source_id: "kraken", code: "XBTUSD", name: "XBT in US dollars on Kraken, daily close", asset_class: "crypto", frequency: "D", lag_days: 1, tags: ["crypto", "daily", "tier1"], status: "enrolled", display_rights: "internal", origin: "discovered", discovered_by: "kraken", discovered_at: "2026-10-26T08:30:00Z", health: "unknown" },
    { ...base, id: "policy.PH", source_id: "bis", code: "WS_CBPOL/D.PH", name: "PH central bank policy rate, percent (BIS)", asset_class: "rates", frequency: "D", lag_days: 1, tags: ["rates"], status: "live", display_rights: "public", origin: "discovered", discovered_by: "bis", discovered_at: "2026-10-26T08:30:00Z", health: "ok" },
    { ...base, id: "curve.UST_1_5M", source_id: "fred", name: "US Treasury 1.5 Month par yield", asset_class: "rates", frequency: "D", tags: ["rates"], status: "candidate", display_rights: "public", origin: "discovered", discovered_by: "treasury", discovered_at: "2026-10-26T08:30:00Z", reason: "history: 422 values, at least 500 needed", health: "unknown", quality: null },
  ]);
  db.seed("data_lineage", [{ series_id: "policy.PH", kind: "search", consumer: "strategy search: signal" }]);
  db.seed("data_series_preview", [{ series_id: "policy.PH", points: [["2024-01-05", 6.5], ["2025-01-03", 5.75], ["2026-01-02", 5.5]] }]);
  db.seed("data_backtests", [{ series_id: "policy.PH", ran_at: "2026-10-26T09:00:00Z", trials: 4, battery: { tests: [{ test: "stocks while below 1y average", name: "x", sharpe: 0.41, cagr: 0.05, max_dd: -0.3, years: 20, beats_market: 0, error: null }], correlations: { "US stocks": 0.01 }, new_trials: 4, search_trials: 130470, note: "Each test is a trial in the strategy search and counts in its luck check." } }]);
  db.seed("data_events", [
    { id: 2, at: "2026-10-26T09:00:00Z", series_id: "policy.PH", source_id: "bis", kind: "backtest", from_state: null, to_state: null, detail: { tests: 4, new_trials: 4 } },
    { id: 1, at: "2026-10-26T08:40:00Z", series_id: "policy.PH", source_id: "bis", kind: "enrolled", from_state: "candidate", to_state: "enrolled", detail: { quality: 0.95 } },
  ]);
  db.seed("data_uptime", [
    { scope: "source", id: "fred", day: DAY, checks: 10, ok: 9, late: 0, stale: 1, down: 0 },
    { scope: "series", id: "policy.PH", day: DAY, checks: 10, ok: 10, late: 0, stale: 0, down: 0 },
  ]);
}

async function ready(page: Page, db: FakeDb, path: string) {
  seed(db);
  await open(page, path);
  await settled(page);
}

test("the catalog lists every series and filters them", async ({ page, db }) => {
  await ready(page, db, "/research/#/registry");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Data catalog");
  await expect(page.getByRole("main")).toContainText("5 of 5 series");
  await page.getByRole("searchbox", { name: "Search series, codes and tags" }).fill("xbt");
  await expect(page.getByRole("main")).toContainText("1 of 5 series");
  await page.getByRole("searchbox", { name: "Search series, codes and tags" }).fill("");
  await page.getByRole("combobox", { name: "Display rights" }).selectOption("internal");
  await expect(page.getByRole("main")).toContainText("1 of 5 series");
  expect(await badValues(page)).toEqual([]);
  expect(await sideways(page)).toBeLessThanOrEqual(1);
});

test("a series page shows its chart, lineage, tests, licence and log", async ({ page, db }) => {
  await ready(page, db, "/research/#/registry/s/policy.PH");
  const main = page.getByRole("main");
  await expect(main).toContainText("PH central bank policy rate");
  await expect(main).toContainText("strategy search: signal");
  await expect(main).toContainText("stocks while below 1y average");
  await expect(main).toContainText("Reuse with the BIS named");
  await expect(main).toContainText("tested on arrival: 4 tests, 4 new trials");
  await expect(main.locator("svg").first()).toBeVisible();
  expect(await badValues(page)).toEqual([]);
});

test("team-only data shows no chart to someone off the team", async ({ page, db }) => {
  await ready(page, db, "/research/#/registry/s/kraken.XBTUSD");
  await expect(page.getByRole("main")).toContainText("Team-only data: the chart shows for team members.");
});

test("the candidates queue says why each waits", async ({ page, db }) => {
  await ready(page, db, "/research/#/registry/candidates");
  const main = page.getByRole("main");
  await expect(main).toContainText("curve.UST_1_5M");
  await expect(main).toContainText("history: 422 values, at least 500 needed");
  await expect(main).not.toContainText("fx.EUR");
  expect(await sideways(page)).toBeLessThanOrEqual(1);
});

test("data health lists sources, feeds and the series in trouble", async ({ page, db }) => {
  await ready(page, db, "/research/#/registry/health");
  const main = page.getByRole("main");
  await expect(main).toContainText("Series that need attention");
  await expect(main).toContainText("rate.GBP");
  await expect(main).toContainText("90.0%");
  expect(await badValues(page)).toEqual([]);
  expect(await sideways(page)).toBeLessThanOrEqual(1);
});
