// @vitest-environment node
// /api/trade (DEC-0046): status is public and never live without every gate; everything else
// needs a sign-in. No network: no token is sent, so nothing is verified remotely.
import { describe, expect, it } from "vitest";
import { onRequest } from "../../functions/api/trade/[[path]]";
import type { TradingEnv } from "../../src/lib/trading/mode";

const call = (path: string, env: TradingEnv, init: RequestInit = {}) =>
  onRequest({ request: new Request(`https://paritytrading.app/api/trade/${path}`, init), env, params: { path: path.split("?")[0].split("/") } });

describe("/api/trade", () => {
  it("says demo money with no keys, and never shows a key", async () => {
    const res = await call("status", {});
    const body = await res.json() as { mode: string; badge: string; engine: string };
    expect(body).toMatchObject({ mode: "demo", badge: "Demo money", engine: "browser" });
  });
  it("refuses live when asked by env alone, even with live keys", async () => {
    const env: TradingEnv = { TRADING_MODE: "live", TRADING_LIVE_DEPLOY: "on", ALPACA_LIVE_BROKER_KEY_ID: "lk-value", ALPACA_LIVE_BROKER_SECRET: "ls-value" };
    const res = await call("status", env);
    const text = await res.text();
    expect(JSON.parse(text).mode).toBe("demo");
    // Signed out, the reasons (which keys or gates are missing) are not shown.
    expect(JSON.parse(text).notes).toEqual([]);
    expect(text).not.toMatch(/lk-value|ls-value/);
  });
  it("needs a sign-in to place, list or export orders", async () => {
    for (const [path, method] of [["orders", "POST"], ["orders", "GET"], ["positions", "GET"], ["export", "GET"], ["sandbox/account", "POST"], ["stream", "GET"]] as const) {
      const res = await call(path, {}, { method, body: method === "POST" ? "{}" : undefined });
      expect(res.status, path).toBe(401);
    }
  });
});
