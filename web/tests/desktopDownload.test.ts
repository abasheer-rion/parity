// The download page's links (DEC-0072): always the newest published release, a redirect per
// platform, and the details as JSON. GitHub is a fake fetch and the edge cache a Map.
// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { describeRelease, serveDownload } from "../src/lib/desktopDownload";
import type { Release } from "../src/lib/desktopFeed";

const sha = "a".repeat(64);
const release = (tag: string, published: string | null, extra: Partial<Release> = {}): Release => ({
  tag_name: tag, draft: false, prerelease: false, published_at: published, html_url: `https://github.com/abasheer-rion/parity/releases/tag/${tag}`,
  assets: [
    { id: 1, name: `Parity-${tag.slice(9)}-arm64.dmg`, size: 141_000_000, digest: `sha256:${sha}`, browser_download_url: `https://github.com/dl/${tag}/arm64.dmg` },
    { id: 2, name: `Parity-${tag.slice(9)}-x64.dmg`, size: 148_000_000, digest: null },
    { id: 3, name: `Parity-Setup-${tag.slice(9)}.exe`, size: 132_000_000, digest: `sha256:${sha}` },
    { id: 4, name: "latest.yml", size: 300 },
  ],
  ...extra,
});

const github = (list: Release[], status = 200) => vi.fn(async () => new Response(JSON.stringify(list), { status }));
function fakeCache() {
  const store = new Map<string, Response>();
  return { store, match: async (r: Request) => store.get(r.url)?.clone(), put: async (r: Request, res: Response) => { store.set(r.url, res); } };
}

describe("describeRelease", () => {
  it("lists the three installers with sizes and checksums", () => {
    const info = describeRelease(release("desktop-v0.2.3", "2026-10-27T01:32:32Z"))!;
    expect(info.version).toBe("0.2.3");
    expect(info.files.map((f) => f.platform)).toEqual(["mac-arm64", "mac-intel", "windows"]);
    expect(info.files[0].sha256).toBe(sha);
    expect(info.files[1].sha256).toBeNull();
    expect(info.files[1].url).toBe("https://github.com/abasheer-rion/parity/releases/download/desktop-v0.2.3/Parity-0.2.3-x64.dmg");
  });
});

describe("serveDownload", () => {
  const list = [release("desktop-v0.3.0", null, { draft: true }), release("desktop-v0.2.3", "2026-10-27T00:00:00Z"), release("desktop-v0.2.2", "2026-10-26T00:00:00Z")];

  it("redirects to the newest published installer and caches the answer", async () => {
    const fetcher = github(list);
    const cache = fakeCache();
    const res = await serveDownload("mac-arm64", "GET", {}, {}, fetcher, cache);
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("https://github.com/dl/desktop-v0.2.3/arm64.dmg");
    const again = await serveDownload("mac-arm64", "GET", {}, {}, fetcher, cache);
    expect(again.status).toBe(302);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("answers the details as JSON", async () => {
    const res = await serveDownload("info", "GET", {}, {}, github(list), null);
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toContain("max-age=300");
    const body = (await res.json()) as { version: string; files: unknown[] };
    expect(body.version).toBe("0.2.3");
    expect(body.files).toHaveLength(3);
  });

  it("refuses unknown names and says when GitHub fails", async () => {
    expect((await serveDownload("linux", "GET", {}, {}, github(list), null)).status).toBe(404);
    expect((await serveDownload("info", "POST", {}, {}, github(list), null)).status).toBe(405);
    const down = await serveDownload("windows", "GET", {}, {}, github([], 500), null);
    expect(down.status).toBe(502);
    expect(down.headers.get("Cache-Control")).toBe("no-store");
    expect((await serveDownload("windows", "GET", {}, {}, github([]), null)).status).toBe(404);
  });
});
