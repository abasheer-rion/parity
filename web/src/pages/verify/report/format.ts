// Number formats for the Verify result and report: a real minus sign, "n/a" for anything
// missing, money to two places under 1,000 and whole above.
import { MINUS } from "../../../ui/text";

const minus = (s: string) => s.replace(/^-/, MINUS);
export const pct = (v: number | null | undefined, d = 1) => (v == null || !Number.isFinite(v) ? "n/a" : minus(`${(v * 100).toFixed(d)}%`));
export const money = (v: number | null | undefined) => {
  if (v == null || !Number.isFinite(v)) return "n/a";
  const a = Math.abs(v);
  return minus(`${v < 0 ? "-" : ""}${a >= 1000 ? a.toLocaleString("en-US", { maximumFractionDigits: 0 }) : a.toFixed(2)}`);
};
export const dec = (v: number | null | undefined, d = 2) => (v == null || !Number.isFinite(v) ? "n/a" : minus(v.toFixed(d)));
export const int = (v: number | null | undefined) => (v == null ? "n/a" : v.toLocaleString("en-US"));
