// The desktop app stays signed in (DEC-0072): a session check renews a token that ends
// within 10 minutes, leaves a fresh one alone, and keeps the session when renewal fails.
import { describe, expect, it, vi } from "vitest";
import { keepFresh } from "../src/auth/client";

const NOW = 1_800_000_000_000;
function fake(expiresInSec: number | null, refreshError: unknown = null) {
  const refreshSession = vi.fn(async () => ({ data: {}, error: refreshError }));
  const session = expiresInSec === null ? null : { expires_at: NOW / 1000 + expiresInSec };
  return { refreshSession, client: { auth: { getSession: async () => ({ data: { session }, error: null }), refreshSession } } as never };
}

describe("keepFresh", () => {
  it("leaves a token with more than 10 minutes alone", async () => {
    const f = fake(3000);
    expect(await keepFresh(f.client, NOW)).toBe("fresh");
    expect(f.refreshSession).not.toHaveBeenCalled();
  });
  it("renews a token that ends soon or already ended", async () => {
    expect(await keepFresh(fake(300).client, NOW)).toBe("renewed");
    expect(await keepFresh(fake(-7200).client, NOW)).toBe("renewed");
  });
  it("reports a failed renewal without signing out, and does nothing signed out", async () => {
    expect(await keepFresh(fake(60, new Error("offline")).client, NOW)).toBe("failed");
    expect(await keepFresh(fake(null).client, NOW)).toBe("none");
  });
});
