// The glossary lives in docs/_system/glossary.json so the docs and the dashboard
// can never disagree. scripts/docs.py builds the markdown version from the same file.
import data from "../../../docs/_system/glossary.json";
import type { GlossaryTerm } from "./types";

export const categories: string[] = data.categories;
export const terms: GlossaryTerm[] = data.terms;
export const termById: Record<string, GlossaryTerm> = Object.fromEntries(terms.map((t) => [t.id, t]));
