// Pieces the Trade views share: the instrument picker, stored preferences and the hash.
import { useEffect, useState } from "react";
import { Icon } from "../../ui/icons";
import { CLASS_LABEL, CLASS_ORDER, loadInstruments, type Instrument, type Loadable } from "../../lib/tradeData";

export function useInstruments(): Loadable<Instrument[]> {
  const [state, setState] = useState<Loadable<Instrument[]>>({ status: "loading" });
  useEffect(() => { let live = true; void loadInstruments().then((r) => { if (live) setState(r); }); return () => { live = false; }; }, []);
  return state;
}

/** A select of every instrument, grouped by asset class. */
export function InstrumentSelect({ list, value, onChange, label = "Instrument", allowNone }:
  { list: Instrument[]; value: string; onChange: (key: string) => void; label?: string; allowNone?: string }) {
  const groups = CLASS_ORDER.map((c) => [c, list.filter((s) => s.class === c)] as const).filter(([, l]) => l.length);
  const other = list.filter((s) => !CLASS_ORDER.includes(s.class));
  return (
    <span className="ui-select tr-pick">
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
        {allowNone && <option value="">{allowNone}</option>}
        {groups.map(([c, l]) => (
          <optgroup key={c} label={CLASS_LABEL[c] ?? c}>
            {l.map((s) => <option key={s.key} value={s.key}>{s.label}{s.short && s.short !== s.label ? ` (${s.short})` : ""}</option>)}
          </optgroup>
        ))}
        {other.length > 0 && <optgroup label="Other">{other.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</optgroup>}
      </select>
      <Icon name="chevronDown" size={13} />
    </span>
  );
}

/** Read a value from the part of the hash after "?". */
export function hashParam(name: string): string | null {
  const q = window.location.hash.split("?")[1] ?? "";
  return new URLSearchParams(q).get(name);
}

/** Change the hash query without a page jump or a hashchange event. */
export function setHashParam(name: string, value: string) {
  const [path, q = ""] = window.location.hash.split("?");
  const p = new URLSearchParams(q);
  p.set(name, value);
  window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}${path}?${p.toString()}`);
}

export function readPref<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(`parity.trade.${key}`);
    return raw ? { ...fallback, ...JSON.parse(raw) } as T : fallback;
  } catch { return fallback; }
}

export function writePref(key: string, value: unknown) {
  try { window.localStorage.setItem(`parity.trade.${key}`, JSON.stringify(value)); } catch { /* a convenience only */ }
}

export const isSmall = () => typeof window !== "undefined" && window.matchMedia?.("(max-width: 640px)").matches;
