// The design tokens (DEC-0058): one source in src/ui/tokens.css, copied to the places that
// cannot read CSS. These check the copies agree and the typed helpers read them right.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import site from "../src/lib/site.json";
import { THEME_COLOR } from "../src/lib/meta";
import { breakpoints, media, RAW, typePx, v } from "../src/ui/tokens";

describe("design tokens", () => {
  it("the browser bar colour is the canvas token, in site.json too (the Python SEO builder reads it)", () => {
    expect(THEME_COLOR).toBe(RAW["color-canvas"]);
    expect(site.themeColor).toBe(RAW["color-canvas"]);
  });

  it("every semantic colour resolves to a plain colour", () => {
    for (const [name, value] of Object.entries(RAW)) {
      if (!name.startsWith("color-")) continue;
      expect(value, name).toMatch(/^(#[0-9a-f]{6}|rgba\(\d+, \d+, \d+, [\d.]+\))$/);
    }
  });

  it("the type scale goes up in order", () => {
    const scale = ["type-3xs", "type-2xs", "type-xs", "type-sm", "type-md", "type-lg", "type-xl", "type-2xl", "type-3xl", "type-4xl", "type-5xl", "type-6xl", "type-7xl", "type-8xl"] as const;
    const px = scale.map(typePx);
    expect([...px].sort((a, b) => a - b)).toEqual(px);
  });

  it("breakpoints match the numbers the stylesheets use", () => {
    expect(breakpoints).toEqual({ phone: 600, tablet: 860, laptop: 1080, desktop: 1440 });
    expect(media.tabletDown).toBe("(max-width: 860px)");
  });

  it("v() writes a CSS variable", () => {
    expect(v("color-accent")).toBe("var(--color-accent)");
  });

  it("the desktop app's token file comes from the same source", () => {
    const desktop = readFileSync(resolve(import.meta.dirname, "../../desktop/electron/tokens.css"), "utf8");
    expect(desktop).toContain(`--color-canvas: ${RAW["color-canvas"]};`);
    expect(desktop).toContain(`--color-accent: ${RAW["color-accent"]};`);
  });
});
