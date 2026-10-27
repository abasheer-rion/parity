// Prints the pictures of every Academy lesson as JSON for the public lesson pages
// (scripts/seo/build_public.py runs this, DEC-0028). `frames` maps "course/lesson" to a
// list of SVG frames, one per step, drawn by the same code the app animates. Lessons on
// the signature chart system (DEC-0067) also get the numbers behind the picture in
// `tables`, the text alternative the page shows under the still.
//
//   node --experimental-strip-types web/scripts/academy-frames.ts
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isSignature, renderScene, type Visual } from "../src/academy/scenes.ts";
import { signatureTable, type SigTable } from "../src/ui/signature/scenes.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../academy/courses");
const frames: Record<string, string[]> = {};
const tables: Record<string, SigTable> = {};
for (const f of readdirSync(root).filter((n) => n.endsWith(".json")).sort()) {
  const course = JSON.parse(readFileSync(join(root, f), "utf8"));
  for (const lesson of course.lessons) {
    const v = lesson.visual as Visual;
    const key = `${course.id}/${lesson.id}`;
    frames[key] = v.steps.map((_, i) => renderScene(v, i));
    const t = isSignature(v) ? signatureTable(v) : null;
    if (t) tables[key] = t;
  }
}
process.stdout.write(JSON.stringify({ frames, tables }));
