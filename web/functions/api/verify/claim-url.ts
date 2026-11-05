// POST /api/verify/claim-url: reads a seller's public page for the Verify page (DEC-0088).
// The logic is in src/lib/verify/claims/endpoint.ts; this file wires in the Pages
// environment. CLAIM_URL_ENABLED "off" switches it off (404). No secret is needed.
import { handleClaimUrl } from "../../../src/lib/verify/claims/endpoint";
import { SITE_DOMAINS } from "../../../src/lib/meta";

interface Env { CLAIM_URL_ENABLED?: string }
interface Context { request: Request; env: Env }

export const onRequest = async ({ request, env }: Context): Promise<Response> => {
  if (env.CLAIM_URL_ENABLED === "off") return new Response("Not found", { status: 404 });
  return handleClaimUrl(request, {
    fetch: (input, init) => fetch(input, init),
    siteDomain: SITE_DOMAINS,
    log: (line) => console.log(JSON.stringify(line)),
  });
};
