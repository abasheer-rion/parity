// The badge lookup keeps answers in the data centre's cache (REF-0025): a badge viewed many
// times, or a missing id asked for again, reaches the database once per minute, not per view.
import { afterEach, describe, expect, it, vi } from "vitest";
import { lookup, LOOKUP_TTL } from "../functions/badge/[id]";

function fakeCache() {
  const store = new Map<string, Response>();
  return {
    store,
    match: async (r: Request) => store.get(r.url)?.clone(),
    put: async (r: Request, res: Response) => { store.set(r.url, res); },
  };
}

afterEach(() => { delete (globalThis as { caches?: unknown }).caches; });

describe("badge lookup cache", () => {
  it("asks the database once for a missing id seen twice", async () => {
    const c = fakeCache();
    (globalThis as { caches?: unknown }).caches = { default: c };
    const fetcher = vi.fn(async () => new Response("[]", { status: 200 }));
    expect(await lookup("abcdefghjk23", fetcher as unknown as typeof fetch)).toBeNull();
    expect(await lookup("abcdefghjk23", fetcher as unknown as typeof fetch)).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
    const kept = [...c.store.values()][0];
    expect(kept.headers.get("Cache-Control")).toBe(`public, max-age=${LOOKUP_TTL}`);
  });

  it("keeps a found badge and returns the same fields", async () => {
    (globalThis as { caches?: unknown }).caches = { default: fakeCache() };
    const row = { id: "abcdefghjk23", verdict: "pass", withdrawn_at: null };
    const fetcher = vi.fn(async () => new Response(JSON.stringify([row]), { status: 200 }));
    await lookup("abcdefghjk23", fetcher as unknown as typeof fetch);
    expect(await lookup("abcdefghjk23", fetcher as unknown as typeof fetch)).toEqual(row);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("never keeps a failed lookup", async () => {
    const c = fakeCache();
    (globalThis as { caches?: unknown }).caches = { default: c };
    const fetcher = vi.fn(async () => new Response("down", { status: 503 }));
    await expect(lookup("abcdefghjk23", fetcher as unknown as typeof fetch)).rejects.toThrow("lookup 503");
    expect(c.store.size).toBe(0);
  });

  it("works with no cache at all (tests, local dev)", async () => {
    const fetcher = vi.fn(async () => new Response("[]", { status: 200 }));
    await lookup("abcdefghjk23", fetcher as unknown as typeof fetch);
    await lookup("abcdefghjk23", fetcher as unknown as typeof fetch);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
