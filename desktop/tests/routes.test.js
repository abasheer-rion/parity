// Where addresses go inside the desktop app (DEC-0041). Run: npm test
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { toAppPath, activeSection, visibleSections, resolveRequest, liveUrl, isTrusted, trustedOrigins, LEGACY_DOMAINS } = require("../electron/routes");
const sections = require("../electron/sections");

const O = "https://paritytrading.app";

test("parity:// links open the matching page", () => {
  assert.equal(toAppPath("parity://s/fx_carry", O), "/app/#/strategy/fx_carry");
  assert.equal(toAppPath("parity://v/AbCdEfGhIjKl", O), "/v/AbCdEfGhIjKl");
  assert.equal(toAppPath("parity://trade/#/chart?s=fx.EUR", O), "/trade/#/chart?s=fx.EUR");
  assert.equal(toAppPath("parity://trade", O), "/trade/");
  assert.equal(toAppPath("parity://sim/macro", O), "/sim/#/macro");
  assert.equal(toAppPath("parity://sim/scenario?type=oil&r=2", O), "/sim/#/scenario?type=oil&r=2");
  assert.equal(toAppPath("parity://app/#/verify", O), "/app/#/verify");
  assert.equal(toAppPath("parity:///research/", O), "/research/");
  assert.equal(toAppPath("parity://login/?code=abc&next=%2Ftrade%2F", O), "/login/?code=abc&next=%2Ftrade%2F");
  assert.equal(toAppPath(`parity://open?url=${encodeURIComponent("https://trade.paritytrading.app/#/alerts")}`, O), "/trade/#/alerts");
});

test("the website's three addresses stay in the app", () => {
  assert.equal(toAppPath("https://paritytrading.app/", O), "/");
  assert.equal(toAppPath("https://paritytrading.app/app/#/strategies", O), "/app/#/strategies");
  assert.equal(toAppPath("https://paritytrading.app/s/fx_carry", O), "/app/#/strategy/fx_carry");
  assert.equal(toAppPath("https://sim.paritytrading.app/", O), "/sim/");
  assert.equal(toAppPath("https://sim.paritytrading.app/#/fx", O), "/sim/#/fx");
  assert.equal(toAppPath("https://trade.paritytrading.app/#/alerts", O), "/trade/#/alerts");
  assert.equal(toAppPath("https://academy.paritytrading.app/#/luck-vs-skill/noise", O), "/academy/#/luck-vs-skill/noise");
  assert.equal(toAppPath("https://lab.paritytrading.app/#/search?q=carry", O), "/lab/#/search?q=carry");
  assert.equal(toAppPath("https://trade.paritytrading.app/login/?next=x", O), "/login/?next=x");
});

test("other addresses open in the browser", () => {
  for (const u of ["https://evil.example/", "http://paritytrading.app/", "https://paritytrading.app:8443/", "https://user@paritytrading.app/", "javascript:alert(1)", "file:///etc/passwd", "//evil.example/x", "", null]) {
    assert.equal(toAppPath(u, O), null, String(u));
  }
});

test("the sidebar follows the page", () => {
  assert.equal(activeSection("app://parity/", sections), "home");
  assert.equal(activeSection("app://parity/legal/risk/", sections), "home");
  assert.equal(activeSection("app://parity/app/#/verify", sections), "verify");
  assert.equal(activeSection("app://parity/v/AbCdEfGhIjKl", sections), "verify");
  assert.equal(activeSection("app://parity/app/#/strategies", sections), "app");
  assert.equal(activeSection("app://parity/app/#/settings/account", sections), "account");
  assert.equal(activeSection("app://parity/research/#/docs", sections), "research");
  assert.equal(activeSection("app://parity/sim/#/fx", sections), "sim");
  assert.equal(activeSection("app://parity/trade/", sections), "trade");
  assert.equal(activeSection("app://parity/login/?next=%2Ftrade%2F", sections), null);
});

function site() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "parity-site-"));
  for (const f of ["index.html", "app/index.html", "trade/index.html", "v/index.html", "assets/a.js"]) {
    fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true });
    fs.writeFileSync(path.join(root, f), f);
  }
  return root;
}

test("sections that need a page show only when it is built", () => {
  const root = site();
  const ids = visibleSections(sections, root).map((s) => s.id);
  assert.ok(!ids.includes("academy") && !ids.includes("lab"));
  fs.mkdirSync(path.join(root, "academy"));
  fs.writeFileSync(path.join(root, "academy/index.html"), "");
  const vis = visibleSections(sections, root);
  assert.ok(vis.some((s) => s.id === "academy"));
  assert.deepEqual(vis.filter((s) => !s.bottom).map((s) => s.key), ["1", "2", "3", "4", "5", "6", "7"]);
  assert.equal(vis.find((s) => s.id === "account").key, ",");
});

test("requests resolve to bundled files, short links, the website or nothing", () => {
  const root = site();
  assert.deepEqual(resolveRequest(root, "/"), { file: path.join(root, "index.html") });
  assert.deepEqual(resolveRequest(root, "/trade/"), { file: path.join(root, "trade/index.html") });
  assert.deepEqual(resolveRequest(root, "/trade"), { redirect: "/trade/" });
  assert.deepEqual(resolveRequest(root, "/assets/a.js"), { file: path.join(root, "assets/a.js") });
  assert.deepEqual(resolveRequest(root, "/v/AbCdEfGhIjKl"), { file: path.join(root, "v/index.html") });
  assert.deepEqual(resolveRequest(root, "/s/fx_carry"), { redirect: "/app/#/strategy/fx_carry" });
  assert.deepEqual(resolveRequest(root, "/data/latest.json"), { proxy: true });
  assert.deepEqual(resolveRequest(root, "/stats.json"), { proxy: true });
  assert.deepEqual(resolveRequest(root, "/badge/AbCdEfGhIjKl.svg"), { proxy: true });
  assert.deepEqual(resolveRequest(root, "/nope"), { missing: true });
});

test("requests never leave the bundle", () => {
  const root = site();
  for (const p of ["/../../etc/passwd", "/%2e%2e/%2e%2e/etc/passwd", "/..%2f..%2fetc/passwd", "/%00", "/%E0%A4%A"]) {
    const r = resolveRequest(root, p);
    assert.ok(!r.file || r.file.startsWith(root + path.sep), p);
    assert.ok(!r.proxy || path.extname(p), p);
  }
});

test("online, every path opens on the live site", () => {
  assert.equal(liveUrl("/", O), "https://paritytrading.app/");
  assert.equal(liveUrl("/app/#/verify", O), "https://paritytrading.app/app/#/verify");
  assert.equal(liveUrl("/research/", O), "https://paritytrading.app/research/");
  assert.equal(liveUrl("/login/?next=%2Ftrade%2F", O), "https://paritytrading.app/login/?next=%2Ftrade%2F");
  assert.equal(liveUrl("/sim/", O), "https://sim.paritytrading.app/");
  assert.equal(liveUrl("/sim/#/macro", O), "https://sim.paritytrading.app/#/macro");
  assert.equal(liveUrl("/trade/#/chart?s=fx.EUR", O), "https://trade.paritytrading.app/#/chart?s=fx.EUR");
  assert.equal(liveUrl("/trade", O), "https://trade.paritytrading.app/");
  assert.equal(liveUrl("/academy/", O), "https://academy.paritytrading.app/");
  assert.equal(liveUrl("/lab/#/search?q=carry", O), "https://lab.paritytrading.app/#/search?q=carry");
  assert.equal(liveUrl("/v/AbCdEfGhIjKl", O), "https://paritytrading.app/v/AbCdEfGhIjKl");
  assert.equal(liveUrl("/legal/risk/", `${O}/`), "https://paritytrading.app/legal/risk/");
});

test("a live address and its in-app path map onto each other", () => {
  for (const p of ["/", "/app/#/verify", "/sim/#/fx", "/trade/#/alerts", "/academy/", "/lab/", "/research/#/docs", "/v/AbCdEfGhIjKl"]) {
    assert.equal(toAppPath(liveUrl(p, O), O), p, p);
  }
});

test("links on the old endyland.com addresses still open inside the app (DEC-0069)", () => {
  assert.equal(toAppPath("https://parity.endyland.com/s/fx_carry", O), "/app/#/strategy/fx_carry");
  assert.equal(toAppPath("https://sim.endyland.com/#/fx", O), "/sim/#/fx");
  assert.equal(toAppPath("https://trade.endyland.com/#/alerts", O), "/trade/#/alerts");
  assert.equal(toAppPath("https://www.paritytrading.app/legal/risk/", O), "/legal/risk/");
  assert.equal(toAppPath("https://endyland.com/", O), null);
  // New pages always open on the new domain.
  assert.equal(liveUrl("/sim/", O), "https://sim.paritytrading.app/");
});

test("the old domains match site.json's legacy list", () => {
  const site = JSON.parse(fs.readFileSync(path.join(__dirname, "../../web/src/lib/site.json"), "utf8"));
  assert.deepEqual(LEGACY_DOMAINS, site.legacy.map(({ domain, main }) => ({ domain, main })));
  assert.equal(site.origin, O);
});

test("only the bundled copy and the website's addresses are trusted", () => {
  assert.deepEqual(trustedOrigins(O).sort(), ["app://parity", "https://paritytrading.app", "https://www.paritytrading.app", "https://sim.paritytrading.app", "https://trade.paritytrading.app", "https://academy.paritytrading.app", "https://lab.paritytrading.app",
    "https://parity.endyland.com", "https://sim.endyland.com", "https://trade.endyland.com", "https://academy.endyland.com", "https://lab.endyland.com"].sort());
  for (const u of ["app://parity/", "app://parity/trade/", "https://paritytrading.app/app/", "https://SIM.paritytrading.app/#/fx", "https://trade.paritytrading.app/login/?next=x", "https://lab.paritytrading.app/"]) {
    assert.ok(isTrusted(u, O), u);
  }
  for (const u of ["app://other/", "http://paritytrading.app/", "https://paritytrading.app:8443/", "https://user@paritytrading.app/", "https://evil.paritytrading.app/", "https://paritytrading.app.evil.example/", "https://endyland.com/", "https://movie.endyland.com/", "https://evil.endyland.com/", "https://accounts.google.com/", "javascript:alert(1)", "file:///etc/passwd", "", "not a url"]) {
    assert.ok(!isTrusted(u, O), u);
  }
});
