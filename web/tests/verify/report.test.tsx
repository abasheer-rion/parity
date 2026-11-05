// The Verify report (DEC-0089): the shape every check becomes, the link that carries it,
// its pictures, its image card, the side-by-side comparison, and the page that draws it.
// Everything runs on made-up records (fixtures.ts); nothing is sent anywhere.
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

afterEach(cleanup);

if (!window.matchMedia) {
  Object.defineProperty(window, "matchMedia", { value: (q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false }) });
}

import { benchmarkFrom, checkDescription, checkFile, checkStrategy } from "../../src/lib/verify/checks";
import { extractClaims } from "../../src/lib/verify/claims/extract";
import { deflatedSharpeFrom } from "../../src/lib/verify/dsr";
import { parseText } from "../../src/lib/verify/parse";
import { reportCardSvg } from "../../src/lib/verify/report/card";
import { compareRows, compareSentence, overlap } from "../../src/lib/verify/report/compare";
import { decodeReport, encodeReport, LinkError, sanitizeReport } from "../../src/lib/verify/report/link";
import { cannotCheck, keyNumbers, pictureGaps, reportFrom, type ReportData } from "../../src/lib/verify/report/model";
import { thin, tradeSpread } from "../../src/lib/verify/report/series";
import { luckVisual, reportPictures, triesGrid } from "../../src/lib/verify/report/visuals";
import { renderSignature, signatureTable } from "../../src/ui/signature";
import { checkClaimWords } from "../../src/pages/verify/ClaimInput";
import { Report } from "../../src/pages/verify/report/Report";
import { ReportPage } from "../../src/verify/ReportPage";
import { bot99, honestEdge, martingaleLog, weekdays } from "./fixtures";
import type { PriceBook } from "../../src/lib/verify/prices";

const DAY = "2026-11-03";
const file = (text: string, balance: number | null = 10_000, extra: Partial<Parameters<typeof checkFile>[0]> = {}) =>
  checkFile({ parsed: parseText(text), answers: { kind: "backtest", balance, tries: 3, claim: {} }, prices: null, ...extra });

/** A made-up S&P 500 a day for the benchmark, gently rising with a wobble. */
function spx(): PriceBook {
  const days = new Map<string, [number, number]>();
  weekdays("2022-01-03", 900).forEach((d, i) => { const p = 4000 * (1 + i * 0.0003 + 0.02 * Math.sin(i / 9)); days.set(d, [p, p]); });
  return { SPX: { kind: "price", days, source: "test" } };
}

describe("the report's shape", () => {
  it("carries the pictures' numbers for a file with a balance, against the S&P 500", () => {
    const r = file(honestEdge(), 10_000, { benchmark: benchmarkFrom(spx()) });
    const d = reportFrom(r, { checkedOn: DAY, prices: "loaded" });
    expect(d.curve?.unit).toBe("growth");
    expect(d.curve!.dates.length).toBeLessThanOrEqual(260);
    expect(d.curve?.bench?.some((v) => v != null)).toBe(true);
    expect(d.benchmark).toBe("S&P 500");
    expect(d.spread?.what).toBe("sharpe");
    expect(d.c3?.moments?.t).toBeGreaterThan(30);
    expect(d.groups?.families.map((f) => f.family)).toEqual(expect.arrayContaining(["volatility", "years"]));
    expect(d.inputs.find((x) => x.label === "Compared with")?.value).toBe("S&P 500, daily");
    expect(d.inputs.find((x) => x.label === "Method")?.value).toBe(`${d.method}, checked on ${DAY}`);
    expect(keyNumbers(d).map((k) => k.id)).toEqual(["survives", "expectancy", "winRate", "totalReturn", "maxDrawdown", "sharpeAnnual"]);
    // Every number shown at the top has a one-line meaning.
    expect(pictureGaps(d, false)).toMatchObject({ curve: null, bench: null, spread: null, luck: null, groups: null });
  });

  it("draws profit in money, and the spread of profit per trade, when there is no balance", () => {
    const d = reportFrom(file(bot99(), null), { checkedOn: DAY });
    expect(d.curve?.unit).toBe("money");
    expect(d.spread?.what).toBe("perTrade");
    expect(d.spread!.ci95![0]).toBeLessThan(d.spread!.ci95![1]);
    expect(d.groups?.families.every((f) => f.unit === "money")).toBe(true);
    expect(pictureGaps(d, true).bench).toMatch(/signed-in/);
    expect(pictureGaps(d, false).bench).toMatch(/starting balance/);
  });

  it("says what could not be checked, the same list the API gives", () => {
    const r = file(martingaleLog(), null);
    expect(reportFrom(r).cannot).toEqual(cannotCheck(r));
    expect(reportFrom(r).cannot.map((c) => c.check)).toContain("Too smooth");
  });

  it("keeps a seller's claims with their words", () => {
    const r = checkClaimWords("Our bot: 92% win rate, +340% in 12 months, max drawdown 8%.", { url: "https://bots.example.com/gold", title: "Gold bot", readAt: "2026-11-03T10:00:00Z" });
    const d = reportFrom(r, { checkedOn: DAY });
    expect(d.claims?.found.map((f) => f.field)).toEqual(expect.arrayContaining(["winRate", "totalReturn", "maxDrawdown"]));
    expect(d.claims?.url).toBe("https://bots.example.com/gold");
    expect(d.inputs.find((x) => x.label === "Claims")?.value).toBe("4 read from bots.example.com on 2026-11-03");
    expect(d.verdict.id).not.toBe("holds_up");
  });

  it("thins a long series but keeps its lowest and highest points", () => {
    const dates = weekdays("2020-01-01", 2000);
    const values = dates.map((_, i) => 1 + Math.sin(i / 50) + (i === 1234 ? -5 : 0));
    const t = thin(dates, values);
    expect(t.dates.length).toBeLessThanOrEqual(240);
    expect(Math.min(...t.values)).toBe(Math.min(...values));
    expect(Math.max(...t.values)).toBe(Math.max(...values));
    expect(t.dates[0]).toBe(dates[0]);
    expect(t.dates.at(-1)).toBe(dates.at(-1));
  });

  it("reshuffles trades the same way every time", () => {
    const p = Array.from({ length: 200 }, (_, i) => (i % 3 ? 10 : -14));
    expect(tradeSpread(p)).toEqual(tradeSpread(p));
    expect(tradeSpread(p.slice(0, 9))).toBeNull();
  });
});

describe("a report in a link", () => {
  const d = reportFrom(file(honestEdge(), 10_000, { benchmark: benchmarkFrom(spx()) }), { checkedOn: DAY });

  it("comes back the same", async () => {
    const code = await encodeReport(d);
    expect(await decodeReport(code)).toEqual(sanitizeReport(JSON.parse(JSON.stringify(d))));
    expect((await decodeReport(code)).verdict).toEqual(d.verdict);
    expect((await decodeReport(code)).curve?.values).toEqual(d.curve?.values);
  });

  it("reads the plain form too, for browsers that cannot compress", async () => {
    const plain = `j${btoa(JSON.stringify(d)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`;
    expect((await decodeReport(plain)).what).toBe(d.what);
  });

  it("says plainly when a link is damaged, edited or empty", async () => {
    const code = await encodeReport(d);
    await expect(decodeReport(code.slice(0, code.length / 2))).rejects.toBeInstanceOf(LinkError);
    await expect(decodeReport("")).rejects.toThrow(/too long or empty/);
    await expect(decodeReport("xabc")).rejects.toThrow(/damaged/);
    expect(sanitizeReport({ ...d, v: 2 })).toBeNull();
    expect(sanitizeReport({ ...d, verdict: { ...d.verdict, id: "great" } })).toBeNull();
    expect(sanitizeReport({ ...d, c1: { ...d.c1, winRate: "lots" } })).toBeNull();
  });

  it("never lets a link carry a script address or oversized fields into the page", () => {
    const evil = sanitizeReport({ ...d, claims: { url: "javascript:alert(1)", title: "x".repeat(5000), readAt: null, found: [] }, what: "y".repeat(5000), notes: Array(100).fill("n") })!;
    expect(evil.claims?.url).toBeNull();
    expect(evil.claims?.title?.length).toBe(200);
    expect(evil.what.length).toBe(200);
    expect(evil.notes.length).toBe(20);
  });
});

describe("the report's pictures", () => {
  const cases: [string, ReportData][] = [
    ["file against the S&P 500", reportFrom(file(honestEdge(), 10_000, { benchmark: benchmarkFrom(spx()) }))],
    ["trades without a balance", reportFrom(file(bot99(), null))],
    ["martingale", reportFrom(file(martingaleLog(), 10_000))],
    ["one of our strategies", reportFrom(checkStrategy({ name: "Test strategy", tries: 50, equity: weekdays("2015-01-01", 400).map((d, i) => [d, 1 + i * 0.001 + Math.sin(i) * 0.01]) }))],
  ];
  for (const [name, d] of cases) {
    it(`draws every step of every picture: ${name}`, () => {
      const p = reportPictures(d);
      const all = [p.growth, p.underwater, p.spread, p.luck, ...p.groups].filter((v) => v != null);
      expect(all.length).toBeGreaterThanOrEqual(3);
      for (const v of all) {
        expect(v!.alt.length).toBeGreaterThan(20);
        for (let s = 0; s < v!.steps.length; s++) {
          const svg = renderSignature(v!, s, { size: "lesson" });
          expect(svg.length, `${v!.kind} step ${s}`).toBeGreaterThan(200);
          expect(svg).not.toMatch(/NaN|undefined/);
          expect(renderSignature(v!, s, { size: "compact", theme: "light" })).not.toMatch(/NaN/);
        }
        expect(signatureTable(v!)?.rows.length).toBeGreaterThan(0);
        expect(v!.steps.map((x) => x.caption).join(" ")).not.toMatch(/[\u2013\u2014]/);
      }
    });
  }

  it("draws the luck check falling as tries rise, with the stated tries and the survival point", () => {
    const d = cases[0][1];
    const v = luckVisual(d)!;
    const values = (v.params!.series as { values: number[] }[])[0].values;
    for (let i = 1; i < values.length; i++) expect(values[i]).toBeLessThanOrEqual(values[i - 1] + 1e-9);
    expect(values[0]).toBeCloseTo(deflatedSharpeFrom(d.c3!.moments!, 1), 3);
    expect(triesGrid()[0]).toBe(1);
    expect(triesGrid().at(-1)).toBe(1_000_000_000);
    expect(v.steps.at(-1)!.verdict).toMatch(/tries|try/);
  });
});

describe("the image card", () => {
  it("is a 1200 by 630 picture with the verdict, the luck line and the method", () => {
    const d = reportFrom(file(honestEdge()), { checkedOn: DAY });
    const svg = reportCardSvg(d, "<svg viewBox=\"0 0 317 74\"><title>Parity</title><path d=\"M0 0h10v10z\"/></svg>");
    expect(svg).toMatch(/^<svg[^>]+width="1200" height="630"/);
    expect(svg).toContain(d.verdict.label);
    expect(svg).toContain(d.method);
    expect(svg).toMatch(/Survives|Luck check/);
    expect(svg).not.toMatch(/<script|NaN/);
  });
});

describe("two records side by side", () => {
  const a = reportFrom(file(honestEdge(), 10_000));
  const b = reportFrom(file(martingaleLog(), 10_000));

  it("puts the same numbers in the same rows and never says which to choose", () => {
    const rows = compareRows(a, b);
    expect(rows[0]).toMatchObject({ label: "Verdict", a: a.verdict.label, b: b.verdict.label });
    expect(rows.map((r) => r.label)).toEqual(expect.arrayContaining(["Luck check", "Largest fall from a high", "Checks failed", "Could not be checked"]));
    // Returns are shown but never marked better or worse.
    for (const r of rows.filter((x) => ["Profit per trade (or period)", "Total return", "Win rate"].includes(x.label))) expect(r.worse).toBeNull();
    const s = compareSentence(a, b);
    expect(s).toContain("does not rank");
    expect(s).not.toMatch(/better|best|choose [AB]/i);
  });

  it("lines the two growth curves up on the days they share", () => {
    const o = overlap(a, reportFrom(file(honestEdge(), 20_000)));
    expect(o).not.toBeNull();
    expect(o!.a[0]).toBe(1);
    expect(o!.b[0]).toBe(1);
    expect(overlap(a, reportFrom(file(bot99(), null)))).toBeNull();
  });
});

describe("the report page", () => {
  it("shows the verdict, the numbers with their meaning, the claims and what could not be checked", () => {
    const r = checkClaimWords("92% win rate, +340% in 12 months", { url: null, title: null, readAt: null });
    const { container } = render(<Report data={reportFrom(r)} result={r} />);
    expect(screen.getByRole("heading", { level: 2, name: r.verdict.label })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "What the seller claims" })).toBeInTheDocument();
    expect(container.querySelectorAll(".rp-claim").length).toBe(3);
    expect(container.querySelector(".rp-claim mark")?.textContent).toBe("92%");
    expect(screen.getByRole("heading", { name: "What could not be checked" })).toBeInTheDocument();
    for (const n of container.querySelectorAll<HTMLElement>(".vf-num")) expect(n.getAttribute("data-explain")?.length).toBeGreaterThan(20);
    expect(screen.getByRole("button", { name: "Save as PDF" })).toBeInTheDocument();
  });

  it("opens a shared link from the address and says Parity did not store it", async () => {
    const d = reportFrom(file(honestEdge()), { checkedOn: DAY });
    window.location.hash = `#r=${await encodeReport(d)}`;
    await act(async () => { render(<ReportPage />); });
    await waitFor(() => expect(screen.getByTestId("verdict-sentence")).toHaveTextContent(d.verdict.sentence));
    expect(screen.getByText(/Shared by link/)).toBeInTheDocument();
    window.location.hash = "";
  });

  it("says so when the link is damaged", async () => {
    window.location.hash = "#r=zNotARealReport";
    await act(async () => { render(<ReportPage />); });
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/damaged/));
    window.location.hash = "";
  });

  it("a description has no pictures section, a badge says why it has none", () => {
    const d = reportFrom(checkDescription({ text: "x", claim: { winRate: 0.9 }, settings: null, trades: null }));
    const { container, unmount } = render(<Report data={d} />);
    expect(container.querySelector("[data-chart]")).toBeNull();
    unmount();
    render(<Report data={{ ...reportFrom(file(honestEdge())), kept: "summary" }} linkable={false} />);
    expect(screen.getByText(/A published badge keeps the summary numbers/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Copy a link to this report" })).toBeNull();
  });

  it("finds claims the same way on the page and in the report", () => {
    const words = "Win rate: 71%\nTotal gain: +128%";
    expect(checkClaimWords(words, { url: null, title: null, readAt: null }).claimSource!.found).toEqual(extractClaims(words));
  });
});
