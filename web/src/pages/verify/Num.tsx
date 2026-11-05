// A number on a Verify result with its one-line meaning, on hover, focus or tap (REF-0016,
// acceptance test 10). The page refuses a number that has no explanation (explain.ts).
import { createContext, type ReactNode } from "react";
import { explain } from "../../lib/verify/explain";
import { Tooltip } from "../../ui";

/** On the public pages (/verify/, /v/<id>, a shared report) links go to the public glossary and lessons, not into the app. */
export const PublicLinks = createContext(false);

export function Num({ id, children }: { id: string; children: ReactNode }) {
  const text = explain(id);
  return (
    <Tooltip text={text}>
      <span className="vf-num" tabIndex={0} data-explain={text} aria-label={`${typeof children === "string" ? children : ""}. ${text}`.replace(/^\. /, "")}>{children}</span>
    </Tooltip>
  );
}
