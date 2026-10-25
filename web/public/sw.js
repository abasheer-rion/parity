// Parity's service worker (DEC-0041). It keeps the app shell, so the installed site opens
// like an app and the pages you have opened still load on a bad network.
//
//   Pages      network first; the last good copy if the network fails; /offline.html if
//              there is no copy.
//   Assets     built files have a hash in their name, so a cached copy is always right:
//              cache first.
//   Never      research data (/data/), dev files (/local/), share images, badges and
//              anything on another address. Sign-in redirects and errors are never kept.
//
// Parity Terminal keeps its own worker at /sim/sw.js (DEC-0023); the browser lets the
// closer scope win, so the two never answer the same page.
const VERSION = "v1";
const CACHE = `parity-shell-${VERSION}`;
const OFFLINE = "/offline.html";
const PRECACHE = [OFFLINE, "/icon-192.png", "/favicon.svg"];

const NEVER = /^\/(data|local|og|badge|s|cdn-cgi)\//;
const ASSETS = /^\/((app|sim|trade)\/)?assets\//;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("parity-shell-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/** Only keep real, same-origin answers: never a redirect to sign-in or an error page. */
function keep(req, res) {
  if (res.ok && res.type === "basic" && !res.redirected) {
    const copy = res.clone();
    caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
  }
  return res;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || NEVER.test(url.pathname)) return;

  if (req.mode === "navigate") {
    // The hash never reaches the server, so one copy per page path is enough.
    const key = new Request(url.origin + url.pathname + url.search);
    event.respondWith(
      fetch(req)
        .then((res) => keep(key, res))
        .catch(() => caches.match(key).then((hit) => hit || caches.match(OFFLINE)).then((hit) => hit || Response.error())),
    );
    return;
  }

  if (ASSETS.test(url.pathname)) {
    event.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => keep(req, res))));
  }
});
