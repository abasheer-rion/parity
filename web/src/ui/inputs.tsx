// Form controls: text and search fields, selects, segmented choices, switches and
// checkboxes. All are 32px tall by default with a 1px quiet border.
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Icon } from "./icons";
import { ListSelect } from "./overlays";

export function Input({ value, onChange, placeholder, type = "text", label, autoFocus }:
  { value: string; onChange: (v: string) => void; placeholder?: string; type?: string; label?: string; autoFocus?: boolean }) {
  const field = <input className="ui-input" type={type} value={value} placeholder={placeholder} autoFocus={autoFocus} onChange={(e) => onChange(e.target.value)} aria-label={label ?? placeholder} />;
  return label ? <label className="ui-field"><span className="ui-field-label">{label}</span>{field}</label> : field;
}

export function SearchInput({ value, onChange, placeholder = "Search", autoFocus }: { value: string; onChange: (v: string) => void; placeholder?: string; autoFocus?: boolean }) {
  return (
    <div className="ui-search">
      <Icon name="search" size={14} />
      <input type="search" value={value} placeholder={placeholder} autoFocus={autoFocus} onChange={(e) => onChange(e.target.value)} aria-label={placeholder} />
      {value && <button className="ui-search-clear" aria-label="Clear" onClick={() => onChange("")}>×</button>}
    </div>
  );
}

/** Choose one from a list: opens Parity's own menu, not the browser's pop-up (ListSelect). */
export function Select<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: [T, string][]; label: string }) {
  return <ListSelect value={value} onChange={onChange} options={options} label={label} />;
}

/** Choose one of a few, as underline tabs. A blue line slides under the chosen option. */
export function Segmented<T extends string>({ value, onChange, options, label, size = "md" }:
  { value: T; onChange: (v: T) => void; options: [T, ReactNode][]; label?: string; size?: "sm" | "md" }) {
  const ind = useIndicator<HTMLDivElement>(Math.max(0, options.findIndex(([v]) => v === value)), [options.length]);
  return (
    <div ref={ind.ref} style={ind.style} data-ready={ind.ready || undefined} className={`ui-seg ui-seg-${size}`} role="radiogroup" aria-label={label}
      onKeyDown={(e) => {
        // Arrow keys move between options, as in a native radio group.
        const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
        if (!step) return;
        e.preventDefault();
        const i = options.findIndex(([v]) => v === value);
        const nextValue = options[(i + step + options.length) % options.length][0];
        onChange(nextValue);
        const buttons = (e.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>("button");
        buttons[(i + step + options.length) % options.length]?.focus();
      }}>
      <i className="ui-seg-thumb" aria-hidden />
      {options.map(([v, l]) => (
        <button key={v} type="button" role="radio" data-ind aria-checked={v === value} tabIndex={v === value ? 0 : -1} className={v === value ? "on" : ""} onClick={() => onChange(v)}>{l}</button>
      ))}
    </div>
  );
}

export interface Choice<T extends string> { value: T; title: string; body?: ReactNode; icon?: string }

/**
 * Choose one of a few big options: a row of cards, each with an icon, a title and a line
 * under it. A radio group: Tab reaches the chosen card, the arrow keys move and choose.
 */
export function ChoiceCards<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: Choice<T>[]; label: string }) {
  const id = useId();
  return (
    <div className="ui-choices" role="radiogroup" aria-label={label}
      onKeyDown={(e) => {
        const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
        if (!step) return;
        e.preventDefault();
        const i = Math.max(0, options.findIndex((o) => o.value === value));
        const next = (i + step + options.length) % options.length;
        onChange(options[next].value);
        (e.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>("[role=radio]")[next]?.focus();
      }}>
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <button key={o.value} type="button" role="radio" aria-checked={on} tabIndex={on ? 0 : -1} className={`ui-choice ${on ? "on" : ""}`}
            aria-labelledby={`${id}-${i}`} aria-describedby={o.body ? `${id}-${i}-b` : undefined} onClick={() => onChange(o.value)}>
            {o.icon && <span className="ui-choice-icon" aria-hidden><Icon name={o.icon} size={20} /></span>}
            <span className="ui-choice-text">
              <span className="ui-choice-t" id={`${id}-${i}`}>{o.title}</span>
              {o.body && <span className="ui-choice-b" id={`${id}-${i}-b`}>{o.body}</span>}
            </span>
            <span className="ui-choice-mark" aria-hidden />
          </button>
        );
      })}
    </div>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return <button role="switch" aria-checked={on} aria-label={label} className={`ui-toggle ${on ? "on" : ""}`} onClick={() => onChange(!on)}><i /></button>;
}

export function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode }) {
  return (
    <label className="ui-check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="ui-check-box" aria-hidden><Icon name="check" size={11} /></span>
      <span>{label}</span>
    </label>
  );
}

/**
 * Places a marker under (or behind) the chosen child of `ref`, and slides it there with
 * a transform when the choice changes. Measured before paint, so it never jumps on load.
 */
function useIndicator<T extends HTMLElement>(index: number, deps: unknown[] = []) {
  const ref = useRef<T>(null);
  const [box, setBox] = useState<{ x: number; y: number; w: number; ready: boolean }>({ x: 0, y: 0, w: 0, ready: false });
  const measure = useCallback(() => {
    const root = ref.current;
    const el = root?.querySelectorAll<HTMLElement>("[data-ind]")[index];
    if (!root || !el) return;
    // y lifts the marker to the chosen option's row when a narrow screen wraps the options.
    const y = Math.min(0, el.offsetTop + el.offsetHeight - root.clientHeight);
    setBox((b) => (b.x === el.offsetLeft && b.w === el.offsetWidth && b.y === y ? b : { x: el.offsetLeft, y, w: el.offsetWidth, ready: b.ready || b.w > 0 }));
  }, [index]);
  useLayoutEffect(measure, [measure, ...deps]);
  useEffect(() => {
    const root = ref.current;
    if (!root || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    // Web fonts can change the labels' widths after first paint.
    document.fonts?.ready.then(measure).catch(() => {});
    return () => ro.disconnect();
  }, [measure]);
  const style = { "--ind-x": `${box.x}px`, "--ind-y": `${box.y}px`, "--ind-w": `${box.w}px`, "--ind-s": box.w } as CSSProperties;
  return { ref, style, ready: box.ready };
}

/**
 * Underlined tabs (Robinhood's range tabs). Small caps, letter-spaced. The underline
 * slides to the chosen tab; arrow keys move between tabs as in a native tab list.
 */
export function Tabs<T extends string>({ value, onChange, tabs, label, tone }: { value: T; onChange: (v: T) => void; tabs: readonly T[] | [T, string][]; label: string; tone?: string }) {
  const list = (tabs as (T | [T, string])[]).map((t) => (Array.isArray(t) ? t : [t, t])) as [T, string][];
  const index = Math.max(0, list.findIndex(([v]) => v === value));
  const ind = useIndicator<HTMLDivElement>(index, [list.length]);
  return (
    <div ref={ind.ref} className="ui-tabs" role="tablist" aria-label={label} style={{ ...ind.style, ...(tone ? { "--ind-color": tone } : {}) } as CSSProperties}
      data-ready={ind.ready || undefined}
      onKeyDown={(e) => {
        const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
        if (!step) return;
        e.preventDefault();
        const next = (index + step + list.length) % list.length;
        onChange(list[next][0]);
        (e.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>("[role=tab]")[next]?.focus();
      }}>
      {list.map(([v, l]) => (
        <button key={v} role="tab" data-ind aria-selected={v === value} tabIndex={v === value ? 0 : -1} className={v === value ? "on" : ""} onClick={() => onChange(v)}
          style={v === value && tone ? { color: tone } : undefined}>{l}</button>
      ))}
      <i className="ui-tabs-ind" aria-hidden />
    </div>
  );
}

/** A labelled field around any control, with help text and an error read out by screen readers. */
export function Field({ label, help, error, children, id }: { label: ReactNode; help?: ReactNode; error?: ReactNode; children: ReactNode; id?: string }) {
  const hid = id ? `${id}-help` : undefined;
  return (
    <label className={`ui-field ${error ? "has-error" : ""}`}>
      <span className="ui-field-label">{label}</span>
      {children}
      {error ? <span className="ui-field-error" role="alert" id={hid}>{error}</span> : help ? <span className="ui-field-help" id={hid}>{help}</span> : null}
    </label>
  );
}

/** Choose exactly one from a short list, all visible. Arrow keys move, as in a native group. */
export function RadioGroup<T extends string>({ value, onChange, options, label, name, inline }:
  { value: T; onChange: (v: T) => void; options: [T, ReactNode][]; label: string; name: string; inline?: boolean }) {
  return (
    <fieldset className={`ui-radios ${inline ? "inline" : ""}`}>
      <legend className="ui-field-label">{label}</legend>
      {options.map(([v, l]) => (
        <label key={v} className="ui-radio">
          <input type="radio" name={name} value={v} checked={v === value} onChange={() => onChange(v)} />
          <span className="ui-radio-dot" aria-hidden />
          <span>{l}</span>
        </label>
      ))}
    </fieldset>
  );
}

/** A number picked by dragging, with the value printed beside it in tabular figures. */
export function Slider({ value, onChange, min = 0, max = 100, step = 1, label, format = String }:
  { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; label: string; format?: (v: number) => string }) {
  const pct = ((value - min) / (max - min || 1)) * 100;
  return (
    <label className="ui-slider">
      <span className="ui-field-label">{label}</span>
      <span className="ui-slider-row">
        <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))}
          style={{ "--fill": `${pct}%` } as CSSProperties} aria-valuetext={format(value)} />
        <output className="ui-num">{format(value)}</output>
      </span>
    </label>
  );
}
