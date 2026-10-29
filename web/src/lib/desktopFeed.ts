// The desktop app's update feed (DEC-0049), served at /desktop/updates/<file> by
// functions/desktop/updates/[[file]].ts.
//
// The release workflow (.github/workflows/desktop-release.yml) attaches every update file to
// a GitHub release: latest-mac.yml, latest.yml, the Mac zips and disk images, the Windows
// installer and their .blockmap files. This feed reads them (with the optional read-only
// token DESKTOP_RELEASES_TOKEN from the Pages environment, which only raises GitHub's rate
// limit) and answers without any sign-in:
//
//   latest-mac.yml, latest.yml   the newest PUBLISHED desktop-v* release's file, as text
//   any other listed file        a redirect to GitHub's short-lived download address
//
// Draft and pre-release releases are never served, so publishing a release is what ships
// it. GitHub's answers are kept at the edge (the Cache API): the release list for 5 minutes,
// each .yml file for good (an asset id never changes its contents). Each GitHub call is tried
// up to 3 times with a growing pause, and when GitHub still fails the last good answer is
// served, up to a week old. Only with nothing kept does the feed answer an error, and then
// the app keeps running as it is.
// No browser globals here, so the tests run it directly with a fake fetch.

export const RELEASES_REPO = "abasheer-rion/parity";
export const TAG_PREFIX = "desktop-v";
const API = "https://api.github.com";

export interface FeedEnv { DESKTOP_RELEASES_TOKEN?: string }

export interface ReleaseAsset { id: number; name: string; size: number; digest?: string | null; browser_download_url?: string }
export interface Release { tag_name: string; draft: boolean; prerelease: boolean; published_at: string | null; html_url?: string; assets: ReleaseAsset[] }

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

/** Where GitHub's answers are kept between requests: the edge cache in production, a Map in tests. */
export interface FeedStore {
  get(key: string): Promise<{ body: string; savedAt: number } | null>;
  put(key: string, body: string): Promise<void>;
}

export const FRESH_MS = 5 * 60 * 1000;
const STALE_MS = 7 * 24 * 60 * 60 * 1000;
const CACHE_ORIGIN = "https://desktop-feed.cache.invalid/";

/** The Cloudflare edge cache, or null where there is none. */
export function edgeStore(): FeedStore | null {
  const c = (globalThis as unknown as { caches?: { default?: Cache } }).caches?.default;
  if (!c) return null;
  return {
    async get(key) {
      const res = await c.match(CACHE_ORIGIN + key).catch(() => undefined);
      if (!res) return null;
      return { body: await res.text(), savedAt: Number(res.headers.get("X-Saved-At")) || 0 };
    },
    async put(key, body) {
      await c.put(CACHE_ORIGIN + key, new Response(body, { headers: { "Cache-Control": `public, max-age=${STALE_MS / 1000}`, "X-Saved-At": String(Date.now()) } })).catch(() => undefined);
    },
  };
}

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** A GitHub call, tried up to 3 times when GitHub fails, limits the rate or cannot be reached. */
async function withRetry(fetcher: Fetch, url: string, init: RequestInit | undefined, wait = pause): Promise<Response> {
  let last: unknown = null;
  for (let i = 0; i < 3; i++) {
    if (i > 0) await wait(250 * 3 ** (i - 1));
    try {
      const res = await fetcher(url, init);
      if (res.status < 500 && res.status !== 429 && res.status !== 403) return res;
      last = res;
    } catch (e) {
      last = e;
    }
  }
  if (last instanceof Response) return last;
  throw last;
}

/** File names the feed will look up: letters, digits, dots, dashes and underscores only. */
export function cleanFileName(raw: string): string | null {
  let name: string;
  try { name = decodeURIComponent(raw); } catch { return null; }
  return /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(name) && !name.includes("..") ? name : null;
}

/** The newest published desktop release, or null. Drafts and pre-releases never count. */
export function newestDesktopRelease(releases: Release[]): Release | null {
  const ok = releases.filter((r) => r.tag_name.startsWith(TAG_PREFIX) && !r.draft && !r.prerelease && r.published_at);
  ok.sort((a, b) => (b.published_at ?? "").localeCompare(a.published_at ?? ""));
  return ok[0] ?? null;
}

const text = (status: number, body: string, cache = "no-store") =>
  new Response(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": cache } });

/** Answers one request to /desktop/updates/<file>. */
export async function serveFeed(file: string, method: string, env: FeedEnv, fetcher: Fetch = fetch, store: FeedStore | null = edgeStore(), wait = pause): Promise<Response> {
  if (method !== "GET" && method !== "HEAD") return text(405, "GET only");
  // The repository is public now, so the releases can be read without a token.
  // A token, if set, only raises GitHub's rate limit.
  const token = env.DESKTOP_RELEASES_TOKEN;
  const name = cleanFileName(file);
  if (!name) return text(404, "Not found");

  const headers: Record<string, string> = { "User-Agent": "parity-desktop-feed", "X-GitHub-Api-Version": "2022-11-28" };
  if (token) headers.Authorization = `Bearer ${token}`;
  let releases: Release[];
  const kept = await store?.get("releases").catch(() => null);
  const age = kept ? Date.now() - kept.savedAt : Infinity;
  const parse = (body: string): Release[] | null => { try { const v = JSON.parse(body); return Array.isArray(v) ? (v as Release[]) : null; } catch { return null; } };
  const keptList = kept && age < STALE_MS ? parse(kept.body) : null;
  if (keptList && age < FRESH_MS) {
    releases = keptList;
  } else {
    let problem = "Could not reach GitHub.";
    let fresh: Release[] | null = null;
    try {
      const res = await withRetry(fetcher, `${API}/repos/${RELEASES_REPO}/releases?per_page=30`, { headers: { ...headers, Accept: "application/vnd.github+json" } }, wait);
      if (res.ok) {
        const body = await res.text();
        fresh = parse(body);
        if (fresh) await store?.put("releases", body).catch(() => undefined);
        else problem = "GitHub answered something unreadable.";
      } else problem = `GitHub answered ${res.status}.`;
    } catch { /* problem says so */ }
    if (fresh) releases = fresh;
    else if (keptList) releases = keptList; // stale, but better than an error
    else return text(502, problem);
  }
  const release = newestDesktopRelease(Array.isArray(releases) ? releases : []);
  if (!release) return text(404, "No desktop release is published yet.");
  const asset = release.assets.find((a) => a.name === name);
  if (!asset) return text(404, "Not found");

  const assetUrl = `${API}/repos/${RELEASES_REPO}/releases/assets/${asset.id}`;
  const ymlAnswer = (yml: string) => new Response(method === "HEAD" ? null : yml, { status: 200, headers: { "Content-Type": "text/yaml; charset=utf-8", "Cache-Control": "public, max-age=300" } });
  // An asset id never changes its contents, so a kept .yml file is good for as long as it is kept.
  const ymlKey = `asset-${asset.id}`;
  if (name.endsWith(".yml")) {
    const keptYml = await store?.get(ymlKey).catch(() => null);
    if (keptYml) return ymlAnswer(keptYml.body);
  }
  let res: Response;
  try {
    res = await withRetry(fetcher, assetUrl, { headers: { ...headers, Accept: "application/octet-stream" }, redirect: "manual" }, wait);
  } catch {
    return text(502, "Could not reach GitHub.");
  }
  const location = res.headers.get("Location");
  if (name.endsWith(".yml")) {
    // The small description files are passed through, so the app reads them from this address.
    let body: Response = res;
    try {
      if (location) body = await withRetry(fetcher, location, undefined, wait);
    } catch {
      return text(502, "Could not reach GitHub.");
    }
    if (!body.ok) return text(502, `GitHub answered ${body.status}.`);
    const yml = await body.text();
    await store?.put(ymlKey, yml).catch(() => undefined);
    return ymlAnswer(yml);
  }
  // Installers, zips and blockmaps: send the app on to GitHub's signed address, which lasts minutes.
  if (location && /^https:\/\//.test(location)) return new Response(null, { status: 302, headers: { Location: location, "Cache-Control": "no-store" } });
  return text(502, `GitHub answered ${res.status}.`);
}
