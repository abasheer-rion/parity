// Loading placeholders, each the same size as the thing it stands in for, so nothing
// moves when the real content arrives. A slow shimmer runs across them; with reduced
// motion they hold still. Screen readers hear one "Loading" per block, not each bar.
import type { CSSProperties, ReactNode } from "react";

export function Skeleton({ width = "100%", height = 14, round, className = "", style }:
  { width?: number | string; height?: number | string; round?: boolean; className?: string; style?: CSSProperties }) {
  return <span className={`ui-skel ${className}`} style={{ width, height, borderRadius: round ? 999 : 6, ...style }} aria-hidden />;
}

/** A block that announces itself once as loading and hides its bars from screen readers. */
function Busy({ label = "Loading", children, className = "", style }: { label?: string; children: ReactNode; className?: string; style?: CSSProperties }) {
  return <div className={`ui-skel-block ${className}`} role="status" aria-label={label} aria-busy style={style}>{children}</div>;
}

/** Lines of text: the last one is shorter, as a paragraph's is. `lineHeight` matches the text it replaces. */
export function SkeletonText({ lines = 3, lineHeight = 24, label }: { lines?: number; lineHeight?: number; label?: string }) {
  return (
    <Busy label={label} className="ui-skel-text" style={{ "--lh": `${lineHeight}px` } as CSSProperties}>
      {Array.from({ length: lines }, (_, i) => <Skeleton key={i} height={Math.round(lineHeight * 0.55)} width={i === lines - 1 && lines > 1 ? "62%" : "100%"} />)}
    </Busy>
  );
}

/** A KPI: label, big value, small note. Same heights as Stat at each size. */
export function SkeletonStat({ size = "md", label }: { size?: "sm" | "md" | "lg"; label?: string }) {
  const value = { sm: 22, md: 30, lg: 42 }[size];
  return (
    <Busy label={label} className="ui-skel-stat">
      <Skeleton width="45%" height={12} style={{ margin: "4px 0 8px" }} />
      <Skeleton width="70%" height={value - 8} style={{ margin: "4px 0" }} />
      <Skeleton width="35%" height={12} style={{ marginTop: 8 }} />
    </Busy>
  );
}

/** A chart's box at its final height, with a faint baseline, so the chart lands without a jump. */
export function SkeletonChart({ height = 300, label }: { height?: number; label?: string }) {
  return (
    <Busy label={label ?? "Loading chart"} className="ui-skel-chart" style={{ height }}>
      <Skeleton width="100%" height="100%" style={{ opacity: 0.55 }} />
    </Busy>
  );
}

/** Table rows at the table's row height. `cols` sets the widths, the first column widest. */
export function SkeletonTable({ rows = 8, cols = 5, rowHeight = 48, header = true, label }:
  { rows?: number; cols?: number; rowHeight?: number; header?: boolean; label?: string }) {
  const widths = Array.from({ length: cols }, (_, i) => (i === 0 ? "38%" : `${Math.round(62 / (cols - 1 || 1))}%`));
  const row = (h: number, k: number, faint?: boolean) => (
    <div key={k} className="ui-skel-row" style={{ height: h }}>
      {widths.map((w, i) => (
        <span key={i} style={{ width: w, justifyContent: i === 0 ? "flex-start" : "flex-end" }}>
          <Skeleton width={i === 0 ? "70%" : "55%"} height={faint ? 10 : 12} style={faint ? { opacity: 0.6 } : undefined} />
        </span>
      ))}
    </div>
  );
  return (
    <Busy label={label ?? "Loading table"} className="ui-skel-table">
      {header && row(40, -1, true)}
      {Array.from({ length: rows }, (_, i) => row(rowHeight, i))}
    </Busy>
  );
}

/** A card with a title line and a few lines of body, or anything you put in it. */
export function SkeletonCard({ height, lines = 3, children, label }: { height?: number; lines?: number; children?: ReactNode; label?: string }) {
  return (
    <Busy label={label} className="ui-skel-card" style={height ? { height } : undefined}>
      {children ?? (
        <>
          <Skeleton width="40%" height={14} style={{ marginBottom: 14 }} />
          {Array.from({ length: lines }, (_, i) => <Skeleton key={i} height={12} width={i === lines - 1 ? "60%" : "100%"} style={{ marginBottom: 10 }} />)}
        </>
      )}
    </Busy>
  );
}

/**
 * A whole page while its data loads: the title area, then a row of stats, a chart, a
 * table or a grid of cards, in the order given. Use the same shape as the page.
 */
export function PageSkeleton({ parts = ["stats", "table"], label = "Loading page" }:
  { parts?: ("stats" | "chart" | "table" | "cards" | "text")[]; label?: string }) {
  return (
    <div className="ui-skel-page" role="status" aria-label={label} aria-busy>
      {parts.map((p, i) => (
        <div key={i} aria-hidden>
          {p === "stats" && <div className="ui-skel-stats">{[0, 1, 2, 3].map((k) => <SkeletonStat key={k} />)}</div>}
          {p === "chart" && <SkeletonChart />}
          {p === "table" && <SkeletonTable />}
          {p === "text" && <SkeletonText lines={4} />}
          {p === "cards" && <div className="ui-skel-cards">{[0, 1, 2, 3, 4, 5].map((k) => <SkeletonCard key={k} />)}</div>}
        </div>
      ))}
    </div>
  );
}
