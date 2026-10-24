// Short links into Parity Terminal: /sim/<workspace> opens /sim/#/<workspace>, and
// /sim/scenario?type=...&r=... opens the Sim lab on that scenario (DEC-0038). The sign-in
// check (functions/_middleware.ts) runs first, and because this path has no hash it comes
// back intact after logging in. Anything else under /sim/ (sw.js, the manifest) is
// served as before.
import { SIM_TABS } from "../../src/lib/meta";

interface Context { request: Request; params: { tab?: string | string[] }; next: () => Promise<Response> }

export const onRequestGet = async ({ request, params, next }: Context): Promise<Response> => {
  const tab = Array.isArray(params.tab) ? params.tab[0] : params.tab ?? "";
  if (!Object.hasOwn(SIM_TABS, tab)) return next();
  const q = new URL(request.url).search;
  return new Response(null, { status: 302, headers: { Location: `/sim/#/${tab}${q ? `?${q.slice(1)}` : ""}`, "Cache-Control": "no-store" } });
};
