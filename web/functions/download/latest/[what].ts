// GET /download/latest/<what>: the download page's always-newest links (DEC-0072). The
// logic and its tests are in src/lib/desktopDownload.ts. DESKTOP_RELEASES_TOKEN, if set in
// the Pages environment, only raises GitHub's rate limit.
import { serveDownload } from "../../../src/lib/desktopDownload";
import type { FeedEnv } from "../../../src/lib/desktopFeed";

interface Context { request: Request; env: FeedEnv; params: { what?: string | string[] }; waitUntil: (p: Promise<unknown>) => void }

export const onRequest = async ({ request, env, params, waitUntil }: Context): Promise<Response> => {
  const what = Array.isArray(params.what) ? params.what.join("/") : params.what ?? "";
  return serveDownload(what, request.method, env, { waitUntil });
};
