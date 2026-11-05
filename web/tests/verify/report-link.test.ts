// A report in a link (DEC-0089), in Node, where compression is available as in browsers:
// the link is deflated, short enough to share, and comes back the same.
// @vitest-environment node
import { describe, expect, it } from "vitest";
import { benchmarkFrom, checkFile } from "../../src/lib/verify/checks";
import { parseText } from "../../src/lib/verify/parse";
import { decodeReport, encodeReport, MAX_LINK } from "../../src/lib/verify/report/link";
import { reportFrom } from "../../src/lib/verify/report/model";
import type { PriceBook } from "../../src/lib/verify/prices";
import { honestEdge, weekdays } from "./fixtures";

function spx(): PriceBook {
  const days = new Map<string, [number, number]>();
  weekdays("2022-01-03", 900).forEach((d, i) => { const p = 4000 * (1 + i * 0.0003 + 0.02 * Math.sin(i / 9)); days.set(d, [p, p]); });
  return { SPX: { kind: "price", days, source: "test" } };
}

describe("a report in a link", () => {
  it("is deflated, a few kilobytes, and comes back the same", async () => {
    const d = reportFrom(checkFile({ parsed: parseText(honestEdge()), answers: { kind: "real", balance: 10_000, tries: 4, claim: {} }, prices: null, benchmark: benchmarkFrom(spx()) }), { checkedOn: "2026-11-03" });
    const code = await encodeReport(d);
    expect(code[0]).toBe("z");
    expect(code.length).toBeLessThan(16_000);
    expect(code.length).toBeLessThan(MAX_LINK);
    expect(code).toMatch(/^z[A-Za-z0-9_-]+$/);
    const back = await decodeReport(code);
    expect(back.verdict).toEqual(d.verdict);
    expect(back.curve).toEqual(d.curve);
    expect(back.c3).toEqual(d.c3);
  });
});
