// Training (DEC-0075): Parity Academy's courses, with where the person left off first.
import { useMemo } from "react";
import { courses, courseMinutes } from "../../lib/academy";
import { progressTable } from "../../academy/progress";
import { useRows } from "../../lib/userStore";
import { academyUrl } from "../../lib/space";
import { ProgressBar } from "../../ui";
import { Src } from "./common";

export default function Training() {
  const progress = useRows(progressTable, "academy_progress");
  const rows = useMemo(() => courses.map((c) => {
    const done = new Set(progress.rows.filter((r) => r.course === c.id && r.done_at).map((r) => r.lesson));
    const n = c.lessons.filter((l) => done.has(l.id)).length;
    const next = c.lessons.find((l) => !done.has(l.id));
    const last = progress.rows.filter((r) => r.course === c.id).map((r) => r.opened_at).sort().pop() ?? "";
    return { c, n, next, last };
  }).sort((a, b) => Number(b.n > 0 && b.n < b.c.lessons.length) - Number(a.n > 0 && a.n < a.c.lessons.length) || b.last.localeCompare(a.last) || a.c.order - b.c.order), [progress.rows]);
  return (
    <>
      <ul className="wl">
        {rows.slice(0, 5).map(({ c, n, next }) => (
          <li key={c.id} className="wl-row tr-row">
            <a href={academyUrl(next ? `${c.id}/${next.id}` : c.id)} target="_blank" rel="noopener">
              <b>{c.title}</b>
              <span className="wl-sub">{c.level}, {courseMinutes(c)} min. {n ? `${n} of ${c.lessons.length} lessons done.` : `${c.lessons.length} lessons.`}</span>
            </a>
            {n > 0 && <ProgressBar value={n / c.lessons.length} label={`${c.title}: ${n} of ${c.lessons.length} lessons done`} />}
          </li>
        ))}
      </ul>
      <Src><a href={academyUrl()} target="_blank" rel="noopener">All courses in Parity Academy</a></Src>
    </>
  );
}
