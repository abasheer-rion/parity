// Missing, NaN and infinite values all show "n/a" (REF-0017), never "NaN%" or "Infinity%".
const ok = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v);

export const pct = (v: number | null | undefined, digits = 1) =>
  !ok(v) ? "n/a" : `${(v * 100).toFixed(digits)}%`;

export const num = (v: number | null | undefined, digits = 2) =>
  !ok(v) ? "n/a" : v.toFixed(digits);

export const signedPct = (v: number | null | undefined, digits = 1) =>
  !ok(v) ? "n/a" : `${v > 0 ? "+" : ""}${(v * 100).toFixed(digits)}%`;

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
