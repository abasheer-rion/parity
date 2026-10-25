// The browser side of the payments feature flag (DEC-0046). Off unless a build sets
// VITE_PAYMENTS=on, the same pattern as VITE_AUTH_PASSKEYS. With it off, the pricing page
// does not exist and nothing in the browser talks to Stripe. The server endpoints have
// their own flag (PAYMENTS_ENABLED, see guard.ts), so turning on one does not turn on the
// other.
export const PAYMENTS_ENABLED: boolean = import.meta.env.VITE_PAYMENTS === "on";
