// The public Verify badge pages, /v/<id> (REF-0016): every id gets the same page, which
// reads the id from the address and loads that one badge. This serves the built page at
// /v/ for any /v/<id>, keeping the address as shared. No sign-in; nothing is looked up here.
interface Context { request: Request; env: { ASSETS: { fetch: (req: Request | string) => Promise<Response> } }; params: { id?: string | string[] } }

export const onRequestGet = async ({ request, env }: Context): Promise<Response> => {
  const page = await env.ASSETS.fetch(new Request(new URL("/v/", request.url).toString(), { headers: request.headers }));
  const out = new Response(page.body, page);
  out.headers.set("X-Robots-Tag", "noindex, nofollow");
  return out;
};
