// REF-0016 acceptance test 7: the TypeScript luck check gives the same value as the
// engine's Python deflated_sharpe() to 3 decimal places, on 20 random return series and
// tries from 1 to 10,000. The fixture is written by scripts/verify_dsr_fixture.py.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { deflatedSharpe, deflatedSharpeFrom, minTrackRecord, moments, survivesUpTo } from "../../src/lib/verify/dsr";
import { erfc, normCdf, normPpf } from "../../src/lib/verify/stats";

const fixture = JSON.parse(readFileSync(join(import.meta.dirname, "../fixtures/verify/dsr-python.json"), "utf8")) as {
  tries: number[]; series: { returns: number[]; expected: Record<string, number> }[];
};

describe("deflated Sharpe parity with the Python engine", () => {
  it("covers 20 series and tries from 1 to 10,000", () => {
    expect(fixture.series).toHaveLength(20);
    expect(Math.min(...fixture.tries)).toBe(1);
    expect(Math.max(...fixture.tries)).toBe(10000);
  });

  fixture.series.forEach((s, i) => {
    it(`series ${i + 1} (${s.returns.length} days) matches to 3 decimal places`, () => {
      for (const n of fixture.tries) {
        const ts = deflatedSharpe(s.returns, n);
        expect(ts, `tries ${n}`).not.toBeNull();
        expect(Math.abs(ts! - s.expected[String(n)]), `tries ${n}: ts ${ts} py ${s.expected[String(n)]}`).toBeLessThan(0.0005);
      }
    });
  });

  it("returns nothing for fewer than 30 returns or a flat series, as the Python returns NaN", () => {
    expect(deflatedSharpe([0.01, -0.01, 0.02], 1)).toBeNull();
    expect(deflatedSharpe(Array(100).fill(0.001), 1)).toBeNull();
  });
});

describe("normal distribution helpers", () => {
  it("match known values", () => {
    expect(normCdf(0)).toBeCloseTo(0.5, 12);
    expect(normCdf(1.959963984540054)).toBeCloseTo(0.975, 10);
    expect(normCdf(-3)).toBeCloseTo(0.0013498980316301, 12);
    expect(normPpf(0.95)).toBeCloseTo(1.6448536269514722, 10);
    expect(normPpf(1 - 1 / 10000)).toBeCloseTo(3.719016485455709, 9);
    expect(erfc(3)).toBeCloseTo(2.209049699858544e-5, 15);
  });
});

describe("survives up to N tries and minimum track record", () => {
  const s = fixture.series.find((x) => x.expected["1"] > 0.99 && x.expected["10000"] < 0.95)!;
  const m = moments(s.returns)!;

  it("is the largest N that keeps the luck check at or above 0.95", () => {
    const n = survivesUpTo(m);
    expect(n).toBeGreaterThanOrEqual(1);
    expect(deflatedSharpeFrom(m, n)).toBeGreaterThanOrEqual(0.95);
    expect(deflatedSharpeFrom(m, n + 1)).toBeLessThan(0.95);
  });

  it("gives a record length at which the same results would just pass", () => {
    const tries = 100000;
    const need = minTrackRecord(m, tries);
    expect(need).toBeGreaterThan(m.t);
    expect(deflatedSharpeFrom({ ...m, t: Math.ceil(need) + 1 }, tries)).toBeGreaterThanOrEqual(0.95);
    expect(deflatedSharpeFrom({ ...m, t: Math.floor(need) - 1 }, tries)).toBeLessThan(0.95);
    expect(minTrackRecord({ ...m, sr: -0.1 }, tries)).toBe(Infinity);
  });
});
