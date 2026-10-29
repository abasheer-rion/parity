// Every route of every Parity app, read from the files that define them, so a new page
// is covered by the smoke test and the layout audit without editing either script.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const here = (p) => resolve(import.meta.dirname, "../..", p);
const read = (p) => readFileSync(here(p), "utf8");

export function routes() {
  const pages = read("src/lib/pages.ts");
  const out = new Set(["/", "/login/", "/signup/", "/reset/", "/legal/", "/legal/privacy/", "/legal/terms/", "/legal/cookies/", "/legal/accessibility/", "/legal/risk/", "/legal/regulatory/", "/download/", "/connect/claude/", "/connect/chatgpt/", "/connect/gemini/"]);
  // Each page's hash and side. Pages that moved to their own app redirect, which is tested too.
  for (const m of pages.matchAll(/href: "(#\/[^"]*)", title: "[^"]*", space: "(product|research|both)"/g)) {
    const [, hash, space] = m;
    if (space !== "research") out.add(`/app/${hash}`);
    if (space !== "product") out.add(`/research/${hash}`);
  }
  const viewIds = (file) => [...read(file).matchAll(/\{ id: "([a-z]+)", label:/g)].map((m) => m[1]);
  for (const v of viewIds("src/trade/state.ts")) out.add(`/trade/#/${v}`);
  for (const v of viewIds("src/lab/state.ts")) out.add(`/lab/#/${v}`);
  for (const v of ["", "progress", "settings"]) out.add(`/academy/#/${v}`);
  const courses = readFileSync(here("../academy/courses/01-reading-a-backtest.json"), "utf8");
  const course = JSON.parse(courses);
  out.add(`/academy/#/${course.id}`);
  if (course.lessons?.[0]?.id) out.add(`/academy/#/${course.id}/${course.lessons[0].id}`);
  // "Luck vs skill" draws background paths and number cards, which the first course does not.
  const luck = JSON.parse(readFileSync(here("../academy/courses/02-luck-vs-skill.json"), "utf8"));
  for (const id of ["noise", "gauntlet"]) if (luck.lessons?.some((l) => l.id === id)) out.add(`/academy/#/${luck.id}/${id}`);
  for (const m of read("src/terminal/layout.ts").matchAll(/\{ id: "([a-z]+)", label:/g)) out.add(`/sim/#/${m[1]}`);
  // A strategy page and an algorithm report, and the settings pages.
  out.add("/app/#/strategy/fx_carry");
  out.add("/research/#/algo/fx-carry-g10");
  out.add("/app/#/settings");
  out.add("/app/#/settings/trade-profile");
  // The team-only Metrics page is not in the page list; signed out it says so.
  out.add("/research/#/metrics");
  return [...out];
}
