import { describe, expect, it } from "vitest";
import { classes, directAlpha, EXAMPLES, irr, ksPme, measures, multiples, netFlows, routes, type Flow } from "../src/lib/privateMarkets";

const flows = (paidIn: number[], paidOut: number[]): Flow[] => paidIn.map((p, i) => ({ year: i, paidIn: p, paidOut: paidOut[i] ?? 0 }));
const ex = (id: string) => EXAMPLES.find((e) => e.id === id)!;

describe("private markets calculator", () => {
  it("finds the IRR of a simple loan", () => {
    expect(irr([-100, 110])).toBeCloseTo(0.1, 8);
    expect(irr([-100, 0, 121])).toBeCloseTo(0.1, 8);
  });

  it("has no IRR without both money in and money out", () => {
    expect(irr([-100, -10])).toBeNull();
    expect(irr([100, 10])).toBeNull();
  });

  it("splits TVPI into cash back (DPI) and estimates (RVPI)", () => {
    const m = multiples(flows([50, 50], [20, 30]), 70);
    expect(m.dpi).toBeCloseTo(0.5);
    expect(m.rvpi).toBeCloseTo(0.7);
    expect(m.tvpi).toBeCloseTo(1.2);
  });

  it("puts the value still held in the last year's cash", () => {
    expect(netFlows(flows([100, 0], [0, 10]), 50)).toEqual([-100, 60]);
  });

  it("gives a PME of 1 when the fund earns exactly the index", () => {
    // 100 in, grows 7% a year for 3 years, all paid out at the end.
    const f = flows([100, 0, 0, 0], [0, 0, 0, 100 * 1.07 ** 3]);
    expect(ksPme(f, 0, 0.07)).toBeCloseTo(1, 8);
    expect(ksPme(f, 0, 0.0)).toBeGreaterThan(1);
    expect(ksPme(f, 0, 0.1)).toBeLessThan(1);
    expect(directAlpha(f, 0, 0.07)).toBeCloseTo(0, 6);
  });

  it("shows the IRR moving while the multiple does not", () => {
    const steady = ex("steady");
    const win = ex("early-win");
    const line = ex("credit-line");
    const tv = (e: typeof steady) => multiples(e.flows, e.nav).tvpi;
    const r = (e: typeof steady) => irr(netFlows(e.flows, e.nav))!;
    expect(tv(win)).toBeCloseTo(tv(steady)!);
    expect(tv(line)).toBeCloseTo(tv(steady)!);
    expect(r(win)).toBeGreaterThan(r(steady) + 0.03);
    expect(r(line)).toBeGreaterThan(r(steady));
  });

  it("says a young fund's multiple is mostly estimates", () => {
    const y = ex("young");
    const m = multiples(y.flows, y.nav);
    expect(m.rvpi!).toBeGreaterThan(m.dpi!);
  });
});

describe("private markets content", () => {
  it("never tells anyone to buy", () => {
    const text = JSON.stringify({ classes, measures, routes }).toLowerCase();
    expect(text).not.toMatch(/\byou should buy\b|\bbuy now\b|\bwe recommend\b/);
    expect(text).not.toMatch(/[–—‘’“”]/);
  });

  it("gives every class and route a what to check list", () => {
    for (const c of classes) expect(c.check.length).toBeGreaterThan(1);
    for (const r of routes) expect(r.check.length).toBeGreaterThan(0);
    expect(measures.map((m) => m.id)).toEqual(["irr", "tvpi", "dpi", "rvpi", "pme"]);
  });
});
