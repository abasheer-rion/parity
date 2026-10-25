// Checks every Academy course file (academy/courses/*.json, DEC-0028): the shape the
// app and the public pages rely on, that every word, page and doc it points at exists,
// that every picture draws at every step, and the plain-writing rules.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { KINDS, renderScene } from "../src/academy/scenes";
import { academyHref, courses } from "../src/lib/academy";
import { termById } from "../src/lib/glossary";
import { ROUTES } from "../src/lib/space";

const ROOT = join(import.meta.dirname, "../..");

function docIds(): Set<string> {
  const ids = new Set<string>();
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".md")) {
        const m = readFileSync(p, "utf8").slice(0, 400).match(/^id:\s*(\S+)/m);
        if (m) ids.add(m[1]);
      }
    }
  };
  walk(join(ROOT, "docs"));
  return ids;
}

const DOCS = docIds();
const strings = (v: unknown): string[] => typeof v === "string" ? [v] : Array.isArray(v) ? v.flatMap(strings) : v && typeof v === "object" ? Object.values(v).flatMap(strings) : [];

describe("academy courses", () => {
  it("loads every course file, in order, with unique ids", () => {
    const files = readdirSync(join(ROOT, "academy/courses")).filter((f) => f.endsWith(".json"));
    expect(courses.length).toBe(files.length);
    expect(courses.length).toBeGreaterThanOrEqual(8);
    expect(new Set(courses.map((c) => c.id)).size).toBe(courses.length);
    expect(courses.map((c) => c.order)).toEqual([...courses.map((c) => c.order)].sort((a, b) => a - b));
  });

  for (const c of courses) {
    describe(c.id, () => {
      it("has 5 to 8 lessons of 2 to 3 minutes, with unique ids that work in a web address", () => {
        expect(c.id).toMatch(/^[a-z0-9][a-z0-9-]*$/);
        expect(c.lessons.length).toBeGreaterThanOrEqual(5);
        expect(c.lessons.length).toBeLessThanOrEqual(8);
        expect(new Set(c.lessons.map((l) => l.id)).size).toBe(c.lessons.length);
        for (const l of c.lessons) {
          expect(l.id).toMatch(/^[a-z0-9][a-z0-9-]*$/);
          expect([2, 3]).toContain(l.minutes);
          expect(l.body.length).toBeGreaterThanOrEqual(2);
        }
      });

      it("points only at glossary words, docs and pages that exist", () => {
        for (const d of c.docs) expect(DOCS, d).toContain(d);
        for (const l of c.lessons) {
          for (const t of l.terms) expect(termById[t], `${l.id}: term ${t}`).toBeTruthy();
          expect(l.inParity.length).toBeGreaterThan(0);
          for (const k of l.inParity) {
            const route = k.href.replace(/^#\//, "").split(/[/?]/)[0];
            const side = k.space === "both" ? ROUTES.both : ROUTES[k.space];
            expect(side, `${l.id}: ${k.href} on ${k.space}`).toContain(route);
            expect(academyHref(k)).toMatch(/^(https:\/\/parity\.endyland\.com\/(app|research)\/#\/|https:\/\/(trade|sim|academy)\.endyland\.com\/(#\/|$)|\/(app|research|trade|sim|academy)\/(#\/|$))/);
            const doc = k.href.match(/^#\/doc\/([A-Z]+-\d{4})/);
            if (doc) expect(DOCS, `${l.id}: ${doc[1]}`).toContain(doc[1]);
            const term = k.href.match(/^#\/learn\/([a-z0-9-]+)/);
            if (term) expect(termById[term[1]], `${l.id}: ${term[1]}`).toBeTruthy();
          }
        }
      });

      it("has a 2 or 3 question quick check with one right answer and a reason each", () => {
        for (const l of c.lessons) {
          expect(l.check.length).toBeGreaterThanOrEqual(2);
          expect(l.check.length).toBeLessThanOrEqual(3);
          for (const q of l.check) {
            expect(q.options.length).toBeGreaterThanOrEqual(2);
            expect(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length, q.q).toBe(true);
            expect(new Set(q.options).size).toBe(q.options.length);
            expect(q.why.length).toBeGreaterThan(10);
          }
        }
      });

      it("draws every picture at every step and in between, with alt text and captions", () => {
        for (const l of c.lessons) {
          const v = l.visual;
          expect(KINDS[v.kind], `${l.id}: kind ${v.kind}`).toBeTruthy();
          expect(v.alt.length, `${l.id}: alt`).toBeGreaterThan(30);
          expect(v.steps.length).toBeGreaterThanOrEqual(2);
          for (const st of v.steps) expect(st.caption.length).toBeGreaterThan(5);
          for (let s = 0; s <= v.steps.length - 1; s += 0.5) {
            const svg = renderScene(v, s);
            expect(svg, `${l.id} at ${s}`).not.toMatch(/NaN|Infinity|undefined|Unknown picture/);
            expect(svg.length).toBeGreaterThan(200);
          }
        }
      });

      it("follows the plain-writing rules and gives no advice", () => {
        for (const t of strings(c)) {
          expect(t, t).not.toMatch(/[—–“”‘’]/);
          expect(t, t).not.toMatch(/\b(you should (buy|sell)|guaranteed profit|we recommend|buy now)\b/i);
        }
      });
    });
  }
});
