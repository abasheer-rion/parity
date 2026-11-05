// Read from your broker (DEC-0091), end to end on the built site with the switch on (the E2E
// build sets VITE_VERIFY_CONNECTIONS=on, as pull request previews do). /api/connect is the real
// server code (src/lib/connect/server.ts) running in this test process, with every venue
// answered from tests/fixtures/connect and a made-up signing key: no credential is real and
// nothing leaves the machine. Covers reading with a read-only key, refusing a key that can
// trade, publishing a broker-connected badge, how the badge page judges a proof, the kept
// connections in Settings, and the signed-out view.
import AxeBuilder from "@axe-core/playwright";
import type { Page, Route } from "@playwright/test";
import { handleConnect, type ConnectEnv } from "../src/lib/connect/server";
import { memoryConnectStore } from "../src/lib/connect/store";
import { sha256Hex } from "../src/lib/connect/bytes";
import { fx, json, KRAKEN_DOC_SECRET, recorded, testSecret } from "../tests/connect/helpers";
import { expect, open, settled, test } from "./fixtures";
import { SUPABASE } from "./config";
import { USER } from "./supabase";

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa"];
const axe = async (page: Page, include: string) => {
  const r = await new AxeBuilder({ page }).include(include).withTags(TAGS).analyze();
  return r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
};

const ENV: ConnectEnv = { BROKER_RECORD_SIGNING_KEY: testSecret(1), BROKER_CREDENTIAL_KEY: testSecret(2) };
const KRAKEN_KEY = "E2E" + "K".repeat(53);

function kraken(info = "kraken-keyinfo-read.json") {
  return recorded([
    [/GetApiKeyInfo/, json(fx(info))],
    [/AssetPairs/, json(fx("kraken-assetpairs.json"))],
    [/TradesHistory/, json(fx("kraken-trades.json"))],
  ]);
}

/** Serves /api/connect from the real handler; returns what the page sent and what the venue saw. */
async function connectApi(page: Page, venue = kraken()) {
  const mem = memoryConnectStore();
  const sent: Record<string, unknown>[] = [];
  await page.route("**/api/connect/**", async (route: Route) => {
    const req = route.request();
    const body = req.postData();
    if (body) sent.push(JSON.parse(body) as Record<string, unknown>);
    const res = await handleConnect(new Request(req.url(), { method: req.method(), headers: req.headers(), body: body ?? undefined }), {
      env: ENV, buildFlag: async () => true, store: mem.store, venueFetch: venue.fetch, prices: async () => null, siteDomain: "paritytrading.app",
      verify: async (token) => ({ userId: USER.id, email: USER.email, clientId: null, token }),
      now: () => Date.parse("2026-02-03T12:00:00Z"), sleep: async () => undefined,
    });
    await route.fulfill({ status: res.status, headers: Object.fromEntries(res.headers), body: Buffer.from(await res.arrayBuffer()) });
  });
  return { sent, venue, mem };
}

async function readKraken(page: Page) {
  await open(page, "/verify/");
  await settled(page);
  await page.getByRole("radio", { name: "Read from your broker" }).click();
  await page.getByRole("radiogroup", { name: "Where are your trades?" }).getByRole("radio", { name: "Kraken" }).click();
  await page.getByRole("textbox", { name: "API key" }).fill(KRAKEN_KEY);
  await page.getByLabel("Private key", { exact: true }).fill(KRAKEN_DOC_SECRET);
  await page.getByLabel("From", { exact: true }).fill("2026-01-01");
  await page.getByLabel("To", { exact: true }).fill("2026-01-31");
  await page.getByRole("spinbutton", { name: /How many strategies/ }).fill("3");
  await page.getByRole("button", { name: "Read trades and check" }).click();
}

test("reads Kraken with a read-only key, clears the key from the page, and publishes a broker-connected badge", async ({ page, db }) => {
  const api = await connectApi(page);
  await readKraken(page);
  const source = page.getByTestId("connected-source");
  await expect(source).toContainText("Parity read these trades from Kraken itself");
  await expect(source).toContainText("It is a live account, so this is real money");
  await expect(source).toContainText("Used for this read and dropped.");
  await expect(source.getByText(/^acct_/)).toBeVisible();
  await expect(page.locator("#vf-verdict")).toHaveText("Not enough data");
  // WCAG 2.2 AA on the form and the result.
  expect(await axe(page, ".vp-tool")).toEqual([]);
  // The key went to our server once and is gone from the form.
  const fetchBody = api.sent.find((b) => b.venue === "kraken")!;
  expect(fetchBody.credentials).toEqual({ apiKey: KRAKEN_KEY, secret: KRAKEN_DOC_SECRET });
  await expect(page.getByRole("textbox", { name: "API key" })).toHaveValue("");
  expect(api.venue.seen.some((s) => s.url.includes("GetApiKeyInfo"))).toBe(true);

  await page.getByRole("textbox", { name: /Name for the record/ }).fill("Kraken swing trades");
  await page.getByRole("button", { name: "Publish badge" }).click();
  await expect(page.getByAltText(/Broker-connected record from Kraken/)).toBeVisible();
  await expect(page.getByText("Broker-connected: Parity read these trades from Kraken itself, through a read-only link.")).toBeVisible();
  const row = db.rows("verify_badges")[0];
  expect(String(row.attestation)).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/);
  expect(row.input_kind).toBe("real");
  expect(row.stated_tries).toBe(3);
  const csv = await page.getByRole("link", { name: "Download the trades Parity read" }).getAttribute("href");
  expect(csv).toMatch(/^blob:/);
  expect(JSON.stringify(row)).not.toContain(KRAKEN_KEY);
  expect(JSON.stringify(row)).not.toContain(KRAKEN_DOC_SECRET);
});

test.describe("a key that can do more than read", () => {
  // The refusal is a 403 from our server, which the browser logs; that is the point here.
  test.use({ allowHttp: [/^403 .*\/api\/connect\/fetch$/], expectConsole: [/status of 403/] });

  test("refuses a key that can trade or withdraw, before reading any trade", async ({ page }) => {
    const api = await connectApi(page, kraken("kraken-keyinfo-trade.json"));
    await readKraken(page);
    await expect(page.getByRole("alert")).toHaveText("This Kraken key can place and change orders, withdraw money. Parity only takes keys that can read and nothing else. Make a new key with read access only and try again. We did not keep the key you sent.");
    expect(api.venue.seen.some((s) => s.url.includes("TradesHistory"))).toBe(false);
    await expect(page.getByTestId("connected-source")).toHaveCount(0);
  });
});

test.describe("a badge's trust is checked against the published key", () => {
  async function badgeFrom(page: Page) {
    // A real answer from the server, as the page would publish it.
    const api = await connectApi(page);
    const res = await handleConnect(new Request("https://paritytrading.app/api/connect/fetch", {
      method: "POST", headers: { Origin: "https://paritytrading.app", Authorization: "Bearer e2e", "Content-Type": "application/json" },
      body: JSON.stringify({ venue: "kraken", credentials: { apiKey: KRAKEN_KEY, secret: KRAKEN_DOC_SECRET }, from: "2026-01-01", to: "2026-01-31", tries: 3 }),
    }), {
      env: ENV, buildFlag: async () => true, store: api.mem.store, venueFetch: api.venue.fetch, prices: async () => null, siteDomain: "paritytrading.app",
      verify: async (token) => ({ userId: USER.id, email: USER.email, clientId: null, token }), now: () => Date.parse("2026-02-03T12:00:00Z"), sleep: async () => undefined,
    });
    const out = await res.json() as { record: { result: Record<string, unknown> & { verdict: { id: string }; card3: { survives: number } | null }; cards: unknown; attestation: string; csv: string }; source: { account: string; fetchedAt: string } };
    const r = out.record.result;
    return {
      id: "Br0kerC0nn3c", created_at: "2026-02-03T12:05:00Z", withdrawn_at: null, name: "Kraken swing trades", input_kind: r.kind, stated_tries: r.tries,
      date_from: r.dateFrom, date_to: r.dateTo, trade_count: r.trades, verdict: r.verdict.id, survives_tries: r.card3?.survives ?? null, cards: out.record.cards,
      method_version: r.methodVersion, file_sha256: await sha256Hex(out.record.csv), attestation: out.record.attestation,
      broker_venue: "kraken", broker_account: out.source.account, broker_fetched_at: out.source.fetchedAt,
    };
  }
  const serve = (page: Page, row: Record<string, unknown>) => page.route(`${SUPABASE}/rest/v1/rpc/verify_badge_public`, (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([row]) }));

  test.use({ signedIn: false });

  test("a matching proof shows broker-connected, with the venue and the account code", async ({ page }) => {
    const row = await badgeFrom(page);
    await serve(page, row);
    await open(page, `/v/${row.id}`);
    await expect(page.getByTestId("trust-level")).toHaveText("Broker-connected. Real money, as Kraken reports it");
    await expect(page.getByText(String(row.broker_account)).first()).toBeVisible();
    await expect(page.getByText(/stated by the owner: a broker shows what was traded/)).toBeVisible();
    expect(await axe(page, "main")).toEqual([]);
  });

  test("a proof whose numbers were changed is shown as self-reported, and says why", async ({ page }) => {
    const row = await badgeFrom(page);
    await serve(page, { ...row, verdict: "holds_up" });
    await open(page, `/v/${row.id}`);
    await expect(page.getByTestId("proof-mismatch")).toBeVisible();
    await expect(page.getByTestId("trust-level")).toHaveText(/^Self-reported\./);
  });

  test("a withdrawn broker-connected badge still names the venue and the account", async ({ page }) => {
    const row = await badgeFrom(page);
    await serve(page, { ...row, withdrawn_at: "2026-02-10T09:00:00Z", name: null, verdict: null, cards: null, attestation: null, input_kind: null, stated_tries: null, trade_count: null, survives_tries: null, method_version: null, file_sha256: null, date_from: null, date_to: null });
    await open(page, `/v/${row.id}`);
    await expect(page.getByTestId("withdrawn-source")).toContainText("Parity read its trades from Kraken");
    await expect(page.getByTestId("withdrawn-source")).toContainText(String(row.broker_account));
  });

  test("signed out, the broker tab asks to log in", async ({ page }) => {
    await open(page, "/verify/");
    await settled(page);
    await page.getByRole("radio", { name: "Read from your broker" }).click();
    await expect(page.getByRole("link", { name: "Log in to connect" })).toHaveAttribute("href", "/login/?next=%2Fverify%2F");
  });
});

test("Settings lists kept connections and the log, and revokes", async ({ page, db }) => {
  db.seed("broker_connections", [
    { id: "a1111111-1111-4111-8111-111111111111", user_id: USER.id, venue: "kraken", env: "live", label: "Main Kraken", account_code: "acct_AbCdEfGhIjKlMnOp", created_at: "2026-02-01T10:00:00Z", last_synced_at: "2026-02-03T12:00:00Z", last_result: "2 trades, 2026-01-01 to 2026-01-31", revoked_at: null },
    { id: "a2222222-2222-4222-8222-222222222222", user_id: USER.id, venue: "bybit", env: "live", label: "Old Bybit", account_code: "acct_ZyXwVuTsRqPoNmLk", created_at: "2026-01-01T10:00:00Z", last_synced_at: null, last_result: null, revoked_at: "2026-01-15T10:00:00Z" },
  ]);
  db.seed("broker_events", [
    { id: 3, user_id: USER.id, connection_id: "a1111111-1111-4111-8111-111111111111", venue: "kraken", event: "synced", detail: "2 trades, 2026-01-01 to 2026-01-31", at: "2026-02-03T12:00:00Z" },
    { id: 2, user_id: USER.id, connection_id: null, venue: "coinbase", event: "refused", detail: "This Coinbase key can trade.", at: "2026-02-02T12:00:00Z" },
  ]);
  await open(page, "/app/#/settings/broker-connections");
  await settled(page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Broker connections");
  const list = page.getByRole("list", { name: "Your broker connections" });
  await expect(list).toContainText("Main Kraken");
  await expect(list).toContainText("acct_AbCdEfGhIjKlMnOp");
  await expect(list).toContainText("Revoked");
  const log = page.getByRole("list", { name: "Broker log" });
  await expect(log).toContainText("Kraken (Main Kraken) · read again: 2 trades");
  await expect(log).toContainText("Coinbase · key refused (it could do more than read)");
  expect(await axe(page, "[data-testid=broker-connections]")).toEqual([]);
  page.once("dialog", (d) => void d.accept());
  await list.getByRole("button", { name: "Revoke" }).click();
  await expect.poll(() => db.calls.some((c) => c.table === "rpc/broker_connection_revoke")).toBe(true);
});
