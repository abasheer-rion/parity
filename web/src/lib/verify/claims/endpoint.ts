// POST /api/verify/claim-url: the Verify page's "read a seller's page" (DEC-0088). Public,
// like the page: no sign-in. The page sends {"url": "..."}; we fetch it under the rules in
// fetch.ts and answer with the claims the fixed patterns found, each with its words, and
// (only when asked, for the person's own AI model) the page's text, capped. Nothing is
// stored. Limits, held in this worker's memory: 6 pages a minute per address, 120 a minute
// in all. Only our own pages may call it (the browser's Origin header); programs use
// POST /api/v1/verify/claim with an API key. One log line per call: the host, the result
// and the time taken, never the full address or the page.
import { originAllowed } from "../../mcp/auth";
import { MinuteLimiter } from "../../api/policy";
import { claimFrom, extractClaims, type FoundClaim } from "./extract";
import { fetchPage, type FetchDeps, type Refusal } from "./fetch";

export const PER_ADDRESS = 6;
export const IN_ALL = 120;
export const TEXT_FOR_MODEL = 100_000;

export interface ClaimUrlDeps extends FetchDeps {
  siteDomain: string | string[];
  limiter?: MinuteLimiter;
  log?: (line: Record<string, unknown>) => void;
}

const shared = new MinuteLimiter();

export interface ClaimUrlAnswer {
  ok: true;
  url: string;
  final_url: string;
  title: string | null;
  read_at: string;
  found: FoundClaim[];
  claim: ReturnType<typeof claimFrom>;
  /** Plain-words notes: the page builds itself with scripts, only part of it was read. */
  notes: string[];
  /** The page's words, for the person's own AI model; only when `with_text` was sent. */
  text?: string;
}

export interface ClaimUrlRefusal { ok: false; reason: Refusal | "rate_limited" | "bad_request" | "origin"; detail: string }

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", ...headers },
  });
}

/** Reads a public page's claims. Never throws: every problem is a JSON answer with a plain reason. */
export async function handleClaimUrl(request: Request, deps: ClaimUrlDeps): Promise<Response> {
  const started = (deps.now ?? Date.now)();
  const origin = request.headers.get("Origin");
  const no = (status: number, reason: ClaimUrlRefusal["reason"], detail: string, headers: Record<string, string> = {}) => json(status, { ok: false, reason, detail } satisfies ClaimUrlRefusal, headers);
  if (request.method !== "POST") return no(405, "bad_request", "Send a POST with {\"url\": \"...\"}.", { Allow: "POST" });
  if (!origin || !originAllowed(origin, deps.siteDomain)) return no(403, "origin", "This address is for the Verify page. Programs can use POST /api/v1/verify/claim with an API key.");
  const cors = { "Access-Control-Allow-Origin": origin, Vary: "Origin" };

  const limiter = deps.limiter ?? shared;
  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
  const mine = limiter.take(`ip:${ip}`, PER_ADDRESS);
  if (!mine.ok) return no(429, "rate_limited", `At most ${PER_ADDRESS} pages a minute. Wait ${mine.reset} seconds.`, { ...cors, "Retry-After": String(mine.reset) });
  const all = limiter.take("all", IN_ALL);
  if (!all.ok) return no(429, "rate_limited", "Many people are reading pages right now. Wait a minute, or paste the words instead.", { ...cors, "Retry-After": String(all.reset) });

  const body = await request.text();
  if (body.length > 4096) return no(413, "bad_request", "Send only the address.", cors);
  let url = "", withText = false;
  try {
    const o = JSON.parse(body) as { url?: unknown; with_text?: unknown };
    url = typeof o.url === "string" ? o.url : "";
    withText = o.with_text === true;
  } catch { return no(400, "bad_request", "Send JSON: {\"url\": \"https://...\"}.", cors); }

  const page = await fetchPage(url, deps);
  const host = (() => { try { return new URL(page.url).hostname; } catch { return "invalid"; } })();
  const ms = Math.max(0, (deps.now ?? Date.now)() - started);
  if (!page.ok) {
    deps.log?.({ msg: "claim url", host, result: page.reason, ms });
    return no(page.reason === "bad_url" ? 400 : 422, page.reason, page.detail, cors);
  }
  const found = extractClaims(page.text);
  const notes: string[] = [];
  if (page.scripted) notes.push("This page fills in its numbers with scripts after it opens, so they were not in what we read. Copy the numbers from the page and paste them, or upload the account's trade history.");
  if (page.truncated) notes.push("The page is longer than 2 MB; we read the first 2 MB.");
  deps.log?.({ msg: "claim url", host, result: "ok", claims: found.length, bytes: page.bytes, ms });
  const answer: ClaimUrlAnswer = {
    ok: true, url: page.url, final_url: page.finalUrl, title: page.title, read_at: page.fetchedAt, found, claim: claimFrom(found), notes,
    ...(withText ? { text: page.text.slice(0, TEXT_FOR_MODEL) } : {}),
  };
  return json(200, answer, cors);
}
