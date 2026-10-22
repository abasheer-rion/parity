// A row of short findings under a home page's first block. Every line is computed
// from the data on the page (lib/insights.ts), and the row says so and from what.
import type { CSSProperties } from "react";
import { Reveal } from "../ui";
import type { Insight } from "../lib/insights";

export function Insights({ items, source }: { items: Insight[]; source: string }) {
  if (!items.length) return null;
  return (
    <section className="insights" aria-label="Findings computed from the data">
      <ul style={{ "--n": Math.min(items.length, 4) } as CSSProperties}>
        {items.map((i, k) => (
          <Reveal as="li" key={i.lead} delay={k * 50}>
            {i.href ? (
              <a href={i.href}><span className="insight-lead">{i.lead}</span><span className="insight-text">{i.text}</span></a>
            ) : (
              <div><span className="insight-lead">{i.lead}</span><span className="insight-text">{i.text}</span></div>
            )}
          </Reveal>
        ))}
      </ul>
      <p className="insights-src">Computed from {source}. Nothing here is written by hand or by a model.</p>
    </section>
  );
}
