// GET /robots.txt (DEC-0073). Search engines may index the site only on its real address,
// the host in src/lib/site.json (DEC-0038). Every other host that serves the same build
// (preview addresses, the old address, sim., trade., academy. and lab.) gets "Disallow: /",
// so no copy competes with the real one in search.
// On the real host the built dist/robots.txt is served as it is. scripts/seo/build_public.py
// writes it with the sitemap address on the real host.
import { HOST } from "../src/lib/meta";

interface Context {
  request: Request;
  next: () => Promise<Response>;
}

export const BLOCK_ALL = "# This address is not Parity's real address, so nothing here is for search.\nUser-agent: *\nDisallow: /\n";

export function isMainHost(hostname: string): boolean {
  return hostname === HOST;
}

export const onRequestGet = async ({ request, next }: Context): Promise<Response> => {
  const url = new URL(request.url);
  if (isMainHost(url.hostname)) return next();
  return new Response(BLOCK_ALL, {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" },
  });
};
