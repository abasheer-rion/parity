// Parity Academy (DEC-0042): the courses as their own full-screen app at /academy/
// (academy.endyland.com). Its own rail, top bar, settings and keys; a course library, a
// course page and a focused lesson player with a progress rail, previous and next, the
// arrow keys and a quick check. Progress and the place to continue from are saved to the
// account (progress.ts). One Back button returns to Parity.
//
//   #/                        the library: continue, totals, every course
//   #/<course>                one course and its lessons
//   #/<course>/<lesson>       the lesson player
//   #/progress                progress across courses
//   #/settings                settings
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppGuard } from "../auth";
import { NotFound } from "../components/NotFound";
import { SkipLink } from "../components/SkipLink";
import { LEGAL_PAGES } from "../legal/LegalLinks";
import { courseById, courseMinutes, courses, totalLessons, type AcademyLink, type Course, type Lesson, type Question } from "../lib/academy";
import { termById } from "../lib/glossary";
import { appLink, productUrl } from "../lib/space";
import { setStoreUser } from "../lib/userStore";
import { FirstRunTour } from "../onboarding/FirstRunTour";
import { Button, Dialog, Icon, Popover, Segmented, Toaster, Toggle, toast } from "../ui";
import { ProgressProvider, useProgress } from "./progress";
import { Frame, VisualPlayer } from "./Visual";
import "./academy.css";

const LEGAL = "Research and education only. Not investment advice.";
const LEGAL_MORE = " Pictures use example numbers unless they say otherwise.";

export function AcademyApp() {
  return (
    <AppGuard>{(user) => {
      setStoreUser(user.id);
      return <ProgressProvider onError={(m) => toast(m, { tone: "bad" })}><AcademyShell /></ProgressProvider>;
    }}</AppGuard>
  );
}

// Parity opens the Academy in a new tab, so a tab whose only history entry is this page was opened that way.
const OPENED_AS_TAB = !!window.opener || window.history.length <= 1;
function goBack() {
  if (OPENED_AS_TAB) {
    window.close();
    window.setTimeout(() => { window.location.href = productUrl(); }, 250);
    return;
  }
  window.location.href = productUrl();
}

// ---------------------------------------------------------------- settings, kept in this browser

interface Settings { autoplay: boolean; text: "standard" | "large" }
const SETTINGS_KEY = "parity.academy.settings";
const DEFAULTS: Settings = { autoplay: true, text: "standard" };

function readSettings(): Settings {
  try {
    const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "null");
    return { autoplay: raw?.autoplay !== false, text: raw?.text === "large" ? "large" : "standard" };
  } catch { return DEFAULTS; }
}
function writeSettings(s: Settings) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* a convenience only */ }
}

// ---------------------------------------------------------------- routing

type Route =
  | { view: "library" } | { view: "progress" } | { view: "settings" }
  | { view: "course"; course: Course }
  | { view: "lesson"; course: Course; index: number }
  | { view: "missing" };

function parse(hash: string): Route {
  const parts = hash.replace(/^#\/?/, "").split("?")[0].split("/").filter(Boolean).map((p) => { try { return decodeURIComponent(p); } catch { return p; } });
  if (!parts.length) return { view: "library" };
  if (parts[0] === "progress" && parts.length === 1) return { view: "progress" };
  if (parts[0] === "settings" && parts.length === 1) return { view: "settings" };
  const c = courseById[parts[0]];
  if (!c) return { view: "missing" };
  if (parts.length === 1) return { view: "course", course: c };
  const index = c.lessons.findIndex((l) => l.id === parts[1]);
  return index < 0 ? { view: "missing" } : { view: "lesson", course: c, index };
}

function useHash(): string {
  const [h, setH] = useState(() => window.location.hash);
  useEffect(() => {
    const on = () => setH(window.location.hash);
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return h;
}

function useMobile(): boolean {
  const q = "(max-width: 760px)";
  const [m, setM] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = () => setM(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return m;
}

const isTyping = (el: EventTarget | null) => {
  const e = el as HTMLElement | null;
  return !!e?.tagName && (e.tagName === "INPUT" || e.tagName === "TEXTAREA" || e.tagName === "SELECT" || e.isContentEditable);
};

const lessonHref = (c: Course, l: Lesson) => `#/${c.id}/${l.id}`;

const KEYS: [string, string][] = [
  ["← / →", "Previous / next lesson"],
  ["← / → on the picture", "Previous / next step of the picture"],
  ["L", "Show or hide the lesson list"],
  ["C", "Continue where you left off"],
  ["Shift+1 to 4", "Library, Continue, Progress, Settings"],
  ["?", "Keys"],
];

// ---------------------------------------------------------------- the frame

function AcademyShell() {
  const hash = useHash();
  const route = useMemo(() => parse(hash), [hash]);
  const p = useProgress();
  const mobile = useMobile();
  const [settings, setSettingsState] = useState<Settings>(readSettings);
  const setSettings = useCallback((patch: Partial<Settings>) => setSettingsState((s) => { const n = { ...s, ...patch }; writeSettings(n); return n; }), []);
  const [railOpen, setRailOpen] = useState(true);
  const [keysOpen, setKeysOpen] = useState(false);
  const main = useRef<HTMLElement>(null);

  const continueHref = p.resume ? lessonHref(p.resume.course, p.resume.lesson) : lessonHref(courses[0], courses[0].lessons[0]);

  // A new page starts at its top, and the tab title follows it.
  const pageKey = route.view === "lesson" ? `${route.course.id}/${route.index}` : route.view === "course" ? route.course.id : route.view;
  useEffect(() => {
    main.current?.scrollTo({ top: 0 });
    const t = route.view === "lesson" ? route.course.lessons[route.index].title : route.view === "course" ? route.course.title
      : route.view === "progress" ? "Progress" : route.view === "settings" ? "Settings" : "";
    document.title = t ? `${t} · Parity Academy` : "Parity Academy";
  }, [pageKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Opening a lesson is remembered, so Continue comes back to it (after progress loads).
  useEffect(() => {
    if (route.view === "lesson" && !p.loading) p.opened(route.course.id, route.course.lessons[route.index].id);
  }, [pageKey, p.loading]); // eslint-disable-line react-hooks/exhaustive-deps

  // On a phone the lesson list is a drawer, closed when a lesson opens.
  useEffect(() => { if (mobile) setRailOpen(false); }, [mobile, pageKey]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
      if (document.querySelector(".ui-dialog-backdrop, [aria-modal='true']")) return;
      if (e.key === "?") { e.preventDefault(); setKeysOpen(true); return; }
      if (e.shiftKey && /^Digit[1-4]$/.test(e.code)) {
        e.preventDefault();
        window.location.hash = ["#/", continueHref, "#/progress", "#/settings"][Number(e.code.slice(5)) - 1];
        return;
      }
      if (e.shiftKey) return;
      if (e.key.toLowerCase() === "c") { e.preventDefault(); window.location.hash = continueHref; return; }
      if (route.view !== "lesson") return;
      const c = route.course;
      if (e.key === "ArrowRight" && route.index < c.lessons.length - 1) { e.preventDefault(); window.location.hash = lessonHref(c, c.lessons[route.index + 1]); }
      else if (e.key === "ArrowLeft" && route.index > 0) { e.preventDefault(); window.location.hash = lessonHref(c, c.lessons[route.index - 1]); }
      else if (e.key.toLowerCase() === "l") { e.preventDefault(); setRailOpen((o) => !o); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [route, continueHref]);

  const views: { id: string; href: string; label: string; icon: string; on: boolean }[] = [
    { id: "library", href: "#/", label: "Library", icon: "book", on: route.view === "library" || route.view === "course" || route.view === "missing" },
    { id: "continue", href: continueHref, label: "Continue", icon: "play", on: route.view === "lesson" },
    { id: "progress", href: "#/progress", label: "Progress", icon: "chart", on: route.view === "progress" },
    { id: "settings", href: "#/settings", label: "Settings", icon: "gear", on: route.view === "settings" },
  ];
  const title = route.view === "lesson" ? route.course.title : route.view === "course" ? route.course.title
    : route.view === "progress" ? "Progress" : route.view === "settings" ? "Settings" : route.view === "missing" ? "Not found" : "Library";

  return (
    <div className="pac" data-text={settings.text} data-mobile={mobile || undefined} data-player={route.view === "lesson" || undefined}>
      <div className="pac-orbs" aria-hidden><i /><i /><i /></div>
      <SkipLink />
      <header className="pac-top">
        <button type="button" className="pac-back" onClick={goBack} title="Back to Parity" aria-label="Back to Parity">
          <span aria-hidden>‹</span>
          <img src="/brand/2026-10-21-starburst/parity-mark.svg" alt="" width={16} height={16} />
          <span className="pac-back-t">Back</span>
        </button>
        <span className="pac-brand" aria-hidden>PARITY <b>ACADEMY</b></span>
        {route.view === "lesson" ? (
          <a className="pac-crumb" href={`#/${route.course.id}`} title="Course page">{title}</a>
        ) : <span className="pac-crumb pac-crumb-plain">{title}</span>}
        <span className="pac-gap" />
        {route.view === "lesson" && (
          <button type="button" className={`pac-icon ${railOpen ? "on" : ""}`} onClick={() => setRailOpen((o) => !o)} aria-pressed={railOpen} title="Lesson list (L)" aria-label="Lesson list">
            <Icon name="list" size={15} />
          </button>
        )}
        <a className="pac-chip" href="#/progress" title="Lessons done across every course">
          <span className="pac-chip-v">{p.loading ? "\u00a0" : p.doneCount}</span><span className="pac-chip-l">of {totalLessons}<span className="pac-chip-x"> lessons</span></span>
        </a>
      </header>

      <div className="pac-mid">
        {!mobile && (
          <nav className="pac-rail" aria-label="Academy">
            {views.map((v, i) => (
              <a key={v.id} href={v.href} className={`pac-rail-i ${v.on ? "on" : ""} ${v.id === "settings" ? "end" : ""}`} aria-current={v.on ? "page" : undefined}
                title={`${v.label} (Shift+${i + 1})`} aria-label={v.label}>
                <Icon name={v.icon} size={17} />
              </a>
            ))}
          </nav>
        )}
        {route.view === "lesson" ? (
          <Player course={route.course} index={route.index} railOpen={railOpen} setRailOpen={setRailOpen} mobile={mobile} autoplay={settings.autoplay} mainRef={main} />
        ) : (
          <main id="main" tabIndex={-1} ref={main} className="pac-main">
            {route.view === "library" ? <Library continueHref={continueHref} />
              : route.view === "course" ? <CourseView course={route.course} />
              : route.view === "progress" ? <ProgressView />
              : route.view === "settings" ? <SettingsView settings={settings} set={setSettings} />
              : <div className="pac-page"><NotFound title="That course or lesson does not exist" body="There is no Academy course or lesson at this address. The link may be mistyped, or the lesson may have moved." address={hash} home="#/" homeLabel="See every course" /></div>}
          </main>
        )}
      </div>

      <footer className="pac-legal"><span>{LEGAL}<span className="pac-legal-more">{LEGAL_MORE}</span></span></footer>

      {mobile && route.view !== "lesson" && (
        <nav className="pac-tabs" aria-label="Academy">
          {views.map((v) => (
            <a key={v.id} href={v.href} className={v.on ? "on" : ""} aria-current={v.on ? "page" : undefined}><Icon name={v.icon} size={17} /><span>{v.label}</span></a>
          ))}
        </nav>
      )}

      <Dialog open={keysOpen} onClose={() => setKeysOpen(false)} title="Keys" width={480}>
        <KeyTable />
      </Dialog>
      <Toaster />
      {/* The tour points at the library, so it waits until the library is open and loaded. */}
      <FirstRunTour areas={["academy"]} ready={route.view === "library" && !p.loading} />
    </div>
  );
}

function KeyTable() {
  return (
    <table className="pac-keys" aria-label="Keyboard shortcuts">
      <tbody>{KEYS.map(([k, w]) => <tr key={k}><td><kbd>{k}</kbd></td><td>{w}</td></tr>)}</tbody>
    </table>
  );
}

// ---------------------------------------------------------------- shared bits

/** Plain text with **bold** parts. */
function Rich({ text }: { text: string }) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return <>{parts.map((p, i) => (i % 2 ? <strong key={i}>{p}</strong> : <Fragment key={i}>{p}</Fragment>))}</>;
}

function Bar({ done, total, label }: { done: number; total: number; label: string }) {
  return (
    <div className="pac-bar" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} aria-valuetext={`${done} of ${total} lessons done`}>
      <span style={{ transform: `scaleX(${total ? done / total : 0})` }} />
    </div>
  );
}

function status(done: number, total: number): string {
  return done === total ? "Finished" : done ? `${done} of ${total} done` : "Not started";
}

function action(done: number, total: number): string {
  return done === 0 ? "Start" : done === total ? "Review" : "Continue";
}

/** A link from a lesson into Parity opens that page in a new tab. */
function ParityLink({ link }: { link: AcademyLink }) {
  return <a href={appLink(link.space, link.href)} target="_blank" rel="noopener">{link.label}<Icon name="arrowUpRight" size={12} /></a>;
}

// ---------------------------------------------------------------- library

function Library({ continueHref }: { continueHref: string }) {
  const p = useProgress();
  const levels = useMemo(() => [...new Set(courses.map((c) => c.level))], []);
  const [level, setLevel] = useState<string>("all");
  const shown = level === "all" ? courses : courses.filter((c) => c.level === level);
  const finished = courses.filter((c) => p.courseDone(c) === c.lessons.length).length;
  const minutes = courses.reduce((n, c) => n + courseMinutes(c), 0);
  const r = p.resume;
  const target = r ?? { course: courses[0], lesson: courses[0].lessons[0] };
  const idx = target.course.lessons.indexOf(target.lesson);
  return (
    <div className="pac-page">
      <section className="pac-hero pac-glass" aria-labelledby="pac-continue">
        <a className="pac-hero-pic" href={continueHref} tabIndex={-1} aria-hidden>
          <Frame visual={target.lesson.visual} s={target.lesson.visual.steps.length - 1} />
        </a>
        <div className="pac-hero-body">
          <p className="pac-meta">{r ? "Continue where you left off" : "Start here"}</p>
          <h1 id="pac-continue" className="pac-hero-title">{target.lesson.title}</h1>
          <p className="pac-meta">{target.course.title} · Lesson {idx + 1} of {target.course.lessons.length} · {target.lesson.minutes} minutes</p>
          <div className="pac-hero-acts">
            <a className="pac-btn pac-btn-main" href={continueHref}>{r ? "Continue" : "Start the first lesson"}</a>
            <span className="pac-kbd-hint"><kbd>C</kbd></span>
          </div>
        </div>
        <dl className="pac-totals">
          <div><dt>Lessons done</dt><dd>{p.loading ? "\u00a0" : p.doneCount}<small> of {totalLessons}</small></dd></div>
          <div><dt>Courses finished</dt><dd>{p.loading ? "\u00a0" : finished}<small> of {courses.length}</small></dd></div>
          <div><dt>All courses</dt><dd>{minutes}<small> min</small></dd></div>
        </dl>
      </section>

      <div className="pac-sec-head">
        <h2 className="pac-h2">Courses</h2>
        <Segmented label="Level" size="sm" value={level} onChange={setLevel} options={[["all", "All"], ...levels.map((l) => [l, l] as [string, string])]} />
      </div>
      <ol className="pac-grid">
        {shown.map((c) => {
          const d = p.courseDone(c);
          const next = p.nextIn(c);
          const last = c.lessons[c.lessons.length - 1];
          return (
            <li key={c.id} className="pac-card pac-glass">
              <a className="pac-card-pic" href={`#/${c.id}`} tabIndex={-1} aria-hidden>
                <Frame visual={last.visual} s={last.visual.steps.length - 1} />
              </a>
              <div className="pac-card-body">
                <p className="pac-meta">{c.level} · {c.lessons.length} lessons · {courseMinutes(c)} minutes</p>
                <h3><a href={`#/${c.id}`}>{c.title}</a></h3>
                <p className="pac-card-sum">{c.summary}</p>
                <Bar done={d} total={c.lessons.length} label={`${c.title} progress`} />
                <p className="pac-card-foot">
                  <span className="pac-meta">{status(d, c.lessons.length)}</span>
                  <a className="pac-btn pac-btn-sm" href={lessonHref(c, d === c.lessons.length ? c.lessons[0] : next)}>{action(d, c.lessons.length)}<span className="sr-only"> {c.title}</span></a>
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// ---------------------------------------------------------------- course page

function CourseView({ course: c }: { course: Course }) {
  const p = useProgress();
  const d = p.courseDone(c);
  const next = p.nextIn(c);
  const first = c.lessons[0];
  const resumeHere = p.resume?.course.id === c.id ? p.resume.lesson.id : null;
  return (
    <div className="pac-page">
      <section className="pac-hero pac-glass pac-course-hero" aria-labelledby="pac-course-t">
        <div className="pac-hero-pic"><Frame visual={first.visual} s={first.visual.steps.length - 1} /></div>
        <div className="pac-hero-body">
          <p className="pac-meta"><a href="#/">Library</a> · {c.level}</p>
          <h1 id="pac-course-t" className="pac-hero-title">{c.title}</h1>
          <p className="pac-hero-sum">{c.summary}</p>
          <p className="pac-meta">{c.lessons.length} lessons · {courseMinutes(c)} minutes · {status(d, c.lessons.length)}</p>
          <Bar done={d} total={c.lessons.length} label={`${c.title} progress`} />
          <div className="pac-hero-acts">
            <a className="pac-btn pac-btn-main" href={lessonHref(c, d === c.lessons.length ? first : next)}>
              {d === 0 ? "Start the course" : d === c.lessons.length ? "Review from the start" : `Continue: ${next.title}`}
            </a>
          </div>
        </div>
      </section>
      <ol className="pac-lessons">
        {c.lessons.map((l, i) => {
          const ok = p.isDone(c.id, l.id);
          const s = p.score(c.id, l.id);
          return (
            <li key={l.id}>
              <a className={`pac-lrow pac-glass ${ok ? "done" : ""}`} href={lessonHref(c, l)}>
                <span className="pac-n" aria-hidden>{ok ? <Icon name="check" size={13} /> : i + 1}</span>
                <span className="pac-lrow-t">{l.title}{resumeHere === l.id && <span className="pac-tag">Last opened</span>}</span>
                <span className="pac-meta">{l.minutes} min · {l.check.length} questions{s ? ` · ${s.score} of ${s.total} right` : ""}</span>
                <Icon name="chevronRight" size={14} />
              </a>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// ---------------------------------------------------------------- the lesson player

function Player({ course: c, index, railOpen, setRailOpen, mobile, autoplay, mainRef }: {
  course: Course; index: number; railOpen: boolean; setRailOpen: (o: boolean) => void; mobile: boolean; autoplay: boolean; mainRef: React.RefObject<HTMLElement | null>;
}) {
  const p = useProgress();
  const l = c.lessons[index];
  const prev = c.lessons[index - 1], next = c.lessons[index + 1];
  const d = p.courseDone(c);
  const terms = l.terms.filter((t) => termById[t]);
  return (
    <div className={`pac-player ${railOpen ? "rail-open" : ""}`}>
      {railOpen && mobile && <button type="button" className="pac-scrim" aria-label="Close the lesson list" onClick={() => setRailOpen(false)} />}
      {railOpen && (
        <aside className="pac-lrail" aria-label="Lessons in this course">
          <div className="pac-lrail-head">
            <a href={`#/${c.id}`} className="pac-lrail-t">{c.title}</a>
            <p className="pac-meta">{d} of {c.lessons.length} done</p>
            <Bar done={d} total={c.lessons.length} label={`${c.title} progress`} />
          </div>
          <ol className="pac-lrail-list">
            {c.lessons.map((x, i) => {
              const ok = p.isDone(c.id, x.id);
              return (
                <li key={x.id}>
                  <a href={lessonHref(c, x)} className={`${i === index ? "on" : ""} ${ok ? "done" : ""}`} aria-current={i === index ? "page" : undefined}>
                    <span className="pac-n" aria-hidden>{ok ? <Icon name="check" size={12} /> : i + 1}</span>
                    <span className="pac-lrail-l">{x.title}<small>{x.minutes} min</small></span>
                  </a>
                </li>
              );
            })}
          </ol>
        </aside>
      )}

      <main id="main" tabIndex={-1} ref={mainRef} className="pac-stage">
        <article className="pac-lesson" key={`${c.id}/${l.id}`}>
          <header className="pac-lesson-head">
            <p className="pac-meta">Lesson {index + 1} of {c.lessons.length} · {l.minutes} minutes{p.isDone(c.id, l.id) && <> · <span className="pac-ok">Done</span></>}</p>
            <h1 className="pac-lesson-t">{l.title}</h1>
          </header>
          <div className="pac-lesson-grid">
            <div className="pac-text">
              {l.body.map((t, i) => <p key={i}><Rich text={t} /></p>)}
              {terms.length > 0 && <p className="pac-words"><span className="pac-meta">Words</span> {terms.map((t) => <Term key={t} id={t} />)}</p>}
              <section className="pac-inparity" aria-labelledby={`inp-${l.id}`}>
                <h2 id={`inp-${l.id}`} className="pac-h3">In Parity</h2>
                <ul>{l.inParity.map((k) => <li key={k.href}><ParityLink link={k} /></li>)}</ul>
              </section>
            </div>
            <div className="pac-pic">
              <VisualPlayer visual={l.visual} autoPlay={autoplay} />
            </div>
          </div>
          <QuickCheck key={`${c.id}/${l.id}`} course={c} lesson={l} />
        </article>
      </main>

      <nav className="pac-pager" aria-label="Lessons">
        {prev ? (
          <a className="pac-pg" href={lessonHref(c, prev)} title="Previous lesson (←)"><Icon name="chevronLeft" size={16} /><span><small>Previous</small>{prev.title}</span></a>
        ) : <a className="pac-pg" href={`#/${c.id}`}><Icon name="chevronLeft" size={16} /><span><small>Course</small>{c.title}</span></a>}
        <span className="pac-dots" aria-label={`Lesson ${index + 1} of ${c.lessons.length}`} role="img">
          {c.lessons.map((x, i) => <i key={x.id} className={`${i === index ? "on" : ""} ${p.isDone(c.id, x.id) ? "done" : ""}`} />)}
        </span>
        {next ? (
          <a className="pac-pg pac-pg-next" href={lessonHref(c, next)} title="Next lesson (→)"><span><small>Next</small>{next.title}</span><Icon name="chevronRight" size={16} /></a>
        ) : <a className="pac-pg pac-pg-next" href="#/"><span><small>Last lesson</small>Back to the library</span><Icon name="chevronRight" size={16} /></a>}
      </nav>
    </div>
  );
}

/** A glossary word: its short meaning in a popover, and a link to the full entry. */
function Term({ id }: { id: string }) {
  const t = termById[id];
  return (
    <Popover label={t.term} width={320} placement="top-start" trigger={() => <button type="button" className="pac-term">{t.term}</button>}>
      <div className="pac-term-pop">
        <strong>{t.term}</strong>
        <p>{t.simple}</p>
        <a href={productUrl(`#/learn/${id}`)} target="_blank" rel="noopener">Full entry in the glossary<Icon name="arrowUpRight" size={12} /></a>
      </div>
    </Popover>
  );
}

function QuickCheck({ course: c, lesson: l }: { course: Course; lesson: Lesson }) {
  const p = useProgress();
  const [picks, setPicks] = useState<(number | null)[]>(() => l.check.map(() => null));
  const [checked, setChecked] = useState(false);
  const right = l.check.filter((q, i) => picks[i] === q.answer).length;
  const all = picks.every((v) => v !== null);
  const best = p.score(c.id, l.id);
  const submit = () => {
    if (!all) return;
    setChecked(true);
    p.finish(c.id, l.id, right, l.check.length);
  };
  return (
    <section className="pac-check pac-glass" aria-labelledby={`qc-${l.id}`}>
      <div className="pac-check-head">
        <h2 id={`qc-${l.id}`} className="pac-h2">Quick check</h2>
        {best && <span className="pac-meta">Best: {best.score} of {best.total}</span>}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
        {l.check.map((q, i) => (
          <QuestionView key={i} n={i} q={q} pick={picks[i]} checked={checked} name={`${l.id}-q${i}`}
            onPick={(v) => { setChecked(false); setPicks((ps) => ps.map((x, k) => (k === i ? v : x))); }} />
        ))}
        <div className="pac-check-foot">
          <button type="submit" className="pac-btn pac-btn-main" disabled={!all}>Check my answers</button>
          {checked && <button type="button" className="pac-btn" onClick={() => { setChecked(false); setPicks(l.check.map(() => null)); }}>Try again</button>}
          <p className="pac-score" aria-live="polite">{checked ? scoreLine(right, l.check.length) : all ? "" : "Answer every question to check."}</p>
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
    <fieldset className="pac-q">
      <legend><span className="pac-qn">{n + 1}.</span> {q.q}</legend>
      <div className="pac-opts">
        {q.options.map((o, i) => (
          <label key={i} className={`pac-opt ${pick === i ? "on" : ""} ${checked && i === q.answer ? "right" : ""} ${checked && pick === i && !ok ? "wrong" : ""}`}>
            <input type="radio" name={name} value={i} checked={pick === i} onChange={() => onPick(i)} />
            <span>{o}</span>
          </label>
        ))}
      </div>
      {checked && (
        <p className={`pac-why ${ok ? "right" : "wrong"}`}>
          <strong>{ok ? "Right." : `Not quite. The answer is: ${q.options[q.answer]}.`}</strong> {q.why}
        </p>
      )}
    </fieldset>
  );
}

// ---------------------------------------------------------------- progress

const when = (iso: string | undefined) => {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};

function ProgressView() {
  const p = useProgress();
  const [confirm, setConfirm] = useState(false);
  const rows = courses.map((c) => {
    const mine = p.rows.filter((r) => r.course === c.id);
    const last = mine.reduce<string | undefined>((m, r) => (!m || r.opened_at > m ? r.opened_at : m), undefined);
    const right = c.lessons.reduce((n, l) => n + (p.score(c.id, l.id)?.score ?? 0), 0);
    const asked = c.lessons.reduce((n, l) => n + (p.score(c.id, l.id) ? p.score(c.id, l.id)!.total : 0), 0);
    return { c, done: p.courseDone(c), last, right, asked };
  });
  const right = rows.reduce((n, r) => n + r.right, 0), asked = rows.reduce((n, r) => n + r.asked, 0);
  return (
    <div className="pac-page">
      <div className="pac-sec-head">
        <h1 className="pac-h1">Progress</h1>
        <span className="pac-meta">Saved to your account</span>
      </div>
      <dl className="pac-totals pac-totals-row pac-glass">
        <div><dt>Lessons done</dt><dd>{p.doneCount}<small> of {totalLessons}</small></dd></div>
        <div><dt>Courses finished</dt><dd>{rows.filter((r) => r.done === r.c.lessons.length).length}<small> of {courses.length}</small></dd></div>
        <div><dt>Quick check answers right</dt><dd>{asked ? right : "n/a"}{asked ? <small> of {asked}</small> : null}</dd></div>
        <div><dt>Last lesson opened</dt><dd className="pac-dd-text">{p.resume ? <a href={lessonHref(p.resume.course, p.resume.lesson)}>{p.resume.lesson.title}</a> : "n/a"}</dd></div>
      </dl>
      <div className="pac-table-wrap pac-glass">
        <table className="pac-table">
          <caption className="sr-only">Progress in each course</caption>
          <colgroup><col className="pac-c-course" /><col className="pac-c-n" /><col className="pac-col-bar" /><col className="pac-c-n" /><col className="pac-c-date" /><col className="pac-c-act" /></colgroup>
          <thead><tr><th className="l">Course</th><th>Done</th><th className="pac-col-bar l">Progress</th><th>Right</th><th>Last opened</th><th /></tr></thead>
          <tbody>
            {rows.map(({ c, done, last, right: r, asked: a }) => (
              <tr key={c.id}>
                <td className="l"><a href={`#/${c.id}`}>{c.title}</a><small className="pac-meta"> {c.level}</small></td>
                <td>{done} of {c.lessons.length}</td>
                <td className="pac-col-bar l"><Bar done={done} total={c.lessons.length} label={`${c.title} progress`} /></td>
                <td>{a ? `${r} of ${a}` : "n/a"}</td>
                <td>{when(last) || "n/a"}</td>
                <td><a className="pac-btn pac-btn-sm" href={lessonHref(c, done === c.lessons.length ? c.lessons[0] : p.nextIn(c))}>{action(done, c.lessons.length)}<span className="sr-only"> {c.title}</span></a></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="pac-row-end">
        <Button size="sm" variant="tertiary" disabled={!p.rows.length} onClick={() => setConfirm(true)}>Clear my progress</Button>
      </p>
      <ClearDialog open={confirm} onClose={() => setConfirm(false)} />
    </div>
  );
}

function ClearDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const p = useProgress();
  return (
    <Dialog open={open} onClose={onClose} title="Clear your progress?" width={400}
      footer={<><Button variant="tertiary" onClick={onClose}>Cancel</Button><Button variant="danger" onClick={() => { onClose(); void p.clear().then(() => toast("Progress cleared")); }}>Clear</Button></>}>
      <p>Every lesson goes back to not started, on every device. Quick check scores are removed.</p>
    </Dialog>
  );
}

// ---------------------------------------------------------------- settings

function SettingsView({ settings, set }: { settings: Settings; set: (p: Partial<Settings>) => void }) {
  const p = useProgress();
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="pac-page pac-settings">
      <h1 className="pac-h1">Settings</h1>
      <section className="pac-set pac-glass" aria-labelledby="set-lessons">
        <h2 id="set-lessons" className="pac-h3">Lessons</h2>
        <div className="pac-set-row"><span>Play each picture once when it comes into view</span><Toggle on={settings.autoplay} onChange={(autoplay) => set({ autoplay })} label="Play pictures on their own" /></div>
        <div className="pac-set-row"><span>Text size</span><Segmented label="Text size" size="sm" value={settings.text} onChange={(text) => set({ text })} options={[["standard", "Standard"], ["large", "Large"]]} /></div>
      </section>
      <section className="pac-set pac-glass" aria-labelledby="set-keys">
        <h2 id="set-keys" className="pac-h3">Keys</h2>
        <KeyTable />
      </section>
      <section className="pac-set pac-glass" aria-labelledby="set-progress">
        <h2 id="set-progress" className="pac-h3">Progress</h2>
        <div className="pac-set-row"><span>{p.doneCount} of {totalLessons} lessons done, saved to your account</span><Button size="sm" variant="tertiary" disabled={!p.rows.length} onClick={() => setConfirm(true)}>Clear</Button></div>
        <ClearDialog open={confirm} onClose={() => setConfirm(false)} />
      </section>
      <section className="pac-set pac-glass" aria-labelledby="set-links">
        <h2 id="set-links" className="pac-h3">Links</h2>
        <nav className="pac-links" aria-label="Links">
          <a href="/learn/academy/" target="_blank" rel="noopener">Public course pages</a>
          <a href={productUrl("#/learn")} target="_blank" rel="noopener">Glossary</a>
          {LEGAL_PAGES.map((x) => <a key={x.href} href={x.href} target="_blank" rel="noopener">{x.label}</a>)}
        </nav>
      </section>
    </div>
  );
}
