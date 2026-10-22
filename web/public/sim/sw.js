// Parity Terminal's service worker (DEC-0023): keeps the app shell so the terminal opens
// like an installed app and survives a flaky network. Network first, the cache only as a
// fallback. It never touches market data (/data/, /local/) or anything outside /sim/.
const VERSION = "v1";
const CACHE = `parity-terminal-shell-${VERSION}`;
const SHELL = "/sim/";

self.addEventListener("install", () => { self.skipWaiting(); });

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("parity-terminal-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/data/") || url.pathname.startsWith("/local/")) return;
  const nav = req.mode === "navigate" && url.pathname.startsWith("/sim/");
  const asset = url.pathname.startsWith("/sim/assets/");
  if (!nav && !asset) return;
  const key = nav ? SHELL : req;
  event.respondWith(
    fetch(req)
      .then((res) => {
        // Only keep real, same-origin answers: never a redirect to sign-in or an error page.
        if (res.ok && res.type === "basic" && !res.redirected) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(key, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(key).then((hit) => hit || Response.error())),
  );
});
