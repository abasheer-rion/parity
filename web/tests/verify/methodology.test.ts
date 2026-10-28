// The public methodology page (/methodology/, REF-0030) prints the method version, its
// changelog and the key thresholds from the code, so it cannot drift from what runs.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { fillMethodology, METHOD_VALUES } from "../../plugins/legal";
import { LUCK_LINE } from "../../src/lib/verify/dsr";
import { MIN_RETURNS, MIN_TRADES } from "../../src/lib/verify/checks/verdict";
import { METHOD_CHANGELOG, METHOD_VERSION } from "../../src/lib/verify/types";

const raw = readFileSync(resolve(import.meta.dirname, "../../methodology/index.html"), "utf8");
const html = fillMethodology(raw);

describe("methodology page", () => {
  it("lists the current method version first in the changelog", () => {
    expect(METHOD_CHANGELOG[0].version).toBe(METHOD_VERSION);
    expect(new Set(METHOD_CHANGELOG.map((c) => c.version)).size).toBe(METHOD_CHANGELOG.length);
  });

  it("prints the method version, every changelog row and the thresholds from the code", () => {
    expect(html).toContain(`Method version <code>${METHOD_VERSION}</code>`);
    expect(html).toContain(`version ${METHOD_VERSION}. https://paritytrading.app/methodology/`);
    for (const c of METHOD_CHANGELOG) expect(html).toContain(`<code>${c.version}</code></td><td>${c.date}</td>`);
    expect(html).toContain(`Fewer than ${MIN_TRADES} trades and fewer than ${MIN_RETURNS} daily returns`);
    expect(html).toContain(`below ${LUCK_LINE.toFixed(2)}`);
    expect(html).not.toMatch(/<!--verify:/);
  });

  it("has the linkable sections and no em or en dashes", () => {
    for (const id of ["verdict", "luck", "lookahead", "trust", "cite", "changelog"]) expect(html).toContain(`id="${id}"`);
    expect(html).not.toMatch(/[–—]/);
    expect(Object.values(METHOD_VALUES).join(" ")).not.toMatch(/[–—]/);
  });

  it("refuses an unknown marker, so a typo cannot ship", () => {
    expect(() => fillMethodology("<p><!--verify:no-such-thing--></p>")).toThrow(/unknown marker/);
  });
});
