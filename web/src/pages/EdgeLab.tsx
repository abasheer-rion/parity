// Edge Lab: how to look for a trading edge without fooling yourself. Seven short
// lessons, the real mistakes we caught in our own research (DEC-0014), and a checklist
// that turns answers about an idea into a ranked list of pitfalls. Research side only;
// the public version is /learn/edge-lab/, built from the same file by build_public.py.
import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { Title } from "../components/Shell";
import { Badge, Checkbox, Input } from "../ui";
import { citeLabel, useDocs } from "../lib/docs";
import { termById } from "../lib/glossary";
import { checkIdea, DATA_OPTIONS, DEFAULT_ANSWERS, QUESTIONS, summary, type Answers, type DataKind, type Severity } from "../lib/edgeChecklist";
import { exampleById, examples, intro, lessonById, lessons, reading, type EdgeLink } from "../lib/edgeLab";
import { academyUrl } from "../lib/space";
import "./edgeLab.css";

const STORE = "parity.edgeLab.draft";
const SEVERITY: Record<Severity, { label: string; tone: "bad" | "accent" | "neutral" }> = {
  high: { label: "Check first", tone: "bad" }, medium: { label: "Check", tone: "accent" }, low: { label: "Good habit", tone: "neutral" },
};

function jump(id: string) {
  return (e: MouseEvent) => {
    const el = document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    goTo(el);
  };
}

/** Jump straight to a part of the page. A smooth glide over a long page can stop short. */
function goTo(el: HTMLElement) {
  el.scrollIntoView({ block: "start" });
}

function loadDraft(): { idea: string; answers: Answers } {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE) ?? "null");
    if (raw && typeof raw.idea === "string" && raw.answers) return { idea: raw.idea, answers: { ...DEFAULT_ANSWERS, ...raw.answers } };
  } catch { /* private window or bad JSON: start fresh */ }
  return { idea: "", answers: DEFAULT_ANSWERS };
}

export function EdgeLab({ focus }: { focus?: string }) {
  // A deep link such as #/edges/costs scrolls to that lesson once the page is drawn.
  useEffect(() => {
    if (!focus) return;
    const t = window.setTimeout(() => { const el = document.getElementById(`edge-${focus}`); if (el) goTo(el); }, 60);
    return () => window.clearTimeout(t);
  }, [focus]);

  return (
    <div className="el">
      <div className="page-head">
        <Title label="Edge Lab">Edge Lab</Title>
        <p>{intro}</p>
        <nav className="el-jump" aria-label="On this page">
          <a href="#/edges/lessons" onClick={jump("edge-lessons")}>Seven lessons</a>
          <a href="#/edges/examples" onClick={jump("edge-examples")}>Our own mistakes</a>
          <a href="#/edges/check" onClick={jump("edge-check")}>Check an idea</a>
          <a href="#/edges/reading" onClick={jump("edge-reading")}>Further reading</a>
          <a href={academyUrl("luck-vs-skill")} target="_blank" rel="noopener">Course: luck vs skill</a>
        </nav>
      </div>

      <section id="edge-lessons" className="el-sec">
        <h2>Seven lessons</h2>
        <ol className="el-lessons">
          {lessons.map((l, i) => <LessonCard key={l.id} n={i + 1} id={l.id} focused={focus === l.id} />)}
        </ol>
      </section>

      <section id="edge-examples" className="el-sec">
        <h2>Our own mistakes</h2>
        <p className="el-lede">Each of these looked like an edge in our backtests until we found the flaw. All are written up in <DocLink id="DEC-0014" />.</p>
        <div className="el-grid">
          {examples.map((x) => (
            <article key={x.id} id={`edge-ex-${x.id}`} className="el-card">
              <h3>{x.title}</h3>
              <p>{x.text}</p>
              <p className="el-meta">
                Lesson: {x.lessons.map((id, i) => <span key={id}>{i > 0 && ", "}<a href={`#/edges/${id}`} onClick={jump(`edge-${id}`)}>{lessonById[id].title}</a></span>)}
                {" · "}<DocLink id={x.doc} />
              </p>
            </article>
          ))}
        </div>
      </section>

      <Checklist />

      <section id="edge-reading" className="el-sec">
        <h2>Further reading</h2>
        <ul className="el-reading">
          {reading.map((r) => <li key={r.doc ?? r.page}><EdgeLinkView link={r} /> <span className="muted small">{r.doc}</span></li>)}
        </ul>
        <p className="muted small">Research and education only. Not investment advice. Backtests and simulations do not predict future returns.</p>
      </section>
    </div>
  );
}

function LessonCard({ n, id, focused }: { n: number; id: keyof typeof lessonById; focused: boolean }) {
  const l = lessonById[id];
  const docs = useDocs();
  const ex = examples.filter((x) => x.lessons.includes(id));
  return (
    <li id={`edge-${l.id}`} className={`el-card el-lesson ${focused ? "focused" : ""}`}>
      <h3><span className="el-n" aria-hidden>{n}</span>{l.title}</h3>
      <p>{l.text}</p>
      <p className="el-do"><strong>What we do:</strong> {l.do}</p>
      {ex.length > 0 && (
        <p className="el-meta">Our example: {ex.map((x, i) => <span key={x.id}>{i > 0 && ", "}<a href={`#/edges/examples`} onClick={jump(`edge-ex-${x.id}`)}>{x.title}</a></span>)}</p>
      )}
      <p className="el-meta">
        {l.links.map((k, i) => <span key={i}>{i > 0 && " · "}<EdgeLinkView link={k} /></span>)}
        {l.refs.map((r) => <span key={r}> · <a href={`#/refs/${r}`} data-ref={r}>{docs?.refs[r] ? citeLabel(docs.refs[r]) : r}</a></span>)}
      </p>
      {l.terms.some((t) => termById[t]) && (
        <p className="el-meta">Words: {l.terms.filter((t) => termById[t]).map((t, i) => <span key={t}>{i > 0 && ", "}<a className="term-link" href={`#/learn/${t}`} data-term={t}>{termById[t].term}</a></span>)}</p>
      )}
    </li>
  );
}

function DocLink({ id, label }: { id: string; label?: string }) {
  return <a href={`#/doc/${id}`} data-doc={id}>{label ?? id}</a>;
}

function EdgeLinkView({ link }: { link: EdgeLink }) {
  if (link.doc) return <DocLink id={link.doc} label={link.label} />;
  return <a href={link.page}>{link.label}</a>;
}

function Checklist() {
  const [{ idea, answers }, setDraft] = useState(loadDraft);
  useEffect(() => {
    try { localStorage.setItem(STORE, JSON.stringify({ idea, answers })); } catch { /* storage blocked: the tool still works */ }
  }, [idea, answers]);
  const set = <K extends keyof Answers>(k: K, v: Answers[K]) => setDraft((d) => ({ ...d, answers: { ...d.answers, [k]: v } }));
  const toggleData = (k: DataKind, on: boolean) => set("data", on ? [...answers.data, k] : answers.data.filter((x) => x !== k));
  const list = useMemo(() => checkIdea(answers), [answers]);

  return (
    <section id="edge-check" className="el-sec">
      <h2>Check an idea</h2>
      <p className="el-lede">Describe your idea in a line and answer a few questions. You get the pitfalls to rule out, most serious first. Nothing leaves your browser.</p>
      <div className="el-check">
        <form className="el-card el-form" onSubmit={(e) => e.preventDefault()}>
          <Input label="Your idea in one line" value={idea} onChange={(v) => setDraft((d) => ({ ...d, idea: v }))} placeholder="Buy gold when the dollar falls three days in a row" />
          <fieldset className="el-q">
            <legend>What data does the signal use?</legend>
            <div className="el-opts el-opts-col">
              {DATA_OPTIONS.map(([k, label]) => <Checkbox key={k} label={label} checked={answers.data.includes(k)} onChange={(on) => toggleData(k, on)} />)}
            </div>
          </fieldset>
          {QUESTIONS.map((q) => (
            <fieldset key={q.key} className="el-q">
              <legend>{q.label}</legend>
              <div className="el-opts">
                {q.options.map(([v, label]) => (
                  <label key={v} className={`el-opt ${answers[q.key] === v ? "on" : ""}`}>
                    <input type="radio" name={`edge-${q.key}`} value={v} checked={answers[q.key] === v} onChange={() => set(q.key, v as never)} />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
          <button type="button" className="el-reset" onClick={() => setDraft({ idea: "", answers: DEFAULT_ANSWERS })}>Start over</button>
        </form>

        <div className="el-card el-results" aria-live="polite" data-lenis-prevent>
          <h3>{idea.trim() ? <>Pitfalls for "{idea.trim()}"</> : "Pitfalls to check"}</h3>
          <p className="el-summary">{summary(list)}</p>
          <ol className="el-pitfalls">
            {list.map((p) => (
              <li key={p.id}>
                <div className="el-pitfall-head"><Badge tone={SEVERITY[p.severity].tone}>{SEVERITY[p.severity].label}</Badge><strong>{p.title}</strong></div>
                <p>{p.why}</p>
                <p className="el-meta">
                  Lesson: <a href={`#/edges/${p.lesson}`} onClick={jump(`edge-${p.lesson}`)}>{lessonById[p.lesson].title}</a>
                  {p.example && exampleById[p.example] && <> · Our example: <a href="#/edges/examples" onClick={jump(`edge-ex-${p.example}`)}>{exampleById[p.example].title}</a></>}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
