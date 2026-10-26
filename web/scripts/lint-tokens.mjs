// The token check for code stylelint cannot read (DEC-0058): TypeScript, TSX and the
// <style> blocks and style="" attributes in the HTML pages. Fails on:
//   - a raw colour: a hex string, or rgb()/hsl() with numbers in it
//   - a font size as a number or px value in an inline style
//   - a duration or a cubic-bezier() curve written into an inline style or a style block
//   - a page-level zIndex (10 or more either way) in an inline style
//   - a duration, delay or easing written into scripted motion (element.animate, scroll)
//   - var(--name) for a custom property that is defined nowhere (a typo, or a token that
//     was renamed), unless it carries a fallback
// A line may opt out with a comment "tokens-ignore: <reason>" when the match is not a
// colour at all (a hashtag such as #2008).
// Allowed: src/ui/tokens.css (where values live), src/ui/tokens.gen.ts (generated from it)
// and public/brand/ (the brand sheet lists the colours as content).
//
// It also reads the desktop app's own pages, stylesheet and scripts (desktop/electron/).
//
//   node scripts/lint-tokens.mjs        (also run by `npm run lint:styles`)
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const SKIP_DIRS = new Set(["node_modules", "dist", ".vite", "layout-shots", "test-results", "brand"]);
const ALLOW = new Set(["src/ui/tokens.css", "src/ui/tokens.gen.ts", "../desktop/electron/tokens.css", "../desktop/electron/tokens.js"]);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name) || name.startsWith(".")) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.(tsx?|css|html)$/.test(name)) out.push(full);
  }
  return out;
}

const DESKTOP = resolve(ROOT, "../desktop/electron");
const files = walk(ROOT).filter((f) => !relative(ROOT, f).startsWith("functions/") || /\.tsx?$/.test(f))
  .concat(walk(DESKTOP).filter((f) => /\.(css|html)$/.test(f)), readdirSync(DESKTOP).filter((n) => n.endsWith(".js")).map((n) => join(DESKTOP, n)));
const problems = [];
const add = (file, text, i, what) => {
  const line = text.slice(0, i).split("\n").length;
  // A line that says "tokens-ignore: <why>" is skipped (a hashtag that looks like a colour).
  if (/tokens-ignore:/.test(readFileSync(file, "utf8").split("\n")[line - 1] ?? "")) return;
  problems.push(`${relative(ROOT, file)}:${line}  ${what}`);
};
const stripComments = (s, css) => (css ? s.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " ")) : s.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " ")).replace(/(^|[^:"'`\\])\/\/[^\n]*/g, (m, p) => p + " ".repeat(m.length - p.length)));

const HEX_IN_CODE = /(["'`]|[:=]\s*["']?|,\s*)#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})(?![\w-])/g;
const RGB_FN = /\b(rgba?|hsla?)\(\s*\d/g;
const CURVE = /cubic-bezier\(\s*[\d.]/g;

const defined = new Set();
const used = []; // [file, text, index, name]

for (const file of files) {
  const rel = relative(ROOT, file);
  const src = readFileSync(file, "utf8");
  const isCss = file.endsWith(".css") && !rel.startsWith("../desktop/");
  const isDesktopCss = file.endsWith(".css") && rel.startsWith("../desktop/");
  const isHtml = file.endsWith(".html");
  // Generated token blocks (scripts/tokens.mjs keeps them in step with tokens.css) are blanked.
  const text = (isHtml ? src.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, " ")) : stripComments(src, isCss))
    .replace(/tokens:start[\s\S]*?tokens:end/g, (m) => m.replace(/[^\n]/g, " "));

  for (const m of text.matchAll(/(--[a-zA-Z][\w-]*)\s*["']?\s*:/g)) defined.add(m[1]);
  for (const m of text.matchAll(/setProperty\(\s*["'`](--[\w-]+)/g)) defined.add(m[1]);
  for (const m of text.matchAll(/var\((--[\w-]+)\s*\)/g)) used.push([file, text, m.index, m[1]]);
  if (ALLOW.has(rel) || isCss) continue; // stylelint covers .css

  if (isHtml || isDesktopCss) {
    // Style blocks and style attributes, read as CSS (the desktop stylesheet whole).
    const chunks = isDesktopCss ? [[0, text]] : [...text.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => [m.index + m[0].indexOf(m[1]), m[1]])
      .concat([...text.matchAll(/\sstyle="([^"]*)"/g)].map((m) => [m.index + m[0].indexOf(m[1]), m[1]]));
    for (const [at, css] of chunks) {
      for (const m of css.matchAll(/#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})(?![\w-])/g)) add(file, text, at + m.index, `raw colour ${m[0]}`);
      for (const m of css.matchAll(RGB_FN)) add(file, text, at + m.index, `raw colour ${m[1]}()`);
      for (const m of css.matchAll(/font-size:\s*\d*\.?\d+px|font:[^;]*?(?<![\w.\/-])\d*\.?\d+px(?=\s*\/|\s+["'a-z])/g)) add(file, text, at + m.index, `px font size "${m[0]}"`);
      for (const m of css.matchAll(/(transition|animation)[\w-]*:[^;"]*/g)) {
        const bare = m[0].replace(/var\([^()]*\)/g, "");
        const d = bare.match(/(?<![\w.-])(\d*\.?\d+)(ms|s)\b/g)?.filter((x) => parseFloat(x) !== 0);
        if (d?.length) add(file, text, at + m.index, `raw duration ${d[0]}`);
      }
      for (const m of css.matchAll(CURVE)) add(file, text, at + m.index, "raw cubic-bezier()");
    }
    continue;
  }

  // TypeScript, TSX and the desktop app's JavaScript
  for (const m of text.matchAll(HEX_IN_CODE)) add(file, text, m.index, `raw colour #${m[2]}`);
  for (const m of text.matchAll(RGB_FN)) add(file, text, m.index, `raw colour ${m[1]}()`);
  for (const m of text.matchAll(CURVE)) add(file, text, m.index, "raw cubic-bezier()");
  for (const m of text.matchAll(/fontSize:\s*(\d|["'`]\d*\.?\d+px)/g)) add(file, text, m.index, "font size in an inline style: use var(--type-*)");
  for (const m of text.matchAll(/(transition|animation)(Duration)?:\s*["'`][^"'`]*/g)) {
    const bare = m[0].replace(/var\([^()]*\)/g, "").replace(/\$\{[^}]*\}/g, "");
    if (/(?<![\w.-])\d*\.?\d+m?s\b/.test(bare) && !/(?<![\w.-])0m?s\b/.test(bare.match(/(?<![\w.-])\d*\.?\d+m?s\b/)[0])) add(file, text, m.index, "duration in an inline style: use var(--dur-*)");
  }
  for (const m of text.matchAll(/zIndex:\s*(-?\d{2,})/g)) add(file, text, m.index, `zIndex ${m[1]}: use var(--z-*)`);
  // Scripted motion (element.animate, smooth scroll, motion helpers) takes its timing from
  // the tokens too: durationMs("dur-3") and tokenValue("ease-out"), never a number or a curve.
  // Only the app and the desktop shell draw motion; tests and server code use these words for data.
  if (rel.startsWith("src/") || rel.startsWith("../desktop/")) {
    for (const m of text.matchAll(/\b(duration|delay):\s*(\d*\.?\d+)(?![\w.])/g)) {
      if (parseFloat(m[2]) !== 0) add(file, text, m.index, `${m[1]} ${m[2]} in scripted motion: use durationMs("dur-*")`);
    }
    for (const m of text.matchAll(/\beasing:\s*["'`]/g)) add(file, text, m.index, `easing written as text in scripted motion: use tokenValue("ease-*")`);
  }
}

for (const [file, text, i, name] of used) {
  if (!defined.has(name)) add(file, text, i, `var(${name}) is not defined anywhere`);
}

const unique = [...new Set(problems)].sort();
for (const p of unique) console.log(`  ${p}`);
console.log(unique.length ? `lint-tokens: ${unique.length} problems` : `lint-tokens: ${files.length} files, no raw values outside the tokens`);
process.exit(unique.length ? 1 : 0);
