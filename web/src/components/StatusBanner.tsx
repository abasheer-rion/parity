// The site-wide warnings banner in the app (DEC-0073): current problems from /status.json,
// such as live prices not updating. Each can be closed and stays closed in this browser.
// Shows nothing when there are no warnings or the file cannot be read. It sits in the page
// flow at the top of the page column, so it never covers anything (DEC-0061).
import { useEffect, useState } from "react";
import { dismiss, LEVELS, loadStatus, readDismissed, visibleWarnings, type StatusWarning } from "../lib/statusBanner";
import "./statusBanner.css";

function store(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function StatusBanner({ fetcher }: { fetcher?: typeof fetch }) {
  const [warnings, setWarnings] = useState<StatusWarning[]>([]);
  const [closed, setClosed] = useState<string[]>(() => readDismissed(store()));

  useEffect(() => {
    let live = true;
    loadStatus(fetcher ?? fetch).then((w) => { if (live) setWarnings(w); });
    return () => { live = false; };
  }, [fetcher]);

  const shown = visibleWarnings(warnings, closed);
  // The live region stays mounted so screen readers hear a warning when it arrives.
  return (
    <div className="psb" role="status" aria-live="polite" hidden={shown.length === 0}>
      {shown.map((w) => (
        <div key={w.id} className={`psb-item psb-${w.level}`} data-id={w.id}
          style={{ background: LEVELS[w.level].bg, color: LEVELS[w.level].fg, borderColor: LEVELS[w.level].edge }}>
          <p className="psb-text">
            <strong>{LEVELS[w.level].word}:</strong> {w.title}.{w.detail ? ` ${w.detail}` : ""}
            {w.link && <> <a href={w.link}>More</a></>}
          </p>
          <button type="button" className="psb-x" aria-label={`Dismiss this notice: ${w.title}`}
            onClick={() => setClosed(dismiss(store(), w.id))}>Dismiss</button>
        </div>
      ))}
    </div>
  );
}
