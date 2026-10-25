// Where an address goes inside the desktop app (DEC-0041). Plain functions, no Electron,
// so `npm test` can run them.
//
// Every place in the app is named by an in-app path such as /trade/#/alerts. When online the
// path opens on the live site (liveUrl: parity.endyland.com, or the front page of
// sim., trade., academy. or lab.endyland.com); when offline it opens in the copy of the site
// bundled at app://parity/. The website's addresses and parity:// links all map onto these
// paths (toAppPath); anything else is an outside address and opens in the browser.
const fs = require("node:fs");
const path = require("node:path");

const APP_ORIGIN = "app://parity";

/** The website's hosts and the path each one's front page is (src/lib/site.json gives the domain). */
function siteHosts(origin) {
  const host = new URL(origin).host;
  const domain = host.split(".").length > 2 ? host.split(".").slice(1).join(".") : host;
  return { [host]: "/", [`sim.${domain}`]: "/sim/", [`trade.${domain}`]: "/trade/", [`academy.${domain}`]: "/academy/", [`lab.${domain}`]: "/lab/" };
}

/** Short links the website's functions answer: /s/<strategy> and /sim/<workspace>. */
function expandShortLink(p) {
  const [pathPart, ...rest] = p.split("#");
  const hash = rest.length ? `#${rest.join("#")}` : "";
  const [pathname, query = ""] = pathPart.split("?");
  let m = pathname.match(/^\/s\/([a-z0-9_]{1,64})\/?$/);
  if (m && !hash) return `/app/#/strategy/${m[1]}`;
  m = pathname.match(/^\/sim\/([a-z][a-z0-9-]{0,31})\/?$/);
  if (m && m[1] !== "assets" && !hash) return `/sim/#/${m[1]}${query ? `?${query}` : ""}`;
  return p;
}

/**
 * The in-app path for an address, or null when it belongs to another site.
 * Accepts parity://..., https://<site host>/..., app://parity/... and bare paths.
 */
function toAppPath(input, origin) {
  if (typeof input !== "string" || !input) return null;
  if (input.startsWith("/") && !input.startsWith("//")) return expandShortLink(input);
  let url;
  try { url = new URL(input); } catch { return null; }
  const tail = (pathname) => `${pathname}${url.search}${url.hash}`;
  if (url.protocol === "parity:") {
    if (url.host === "open") {
      const to = url.searchParams.get("url");
      return to ? toAppPath(to, origin) : "/";
    }
    // parity://s/fx_carry parses with "s" as the host; parity:///s/fx_carry has none.
    const p = url.host ? `/${url.host}${url.pathname || "/"}` : url.pathname || "/";
    return expandShortLink(tail(p));
  }
  if (url.protocol === "app:" && url.host === "parity") return expandShortLink(tail(url.pathname));
  if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
  const front = siteHosts(origin)[url.hostname.toLowerCase()];
  if (front === undefined) return null;
  const p = url.pathname === "/" ? front : url.pathname;
  return expandShortLink(tail(p));
}

/** The origins the app trusts: the bundled copy and the website's addresses, nothing else. */
function trustedOrigins(origin) {
  return [APP_ORIGIN, ...Object.keys(siteHosts(origin)).map((h) => `https://${h}`)];
}

/** True when an address may load inside the app's page view (and get the page bridge). */
function isTrusted(input, origin) {
  let url;
  try { url = new URL(input); } catch { return false; }
  if (url.username || url.password) return false;
  if (url.protocol === "app:") return url.host === "parity";
  if (url.protocol !== "https:" || url.port) return false;
  return Object.hasOwn(siteHosts(origin), url.hostname.toLowerCase());
}

/**
 * The live address for an in-app path. The front pages of Sim World, Trade, Academy and
 * Workbench open on their own addresses (sim.<domain> and so on), as on the web; every other
 * path opens on the main address.
 */
function liveUrl(appPath, origin) {
  const u = new URL(appPath || "/", "https://placeholder.invalid");
  const tail = `${u.search}${u.hash}`;
  for (const [host, front] of Object.entries(siteHosts(origin))) {
    if (front !== "/" && (u.pathname === front || u.pathname === front.slice(0, -1))) return `https://${host}/${tail}`;
  }
  return `${origin.replace(/\/$/, "")}${u.pathname}${tail}`;
}

/** Which sidebar section an in-app address belongs to, or null to keep the current one. */
function activeSection(appUrl, sections) {
  let url;
  try { url = new URL(appUrl); } catch { return null; }
  const p = url.pathname;
  const route = url.hash.replace(/^#\/?/, "").split(/[/?]/)[0];
  if (p === "/" || /^\/(legal|learn|ideas|notes)\//.test(p)) return "home";
  if (/^\/(login|signup|reset|verify)\//.test(p)) return null;
  if (p.startsWith("/v/")) return "verify";
  if (p.startsWith("/app/")) {
    if (route === "verify") return "verify";
    if (route === "settings") return "account";
    return "app";
  }
  const hit = sections.find((s) => s.path !== "/" && !s.path.includes("#") && p.startsWith(s.path));
  return hit ? hit.id : null;
}

/** The sections whose pages are in this build, numbered for the Go menu. */
function visibleSections(sections, root) {
  let n = 0;
  return sections
    .filter((s) => !s.needs || fs.existsSync(path.join(root, s.needs)))
    .map((s) => ({ ...s, key: s.bottom ? "," : n < 9 ? String(++n) : null }));
}

/**
 * What to answer for a request to app://parity<pathname>, given the bundled site's folder:
 *   { file }      a file inside the bundle
 *   { redirect }  a short link or a folder without its slash, sent on
 *   { proxy }     not bundled: fetch it from the website (data, badges, share images)
 *   { missing }   nothing to show
 * Never returns a file outside `root`.
 */
function resolveRequest(root, pathname) {
  let p;
  try { p = decodeURIComponent(pathname); } catch { return { missing: true }; }
  if (p.includes("\0")) return { missing: true };
  if (/^\/(data|local|badge|og)\//.test(p) || p === "/stats.json") return { proxy: true };
  const full = path.normalize(path.join(root, p));
  if (full !== root && !full.startsWith(root + path.sep)) return { missing: true };
  const isFile = (f) => { try { return fs.statSync(f).isFile(); } catch { return false; } };
  if (isFile(full)) return { file: full };
  if (isFile(path.join(full, "index.html"))) {
    if (!p.endsWith("/")) return { redirect: `${p}/` };
    return { file: path.join(full, "index.html") };
  }
  // Every Verify badge is one page that reads its id from the address (REF-0016).
  if (/^\/v\/[A-Za-z0-9]{12}\/?$/.test(p)) return { file: path.join(root, "v", "index.html") };
  const short = expandShortLink(p);
  if (short !== p) return { redirect: short };
  if (path.extname(p)) return { proxy: true };
  return { missing: true };
}

module.exports = { APP_ORIGIN, siteHosts, trustedOrigins, isTrusted, liveUrl, expandShortLink, toAppPath, activeSection, visibleSections, resolveRequest };
