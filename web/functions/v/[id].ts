// The public Verify badge pages, /v/<id> (REF-0016): every id gets the same page, which
// reads the id from the address and loads that one badge. This serves the built page at
// /v/ for any /v/<id>, keeping the address as shared. No sign-in.
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
    try {
      html = withHead(html, badgeMeta(await lookup(id, fetcher), id));
    } catch (e) {
      console.error("badge page tags failed", id, String(e));
    }
    res = new Response(html, page);
    res.headers.delete("Content-Length");
    res.headers.delete("ETag");
  } else {
    res = new Response(page.body, page);
  }
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
};
