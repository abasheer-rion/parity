// Shared parts of the data registry pages (DEC-0064): loading with a reserved height, the
// health dot, the rights badge and the links between the three pages.
import { useEffect, useState, type ReactNode } from "react";
import { Badge } from "../../ui";
import { dotFor, HEALTH_WORD, RIGHTS_HELP, RIGHTS_WORD, STATUS_WORD, type Health, type Rights, type SeriesStatus } from "../../lib/registry";

export type Load<T> = { state: "loading" } | { state: "ok"; data: T } | { state: "error"; message: string };

export function useLoad<T>(fn: () => Promise<T>, deps: unknown[] = []): Load<T> {
  const [v, setV] = useState<Load<T>>({ state: "loading" });
  useEffect(() => {
    let live = true;
    setV({ state: "loading" });
    fn().then((data) => live && setV({ state: "ok", data })).catch((e: Error) => live && setV({ state: "error", message: e.message || "Could not load." }));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return v;
}

/** The content once loaded; until then a line that holds roughly the content's height. */
export function Pending<T>({ v, rows, children }: { v: Load<T>; rows: number; children: (d: T) => ReactNode }) {
  if (v.state === "ok") return <>{children(v.data)}</>;
  return (
    <p className="muted small lat-pending" style={{ minHeight: `${rows * 30}px` }} role={v.state === "error" ? "alert" : undefined}>
      {v.state === "error" ? `Not available: ${v.message}` : "Loading."}
    </p>
  );
}

export function HealthDot({ h }: { h: Health }) {
  return <><span className={`service-dot ${dotFor(h)}`} aria-hidden="true" />{HEALTH_WORD[h]}</>;
}

export function RightsBadge({ r }: { r: Rights }) {
  const tone = r === "public" ? "good" : r === "internal" ? "info" : r === "research" ? "warning" : "neutral";
  return <span title={RIGHTS_HELP[r]}><Badge tone={tone}>{RIGHTS_WORD[r]}</Badge></span>;
}

export function StatusBadge({ s }: { s: SeriesStatus }) {
  const tone = s === "live" ? "good" : s === "degraded" ? "bad" : s === "candidate" ? "warning" : s === "retired" ? "neutral" : "info";
  return <Badge tone={tone}>{STATUS_WORD[s]}</Badge>;
}

const VIEWS: [string, string][] = [["#/registry", "Data catalog"], ["#/registry/candidates", "Candidates"], ["#/registry/health", "Data health"]];

/** Links between the three registry pages; the current one is marked for screen readers. */
export function RegistryNav({ here }: { here: string }) {
  return (
    <nav className="filters" aria-label="Data registry pages">
      {VIEWS.map(([href, label]) => (
        <a key={href} href={href} className={`ui-badge ${href === here ? "ui-badge-accent" : "ui-badge-neutral"}`} aria-current={href === here ? "page" : undefined}>{label}</a>
      ))}
    </nav>
  );
}

export const date = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : "n/a");
export const pct = (v: number | null | undefined, d = 1) => (v == null ? "n/a" : `${(v * 100).toFixed(d)}%`);
export const num = (v: number | null | undefined, d = 2) => (v == null ? "n/a" : v.toFixed(d));
