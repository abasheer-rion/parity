// Propose pools for the Parity price (DEC-0065) from outside JavaScript, such as the data
// registry (engine/src/parity/registry, DEC-0064): pass proposals as JSON on stdin, in the
// Proposal shape of web/live/src/venues/onchainRegistry.ts (an asset and its pools), and the
// merged list is written to onchain-registry.json by the same rule the discovery script uses.
//   echo '[{"key":"...","sym":"...","name":"...","rank":1,"pools":[...]}]' \
//     | node --experimental-strip-types web/scripts/onchain-propose.ts [--dry-run]
// Prints one JSON line: assets before and after, and which keys changed.
import { readFileSync, writeFileSync } from "node:fs";
import { proposePools, type Proposal, type Registry } from "../live/src/venues/onchainRegistry.ts";

const OUT = new URL("../live/src/venues/onchain-registry.json", import.meta.url);
const old = JSON.parse(readFileSync(OUT, "utf8")) as Registry;
const proposals = JSON.parse(readFileSync(0, "utf8")) as Proposal[];
if (!Array.isArray(proposals)) throw new Error("stdin must be a JSON list of proposals");
const next = proposePools(old, proposals);
const before = new Map(old.tokens.map((t) => [t.key, JSON.stringify(t.pools)]));
const changed = next.tokens.filter((t) => before.get(t.key) !== JSON.stringify(t.pools)).map((t) => t.key);
if (!process.argv.includes("--dry-run")) writeFileSync(OUT, `${JSON.stringify(next, null, 1)}\n`);
console.log(JSON.stringify({ before: old.tokens.length, after: next.tokens.length, changed }));
