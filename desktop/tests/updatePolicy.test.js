// Update prompts (DEC-0086): a pages-only release installs at quit without asking, an app
// change asks once per version, and checking by hand always answers. Run: npm test
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { isPagesOnly, shouldPrompt } = require("../electron/updatePolicy");

test("reads the release kind from the update file", () => {
  assert.equal(isPagesOnly({ releaseName: "pages" }), true);
  assert.equal(isPagesOnly({ releaseName: " Pages " }), true);
  assert.equal(isPagesOnly({ releaseName: "app" }), false);
  assert.equal(isPagesOnly({ releaseName: null }), false);
  assert.equal(isPagesOnly({}), false, "an older release without a kind counts as an app change");
  assert.equal(isPagesOnly(undefined), false);
});

test("asks to restart only for an app change, once per version", () => {
  assert.equal(shouldPrompt({ releaseName: "pages" }), false);
  assert.equal(shouldPrompt({ releaseName: "app" }), true);
  assert.equal(shouldPrompt({ releaseName: "app" }, { alreadyOffered: true }), false);
  assert.equal(shouldPrompt({}), true);
});

test("checking by hand always answers", () => {
  assert.equal(shouldPrompt({ releaseName: "pages" }, { byHand: true }), true);
  assert.equal(shouldPrompt({ releaseName: "app" }, { byHand: true, alreadyOffered: true }), true);
});
