// The badge image for embeds: GET /badge/<id>.svg (REF-0016). Public, no sign-in. It reads
// one badge through the database function verify_badge_public() with the project's
// publishable key (public by design; row level security and that function decide what it
// can see), and draws the 320 by 80 image. GET only, the id must be 12 letters or digits,
// answers are cached for five minutes, and each request is logged by Cloudflare.
import { badgeSvg, isBadgeId, type PublicBadge } from "../../src/lib/verify/badge";

const SUPABASE_URL = "https://ttqvpxvctnomfbeoqbbs.supabase.co";
const PUBLISHABLE_KEY = "sb_publishable_12CQmnbBgVYpkflKhwHD-A_2Xby8b-x";

interface Context { request: Request; params: { id?: string | string[] } }

const svg = (body: string, status = 200, maxAge = 300) => new Response(body, {
  status,
  headers: {
    "Content-Type": "image/svg+xml; charset=utf-8",
    "Cache-Control": `public, max-age=${maxAge}`,
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
  },
});

export async function lookup(id: string, fetcher: typeof fetch = fetch): Promise<PublicBadge | null> {
  const res = await fetcher(`${SUPABASE_URL}/rest/v1/rpc/verify_badge_public`, {
    method: "POST",
    headers: { apikey: PUBLISHABLE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ p_id: id }),
  });
  if (!res.ok) throw new Error(`lookup ${res.status}`);
  const rows = (await res.json()) as PublicBadge[];
  return rows[0] ?? null;
}

export const onRequestGet = async ({ params }: Context, fetcher: typeof fetch = fetch): Promise<Response> => {
  const raw = Array.isArray(params.id) ? params.id[0] : params.id ?? "";
  const id = raw.replace(/\.svg$/, "");
  if (!isBadgeId(id)) return svg(badgeSvg(null), 404, 3600);
  try {
    const b = await lookup(id, fetcher);
    return svg(badgeSvg(b), b ? 200 : 404);
  } catch (e) {
    console.error("badge lookup failed", id, String(e));
    return new Response("Badge unavailable, try again later.", { status: 503, headers: { "Cache-Control": "no-store" } });
  }
};
