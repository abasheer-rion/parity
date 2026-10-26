// The latency badge (DEC-0052, DEC-0056): on every live chart and quote, a tiny line saying
// how fresh the price is. Feed type (real-time, delayed 15 min, end of day, or "Internal use,
// real-time" for team-only feeds), source, the whole trip from the exchange to this screen
// in ms, and the data's age; green, amber when late, red when stale or the line is down.
// The words are plain: "Live, 0.4 s" (median exchange to screen), "Delayed 1 min", "Team
// live, 0.1 s" (DEC-0063). Click it for every hop, the median and 95th percentile of the last 200 updates, reconnects
// and lost updates. It redraws at most twice a second, not per tick.
import { useEffect, useRef, useState } from "react";
import { Popover } from "../ui";
import { subscribeStatus, type FeedStatus } from "../lib/live/client";
import { freshness, msText, type Freshness } from "../lib/live/latency";
import { feedLabel, feedShort, type FeedType } from "../lib/live/protocol";
import { INTERNAL_LABEL, sourceById } from "../lib/live/sources";
import "./liveBadge.css";
import { useLivePaused } from "../lib/live/pause";

/** Seconds for the badge: 0.04 s, 0.4 s, 2.1 s, then minutes. */
export function secText(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return "n/a";
  if (ms < 100) return `${(Math.max(0, ms) / 1000).toFixed(2)} s`;
  if (ms < 10_000) return `${(ms / 1000).toFixed(1)} s`;
  return msText(ms);
}

/** The badge's words, plain (DEC-0063): "Live, 0.4 s", "Delayed 1 min", "Team live, 0.1 s",
 *  or what is wrong ("Source down", "Connecting"). */
export function badgeText(o: { feed: FeedType; delay?: number; internal: boolean; refused: boolean; e2e: number | null; up: boolean; down: boolean; connecting: boolean }): string {
  if (o.refused) return "Team only";
  if (o.feed === "eod") return "End of day";
  if (o.down) return "Source down";
  if (o.feed === "delayed") return `Delayed ${o.delay ?? 15} min`;
  const live = o.internal ? "Team live" : "Live";
  if (o.e2e != null) return `${live}, ${secText(o.e2e)}`;
  if (o.up) return `${live}, waiting`;
  return o.connecting ? "Connecting" : "Offline";
}

const time = (ms: number | null | undefined) => (ms ? new Date(ms).toISOString().slice(11, 23) : "n/a");

/** A badge for a live source: reads the shared line's status twice a second. */
export function LiveBadge({ src, compact = false }: { src: string; compact?: boolean }) {
  const ref = useRef<FeedStatus | null>(null);
  const [, tick] = useState(0);
  useEffect(() => subscribeStatus(src, (s) => { ref.current = s; }), [src]);
  // Redraws twice a second, except while live updates are paused (WCAG 2.2.2).
  const paused = useLivePaused();
  useEffect(() => { if (paused) return; const t = window.setInterval(() => tick((n) => n + 1), 500); return () => window.clearInterval(t); }, [paused]);
  const s = ref.current;
  const meta = sourceById(src);
  const feed: FeedType = s?.feed ?? meta?.feed ?? "rt";
  const delay = s?.delay ?? meta?.delayMin;
  const now = Date.now() + (s?.offset ?? 0);
  const age = s?.lastTe ? Math.max(0, now - s.lastTe) : null;
  const up = !!s && s.line === "open" && s.upstream === "up";
  const fresh: Freshness = s?.lastTe ? freshness(feed, age, s.last?.e2e ?? null, up, delay) : up ? "late" : "stale";
  const internal = !!s?.internal || meta?.licence === "internal";
  const kind = internal ? INTERNAL_LABEL : feedLabel(feed, delay);
  const label = `${kind}, ${meta?.name ?? src}. ${s?.last ? `Exchange to screen ${msText(s.last.e2e)}.` : ""} Data age ${msText(age)}.${up ? "" : s?.refused ? " Team only." : " Line not connected."}`;
  const word = badgeText({ feed, delay, internal, refused: !!s?.refused, e2e: s?.last ? s.p50 ?? s.last.e2e : null, up, down: s?.line === "open" && s.upstream === "down", connecting: s?.line === "connecting" || s?.upstream === "connecting" });
  return (
    <Popover label="Latency" width={300} placement="bottom-end" trigger={() => (
      // The spoken name starts with the words on the badge, so voice control can find it (WCAG 2.5.3).
      <button type="button" className={`lvb lvb-${fresh}`} aria-label={[word, compact ? null : meta?.short ?? src].filter(Boolean).join(" ") + `. ${label}`}>
        <i className="lvb-dot" aria-hidden />
        {/* Spaces between the parts, so the words read apart (a flex box does not draw them). */}
        <span className="tabular">{word}</span>
        {!compact && <>{" "}<span className="lvb-src">{meta?.short ?? src}</span></>}
      </button>
    )}>
      <dl className="lvb-card">
        <div><dt>Feed</dt><dd>{kind}</dd></div>
        <div><dt>Source</dt><dd>{meta ? <a href={meta.terms} target="_blank" rel="noreferrer">{meta.name}</a> : src}</dd></div>
        {internal && <div><dt>Who sees it</dt><dd>Team only. Not shown to the public.</dd></div>}
        {src === "onchain" && <div><dt>Timing</dt><dd>From the Base block. A swap waits up to 2 s for its block.</dd></div>}
        <div><dt>Exchange time</dt><dd className="tabular">{time(s?.lastTe)}</dd></div>
        <div><dt>Our edge got it</dt><dd className="tabular">+{msText(s?.last?.feed)}</dd></div>
        <div><dt>Our edge sent it</dt><dd className="tabular">+{msText(s?.last?.edge)}</dd></div>
        <div><dt>Your browser got it</dt><dd className="tabular">+{msText(s?.last?.net)}</dd></div>
        <div><dt>On your screen</dt><dd className="tabular">+{msText(s?.last?.screen)}</dd></div>
        <div><dt>Whole trip</dt><dd className="tabular">{msText(s?.last?.e2e)}</dd></div>
        <div><dt>Median, 95th</dt><dd className="tabular">{s?.p50 != null ? `${msText(s.p50)}, ${msText(s.p95)}` : "n/a"}</dd></div>
        <div><dt>Data age</dt><dd className="tabular">{msText(age)}</dd></div>
        <div><dt>Clock check</dt><dd className="tabular">{s && Number.isFinite(s.rtt) ? `±${msText(s.rtt / 2)}` : "n/a"}</dd></div>
        <div><dt>Line</dt><dd>{s ? `${s.line === "open" ? "Connected" : s.line === "connecting" ? "Connecting" : "Closed"}, source ${s.upstream}${s.why ? ` (${s.why})` : ""}` : "n/a"}</dd></div>
        <div><dt>Reconnects</dt><dd className="tabular">{s?.reconnects ?? 0}</dd></div>
        <div><dt>Lost updates</dt><dd className="tabular">{s?.gaps ?? 0}</dd></div>
      </dl>
    </Popover>
  );
}

/** A badge for data that is not streamed: delayed or end of day, judged on its own time. */
export function StaticBadge({ feed, source, asOf, compact = false, terms, delayMin }: { feed: FeedType; source: string; asOf: string | number | null; compact?: boolean; terms?: string; delayMin?: number }) {
  const t = typeof asOf === "number" ? asOf : asOf ? Date.parse(asOf.length === 10 ? `${asOf}T21:00:00Z` : asOf) : NaN;
  const age = Number.isFinite(t) ? Math.max(0, Date.now() - t) : null;
  const fresh = freshness(feed, age, null, age != null, delayMin);
  const label = `${feedLabel(feed, delayMin)}, ${source}. Data age ${msText(age)}.`;
  const shown = feed === "eod" ? "End of day" : feed === "delayed" ? `Delayed ${delayMin ?? 15} min` : feedShort(feed, delayMin);
  return (
    <Popover label="Data age" width={260} placement="bottom-end" trigger={() => (
      <button type="button" className={`lvb lvb-${fresh}`} aria-label={[shown, compact ? null : source, compact ? null : `${msText(age)} old`].filter(Boolean).join(" ") + `. ${label}`}>
        <i className="lvb-dot" aria-hidden />
        <span>{shown}</span>
        {!compact && <>{" "}<span className="lvb-src">{source}</span>{" "}<span className="tabular lvb-age">{msText(age)} old</span></>}
      </button>
    )}>
      <dl className="lvb-card">
        <div><dt>Feed</dt><dd>{feedLabel(feed, delayMin)}</dd></div>
        <div><dt>Source</dt><dd>{terms ? <a href={terms} target="_blank" rel="noreferrer">{source}</a> : source}</dd></div>
        <div><dt>Last value</dt><dd className="tabular">{Number.isFinite(t) ? new Date(t).toISOString().slice(0, 16).replace("T", " ") : "n/a"}</dd></div>
        <div><dt>Data age</dt><dd className="tabular">{msText(age)}</dd></div>
        <div><dt>Not live</dt><dd>{feed === "eod" ? "One price a day, after the close." : `Shown about ${delayMin ?? 15} minutes late.`}</dd></div>
      </dl>
    </Popover>
  );
}
