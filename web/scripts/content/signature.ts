// Clips in the signature chart style (DEC-0067): the Academy lessons drawn with the
// signature scenes, plus a few short methodology explainers. Each clip is one visual
// played step by step at 9:16 or 1:1 by render.ts (`npm run content -- --signature`).
//
// A clip's timeline: the first step draws in from an empty chart, then each step eases to
// the next and holds long enough to read its caption, and the last step (the verdict)
// holds a little longer. Frames come from renderSignature, the same code the Academy and
// the strategy pages draw with, so a clip frame and a lesson still are the same picture.
//
// Plain TypeScript with type-only syntax, so Node can run it with type stripping.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { renderSignature, SCENES, type SigVisual } from "../../src/ui/signature/scenes.ts";
import { EXAMPLES } from "../../src/ui/signature/examples.ts";
import { rng } from "../../src/ui/signature/core.ts";
import { THEMES } from "../../src/ui/signature/theme.ts";
import { esc, RISK, SITE } from "./scenes.ts";

export interface SigClip {
  id: string;
  /** The clip title, for the manifest. */
  title: string;
  /** What the numbers are, shown top right in every frame. */
  tag: string;
  visual: SigVisual;
  social: { caption: string; hashtags: string[] };
}

export type ClipSize = "vertical" | "square";

const TAGS = ["#investing", "#backtest", "#finance", "#education"];
const DRAW_IN = 1.4, MOVE = 1.0, TAIL = 1.2;

/** Seconds a step holds: enough to read its caption (about 15 characters a second), at least 2.6. */
function dwell(caption: string): number {
  return Math.max(2.6, caption.length / 15);
}

/** The clip's timeline as [start second, s at that second] pairs, then its length. */
export function timeline(v: SigVisual): { keys: [number, number][]; seconds: number } {
  const keys: [number, number][] = [[0, -1], [DRAW_IN, 0]];
  let t = DRAW_IN;
  v.steps.forEach((st, i) => {
    if (i > 0) { keys.push([t + MOVE, i]); t += MOVE; }
    t += dwell(st.caption) + (i === v.steps.length - 1 ? TAIL : 0);
    keys.push([t, i]);
  });
  return { keys, seconds: t };
}

const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

/** Position s at second t, eased between the keys. */
export function positionAt(keys: [number, number][], t: number): number {
  for (let k = 1; k < keys.length; k++) {
    const [t0, s0] = keys[k - 1], [t1, s1] = keys[k];
    if (t <= t1) return s0 === s1 || t1 === t0 ? s1 : s0 + (s1 - s0) * easeInOut((t - t0) / (t1 - t0));
  }
  return keys[keys.length - 1][1];
}

/** One whole frame as an SVG document: the scene, the brand line with its tag, and the risk line. */
export function clipFrame(c: SigClip, s: number, size: ClipSize): string {
  const w = 1080, h = size === "vertical" ? 1920 : 1080, u = size === "vertical" ? 2.6 : 2.4;
  const visual = { ...c.visual, params: { ...(c.visual.params ?? {}), tag: c.tag } };
  const body = renderSignature(visual, s, { size, theme: "dark", brand: "PARITY" });
  const y = size === "vertical" ? h * 0.965 : h - 12 * u;
  const risk = `<text x="${w / 2}" y="${Math.round(y)}" font-size="${Math.round(9.5 * u)}" fill="${THEMES.dark.muted}" text-anchor="middle" font-family="Inter, Helvetica, Arial, sans-serif">${esc(`${RISK} ${SITE}`)}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${body}${risk}</svg>`;
}

/** Signature lessons from every Academy course file. */
function lessonClips(root: string): SigClip[] {
  const dir = join(root, "academy/courses");
  const out: SigClip[] = [];
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".json")).sort()) {
    const course = JSON.parse(readFileSync(join(dir, f), "utf8"));
    for (const l of course.lessons) {
      if (!Object.prototype.hasOwnProperty.call(SCENES, l.visual?.kind)) continue;
      out.push({
        id: `academy-${course.id}-${l.id}`,
        title: `${course.title}: ${l.title}`,
        tag: "Hypothetical example",
        visual: l.visual,
        social: { caption: `${l.title}, from the free Parity Academy course "${course.title}". Hypothetical numbers, for learning.`, hashtags: TAGS },
      });
    }
  }
  return out;
}

/** A bootstrap of a strategy's Sharpe ratio with its 95% range (made-up, seeded numbers). */
function bootstrapVisual(): SigVisual {
  const g = rng(41);
  const samples = Array.from({ length: 1000 }, () => Math.round((0.62 + 0.2 * g.normal()) * 100) / 100).sort((a, b) => a - b);
  const lo = samples[25], hi = samples[974];
  return {
    kind: "distribution",
    alt: `Example data. The Sharpe ratio of one strategy recomputed on 1,000 resamples of its own months. 95% of them land between ${lo.toFixed(2)} and ${hi.toFixed(2)}, all above zero. The measured Sharpe ratio is 0.62.`,
    params: {
      samples, bins: 30, fmt: "num2", par: 0, parLabel: "Zero", band: { lo, hi, label: "95% of resamples" },
      marker: { value: 0.62, label: "Measured", tone: "accent" }, countLabel: "Resamples", beatLabel: "Of the resamples below it", ends: { low: "Worse", high: "Better" },
    },
    steps: [
      { caption: "Shuffle a strategy's own months into 1,000 new histories and measure the Sharpe ratio of each.", grow: 1 },
      { caption: `95% of the resamples land between ${lo.toFixed(2)} and ${hi.toFixed(2)}. That is the error bar.`, band: 1 },
      { caption: "The measured Sharpe ratio sits in the middle of its own range.", marker: 1 },
      { caption: "A range that stays above zero is harder to explain with luck.", verdict: `The whole 95% range, ${lo.toFixed(2)} to ${hi.toFixed(2)}, stays above zero.`, tone: "pos" },
    ],
  };
}

/** Short methodology explainers on the example data from the signature package. */
function explainers(): SigClip[] {
  const ex = (id: string, title: string, visual: SigVisual, caption: string, tag = "Example data"): SigClip => ({ id: `explainer-${id}`, title, tag, visual, social: { caption, hashtags: TAGS } });
  return [
    ex("equity-vs-benchmark", "Beating the market, step by step", EXAMPLES.equity, "Does a strategy beat the market? Same start, same dates, then look at the falls. Example data.", "Example data, 2005 to 2024"),
    ex("bootstrap-band", "Error bars on a Sharpe ratio", bootstrapVisual(), "One backtest is one history. Resample it 1,000 times to see how wide the error bars are. Example data."),
    ex("regimes", "Where a strategy wins and loses", { ...EXAMPLES.regimes, params: { ...EXAMPLES.regimes.params, label: "Kinds of market it won" } }, "Rates rising or falling, calm or wild markets, crises: where does a strategy make its money? Example data."),
    ex("underwater", "How far below the last high", EXAMPLES.underwater, "The worst fall and how long it took to climb back. Example data.", "Example data, 2005 to 2024"),
    ex("verdict", "The numbers and the verdict", EXAMPLES.scorecard, "Sharpe ratio, the chance it is more than luck after every try, the worst fall and the error bars, then a verdict. Example data."),
  ];
}

export function signatureClips(root: string): SigClip[] {
  return [...lessonClips(root), ...explainers()];
}
