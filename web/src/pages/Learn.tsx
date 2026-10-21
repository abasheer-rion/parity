import { Title } from "../components/Shell";
import { useMemo, useState } from "react";
import { useDocs } from "../lib/docs";
import { categories, termById, terms } from "../lib/glossary";
import type { GlossaryTerm } from "../lib/types";

type View = "simple" | "analogy" | "precise";
const VIEWS: { key: View; label: string }[] = [
  { key: "simple", label: "Simple" },
  { key: "analogy", label: "Analogy" },
  { key: "precise", label: "Precise" },
];

export function Learn({ focus }: { focus?: string }) {
  const [query, setQuery] = useState("");
  const [view, setView] = useState<View>("simple");
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q
      ? terms.filter((t) => [t.term, t.simple, t.analogy, t.precise].some((x) => x.toLowerCase().includes(q)))
      : terms;
  }, [query]);

  return (
    <>
      <div className="page-head">
        <Title>Learn</Title>
        <p>
          Every term used in this project, explained three ways. <strong>Simple</strong> is how you would explain it to a
          ten year old, <strong>Analogy</strong> compares it to everyday life, and <strong>Precise</strong> is what an
          economist would write. Switch all cards at once here, or one card at a time.
        </p>
      </div>
      <div className="learn-bar">
        <input type="search" placeholder="Search terms" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search terms" />
        <Tabs value={view} onChange={setView} label="Explain every term as" />
      </div>
      {categories.map((cat) => {
        const group = shown.filter((t) => t.category === cat).sort((a, b) => a.term.localeCompare(b.term));
        if (!group.length) return null;
        return (
          <section key={cat} className="learn-group">
            <h2>{cat}</h2>
            <div className="term-grid">
              {group.map((t) => (
                <TermCard key={`${t.id}-${view}`} term={t} initial={view} focused={focus === t.id} />
              ))}
            </div>
          </section>
        );
      })}
      {!shown.length && <p className="muted">No term matches.</p>}
    </>
  );
}

function Tabs({ value, onChange, label }: { value: View; onChange: (v: View) => void; label: string }) {
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {VIEWS.map((v) => (
        <button key={v.key} role="tab" aria-selected={value === v.key} className={value === v.key ? "on" : ""}
          onClick={() => onChange(v.key)}>
          {v.label}
        </button>
      ))}
    </div>
  );
}

function TermCard({ term, initial, focused }: { term: GlossaryTerm; initial: View; focused: boolean }) {
  const [view, setView] = useState<View>(initial);
  const docs = useDocs()?.termDocs[term.id] ?? [];
  return (
    <article id={`term-${term.id}`} className={`term ${focused ? "focused" : ""}`}
      ref={(el) => { if (focused && el) el.scrollIntoView({ block: "center" }); }}>
      <header>
        <h3>{term.term}</h3>
        <Tabs value={view} onChange={setView} label={`Explain ${term.term} as`} />
      </header>
      <p>{term[view]}</p>
      {term.related && term.related.length > 0 && (
        <p className="related">
          Related:{" "}
          {term.related.filter((r) => termById[r]).map((r, i) => (
            <span key={r}>{i > 0 && ", "}<a href={`#/learn/${r}`} data-term={r}>{termById[r].term}</a></span>
          ))}
        </p>
      )}
      {docs.length > 0 && (
        <p className="related">
          Used in: {docs.slice(0, 5).map((d, i) => <span key={d}>{i > 0 && ", "}<a href={`#/doc/${d}`} data-doc={d}>{d}</a></span>)}
          {docs.length > 5 && <> and {docs.length - 5} more</>}
        </p>
      )}
    </article>
  );
}

/** Inline link from any page to a glossary entry, shown as a dotted underline. */
export function Term({ id, children }: { id: string; children: React.ReactNode }) {
  const t = termById[id];
  if (!t) return <>{children}</>;
  return <a className="term-link" href={`#/learn/${id}`} data-term={id}>{children}</a>;
}
