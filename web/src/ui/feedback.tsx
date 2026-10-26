// Feedback parts: progress, errors with a way out, and a spinner. Read tokens only.
import type { ReactNode } from "react";
import { Button } from "./buttons";
import { Icon } from "./icons";

/** How far along something is. With no value it shows a quiet moving bar (busy, unknown length). */
export function ProgressBar({ value, label, showValue, tone = "accent" }:
  { value?: number | null; label: string; showValue?: boolean; tone?: "accent" | "positive" | "warning" | "negative" }) {
  const known = value != null && Number.isFinite(value);
  const pct = known ? Math.max(0, Math.min(1, value as number)) : 0;
  return (
    <div className={`ui-progress ui-progress-${tone}`}>
      <div className="ui-progress-track" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100}
        aria-valuenow={known ? Math.round(pct * 100) : undefined} data-busy={known ? undefined : ""}>
        <i style={known ? { transform: `scaleX(${pct})` } : undefined} />
      </div>
      {showValue && known && <span className="ui-progress-value ui-num">{Math.round(pct * 100)}%</span>}
    </div>
  );
}

/** A small spinner for a part that is loading. Prefer a skeleton for whole sections. */
export function Spinner({ label = "Loading" }: { label?: string }) {
  return <span className="ui-spinner" role="status" aria-label={label} />;
}

/**
 * Something failed to load. Says what, in plain words, and offers Retry. Use in place of
 * the content that failed, at the same size, so nothing around it moves.
 */
export function ErrorState({ title = "This did not load", children, onRetry, retrying, compact }:
  { title?: string; children?: ReactNode; onRetry?: () => void; retrying?: boolean; compact?: boolean }) {
  return (
    <div className={`ui-error ${compact ? "compact" : ""}`} role="alert">
      <span className="ui-error-icon" aria-hidden><Icon name="info" size={compact ? 14 : 18} /></span>
      <div className="ui-error-text">
        <strong>{title}</strong>
        {children && <p>{children}</p>}
      </div>
      {onRetry && <Button size="sm" icon="restart" onClick={onRetry} loading={retrying}>Retry</Button>}
    </div>
  );
}
