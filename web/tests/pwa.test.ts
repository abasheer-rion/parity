// The installable site (DEC-0041): the manifests, the service worker's rules and the
// install card.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { isIosSafari, showCard } from "../src/pwa/install";

const pub = (p: string) => resolve(import.meta.dirname, "../public", p);

describe("manifests", () => {
  for (const file of ["manifest.webmanifest", "trade/manifest.webmanifest", "sim/manifest.webmanifest"]) {
    it(`${file} is installable`, () => {
      const m = JSON.parse(readFileSync(pub(file), "utf8"));
      expect(m.name).toBeTruthy();
      expect(m.display).toBe("standalone");
      expect(m.start_url.startsWith(m.scope)).toBe(true);
      expect(m.icons.some((i: { sizes: string }) => i.sizes === "512x512")).toBe(true);
      expect(JSON.stringify(m)).not.toMatch(/[–—]/);
    });
  }
  it("the main manifest has a maskable icon and a shortcut per app", () => {
    const m = JSON.parse(readFileSync(pub("manifest.webmanifest"), "utf8"));
    expect(m.icons.some((i: { purpose?: string }) => i.purpose === "maskable")).toBe(true);
    expect(m.shortcuts.map((s: { url: string }) => s.url)).toEqual(["/app/#/verify", "/trade/", "/research/", "/sim/"]);
  });
});

describe("service worker", () => {
  const sw = readFileSync(pub("sw.js"), "utf8");
  const never = new RegExp(sw.match(/const NEVER = \/(.+)\/;/)![1]);
  const assets = new RegExp(sw.match(/const ASSETS = \/(.+)\/;/)![1]);
  it("never caches research data, dev files, share images or badges", () => {
    for (const p of ["/data/latest.json", "/local/x.json", "/og/default.png", "/badge/ABC.svg", "/s/fx_carry"]) expect(never.test(p)).toBe(true);
    for (const p of ["/app/", "/trade/", "/", "/offline.html"]) expect(never.test(p)).toBe(false);
  });
  it("treats only hashed build output as assets", () => {
    for (const p of ["/assets/a-1.js", "/app/assets/b.css", "/sim/assets/c.js", "/trade/assets/d.js"]) expect(assets.test(p)).toBe(true);
    for (const p of ["/app/", "/data/assets/x.json", "/brand/x.svg"]) expect(assets.test(p)).toBe(false);
  });
  it("never keeps a redirect or an error", () => {
    expect(sw).toMatch(/res\.ok && res\.type === "basic" && !res\.redirected/);
  });
});

describe("install card", () => {
  it("knows iPhone Safari from other iPhone browsers", () => {
    const safari = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
    expect(isIosSafari(safari, 5)).toBe(true);
    expect(isIosSafari(safari.replace("Version/18.0", "CriOS/130.0"), 5)).toBe(false);
    expect(isIosSafari("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15", 0)).toBe(false);
  });
  it("shows one card, fixed, and Not now removes it", () => {
    expect(showCard("Tap the Share button, then Add to Home Screen.", null)).toBe(true);
    expect(showCard("again", null)).toBe(false);
    const card = document.querySelector(".pwa-card")!;
    expect(card.textContent).toContain("Add to Home Screen");
    (card.querySelector("button") as HTMLButtonElement).click();
    expect(document.querySelector(".pwa-card")).toBeNull();
  });
});
