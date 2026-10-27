// /api/keys and /api/keys/rotate: make or rotate an API key for the signed-in person
// (DEC-0071). Needs PARITY_API_KEY_PEPPER; answers 503 until it is set. The new key is in
// the answer once and is never stored or logged.
import { verifyToken } from "../../../src/lib/mcp/auth";
import { handleKeys } from "../../../src/lib/api/manage";
import { createKey, rotateKey } from "../../../src/lib/api/store";
import { SITE_DOMAIN } from "../../../src/lib/meta";

interface Env { PARITY_API_KEY_PEPPER?: string }
interface Context { request: Request; env: Env }

export const onRequest = async ({ request, env }: Context): Promise<Response> =>
  handleKeys(request, {
    pepper: env.PARITY_API_KEY_PEPPER,
    siteDomain: SITE_DOMAIN,
    verify: (t) => verifyToken(t),
    create: (t, a) => createKey(t, a),
    rotate: (t, id, a) => rotateKey(t, id, a),
    log: (line) => console.log(JSON.stringify(line)),
  });
