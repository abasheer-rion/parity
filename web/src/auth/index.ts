// The auth module. Everything except config.ts loads lazily, and only when the site is
// built with VITE_APP_AUTH=on, so the Cloudflare-only site downloads none of it.
import { lazy } from "react";

export { AUTH_ENABLED } from "./config";
export const AuthGate = lazy(() => import("./AuthGate"));
export const AccountSettings = lazy(() => import("./AccountSettings"));
