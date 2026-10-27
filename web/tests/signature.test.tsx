// The signature chart system (DEC-0067): every scene draws at every step, between steps
// and at every size without broken numbers, whole steps are full pictures, the table
// carries the numbers, and the player steps, scrubs and offers the table.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { EXAMPLES, renderSignature, SCENE_KINDS, signatureTable, SignaturePlayer, SIZES, type SizeName } from "../src/ui/signature";

const sizes = Object.keys(SIZES) as SizeName[];

describe("signature scenes", () => {
  it("has an example for every kind", () => {
    expect(Object.keys(EXAMPLES).sort()).toEqual([...SCENE_KINDS].sort());
  });

  for (const kind of SCENE_KINDS) {
    const v = EXAMPLES[kind];
    it(`${kind} draws at every step, between steps and at every size, in both themes`, () => {
      const last = v.steps.length - 1;
      const positions = [-1, -0.5, ...v.steps.flatMap((_, i) => (i < last ? [i, i + 0.3, i + 0.7] : [i]))];
      for (const size of sizes) for (const theme of ["dark", "light"] as const) for (const s of positions) {
        const svg = renderSignature(v, s, { size, theme });
        expect(svg, `${kind} ${size} ${theme} s=${s}`).not.toMatch(/NaN|Infinity|undefined/);
      }
    });

    it(`${kind} whole steps are full pictures, not the empty first frame`, () => {
      const empty = renderSignature(v, -1, { size: "lesson" });
      for (let i = 0; i < v.steps.length; i++) {
        const still = renderSignature(v, i, { size: "lesson" });
        expect(still).not.toEqual(empty);
        expect(still.length).toBeGreaterThan(empty.length);
      }
    });

    it(`${kind} has a data table`, () => {
      const t = signatureTable(v);
      expect(t).not.toBeNull();
      expect(t!.rows.length).toBeGreaterThan(0);
      for (const r of t!.rows) expect(r.length).toBe(t!.head.length);
    });
  }

  it("clips burn in the caption and the brand; lessons do not", () => {
    const v = EXAMPLES.equity;
    expect(renderSignature(v, 0, { size: "vertical", brand: "PARITY" })).toContain(v.steps[0].caption);
    expect(renderSignature(v, 0, { size: "vertical", brand: "PARITY" })).toContain("PARITY");
    expect(renderSignature(v, 0, { size: "lesson" })).not.toContain(v.steps[0].caption);
  });

  it("an unknown kind draws nothing rather than throwing", () => {
    expect(renderSignature({ kind: "nope", alt: "x", steps: [{ caption: "a" }] }, 0)).toBe("");
  });

  it("copy has no dashes used as punctuation", () => {
    const text = JSON.stringify(EXAMPLES);
    expect(text).not.toMatch(/[–—]/);
  });
});

describe("SignaturePlayer", () => {
  afterEach(cleanup);
  it("steps with Next and Back and announces the caption", () => {
    const v = EXAMPLES.regimes;
    render(<SignaturePlayer visual={v} autoPlay={false} />);
    expect(screen.getByRole("img", { name: v.alt })).toBeTruthy();
    expect(screen.getByText(v.steps[0].caption).getAttribute("aria-live")).toBe("polite");
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText(v.steps[1].caption).getAttribute("aria-live")).toBe("polite");
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByText(v.steps[0].caption).getAttribute("aria-live")).toBe("polite");
  });

  it("the slider moves between steps", () => {
    const v = EXAMPLES.scorecard;
    render(<SignaturePlayer visual={v} autoPlay={false} />);
    const slider = screen.getByRole("slider", { name: "Move through the steps" });
    fireEvent.change(slider, { target: { value: "2" } });
    expect(slider.getAttribute("aria-valuetext")).toBe(`Step 3 of ${v.steps.length}`);
  });

  it("shows the numbers as a table on request", () => {
    const v = EXAMPLES.regimes;
    render(<SignaturePlayer visual={v} autoPlay={false} />);
    expect(screen.queryByRole("table")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Show the numbers" }));
    const table = screen.getByRole("table");
    expect(table.querySelectorAll("tbody tr").length).toBe(7);
  });

  it("All steps lays out every frame", () => {
    const v = EXAMPLES.split;
    render(<SignaturePlayer visual={v} autoPlay={false} />);
    fireEvent.click(screen.getByRole("button", { name: "All steps" }));
    expect(screen.getByRole("list", { name: v.alt }).querySelectorAll("li").length).toBe(v.steps.length);
  });
});
