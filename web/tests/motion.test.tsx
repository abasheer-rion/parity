// The motion system (REF-0023): the number ticker's arithmetic and component, the Motion
// setting (read, write, storage failures) and how it resolves against the device.
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnimatedNumber } from "../src/ui/motion";
import { applyMotionPref, currentMotionPref, MOTION_KEY, motionLevel, motionOff, readMotionPref, resolveMotion, writeMotionPref } from "../src/ui/motionCore";
import { useMotionLevel } from "../src/ui/motionPref";
import { MotionControl } from "../src/ui/motionSetting";
import { easeOutCubic, progressAt, tickAt, tickerWidth } from "../src/ui/ticker";

function mockDevice(reduced: boolean) {
  const mq = { matches: reduced, media: "(prefers-reduced-motion: reduce)", addEventListener: vi.fn(), removeEventListener: vi.fn() };
  Object.defineProperty(window, "matchMedia", { configurable: true, writable: true, value: vi.fn(() => mq) });
}

beforeEach(() => {
  window.localStorage.clear();
  delete document.documentElement.dataset.motion;
  delete document.documentElement.dataset.motionOff;
  mockDevice(false);
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("ticker arithmetic", () => {
  it("eases from 0 to 1, fast first, and clamps outside the range", () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutCubic(-1)).toBe(0);
    expect(easeOutCubic(2)).toBe(1);
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5);
  });

  it("starts at the old value, ends exactly on the new one and never overshoots", () => {
    expect(tickAt(10, 20, 0)).toBe(10);
    expect(tickAt(10, 20, 1)).toBe(20);
    let last = 10;
    for (let p = 0.05; p < 1; p += 0.05) {
      const v = tickAt(10, 20, p);
      expect(v).toBeGreaterThanOrEqual(last);
      expect(v).toBeLessThanOrEqual(20);
      last = v;
    }
    expect(tickAt(5, -5, 0.5)).toBeLessThan(5);
  });

  it("measures progress against the duration", () => {
    expect(progressAt(100, 100, 400)).toBe(0);
    expect(progressAt(100, 300, 400)).toBe(0.5);
    expect(progressAt(100, 900, 400)).toBe(1);
    expect(progressAt(100, 50, 400)).toBe(0);
    expect(progressAt(0, 0, 0)).toBe(1);
  });

  it("holds the width of the longer value, so nothing beside it moves", () => {
    const f = (v: number) => `$${Math.round(v).toLocaleString("en-US")}`;
    expect(tickerWidth(f, 999, 1000)).toBe("$1,000".length);
    expect(tickerWidth(f, 1000, 5)).toBe("$1,000".length);
  });
});

describe("the Motion setting", () => {
  it("defaults to matching the device", () => {
    expect(readMotionPref()).toBe("system");
  });

  it("writes the choice, puts it on <html data-motion> and reads it back", () => {
    writeMotionPref("full");
    expect(window.localStorage.getItem(MOTION_KEY)).toBe("full");
    expect(document.documentElement.dataset.motion).toBe("full");
    expect(readMotionPref()).toBe("full");
    writeMotionPref("system");
    expect(window.localStorage.getItem(MOTION_KEY)).toBeNull();
    expect(document.documentElement.dataset.motion).toBe("system");
  });

  it("ignores a stored value it does not know", () => {
    window.localStorage.setItem(MOTION_KEY, "fast");
    expect(readMotionPref()).toBe("system");
  });

  it("keeps working when storage is blocked", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    expect(readMotionPref()).toBe("system");
    expect(() => writeMotionPref("reduced")).not.toThrow();
    // The choice still applies to this page.
    expect(document.documentElement.dataset.motion).toBe("reduced");
    expect(currentMotionPref()).toBe("reduced");
    expect(motionLevel()).toBe("reduced");
  });

  it("Off is reduced for every reduced-motion rule, and marks <html data-motion-off> (DEC-0085)", () => {
    writeMotionPref("off");
    expect(window.localStorage.getItem(MOTION_KEY)).toBe("off");
    expect(document.documentElement.dataset.motion).toBe("reduced");
    expect(document.documentElement.dataset.motionOff).toBe("1");
    expect(currentMotionPref()).toBe("off");
    expect(motionOff()).toBe(true);
    expect(motionLevel()).toBe("reduced");
    expect(resolveMotion("off", false)).toBe("reduced");
    writeMotionPref("full");
    expect(document.documentElement.dataset.motionOff).toBeUndefined();
    expect(motionOff()).toBe(false);
  });

  it("applies a stored choice at start", () => {
    window.localStorage.setItem(MOTION_KEY, "reduced");
    applyMotionPref();
    expect(document.documentElement.dataset.motion).toBe("reduced");
  });
});

describe("reduced-motion resolution", () => {
  it("follows the device by default and lets the choice win either way", () => {
    expect(resolveMotion("system", false)).toBe("full");
    expect(resolveMotion("system", true)).toBe("reduced");
    expect(resolveMotion("full", true)).toBe("full");
    expect(resolveMotion("full", false)).toBe("full");
    expect(resolveMotion("reduced", false)).toBe("reduced");
    expect(resolveMotion("reduced", true)).toBe("reduced");
  });

  it("reads the device: a Mac with Reduce Motion on gets reduced, unless the choice is Full", () => {
    mockDevice(true);
    expect(motionLevel()).toBe("reduced");
    writeMotionPref("full");
    expect(motionLevel()).toBe("full");
  });

  it("updates hooks and the control when the choice changes", () => {
    function Level() { return <output data-testid="level">{useMotionLevel()}</output>; }
    mockDevice(true);
    render(<><MotionControl /><Level /></>);
    expect(screen.getByTestId("level")).toHaveTextContent("reduced");
    fireEvent.click(screen.getByRole("radio", { name: "Full" }));
    expect(screen.getByTestId("level")).toHaveTextContent("full");
    expect(screen.getByRole("radio", { name: "Full" })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByRole("radio", { name: "Match my device" }));
    expect(screen.getByTestId("level")).toHaveTextContent("reduced");
  });
});

describe("AnimatedNumber", () => {
  const f = (v: number) => v.toFixed(0);

  it("shows the exact value straight away", () => {
    render(<AnimatedNumber value={42} format={f} />);
    expect(screen.getByText("42")).toHaveClass("ui-anum");
  });

  it("jumps to the new value with reduced motion", () => {
    writeMotionPref("reduced");
    const { rerender, container } = render(<AnimatedNumber value={10} format={f} />);
    rerender(<AnimatedNumber value={90} format={f} />);
    expect(container.textContent).toBe("90");
  });

  it("glides through values in between, holds its width, then lands on the value", () => {
    writeMotionPref("full");
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => { frames.push(cb); return frames.length; });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
    let now = 1000;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    const { rerender, container } = render(<AnimatedNumber value={10} format={f} ms={400} />);
    const el = container.querySelector(".ui-anum") as HTMLElement;
    rerender(<AnimatedNumber value={1000} format={f} ms={400} />);
    expect(el.style.minWidth).toBe("4ch");
    act(() => { frames.shift()!(now + 200); });
    const mid = Number(container.textContent);
    expect(mid).toBeGreaterThan(10);
    expect(mid).toBeLessThan(1000);
    now += 400;
    act(() => { frames.shift()!(now + 400); });
    expect(container.textContent).toBe("1000");
    expect(el.style.minWidth).toBe("");
  });

  it("counts up from a starting value the first time it shows", () => {
    writeMotionPref("full");
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => { frames.push(cb); return frames.length; });
    vi.spyOn(performance, "now").mockImplementation(() => 0);
    const { container } = render(<AnimatedNumber value={50} from={0} format={f} ms={100} />);
    expect(container.textContent).toBe("0");
    act(() => { frames.shift()!(200); });
    expect(container.textContent).toBe("50");
  });
});
