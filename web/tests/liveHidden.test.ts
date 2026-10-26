// A hidden page draws no frames, so live updates must not wait for one (REF-0025): before,
// a background tab or hidden desktop window kept every message until it was shown again.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SourceLine } from "../src/lib/live/client";

type Internals = { handle: (m: unknown, recv: number) => void; queue: unknown[]; other: unknown[] };
const tick = (q: number) => ({ s: "BTC-USD", o: 1, p: 1, h: 1, l: 1, v: 1, n: 1, te: 1, tr: 1, ts: 1, q });
const setVisibility = (v: "hidden" | "visible") => {
  Object.defineProperty(document, "visibilityState", { value: v, configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
};

describe("live updates on a hidden page", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Frames never come, as on a hidden page.
    vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 7);
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
  });
  afterEach(() => { setVisibility("visible"); vi.restoreAllMocks(); vi.useRealTimers(); });

  it("hands updates over on a timer while hidden, so nothing piles up", () => {
    setVisibility("hidden");
    const line = new SourceLine("coingecko", null) as unknown as Internals;
    for (let i = 1; i <= 500; i++) line.handle({ op: "t", d: [tick(i)] }, 0);
    for (let i = 1; i <= 50; i++) line.handle({ op: "r", d: [["BTC-USD", 1, 0, 0, 1]], ts: 1 }, 0);
    vi.advanceTimersByTime(300);
    expect(line.queue.length).toBe(0);
    expect(line.other.length).toBe(0);
  });

  it("switches to the timer when the page is hidden with a frame already asked for", () => {
    setVisibility("visible");
    const line = new SourceLine("coingecko", null) as unknown as Internals;
    line.handle({ op: "t", d: [tick(1)] }, 0);
    setVisibility("hidden");
    for (let i = 2; i <= 100; i++) line.handle({ op: "t", d: [tick(i)] }, 0);
    vi.advanceTimersByTime(300);
    expect(line.queue.length).toBe(0);
  });
});
