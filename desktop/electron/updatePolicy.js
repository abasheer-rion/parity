// When a downloaded update of the app asks to restart (DEC-0086). Plain logic with tests.
//
// The release workflow writes the release's kind into the update file's releaseName: "pages"
// when only the offline copy of the site changed, "app" when the app itself changed. Pages
// load live and offer their own reload, so a pages-only update installs quietly when Parity
// quits. An app change offers "Restart to update" once per version. Checking by hand
// (Parity, Check for updates) always says what it found.

/** True for a release that only refreshes the offline copy of the site. Unknown counts as an app change. */
function isPagesOnly(info) {
  return typeof info?.releaseName === "string" && info.releaseName.trim().toLowerCase() === "pages";
}

/** Whether a downloaded update asks to restart now. */
function shouldPrompt(info, { byHand = false, alreadyOffered = false } = {}) {
  if (byHand) return true;
  if (isPagesOnly(info)) return false;
  return !alreadyOffered;
}

module.exports = { isPagesOnly, shouldPrompt };
