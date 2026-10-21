// Layout and display pieces: page headers, cards, stats, key-value grids, badges,
// status, meters, settings rows, empty and loading states.
import type { ReactNode } from "react";
import { Icon } from "./icons";

/** Page header: title, optional description and actions on the right. */
export function PageHeader({ title, description, actions, eyebrow }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <header className="ui-pagehead">
      {eyebrow && <div className="ui-eyebrow">{eyebrow}</div>}
      <div className="ui-pagehead-row">
        <h1>{title}</h1>
        {actions && <div className="ui-pagehead-actions">{actions}</div>}
      </div>
      {description && <p className="ui-pagehead-desc">{description}</p>}
    </header>
  );
}

/** Mercury card: a title row with optional actions, the body, an optional footer. */
export function Panel({ title, actions, footer, children, span = 1, padded = true }:
  { title?: ReactNode; actions?: ReactNode; footer?: ReactNode; children: ReactNode; span?: 1 | 2 | 3; padded?: boolean }) {
  return (
    <section className={`mcard ${span > 1 ? `span${span}` : ""} ${padded ? "" : "flush"}`}>
      {(title || actions) && <div className="mcard-head">{title && <h2>{title}</h2>}{actions}</div>}
      {children}
      {footer && <div className="mcard-foot">{footer}</div>}
    </section>
  );
}

export function Grid({ cols = 3, children }: { cols?: 1 | 2 | 3 | 4; children: ReactNode }) {
  return <div className={`ui-grid ui-grid-${cols}`}>{children}</div>;
}

/** A KPI: a small label, a large value, and an optional change or note below. */
export function Stat({ label, value, sub, size = "md", term }: { label: ReactNode; value: ReactNode; sub?: ReactNode; size?: "sm" | "md" | "lg"; term?: string }) {
  return (
    <div className={`ui-stat ui-stat-${size}`}>
      <div className="ui-stat-label">{term ? <a className="term-link" href={`#/learn/${term}`} data-term={term}>{label}</a> : label}</div>
      <div className="ui-stat-value">{value}</div>
      {sub && <div className="ui-stat-sub">{sub}</div>}
    </div>
  );
}

/** Robinhood's "Key statistics": a grid of label over value. */
export function KeyValues({ items, cols = 4 }: { items: [ReactNode, ReactNode][]; cols?: 2 | 3 | 4 }) {
  return (
    <dl className={`kstats cols-${cols}`}>
      {items.map(([k, v], i) => <div key={i}><dt>{k}</dt><dd>{v}</dd></div>)}
    </dl>
  );
}

/** A section with a large heading and a hairline under it (Robinhood's About, Key statistics). */
export function Section({ title, children, actions }: { title: ReactNode; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="rh-sec">
      <div className="ui-sec-head"><h2>{title}</h2>{actions}</div>
      {children}
    </section>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "accent" | "good" | "bad" | "dark" }) {
  return <span className={`ui-badge ui-badge-${tone}`}>{children}</span>;
}

const STATUS_TONE: Record<string, "good" | "bad" | "warn" | "neutral" | "accent"> = {
  accepted: "good", current: "good", official: "good", supported: "good", done: "good", pass: "good",
  rejected: "bad", superseded: "bad", fail: "bad", failed: "bad",
  testing: "accent", proposed: "accent", open: "accent",
  draft: "warn", outdated: "warn", parked: "neutral",
};

/** A status word with a dot. The word carries the meaning; the colour only helps. */
export function Status({ value }: { value: string }) {
  const tone = STATUS_TONE[value] ?? "neutral";
  return <span className={`ui-status ui-status-${tone}`}><i aria-hidden />{value}</span>;
}

export function Divider({ vertical }: { vertical?: boolean }) {
  return vertical ? <span className="ui-vsep" aria-hidden /> : <hr className="ui-divider" />;
}

/** A filled bar out of 100%, with an optional marker (for example, the benchmark). */
export function Meter({ value, marker, label }: { value: number; marker?: number; label?: string }) {
  return (
    <div className="meter" role="meter" aria-valuemin={0} aria-valuemax={1} aria-valuenow={value} aria-label={label}>
      <i style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
      {marker != null && <b style={{ left: `${Math.max(0, Math.min(1, marker)) * 100}%` }} />}
    </div>
  );
}

/** Mercury's "% of total" bar: each row's share sits after the shares of the rows above it. */
export function ShareBar({ share, offset }: { share: number; offset: number }) {
  return (
    <span className="ui-share">
      <span className="ui-share-pct">{(share * 100).toFixed(1)}%</span>
      <span className="ui-share-track"><i style={{ left: `${offset * 100}%`, width: `${Math.max(share * 100, 0.4)}%` }} /></span>
    </span>
  );
}

/** A settings row: label and help on the left, the value or control on the right. */
export function SettingsRow({ label, help, children }: { label: ReactNode; help?: ReactNode; children: ReactNode }) {
  return (
    <div className="srow">
      <div className="srow-l">
        <div className="srow-label">{label}</div>
        {help && <div className="srow-help">{help}</div>}
      </div>
      <div className="srow-r">{children}</div>
    </div>
  );
}

export function EmptyState({ title, children, action, icon = "info" }: { title: string; children?: ReactNode; action?: ReactNode; icon?: string }) {
  return (
    <div className="ui-empty">
      <span className="ui-empty-icon"><Icon name={icon} size={18} /></span>
      <div className="ui-empty-title">{title}</div>
      {children && <div className="ui-empty-body">{children}</div>}
      {action}
    </div>
  );
}

export function Skeleton({ width = "100%", height = 14, round }: { width?: number | string; height?: number; round?: boolean }) {
  return <span className="ui-skel" style={{ width, height, borderRadius: round ? 999 : 6 }} aria-hidden />;
}

// Older names kept so existing pages keep working.

export function StatTile({ label, value, note, tone, learn }: { label: string; value: string; note?: string; tone?: "good" | "bad"; learn?: string }) {
  return (
    <div className="tile">
      <div className="tile-label">{learn ? <a className="term-link" href={`#/learn/${learn}`} data-term={learn}>{label}</a> : label}</div>
      <div className="tile-value">{value}</div>
      {note && <div className={`tile-note ${tone ?? ""}`}>{tone === "good" ? "Above " : tone === "bad" ? "Below " : ""}{note}</div>}
    </div>
  );
}

export function Card({ title, help, children }: { title: string; help?: ReactNode; children: ReactNode }) {
  return (
    <section className="card">
      <header>
        <h2>{title}</h2>
        {help && <p className="help">{help}</p>}
      </header>
      {children}
    </section>
  );
}

export function Pass({ ok, label }: { ok: boolean | null; label: string }) {
  const text = ok == null ? "Not tested" : ok ? "Pass" : "Fail";
  return (
    <span className={`pass ${ok == null ? "na" : ok ? "yes" : "no"}`} title={label}>
      <span aria-hidden>{ok == null ? "?" : ok ? "✓" : "✕"}</span> {text}
    </span>
  );
}
