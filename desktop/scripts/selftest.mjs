// Runs the app's self-checks (electron/selftest.js) in fresh, signed-out profiles (DEC-0049):
//   wall      a parity:// deep link while signed out opens the log-in wall; the title bar drags
//   offline   with the website unreachable, the saved copy's log-in page shows, and Retry
//   signedin  against the bundled site served locally: the menu, a section, a second window
//   blank     a page that draws nothing reloads once, then shows Could not open with Retry
//   selfclose a page that calls window.close() leaves its window, no black view, no error
// Every window stays hidden (PARITY_HIDDEN is on under PARITY_SELFTEST): nothing appears on screen.
// offline and signedin need build/web (`npm run web`); they are skipped without it.
// Run: npm run test:app
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { existsSync, mkdtempSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { extname, join, normalize, resolve } from "node:path";

const here = resolve(import.meta.dirname, "..");
const electron = createRequire(import.meta.url)("electron");
const web = join(here, "build", "web");
const haveWeb = existsSync(join(web, "index.html"));

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json", ".woff2": "font/woff2" };
function serve() {
  return new Promise((ok) => {
    const server = createServer((req, res) => {
      const p = decodeURIComponent(new URL(req.url, "http://x").pathname);
      // A page that draws nothing, for the blank scenario.
      if (p === "/__blank/") { res.writeHead(200, { "Content-Type": "text/html" }).end("<!doctype html><title>Blank</title><body></body>"); return; }
      let file = normalize(join(web, p));
      if (!file.startsWith(web)) { res.writeHead(403).end(); return; }
      try { if (statSync(file).isDirectory()) file = join(file, "index.html"); } catch { /* 404 below */ }
      if (!existsSync(file)) { res.writeHead(404).end("not found"); return; }
      res.writeHead(200, { "Content-Type": TYPES[extname(file)] || "application/octet-stream" }).end(readFileSync(file));
    });
    server.listen(0, "127.0.0.1", () => ok(server));
  });
}

function run(scenario, env, args = []) {
  return new Promise((ok) => {
    const profile = mkdtempSync(join(tmpdir(), `parity-selftest-${scenario}-`));
    const child = spawn(electron, [".", `--user-data-dir=${profile}`, ...args], { cwd: here, env: { ...process.env, PARITY_SELFTEST: scenario, PARITY_HIDDEN: "1", ELECTRON_ENABLE_LOGGING: "1", ...env } });
    let out = "";
    const take = (d) => { out += d; for (const line of String(d).split("\n")) if (/^(PASS|FAIL)/.test(line)) console.log(line); };
    child.stdout.on("data", take);
    child.stderr.on("data", (d) => { out += d; });
    const timer = setTimeout(() => { console.log(`FAIL ${scenario}: timed out`); child.kill("SIGKILL"); }, 120000);
    child.on("exit", (code) => { clearTimeout(timer); if (code !== 0 && !/FAIL/.test(out)) console.log(out.slice(-3000)); ok(code === 0); });
  });
}

let ok = await run("wall", {}, ["parity://trade/#/alerts"]);
if (haveWeb) {
  ok = (await run("offline", { PARITY_LIVE_ORIGIN: "https://10.255.255.1" }, ["parity://trade/#/alerts"])) && ok;
  const server = await serve();
  const url = `http://127.0.0.1:${server.address().port}`;
  ok = (await run("signedin", { PARITY_DEV_URL: url, PARITY_AUTH_BYPASS: "1" })) && ok;
  ok = (await run("blank", { PARITY_DEV_URL: url, PARITY_AUTH_BYPASS: "1" })) && ok;
  ok = (await run("selfclose", { PARITY_DEV_URL: url, PARITY_AUTH_BYPASS: "1" })) && ok;
  server.close();
} else {
  console.log("skip offline and signedin: no build/web (run npm run web)");
}
process.exit(ok ? 0 : 1);
