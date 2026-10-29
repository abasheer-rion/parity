// The Academy lesson films (DEC-0085) for the clip renderer: every lesson with a `reel` in
// academy/courses/*.json, the hash that says whether its rendered MP4 is still current,
// and the risk line each one carries.
//
//   npm run content -- --reels                         every film: 9:16 and 1:1 clips with
//                                                      burned-in captions into
//                                                      ~/Desktop/parity-clips/academy-motion/,
//                                                      and the 16:9 film the Academy plays
//                                                      with reduced motion into
//                                                      web/public/content/academy/
//   npm run content -- --reels --scenes reading-a-backtest-return
//
// Plain TypeScript with type-only syntax, so Node can run it with type stripping.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { SigVisual } from "../../src/ui/signature/scenes.ts";
import type { Reel } from "../../src/ui/reel/timeline.ts";

export interface LessonReel { id: string; course: string; lesson: string; title: string; reel: Reel; visual: SigVisual; risk: string }

/** The risk line for a film, from what its numbers are. */
export function reelRisk(tag = ""): string {
  if (/real/i.test(tag) && /simulated/i.test(tag)) return "Past and simulated results, educational, not investment advice.";
  if (/real/i.test(tag)) return "Past results, educational, not investment advice.";
  if (/simulated/i.test(tag)) return "Simulated, educational, not investment advice.";
  return "Hypothetical, educational, not investment advice.";
}

/** Changes whenever the film would draw differently: its beats or the chart it draws from. */
export function reelHash(reel: Reel, visual: SigVisual): string {
  return createHash("sha256").update(JSON.stringify({ reel, visual })).digest("hex").slice(0, 16);
}

/** Every lesson film, in course order. */
export function lessonReels(root: string): LessonReel[] {
  const dir = join(root, "academy/courses");
  const out: LessonReel[] = [];
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".json")).sort()) {
    const c = JSON.parse(readFileSync(join(dir, f), "utf8"));
    for (const l of c.lessons) {
      if (!l.reel) continue;
      out.push({ id: `${c.id}-${l.id}`, course: c.id, lesson: l.id, title: `${c.title}: ${l.title}`, reel: l.reel, visual: l.visual, risk: reelRisk(l.reel.tag) });
    }
  }
  return out;
}
