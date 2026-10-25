// The main process's last line of defence (electron/guard.js, DEC-0058): an error nobody
// caught is logged and shown once in plain words, never Electron's raw box and a quit.
const test = require("node:test");
const assert = require("node:assert");
const { EventEmitter } = require("node:events");
const { install, message } = require("../electron/guard");
const { scrub } = require("../electron/logfile");

function setup(response = 1) {
  const proc = new EventEmitter();
  const logs = [];
  const asked = [];
  let reloads = 0;
  let t = 0;
  install({ proc, log: (m) => logs.push(m), ask: async (o) => { asked.push(o); return { response }; }, reload: () => { reloads++; }, now: () => t });
  return { proc, logs, asked, reloads: () => reloads, tick: (ms) => { t += ms; } };
}
const settle = () => new Promise((r) => setTimeout(r, 10));

test("an uncaught error is logged and shown once in plain words, and the app keeps running", async () => {
  const s = setup();
  s.proc.emit("uncaughtException", new TypeError("Object has been destroyed"));
  await settle();
  assert.match(s.logs[0], /uncaught error: TypeError: Object has been destroyed/);
  assert.strictEqual(s.asked.length, 1);
  assert.strictEqual(s.asked[0].message, "Something went wrong in Parity");
  assert.deepStrictEqual(s.asked[0].buttons, ["Reload pages", "OK"]);
  assert.doesNotMatch(s.asked[0].message + s.asked[0].detail, /JavaScript error/);
});

test("the same error within a minute is logged but not shown again", async () => {
  const s = setup();
  s.proc.emit("uncaughtException", new Error("boom"));
  await settle();
  s.tick(10_000);
  s.proc.emit("uncaughtException", new Error("boom"));
  await settle();
  assert.strictEqual(s.logs.length, 2);
  assert.strictEqual(s.asked.length, 1);
  s.tick(61_000);
  s.proc.emit("uncaughtException", new Error("boom"));
  await settle();
  assert.strictEqual(s.asked.length, 2);
});

test("Reload pages reloads every window", async () => {
  const s = setup(0);
  s.proc.emit("uncaughtException", new Error("x"));
  await settle();
  assert.strictEqual(s.reloads(), 1);
});

test("a stray promise is only logged", async () => {
  const s = setup();
  s.proc.emit("unhandledRejection", new Error("late"));
  await settle();
  assert.match(s.logs[0], /unhandled promise: Error: late/);
  assert.strictEqual(s.asked.length, 0);
});

test("the message keeps only the first line of the error", () => {
  const m = message(new Error("first line\nsecond"));
  assert.match(m.detail, /Error: first line/);
  assert.doesNotMatch(m.detail, /second/);
});

test("the log never keeps a token", () => {
  const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.c2lnbmF0dXJlc2lnbmF0dXJl";
  assert.doesNotMatch(scrub(`loaded https://x/?token=abc ${jwt}`), /eyJ|abc/);
});
