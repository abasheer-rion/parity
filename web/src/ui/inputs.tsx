// Form controls: text and search fields, selects, segmented choices, switches and
// checkboxes. All are 32px tall by default with a 1px quiet border.
import type { ReactNode } from "react";
import { Icon } from "./icons";

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

export function Select<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: [T, string][]; label: string }) {
  return (
    <span className="ui-select">
      <select value={value} onChange={(e) => onChange(e.target.value as T)} aria-label={label}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <Icon name="chevronDown" size={13} />
    </span>
  );
}

export function Segmented<T extends string>({ value, onChange, options, label, size = "md" }:
  { value: T; onChange: (v: T) => void; options: [T, ReactNode][]; label?: string; size?: "sm" | "md" }) {
  return (
    <div className={`ui-seg ui-seg-${size}`} role="radiogroup" aria-label={label}
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
      {options.map(([v, l]) => (
        <button key={v} type="button" role="radio" aria-checked={v === value} tabIndex={v === value ? 0 : -1} className={v === value ? "on" : ""} onClick={() => onChange(v)}>{l}</button>
      ))}
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

/** Underlined tabs (Robinhood's range tabs). Small caps, letter-spaced. */
export function Tabs<T extends string>({ value, onChange, tabs, label, tone }: { value: T; onChange: (v: T) => void; tabs: readonly T[] | [T, string][]; label: string; tone?: string }) {
  const list = (tabs as (T | [T, string])[]).map((t) => (Array.isArray(t) ? t : [t, t])) as [T, string][];
  return (
    <div className="ui-tabs" role="tablist" aria-label={label}>
      {list.map(([v, l]) => (
        <button key={v} role="tab" aria-selected={v === value} className={v === value ? "on" : ""} onClick={() => onChange(v)}
          style={v === value && tone ? { color: tone, borderColor: tone } : undefined}>{l}</button>
      ))}
    </div>
  );
}
