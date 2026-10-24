// REF-0016 acceptance test 10: every number on the result has a one-line explanation on
// hover or tap, and the verdict sentence contains the numbers that drove it. Also checks
// the page reads a file without any network request carrying it (test 8 in jsdom; the
// Playwright run in the pull request checks a real browser).
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

// The app shell pulls in the docs bundle; the page only needs its title.
// jsdom has no matchMedia; the motion helpers ask it about reduced motion.
if (!window.matchMedia) {
  Object.defineProperty(window, "matchMedia", { value: (q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false }) });
}

vi.mock("../../src/components/Shell", () => ({ Title: ({ children }: { children: React.ReactNode }) => <h1>{children}</h1> }));
import { checkDescription, checkFile, checkStrategy, type Result } from "../../src/lib/verify/checks";
import { EXPLAIN } from "../../src/lib/verify/explain";
import { extract } from "../../src/lib/verify/describe";
import { parseText } from "../../src/lib/verify/parse";
import { Verify } from "../../src/pages/Verify";
import { ResultView } from "../../src/pages/verify/Result";
import { bot99, honestEdge, martingaleLog } from "./fixtures";

const file = (text: string, balance: number | null = 10000) =>
  checkFile({ parsed: parseText(text), answers: { kind: "backtest", balance, tries: 3, claim: { winRate: 0.6 } }, prices: null });

const equity: [string, number][] = Array.from({ length: 400 }, (_, i) => [new Date(Date.UTC(2015, 0, 2 + i * 7)).toISOString().slice(0, 10), 1 + i * 0.002 + Math.sin(i) * 0.01]);

const cases: [string, Result][] = [
  ["99% bot", file(bot99())],
  ["honest edge", file(honestEdge())],
  ["martingale, no balance", file(martingaleLog(), null)],
  ["strategy", checkStrategy({ name: "Test strategy", equity, tries: 5000, gauntlet: { verdict: "Probably luck.", passed: 3, total: 11 } })],
  ["description", checkDescription({ text: "x", ...(() => { const e = extract("Grid bot, 95% win rate, sells at 2% profit"); return { claim: e.claim, settings: e.settings, trades: e.trades }; })() })],
];

describe("every number has a one-line explanation (test 10)", () => {
  for (const [name, r] of cases) {
    it(name, () => {
      const { container } = render(<ResultView r={r} />);
      const nums = [...container.querySelectorAll<HTMLElement>(".vf-num")];
      expect(nums.length).toBeGreaterThan(0);
      for (const n of nums) {
        const text = n.getAttribute("data-explain") ?? "";
        expect(text.length, n.textContent ?? "").toBeGreaterThan(20);
        expect(text.split(/(?<=\.)\s/).length, text).toBeLessThanOrEqual(2);
        expect(n.getAttribute("tabindex"), "a tap or the keyboard can reach it").toBe("0");
      }
      // Every value in the cards' number grids is an explained number.
      for (const dd of container.querySelectorAll(".kstats dd")) expect(dd.querySelector(".vf-num"), dd.textContent ?? "").not.toBeNull();
      // No digits outside an explained number, except in sentences, labels and check details.
      for (const dd of container.querySelectorAll(".kstats dd, .vf-big, .vf-meta li")) {
        const loose = [...dd.childNodes].filter((c) => c.nodeType === 3 && /\d/.test(c.textContent ?? ""));
        expect(loose.map((c) => c.textContent)).toEqual([]);
      }
    });
  }

  it("shows the explanation on hover and on focus (a tap focuses it)", async () => {
    const { container } = render(<ResultView r={cases[1][1]} />);
    const n = container.querySelector<HTMLElement>(".vf-num")!;
    fireEvent.focus(n.parentElement!);
    await waitFor(() => expect(screen.getByRole("tooltip")).toHaveTextContent(n.getAttribute("data-explain")!));
  });

  it("has an explanation for every id it uses, each one line", () => {
    for (const [k, v] of Object.entries(EXPLAIN)) {
      expect(v.length, k).toBeLessThan(200);
      expect(v, k).not.toMatch(/[\u2013\u2014]/);
    }
  });

  it("puts the numbers that drove the verdict in its sentence", () => {
    const bot = checkFile({ parsed: parseText(bot99()), answers: { kind: "backtest", balance: 10000, tries: 1, claim: {} }, prices: null });
    expect(bot.verdict.sentence).toMatch(/99\.0%.*0\.51.*99\.3%/);
    const honest = file(honestEdge());
    expect(honest.verdict.sentence).toContain(honest.card1!.expectancy.toFixed(2));
    expect(honest.verdict.sentence).toContain(honest.card3!.dsr!.toFixed(3));
    expect(honest.verdict.sentence).toMatch(/\d+ tries/);
  });
});

describe("the page reads a file in the browser (test 8 in jsdom)", () => {
  it("parses and checks an upload without sending it anywhere", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      throw new Error(`unexpected request: ${String(input)}`);
    });
    const { container } = render(<Verify />);
    const text = readFileSync(join(import.meta.dirname, "../fixtures/verify/generic.csv"), "utf8");
    const f = new File([text], "trades.csv", { type: "text/csv" });
    // jsdom's File has no arrayBuffer in some versions; give it one.
    if (!("arrayBuffer" in f)) Object.assign(f, { arrayBuffer: async () => new TextEncoder().encode(text).buffer });
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [f] } });
    await screen.findByText(/Trade list, 6 closed trades/);
    fireEvent.click(screen.getByRole("button", { name: "Check this record" }));
    await screen.findByText("Not enough data");
    // Only our own price file may be asked for, and it carries nothing from the upload.
    for (const call of fetchSpy.mock.calls) {
      expect(String(call[0])).toMatch(/\/verify\/prices\.json$/);
      expect(call[1]?.body).toBeUndefined();
    }
  });
});
