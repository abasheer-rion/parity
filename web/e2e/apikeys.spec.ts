// Settings > API keys (DEC-0071), signed in, with key rows in the Supabase stand-in and the
// key server (/api/keys) stubbed: the list with each key's state, making a key that is shown
// once, and revoking one. No real key is made: the stub answers with a made-up key.
import { expect, open, settled, test } from "./fixtures";

const LATER = new Date(Date.now() + 60 * 86_400_000).toISOString();
const SOON = new Date(Date.now() + 3 * 86_400_000).toISOString();
const FAKE_KEY = "pk_test_" + "A".repeat(43) + "000000";

const rows = [
  { id: "00000000-0000-4000-8000-0000000000a1", user_id: "u", name: "build server", prefix: "pk_test_", last4: "Xy12", scopes: ["read:markets", "read:strategies"], ip_allowlist: ["203.0.113.0/24"], created_at: "2026-10-20T10:00:00Z", expires_at: LATER, last_used_at: "2026-10-25T10:00:00Z", revoked_at: null, revoked_reason: null },
  { id: "00000000-0000-4000-8000-0000000000a2", user_id: "u", name: "old laptop", prefix: "pk_test_", last4: "Qq77", scopes: ["write:verify"], ip_allowlist: [], created_at: "2026-09-01T10:00:00Z", expires_at: SOON, last_used_at: null, revoked_at: null, revoked_reason: null },
  { id: "00000000-0000-4000-8000-0000000000a3", user_id: "u", name: "pasted in a gist", prefix: "pk_test_", last4: "Lk00", scopes: ["read:markets"], ip_allowlist: [], created_at: "2026-09-01T10:00:00Z", expires_at: LATER, last_used_at: null, revoked_at: "2026-10-01T10:00:00Z", revoked_reason: "leaked" },
];

test("the keys page lists keys, makes a key shown once, and revokes", async ({ page, db }) => {
  db.seed("api_keys", rows);
  db.seed("api_key_events", [{ id: 1, key_id: rows[2].id, user_id: "u", event: "leaked", at: "2026-10-01T10:00:00Z" }]);
  db.seed("api_key_usage", [{ key_id: rows[0].id, user_id: "u", day: new Date().toISOString().slice(0, 10), requests: 42, errors: 1 }]);
  let sent: Record<string, unknown> | null = null;
  await page.route("**/api/keys", async (route) => {
    sent = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ id: "00000000-0000-4000-8000-0000000000b1", key: FAKE_KEY, expires_at: LATER }) });
  });

  await open(page, "/app/#/settings/api-keys");
  await settled(page);
  const main = page.getByRole("main");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("API keys");
  const list = page.getByRole("list", { name: "Your API keys" });
  await expect(list).toContainText("build server");
  await expect(list).toContainText("pk_test_...Xy12");
  await expect(list).toContainText("only from 203.0.113.0/24");
  await expect(list).toContainText("today 42 requests, 1 errors");
  await expect(list).toContainText("Expires soon");
  await expect(list).toContainText("Revoked, leaked");
  await expect(main).toContainText("pasted in a gist · leaked");

  await page.getByRole("button", { name: "Make a key" }).click();
  await page.getByRole("textbox", { name: "Name" }).fill("ci job");
  await page.getByRole("button", { name: "Make key" }).click();
  await expect(page.getByTestId("api-secret")).toHaveText(FAKE_KEY);
  expect(sent).toMatchObject({ name: "ci job", scopes: ["read:strategies", "read:markets"], days: 90 });
  await page.getByRole("button", { name: "I saved it" }).click();
  await expect(page.getByTestId("api-secret")).toHaveCount(0);

  page.once("dialog", (d) => void d.accept());
  await list.getByRole("button", { name: "Revoke" }).first().click();
  await expect.poll(() => db.calls.some((c) => c.table === "rpc/api_key_revoke")).toBe(true);
});
