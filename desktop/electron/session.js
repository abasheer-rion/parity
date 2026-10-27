// Staying signed in (DEC-0072). The website keeps the Supabase session in a cookie
// (web/src/auth/client.ts), and the app keeps that cookie in its own persistent session
// (persist:parity), so quitting and reopening stays signed in. This file adds three things,
// as plain functions the tests can run without Electron:
//
//   - a long life for the cookie: the website asks for 400 days inside the app, and at launch
//     the app moves an older cookie's expiry out to 400 days too, so a month away is fine
//   - who is signed in, read from the cookie, for the bundled copy when the app starts
//     offline (it shows that copy signed in, and the live site again once online)
//   - when to ask the pages to check their session: after sleep, unlock, a connection coming
//     back, and every 30 minutes, so the hourly access token is renewed in the background
//
// The app never refreshes the token itself and never copies the refresh token anywhere:
// one copy of the session, refreshed only by the website's own code, so token rotation
// never sees the same refresh token used twice.

const AUTH_COOKIE = /^sb-([a-z0-9]+)-auth-token(?:\.(\d+))?$/;
const LONG_DAYS = 400; // the longest a browser keeps a cookie
const EXTEND_BELOW_DAYS = 300; // at launch, move out any expiry nearer than this
const CHECK_EVERY_MS = 30 * 60 * 1000;
const DAY = 24 * 60 * 60;

/** The session JSON in the auth cookie (maybe split into .0, .1, ...), or null. */
function readSession(cookies) {
  const parts = new Map();
  for (const c of cookies) {
    const m = AUTH_COOKIE.exec(c.name);
    if (m) parts.set(m[2] === undefined ? -1 : Number(m[2]), c.value);
  }
  let raw = parts.get(-1) || "";
  if (!raw) for (let n = 0; parts.has(n); n++) raw += parts.get(n);
  if (!raw) return null;
  try {
    raw = decodeURIComponent(raw);
    const json = raw.startsWith("base64-") ? Buffer.from(raw.slice(7), "base64url").toString("utf8") : raw;
    const s = JSON.parse(json);
    return s && typeof s === "object" ? s : null;
  } catch {
    return null;
  }
}

/** Who is signed in, for the bundled copy offline: an id and email only, never a token. */
function savedUser(cookies) {
  const s = readSession(cookies);
  const id = s?.user?.id;
  if (typeof id !== "string" || !s.refresh_token) return null;
  return { id, email: typeof s.user.email === "string" ? s.user.email : null };
}

/**
 * The cookies.set() details that move an auth cookie's expiry out to LONG_DAYS, or null when
 * it is already far enough out (or is a cookie that ends with the app, which is left alone).
 */
function extended(cookie, nowSec) {
  if (!AUTH_COOKIE.test(cookie.name) || cookie.session || !cookie.expirationDate) return null;
  if (cookie.expirationDate <= nowSec) return null; // already gone: the website decides
  if (cookie.expirationDate - nowSec > EXTEND_BELOW_DAYS * DAY) return null;
  const host = (cookie.domain || "").replace(/^\./, "");
  if (!host) return null;
  return {
    url: `https://${host}${cookie.path || "/"}`,
    name: cookie.name,
    value: cookie.value,
    domain: cookie.hostOnly ? undefined : cookie.domain,
    path: cookie.path || "/",
    secure: cookie.secure !== false,
    httpOnly: !!cookie.httpOnly,
    sameSite: cookie.sameSite || "lax",
    expirationDate: Math.floor(nowSec + LONG_DAYS * DAY),
  };
}

module.exports = { AUTH_COOKIE, LONG_DAYS, EXTEND_BELOW_DAYS, CHECK_EVERY_MS, readSession, savedUser, extended };
