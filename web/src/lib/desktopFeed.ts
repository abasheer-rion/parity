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
// it. If GitHub cannot be reached the feed answers an error and the app keeps running as it is.
// No browser globals here, so the tests run it directly with a fake fetch.

export const RELEASES_REPO = "abasheer-rion/parity";
export const TAG_PREFIX = "desktop-v";
const API = "https://api.github.com";

export interface FeedEnv { DESKTOP_RELEASES_TOKEN?: string }

export interface ReleaseAsset { id: number; name: string; size: number; digest?: string | null; browser_download_url?: string }
export interface Release { tag_name: string; draft: boolean; prerelease: boolean; published_at: string | null; html_url?: string; assets: ReleaseAsset[] }

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

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
export async function serveFeed(file: string, method: string, env: FeedEnv, fetcher: Fetch = fetch): Promise<Response> {
  if (method !== "GET" && method !== "HEAD") return text(405, "GET only");
  // The repository is public now, so the releases can be read without a token.
  // A token, if set, only raises GitHub's rate limit.
  const token = env.DESKTOP_RELEASES_TOKEN;
  const name = cleanFileName(file);
  if (!name) return text(404, "Not found");

  const headers: Record<string, string> = { "User-Agent": "parity-desktop-feed", "X-GitHub-Api-Version": "2022-11-28" };
  if (token) headers.Authorization = `Bearer ${token}`;
  let releases: Release[];
  try {
    const res = await fetcher(`${API}/repos/${RELEASES_REPO}/releases?per_page=30`, { headers: { ...headers, Accept: "application/vnd.github+json" } });
    if (!res.ok) return text(502, `GitHub answered ${res.status}.`);
    releases = (await res.json()) as Release[];
  } catch {
    return text(502, "Could not reach GitHub.");
  }
  const release = newestDesktopRelease(Array.isArray(releases) ? releases : []);
  if (!release) return text(404, "No desktop release is published yet.");
  const asset = release.assets.find((a) => a.name === name);
  if (!asset) return text(404, "Not found");

  const assetUrl = `${API}/repos/${RELEASES_REPO}/releases/assets/${asset.id}`;
  let res: Response;
  try {
    res = await fetcher(assetUrl, { headers: { ...headers, Accept: "application/octet-stream" }, redirect: "manual" });
  } catch {
    return text(502, "Could not reach GitHub.");
  }
  const location = res.headers.get("Location");
  if (name.endsWith(".yml")) {
    // The small description files are passed through, so the app reads them from this address.
    let body: Response = res;
    try {
      if (location) body = await fetcher(location);
    } catch {
      return text(502, "Could not reach GitHub.");
    }
    if (!body.ok) return text(502, `GitHub answered ${body.status}.`);
    const yml = await body.text();
    return new Response(method === "HEAD" ? null : yml, { status: 200, headers: { "Content-Type": "text/yaml; charset=utf-8", "Cache-Control": "public, max-age=300" } });
  }
  // Installers, zips and blockmaps: send the app on to GitHub's signed address, which lasts minutes.
  if (location && /^https:\/\//.test(location)) return new Response(null, { status: 302, headers: { Location: location, "Cache-Control": "no-store" } });
  return text(502, `GitHub answered ${res.status}.`);
}
