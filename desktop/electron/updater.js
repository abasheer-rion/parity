// Auto-update, written but off (DEC-0041). An unsigned Mac app cannot update itself, and
// a Windows installer that is not signed trips SmartScreen on every update, so until the
// owner signs the builds a new version is a new download from the GitHub release. Pages
// load live (DEC-0048), so only changes to the app itself need one. There is no "new
// version" check either: the repository is private, so its releases need a login to read.
//
// To turn it on later: sign both builds, then set ENABLED to true (or start the app with
// PARITY_AUTO_UPDATE=on to try it). It reads the "publish" block in package.json, which
// points at this repository's releases.
const ENABLED = false;

function start(app, log = () => {}) {
  if (!(ENABLED || process.env.PARITY_AUTO_UPDATE === "on") || !app.isPackaged) return false;
  try {
    const { autoUpdater } = require("electron-updater");
    autoUpdater.autoDownload = false;
    autoUpdater.on("error", (e) => log(`update check failed: ${e.message}`));
    autoUpdater.checkForUpdatesAndNotify().catch((e) => log(`update check failed: ${e.message}`));
    return true;
  } catch (e) {
    log(`updater not available: ${e.message}`);
    return false;
  }
}

module.exports = { start, ENABLED };
