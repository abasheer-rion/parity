// How strong a new password is, for the bar under the password field (PasswordMeter.tsx).
// Kept apart from React so the tests can check it. The hard rules stay in rules.ts (at
// least 10 characters, a letter and a number, as Supabase enforces); this only grades a
// password that already meets them, by length and variety, and marks common ones.
import { passwordRules } from "./rules";

export type Score = 0 | 1 | 2 | 3 | 4;
export interface Strength { score: Score; label: string }

export const LABELS: Record<Score, string> = { 0: "", 1: "Too weak", 2: "Fair", 3: "Good", 4: "Strong" };

/** Pieces that make a password easy to guess wherever they appear in it. */
const COMMON_PARTS = [
  "password", "passw0rd", "qwerty", "asdfgh", "zxcvbn", "letmein", "welcome", "iloveyou", "admin",
  "monkey", "dragon", "football", "baseball", "sunshine", "princess", "starwars", "trustno1",
  "parity", "abc123", "123456", "654321", "1q2w3e", "qazwsx", "111111", "000000",
];

/** True for passwords made of a few characters repeated, a run like abcdefg or 1234567, or a common word. */
export function isGuessable(password: string, email = ""): boolean {
  const p = password.toLowerCase();
  if (new Set(p).size < 5) return true;
  if (COMMON_PARTS.some((part) => p.includes(part))) return true;
  const name = email.trim().toLowerCase().split("@")[0] ?? "";
  if (name.length >= 4 && p.includes(name)) return true;
  // The longest run of characters that each follow the last one (abcd, 6789, or backwards).
  let run = 1;
  let longest = 1;
  let last = 0;
  for (let i = 1; i < p.length; i++) {
    const step = p.charCodeAt(i) - p.charCodeAt(i - 1);
    run = Math.abs(step) !== 1 ? 1 : step === last ? run + 1 : 2;
    last = step;
    longest = Math.max(longest, run);
  }
  return longest >= 6;
}

/** How many kinds of character: lower case, upper case, digits, anything else. */
function variety(password: string): number {
  return [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length;
}

/**
 * 0 for empty, 1 until the rules are met or when the password is easy to guess, then 2 to
 * 4 by length and variety: 14 characters and 3 kinds of character each add a step, and
 * 20 characters adds another.
 */
export function passwordStrength(password: string, email = ""): Strength {
  if (!password) return { score: 0, label: LABELS[0] };
  if (!passwordRules(password).every((r) => r.ok)) return { score: 1, label: LABELS[1] };
  if (isGuessable(password, email)) return { score: 1, label: "Easy to guess" };
  let s = 2;
  if (password.length >= 14) s++;
  if (variety(password) >= 3) s++;
  if (password.length >= 20) s++;
  const score = Math.min(4, s) as Score;
  return { score, label: LABELS[score] };
}
