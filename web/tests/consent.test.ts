import { afterEach, describe, expect, it, vi } from "vitest";
import { allowed, getConsent, hasDecided, onConsentChange, resetConsent, setConsent, STORAGE_KEY, VERSION, whenAllowed } from "../src/legal/consent";

afterEach(() => {
  resetConsent();
  localStorage.clear();
});

describe("consent", () => {
  it("starts undecided, with only essential allowed", () => {
    expect(getConsent()).toBeNull();
    expect(hasDecided()).toBe(false);
    expect(allowed("essential")).toBe(true);
    expect(allowed("analytics")).toBe(false);
  });

  it("remembers the choice in localStorage", () => {
    setConsent({ analytics: false });
    expect(hasDecided()).toBe(true);
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored).toMatchObject({ version: VERSION, essential: true, analytics: false });
  });

  it("keeps analytics off while no analytics tool exists, even if asked or tampered with", () => {
    expect(setConsent({ analytics: true }).analytics).toBe(false);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: VERSION, essential: true, analytics: true, decidedAt: "2026-10-22" }));
    expect(allowed("analytics")).toBe(false);
  });

  it("asks again when the notice version changes", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: VERSION - 1, essential: true, analytics: false, decidedAt: "2026-01-01" }));
    expect(hasDecided()).toBe(false);
  });

  it("survives damaged or blocked storage", () => {
    localStorage.setItem(STORAGE_KEY, "{not json");
    expect(getConsent()).toBeNull();
    const get = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    const set = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    expect(() => setConsent()).not.toThrow();
    // Kept in memory for this page.
    expect(hasDecided()).toBe(true);
    get.mockRestore();
    set.mockRestore();
  });

  it("never runs non-essential code without consent", () => {
    const load = vi.fn();
    const stop = whenAllowed("analytics", load);
    setConsent({ analytics: true });
    expect(load).not.toHaveBeenCalled();
    stop();
    const essential = vi.fn();
    whenAllowed("essential", essential);
    expect(essential).toHaveBeenCalledOnce();
  });

  it("tells listeners about changes", () => {
    const fn = vi.fn();
    const stop = onConsentChange(fn);
    setConsent();
    resetConsent();
    stop();
    setConsent();
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
