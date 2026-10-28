// GET /robots.txt (DEC-0073): the real host serves the built file, every other host is blocked.
import { describe, expect, it, vi } from "vitest";
import { BLOCK_ALL, isMainHost, onRequestGet } from "../functions/robots.txt";
import { HOST } from "../src/lib/meta";

const built = () => Promise.resolve(new Response("User-agent: *\nAllow: /\n"));

describe("robots.txt", () => {
  it("knows the real host from site.json", () => {
    expect(isMainHost(HOST)).toBe(true);
    expect(isMainHost(`preview.${HOST}`)).toBe(false);
    expect(isMainHost("parity-research.pages.dev")).toBe(false);
  });

  it("serves the built file on the real host", async () => {
    const next = vi.fn(built);
    const r = await onRequestGet({ request: new Request(`https://${HOST}/robots.txt`), next });
    expect(next).toHaveBeenCalled();
    expect(await r.text()).toContain("Allow: /");
  });

  it("blocks every other host", async () => {
    const next = vi.fn(built);
    const r = await onRequestGet({ request: new Request("https://abc123.parity-research.pages.dev/robots.txt"), next });
    expect(next).not.toHaveBeenCalled();
    expect(await r.text()).toBe(BLOCK_ALL);
    expect(r.headers.get("content-type")).toContain("text/plain");
  });
});
