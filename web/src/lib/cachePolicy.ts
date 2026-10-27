// How long browsers and Cloudflare may keep each kind of public answer (DEC-0072).
// public/_headers sets the same values for the static files Pages serves by itself; the
// middleware (functions/_middleware.ts) uses publicCacheFor() for the public answers that
// pass through it, such as the front page. Signed-in answers never use these: the
// middleware gives them "private" values (cacheFor there).
//
// The rule of thumb:
//   built files with a hash in the name   a year, never asked about again
//   public pages                          fresh for 10 minutes, then shown at once while a
//                                         new copy loads, for up to 3 days
//   pictures, fonts, icons                a day, then the same 3 days
//   small public data that changes hourly a minute, then 10 minutes while a new copy loads
//   sign-in pages, signed-in answers      never kept
// Each deploy replaces every static file at the edge, so a deploy is never hidden behind
// the edge copy; a browser shows at most one stale view before it has the new page.
// No browser globals, so the tests run it directly.

export const THREE_DAYS = 3 * 24 * 60 * 60;

export const CACHE = {
  immutable: "public, max-age=31536000, immutable",
  page: `public, max-age=600, stale-while-revalidate=${THREE_DAYS}`,
  media: `public, max-age=86400, stale-while-revalidate=${THREE_DAYS}`,
  feed: "public, max-age=3600, stale-while-revalidate=86400",
  hourlyData: "public, max-age=60, stale-while-revalidate=600",
  never: "no-store",
} as const;

const PUBLIC_PAGE = /^\/(?:$|index\.html$|download\/?$|(?:developers|legal|learn|ideas|notes|blog|news|authors|tags)(?:\/|$))/;
const AUTH_PAGE = /^\/(?:login|signup|reset|verify|connect|oauth)(?:\/|$)/;
const MEDIA = /^\/(?:brand\/|content\/|favicon|apple-touch-icon|icon-|og\/default\.png$)/;
const HASHED_PUBLIC = /^\/assets\//;

/**
 * The Cache-Control for a public answer at `pathname`, or null to leave the answer's own.
 * Only plain 200 answers are kept; errors and redirects are never cached here.
 */
export function publicCacheFor(pathname: string, status = 200): string | null {
  if (AUTH_PAGE.test(pathname)) return CACHE.never;
  if (status !== 200) return null;
  if (HASHED_PUBLIC.test(pathname)) return CACHE.immutable;
  if (pathname === "/stats.json" || pathname === "/seo-manifest.json") return CACHE.hourlyData;
  if (pathname === "/sitemap.xml" || pathname === "/robots.txt" || pathname === "/manifest.webmanifest") return CACHE.feed;
  if (MEDIA.test(pathname)) return CACHE.media;
  if (PUBLIC_PAGE.test(pathname)) return CACHE.page;
  return null;
}
