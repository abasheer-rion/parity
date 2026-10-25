import { describe, expect, it } from "vitest";
import { isMissing } from "../src/lib/data";

const res = (status: number, type: string) => new Response(status === 204 ? null : "x", { status, headers: { "content-type": type } });

describe("isMissing", () => {
  it("treats a 404 as missing", () => expect(isMissing(res(404, "text/plain"))).toBe(true));
  // The host's single-page fallback answers a missing file with the HTML page and a 200.
  it("treats the HTML fallback page as missing", () => expect(isMissing(res(200, "text/html; charset=utf-8"))).toBe(true));
  it("accepts JSON", () => expect(isMissing(res(200, "application/json"))).toBe(false));
  it("leaves other errors to the caller", () => expect(isMissing(res(500, "text/html"))).toBe(false));
});
