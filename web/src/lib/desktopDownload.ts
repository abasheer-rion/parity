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
// Answers are kept 5 minutes in the data centre's cache, so a page view does not call GitHub.
// No browser globals here, so the tests run it directly with a fake fetch and a fake cache.
import { newestDesktopRelease, RELEASES_REPO, type FeedEnv, type Release } from "./desktopFeed";

export const PLATFORMS = {
  "mac-arm64": { label: "Mac with Apple silicon", match: /-arm64\.dmg$/ },
  "mac-intel": { label: "Mac with Intel", match: /-x64\.dmg$/ },
  windows: { label: "Windows", match: /Setup.*\.exe$/ },
} as const;
export type Platform = keyof typeof PLATFORMS;

export const DOWNLOAD_TTL = 300;

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

/** Answers one request to /download/latest/<what>. */
export async function serveDownload(what: string, method: string, env: FeedEnv, ctx: Waiter = {}, fetcher: Fetch = fetch, cache: CacheLike | null = edgeCache()): Promise<Response> {
  if (method !== "GET" && method !== "HEAD") return json(405, { error: "GET only" }, "no-store");
  if (what !== "info" && !Object.hasOwn(PLATFORMS, what)) return json(404, { error: "Not found" }, "no-store");
  const key = new Request(`https://download.cache/latest/${what}`);
  const hit = await cache?.match(key).catch(() => undefined);
  if (hit) return hit;

  const info = await newest(env, fetcher);
  if (info === "error") return json(502, { error: "Could not reach GitHub. Try again in a minute." }, "no-store");
  if (info === "none") return json(404, { error: "No desktop release is published yet." }, "public, max-age=60");
  let res: Response;
  if (what === "info") {
    res = json(200, info, `public, max-age=${DOWNLOAD_TTL}, stale-while-revalidate=86400`);
  } else {
    const file = info.files.find((f) => f.platform === what);
    if (!file) return json(404, { error: `This release has no ${PLATFORMS[what as Platform].label} download.` }, "public, max-age=60");
    res = new Response(null, { status: 302, headers: { Location: file.url, "Cache-Control": `public, max-age=${DOWNLOAD_TTL}` } });
  }
  if (cache) {
    const put = cache.put(key, res.clone()).catch(() => {});
    if (ctx.waitUntil) ctx.waitUntil(put); else await put;
  }
  return res;
}

function edgeCache(): CacheLike | null {
  return (globalThis as unknown as { caches?: { default?: CacheLike } }).caches?.default ?? null;
}
