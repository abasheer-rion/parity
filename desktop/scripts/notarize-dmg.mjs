// Notarizes and staples the signed disk images in dist/ (DEC-0049). electron-builder notarizes
// the app inside each image but not the image itself, so a downloaded .dmg would still be
// checked online by Gatekeeper. Stapling changes the file, so its block map and its sha512 and
// size in latest-mac.yml are written again here; otherwise they would describe the old file.
//
// Needs APPLE_API_KEY (path to the .p8 file), APPLE_API_KEY_ID and APPLE_API_ISSUER, as the
// build does. The release workflow runs it only on a signed and notarized build.
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const { buildBlockMap } = require("app-builder-lib/out/targets/blockmap/blockmap");

const dist = path.resolve(process.argv[2] || "dist");
const { APPLE_API_KEY: key, APPLE_API_KEY_ID: keyId, APPLE_API_ISSUER: issuer } = process.env;
if (!key || !keyId || !issuer) {
  console.error("APPLE_API_KEY, APPLE_API_KEY_ID and APPLE_API_ISSUER are required");
  process.exit(1);
}

const dmgs = readdirSync(dist).filter((f) => f.endsWith(".dmg"));
if (dmgs.length === 0) {
  console.error(`no .dmg in ${dist}`);
  process.exit(1);
}

const updated = new Map();
for (const name of dmgs) {
  const file = path.join(dist, name);
  console.log(`notarizing ${name}`);
  execFileSync("xcrun", ["notarytool", "submit", file, "--key", key, "--key-id", keyId, "--issuer", issuer, "--wait", "--timeout", "45m"], { stdio: "inherit" });
  execFileSync("xcrun", ["stapler", "staple", file], { stdio: "inherit" });
  const info = await buildBlockMap(file, "gzip", `${file}.blockmap`);
  updated.set(name, info);
  console.log(`${name}: size ${info.size}`);
}

// latest-mac.yml lists each file as "- url:" followed by its sha512 and size lines.
const ymlPath = path.join(dist, "latest-mac.yml");
const lines = readFileSync(ymlPath, "utf8").split("\n");
let current = null;
const seen = new Set();
for (let i = 0; i < lines.length; i++) {
  const url = lines[i].match(/^\s*- url: (.+)$/);
  if (url) { current = updated.has(url[1].trim()) ? url[1].trim() : null; continue; }
  if (!current) continue;
  const field = lines[i].match(/^(\s+)(sha512|size): /);
  if (!field) { if (!/^\s+\w+: /.test(lines[i])) current = null; continue; }
  const info = updated.get(current);
  lines[i] = `${field[1]}${field[2]}: ${field[2] === "sha512" ? info.sha512 : info.size}`;
  seen.add(current);
}
writeFileSync(ymlPath, lines.join("\n"));
for (const name of updated.keys()) {
  if (!seen.has(name)) console.log(`note: ${name} is not listed in latest-mac.yml`);
}
console.log("latest-mac.yml updated");
