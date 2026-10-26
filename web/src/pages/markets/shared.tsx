// Small pieces every Markets page uses: the sources line with attribution, the
// "what to check" list, the risk note and the stat tile.
import type { ReactNode } from "react";
import { Icon } from "../../ui/icons";
import { PageSkeleton } from "../../ui/skeleton";
import { Term } from "../Learn";
import { ago, type MarketSource } from "../../lib/markets";

export function Banner({ children, icon = "info" }: { children: ReactNode; icon?: string }) {
  return <div className="mk-banner" role="note"><Icon name={icon} size={15} /><div>{children}</div></div>;
}

export function Risk({ children }: { children: ReactNode }) {
  return <div className="mk-risk"><strong>What can go wrong: </strong>{children}</div>;
}

export function Stat({ label, value, note, term }: { label: string; value: ReactNode; note?: ReactNode; term?: string }) {
  return (
    <div className="mk-stat">
      <div className="mk-stat-label">{term ? <Term id={term}>{label}</Term> : label}</div>
      <div className="mk-stat-value">{value}</div>
      {note && <div className="mk-stat-note">{note}</div>}
    </div>
  );
}

export interface Check { label: string; text: ReactNode }

/** The sceptical list shown on every coin, fund and filing. Never a recommendation. */
export function Checks({ items, title = "What to check" }: { items: Check[]; title?: string }) {
  return (
    <details className="mk-details">
      <summary>{title}</summary>
      <ul className="mk-check">
        {items.map((c) => <li key={c.label}><span><strong>{c.label}.</strong> {c.text}</span></li>)}
      </ul>
    </details>
  );
}

/** The attribution line a source's terms ask for, placed next to its data. */
export function Attribution({ sources }: { sources: MarketSource[] }) {
  const seen = new Set<string>();
  const items = sources.filter((s) => s.attribution && !seen.has(s.attribution) && seen.add(s.attribution));
  if (!items.length) return null;
  return (
    <p className="mk-attr">
      {items.map((s, i) => (
        <span key={s.id}>{i > 0 && " · "}{s.attribution_url ? <a href={s.attribution_url} target="_blank" rel="noreferrer">{s.attribution}</a> : s.attribution}</span>
      ))}
    </p>
  );
}

export function Sources({ sources }: { sources: MarketSource[] }) {
  return (
    <div className="mk-sources">
      <strong>Where this comes from</strong>
      {sources.map((s) => (
        <span key={s.id}>
          {s.name} ({s.provider}): {s.what}. Updated {ago(s.fetched_at)}.{" "}
          <a href={s.terms_url} target="_blank" rel="noreferrer">Terms</a>: {s.licence}.
          {s.error && <> Last attempt failed, so older data is shown.</>}
        </span>
      ))}
      <span>Research and education only. Nothing here is advice to buy or sell anything, and Parity does not trade for anyone.</span>
    </div>
  );
}

export function Loading({ error, what }: { error: string | null; what: string }) {
  if (error) return <Banner icon="info"><strong>No {what} data yet.</strong> {error}</Banner>;
  return <PageSkeleton parts={["stats", "table"]} label={`Loading ${what}`} />;
}
