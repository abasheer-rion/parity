// Missing, NaN and infinite values all show "n/a" (REF-0017), never "NaN%" or "Infinity%".
const ok = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v);

// A number to fixed digits with a true minus (U+2212, the same width as + in tabular
// figures) and never a negative zero: -0.0004 at one digit prints 0.0, not -0.0.
const MINUS = "\u2212";
const fixed = (v: number, digits: number, plus = false) => {
  const s = Math.abs(v).toFixed(digits);
  const zero = Number(s) === 0;
  return `${zero ? "" : v < 0 ? MINUS : plus ? "+" : ""}${s}`;
};

export const pct = (v: number | null | undefined, digits = 1) =>
  !ok(v) ? "n/a" : `${fixed(v * 100, digits)}%`;

export const num = (v: number | null | undefined, digits = 2) =>
  !ok(v) ? "n/a" : fixed(v, digits);

export const signedPct = (v: number | null | undefined, digits = 1) =>
  !ok(v) ? "n/a" : `${fixed(v * 100, digits, true)}%`;

/** The UTC calendar day of a timestamp. A malformed one shows "n/a" instead of throwing. */
export const date = (iso: string | null | undefined) => {
  if (!iso) return "n/a";
  const t = new Date(iso);
  return Number.isNaN(t.getTime()) ? "n/a" : t.toISOString().slice(0, 10);
};

/**
 * Today's date where the reader is, as YYYY-MM-DD. `toISOString()` gives the UTC day, which
 * in the Americas is already tomorrow every evening.
 */
export const localDay = (d: Date = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const daysSince =(iso: string | null | undefined) => {
  const t = iso ? new Date(iso).getTime() : NaN;
  return Number.isNaN(t) ? null : Math.floor((Date.now() - t) / 86_400_000);
};

/** Repo docs live on GitHub; strategies reference them relative to docs/. */
export const REPO_URL = "https://github.com/abasheer-rion/parity";
export const docUrl = (ref: string) => `${REPO_URL}/blob/main/docs/${ref}`;
