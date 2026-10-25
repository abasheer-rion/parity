// What every form in the sign-in panel shares (DEC-0044): where to go afterwards, the email
// typed so far, how to switch to another form in place, and the heading each form shows.
import { createContext, useContext, type MouseEvent, type ReactNode } from "react";
import { authUrl, type Carry, type View } from "./views";

export interface Flow {
  /** "page" on /login/ and the other sign-in pages, "front" in the front page's panel. */
  host: "page" | "front";
  /** Where to go after signing in, already made safe (redirect.ts). */
  next: string;
  /** The email typed so far, kept while switching between forms. */
  email: string;
  setEmail: (v: string) => void;
  /** What the form that opened this one handed over. */
  carry: Carry;
  /** Switch to another form (or restart this one) in place. */
  show: (view: View, carry?: Carry) => void;
  /** The id of the current form's heading, which names the panel. */
  titleId: string;
}

export const FlowContext = createContext<Flow | null>(null);

export function useFlow(): Flow {
  const flow = useContext(FlowContext);
  if (!flow) throw new Error("useFlow outside AuthFlow");
  return flow;
}

/**
 * One step of a form: its heading, a line under it, then the fields. A new `id` replays
 * the short fade, and the panel's height follows the content (AuthFlow.tsx).
 * `wait` keeps the step laid out but hidden, while the session is checked.
 */
export function Screen({ id, title, lead, wait, children }: { id: string; title: string; lead?: ReactNode; wait?: boolean; children?: ReactNode }) {
  const { host, titleId } = useFlow();
  const Heading = host === "front" ? "h2" : "h1";
  return (
    <div className="pa-screen" key={id} data-wait={wait || undefined} aria-busy={wait || undefined}>
      <Heading className="pa-title" id={titleId}>{title}</Heading>
      {lead && <p className="pa-lead">{lead}</p>}
      {children}
    </div>
  );
}

const plainClick = (e: MouseEvent) => !(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0);

/** A link to another form. It switches in place; opened in a new tab it is a normal page. */
export function SwitchLink({ to, carry, children, className }: { to: View; carry?: Carry; children: ReactNode; className?: string }) {
  const { next, show } = useFlow();
  return (
    <a className={className} href={authUrl(to, next, carry)} onClick={(e) => { if (!plainClick(e)) return; e.preventDefault(); show(to, carry); }}>
      {children}
    </a>
  );
}

export { plainClick };
