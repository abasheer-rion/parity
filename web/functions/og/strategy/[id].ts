// The share image for a strategy: GET /og/strategy/<id>.png, 1200 by 630 (DEC-0038).
// Public. It shows the strategy's name and kind only, never its results, which stay
// behind sign-in (DEC-0015). The id must look like a strategy id; each card is drawn at
// most once an hour per edge location, and every drawing is logged.
import { cardSvg } from "../../../src/lib/og/card";
import { paramId, servePng, type OgContext } from "../../../src/lib/og/serve";
import { isStrategyId, strategyCard } from "../../../src/lib/og/share";

export const onRequestGet = async (ctx: OgContext): Promise<Response> => {
  const id = paramId(ctx.params);
  if (!isStrategyId(id)) return new Response("Not found", { status: 404, headers: { "Cache-Control": "public, max-age=3600" } });
  return servePng(ctx, async (logo) => cardSvg(strategyCard(id), logo), `strategy ${id}`);
};
