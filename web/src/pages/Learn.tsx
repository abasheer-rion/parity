import { Title } from "../components/Shell";
import { useMemo, useState } from "react";
import { useDocs, type DocsData } from "../lib/docs";
import { SearchInput, Segmented, SkeletonCard } from "../ui";
import { categories, termById, terms } from "../lib/glossary";
import type { GlossaryTerm } from "../lib/types";

type View = "simple" | "analogy" | "precise";
const VIEWS: { key: View; label: string }[] = [
  { key: "simple", label: "Simple" },
  { key: "analogy", label: "Analogy" },
  { key: "precise", label: "Precise" },
];

export function Learn({ focus }: { focus?: string }) {
  // The cards say where each word is used, which needs the docs. They load when the app
  // opens, so this is nearly always instant; until then the grid holds its place with
  // skeleton cards, so the "Used in" lines never push the page down as they arrive.
  const docs = useDocs();
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
          {terms.length} terms used on Parity. Each card has three versions. <strong>Simple</strong> uses everyday words,
          <strong>Analogy</strong> compares it to something familiar, and <strong>Precise</strong> gives the technical
          definition. Switch every card here, or one card at a time.
        </p>
      </div>
      <div className="learn-bar">
        <SearchInput value={query} onChange={setQuery} placeholder="Search terms" />
        <ViewSwitch value={view} onChange={setView} label="Explain every term as" />
      </div>
      {!docs && <div className="term-grid">{Array.from({ length: 9 }, (_, i) => <SkeletonCard key={i} lines={4} />)}</div>}
      {docs && categories.map((cat) => {
        const group = shown.filter((t) => t.category === cat).sort((a, b) => a.term.localeCompare(b.term));
        if (!group.length) return null;
        return (
          <section key={cat} className="learn-group">
            <h2>{cat}</h2>
            <div className="term-grid">
              {group.map((t) => (
                <TermCard key={`${t.id}-${view}`} term={t} initial={view} focused={focus === t.id} docs={docs} />
              ))}
            </div>
          </section>
        );
      })}
      {!shown.length && <p className="muted">No term matches.</p>}
    </>
  );
}

function ViewSwitch({ value, onChange, label }: { value: View; onChange: (v: View) => void; label: string }) {
  return <Segmented size="sm" value={value} onChange={onChange} label={label} options={VIEWS.map((v) => [v.key, v.label])} />;
}

function TermCard({ term, initial, focused, docs: all }: { term: GlossaryTerm; initial: View; focused: boolean; docs: DocsData }) {
  const [view, setView] = useState<View>(initial);
  const docs = all.termDocs[term.id] ?? [];
  return (
    <article id={`term-${term.id}`} className={`term ${focused ? "focused" : ""}`}
      ref={(el) => { if (focused && el) el.scrollIntoView({ block: "center" }); }}>
      <header>
        <h3>{term.term}</h3>
        <ViewSwitch value={view} onChange={setView} label={`Explain ${term.term} as`} />
      </header>
      <p>{term[view]}</p>
      {term.risk && <p className="related"><strong>What can go wrong:</strong> {term.risk}</p>}
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
