// A command palette: type to filter a list of actions, arrow keys to move, Enter to run.
// The app shells open it with Cmd or Ctrl plus K. Built on Dialog so it traps focus and
// closes on Escape like every other overlay.
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Icon } from "./icons";
import { Kbd } from "./text";
import { Dialog } from "./overlays";

export interface Command { id: string; label: string; group?: string; hint?: ReactNode; icon?: string; keywords?: string; run: () => void }

/** Scores how well a query matches a label: every word must appear, earlier is better. */
export function matchCommand(c: Command, q: string): number {
  const hay = `${c.label} ${c.keywords ?? ""} ${c.group ?? ""}`.toLowerCase();
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return 1;
  let score = 0;
  for (const w of words) {
    const at = hay.indexOf(w);
    if (at < 0) return 0;
    score += at === 0 ? 3 : hay[at - 1] === " " ? 2 : 1;
  }
  return score;
}

export function CommandPalette({ open, onClose, commands, placeholder = "Type a command or search" }:
  { open: boolean; onClose: () => void; commands: Command[]; placeholder?: string }) {
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const list = useRef<HTMLUListElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const shown = useMemo(() => commands.map((c) => [c, matchCommand(c, q)] as const).filter(([, s]) => s > 0)
    .sort((a, b) => b[1] - a[1]).map(([c]) => c).slice(0, 50), [commands, q]);
  useEffect(() => {
    if (!open) return;
    setQ(""); setActive(0);
    // The dialog moves focus to itself when it opens; the search field takes it after.
    const id = requestAnimationFrame(() => input.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);
  useEffect(() => setActive(0), [q]);
  useEffect(() => { list.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" }); }, [active]);
  const run = (c: Command | undefined) => { if (!c) return; onClose(); c.run(); };
  return (
    <Dialog open={open} onClose={onClose} title="Commands" width={620}>
      <div className="ui-cmd">
        <div className="ui-cmd-field">
          <Icon name="search" size={15} />
          <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} aria-label={placeholder}
            role="combobox" aria-expanded aria-controls="ui-cmd-list" aria-activedescendant={shown[active] ? `ui-cmd-${shown[active].id}` : undefined}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(shown.length - 1, i + 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
              else if (e.key === "Enter") { e.preventDefault(); run(shown[active]); }
            }} />
        </div>
        <ul ref={list} id="ui-cmd-list" className="ui-cmd-list" role="listbox" aria-label="Results">
          {shown.length === 0 && <li className="ui-cmd-empty">Nothing matches "{q}".</li>}
          {shown.map((c, i) => (
            <li key={c.id} id={`ui-cmd-${c.id}`} data-i={i} role="option" aria-selected={i === active} className={i === active ? "on" : ""}
              onMouseMove={() => setActive(i)} onClick={() => run(c)}>
              {c.icon && <Icon name={c.icon} size={14} />}
              <span className="ui-cmd-label">{c.label}</span>
              {c.group && <span className="ui-cmd-group">{c.group}</span>}
              {c.hint && <span className="ui-cmd-hint">{c.hint}</span>}
            </li>
          ))}
        </ul>
        <div className="ui-cmd-foot"><span><Kbd>↑</Kbd><Kbd>↓</Kbd> move</span><span><Kbd>Enter</Kbd> open</span><span><Kbd>Esc</Kbd> close</span></div>
      </div>
    </Dialog>
  );
}
