// One clear next step on Home after the first-run intro (DEC-0077): the first getting started
// item not done yet, in the order the person's answers put the checklist in, with one button
// that goes where it happens. "Not now" hides that item's card in this browser; the next
// item gets its own card once there is one. The checklist ring keeps the full list.
import { useState } from "react";
import { Button } from "../ui";
import { track } from "../lib/analytics";
import { useChecklist } from "./Checklist";
import type { ItemId } from "./items";

const KEY = "parity.nextstep.hidden.v1";
const ACTION: Partial<Record<ItemId, string>> = {
  verify: "Open Verify", trade: "Open Trade", watch: "Open your watchlists", lesson: "Start a lesson",
  ai: "Connect your AI", mfa: "Open Account settings",
};

function readHidden(): string[] {
  try { const v = JSON.parse(window.localStorage.getItem(KEY) ?? "[]"); return Array.isArray(v) ? v.filter((x) => typeof x === "string") : []; } catch { return []; }
}

export function NextStep() {
  const { s, p } = useChecklist();
  const [hidden, setHidden] = useState(readHidden);
  if (!s.ready || !s.checked || !s.row.intro_status || s.introOpen) return null;
  const item = p.items.find((i) => !i.done && i.href && ACTION[i.id] && !hidden.includes(i.id));
  if (!item) return null;
  const hide = () => {
    const next = [...hidden, item.id];
    setHidden(next);
    try { window.localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* private window */ }
    track("next_step_hidden", { item: item.id });
  };
  return (
    <section className="onb-next ui-fade-in" aria-labelledby="onb-next-t">
      <div className="onb-next-text">
        <h2 id="onb-next-t" className="onb-next-title">{item.title}</h2>
        <p className="onb-next-body">{item.body}</p>
        <p className="onb-next-count">{p.done} of {p.total} getting started steps done.</p>
      </div>
      <div className="onb-next-acts">
        <Button variant="accent" size="lg" href={item.href} onClick={() => track("next_step_open", { item: item.id })}>{ACTION[item.id]}</Button>
        <Button variant="tertiary" onClick={hide}>Not now</Button>
      </div>
    </section>
  );
}
