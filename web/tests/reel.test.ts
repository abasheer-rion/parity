// Motion reels (DEC-0085): the Academy lesson films. Checks the timeline (beats, caption
// words, chapters, the voice-over files), that every film draws at every moment and size,
// that the "Reading a backtest" and "Luck vs skill" lessons all have one, that the
// pre-rendered MP4 of each is current, and that the player's markup survives sanitising.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import DOMPurify from "dompurify";
import { describe, expect, it } from "vitest";
import { courseById, reelVideo } from "../src/lib/academy";
import { beatAt, chapterAt, clock, pageAt, plain, plan, script, vtt, words, type Reel } from "../src/ui/reel/timeline";
import { headAt, renderReel, sAt, REEL_SIZES, type ReelSize } from "../src/ui/reel/render";
import { tipAt, seriesValues } from "../src/ui/signature/scenes";
import { lessonReels, reelHash, reelRisk } from "../scripts/content/reels";

const ROOT = join(import.meta.dirname, "../..");
const REELS = lessonReels(ROOT);
const SIZES = Object.keys(REEL_SIZES) as ReelSize[];

describe("the reel timeline", () => {
  it("reads starred words as the ones that light up, with punctuation outside the star", () => {
    expect(words("Put *$100* away")).toEqual([{ text: "Put", em: false }, { text: "$100", em: true }, { text: "away", em: false }]);
    expect(words("more than *seven times* the money.")).toEqual([
      { text: "more", em: false }, { text: "than", em: false }, { text: "seven", em: true }, { text: "times", em: true }, { text: "the", em: false }, { text: "money.", em: false },
    ]);
    expect(words("*look the same*.").map((w) => w.text)).toEqual(["look", "the", "same."]);
    expect(plain("A *b* c")).toBe("A b c");
  });

  it("times beats back to back, carries the chart, and cuts on a new shot", () => {
    const reel: Reel = {
      alt: "test", beats: [
        { say: "one two three", shot: { kind: "statement", lines: [{ text: "Hi" }] }, chapter: "A" },
        { say: "four five six seven", shot: { kind: "chart" }, s: 0, head: { tip: 0 } },
        { say: "eight", s: 2, cam: { z: 1.3 } },
        { say: "nine ten", chapter: "B" },
      ],
    };
    const p = plan(reel);
    expect(p.beats[0].start).toBe(0);
    for (let i = 1; i < p.beats.length; i++) expect(p.beats[i].start).toBeCloseTo(p.beats[i - 1].end, 9);
    expect(p.seconds).toBeCloseTo(p.beats[3].end, 9);
    // The chart draws in from empty, then carries on from where it was.
    expect([p.beats[1].s0, p.beats[1].s1]).toEqual([-1, 0]);
    expect([p.beats[2].s0, p.beats[2].s1]).toEqual([0, 2]);
    expect([p.beats[3].s0, p.beats[3].s1]).toEqual([2, 2]);
    expect(p.beats[2].shotKey).toBe(p.beats[1].shotKey);
    expect(p.beats[1].shotKey).not.toBe(p.beats[0].shotKey);
    // The camera holds where the last beat left it.
    expect(p.beats[3].cam0.z).toBeCloseTo(1.3);
    // The head carries on until changed.
    expect(p.beats[3].head).toEqual({ tip: 0 });
    expect(p.chapters.map((c) => c.title)).toEqual(["A", "B"]);
    expect(chapterAt(p, p.beats[3].start + 0.1).title).toBe("B");
    expect(beatAt(p, p.beats[2].start + 0.01).i).toBe(2);
    // Every word is said inside its own beat, in order.
    const all = p.pages.flatMap((pg) => pg.words);
    expect(all.map((w) => w.text).join(" ")).toBe("one two three four five six seven eight nine ten");
    for (let i = 1; i < all.length; i++) expect(all[i].at).toBeGreaterThan(all[i - 1].at);
    expect(pageAt(p, all[4].at + 0.01)?.words.map((w) => w.text)).toContain("five");
    // The chart moves within its beat and lands on the step.
    expect(sAt(p.beats[2], p.beats[2].end)).toBeCloseTo(2);
    expect(sAt(p.beats[2], p.beats[2].start)).toBeCloseTo(0);
  });

  it("writes captions as WebVTT and the voice-over script with times", () => {
    const p = plan({ alt: "x", beats: [{ say: "Hello there, *friend*.", chapter: "Start" }, { say: "Second line here." }] });
    const v = vtt(p);
    expect(v.startsWith("WEBVTT\n\n1\n00:00:00.")).toBe(true);
    expect(v).toContain("friend.");
    expect(v).not.toContain("*");
    expect(script(p)).toMatch(/^\[Start\]\n0:00 {2}Hello there, friend\.\n0:0\d {2}Second line here\.\n$/);
    expect(clock(75)).toBe("1:15");
  });
});

describe("lesson films", () => {
  it("covers all 5 Reading a backtest and all 5 Luck vs skill lessons", () => {
    for (const id of ["reading-a-backtest", "luck-vs-skill"]) {
      const c = courseById[id];
      expect(c.lessons.length).toBe(5);
      for (const l of c.lessons) expect(l.reel, `${id}/${l.id}`).toBeTruthy();
    }
    expect(REELS.length).toBeGreaterThanOrEqual(10);
  });

  for (const r of REELS) {
    describe(r.id, () => {
      const P = plan(r.reel);

      it("runs 30 to 90 seconds in chapters, with a full description and plain words", () => {
        expect(P.seconds).toBeGreaterThanOrEqual(30);
        expect(P.seconds).toBeLessThanOrEqual(90);
        expect(P.chapters.length).toBeGreaterThanOrEqual(2);
        expect(r.reel.alt.length).toBeGreaterThan(60);
        expect(r.reel.tag, "what the numbers are").toBeTruthy();
        for (const b of r.reel.beats) {
          expect(plain(b.say).length).toBeGreaterThan(5);
          expect(b.say, b.say).not.toMatch(/[—–“”‘’]/);
          expect((b.say.match(/\*/g) ?? []).length % 2, `${b.say}: stars come in pairs`).toBe(0);
        }
        expect(r.reel.beats[0].shot, "the first beat names its shot").toBeTruthy();
      });

      it("points at series and steps the chart has", () => {
        const last = r.visual.steps.length - 1;
        for (const b of P.beats) {
          if (b.shot.kind === "chart") { expect(b.s1).toBeGreaterThanOrEqual(0); expect(b.s1).toBeLessThanOrEqual(last); }
          if (b.head?.tip != null) expect(seriesValues(r.visual, b.head.tip).length, `${r.id}: tip ${b.head.tip}`).toBeGreaterThan(1);
          if (b.shot.kind === "panels" || b.shot.kind === "grid") for (const i of b.shot.series) expect(seriesValues(r.visual, i).length, `${r.id}: series ${i}`).toBeGreaterThan(1);
        }
      });

      it("draws every moment at every size, with no broken numbers", () => {
        for (const size of SIZES) {
          for (let t = 0; t <= P.seconds; t += 0.37) {
            const svg = renderReel(r.reel, r.visual, P, t, { size, captions: true, risk: reelRisk(r.reel.tag) });
            expect(svg, `${size} at ${t.toFixed(2)}`).not.toMatch(/NaN|Infinity|undefined|null/);
          }
        }
        // The big line's number follows the chart: at the end of a beat it shows the tip there.
        for (const b of P.beats.filter((x) => x.head?.tip != null && x.shot.kind === "chart")) {
          const h = headAt(r.reel, r.visual, b, b.end);
          expect(h?.text, r.id).toBeTruthy();
          expect(Number.isFinite(tipAt(r.visual, b.s1, b.head!.tip!))).toBe(true);
        }
      });

      it("has a current pre-rendered film for reduced motion", () => {
        const course = courseById[r.course];
        const lesson = course.lessons.find((l) => l.id === r.lesson)!;
        const file = JSON.parse(readFileSync(join(ROOT, "academy/reels.json"), "utf8")).reels[r.id];
        expect(file, `${r.id}: render it with npm run content -- --reels --scenes ${r.id}`).toBeTruthy();
        expect(file.hash, `${r.id} changed since its film was rendered: npm run content -- --reels --scenes ${r.id}`).toBe(reelHash(r.reel, r.visual));
        expect(existsSync(join(ROOT, "web/public", file.mp4)), file.mp4).toBe(true);
        expect(existsSync(join(ROOT, "web/public", file.vtt)), file.vtt).toBe(true);
        expect(reelVideo(course, lesson)).toEqual({ mp4: file.mp4, vtt: file.vtt });
      });
    });
  }

  it("keeps the camera, blur and gradients through the sanitiser the player uses", () => {
    const r = REELS[0];
    const P = plan(r.reel);
    // A moment inside a cut, where both pictures blur.
    const cut = P.beats.find((b, i) => i > 0 && b.shotKey !== P.beats[i - 1].shotKey)!;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg">${renderReel(r.reel, r.visual, P, cut.start + 0.15, { id: "t" })}</svg>`;
    const clean = DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true, svgFilters: true } });
    expect(clean).toMatch(/<filter[^>]*id="t-/);
    expect(clean).toMatch(/feGaussianBlur|fegaussianblur/i);
    expect(clean).toMatch(/filter="url\(#t-/);
    expect(clean).toMatch(/radialGradient|radialgradient/i);
  });

  it("names the risk line after what the numbers are", () => {
    expect(reelRisk("Hypothetical example")).toMatch(/^Hypothetical/);
    expect(reelRisk("Simulated example")).toMatch(/^Simulated/);
    expect(reelRisk("Real result, official run 1")).toMatch(/^Past results/);
    expect(reelRisk("Carry real, others simulated")).toMatch(/^Past and simulated/);
  });
});
