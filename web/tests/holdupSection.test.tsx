// The "how it holds up" section (DEC-0067): its pictures render from real and thin
// records, its words follow REF-0017, it shows on a strategy page and under Verify, and
// an upload builds its own numbers in the browser.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HoldupSection } from "../src/components/holdup/HoldupSection";
import { corrVisual, equityVisual, rangeVisual, regimeVisual, underwaterVisual } from "../src/components/holdup/visuals";
import { corrSentence, luckSentence, mustText, pSentence, rangeSentence, regimeSentence, verdictLine } from "../src/components/holdup/text";
import { holdup } from "../src/lib/holdup";
import { holdupForUpload } from "../src/lib/verify/checks";
import { renderSignature } from "../src/ui/signature";
import type { Holdup } from "../src/lib/types";

const fx = JSON.parse(readFileSync(join(import.meta.dirname, "fixtures/holdup-python.json"), "utf8"));
const full = fx.full.expected as Holdup;
const bare = fx.bare.expected as Holdup;

describe("holdup pictures", () => {
  for (const [name, h] of [["full", full], ["bare", bare]] as const) {
    it(`every picture renders at every step for the ${name} record`, () => {
      const pics = [equityVisual(h, "Fixture", name === "full" ? "US stock market" : ""), rangeVisual(h), corrVisual(h), regimeVisual(h), underwaterVisual(h, "Fixture")];
      for (const v of pics) {
        if (!v) continue;
        for (let s = 0; s < v.steps.length; s += 0.5) {
          const svg = renderSignature(v, s, { size: "lesson" });
          expect(svg.length, `${v.kind} at ${s}`).toBeGreaterThan(200);
          expect(svg, `${v.kind} at ${s}`).not.toMatch(/NaN|undefined|Infinity/);
        }
      }
    });
  }

  it("leaves out what a thin record cannot show", () => {
    expect(corrVisual(bare)).toBeNull();
    expect(equityVisual(bare, "Fixture", "")?.params?.series).toHaveLength(1);
  });

  it("puts the deepest day back into the sampled underwater curve", () => {
    const v = underwaterVisual(full, "Fixture")!;
    const vals = v.params!.values as number[];
    let peak = -Infinity, worst = 0;
    for (const x of vals) { peak = Math.max(peak, x); worst = Math.min(worst, x / peak - 1); }
    expect(worst).toBeCloseTo(full.worst_periods.drawdowns[0].depth!, 2);
  });
});

describe("holdup words", () => {
  const all = (h: Holdup) => [luckSentence(h), pSentence(h), rangeSentence(h), corrSentence(h), regimeSentence(h), verdictLine(h).title, verdictLine(h).text, ...h.must_be_true.map(mustText)];
  it("have no dashes, slogans or missing numbers", () => {
    for (const t of [...all(full), ...all(bare)]) {
      expect(t).not.toMatch(/[–—]|undefined|NaN|honest|simply|truly/);
    }
  });
  it("count the tries", () => {
    expect(luckSentence(full)).toContain("40 tries");
    expect(pSentence(full)).toContain("Corrected for 40 tries");
  });
});

describe("the section", () => {
  it("draws every block with a data table", () => {
    render(<HoldupSection holdup={full} name="Fixture" />);
    for (const t of ["Against the market", "Could it be luck?", "How sure are the numbers?", "What it moves with", "Where it wins and where it loses", "Worst stretches", "What has to stay true"]) {
      expect(screen.getByRole("heading", { name: t })).toBeTruthy();
    }
    expect(screen.getAllByRole("table").length).toBeGreaterThanOrEqual(8);
  });

  it("says why when there are no numbers", () => {
    render(<HoldupSection holdup={null} name="Fixture" missing="Not in this run." />);
    expect(screen.getByText("Not in this run.")).toBeTruthy();
  });

  it("names missing market series on an upload", () => {
    const h = holdup({ returns: fx.bare.inputs.returns, reasons: { stocks: "upload", bonds: "upload" } });
    render(<HoldupSection holdup={h} name="Your record" />);
    expect(screen.getAllByText(/An uploaded record has no market series attached/).length).toBeGreaterThan(0);
  });
});

describe("Verify uploads", () => {
  const r = fx.bare.inputs.returns as { dates: string[]; values: number[] };
  it("build the numbers from daily returns", () => {
    const h = holdupForUpload({ dates: r.dates, returns: r.values, equity: [], equity0: 1, periodsPerYear: 252, warnings: [] }, 7);
    expect(h?.luck.n_trials).toBe(7);
    expect(h?.sources.benchmark.reason).toBe("upload");
  });
  it("skip monthly or short records", () => {
    expect(holdupForUpload({ dates: r.dates, returns: r.values, equity: [], equity0: 1, periodsPerYear: 12, warnings: [] }, 1)).toBeNull();
    expect(holdupForUpload({ dates: r.dates.slice(0, 20), returns: r.values.slice(0, 20), equity: [], equity0: 1, periodsPerYear: 252, warnings: [] }, 1)).toBeNull();
  });
});
