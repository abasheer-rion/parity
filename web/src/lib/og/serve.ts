// Serving a live share image from a Cloudflare function (DEC-0038): draw it once, keep it
// in Cloudflare's edge cache for an hour, and log each drawing. Social sites fetch a link's
// image a few times when it is first posted, then keep their own copy.
import { LOGO_PATH } from "../meta";
import { svgToPng } from "./render";

export interface Assets { fetch: (req: Request | string) => Promise<Response> }
export interface OgContext {
  request: Request;
  env: { ASSETS: Assets };
  params: { id?: string | string[] };
  waitUntil: (p: Promise<unknown>) => void;
}

export const MAX_AGE = 3600;

let logoText: string | null = null;

export async function logo(request: Request, assets: Assets): Promise<string> {
  if (logoText) return logoText;
  const res = await assets.fetch(new URL(LOGO_PATH, request.url).toString());
  if (!res.ok) throw new Error(`logo ${res.status}`);
  logoText = await res.text();
  return logoText;
}

export const paramId = (params: OgContext["params"]) => (Array.isArray(params.id) ? params.id[0] : params.id ?? "").replace(/\.png$/, "");

const edgeCache = (): Cache | null => (globalThis as unknown as { caches?: { default?: Cache } }).caches?.default ?? null;

/** Answers from the edge cache, or draws the card, answers and caches it. */
export async function servePng(ctx: OgContext, draw: (logo: string) => Promise<string | null>, label: string): Promise<Response> {
  const cache = edgeCache();
  const key = new Request(new URL(ctx.request.url).toString(), { method: "GET" });
  const hit = await cache?.match(key);
  if (hit) return hit;
  try {
    const svg = await draw(await logo(ctx.request, ctx.env.ASSETS));
    if (!svg) return new Response("Not found", { status: 404, headers: { "Cache-Control": "public, max-age=3600" } });
    const png = await svgToPng(svg);
    console.log("og card drawn", label);
    const res = new Response(png as Uint8Array<ArrayBuffer>, {
      headers: { "Content-Type": "image/png", "Cache-Control": `public, max-age=${MAX_AGE}`, "X-Content-Type-Options": "nosniff", "X-Robots-Tag": "noindex" },
    });
    if (cache) ctx.waitUntil(cache.put(key, res.clone()));
    return res;
  } catch (e) {
    console.error("og card failed", label, String(e));
    // A preview with the general card beats a broken image.
    return new Response(null, { status: 302, headers: { Location: "/og/default.png", "Cache-Control": "no-store" } });
  }
}
