// The visible Pause / Resume control for anything that updates by itself (WCAG 2.2.2): live
// prices, books, trades, the markets board and the Terminal's ticker tape. One switch for
// the whole page (lib/live/pause.ts).
import { Icon } from "../ui/icons";
import { setLivePaused, useLivePaused } from "../lib/live/pause";

export function PauseLive({ className = "" }: { className?: string }) {
  const paused = useLivePaused();
  const label = paused ? "Resume live updates" : "Pause live updates";
  return (
    <button type="button" className={`ui-btn ui-btn-tertiary ui-btn-sm ui-pause-live ${className}`} onClick={() => setLivePaused(!paused)} title={label} aria-label={label}>
      <Icon name={paused ? "play" : "pause"} size={12} />
      <span aria-hidden="true">{paused ? "Resume" : "Pause"}</span>
    </button>
  );
}
