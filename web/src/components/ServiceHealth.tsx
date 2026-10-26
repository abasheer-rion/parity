// One quiet line that says whether the always-on search and sims are alive (DEC-0037),
// read live from the database. A service silent for two hours shows as stale. A second
// line (DEC-0045) says how old the site's news and prices are and how late the last
// scheduled refresh started; it is always one line high, so nothing below it moves.
import { useEffect, useState } from "react";
import { healthParts, loadHeartbeats, type Heartbeat } from "../lib/health";
import { healthExtras, loadHealthExtras, type HealthExtra } from "../lib/latency";

export function ServiceHealth({ className = "" }: { className?: string }) {
  const [rows, setRows] = useState<Heartbeat[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [extras, setExtras] = useState<HealthExtra[] | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    let live = true;
    const load = () => {
      loadHeartbeats().then((r) => { if (live) { setRows(r); setFailed(false); setNow(Date.now()); } }).catch(() => live && setFailed(true));
      loadHealthExtras().then((x) => { if (live) setExtras(healthExtras(x.fresh, x.steps, Date.now())); }).catch(() => live && setExtras([]));
    };
    load();
    const t = window.setInterval(load, 60_000);
    return () => { live = false; window.clearInterval(t); };
  }, []);
  const extraLine = (
    <p className={`small muted service-health service-extra ${className}`} aria-hidden={extras?.length ? undefined : true}>
      {extras?.length ? extras.map((x, i) => (
        <span key={x.text}>{i > 0 && "; "}<span className={x.stale ? "down" : ""}>{x.text}</span></span>
      )) : "\u00a0"}
    </p>
  );
  if (failed && !rows) return <><p className={`small muted service-health ${className}`}>Service status is not available right now.</p>{extraLine}</>;
  // Hold the lines while the status loads, so the page below does not jump when it arrives.
  if (!rows) return <><p className={`small muted service-health ${className}`} aria-hidden="true">&nbsp;</p>{extraLine}</>;
  const parts = healthParts(rows, now);
  return (
    <>
      {/* Not a live region: it refreshes every minute and would interrupt a screen reader each time. */}
      <p className={`small muted service-health ${className}`}>
        <span className="sr-only">Background services: </span>
        {parts.map((p, i) => (
          <span key={p.service}>
            {i > 0 && "; "}
            <span className={p.stale ? "down" : ""}><span className={`service-dot ${p.stale ? "stale" : "live"}`} aria-hidden="true" />{p.text}</span>
          </span>
        ))}
      </p>
      {extraLine}
    </>
  );
}
