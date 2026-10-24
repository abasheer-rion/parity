// One quiet line that says whether the always-on search and sims are alive (DEC-0037),
// read live from the database. A service silent for two hours shows as stale.
import { useEffect, useState } from "react";
import { healthParts, loadHeartbeats, type Heartbeat } from "../lib/health";

export function ServiceHealth({ className = "" }: { className?: string }) {
  const [rows, setRows] = useState<Heartbeat[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    let live = true;
    const load = () => loadHeartbeats().then((r) => { if (live) { setRows(r); setFailed(false); setNow(Date.now()); } }).catch(() => live && setFailed(true));
    load();
    const t = window.setInterval(load, 60_000);
    return () => { live = false; window.clearInterval(t); };
  }, []);
  if (failed && !rows) return <p className={`small muted service-health ${className}`}>Service status is not available right now.</p>;
  if (!rows) return null;
  const parts = healthParts(rows, now);
  return (
    <p className={`small muted service-health ${className}`} aria-live="polite">
      <span className="sr-only">Background services: </span>
      {parts.map((p, i) => (
        <span key={p.service}>
          {i > 0 && "; "}
          <span className={p.stale ? "down" : ""}><span className={`service-dot ${p.stale ? "stale" : "live"}`} aria-hidden="true" />{p.text}</span>
        </span>
      ))}
    </p>
  );
}
