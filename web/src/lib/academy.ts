// Parity Academy (DEC-0028): short courses, each a handful of two to three minute
// lessons with a moving picture and a quick check. The courses are JSON files in
// academy/courses/ at the repo root; scripts/seo/build_public.py builds the public
// lesson pages from the same files, so the app and the public pages never disagree.
// How to write one: docs/guides (GDE "Writing a new Academy course").
// The courses play in Parity Academy, its own app (src/academy/, DEC-0042), which keeps
// progress in the person's account (src/academy/progress.ts).
import type { Visual } from "../academy/scenes";
import { appLink, type Space } from "./space";

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

/** A link from a lesson into Parity, opened from the Academy: the page in its own app. */
export function academyHref(l: AcademyLink): string {
  return appLink(l.space, l.href);
}
