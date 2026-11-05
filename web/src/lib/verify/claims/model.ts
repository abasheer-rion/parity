// Claims read by the person's own AI model (DEC-0088), only when they have connected one
// (DEC-0051): the page's words go from their browser to their provider with their key, and
// Parity never pays for the call. A model can misread or invent, so every claim it returns
// must quote words that are on the page; any claim whose quote is not found is dropped and
// counted. Values are checked against the same limits as the fixed patterns.
import { FIELD_LABEL, parseDate, type ClaimField, type FoundClaim } from "./extract";

/** The most of a page's words sent to a model. */
export const MODEL_CHARS = 24_000;

const FIELDS: ClaimField[] = ["totalReturn", "monthlyReturn", "yearlyReturn", "winRate", "maxDrawdown", "trades", "tradesPerMonth", "months", "startDate", "profitFactor", "takeProfit", "stopLoss", "maxLoss", "leverage", "grid", "martingale", "noStop"];

export function modelPrompt(text: string): { system: string; prompt: string } {
  return {
    system: "You read trading sales pages and list the performance claims they make. You answer with JSON only.",
    prompt: [
      "List every performance claim on this page. Answer with a JSON array only, no other words. Each item:",
      '{"field": one of ' + FIELDS.map((f) => `"${f}"`).join(", ") + ', "value": the number as written on the page (92 for 92%, 1200 for 1,200 trades; true for grid, martingale or noStop; YYYY-MM-DD for startDate), "quote": the exact words from the page that state it, at most 120 characters}',
      "Only claims about this product's own results or rules. Leave out forecasts, examples, broker conditions and other products. If there are none, answer [].",
      "",
      "Page:",
      text.slice(0, MODEL_CHARS),
    ].join("\n"),
  };
}

const squash = (s: string) => s.toLowerCase().replace(/[\s"'`]+/g, " ").trim();
const PCT: ClaimField[] = ["totalReturn", "monthlyReturn", "yearlyReturn", "winRate", "maxDrawdown", "takeProfit", "stopLoss", "maxLoss"];

/** The model's answer as found claims, keeping only those whose quote is on the page. */
export function readModelAnswer(answer: string, text: string): { found: FoundClaim[]; dropped: number } {
  const json = answer.match(/\[[\s\S]*\]/)?.[0];
  let items: unknown[] = [];
  try { items = json ? (JSON.parse(json) as unknown[]) : []; } catch { return { found: [], dropped: 0 }; }
  if (!Array.isArray(items)) return { found: [], dropped: 0 };
  const hay = squash(text);
  const found: FoundClaim[] = [];
  let dropped = 0;
  for (const it of items.slice(0, 60)) {
    const o = it as { field?: unknown; value?: unknown; quote?: unknown };
    const field = typeof o.field === "string" && (FIELDS as string[]).includes(o.field) ? (o.field as ClaimField) : null;
    const quote = typeof o.quote === "string" ? o.quote.slice(0, 200) : "";
    if (!field || quote.trim().length < 3) { dropped++; continue; }
    const at = hay.indexOf(squash(quote));
    if (at < 0) { dropped++; continue; }
    let value: number | string | boolean | null = null;
    if (field === "grid" || field === "martingale" || field === "noStop") value = o.value === true || o.value === "true";
    else if (field === "startDate") value = typeof o.value === "string" ? parseDate(o.value) : null;
    else {
      const n = typeof o.value === "number" ? o.value : typeof o.value === "string" ? Number(o.value.replace(/[,%+\s]/g, "")) : NaN;
      value = Number.isFinite(n) ? (PCT.includes(field) ? n / 100 : n) : null;
    }
    if (value == null || value === false) { dropped++; continue; }
    if (typeof value === "number" && ((PCT.includes(field) && (value <= -1 || value > (field === "totalReturn" ? 1000 : field === "yearlyReturn" ? 100 : 1))) || value < 0 && !PCT.includes(field))) { dropped++; continue; }
    const shown = typeof o.value === "string" || typeof o.value === "number" ? `${o.value}${PCT.includes(field) && !String(o.value).includes("%") ? "%" : ""}` : FIELD_LABEL[field];
    found.push({ field, value, shown, quote: quote.trim(), at, length: quote.length, how: "model", rule: "Read by your AI model; its quote is on the page" });
  }
  return { found, dropped };
}

/** Adds the model's claims to the patterns' ones, leaving out fields the patterns already found. */
export function mergeFound(patterns: readonly FoundClaim[], model: readonly FoundClaim[]): FoundClaim[] {
  const have = new Set(patterns.map((f) => f.field));
  return [...patterns, ...model.filter((f) => !have.has(f.field))].sort((a, b) => a.at - b.at);
}
