// The public Verify badge pages, /v/<id> (REF-0016): every id gets the same page, which
// reads the id from the address and loads that one badge. This serves the built page at
// /v/ for any /v/<id>, keeping the address as shared. No sign-in. An id with no badge
// gets the same page, which says so, with status 404.
//
// So a shared link previews with its own verdict, the head tags are swapped for that
// badge's (DEC-0038): the title says the verdict and "survives up to N tries", and the
// image is /og/badge/<id>.png. The badge is read through verify_badge_public(), as the
// badge image does; if that fails, the page goes out with its general tags.
import { withHead } from "../../src/lib/meta";
import { badgeMeta } from "../../src/lib/og/share";
import { isBadgeId } from "../../src/lib/verify/badge";
import { lookup } from "../badge/[id]";

interface Context { request: Request; env: { ASSETS: { fetch: (req: Request | string) => Promise<Response> } }; params: { id?: string | string[] } }

export const onRequestGet = async ({ request, env, params }: Context, fetcher: typeof fetch = fetch): Promise<Response> => {
  const page = await env.ASSETS.fetch(new Request(new URL("/v/", request.url).toString(), { headers: request.headers }));
  const id = (Array.isArray(params.id) ? params.id[0] : params.id ?? "").replace(/\/$/, "");
  let res: Response;
  if (page.ok && isBadgeId(id)) {
    let html = await page.text();
    let found = true;
    try {
      const badge = await lookup(id, fetcher);
      found = badge !== null;
      html = withHead(html, badgeMeta(badge, id));
    } catch (e) {
      console.error("badge page tags failed", id, String(e));
    }
    // No badge with this id: the same page (it says so), with status 404 (DEC-0055). A
    // failed lookup is not a missing badge, so that keeps 200 and the page tries again.
    res = new Response(html, { status: found ? page.status : 404, statusText: found ? page.statusText : "Not Found", headers: page.headers });
    res.headers.delete("Content-Length");
    res.headers.delete("ETag");
  } else if (page.ok) {
    // Not even the shape of a badge id (12 letters and digits): the page says no record, with 404.
    res = new Response(page.body, { status: 404, statusText: "Not Found", headers: page.headers });
  } else {
    res = new Response(page.body, page);
  }
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
};
