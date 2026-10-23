// Parity Academy (DEC-0028): short courses, each a handful of two to three minute
// lessons with a moving picture and a quick check. The courses are JSON files in
// academy/courses/ at the repo root; scripts/seo/build_public.py builds the public
// lesson pages from the same files, so the app and the public pages never disagree.
// How to write one: docs/guides (GDE "Writing a new Academy course").
import { useSyncExternalStore } from "react";
import type { Visual } from "../academy/scenes";
import { SPACE, SPACE_ROOT, type Space } from "./space";

export interface AcademyLink { label: string; href: string; space: Space | "both" }
export interface Question { q: string; options: string[]; answer: number; why: string }
export interface Lesson {
  id: string; title: string; minutes: number; body: string[]; terms: string[];
  visual: Visual; inParity: AcademyLink[]; check: Question[];
}
export interface Course { id: string; order: number; level: string; title: string; summary: string; docs: string[]; lessons: Lesson[] }

const files = import.meta.glob("../../../academy/courses/*.json", { eager: true, import: "default" }) as Record<string, Course>;

export const courses: Course[] = Object.values(files).sort((a, b) => a.order - b.order);
export const courseById: Record<string, Course> = Object.fromEntries(courses.map((c) => [c.id, c]));

export const totalLessons = courses.reduce((n, c) => n + c.lessons.length, 0);

export function courseMinutes(c: Course): number {
  return c.lessons.reduce((n, l) => n + l.minutes, 0);
}

/** A link from a lesson into Parity: a hash on this side, a full path to the other. */
export function academyHref(l: AcademyLink): string {
  return l.space === "both" || l.space === SPACE ? l.href : `${SPACE_ROOT[l.space]}${l.href}`;
}

// ---------- progress, kept in this browser only ----------

const KEY = "parity.academy.v1";

export interface Progress { done: Record<string, number> } // "course/lesson" -> best score (right answers)

function read(): Progress {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (raw && typeof raw.done === "object" && raw.done) return { done: raw.done };
  } catch { /* private window, blocked storage or bad JSON: start fresh */ }
  return { done: {} };
}

let state: Progress = read();
const listeners = new Set<() => void>();

function write(next: Progress) {
  state = next;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* storage blocked: progress lasts for this visit */ }
  listeners.forEach((f) => f());
}

export function useProgress(): Progress {
  return useSyncExternalStore((f) => { listeners.add(f); return () => listeners.delete(f); }, () => state, () => state);
}

export function markDone(course: string, lesson: string, score: number) {
  const k = `${course}/${lesson}`;
  write({ done: { ...state.done, [k]: Math.max(score, state.done[k] ?? 0) } });
}

export function resetProgress() {
  write({ done: {} });
}

export function isDone(p: Progress, course: string, lesson: string): boolean {
  return `${course}/${lesson}` in p.done;
}

export function courseDone(p: Progress, c: Course): number {
  return c.lessons.filter((l) => isDone(p, c.id, l.id)).length;
}

/** The first lesson not yet done, or the first lesson. */
export function nextLesson(p: Progress, c: Course): Lesson {
  return c.lessons.find((l) => !isDone(p, c.id, l.id)) ?? c.lessons[0];
}
