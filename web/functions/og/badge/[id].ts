// The share image for a Verify badge: GET /og/badge/<id>.png, 1200 by 630 (DEC-0038).
// Public, no sign-in, like the badge page it belongs to. It shows the verdict and how
// many tries the record survives, read through verify_badge_public() exactly as the
// badge image (/badge/<id>.svg) does. A withdrawn badge never shows its old verdict.
// GET only, the id must be 12 letters or digits, each card is drawn at most once an hour
// per edge location, and every drawing is logged.
import { badgeCardSvg } from "../../../src/lib/og/card";
import { paramId, servePng, type OgContext } from "../../../src/lib/og/serve";
import { badgeCard } from "../../../src/lib/og/share";
import { isBadgeId } from "../../../src/lib/verify/badge";
import { lookup } from "../../badge/[id]";

export const onRequestGet = async (ctx: OgContext): Promise<Response> => {
  const id = paramId(ctx.params);
  if (!isBadgeId(id)) return new Response("Not found", { status: 404, headers: { "Cache-Control": "public, max-age=3600" } });
  return servePng(ctx, async (logo) => badgeCardSvg(badgeCard(await lookup(id), id), logo), `badge ${id}`);
};
