// Motion reels (DEC-0083): an Academy lesson told as a short animated film instead of a
// step player. A reel is a list of beats. Each beat is one spoken line (the caption, ready
// for a voice-over), a big line at the top, and a shot: the lesson's signature chart with a
// camera, a full-screen statement, a grid of small paths, or panels side by side. Beats run
// back to back on one clock, so lines draw, numbers count and the camera moves without
// stopping, and a change of shot is a cut.
//
// This file turns a reel into a plan with times: when each beat starts, where the chart
// and the camera are at its start and end, and when each caption word is said. render.ts
// draws any moment of the plan. Both are pure, so the app, the tests and the MP4 renderer
// (web/scripts/content) draw the same frames.
//
// Node loads this file with `node --experimental-strip-types`: imports with their .ts
// extension, and only type syntax that can be stripped.
import type { FmtName, SigVisual } from "../signature/scenes.ts";
import type { Tone } from "../signature/theme.ts";

/** Where the camera looks: zoom (1 is the whole stage) and the point it centres, 0 to 1 across and down the stage. */
export interface ReelCam { z?: number; x?: number; y?: number }

/** The big line at the top. "{n}" in the text stands for a number that counts. */
export interface ReelHead {
  text?: string;
  sub?: string;
  tone?: Tone;
  /** Count from the first number to the second during the beat. */
  count?: [number, number];
  /** Follow the tip of this series of the chart as it draws (the number always matches the line). */
  tip?: number;
  /** How the number is written (default: the visual's format). */
  fmt?: FmtName;
}

export interface ReelLine { text: string; tone?: Tone }

export type ReelShot =
  /** The lesson's signature chart (or another visual in reel.visuals), moved by `s` and the camera. */
  | { kind: "chart"; visual?: string }
  /** Big words filling the screen, one line after another. */
  | { kind: "statement"; lines: ReelLine[] }
  /** Many small paths in a grid, appearing one by one (`grid` on the beat is how many show). */
  | { kind: "grid"; visual?: string; series: number[]; highlight?: number }
  /** A few series side by side on one scale, each with its number counting under it. */
  | { kind: "panels"; visual?: string; series: number[]; labels?: string[]; tones?: Tone[] };

export interface ReelBeat {
  /** The spoken line, shown as the caption. *Stars* mark the words that light up. */
  say: string;
  /** Seconds on screen. Default: long enough to say the line at an easy pace. */
  dur?: number;
  /** The big line. Left out, the last one stays; null clears it. */
  head?: ReelHead | null;
  /** Left out, the last shot carries on, so the chart keeps moving from where it was. */
  shot?: ReelShot;
  /** Chart shots: the step position reached by the end of the beat (whole numbers are the visual's steps). */
  s?: number;
  /** The camera by the end of the beat. Left out, it stays where it was. */
  cam?: ReelCam;
  /** Grid shots: how many paths show by the end of the beat. */
  grid?: number;
  /** Panel shots: how much of each line is drawn by the end of the beat, 0 to 1 (default 1). */
  draw?: number;
  /** Starts a chapter, named in the scrubber, the transcript and the storyboard. */
  chapter?: string;
}

export interface Reel {
  /** What the whole film shows, for screen readers. */
  alt: string;
  /** What the numbers are (shown top right): "Hypothetical example", "Real result, official run 1". */
  tag?: string;
  /** Top left. Default "Parity Academy". */
  brand?: string;
  /** Visuals other than the lesson's own, by name. */
  visuals?: Record<string, SigVisual>;
  beats: ReelBeat[];
  /** The poster frame, in seconds. Default: the end of the last chart beat with the camera out. */
  poster?: number;
}

export interface Word { text: string; at: number; em: boolean }
/** A few words of a caption shown together, from `from` until `to`. */
export interface CaptionPage { from: number; to: number; words: Word[]; beat: number }

export interface PlannedBeat {
  i: number;
  start: number;
  end: number;
  say: string;
  shot: ReelShot;
  /** Same key, same shot: the picture carries on. A new key is a cut. */
  shotKey: string;
  head: ReelHead | null;
  headKey: string;
  /** The count at the start and end of this beat (carried heads hold their last value). */
  count?: [number, number];
  s0: number; s1: number;
  cam0: Required<ReelCam>; cam1: Required<ReelCam>;
  g0: number; g1: number;
  d0: number; d1: number;
  pages: CaptionPage[];
  chapter?: string;
}

export interface Chapter { title: string; at: number; end: number }

export interface ReelPlan {
  beats: PlannedBeat[];
  seconds: number;
  chapters: Chapter[];
  pages: CaptionPage[];
  poster: number;
}

/** Words a second of an easy voice-over (about 155 a minute). */
export const WPS = 2.6;
/** Seconds before the first word of a beat, after its last word, and the shortest beat. */
const LEAD = 0.3, TAIL = 0.75, MIN_BEAT = 2.2;
/** The last beat holds a little longer, so the film can end before it loops. */
const LAST_HOLD = 1.4;
/** Words on one caption card at most. */
const PAGE_WORDS = 7;

export const CAM0: Required<ReelCam> = { z: 1, x: 0.5, y: 0.5 };

/** The words of a spoken line, with the starred ones marked. */
export function words(say: string): { text: string; em: boolean }[] {
  const out: { text: string; em: boolean }[] = [];
  let on = false;
  for (const raw of say.split(/\s+/).filter(Boolean)) {
    const opens = raw.startsWith("*");
    let w = opens ? raw.slice(1) : raw;
    if (opens) on = true;
    const em = on;
    // A closing star may sit before trailing punctuation: *7 times*.
    const close = w.match(/^(.*)\*([.,;:!?)]*)$/);
    if (close) { w = close[1] + close[2]; on = false; }
    if (w) out.push({ text: w, em });
  }
  return out;
}

/** The line without its stars, for the transcript and screen readers. */
export const plain = (say: string) => words(say).map((w) => w.text).join(" ");

/** Seconds a beat needs to say its line. */
export function beatSeconds(b: ReelBeat): number {
  if (typeof b.dur === "number" && b.dur > 0) return b.dur;
  return Math.max(MIN_BEAT, LEAD + words(b.say).length / WPS + TAIL);
}

const camOf = (c: ReelCam | undefined, d: Required<ReelCam>): Required<ReelCam> => ({ z: c?.z ?? d.z, x: c?.x ?? d.x, y: c?.y ?? d.y });

/** Splits a beat's words into caption cards: at the end of a sentence part, or every few words. */
function pagesOf(ws: Word[], beat: number, end: number): CaptionPage[] {
  const pages: CaptionPage[] = [];
  let cur: Word[] = [];
  const flush = () => { if (cur.length) { pages.push({ from: cur[0].at, to: end, words: cur, beat }); cur = []; } };
  for (const w of ws) {
    cur.push(w);
    if (cur.length >= PAGE_WORDS || (cur.length >= 3 && /[.,;:!?]$/.test(w.text))) flush();
  }
  // A last card of one word joins the one before it.
  if (cur.length === 1 && pages.length) pages[pages.length - 1].words.push(cur[0]);
  else flush();
  for (let i = 0; i < pages.length - 1; i++) pages[i].to = pages[i + 1].from;
  return pages;
}

/** Times for every beat, caption word and chapter of a reel. */
export function plan(reel: Reel): ReelPlan {
  const out: PlannedBeat[] = [];
  let t = 0;
  let shot: ReelShot = { kind: "chart" };
  let shotKey = "";
  let head: ReelHead | null = null;
  let headKey = "";
  let count: [number, number] | undefined;
  let cam = CAM0;
  let g = 0, d = 0;
  const lastS = new Map<string, number>();
  reel.beats.forEach((b, i) => {
    const last = i === reel.beats.length - 1;
    const dur = beatSeconds(b) + (last ? LAST_HOLD : 0);
    const nextShot = b.shot ?? shot;
    const key = JSON.stringify(nextShot);
    const cut = key !== shotKey;
    if (cut) { cam = CAM0; g = 0; d = 0; }
    const visual = nextShot.kind === "chart" || nextShot.kind === "grid" || nextShot.kind === "panels" ? nextShot.visual ?? "main" : "";
    const s0 = lastS.get(visual) ?? -1;
    const s1 = typeof b.s === "number" ? b.s : Math.max(0, s0);
    if (nextShot.kind === "chart") lastS.set(visual, s1);
    const cam1 = camOf(b.cam, cam);
    const g1 = typeof b.grid === "number" ? b.grid : nextShot.kind === "grid" ? nextShot.series.length : 0;
    const d1 = typeof b.draw === "number" ? b.draw : 1;

    if (b.head !== undefined) {
      head = b.head;
      const k = head ? JSON.stringify([head.text, head.sub, head.tone, head.tip, head.fmt]) : "";
      if (head?.count) count = head.count;
      else count = undefined;
      headKey = k;
    } else if (count) {
      count = [count[1], count[1]];
    }

    const ws = words(b.say);
    const speak = Math.max(0.1, dur - (last ? LAST_HOLD : 0) - LEAD - TAIL * 0.6);
    const step = ws.length > 1 ? Math.min(1 / WPS, speak / ws.length) : 0;
    const timed: Word[] = ws.map((w, k) => ({ ...w, at: t + LEAD + k * step }));
    out.push({
      i, start: t, end: t + dur, say: b.say, shot: nextShot, shotKey: key, head, headKey, count,
      s0: nextShot.kind === "chart" ? s0 : s1, s1, cam0: cam, cam1, g0: cut ? 0 : g, g1, d0: cut ? 0 : d, d1,
      pages: pagesOf(timed, i, t + dur), chapter: b.chapter,
    });
    shot = nextShot; shotKey = key; cam = cam1; g = g1; d = d1;
    t += dur;
  });

  const chapters: Chapter[] = [];
  for (const b of out) if (b.chapter || !chapters.length) chapters.push({ title: b.chapter ?? "Start", at: b.start, end: b.end });
  for (let i = 0; i < chapters.length; i++) chapters[i].end = i < chapters.length - 1 ? chapters[i + 1].at : t;

  // The poster: the last chart beat seen whole (camera out), else the last chart beat.
  const charts = out.filter((b) => b.shot.kind === "chart");
  const lastChart = [...charts].reverse().find((b) => b.cam1.z <= 1.05 && b.cam0.z <= 1.05) ?? charts[charts.length - 1];
  const poster = typeof reel.poster === "number" ? reel.poster : lastChart ? lastChart.end - 0.4 : t - 0.6;
  return { beats: out, seconds: t, chapters, pages: out.flatMap((b) => b.pages), poster: Math.max(0, Math.min(t, poster)) };
}

/** The beat playing at second t. */
export function beatAt(p: ReelPlan, t: number): PlannedBeat {
  let lo = 0, hi = p.beats.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (p.beats[mid].start <= t) lo = mid; else hi = mid - 1;
  }
  return p.beats[lo];
}

/** The caption card showing at second t, or null between lines. */
export function pageAt(p: ReelPlan, t: number): CaptionPage | null {
  for (const pg of p.pages) if (t >= pg.from - 0.05 && t < pg.to) return pg;
  return null;
}

/** The chapter playing at second t. */
export function chapterAt(p: ReelPlan, t: number): Chapter {
  let c = p.chapters[0];
  for (const ch of p.chapters) if (ch.at <= t + 1e-6) c = ch;
  return c;
}

/** 75 seconds as "1:15". */
export function clock(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

const vttTime = (sec: number) => {
  const ms = Math.max(0, Math.round(sec * 1000));
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), s = Math.floor((ms % 60000) / 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(ms % 1000).padStart(3, "0")}`;
};

/** The captions as a WebVTT file, for a video player or a voice-over script. */
export function vtt(p: ReelPlan): string {
  const cues = p.pages.map((pg, i) => `${i + 1}\n${vttTime(pg.from)} --> ${vttTime(pg.to)}\n${pg.words.map((w) => w.text).join(" ")}`);
  return `WEBVTT\n\n${cues.join("\n\n")}\n`;
}

/** The voice-over script: one line per beat with its start time. */
export function script(p: ReelPlan): string {
  return p.beats.map((b) => `${b.chapter ? `\n[${b.chapter}]\n` : ""}${clock(b.start)}  ${plain(b.say)}`).join("\n").trim() + "\n";
}
