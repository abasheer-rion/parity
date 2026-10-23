// The Edge Lab's lessons and examples live in docs/_system/edge-lab.json, which the
// public page /learn/edge-lab/ also reads, so the two never disagree.
import data from "../../../docs/_system/edge-lab.json";
import type { LessonId } from "./edgeChecklist";

export interface EdgeLink { doc?: string; page?: string; label: string }
export interface Lesson { id: LessonId; title: string; text: string; do: string; terms: string[]; refs: string[]; links: EdgeLink[] }
export interface Example { id: string; title: string; lessons: LessonId[]; text: string; doc: string }

export const intro: string = data.intro;
export const lessons = data.lessons as Lesson[];
export const examples = data.examples as Example[];
export const reading = data.reading as EdgeLink[];
export const lessonById = Object.fromEntries(lessons.map((l) => [l.id, l])) as Record<LessonId, Lesson>;
export const exampleById: Record<string, Example> = Object.fromEntries(examples.map((x) => [x.id, x]));
