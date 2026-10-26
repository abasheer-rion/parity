// The desktop app against the local stub (stub.mjs): opens every section in Electron with a
// made-up session and prints how fast each draws (sections), or hides, minimises and
// restarts graphics and takes a screen picture after each (occlude). No real account.
//
//   node scripts/perf/desktop.mjs [sections|occlude] [--data <dir>] [--out <dir>]
//
// Build the site first with VITE_SUPABASE_URL=http://127.0.0.1:54399, then
// `node ../desktop/scripts/prepare-web.mjs` so the app shows Academy and Workbench.
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { start } from "./stub.mjs";

const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const scenario = ["sections", "occlude"].includes(process.argv[2]) ? process.argv[2] : "sections";
const desk = resolve(import.meta.dirname, "../../../desktop");
const out = resolve(arg("--out") ?? tmpdir());
const electron = createRequire(join(desk, "package.json"))("electron");
const s = await start({ dist: resolve(import.meta.dirname, "../../dist"), data: arg("--data") ? resolve(arg("--data")) : null });
const profile = mkdtempSync(join(tmpdir(), "parity-desktop-"));
const child = spawn(electron, [".", `--user-data-dir=${profile}`], {
  cwd: desk,
  env: { ...process.env, PARITY_SELFTEST: scenario, PARITY_DEV_URL: s.site, PARITY_AUTH_BYPASS: "1", PARITY_STUB_COOKIE: JSON.stringify(s.cookie()) },
});
child.stdout.on("data", (d) => {
  for (const line of String(d).split("\n")) if (/^(PASS|FAIL|TIME|SHOT)/.test(line)) console.log(line);
  for (const m of String(d).matchAll(/SHOT (\S+) (\d+),(\d+),(\d+),(\d+)/g)) {
    spawnSync("screencapture", ["-x", "-R", `${m[2]},${m[3]},${m[4]},${m[5]}`, join(out, `parity-${m[1]}.png`)]);
  }
});
const timer = setTimeout(() => child.kill("SIGKILL"), 240000);
child.on("exit", (code) => { clearTimeout(timer); s.close(); process.exit(code ?? 1); });
