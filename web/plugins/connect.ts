// The switch for read-only broker connections (DEC-0091), written into the site as
// /verify/connections.json so the Pages Function at /api/connect follows the same build
// setting as the pages: VITE_VERIFY_CONNECTIONS=on (pull request previews and the E2E build)
// or anything else (production, until the owner turns it on). BROKER_CONNECT in the Pages
// environment can still force it off or on.
import { loadEnv, type Plugin } from "vite";

export function parityConnect(): Plugin {
  let on = false;
  return {
    name: "parity-connect",
    config(_c, env) {
      const vars = { ...loadEnv(env.mode, process.cwd(), "VITE_"), ...process.env };
      on = vars.VITE_VERIFY_CONNECTIONS === "on";
    },
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "verify/connections.json", source: JSON.stringify({ on }) + "\n" });
    },
  };
}
