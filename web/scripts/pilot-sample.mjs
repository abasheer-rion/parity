// Writes the SYNTHETIC sample batch for the prop firm sample report (DEC-0087):
//   public/business/prop-firms/sample/trades.csv    one row per trade, with an account column
//   public/business/prop-firms/sample/details.csv   one row per account: balance, attempts,
//                                                   passed, the simulated later outcome, style
//   public/business/prop-firms/sample/summary.json  the screen's headline numbers, which the
//                                                   business pages print (plugins/business.ts)
// Every account is made up by src/lib/screen/simulate.ts from a fixed seed, so the files are
// the same on every run. The numbers come from the same screen code the page runs.
//
//   cd web && npm run pilot:sample            write the files
//   npm run pilot:sample -- --check           exit 1 when the committed files are out of date
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createServer } from "vite";

const OUT = resolve(import.meta.dirname, "../public/business/prop-firms/sample");
const check = process.argv.includes("--check");

const server = await createServer({ configFile: false, logLevel: "error", server: { middlewareMode: true }, appType: "custom", optimizeDeps: { noDiscovery: true, include: [] } });
try {
  const sim = await server.ssrLoadModule("/src/lib/screen/simulate.ts");
  const sample = await server.ssrLoadModule("/src/lib/screen/sample.ts");
  const accounts = sim.simulate();
  const files = {
    "trades.csv": sim.tradesCsv(accounts),
    "details.csv": sim.detailsCsv(accounts),
    "summary.json": `${JSON.stringify(sample.headline(accounts), null, 2)}\n`,
  };
  let stale = 0;
  mkdirSync(OUT, { recursive: true });
  for (const [name, text] of Object.entries(files)) {
    const path = resolve(OUT, name);
    if (check) {
      let old = "";
      try { old = readFileSync(path, "utf8"); } catch { /* missing counts as stale */ }
      if (old !== text) { console.error(`out of date: ${path}`); stale++; }
    } else {
      writeFileSync(path, text);
      console.log(`wrote ${path} (${(text.length / 1024).toFixed(0)} KB)`);
    }
  }
  if (!check) console.log(JSON.stringify(JSON.parse(files["summary.json"]), null, 1));
  if (stale) process.exitCode = 1;
} finally {
  await server.close();
}
