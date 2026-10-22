// Form rules for the sign-in pages, kept apart from React so the tests can check them.
import { PASSWORD_MAX, PASSWORD_MIN } from "./config";

export interface Rule { id: string; label: string; ok: boolean }

/**
 * The password rules, in the order they are shown. They match Supabase's settings
 * (auth/push_templates.sh): at least 10 characters, a letter and a number. Supabase hashes
 * at most 72 bytes, so longer passwords are refused rather than silently cut.
 */
export function passwordRules(password: string): Rule[] {
  return [
    { id: "length", label: `At least ${PASSWORD_MIN} characters`, ok: password.length >= PASSWORD_MIN },
    { id: "letter", label: "A letter", ok: /[a-zA-Z]/.test(password) },
    { id: "number", label: "A number", ok: /\d/.test(password) },
    { id: "max", label: `No more than ${PASSWORD_MAX} characters`, ok: new TextEncoder().encode(password).length <= PASSWORD_MAX },
  ];
}

/** The first broken password rule as a sentence, or null when the password is fine. */
export function passwordProblem(password: string): string | null {
  if (!password) return "Choose a password.";
  const bad = passwordRules(password).find((r) => !r.ok);
  if (!bad) return null;
  switch (bad.id) {
    case "length": return `Use at least ${PASSWORD_MIN} characters.`;
    case "max": return `Use no more than ${PASSWORD_MAX} characters.`;
    default: return "Use both letters and numbers.";
  }
}

/** A light check that an email looks like one. Supabase does the real check. */
export function emailProblem(email: string): string | null {
  const value = email.trim();
  if (!value) return "Enter your email.";
  if (value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "Enter a full email address, like name@example.com.";
  return null;
}

/** Codes from emails and authenticator apps: 6 digits (up to 10 if Supabase is set longer). */
export function codeProblem(code: string): string | null {
  if (!code) return "Type the code.";
  if (!/^\d{6,10}$/.test(code)) return "The code is 6 digits.";
  return null;
}
