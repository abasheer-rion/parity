// Every route the suite opens: the app routes come from scripts/lib/routes.mjs (read from
// the files that define them, so a new page is covered without editing this), plus the
// public pages the site build writes (newsroom, glossary, ideas, notes, Verify, 404).
// @ts-expect-error a plain .mjs module without types
import { routes as appRoutes } from "../scripts/lib/routes.mjs";

export const PUBLIC = [
  "/verify/", "/methodology/", "/v/e2e-missing-badge", "/connect/", "/connect/claude/", "/connect/chatgpt/", "/connect/gemini/",
  "/blog/", "/blog/publish-the-failures-too/", "/news/", "/authors/", "/authors/ayan/", "/tags/", "/tags/backtests/",
  "/learn/", "/learn/a-book-and-b-book/", "/ideas/", "/ideas/betting-against-beta/", "/notes/", "/notes/dec-0001/",
  "/no-such-page-xyz/",
];

export const ALL: string[] = [...new Set([...(appRoutes() as string[]), ...PUBLIC])];

/** Routes that are signed-in apps (behind the middleware). */
export const isApp = (p: string) => /^\/(app|research|sim|trade|academy|lab)\//.test(p);
