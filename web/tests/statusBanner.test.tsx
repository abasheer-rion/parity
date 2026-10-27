// The warnings banner (DEC-0073): which warnings show, closing one, failing quietly, the
// plain-page script doing the same as the app, and colours that pass WCAG 2.2 AA (DEC-0061).
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInThisContext } from "node:vm";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StatusBanner } from "../src/components/StatusBanner";
import { DISMISS_KEY, dismiss, LEVELS, loadStatus, parseStatus, readDismissed, safeLink, visibleWarnings } from "../src/lib/statusBanner";

const DOC = {
  generated: "2026-10-26T15:00:00Z",
  warnings: [
    { id: "live-feed-down", level: "outage", title: "Live prices are not updating", detail: "Charts may show old prices.", link: "/status/", start: "" },
    { id: "data-degraded", level: "info", title: "Some data series are behind", detail: "", link: "javascript:alert(1)", start: "" },
    { id: "bad", level: "red", title: "Not a level" },
  ],
};
const ok = (body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })) as unknown as typeof fetch;
// The repository's own file, run as the browser would run a classic script.
const SCRIPT_FILE = resolve(import.meta.dirname, "../public/status-banner.js");
const SCRIPT = readFileSync(SCRIPT_FILE, "utf8");

/** A plain page: a header, an optional banner slot and a main. */
function plainPage(slot: boolean) {
  document.body.replaceChildren();
  document.body.append(document.createElement("header"));
  if (slot) {
    const s = document.createElement("div");
    s.setAttribute("data-status-banner", "");
    s.setAttribute("data-offset", "64");
    document.body.append(s);
  }
  document.body.append(document.createElement("main"));
}

beforeEach(() => localStorage.clear());
afterEach(() => { document.head.querySelectorAll("style").forEach((s) => s.remove()); document.body.replaceChildren(); });

describe("banner rules", () => {
  it("keeps well-formed warnings and drops unsafe links", () => {
    const w = parseStatus(DOC);
    expect(w.map((x) => x.id)).toEqual(["live-feed-down", "data-degraded"]);
    expect(w[1].link).toBe("");
    expect(parseStatus(null)).toEqual([]);
    expect(safeLink("//evil.example")).toBe("");
    expect(safeLink("https://github.com/x")).toBe("https://github.com/x");
  });

  it("remembers closed warnings and survives blocked storage", () => {
    expect(dismiss(localStorage, "a")).toEqual(["a"]);
    expect(readDismissed(localStorage)).toEqual(["a"]);
    const blocked = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
    expect(readDismissed(blocked)).toEqual([]);
    expect(dismiss(blocked, "b")).toEqual(["b"]);
    expect(visibleWarnings(parseStatus(DOC), ["live-feed-down"]).map((x) => x.id)).toEqual(["data-degraded"]);
  });

  it("returns nothing when the file is missing or the network fails", async () => {
    expect(await loadStatus(vi.fn(async () => new Response("", { status: 404 })) as unknown as typeof fetch)).toEqual([]);
    expect(await loadStatus(vi.fn(async () => { throw new Error("offline"); }) as unknown as typeof fetch)).toEqual([]);
  });

  it("every level's text passes 4.5:1 on its own background", () => {
    const lum = (hex: string) => {
      const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    };
    for (const l of Object.values(LEVELS)) {
      const [a, b] = [lum(l.fg), lum(l.bg)].sort((x, y) => y - x);
      expect((a + 0.05) / (b + 0.05)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("the plain-page script and its stylesheet use the same key and colours", () => {
    expect(SCRIPT).toContain(`"${DISMISS_KEY}"`);
    for (const l of Object.values(LEVELS)) {
      for (const c of [l.bg, l.fg, l.edge]) expect(SCRIPT).toContain(c);
      expect(SCRIPT).toContain(l.word);
    }
    expect(SCRIPT).not.toMatch(/inner[H]TML/); // text goes in with textContent only
  });
});

describe("StatusBanner in the app", () => {
  it("shows current warnings in a polite live region and closes one", async () => {
    render(<StatusBanner fetcher={ok(DOC)} />);
    await screen.findByText(/Live prices are not updating/);
    const region = screen.getByRole("status");
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region.querySelectorAll(".psb-item")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: /Dismiss this notice: Live prices/ }));
    expect(screen.queryByText(/Live prices are not updating/)).toBeNull();
    expect(readDismissed(localStorage)).toEqual(["live-feed-down"]);
  });

  it("shows nothing when there are no warnings", async () => {
    const f = ok({ generated: "", warnings: [] });
    const { container } = render(<StatusBanner fetcher={f} />);
    await waitFor(() => expect(f).toHaveBeenCalled());
    expect(container.querySelector(".psb")).toHaveAttribute("hidden");
    expect(container.querySelector(".psb-item")).toBeNull();
  });
});

describe("status-banner.js on the plain pages", () => {
  async function run(fetcher: typeof fetch) {
    vi.stubGlobal("fetch", fetcher);
    runInThisContext(SCRIPT, { filename: SCRIPT_FILE });
    await act(async () => { await new Promise((r) => setTimeout(r, 120)); });
    vi.unstubAllGlobals();
  }

  it("fills the slot after the header and closes a warning", async () => {
    plainPage(true);
    await run(ok(DOC));
    const slot = document.querySelector<HTMLElement>("[data-status-banner]")!;
    expect(slot.querySelectorAll(".psb-item")).toHaveLength(2);
    expect(slot.querySelector('[role="status"]')).not.toBeNull();
    expect(slot.style.paddingTop).toBe("64px");
    expect(slot.querySelector(".psb-info a")).toBeNull(); // the unsafe link was dropped
    slot.querySelector<HTMLButtonElement>(".psb-outage .psb-x")!.click();
    expect(slot.querySelectorAll(".psb-item")).toHaveLength(1);
    expect(readDismissed(localStorage)).toEqual(["live-feed-down"]);
  });

  it("adds nothing when the fetch fails or every warning was closed before", async () => {
    plainPage(false);
    await run(vi.fn(async () => { throw new Error("offline"); }) as unknown as typeof fetch);
    expect(document.querySelector(".psb")).toBeNull();
    localStorage.setItem(DISMISS_KEY, JSON.stringify(["live-feed-down", "data-degraded"]));
    await run(ok(DOC));
    expect(document.querySelector(".psb")).toBeNull();
  });
});
