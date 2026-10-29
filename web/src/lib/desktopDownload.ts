// The download page's links (DEC-0072), served at /download/latest/<what> by
// functions/download/latest/[what].ts. They always point at the newest PUBLISHED desktop
// release, the same one the app's update feed serves (desktopFeed.ts), so the page never
// needs editing when a new version ships:
//
//   /download/latest/mac-arm64   a redirect to the newest Apple silicon disk image
//   /download/latest/mac-intel   a redirect to the newest Intel disk image
//   /download/latest/windows     a redirect to the newest Windows installer
//   /download/latest/info        the version, date, sizes, SHA-256 checksums and links, as JSON
//
// The release is looked up once per 5 minutes per data centre, so a page view does not call
// GitHub; if GitHub fails, the last good copy (up to a day old) is used.
// No browser globals here, so the tests run it directly with a fake fetch and a fake cache.
import { newestDesktopRelease, RELEASES_REPO, type FeedEnv, type Release } from "./desktopFeed";

export const PLATFORMS = {
  "mac-arm64": { label: "Mac with Apple silicon", match: /-arm64\.dmg$/ },
  "mac-intel": { label: "Mac with Intel", match: /-x64\.dmg$/ },
  windows: { label: "Windows", match: /Setup.*\.exe$/ },
} as const;
export type Platform = keyof typeof PLATFORMS;

export const DOWNLOAD_TTL = 300;

const RELEASES_PAGE = `https://github.com/${RELEASES_REPO}/releases`;
/** A fixed answer for the dev server and the E2E server, which never call GitHub. */
export const SAMPLE_DOWNLOAD = {
  version: "0.0.0", published: "2026-01-01T00:00:00Z", notes: RELEASES_PAGE,
  files: [
    { platform: "mac-arm64", label: "Mac with Apple silicon", name: "Parity-0.0.0-arm64.dmg", size: 141_000_000, sha256: "0".repeat(64), url: RELEASES_PAGE },
    { platform: "mac-intel", label: "Mac with Intel", name: "Parity-0.0.0-x64.dmg", size: 148_000_000, sha256: "0".repeat(64), url: RELEASES_PAGE },
    { platform: "windows", label: "Windows", name: "Parity-Setup-0.0.0.exe", size: 132_000_000, sha256: "0".repeat(64), url: RELEASES_PAGE },
  ],
} satisfies { version: string; published: string; notes: string; files: { platform: string; label: string; name: string; size: number; sha256: string | null; url: string }[] };

export interface DownloadFile { platform: Platform; label: string; name: string; size: number; sha256: string | null; url: string }
export interface DownloadInfo { version: string; published: string; notes: string; files: DownloadFile[] }

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;
interface CacheLike { match: (r: Request) => Promise<Response | undefined>; put: (r: Request, res: Response) => Promise<void> }
interface Waiter { waitUntil?: (p: Promise<unknown>) => void }

const json = (status: number, body: unknown, cache: string) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": cache, "Access-Control-Allow-Origin": "*" } });

/** The download details of one release, or null when it has no installer at all. */
export function describeRelease(release: Release): DownloadInfo | null {
  const files: DownloadFile[] = [];
  for (const [platform, p] of Object.entries(PLATFORMS) as [Platform, (typeof PLATFORMS)[Platform]][]) {
    const asset = release.assets.find((a) => p.match.test(a.name));
    if (!asset) continue;
    const digest = (asset.digest ?? "").match(/^sha256:([0-9a-f]{64})$/);
    files.push({
      platform, label: p.label, name: asset.name, size: asset.size, sha256: digest ? digest[1] : null,
      url: asset.browser_download_url ?? `https://github.com/${RELEASES_REPO}/releases/download/${release.tag_name}/${encodeURIComponent(asset.name)}`,
    });
  }
  if (!files.length) return null;
  return {
    version: release.tag_name.replace(/^desktop-v/, ""),
    published: release.published_at ?? "",
    notes: release.html_url ?? `https://github.com/${RELEASES_REPO}/releases/tag/${release.tag_name}`,
    files,
  };
}

async function newest(env: FeedEnv, fetcher: Fetch): Promise<DownloadInfo | "none" | "error"> {
  const headers: Record<string, string> = { "User-Agent": "parity-download", "X-GitHub-Api-Version": "2022-11-28", Accept: "application/vnd.github+json" };
  if (env.DESKTOP_RELEASES_TOKEN) headers.Authorization = `Bearer ${env.DESKTOP_RELEASES_TOKEN}`;
  try {
    const res = await fetcher(`https://api.github.com/repos/${RELEASES_REPO}/releases?per_page=30`, { headers });
    if (!res.ok) return "error";
    const list = (await res.json()) as Release[];
    const release = newestDesktopRelease(Array.isArray(list) ? list : []);
    return (release && describeRelease(release)) || "none";
  } catch {
    return "error";
  }
}

/**
 * The newest release's details: from the data centre's cache when fresh (5 minutes), else
 * from GitHub, else the last good copy (kept a day), so a GitHub hiccup does not break the page.
 */
async function current(env: FeedEnv, ctx: Waiter, fetcher: Fetch, cache: CacheLike | null): Promise<DownloadInfo | "none" | "error"> {
  const fresh = new Request("https://download.cache/latest/v1");
  const kept = new Request("https://download.cache/latest/v1/stale");
  const read = async (r: Request) => { const hit = await cache?.match(r).catch(() => undefined); return hit ? ((await hit.json()) as DownloadInfo) : null; };
  const hit = await read(fresh);
  if (hit) return hit;
  const info = await newest(env, fetcher);
  if (info === "error") return (await read(kept)) ?? "error";
  if (info !== "none" && cache) {
    const body = JSON.stringify(info);
    const put = Promise.all([
      cache.put(fresh, new Response(body, { headers: { "Cache-Control": `public, max-age=${DOWNLOAD_TTL}` } })),
      cache.put(kept, new Response(body, { headers: { "Cache-Control": "public, max-age=86400" } })),
    ]).catch(() => {});
    if (ctx.waitUntil) ctx.waitUntil(put); else await put;
  }
  return info;
}

/** Answers one request to /download/latest/<what>. */
export async function serveDownload(what: string, method: string, env: FeedEnv, ctx: Waiter = {}, fetcher: Fetch = fetch, cache: CacheLike | null = edgeCache()): Promise<Response> {
  if (method !== "GET" && method !== "HEAD") return json(405, { error: "GET only" }, "no-store");
  if (what !== "info" && !Object.hasOwn(PLATFORMS, what)) return json(404, { error: "Not found" }, "no-store");
  const info = await current(env, ctx, fetcher, cache);
  if (what === "info") {
    if (info === "error") return json(502, { error: "Could not reach GitHub. Try again in a minute." }, "no-store");
    if (info === "none") return json(404, { error: "No desktop release is published yet." }, "public, max-age=60");
    return json(200, info, `public, max-age=${DOWNLOAD_TTL}, stale-while-revalidate=86400`);
  }
  // A button never dead-ends: without a release to point at, it opens the releases page.
  const file = typeof info === "object" ? info.files.find((f) => f.platform === what) : undefined;
  if (!file) return new Response(null, { status: 302, headers: { Location: RELEASES_PAGE, "Cache-Control": "no-store" } });
  return new Response(null, { status: 302, headers: { Location: file.url, "Cache-Control": `public, max-age=${DOWNLOAD_TTL}` } });
}

function edgeCache(): CacheLike | null {
  return (globalThis as unknown as { caches?: { default?: CacheLike } }).caches?.default ?? null;
}
