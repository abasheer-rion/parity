export const pct = (v: number | null | undefined, digits = 1) =>
  v == null ? "n/a" : `${(v * 100).toFixed(digits)}%`;

export const num = (v: number | null | undefined, digits = 2) =>
  v == null ? "n/a" : v.toFixed(digits);

export const signedPct = (v: number | null | undefined, digits = 1) =>
  v == null ? "n/a" : `${v > 0 ? "+" : ""}${(v * 100).toFixed(digits)}%`;

export const date = (iso: string | null | undefined) =>
  iso ? new Date(iso).toISOString().slice(0, 10) : "n/a";

export const daysSince = (iso: string | null | undefined) =>
  iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000) : null;

/** Repo docs live on GitHub; strategies reference them relative to docs/. */
export const REPO_URL = "https://github.com/abasheer-rion/parity";
export const docUrl = (ref: string) => `${REPO_URL}/blob/main/docs/${ref}`;
