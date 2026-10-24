// Parity Academy (DEC-0028): short courses with moving pictures. Three views:
//   #/academy                      every course, with this browser's progress
//   #/academy/<course>             one course and its lessons
//   #/academy/<course>/<lesson>    one lesson: plain words, a picture, a link into Parity, a quick check
// Courses come from academy/courses/*.json; the public versions live at /learn/academy/.
import { Fragment, useEffect, useState, type ReactNode } from "react";
import { Title } from "../components/Shell";
import { Frame, VisualPlayer } from "../academy/Visual";
import { academyHref, courseById, courseDone, courseMinutes, courses, isDone, markDone, nextLesson, resetProgress, totalLessons, useProgress, type Course, type Lesson, type Question } from "../lib/academy";
import { termById } from "../lib/glossary";
import { scrollToTop } from "../lib/scroll";
import "./academy.css";

const NOT_ADVICE = "Research and education only. Not investment advice. Pictures use made-up or example numbers unless they say otherwise.";

/** Plain text with **bold** parts. */
function Rich({ text }: { text: string }) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return <>{parts.map((p, i) => (i % 2 ? <strong key={i}>{p}</strong> : <Fragment key={i}>{p}</Fragment>))}</>;
}

export function Academy({ course, lesson }: { course?: string; lesson?: string }) {
  useEffect(() => { scrollToTop(); }, [course, lesson]);
  const c = course ? courseById[course] : undefined;
  if (course && !c) return <Missing what="course" />;
  if (c && lesson) {
    const i = c.lessons.findIndex((l) => l.id === lesson);
    if (i < 0) return <Missing what="lesson" />;
    return <LessonView course={c} index={i} />;
  }
  if (c) return <CourseView course={c} />;
  return <Home />;
}

function Missing({ what }: { what: string }) {
  return (
    <div className="ac">
      <div className="page-head"><Title label="Academy">Academy</Title><p>That {what} does not exist. <a href="#/academy">See every course</a>.</p></div>
    </div>
  );
}

function Bar({ done, total, label }: { done: number; total: number; label: string }) {
  return (
    <div className="ac-bar" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} aria-valuetext={`${done} of ${total} lessons done`}>
      <span style={{ transform: `scaleX(${total ? done / total : 0})` }} />
    </div>
  );
}

function Home() {
  const p = useProgress();
  const done = courses.reduce((n, c) => n + courseDone(p, c), 0);
  return (
    <div className="ac">
      <div className="page-head">
        <Title label="Academy">Academy</Title>
        <p>Short courses on how markets and research work. Each lesson takes two or three minutes: a few paragraphs, a step-by-step picture, a link to the matching page in Parity and a short quiz.</p>
        <p className="ac-meta">{courses.length} courses · {totalLessons} lessons · {done > 0 ? `${done} done in this browser` : "Progress is saved in this browser only"}</p>
      </div>
      <ol className="ac-courses">
        {courses.map((c) => {
          const d = courseDone(p, c);
          const next = nextLesson(p, c);
          const first = c.lessons[0];
          return (
            <li key={c.id} className="ac-card ac-course">
              <a className="ac-thumb" href={`#/academy/${c.id}`} tabIndex={-1} aria-hidden>
                <Frame visual={first.visual} s={first.visual.steps.length - 1} />
              </a>
              <div className="ac-course-body">
                <p className="ac-kicker">{c.level} · {c.lessons.length} lessons · about {courseMinutes(c)} minutes</p>
                <h2><a href={`#/academy/${c.id}`}>{c.title}</a></h2>
                <p>{c.summary}</p>
                <Bar done={d} total={c.lessons.length} label={`${c.title} progress`} />
                <p className="ac-course-foot">
                  <span className="ac-meta">{d === c.lessons.length ? "Finished" : d ? `${d} of ${c.lessons.length} done` : "Not started"}</span>
                  <a className="ac-go" href={`#/academy/${c.id}/${next.id}`}>{d === 0 ? "Start" : d === c.lessons.length ? "Review" : "Continue"}<span className="sr-only"> {c.title}</span></a>
                </p>
              </div>
            </li>
          );
        })}
      </ol>
      <p className="ac-foot muted small">
        {NOT_ADVICE} Also see the <a href="#/learn">glossary</a> and, on the research side, the <a href="/research/#/edges">Edge Lab</a>.
        {done > 0 && <> <button type="button" className="ac-link-btn" onClick={() => { if (window.confirm("Clear your Academy progress in this browser?")) resetProgress(); }}>Clear my progress</button></>}
      </p>
    </div>
  );
}

function CourseView({ course: c }: { course: Course }) {
  const p = useProgress();
  const d = courseDone(p, c);
  const next = nextLesson(p, c);
  return (
    <div className="ac">
      <div className="page-head">
        <p className="ac-crumbs"><a href="#/academy">Academy</a></p>
        <Title label={c.title}>{c.title}</Title>
        <p>{c.summary}</p>
        <p className="ac-meta">{c.level} · {c.lessons.length} lessons · about {courseMinutes(c)} minutes</p>
        <Bar done={d} total={c.lessons.length} label={`${c.title} progress`} />
        <p><a className="ac-go" href={`#/academy/${c.id}/${next.id}`}>{d === 0 ? "Start the course" : d === c.lessons.length ? "Review from the start" : `Continue: ${next.title}`}</a></p>
      </div>
      <ol className="ac-lessons">
        {c.lessons.map((l, i) => {
          const ok = isDone(p, c.id, l.id);
          return (
            <li key={l.id} className={`ac-card ac-lesson-row ${ok ? "done" : ""}`}>
              <span className="ac-n" aria-hidden>{ok ? "✓" : i + 1}</span>
              <div>
                <h2><a href={`#/academy/${c.id}/${l.id}`}>{l.title}</a></h2>
                <p className="ac-meta">{l.minutes} minutes · {l.visual.steps.length} step picture · {l.check.length} questions{ok && <> · <span className="ac-ok">Done</span></>}</p>
              </div>
            </li>
          );
        })}
      </ol>
      <p className="ac-foot muted small">{NOT_ADVICE}</p>
    </div>
  );
}

function LessonView({ course: c, index }: { course: Course; index: number }) {
  const l = c.lessons[index];
  const prev = c.lessons[index - 1], next = c.lessons[index + 1];
  const terms = l.terms.filter((t) => termById[t]);
  return (
    <article className="ac ac-lesson">
      <div className="page-head">
        <p className="ac-crumbs"><a href="#/academy">Academy</a> / <a href={`#/academy/${c.id}`}>{c.title}</a></p>
        <Title label={l.title}>{l.title}</Title>
        <p className="ac-meta">Lesson {index + 1} of {c.lessons.length} · {l.minutes} minutes</p>
      </div>
      <div className="ac-grid">
        <div className="ac-text">
          {l.body.map((t, i) => <p key={i}><Rich text={t} /></p>)}
          {terms.length > 0 && (
            <p className="ac-words">Words: {terms.map((t, i) => <span key={t}>{i > 0 && ", "}<a className="term-link" href={`#/learn/${t}`} data-term={t}>{termById[t].term}</a></span>)}</p>
          )}
        </div>
        <div className="ac-side">
          <VisualPlayer visual={l.visual} />
          <section className="ac-card ac-inparity" aria-labelledby={`inp-${l.id}`}>
            <h2 id={`inp-${l.id}`}>In Parity</h2>
            <ul>{l.inParity.map((k) => <li key={k.href}><a href={academyHref(k)}>{k.label}</a></li>)}</ul>
          </section>
        </div>
      </div>
      <QuickCheck key={`${c.id}/${l.id}`} course={c} lesson={l} />
      <nav className="ac-pager" aria-label="Lessons">
        {prev ? <a href={`#/academy/${c.id}/${prev.id}`}><span className="ac-meta">Previous</span>{prev.title}</a> : <a href={`#/academy/${c.id}`}><span className="ac-meta">Back to</span>{c.title}</a>}
        {next ? <a className="next" href={`#/academy/${c.id}/${next.id}`}><span className="ac-meta">Next</span>{next.title}</a> : <a className="next" href="#/academy"><span className="ac-meta">Course finished</span>All courses</a>}
      </nav>
      <p className="ac-foot muted small">{NOT_ADVICE}</p>
    </article>
  );
}

function QuickCheck({ course: c, lesson: l }: { course: Course; lesson: Lesson }) {
  const [picks, setPicks] = useState<(number | null)[]>(() => l.check.map(() => null));
  const [checked, setChecked] = useState(false);
  const right = l.check.filter((q, i) => picks[i] === q.answer).length;
  const all = picks.every((v) => v !== null);
  const submit = () => {
    if (!all) return;
    setChecked(true);
    markDone(c.id, l.id, right);
  };
  return (
    <section className="ac-card ac-check" aria-labelledby={`qc-${l.id}`}>
      <h2 id={`qc-${l.id}`}>Quick check</h2>
      <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
        {l.check.map((q, i) => (
          <QuestionView key={i} n={i} q={q} pick={picks[i]} checked={checked} name={`${l.id}-q${i}`}
            onPick={(v) => { setChecked(false); setPicks((p) => p.map((x, k) => (k === i ? v : x))); }} />
        ))}
        <div className="ac-check-foot">
          <button type="submit" className="ac-btn ac-btn-main" disabled={!all}>Check my answers</button>
          {checked && <button type="button" className="ac-btn ac-btn-quiet" onClick={() => { setChecked(false); setPicks(l.check.map(() => null)); }}>Try again</button>}
          <p className="ac-score" aria-live="polite">{checked ? scoreLine(right, l.check.length) : all ? "" : "Answer every question to check."}</p>
        </div>
      </form>
    </section>
  );
}

function scoreLine(right: number, total: number): ReactNode {
  if (right === total) return <><strong>{right} of {total} right.</strong> Lesson done.</>;
  return <><strong>{right} of {total} right.</strong> Lesson marked done. Read the notes, then try again if you like.</>;
}

function QuestionView({ n, q, pick, checked, name, onPick }: { n: number; q: Question; pick: number | null; checked: boolean; name: string; onPick: (v: number) => void }) {
  const ok = pick === q.answer;
  return (
    <fieldset className="ac-q">
      <legend><span className="ac-qn">{n + 1}.</span> {q.q}</legend>
      <div className="ac-opts">
        {q.options.map((o, i) => (
          <label key={i} className={`ac-opt ${pick === i ? "on" : ""} ${checked && i === q.answer ? "right" : ""} ${checked && pick === i && !ok ? "wrong" : ""}`}>
            <input type="radio" name={name} value={i} checked={pick === i} onChange={() => onPick(i)} />
            <span>{o}</span>
          </label>
        ))}
      </div>
      {checked && (
        <p className={`ac-why ${ok ? "right" : "wrong"}`}>
          <strong>{ok ? "Right." : `Not quite. The answer is: ${q.options[q.answer]}.`}</strong> {q.why}
        </p>
      )}
    </fieldset>
  );
}
