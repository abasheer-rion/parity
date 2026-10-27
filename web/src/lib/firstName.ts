// The name Home greets people by (DEC-0075): a first name only, never an email or a username.
// It comes from the sign-in profile (first_name, given_name, or the first word of a full name of
// two or more words, as Google and Apple set it). When there is none, Home asks once and saves the answer to the
// person's sign-in profile (user_metadata.first_name), with a copy in this browser so the
// greeting draws on the first frame.
import { useSyncExternalStore } from "react";

const CACHE = "parity.firstName.v1";
const ASKED = "parity.firstName.asked.v1";

/** A usable first name from free text: the first word, letters only, at most 30 characters. */
export function cleanFirstName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const word = raw.trim().split(/\s+/)[0] ?? "";
  if (!word || word.includes("@") || /\d/.test(word) || word.length > 30) return null;
  if (!/^[\p{L}][\p{L}'\-.]*$/u.test(word)) return null;
  return word[0].toLocaleUpperCase() + word.slice(1);
}

/** The first name in a Supabase user_metadata object, or null. */
export function firstNameFrom(meta: Record<string, unknown> | null | undefined): string | null {
  if (!meta) return null;
  for (const k of ["first_name", "given_name"]) {
    const n = cleanFirstName(meta[k]);
    if (n) return n;
  }
  // A full name counts only when it has two or more words: a single word here is often a
  // username (GitHub), and Home never greets anyone by a username.
  for (const k of ["full_name", "name"]) {
    const v = meta[k];
    if (typeof v === "string" && v.trim().includes(" ")) { const n = cleanFirstName(v); if (n) return n; }
  }
  return null;
}

interface State { name: string | null; asked: boolean; checked: boolean }

function read(key: string): string | null {
  try { return window.localStorage.getItem(key); } catch { return null; }
}
function write(key: string, v: string | null) {
  try { if (v == null) window.localStorage.removeItem(key); else window.localStorage.setItem(key, v); } catch { /* memory only */ }
}

let state: State = { name: typeof window !== "undefined" ? cleanFirstName(read(CACHE)) : null, asked: typeof window !== "undefined" && read(ASKED) === "1", checked: false };
const subs = new Set<() => void>();
function set(next: Partial<State>) { state = { ...state, ...next }; for (const f of subs) f(); }
let started = false;

async function load() {
  try {
    const { supabase } = await import("../auth/client");
    const apply = (meta: Record<string, unknown> | undefined) => {
      const n = firstNameFrom(meta);
      if (n) write(CACHE, n);
      set({ name: n ?? state.name, checked: true });
    };
    const { data } = await supabase.auth.getSession();
    apply(data.session?.user.user_metadata);
    supabase.auth.onAuthStateChange((_e, s) => { if (s) apply(s.user.user_metadata); });
  } catch {
    set({ checked: true });
  }
}

/** The person's first name (null until known), whether Home already asked, and whether the
 *  profile has been read. */
export function useFirstName(): State {
  if (!started && typeof window !== "undefined") { started = true; void load(); }
  return useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => state, () => state);
}

/** Saves a first name to the sign-in profile. Returns an error message, or null. */
export async function saveFirstName(raw: string): Promise<string | null> {
  const name = cleanFirstName(raw);
  if (!name) return "Type a first name, letters only.";
  write(CACHE, name);
  write(ASKED, "1");
  set({ name, asked: true });
  try {
    const { supabase } = await import("../auth/client");
    const { data } = await supabase.auth.getSession();
    if (!data.session) return null; // local preview: kept in this browser
    const { error } = await supabase.auth.updateUser({ data: { first_name: name } });
    return error ? "Saved here, but not to your account yet. Try again from Account." : null;
  } catch {
    return null;
  }
}

/** "Not now": do not ask again on this device. Account settings can still set it. */
export function skipFirstName() { write(ASKED, "1"); set({ asked: true }); }

/** The greeting line: "Hi Ayan", or "Hi" when there is no first name. */
export function greeting(name: string | null): string {
  return name ? `Hi ${name}` : "Hi";
}
