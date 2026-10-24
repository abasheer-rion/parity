// Short links to a strategy: /s/<id> opens /app/#/strategy/<id> (DEC-0038). The page is
// public so a link preview shows the strategy's own card; people go straight on to the
// app, which asks a signed-out visitor to log in and then lands on the strategy.
import { esc, renderHead } from "../../src/lib/meta";
import { isStrategyId, strategyCard, strategyMeta } from "../../src/lib/og/share";

interface Context { params: { id?: string | string[] } }

export function sharePage(id: string): string {
  const to = `/app/#/strategy/${id}`;
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    ${renderHead(strategyMeta(id))}
    <meta http-equiv="refresh" content="0; url=${esc(to)}" />
    <script>location.replace(${JSON.stringify(to)});</script>
  </head>
  <body style="background:#07080d;color:#f1f3f9;font:16px/1.6 Inter,system-ui,sans-serif;padding:40px">
    <p><a style="color:#85a8ff" href="${esc(to)}">Open ${esc(strategyCard(id).title)} in Parity</a></p>
  </body>
</html>`;
}

export const onRequestGet = async ({ params }: Context): Promise<Response> => {
  const id = Array.isArray(params.id) ? params.id[0] : params.id ?? "";
  if (!isStrategyId(id)) return new Response(null, { status: 302, headers: { Location: "/app/#/strategies" } });
  return new Response(sharePage(id), {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=300", "X-Robots-Tag": "noindex, nofollow" },
  });
};
