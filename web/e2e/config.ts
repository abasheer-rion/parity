// Shared settings for the E2E suite.
export const PORT = Number(process.env.E2E_PORT ?? 4317);
export const BASE = `http://127.0.0.1:${PORT}`;
export const SUPABASE = "https://ttqvpxvctnomfbeoqbbs.supabase.co";
export const COOKIE = "sb-ttqvpxvctnomfbeoqbbs-auth-token";
