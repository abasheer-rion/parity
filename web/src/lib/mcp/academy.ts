// Parity Academy's courses for the hosted MCP server (DEC-0049). Pages Functions cannot read
// academy/courses/ or use Vite's import.meta.glob, so the site build writes every course into
// one file, /data/academy/courses.json (write_academy_data in scripts/seo/build_public.py).
import type { Data } from "./tools";

export interface McpLesson {
  id: string; title: string; minutes: number; body: string[]; terms: string[];
  check: { q: string; options: string[]; answer: number; why: string }[];
}
export interface McpCourse { id: string; order: number; level: string; title: string; summary: string; lessons: McpLesson[] }

export const ACADEMY_FILE = "/data/academy/courses.json";

export async function loadCourses(data: Data): Promise<McpCourse[]> {
  const doc = await data.json<McpCourse[]>(ACADEMY_FILE);
  return Array.isArray(doc) ? [...doc].sort((a, b) => a.order - b.order) : [];
}
