// The desktop shell's plain parts (DEC-0049): shortcuts, settings, saved windows and the
// helpers for Open link and Copy link. Run: npm test
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { actionFor } = require("../electron/shortcuts");
const settings = require("../electron/settings");
const workspace = require("../electron/workspace");
const { parseOpenInput, shareUrl, isAuthPath } = require("../electron/routes");

const O = "https://parity.endyland.com";
const key = (code, mods = {}) => ({ type: "keyDown", code, meta: false, control: false, alt: false, shift: false, ...mods });

test("shortcuts use Cmd on a Mac and Ctrl on Windows", () => {
  assert.equal(actionFor(key("KeyK", { meta: true }), "darwin"), "palette");
  assert.equal(actionFor(key("KeyK", { control: true }), "win32"), "palette");
  assert.equal(actionFor(key("KeyK", { control: true }), "darwin"), null);
  assert.equal(actionFor(key("Digit6", { meta: true }), "darwin"), "section:6");
  assert.equal(actionFor(key("Digit0", { meta: true }), "darwin"), "zoom-reset");
  assert.equal(actionFor(key("KeyL", { meta: true }), "darwin"), "link");
  assert.equal(actionFor(key("KeyC", { meta: true, shift: true }), "darwin"), "copy-link");
  assert.equal(actionFor(key("KeyC", { meta: true }), "darwin"), null, "plain copy stays with the page");
  assert.equal(actionFor(key("BracketLeft", { meta: true }), "darwin"), "back");
  assert.equal(actionFor(key("ArrowLeft", { alt: true }), "win32"), "back");
  assert.equal(actionFor(key("ArrowLeft", { alt: true }), "darwin"), null, "Alt Left moves by word on a Mac");
  assert.equal(actionFor(key("KeyT", { meta: true, alt: true }), "darwin"), "on-top");
  assert.equal(actionFor(key("KeyF", { meta: true, control: true }), "darwin"), "fullscreen");
  assert.equal(actionFor(key("KeyF", { meta: true, shift: true }), "darwin"), "focus");
  assert.equal(actionFor({ ...key("KeyK", { meta: true }), type: "keyUp" }, "darwin"), null);
  assert.equal(actionFor(key("KeyA"), "darwin"), null);
});

test("settings keep only known values of the right type", () => {
  const s = settings.clean({ tray: false, ticker: "yes", keepRunning: true, globalShortcut: "Alt+Shift+P", extra: 1 });
  assert.equal(s.tray, false);
  assert.equal(s.ticker, true);
  assert.equal(s.keepRunning, true);
  assert.equal(s.globalShortcut, "Alt+Shift+P");
  assert.equal("extra" in s, false);
  assert.equal(settings.clean({ globalShortcut: "P" }).globalShortcut, "", "a key needs a modifier");
  assert.equal(settings.clean({ globalShortcut: "Alt+Alt+P" }).globalShortcut, "");
  assert.equal(settings.clean(null).keepRunning, false, "keep running is opt-in");
  assert.equal(settings.clean(null).globalShortcut, "", "the global key is off by default");
  assert.ok(settings.validAccelerator("CommandOrControl+Shift+F9"));
  assert.ok(!settings.validAccelerator("Shift+Hello"));
});

test("settings survive a save and a load", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "parity-settings-"));
  settings.save(dir, { ...settings.DEFAULTS, ticker: false });
  assert.equal(settings.load(dir).ticker, false);
});

test("saved windows are made safe", () => {
  const displays = [{ workArea: { x: 0, y: 0, width: 1920, height: 1080 } }];
  const w = workspace.cleanWindow({ x: 100, y: 80, width: 99999, height: 10, path: "//evil.example", onTop: "yes" }, displays);
  assert.equal(w.width, 6000);
  assert.equal(w.height, 360);
  assert.equal(w.path, "/");
  assert.equal(w.onTop, false);
  assert.equal(w.x, 100);
  const off = workspace.cleanWindow({ x: 5000, y: 5000, width: 800, height: 600, path: "/trade/" }, displays);
  assert.equal(off.x, undefined, "a window on an unplugged screen opens centred");
  assert.equal(off.path, "/trade/");
});

test("recent pages are newest first, once each, at most 12", () => {
  let list = [];
  for (let i = 0; i < 20; i++) list = workspace.pushRecent(list, { path: `/p${i}/`, title: `Page ${i}` });
  list = workspace.pushRecent(list, { path: "/p10/", title: "Page 10" });
  assert.equal(list.length, workspace.MAX_RECENT);
  assert.equal(list[0].path, "/p10/");
  assert.equal(list.filter((r) => r.path === "/p10/").length, 1);
});

test("state reads the 0.1.x window file once and keeps workspaces", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "parity-state-"));
  fs.writeFileSync(path.join(dir, "window-state.json"), JSON.stringify({ width: 1200, height: 800, lastPath: "/research/" }));
  const old = workspace.load(dir, []);
  assert.equal(old.windows[0].path, "/research/");
  workspace.save(dir, { ...old, workspaces: { "Morning trading": [{ path: "/trade/", width: 1000, height: 700 }], "": [{}] } });
  const again = workspace.load(dir, []);
  assert.deepEqual(Object.keys(again.workspaces), ["Morning trading"]);
  assert.equal(again.workspaces["Morning trading"][0].path, "/trade/");
});

test("Open link accepts Parity addresses in every form and nothing else", () => {
  assert.equal(parseOpenInput("https://parity.endyland.com/s/fx_carry", O), "/app/#/strategy/fx_carry");
  assert.equal(parseOpenInput("parity.endyland.com/s/fx_carry", O), "/app/#/strategy/fx_carry");
  assert.equal(parseOpenInput("http://trade.endyland.com/#/alerts", O), "/trade/#/alerts");
  assert.equal(parseOpenInput("/s/fx_carry", O), "/app/#/strategy/fx_carry");
  assert.equal(parseOpenInput("v/AbCdEfGhIjKl", O), "/v/AbCdEfGhIjKl");
  assert.equal(parseOpenInput("parity://trade/#/chart?s=fx.EUR", O), "/trade/#/chart?s=fx.EUR");
  assert.equal(parseOpenInput("  https://sim.endyland.com/#/fx  ", O), "/sim/#/fx");
  for (const bad of ["evil.example/x", "https://evil.example/", "javascript:alert(1)", "hello world", "", null]) {
    assert.equal(parseOpenInput(bad, O), null, String(bad));
  }
});

test("Copy link gives the shareable address", () => {
  assert.equal(shareUrl("/app/#/strategy/fx_carry", O), "https://parity.endyland.com/s/fx_carry");
  assert.equal(shareUrl("/trade/#/chart?s=fx.EUR&tf=D", O), "https://trade.endyland.com/#/chart?s=fx.EUR&tf=D");
  assert.equal(shareUrl("/research/#/docs", O), "https://parity.endyland.com/research/#/docs");
});

test("the sign-in pages are recognised for the log-in wall", () => {
  for (const p of ["/login/", "/login/?next=%2Ftrade%2F", "/signup/", "/reset/", "/verify/?code=1"]) assert.ok(isAuthPath(p), p);
  for (const p of ["/", "/app/", "/loginx/", "/legal/privacy/", null]) assert.ok(!isAuthPath(p), String(p));
});

test("the build signs and notarizes only when the secrets exist", () => {
  const load = (env) => {
    const keep = { ...process.env };
    for (const k of ["CSC_LINK", "APPLE_API_KEY", "APPLE_API_KEY_ID", "APPLE_API_ISSUER"]) delete process.env[k];
    Object.assign(process.env, env);
    delete require.cache[require.resolve("../electron-builder.config.js")];
    try { return require("../electron-builder.config.js"); } finally { process.env = keep; }
  };
  const plain = load({});
  assert.equal(plain.mac.identity, "-");
  assert.equal(plain.mac.notarize, false);
  assert.equal(plain.extraMetadata.parity.signed, false);
  const signedOnly = load({ CSC_LINK: "x" });
  assert.equal(signedOnly.mac.hardenedRuntime, true);
  assert.equal(signedOnly.mac.notarize, false);
  assert.equal(signedOnly.extraMetadata.parity.signed, false, "signed but not notarized cannot update itself");
  const full = load({ CSC_LINK: "x", APPLE_API_KEY: "/tmp/k.p8", APPLE_API_KEY_ID: "id", APPLE_API_ISSUER: "iss" });
  assert.equal(full.mac.notarize, true);
  assert.equal(full.mac.identity, undefined);
  assert.equal(full.extraMetadata.parity.signed, true);
  assert.equal(full.publish[0].url, "https://parity.endyland.com/desktop/updates/");
  assert.ok(!/\s/.test(full.nsis.artifactName), "the Windows installer name has no spaces");
});
