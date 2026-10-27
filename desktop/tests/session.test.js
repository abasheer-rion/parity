// Staying signed in (electron/session.js, DEC-0072): reading who is signed in from the
// website's session cookie, and moving the cookie's expiry out to 400 days at launch.
const test = require("node:test");
const assert = require("node:assert");
const { readSession, savedUser, extended, LONG_DAYS } = require("../electron/session");

const DAY = 86400;
const NOW = 1_800_000_000;
const session = { access_token: "a.b.c", refresh_token: "r1", expires_at: NOW + 3600, user: { id: "u-1", email: "a@example.com" } };
const encoded = "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url");
const cookie = (name, value, extra = {}) => ({ name, value, domain: ".paritytrading.app", path: "/", secure: true, httpOnly: false, sameSite: "lax", hostOnly: false, session: false, expirationDate: NOW + 20 * DAY, ...extra });

test("reads a whole or split session cookie", () => {
  assert.deepStrictEqual(readSession([cookie("sb-abc-auth-token", encoded)]), session);
  const half = Math.floor(encoded.length / 2);
  const split = [cookie("sb-abc-auth-token.1", encoded.slice(half)), cookie("sb-abc-auth-token.0", encoded.slice(0, half)), cookie("other", "x")];
  assert.deepStrictEqual(readSession(split), session);
  assert.strictEqual(readSession([cookie("sb-abc-auth-token", "base64-!!!")]), null);
  assert.strictEqual(readSession([]), null);
});

test("names the person for the offline copy, never a token", () => {
  const u = savedUser([cookie("sb-abc-auth-token", encoded)]);
  assert.deepStrictEqual(u, { id: "u-1", email: "a@example.com" });
  assert.ok(!JSON.stringify(u).includes("r1"));
  assert.strictEqual(savedUser([]), null);
});

test("moves a near expiry out to 400 days, and leaves the rest alone", () => {
  const next = extended(cookie("sb-abc-auth-token.0", "v"), NOW);
  assert.strictEqual(next.expirationDate, NOW + LONG_DAYS * DAY);
  assert.strictEqual(next.url, "https://paritytrading.app/");
  assert.strictEqual(next.domain, ".paritytrading.app");
  assert.strictEqual(next.value, "v");
  assert.strictEqual(extended(cookie("sb-abc-auth-token", "v", { expirationDate: NOW + 350 * DAY }), NOW), null);
  assert.strictEqual(extended(cookie("sb-abc-auth-token", "v", { expirationDate: NOW - 1 }), NOW), null);
  assert.strictEqual(extended(cookie("theme", "v"), NOW), null);
  assert.strictEqual(extended(cookie("sb-abc-auth-token", "v", { session: true, expirationDate: undefined }), NOW), null);
  assert.strictEqual(extended(cookie("sb-abc-auth-token", "v", { hostOnly: true, domain: "paritytrading.app" }), NOW).domain, undefined);
});
