// The Help menu's links to the public update pages (DEC-0073): changelog, announcements and
// status, and their RSS feeds. Plain data, no Electron, so `npm test` can check it. main.js
// opens each in the default browser with shell.openExternal.

const UPDATES = [
  ["Changelog", "/changelog/"],
  ["Announcements", "/announcements/"],
  ["Status", "/status/"],
];

/** [{ label, url }] on the site's origin (src/lib/site.json, through desktop.json). */
function updateLinks(origin) {
  const base = new URL(origin).origin;
  return [
    ...UPDATES.map(([label, path]) => ({ label, url: `${base}${path}` })),
    ...UPDATES.map(([label, path]) => ({ label: `${label} RSS feed`, url: `${base}${path}feed.xml` })),
  ];
}

/** The menu label for opening the site itself, named by its host. */
function siteLabel(origin) {
  return `Open ${new URL(origin).host} in the browser`;
}

module.exports = { updateLinks, siteLabel };
