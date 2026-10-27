// The Help menu's update links (DEC-0073). Run: npm test
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { updateLinks, siteLabel } = require("../electron/help");

test("the update pages and feeds sit on the site's own origin", () => {
  const links = updateLinks("https://paritytrading.app/");
  assert.deepEqual(links.map((l) => l.label), ["Changelog", "Announcements", "Status", "Changelog RSS feed", "Announcements RSS feed", "Status RSS feed"]);
  assert.equal(links[0].url, "https://paritytrading.app/changelog/");
  assert.equal(links[5].url, "https://paritytrading.app/status/feed.xml");
  for (const l of links) assert.match(l.url, /^https:\/\/paritytrading\.app\//);
});

test("the site link names whichever host the app uses", () => {
  assert.equal(siteLabel("https://paritytrading.app"), "Open paritytrading.app in the browser");
});
