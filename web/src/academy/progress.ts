// Parity Academy progress (DEC-0042), saved to the person's account: one row per course
// and lesson with the best quick check score and when it was last opened. The table is
// supabase/migrations/20261028000000_academy_progress.sql (each person sees only their own
// rows); the local preview keeps the rows in this browser (lib/userStore.ts).
//
// Progress kept by the old in-app Academy (browser storage, "parity.academy.v1") is copied
// into the account the first time the account has none.
import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { courseById, courses, type Course, type Lesson } from "../lib/academy";
import { table, type Row } from "../lib/userStore";
import { track } from "../lib/analytics";

export interface ProgressRow extends Row {
  course: string;
  lesson: string;
  score: number | null;
  total: number | null;
  done_at: string | null;
  opened_at: string;
}

export const progressTable = table<ProgressRow>("academy_progress");

const LEGACY = "parity.academy.v1";
const key = (course: string, lesson: string) => `${course}/${lesson}`;
/** Only lessons that exist count, so a renamed lesson never inflates a total. */
const real = (r: Pick<ProgressRow, "course" | "lesson">) => !!courseById[r.course]?.lessons.some((l) => l.id === r.lesson);

/** Done lessons from the old browser-only progress, if any. */
export function legacyDone(): { course: string; lesson: string; score: number }[] {
  try {
    const raw = JSON.parse(localStorage.getItem(LEGACY) ?? "null");
    if (!raw || typeof raw.done !== "object" || !raw.done) return [];
    return Object.entries(raw.done as Record<string, unknown>).flatMap(([k, v]) => {
      const [course, lesson] = k.split("/");
      const score = typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(20, Math.round(v))) : 0;
      return course && lesson && real({ course, lesson }) ? [{ course, lesson, score }] : [];
    });
  } catch {
    return [];
  }
}

function forgetLegacy() {
  try { localStorage.removeItem(LEGACY); } catch { /* storage blocked */ }
}

export interface Progress {
  loading: boolean;
  error: string | null;
  rows: ProgressRow[];
  isDone: (course: string, lesson: string) => boolean;
  score: (course: string, lesson: string) => { score: number; total: number } | null;
  courseDone: (c: Course) => number;
  /** Lessons done across every course. */
  doneCount: number;
  /** The lesson opened most recently, or null before any. */
  resume: { course: Course; lesson: Lesson; at: string } | null;
  /** The first lesson of a course not done yet, or its first lesson. */
  nextIn: (c: Course) => Lesson;
  opened: (course: string, lesson: string) => void;
  finish: (course: string, lesson: string, score: number, total: number) => void;
  clear: () => Promise<void>;
}

const Ctx = createContext<Progress | null>(null);

export function useProgress(): Progress {
  const p = useContext(Ctx);
  if (!p) throw new Error("useProgress needs a ProgressProvider");
  return p;
}

export function ProgressProvider({ children, onError }: { children: ReactNode; onError?: (message: string) => void }) {
  const [rows, setRows] = useState<ProgressRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // The rows as last changed here, read by saves that run before React draws again.
  const rowsRef = useRef(rows);
  const apply = useCallback((f: (rs: ProgressRow[]) => ProgressRow[]) => { rowsRef.current = f(rowsRef.current); setRows(rowsRef.current); }, []);
  const busy = useRef(new Map<string, Promise<unknown>>());
  const fail = useCallback((e: unknown) => { const m = e instanceof Error ? e.message : String(e); setError(m); onError?.(m); }, [onError]);

  useEffect(() => {
    let live = true;
    (async () => {
      let list = await progressTable.list();
      const old = legacyDone();
      if (!list.length && old.length) {
        const now = new Date().toISOString();
        // Another tab may import at the same moment; its rows win and this insert is dropped.
        await progressTable.insertMany(old.map((o) => ({ course: o.course, lesson: o.lesson, score: o.score, total: null, done_at: now, opened_at: now }))).catch(() => undefined);
        forgetLegacy();
        list = await progressTable.list();
      }
      if (live) { apply(() => list); setError(null); }
    })().catch((e) => live && fail(e)).finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [fail, apply]);

  /** Applies a change to one lesson's row here at once, then saves it. One save per lesson at a time. */
  const save = useCallback((course: string, lesson: string, patch: Partial<ProgressRow>) => {
    const k = key(course, lesson);
    const run = async () => {
      const have = rowsRef.current.find((r) => r.course === course && r.lesson === lesson);
      if (have) {
        apply((rs) => rs.map((r) => (r.id === have.id ? { ...r, ...patch } : r)));
        await progressTable.update(have.id, patch);
        return;
      }
      const draft: ProgressRow = { id: `pending-${k}`, course, lesson, score: null, total: null, done_at: null, opened_at: new Date().toISOString(), ...patch };
      apply((rs) => [...rs, draft]);
      try {
        const made = await progressTable.insert({ course, lesson, score: draft.score, total: draft.total, done_at: draft.done_at, opened_at: draft.opened_at });
        apply((rs) => rs.map((r) => (r.id === draft.id ? { ...made, ...patch, id: made.id } : r)));
      } catch (e) {
        // Another tab or device made the row first: load it and update it instead, keeping
        // its better score and its finish time (the database does the same on every update).
        const found = (await progressTable.list({ course, lesson } as Partial<ProgressRow>))[0];
        if (!found) throw e;
        const merged = { ...patch };
        if (found.score != null && (merged.score == null || merged.score < found.score)) { merged.score = found.score; merged.total = found.total; }
        if (found.done_at) merged.done_at = found.done_at;
        await progressTable.update(found.id, merged);
        apply((rs) => rs.map((r) => (r.id === draft.id ? { ...found, ...merged } : r)));
      }
    };
    const prev = busy.current.get(k) ?? Promise.resolve();
    const next = prev.then(run, run).catch(fail);
    busy.current.set(k, next);
  }, [fail, apply]);

  const opened = useCallback((course: string, lesson: string) => {
    if (!real({ course, lesson })) return;
    const now = new Date();
    const have = rowsRef.current.find((r) => r.course === course && r.lesson === lesson);
    // Reopening the lesson that is already the newest within a minute changes nothing.
    const newest = rowsRef.current.reduce<ProgressRow | null>((m, r) => (!m || r.opened_at > m.opened_at ? r : m), null);
    if (have && newest?.id === have.id && now.getTime() - Date.parse(have.opened_at) < 60_000) return;
    save(course, lesson, { opened_at: now.toISOString() });
  }, [save]);

  const finish = useCallback((course: string, lesson: string, score: number, total: number) => {
    if (!real({ course, lesson })) return;
    track("lesson_done", { course, lesson, score, total });
    const have = rowsRef.current.find((r) => r.course === course && r.lesson === lesson);
    const best = have?.score != null && have.score >= score ? { score: have.score, total: have.total ?? total } : { score, total };
    save(course, lesson, { ...best, done_at: have?.done_at ?? new Date().toISOString() });
  }, [save]);

  const clear = useCallback(async () => {
    // Saves still queued finish first, so none brings a row back after the clear.
    await Promise.all([...busy.current.values()]);
    // Every course in the catalog and any other course this device has seen: rows made on
    // another device go too. The database refuses a delete with no filter, so one course at a time.
    const names = [...new Set([...courses.map((c) => c.id), ...rowsRef.current.map((r) => r.course)])];
    apply(() => []);
    forgetLegacy();
    try {
      await Promise.all(names.map((course) => progressTable.removeWhere({ course } as Partial<ProgressRow>)));
    } catch (e) { fail(e); }
  }, [fail, apply]);

  const value = useMemo<Progress>(() => {
    const byKey = new Map(rows.filter(real).map((r) => [key(r.course, r.lesson), r]));
    const isDone = (c: string, l: string) => !!byKey.get(key(c, l))?.done_at;
    const courseDone = (c: Course) => c.lessons.filter((l) => isDone(c.id, l.id)).length;
    let resume: Progress["resume"] = null;
    for (const r of byKey.values()) {
      if (resume && r.opened_at <= resume.at) continue;
      const c = courseById[r.course];
      const l = c?.lessons.find((x) => x.id === r.lesson);
      if (c && l) resume = { course: c, lesson: l, at: r.opened_at };
    }
    return {
      loading, error, rows,
      isDone,
      score: (c, l) => { const r = byKey.get(key(c, l)); return r?.score != null ? { score: r.score, total: r.total ?? courseById[c]?.lessons.find((x) => x.id === l)?.check.length ?? r.score } : null; },
      courseDone,
      doneCount: courses.reduce((n, c) => n + courseDone(c), 0),
      resume,
      nextIn: (c) => c.lessons.find((l) => !isDone(c.id, l.id)) ?? c.lessons[0],
      opened, finish, clear,
    };
  }, [rows, loading, error, opened, finish, clear]);

  return createElement(Ctx.Provider, { value }, children);
}
