// The research reader: every doc in docs/, rendered at build time, with hover previews
// (components/Popups.tsx), backlinks, tags and the terms each doc uses.
import { useEffect, useMemo, useState } from "react";
import { Html } from "../ui/Html";
import { Title } from "../components/Shell";
import { termById, terms } from "../lib/glossary";
import { citeLabel, search, TYPE_HELP, TYPE_LABELS, TYPE_ORDER, useDocs, type DocEntry, type DocsData } from "../lib/docs";
import { REPO_URL } from "../lib/format";
import { scrollToEl, scrollToTop } from "../lib/scroll";
import { toggleBookmark, usePrefs } from "../lib/prefs";
import { Icon } from "../ui/icons";
import { PageSkeleton } from "../ui/skeleton";

function byType(docs: DocEntry[]): [string, DocEntry[]][] {
  const groups: Record<string, DocEntry[]> = {};
  for (const d of docs) (groups[d.type] ??= []).push(d);
  const order = [...TYPE_ORDER, ...Object.keys(groups).filter((t) => !TYPE_ORDER.includes(t))];
  return order.filter((t) => groups[t]).map((t) => [t, groups[t]]);
}

export function DocsHome({ tag, type: initialType, query }: { tag?: string; type?: string; query?: string }) {
  const data = useDocs();
  const [q, setQ] = useState(query ?? "");
  const [type, setType] = useState<string>(initialType ?? "");
  useEffect(() => setQ(query ?? ""), [query]);
  useEffect(() => setType(initialType ?? ""), [initialType]);
  if (!data) return <PageSkeleton parts={["text", "table"]} label="Loading docs" />;

  const tagCounts: Record<string, number> = {};
  for (const d of data.docs) for (const t of d.tags) tagCounts[t] = (tagCounts[t] ?? 0) + 1;
  const hits = q.trim().length >= 2 ? search(data, terms, q, 60) : null;
  const shown = data.docs.filter((d) => (!tag || d.tags.includes(tag)) && (!type || d.type === type));
  const recent = [...data.docs].filter((d) => d.updated).sort((a, b) => b.updated.localeCompare(a.updated) || b.id.localeCompare(a.id)).slice(0, 8);

  return (
    <>
      <div className="page-head">
        <Title label={tag ? `Docs tagged ${tag}` : "Research docs"}>{tag ? <>Docs tagged <span className="tag big">{tag}</span></> : "Research docs"}</Title>
        <p>
          Every decision, experiment, paper note and log in the project. Each doc opens with a short "In plain
          words" summary. Hover an underlined word, doc link or source for a preview. Select a word or phrase to see every doc that uses it. Press <kbd>/</kbd> to search from anywhere.
        </p>
      </div>
      <div className="learn-bar">
        <input type="search" autoFocus placeholder="Search docs, terms and sources" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search docs" />
        {tag && <a href="#/docs" className="chip">Clear tag</a>}
      </div>
      {hits ? (
        <SearchResults hits={hits} />
      ) : (
        <div className="docs-home">
          <div>
            <div className="chips">
              <button className={`chip ${type === "" ? "on" : ""}`} onClick={() => setType("")}>All {data.docs.length}</button>
              {byType(data.docs).map(([t, list]) => (
                <button key={t} title={TYPE_HELP[t]} className={`chip ${type === t ? "on" : ""}`} onClick={() => setType(t)}>{TYPE_LABELS[t] ?? t} {list.length}</button>
              ))}
            </div>
            {byType(shown).map(([t, list]) => (
              <section key={t} className="doc-group">
                <h2>{TYPE_LABELS[t] ?? t}</h2>
                {TYPE_HELP[t] && <p className="muted small doc-type-help">{TYPE_HELP[t]}</p>}
                <ul className="doc-list">
                  {list.map((d) => (
                    <li key={d.id}>
                      <span className="doc-id">{d.id}</span>
                      <a href={`#/doc/${d.id}`} data-doc={d.id}>{d.title}</a>
                      <span className={`status s-${d.status}`}>{d.status}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
          <aside className="rail">
            <h3>Recently updated</h3>
            <ul className="rail-list">
              {recent.map((d) => <li key={d.id}><a href={`#/doc/${d.id}`} data-doc={d.id}>{d.title}</a> <span className="muted small">{d.updated}</span></li>)}
            </ul>
            <h3>Tags</h3>
            <div className="tag-cloud">
              {Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).map(([t, n]) => (
                <a key={t} className={`tag ${t === tag ? "on" : ""}`} href={`#/docs/tag/${t}`}>{t} <span className="muted">{n}</span></a>
              ))}
            </div>
            <h3>Also</h3>
            <ul className="rail-list">
              <li><a href="#/learn">Glossary, {terms.length} terms</a></li>
              <li><a href="#/refs">Sources, {Object.keys(data.refs).length} entries</a></li>
            </ul>
          </aside>
        </div>
      )}
    </>
  );
}

function SearchResults({ hits }: { hits: ReturnType<typeof search> }) {
  if (!hits.length) return <p className="muted">Nothing matches.</p>;
  return (
    <ul className="results">
      {hits.map((h) => (
        <li key={h.kind + h.id}>
          <a href={hrefFor(h.kind, h.id)} {...dataFor(h.kind, h.id)}>{h.title}</a>
          <span className="muted small"> {h.sub}</span>
          {h.snippet && <div className="snip">{h.snippet}</div>}
        </li>
      ))}
    </ul>
  );
}

export function hrefFor(kind: string, id: string): string {
  return kind === "doc" ? `#/doc/${id}` : kind === "term" ? `#/learn/${id}` : `#/refs/${id}`;
}

export function dataFor(kind: string, id: string): Record<string, string> {
  return kind === "doc" ? { "data-doc": id } : kind === "term" ? { "data-term": id } : { "data-ref": id };
}

export function DocPage({ id, anchor }: { id: string; anchor?: string }) {
  const data = useDocs();
  const doc = data?.byId[id];

  useEffect(() => {
    if (!doc) return;
    const el = anchor ? document.getElementById(anchor) : null;
    if (el) scrollToEl(el);
    else scrollToTop();
  }, [doc, anchor]);

  if (!data) return <PageSkeleton parts={["text", "table"]} label="Loading docs" />;
  if (!doc) return <p className="muted">No doc called {id}. <a href="#/docs">All docs</a></p>;
  return (
    <div className="reader">
      <DocNav data={data} current={doc} />
      <article className="doc">
        <div className="doc-meta">
          <span className="doc-id">{doc.id}</span>
          <span title={TYPE_HELP[doc.type]} className="doc-type">{TYPE_LABELS[doc.type] ?? doc.type}</span>
          <span className={`status s-${doc.status}`}>{doc.status}</span>
          {doc.updated && <span className="muted">updated {doc.updated}</span>}
        </div>
        <DocBookmark doc={doc} />
        <Html className="prose" html={doc.html} />
      </article>
      <DocRail data={data} doc={doc} />
    </div>
  );
}

function DocBookmark({ doc }: { doc: DocEntry }) {
  const prefs = usePrefs();
  const href = `#/doc/${doc.id}`;
  const on = prefs.bookmarks.some((b) => b.href === href);
  return (
    <button className={`round-btn doc-bm ${on ? "on" : ""}`} onClick={() => toggleBookmark(href, doc.title)}
      aria-label={on ? "Remove from bookmarks" : "Add to bookmarks"} title={on ? "Remove from bookmarks" : "Add to bookmarks"}>
      <Icon name="bookmark" size={13} />
    </button>
  );
}

function DocNav({ data, current }: { data: DocsData; current: DocEntry }) {
  const [filter, setFilter] = useState("");
  const [openTypes, setOpenTypes] = useState<Set<string>>(new Set([current.type]));
  useEffect(() => setOpenTypes((s) => (s.has(current.type) ? s : new Set([...s, current.type]))), [current.type]);
  const f = filter.trim().toLowerCase();
  const groups = useMemo(() => byType(f ? data.docs.filter((d) => (d.id + " " + d.title).toLowerCase().includes(f)) : data.docs), [data, f]);
  return (
    <nav className="doc-nav" aria-label="All docs">
      <input type="search" placeholder="Filter" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter docs" />
      {groups.map(([t, list]) => {
        const open = !!f || openTypes.has(t);
        return (
          <div key={t}>
            <button className="nav-group" aria-expanded={open}
              onClick={() => setOpenTypes((s) => { const n = new Set(s); if (n.has(t)) n.delete(t); else n.add(t); return n; })}>
              {open ? "▾" : "▸"} {TYPE_LABELS[t] ?? t} <span className="muted">{list.length}</span>
            </button>
            {open && (
              <ul>
                {list.map((d) => (
                  <li key={d.id}><a className={d.id === current.id ? "active" : ""} href={`#/doc/${d.id}`}>{d.title}</a></li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </nav>
  );
}

function DocRail({ data, doc }: { data: DocsData; doc: DocEntry }) {
  const back = data.backlinks[doc.id] ?? [];
  const toc = doc.headings.filter((h) => h.level <= 3);
  return (
    <aside className="rail doc-rail">
      {toc.length > 1 && (
        <>
          <h3>On this page</h3>
          <ul className="toc">
            {toc.map((h) => (
              <li key={h.id} className={`l${h.level}`}><a href={`#/doc/${doc.id}/${h.id}`} data-doc={doc.id} data-anchor={h.id}>{h.text}</a></li>
            ))}
          </ul>
        </>
      )}
      {doc.tags.length > 0 && (
        <>
          <h3>Tags</h3>
          <div className="tag-cloud">{doc.tags.map((t) => <a key={t} className="tag" href={`#/docs/tag/${t}`}>{t}</a>)}</div>
        </>
      )}
      {doc.related.length > 0 && <Links title="Related" ids={doc.related} data={data} />}
      {back.length > 0 && <Links title={`Linked from ${back.length}`} ids={back} data={data} />}
      {doc.terms.length > 0 && (
        <>
          <h3>Terms used</h3>
          <div className="tag-cloud">
            {doc.terms.filter((t) => termById[t]).map((t) => (
              <a key={t} className="term-chip" href={`#/learn/${t}`} data-term={t}>{termById[t].term}</a>
            ))}
          </div>
        </>
      )}
      <h3>File</h3>
      <p className="small"><a href={`${REPO_URL}/blob/main/${doc.path}`} target="_blank" rel="noreferrer">{doc.path}</a></p>
      <p className="small muted">Created {doc.created || "unknown"}</p>
    </aside>
  );
}

function Links({ title, ids, data }: { title: string; ids: string[]; data: DocsData }) {
  return (
    <>
      <h3>{title}</h3>
      <ul className="rail-list">
        {ids.map((r) => (
          <li key={r}>{data.byId[r] ? <a href={`#/doc/${r}`} data-doc={r}>{data.byId[r].title}</a> : <span className="muted">{r}</span>}</li>
        ))}
      </ul>
    </>
  );
}

export function RefsPage({ focus }: { focus?: string }) {
  const data = useDocs();
  const [q, setQ] = useState("");
  useEffect(() => {
    if (focus) document.getElementById(`ref-${focus}`)?.scrollIntoView({ block: "center" });
  }, [focus, data]);
  if (!data) return <PageSkeleton parts={["text", "table"]} label="Loading sources" />;
  const f = q.trim().toLowerCase();
  const list = Object.values(data.refs)
    .filter((r) => !f || `${r.key} ${r.authors.join(" ")} ${r.year} ${r.title ?? ""} ${r.venue ?? ""}`.toLowerCase().includes(f))
    .sort((a, b) => (a.authors[0] ?? a.key).localeCompare(b.authors[0] ?? b.key) || (a.year ?? 0) - (b.year ?? 0));
  return (
    <>
      <div className="page-head">
        <Title>Bibliography</Title>
        <p>Everything the project relies on: papers, books, data providers, repos, courses and forum threads. Each link
          was checked by a script; the check result is shown next to it. Hover a doc to preview where a source is used.</p>
      </div>
      <div className="learn-bar">
        <input type="search" placeholder={`Search ${Object.keys(data.refs).length} sources`} value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <ul className="refs">
        {list.map((r) => (
          <li key={r.key} id={`ref-${r.key}`} className={r.key === focus ? "focused" : ""}>
            <strong>{citeLabel(r)}</strong>{r.title && <> · {r.title}</>}
            {r.venue && <span className="muted"> · {r.venue}</span>}
            <div className="small">
              <span className="muted">{r.type}</span>
              {r.url && <> · <a href={r.url} target="_blank" rel="noreferrer">link</a></>}
              {" · "}<span className={r.verification === "ok" ? "good" : "muted"}>{r.verification ?? "not checked"}</span>
              {(data.refDocs[r.key] ?? []).map((d) => <span key={d}> · <a href={`#/doc/${d}`} data-doc={d}>{d}</a></span>)}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
