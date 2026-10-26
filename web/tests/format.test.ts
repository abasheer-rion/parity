import { describe, expect, it } from "vitest";
import { date, daysSince, num, pct, signedPct } from "../src/lib/format";

describe("format", () => {
  it("shows n/a for missing, NaN and infinite numbers", () => {
    for (const v of [null, undefined, NaN, Infinity, -Infinity]) {
      expect(pct(v)).toBe("n/a");
      expect(num(v)).toBe("n/a");
      expect(signedPct(v)).toBe("n/a");
    }
    expect(pct(0.1234)).toBe("12.3%");
    expect(signedPct(0.05)).toBe("+5.0%");
    expect(num(1.005, 1)).toBe("1.0");
  });

  it("does not throw on a malformed date", () => {
    expect(date("not a date")).toBe("n/a");
    expect(date("")).toBe("n/a");
    expect(date("2026-10-25T23:30:00-05:00")).toBe("2026-10-26");
    expect(daysSince("garbage")).toBeNull();
    expect(daysSince(null)).toBeNull();
  });
});
