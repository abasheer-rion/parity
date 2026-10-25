// GET /desktop/updates/<file>: the desktop app's public update feed (DEC-0049). The logic
// and its tests are in src/lib/desktopFeed.ts. DESKTOP_RELEASES_TOKEN (a read-only GitHub
// token for this repository) comes from the Pages environment and is never committed.
import { serveFeed, type FeedEnv } from "../../../src/lib/desktopFeed";

interface Context { request: Request; env: FeedEnv; params: { file?: string | string[] } }

export const onRequest = async ({ request, env, params }: Context): Promise<Response> => {
  const file = Array.isArray(params.file) ? params.file.join("/") : params.file ?? "";
  return serveFeed(file, request.method, env);
};
