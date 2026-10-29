// The embeddable card for a Verify badge: GET /badge/<id>/card (DEC-0081). Public, no
// sign-in. Plain HTML with no script, meant for another site's <iframe>, so it alone may be
// framed by anyone. It reads one badge through verify_badge_public(), the same cached
// lookup as the badge image (/badge/<id>.svg), and never shows an owner. GET only, the id
// must be 12 letters or digits, cached five minutes in browsers, and logged by Cloudflare.
import { badgeCardHtml, isBadgeId } from "../../../src/lib/verify/badge";
import { lookup } from "../[id]";

interface Context { request: Request; params: { id?: string | string[] } }

const html = (body: string, status: number, maxAge: number) => new Response(body, {
  status,
  headers: {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": `public, max-age=${maxAge}`,
    "X-Content-Type-Options": "nosniff",
    "X-Robots-Tag": "noindex, nofollow",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    // No script, no outside requests; any site may frame it.
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors *; base-uri 'none'; form-action 'none'",
  },
});

export const onRequestGet = async ({ request, params }: Context, fetcher: typeof fetch = fetch): Promise<Response> => {
  const id = Array.isArray(params.id) ? params.id[0] : params.id ?? "";
  const origin = new URL(request.url).origin;
  if (!isBadgeId(id)) return html(badgeCardHtml(null, id.slice(0, 12).replace(/[^A-Za-z0-9]/g, ""), origin), 404, 3600);
  try {
    const b = await lookup(id, fetcher);
    return html(badgeCardHtml(b, id, origin), b ? 200 : 404, 300);
  } catch (e) {
    console.error("badge card lookup failed", id, String(e));
    return new Response("Record unavailable, try again later.", { status: 503, headers: { "Cache-Control": "no-store" } });
  }
};
