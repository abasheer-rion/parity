// Regression tests for the bugs found in the production QA sweep of Verify on 4 November 2026
// (docs/log). Each block names the bug it keeps fixed.
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

if (!window.matchMedia) {
  Object.defineProperty(window, "matchMedia", { value: (q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false }) });
}

// Nobody is signed in. The real Supabase client is never loaded.
vi.mock("../../src/auth/session", () => ({ useSession: () => ({ loading: false, session: null }) }));
vi.mock("../../src/auth/client", () => ({ supabase: {}, requireClient: () => ({ auth: { getSession: async () => ({ data: { session: { access_token: "t" } } }) } }) }));

import { checkFile } from "../../src/lib/verify/checks";
import { checkUpload, SIGNED_OUT_PRICES } from "../../src/lib/verify/checks/upload";
import { SIGNED_OUT_PRICES as PAGE_SIGNED_OUT } from "../../src/pages/verify/Checker";
import { readRange } from "../../src/lib/connect/server";
import { verdict } from "../../src/lib/verify/checks/verdict";
import { rangeProblem } from "../../src/lib/connect/venues";
import { parseText } from "../../src/lib/verify/parse";
import type { PriceBook } from "../../src/lib/verify/prices";
import { compareSentence } from "../../src/lib/verify/report/compare";
import { decodeReport } from "../../src/lib/verify/report/link";
import { reportFrom } from "../../src/lib/verify/report/model";
import { axisLabels } from "../../src/lib/verify/report/visuals";
import { count } from "../../src/lib/verify/words";
import { fmtOf } from "../../src/ui/signature/scenes";
import { ComparePage } from "../../src/verify/ComparePage";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
afterAll(() => new Promise((r) => setTimeout(r, 500)));

const fx = (name: string) => readFileSync(join(import.meta.dirname, "../fixtures/verify", name), "utf8");
const fileOf = (text: string, name: string) => {
  const f = new File([text], name, { type: "text/csv" });
  if (!("arrayBuffer" in f)) Object.assign(f, { arrayBuffer: async () => new TextEncoder().encode(text).buffer });
  return f;
};
const answers = { kind: "backtest" as const, balance: 10000, tries: 1, claim: {} };

describe("compare page: an uploaded file is checked like on the Verify page", () => {
  // Bug: the compare page passed no prices and no reason, so the report said "we hold no daily
  // prices for EURUSD" (false) instead of "not checked while signed out".
  it("says the fills were not checked while signed out, not that we hold no prices", async () => {
    const { container } = render(<ComparePage />);
    fireEvent.change(container.querySelector('input[aria-label="Trade file for record A"]')!, { target: { files: [fileOf(fx("generic.csv"), "a.csv")] } });
    await screen.findByText(/Trade list, 6 closed trades/);
    fireEvent.click(screen.getByRole("button", { name: "Check record A" }));
    const open = await screen.findByRole("link", { name: "Open its full report" });
    const d = await decodeReport(open.getAttribute("href")!.split("#r=")[1]);
    const fills = d.c4.find((c) => c.id === "fills")!;
    expect(fills.detail).toBe(SIGNED_OUT_PRICES);
    expect(fills.detail).not.toMatch(/hold no daily prices/);
  });

  it("checks the fills against our prices when they are loaded", () => {
    const parsed = parseText(fx("generic.csv"));
    const days = new Map<string, [number, number]>();
    for (let t = Date.parse("2023-12-01"); t <= Date.parse("2024-02-01"); t += 86_400_000) days.set(new Date(t).toISOString().slice(0, 10), [0.5, 5000]);
    const s = { kind: "hl" as const, days, source: "test" };
    const prices: PriceBook = { EURUSD: s, XAUUSD: s, GBPUSD: s };
    const fills = checkUpload({ parsed, answers, prices, signedIn: true }).card4.find((c) => c.id === "fills")!;
    expect(fills.status).not.toBe("na");
    // The Verify page and the compare page now give the same answer for the same file.
    expect(checkUpload({ parsed, answers, prices: null, signedIn: false }).card4.find((c) => c.id === "fills")!.detail).toBe(SIGNED_OUT_PRICES);
    expect(PAGE_SIGNED_OUT).toBe(SIGNED_OUT_PRICES);
  });

  // Bug: the compare page assumed an equity curve had no deposits without asking.
  it("asks about deposits for an equity curve with no column for them", async () => {
    const { container } = render(<ComparePage />);
    const curve = ["date,equity", ...Array.from({ length: 28 }, (_, i) => `2024-02-${String(i + 1).padStart(2, "0")},${10000 + i * 10}`)].join("\n");
    fireEvent.change(container.querySelector('input[aria-label="Trade file for record B"]')!, { target: { files: [fileOf(curve, "b.csv")] } });
    await screen.findByText(/Found:/);
    const btn = screen.getByRole("button", { name: "Check record B" });
    expect(btn).toBeDisabled();
    fireEvent.click(screen.getByText(/There were no deposits or withdrawals/));
    expect(btn).not.toBeDisabled();
  });

  it("names each record's verdict in a plain sentence, and explains every red mark", () => {
    const parsed = parseText(fx("generic.csv"));
    const a = reportFrom(checkFile({ parsed, answers, prices: null }));
    expect(compareSentence(a, a)).toMatch(/^A: Not enough data(, [^.]+)?\. B: Not enough data/);
    const src = readFileSync(join(import.meta.dirname, "../../src/verify/ComparePage.tsx"), "utf8");
    expect(src).toContain("more wins wiped out by its worst loss");
  });
});

describe("counts read as words", () => {
  // Bug: "Only 1 trades and 0 daily returns".
  it("says 1 trade, not 1 trades", () => {
    expect(count(1, "trade")).toBe("1 trade");
    expect(count(2, "trade")).toBe("2 trades");
    expect(count(1200, "day")).toBe("1,200 days");
    const one = verdict({ trades: 1, dailyReturns: 1, contradicted: [] } as unknown as Parameters<typeof verdict>[0]);
    expect(one.sentence).toMatch(/^Only 1 trade and 1 daily return\./);
    const parsed = parseText("close_time,profit\n2024-01-03,10\n");
    const r = checkFile({ parsed, answers, prices: null });
    expect(r.verdict.sentence).toContain("Only 1 trade ");
    expect(JSON.stringify(r)).not.toMatch(/\b1 trades\b/);
  });
});

describe("charts of a short record", () => {
  // Bug: every y label read "1.0x" and every x label "2024-01" on a record of a few weeks.
  it("labels growth with two decimals under 3x and dates by day under three months", () => {
    const x = fmtOf("x");
    expect([0.98, 1, 1.02, 1.04].map(x)).toEqual(["0.98x", "1.00x", "1.02x", "1.04x"]);
    expect(x(4.5)).toBe("4.5x");
    expect(x(12)).toBe("12x");
    expect(axisLabels(["2024-01-03", "2024-01-08", "2024-01-12"])).toEqual(["2024-01-03", "2024-01-08", "2024-01-12"]);
    expect(axisLabels(["2023-01-03", "2024-01-12"])).toEqual(["2023-01", "2024-01"]);
  });
});

describe("Save as PDF on the public page", () => {
  // Bug: the PDF of a one-page report was ten pages: the introduction and all 26 file cards printed too.
  it("prints the report only", () => {
    const css = readFileSync(join(import.meta.dirname, "../../src/pages/verify/report/report.css"), "utf8");
    const print = css.slice(css.indexOf("@media print"));
    expect(print).toContain(".vp-page:has(.vf-result) :is(.vp-hero, .vp-section) { display: none !important; }");
  });
});

describe("the cookie notice never covers a focused control", () => {
  // Bug: the notice hid "Screen the accounts" completely, even with keyboard focus on it (WCAG 2.4.11).
  beforeEach(() => { localStorage.clear(); document.body.replaceChildren(); });
  it("keeps a strip free at the bottom while it shows, and gives it back when closed", async () => {
    const { mountCookieNotice } = await import("../../src/legal/notice");
    mountCookieNotice();
    await waitFor(() => expect(document.querySelector(".cn")).not.toBeNull());
    expect(document.documentElement.style.scrollPaddingBottom).toMatch(/^\d+px$/);
    expect(document.querySelector(".cn-spacer")?.getAttribute("aria-hidden")).toBe("true");
    const choose = Array.from(document.querySelectorAll<HTMLButtonElement>(".cn button")).find((b) => /Essential only|OK/.test(b.textContent ?? ""))!;
    act(() => { choose.click(); });
    expect(document.querySelector(".cn")).toBeNull();
    expect(document.querySelector(".cn-spacer")).toBeNull();
    expect(document.documentElement.style.scrollPaddingBottom).toBe("");
  });
});

describe("wide tables on the API guide", () => {
  // Bug: the API guide's tables and code scrolled sideways but could not be reached by keyboard (axe: scrollable-region-focusable).
  it("loads the scroll-region helper on the plain pages, and it covers their tables", () => {
    expect(readFileSync(join(import.meta.dirname, "../../src/legal/page.ts"), "utf8")).toContain('import "../lib/a11y/scrollRegions"');
    expect(readFileSync(join(import.meta.dirname, "../../src/lib/a11y/scrollRegions.ts"), "utf8")).toMatch(/BOXES = "[^"]*\.lg-table-wrap/);
  });
});

describe("broker connection form", () => {
  // Bug: a range the venue cannot read was only refused after the key had been sent.
  it("finds a bad range before anything is sent", () => {
    const now = Date.parse("2026-11-04T12:00:00Z");
    expect(rangeProblem("2026-02-01", "2026-01-01", "ibkr", now)).toBe("The start date is after the end date.");
    expect(rangeProblem("2024-01-01", "2026-01-01", "ibkr", now)).toMatch(/at most 365 days/);
    expect(rangeProblem("2026-01-01", "2026-12-01", "kraken", now)).toBe("The end date is in the future.");
    expect(rangeProblem("", "2026-01-01", "kraken", now)).toBe("Pick a start and an end date.");
    expect(rangeProblem("2025-11-05", "2026-11-04", "ibkr", now)).toBeNull();
  });

  it("agrees with the server's own check of the range", () => {
    const now = Date.parse("2026-11-04T12:00:00Z");
    const cases: [string, string, "ibkr" | "kraken" | "bybit"][] = [["2026-02-01", "2026-01-01", "ibkr"], ["2024-01-01", "2026-01-01", "ibkr"], ["2026-01-01", "2026-12-01", "kraken"], ["", "2026-01-01", "kraken"], ["1999-01-01", "2000-01-02", "kraken"], ["2023-01-01", "2026-01-01", "bybit"], ["2025-11-05", "2026-11-04", "ibkr"]];
    for (const [from, to, venue] of cases) {
      let server: string | null = null;
      try { readRange({ from, to }, venue, now); } catch (e) { server = (e as Error).message; }
      const page = rangeProblem(from, to, venue, now);
      // The server's words for the length use the plain number; the page's may group thousands.
      expect(page == null, `${from}..${to} ${venue}`).toBe(server == null);
      if (server && page) expect(page.replace(/,/g, "")).toBe(server.replace(/,/g, ""));
    }
  });

  it("keeps the read button off and says why, and sends nothing", async () => {
    const calls: string[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      calls.push(`${init?.method ?? "GET"} ${String(input)}`);
      return new Response(JSON.stringify({ on: true, signing: true, keep: false, alpaca: false }), { headers: { "Content-Type": "application/json" } });
    });
    const { SignedIn } = await import("../../src/pages/verify/signedIn");
    const { ConnectInput } = await import("../../src/pages/verify/ConnectInput");
    render(<SignedIn.Provider value={true}><ConnectInput onResult={() => {}} /></SignedIn.Provider>);
    await waitFor(() => expect(calls).toContain("GET /api/connect/status"));
    fireEvent.change(await screen.findByLabelText("Flex Web Service token"), { target: { value: "123456789012345678901234" } });
    fireEvent.change(screen.getByLabelText("Flex Query id"), { target: { value: "123456" } });
    const read = screen.getByRole("button", { name: "Read trades and check" });
    await waitFor(() => expect(read).not.toBeDisabled());
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2020-01-01" } });
    expect(read).toBeDisabled();
    expect(screen.getByText("Interactive Brokers can be read at most 365 days at a time. Pick a shorter range.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2099-01-01" } });
    expect(screen.getByText("The start date is after the end date.")).toBeInTheDocument();
    fireEvent.click(read);
    expect(calls.filter((c) => c.startsWith("POST"))).toEqual([]);
  });
});

describe("publishing a badge with the dataset box ticked", () => {
  // Bug: when the dataset row failed after the badge was published, the error was set but never shown.
  it("says the dataset row failed under the published badge", async () => {
    const { SharePanel, DATASET_TEXT } = await import("../../src/pages/verify/Share");
    const parsed = parseText(fx("generic.csv"));
    const r = checkFile({ parsed, answers, prices: null });
    const db = async () => ({
      from: (table: string) => ({
        insert: async () => ({ error: table === "verify_dataset" ? { message: "network down" } : null }),
        select: () => ({ order: () => ({ limit: async () => ({ data: [], error: null }) }) }),
        update: () => ({ eq: async () => ({ error: null }) }),
      }),
    });
    render(<SharePanel r={r} file={{ parsed, sha256: "c".repeat(64), name: "a.csv" }} db={db} />);
    fireEvent.change(screen.getByRole("textbox", { name: /Name for the record/ }), { target: { value: "  My bot  " } });
    fireEvent.click(screen.getByRole("checkbox", { name: DATASET_TEXT }));
    fireEvent.click(screen.getByRole("button", { name: "Publish badge" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("The badge is published, but this result was not added to the research dataset.");
    expect(screen.getByRole("img").getAttribute("alt")).not.toMatch(/ {2}My bot/);
  });
});
