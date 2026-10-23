// Prints the pictures of every Academy lesson as JSON, keyed "course/lesson", for the
// public lesson pages (scripts/seo/build_public.py runs this, DEC-0028). Each value is a
// list of SVG frames, one per step, drawn by the same code the app animates.
//
//   node --experimental-strip-types web/scripts/academy-frames.ts
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderScene, type Visual } from "../src/academy/scenes.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../academy/courses");
const out: Record<string, string[]> = {};
for (const f of readdirSync(root).filter((n) => n.endsWith(".json")).sort()) {
  const course = JSON.parse(readFileSync(join(root, f), "utf8"));
  for (const lesson of course.lessons) {
    const v = lesson.visual as Visual;
    out[`${course.id}/${lesson.id}`] = v.steps.map((_, i) => renderScene(v, i));
  }
}
process.stdout.write(JSON.stringify(out));
