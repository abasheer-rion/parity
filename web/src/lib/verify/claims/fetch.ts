// Fetching a seller's page so its claims can be read (DEC-0088). This runs on our server
// (the Pages Function behind /verify/, the API and the MCP tool), never with anyone's
// login, and only where the site allows it:
//   - http or https on the usual ports, a real host name: no IP addresses, no local names,
//     no user name or password in the address;
//   - robots.txt is read first (RFC 9309) and its answer kept; a "no" is never worked round;
//   - no cookies, no Authorization, no sign-in (the fetch never carries any): a page behind a login or a bot check is
//     reported as such, and the person can paste the words instead;
//   - at most 3 redirects, each checked again; 8 seconds; the first 2 MB.
// Pure apart from the fetch it is given, so tests run it on a fake one.
import { AGENT_TOKEN, robotsAllows } from "./robots";
import { htmlToText, plainText } from "./text";

export const USER_AGENT = `${AGENT_TOKEN}/1.0 (+https://paritytrading.app/methodology/#claims-from-a-page)`;

export const FETCH_LIMITS = {
  /** Bytes of a page we read; the rest is left. */
  bytes: 2_000_000,
  /** A page that says it is larger than this is not fetched at all. */
  refuseOver: 15_000_000,
  pageMs: 8_000,
  robotsMs: 4_000,
  robotsBytes: 500_000,
  redirects: 3,
  urlLength: 2_048,
  /** Characters of text kept after the tags are gone. */
  textChars: 200_000,
} as const;

export type Refusal =
  | "bad_url" | "not_allowed_address" | "robots" | "robots_unreachable" | "bot_check" | "login" | "not_found"
  | "not_a_page" | "too_large" | "timeout" | "http_error" | "redirects" | "network";

export interface PageOk {
  ok: true;
  url: string;
  /** Where the page was in the end, after redirects. */
  finalUrl: string;
  title: string | null;
  text: string;
  bytes: number;
  /** True when only the first FETCH_LIMITS.bytes were read. */
  truncated: boolean;
  /** True when the page builds its words with scripts, so they were not in what we read. */
  scripted: boolean;
  fetchedAt: string;
}

export interface PageRefused { ok: false; url: string; reason: Refusal; detail: string }
export type PageResult = PageOk | PageRefused;

type Fetch = typeof fetch;
export interface FetchDeps {
  fetch: Fetch;
  now?: () => number;
  /** robots.txt answers per origin, kept for 10 minutes. */
  robotsCache?: Map<string, { at: number; txt: string | null; error: boolean }>;
}

/** AbortSignal.any where the runtime has it; otherwise one controller that either aborts. */
function anySignal(a: AbortSignal, b: AbortSignal): AbortSignal {
  const any = (AbortSignal as unknown as { any?: (s: AbortSignal[]) => AbortSignal }).any;
  if (any) return any([a, b]);
  const c = new AbortController();
  const stop = () => c.abort();
  if (a.aborted || b.aborted) c.abort();
  a.addEventListener("abort", stop, { once: true });
  b.addEventListener("abort", stop, { once: true });
  return c.signal;
}

const sharedRobots = new Map<string, { at: number; txt: string | null; error: boolean }>();
const ROBOTS_TTL = 10 * 60_000;

const PASTE = "Copy the words from the page and paste them instead.";

// ------------------------------------------------------------------ the address

const LOCAL_SUFFIX = /\.(local|localhost|internal|intranet|lan|home|corp|private|test|invalid|example|onion|arpa)$/i;

/** Whether an address may be fetched, and why not. Never resolves anything. */
export function checkUrl(raw: string): { ok: true; url: URL } | { ok: false; detail: string } {
  const s = raw.trim();
  if (!s) return { ok: false, detail: "Give the page's web address, starting with https://." };
  if (s.length > FETCH_LIMITS.urlLength) return { ok: false, detail: "That address is too long." };
  let url: URL;
  try { url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(s) ? s : `https://${s}`); } catch { return { ok: false, detail: "That is not a web address we can read." }; }
  if (url.protocol !== "https:" && url.protocol !== "http:") return { ok: false, detail: "Only web pages (http or https) can be read." };
  if (url.username || url.password) return { ok: false, detail: "Leave out any user name or password: we never log in to other sites." };
  if (url.port && url.port !== "80" && url.port !== "443") return { ok: false, detail: "Only pages on the usual web ports can be read." };
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!host.includes(".") || host === "localhost" || LOCAL_SUFFIX.test(host)) return { ok: false, detail: "That is not a public web address." };
  // IP addresses, written any way (dotted, bracketed IPv6, or a bare number).
  if (/^\[.*\]$/.test(host) || /^[\d.]+$/.test(host) || /^0x[0-9a-f]+$/i.test(host)) return { ok: false, detail: "Give the page's name, not an IP address." };
  url.hash = "";
  return { ok: true, url };
}

/** X (Twitter) forbids every automatic reader in its robots.txt; say so before trying. */
function knownNo(url: URL): string | null {
  const h = url.hostname.toLowerCase();
  if (/(^|\.)(x|twitter)\.com$/.test(h)) return `X does not allow automatic reading of posts (its robots.txt asks every reader to stay out), so we did not open it. ${PASTE}`;
  return null;
}

// ------------------------------------------------------------------ reading a body

async function readCapped(res: Response, max: number): Promise<{ bytes: Uint8Array; truncated: boolean }> {
  if (!res.body) {
    const buf = new Uint8Array(await res.arrayBuffer());
    return { bytes: buf.slice(0, max), truncated: buf.length > max };
  }
  const reader = res.body.getReader();
  const parts: Uint8Array[] = [];
  let n = 0, truncated = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (n + value.length > max) { parts.push(value.slice(0, max - n)); n = max; truncated = true; break; }
    parts.push(value);
    n += value.length;
  }
  if (truncated) await reader.cancel().catch(() => undefined);
  const out = new Uint8Array(n);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return { bytes: out, truncated };
}

/** The charset from the header, or from a <meta> in the first 2 KB, else UTF-8. */
function decode(bytes: Uint8Array, contentType: string): string {
  const head = new TextDecoder("latin1").decode(bytes.slice(0, 2048));
  const label = contentType.match(/charset=["']?([\w-]+)/i)?.[1] ?? head.match(/<meta[^>]+charset=["']?([\w-]+)/i)?.[1] ?? "utf-8";
  try { return new TextDecoder(label.toLowerCase()).decode(bytes); } catch { return new TextDecoder("utf-8").decode(bytes); }
}

// ------------------------------------------------------------------ robots.txt

async function robotsFor(url: URL, deps: FetchDeps, signal: AbortSignal): Promise<{ txt: string | null; error: boolean }> {
  const cache = deps.robotsCache ?? sharedRobots;
  const now = (deps.now ?? Date.now)();
  const hit = cache.get(url.origin);
  if (hit && now - hit.at < ROBOTS_TTL) return hit;
  let out: { txt: string | null; error: boolean };
  try {
    const sig = anySignal(signal, AbortSignal.timeout(FETCH_LIMITS.robotsMs));
    let at = new URL("/robots.txt", url.origin);
    let res = await deps.fetch(at.toString(), { headers: { "User-Agent": USER_AGENT, Accept: "text/plain" }, redirect: "manual", signal: sig });
    // RFC 9309 2.3.1.2: follow a few redirects, each to an address we would open anyway.
    for (let hop = 0; res.status >= 300 && res.status < 400 && hop < 4; hop++) {
      const next = checkUrl(new URL(res.headers.get("location") ?? "/", at).toString());
      if (!next.ok) break;
      at = next.url;
      res = await deps.fetch(at.toString(), { headers: { "User-Agent": USER_AGENT, Accept: "text/plain" }, redirect: "manual", signal: sig });
    }
    // RFC 9309 2.3.1: 4xx (and a redirect we would not follow) means no rules; 5xx or no answer means do not fetch.
    if (res.status >= 500) out = { txt: null, error: true };
    else if (res.status >= 300) out = { txt: null, error: false };
    else out = { txt: decode((await readCapped(res, FETCH_LIMITS.robotsBytes)).bytes, res.headers.get("content-type") ?? ""), error: false };
  } catch {
    out = { txt: null, error: true };
  }
  cache.set(url.origin, { at: now, ...out });
  return out;
}

// ------------------------------------------------------------------ the page

const refuse = (url: string, reason: Refusal, detail: string): PageRefused => ({ ok: false, url, reason, detail });

function looksLikeBotCheck(res: Response, body: string): boolean {
  if ((res.headers.get("cf-mitigated") ?? "").toLowerCase() === "challenge") return true;
  return /<title>\s*(just a moment|attention required|access denied|verify you are human|are you a robot)/i.test(body)
    || (/challenge-platform|cf-chl-|captcha-delivery|px-captcha|g-recaptcha/i.test(body.slice(0, 20_000)) && body.length < 60_000);
}

/** Fetches a public page and returns its words, or says plainly why it did not. */
export async function fetchPage(raw: string, deps: FetchDeps): Promise<PageResult> {
  const checked = checkUrl(raw);
  if (!checked.ok) return refuse(raw, "bad_url", checked.detail);
  const start = checked.url.toString();
  const no = knownNo(checked.url);
  if (no) return refuse(start, "robots", no);

  const all = AbortSignal.timeout(FETCH_LIMITS.pageMs + FETCH_LIMITS.robotsMs);
  let url = checked.url;
  try {
    for (let hop = 0; ; hop++) {
      const robots = await robotsFor(url, deps, all);
      if (robots.error) return refuse(start, "robots_unreachable", `We could not read ${url.hostname}'s robots.txt, which says what automatic readers may open, so we did not open the page. Try again later, or ${PASTE.toLowerCase()}`);
      if (robots.txt != null && !robotsAllows(robots.txt, url.pathname + url.search)) {
        return refuse(start, "robots", `${url.hostname} asks automatic readers not to open this page (its robots.txt), so we did not. ${PASTE}`);
      }
      const res = await deps.fetch(url.toString(), {
        headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.1", "Accept-Language": "en" },
        redirect: "manual", signal: all,
      });
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        await res.body?.cancel().catch(() => undefined);
        if (!loc) return refuse(start, "http_error", `The page answered ${res.status} with nowhere to go.`);
        if (hop >= FETCH_LIMITS.redirects) return refuse(start, "redirects", "The page sent us on more than 3 times, so we stopped.");
        const next = checkUrl(new URL(loc, url).toString());
        if (!next.ok) return refuse(start, "not_allowed_address", `The page sent us to an address we do not open. ${next.detail}`);
        url = next.url;
        continue;
      }
      const type = (res.headers.get("content-type") ?? "").toLowerCase();
      const size = Number(res.headers.get("content-length") ?? 0);
      if (size > FETCH_LIMITS.refuseOver) { await res.body?.cancel().catch(() => undefined); return refuse(start, "too_large", "The page is larger than 15 MB, so we did not read it."); }
      const { bytes, truncated } = await readCapped(res, FETCH_LIMITS.bytes);
      const body = decode(bytes, type);
      if (looksLikeBotCheck(res, body)) return refuse(start, "bot_check", `${url.hostname} showed a check for automatic visitors instead of the page. We do not get round those. ${PASTE}`);
      if (res.status === 401 || res.status === 403) return refuse(start, "login", `${url.hostname} did not show the page without a login (${res.status}). We never log in to other sites. ${PASTE}`);
      if (res.status === 404 || res.status === 410) return refuse(start, "not_found", "There is no page at that address.");
      if (res.status >= 400) return refuse(start, "http_error", `${url.hostname} answered with an error (${res.status}). Try again later, or ${PASTE.toLowerCase()}`);
      const html = /html|xml/.test(type) || (!type && /<html|<body|<div/i.test(body.slice(0, 2000)));
      const plain = /^text\/plain/.test(type);
      if (!html && !plain) return refuse(start, "not_a_page", "That address is a file, not a web page. Upload a trade file on the Verify page instead.");
      const page = html ? htmlToText(body) : { text: plainText(body), title: null, scripted: false };
      return {
        ok: true, url: start, finalUrl: url.toString(), title: page.title, text: page.text.slice(0, FETCH_LIMITS.textChars),
        bytes: bytes.length, truncated, scripted: page.scripted, fetchedAt: new Date((deps.now ?? Date.now)()).toISOString(),
      };
    }
  } catch (e) {
    const timeout = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
    return timeout
      ? refuse(start, "timeout", "The page took longer than 8 seconds, so we stopped. Try again, or paste the words instead.")
      : refuse(start, "network", "We could not reach that site. Check the address, or paste the words instead.");
  }
}
