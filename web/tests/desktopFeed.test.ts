// The desktop app's update feed (DEC-0049): only published desktop releases, only listed
// files, text for the .yml files and a redirect for the rest. GitHub is a fake fetch.
// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { cleanFileName, newestDesktopRelease, serveFeed, type Release } from "../src/lib/desktopFeed";

const release = (tag: string, published: string | null, extra: Partial<Release> = {}): Release => ({
  tag_name: tag, draft: false, prerelease: false, published_at: published,
  assets: [{ id: 11, name: "latest-mac.yml", size: 400 }, { id: 12, name: "Parity-0.2.0-arm64-mac.zip", size: 9e7 }],
  ...extra,
});

function github(releases: Release[], { yml = "version: 0.2.0\n", status = 200 } = {}) {
  return vi.fn(async (url: string, _init?: RequestInit) => {
    if (url.includes("/releases?")) return new Response(JSON.stringify(releases), { status });
    if (url.endsWith("/assets/11")) return new Response(null, { status: 302, headers: { Location: "https://objects.example/latest-mac.yml?sig=1" } });
    if (url.endsWith("/assets/12")) return new Response(null, { status: 302, headers: { Location: "https://objects.example/zip?sig=2" } });
    if (url.startsWith("https://objects.example/latest-mac.yml")) return new Response(yml, { status: 200 });
    return new Response("nope", { status: 404 });
  });
}

describe("newestDesktopRelease", () => {
  it("skips drafts, pre-releases and other tags", () => {
    const list = [
      release("desktop-v0.3.0", null, { draft: true }),
      release("desktop-v0.2.1", "2026-10-26T00:00:00Z", { prerelease: true }),
      release("v9.0.0", "2026-10-27T00:00:00Z"),
      release("desktop-v0.2.0", "2026-10-25T00:00:00Z"),
      release("desktop-v0.1.2", "2026-10-24T00:00:00Z"),
    ];
    expect(newestDesktopRelease(list)?.tag_name).toBe("desktop-v0.2.0");
    expect(newestDesktopRelease([])).toBeNull();
  });
});

describe("cleanFileName", () => {
  it("accepts update file names and refuses paths", () => {
    expect(cleanFileName("latest-mac.yml")).toBe("latest-mac.yml");
    expect(cleanFileName("Parity-Setup-0.2.0.exe.blockmap")).toBe("Parity-Setup-0.2.0.exe.blockmap");
    expect(cleanFileName("../secrets")).toBeNull();
    expect(cleanFileName("a/b")).toBeNull();
    expect(cleanFileName("%2e%2e")).toBeNull();
    expect(cleanFileName("")).toBeNull();
  });
});

describe("serveFeed", () => {
  const env = { DESKTOP_RELEASES_TOKEN: "test-token" };
  const list = [release("desktop-v0.2.0", "2026-10-25T00:00:00Z")];

  it("answers 503 until the token is set", async () => {
    const res = await serveFeed("latest-mac.yml", "GET", {}, github(list));
    expect(res.status).toBe(503);
  });

  it("passes the .yml file through as text", async () => {
    const f = github(list);
    const res = await serveFeed("latest-mac.yml", "GET", env, f);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("version: 0.2.0\n");
    expect(res.headers.get("Content-Type")).toContain("yaml");
    // The token goes to GitHub's API only, never to the download address.
    const objectCall = f.mock.calls.find(([u]) => String(u).startsWith("https://objects.example/latest-mac.yml"));
    expect(objectCall?.[1]).toBeUndefined();
  });

  it("redirects installers to GitHub's download address", async () => {
    const res = await serveFeed("Parity-0.2.0-arm64-mac.zip", "GET", env, github(list));
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("https://objects.example/zip?sig=2");
  });

  it("answers 404 for files the release does not list, and when nothing is published", async () => {
    expect((await serveFeed("other.exe", "GET", env, github(list))).status).toBe(404);
    expect((await serveFeed("latest-mac.yml", "GET", env, github([release("desktop-v0.3.0", null, { draft: true })]))).status).toBe(404);
  });

  it("refuses other methods and reports GitHub errors", async () => {
    expect((await serveFeed("latest-mac.yml", "POST", env, github(list))).status).toBe(405);
    expect((await serveFeed("latest-mac.yml", "GET", env, github(list, { status: 401 }))).status).toBe(502);
  });
});
