// The catalog, ledger and registrations live in the repo and are bundled at build
// time, so the dashboard always shows exactly what is committed.
import type { Algorithm, Dataset, LedgerEntry, Registration } from "./types";
import chainText from "../../../ledger/runs.jsonl?raw";

const algoFiles = import.meta.glob("../../../catalog/algorithms/*.json", { eager: true, import: "default" });
const dataFiles = import.meta.glob("../../../catalog/datasets/*.json", { eager: true, import: "default" });
const regFiles = import.meta.glob("../../../registrations/*.json", { eager: true, import: "default" });

export const algorithms = (Object.values(algoFiles) as Algorithm[]).sort((a, b) => a.id.localeCompare(b.id));
export const datasets = (Object.values(dataFiles) as Dataset[]).sort((a, b) => a.id.localeCompare(b.id));
export const registrations = (Object.values(regFiles) as Registration[]).sort((a, b) => a.id.localeCompare(b.id));
export const ledger: LedgerEntry[] = chainText.split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l));

export const STAGES = ["catalogued", "sourced", "hypothesis", "implemented", "registered", "official", "reproduced", "forward", "verdict"];

export const bestReported = (a: Algorithm) =>
  a.reported_results.reduce<number | null>((m, r) => (r.sharpe != null && (m == null || r.sharpe > m) ? r.sharpe : m), null);

// File names only (lazy glob, nothing is loaded), so pages can link to docs on GitHub.
const docFiles = Object.keys(import.meta.glob("../../../docs/*/*.md"));
export const docPathFor = (id: string): string | null => {
  const num = id.slice(-4);
  const folder = { HYP: "hypotheses", EXP: "experiments", DEC: "decisions", RES: "research", REF: "reference", GDE: "guides", ALG: "algorithms", DAT: "datasets" }[id.slice(0, 3)];
  const hit = docFiles.find((f) => f.includes(`/docs/${folder}/${num}-`));
  return hit ? hit.replace(/^.*\/docs\//, "") : null;
};
