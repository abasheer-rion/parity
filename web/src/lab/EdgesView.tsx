// Edge Lab (DEC-0014, DEC-0043): a checklist that turns answers about an idea into the
// pitfalls to rule out, most serious first, beside the seven lessons, our own mistakes and
// further reading. Research content, read only: the checklist draft stays in this browser.
// The tab lives in the address (#/edges?t=lessons); #/edges/<lesson> opens that lesson.
import { useEffect, useMemo, useState } from "react";
import { citeLabel, useDocs } from "../lib/docs";
import { hashQuery, setHashQuery } from "../lib/deeplink";
import { checkIdea, DATA_OPTIONS, DEFAULT_ANSWERS, QUESTIONS, summary, type Answers, type DataKind, type LessonId, type Severity } from "../lib/edgeChecklist";
import { exampleById, examples, intro, lessonById, lessons, reading, type EdgeLink } from "../lib/edgeLab";
import { termById } from "../lib/glossary";
import { academyUrl, LAB_VIEWS, labHashFor, productUrl, researchUrl } from "../lib/space";
import { Badge, Checkbox, Icon, Segmented, Tooltip } from "../ui";

export const EDGE_DRAFT = "parity.edgeLab.draft";
const SEVERITY: Record<Severity, { label: string; tone: "bad" | "accent" | "neutral" }> = {
  high: { label: "Check first", tone: "bad" }, medium: { label: "Check", tone: "accent" }, low: { label: "Good habit", tone: "neutral" },
};
type Tab = "check" | "lessons" | "mistakes" | "reading";
const TABS: [Tab, string][] = [["check", "Check an idea"], ["lessons", "Seven lessons"], ["mistakes", "Our mistakes"], ["reading", "Reading"]];

function loadDraft(): { idea: string; answers: Answers } {
  try {
    const raw = JSON.parse(localStorage.getItem(EDGE_DRAFT) ?? "null");
    if (raw && typeof raw.idea === "string" && raw.answers) return { idea: raw.idea, answers: { ...DEFAULT_ANSWERS, ...raw.answers } };
  } catch { /* private window or bad JSON: start fresh */ }
  return { idea: "", answers: DEFAULT_ANSWERS };
}

const docHref = (id: string) => researchUrl(`#/doc/${id}`);
const ext = { target: "_blank", rel: "noopener" } as const;

function DocLink({ id, label }: { id: string; label?: string }) {
  return <a href={docHref(id)} {...ext}>{label ?? id}</a>;
}

/** A link from the Edge Lab file: a research doc, or a page of the product or research app. */
function EdgeLinkView({ link }: { link: EdgeLink }) {
  if (link.doc) return <DocLink id={link.doc} label={link.label} />;
  const page = link.page ?? "";
  // Pages that now live in the Workbench open here; the rest open their app in a new tab.
  const route = page.replace(/^#\/?/, "").split(/[/?]/)[0];
  if (page.startsWith("#") && LAB_VIEWS[route]) return <a href={`#/${labHashFor(page)}`}>{link.label}</a>;
  const m = page.match(/^\/(app|research)\/(#.*)$/);
  const href = m ? (m[1] === "research" ? researchUrl(m[2]) : productUrl(m[2])) : page.startsWith("#") ? researchUrl(page) : page;
  return <a href={href} {...ext}>{link.label}</a>;
}

export function EdgesView({ focus }: { focus?: string }) {
  const focused = focus && focus in lessonById ? (focus as LessonId) : undefined;
  const [tab, setTabState] = useState<Tab>(() => {
    if (focused) return "lessons";
    const t = hashQuery().get("t");
    return TABS.some(([k]) => k === t) ? (t as Tab) : "check";
  });
  const setTab = (t: Tab) => {
    setTabState(t);
    if (focused) window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#/edges${t === "check" ? "" : `?t=${t}`}`);
    else setHashQuery({ t: t === "check" ? null : t });
  };
  useEffect(() => {
    if (!focused) return;
    const t = window.setTimeout(() => document.getElementById(`edge-${focused}`)?.scrollIntoView({ block: "start" }), 60);
    return () => window.clearTimeout(t);
  }, [focused]);

  return (
    <div className="lb-view">
      <div className="lb-bar">
        <Segmented size="sm" label="Section" value={tab} onChange={setTab} options={TABS} />
        <span className="lb-gap" />
        <a className="lb-btn" href={academyUrl("luck-vs-skill")} {...ext}>Course: luck vs skill<Icon name="arrowUpRight" size={12} /></a>
      </div>
      {tab === "check" && <Checklist onLesson={(id) => { window.location.hash = `#/edges/${id}`; }} />}
      {tab === "lessons" && (
        <div className="lb-scroll lb-grow">
          <p className="lb-lede">{intro}</p>
          <ol className="lb-cards">{lessons.map((l, i) => <LessonCard key={l.id} n={i + 1} id={l.id} focused={focused === l.id} />)}</ol>
        </div>
      )}
      {tab === "mistakes" && (
        <div className="lb-scroll lb-grow">
          <p className="lb-lede">Each looked like an edge in our backtests until we found the flaw. All are written up in <DocLink id="DEC-0014" />.</p>
          <div className="lb-cards">
            {examples.map((x) => (
              <article key={x.id} id={`edge-ex-${x.id}`} className="lb-card">
                <h3>{x.title}</h3>
                <p>{x.text}</p>
                <p className="lb-dim">Lesson: {x.lessons.map((id, i) => <span key={id}>{i > 0 && ", "}<a href={`#/edges/${id}`}>{lessonById[id].title}</a></span>)} · <DocLink id={x.doc} /></p>
              </article>
            ))}
          </div>
        </div>
      )}
      {tab === "reading" && (
        <div className="lb-scroll lb-grow">
          <ul className="lb-reading">
            {reading.map((r) => <li key={r.doc ?? r.page}><EdgeLinkView link={r} /> <span className="lb-dim">{r.doc}</span></li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

function LessonCard({ n, id, focused }: { n: number; id: LessonId; focused: boolean }) {
  const l = lessonById[id];
  const docs = useDocs();
  const ex = examples.filter((x) => x.lessons.includes(id));
  const words = l.terms.filter((t) => termById[t]);
  return (
    <li id={`edge-${l.id}`} className={`lb-card ${focused ? "focused" : ""}`}>
      <h3><span className="lb-n" aria-hidden>{n}</span>{l.title}</h3>
      <p>{l.text}</p>
      <p className="lb-do"><strong>What we do:</strong> {l.do}</p>
      {ex.length > 0 && <p className="lb-dim">Our example: {ex.map((x, i) => <span key={x.id}>{i > 0 && ", "}{x.title}</span>)}</p>}
      <p className="lb-dim">{l.links.map((k, i) => <span key={i}>{i > 0 && " · "}<EdgeLinkView link={k} /></span>)}</p>
      {/* One line that never wraps: the citation names arrive with the docs and must not move the cards. */}
      {l.refs.length > 0 && <p className="lb-dim lb-refs">Sources: {l.refs.map((r, i) => <span key={r}>{i > 0 && " · "}<a href={researchUrl(`#/refs/${r}`)} {...ext}>{docs?.refs[r] ? citeLabel(docs.refs[r]) : r}</a></span>)}</p>}
      {words.length > 0 && (
        <p className="lb-dim">Words: {words.map((t, i) => <span key={t}>{i > 0 && ", "}<Tooltip text={termById[t].simple}><span className="lb-tip" tabIndex={0}>{termById[t].term}</span></Tooltip></span>)}</p>
      )}
    </li>
  );
}

function Checklist({ onLesson }: { onLesson: (id: LessonId) => void }) {
  const [{ idea, answers }, setDraft] = useState(loadDraft);
  useEffect(() => {
    try { localStorage.setItem(EDGE_DRAFT, JSON.stringify({ idea, answers })); } catch { /* storage blocked: the tool still works */ }
  }, [idea, answers]);
  const set = <K extends keyof Answers>(k: K, v: Answers[K]) => setDraft((d) => ({ ...d, answers: { ...d.answers, [k]: v } }));
  const toggleData = (k: DataKind, on: boolean) => set("data", on ? [...answers.data, k] : answers.data.filter((x) => x !== k));
  const list = useMemo(() => checkIdea(answers), [answers]);

  return (
    <div className="lb-split lb-split-even">
      <form className="lb-side lb-form" onSubmit={(e) => e.preventDefault()} aria-label="Your idea">
        <label className="lb-field">
          <span>Your idea in one line</span>
          <input className="lb-input" value={idea} onChange={(e) => setDraft((d) => ({ ...d, idea: e.target.value }))} placeholder="Buy gold when the dollar falls three days in a row" />
        </label>
        <fieldset className="lb-q">
          <legend>What data does the signal use?</legend>
          <div className="lb-opts lb-opts-col">
            {DATA_OPTIONS.map(([k, label]) => <Checkbox key={k} label={label} checked={answers.data.includes(k)} onChange={(on) => toggleData(k, on)} />)}
          </div>
        </fieldset>
        {QUESTIONS.map((q) => (
          <fieldset key={q.key} className="lb-q">
            <legend>{q.label}</legend>
            <div className="lb-opts">
              {q.options.map(([v, label]) => (
                <label key={v} className={`lb-opt ${answers[q.key] === v ? "on" : ""}`}>
                  <input type="radio" name={`edge-${q.key}`} value={v} checked={answers[q.key] === v} onChange={() => set(q.key, v as never)} />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
        ))}
        <button type="button" className="lb-btn lb-reset" onClick={() => setDraft({ idea: "", answers: DEFAULT_ANSWERS })}>Start over</button>
      </form>

      <section className="lb-pane" aria-live="polite" aria-label="Pitfalls">
        <div className="lb-bar">
          <strong className="lb-title">{idea.trim() ? <>Pitfalls for "{idea.trim()}"</> : "Pitfalls to check"}</strong>
        </div>
        <p className="lb-dim lb-sum">{summary(list)}</p>
        <ol className="lb-pitfalls">
          {list.map((p) => (
            <li key={p.id}>
              <div className="lb-pitfall-h"><Badge tone={SEVERITY[p.severity].tone}>{SEVERITY[p.severity].label}</Badge><strong>{p.title}</strong></div>
              <p>{p.why}</p>
              <p className="lb-dim">
                Lesson: <button type="button" className="lb-linkbtn" onClick={() => onLesson(p.lesson)}>{lessonById[p.lesson].title}</button>
                {p.example && exampleById[p.example] && <> · Our example: {exampleById[p.example].title}</>}
              </p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
