// New versions of the app itself (DEC-0049). Pages load live, so this is only for changes to
// the app around them.
//
// The feed is public: https://parity.endyland.com/desktop/updates/, which serves the newest
// published desktop release (web/src/lib/desktopFeed.ts). The app checks 15 seconds after
// launch and every 6 hours while Settings allows it, and from "Check for updates" at any time.
//
//   Windows          downloads in the background, then asks to restart.
//   Mac, signed      the same. A Mac app can only replace itself when it is signed with a
//                    Developer ID and notarized; the release build marks such builds.
//   Mac, not signed  asks to download the new disk image in the browser instead.
const { app, dialog, shell } = require("electron");

const FEED = (process.env.PARITY_UPDATE_URL || "https://parity.endyland.com/desktop/updates/").replace(/\/?$/, "/");
const EVERY = 6 * 60 * 60 * 1000;

/** True when the release build signed and notarized this copy (electron-builder.config.js sets it). */
function isSigned() {
  try { return require("../package.json").parity?.signed === true; } catch { return false; }
}

function create({ log = () => {}, enabled = () => true, parentWindow = () => null } = {}) {
  const canInstall = process.platform !== "darwin" || isSigned();
  let updater = null;
  let timer = null;
  let manual = false;
  let offered = null; // the version already offered this session
  let status = "Not checked yet";

  const ask = (opts) => {
    const parent = parentWindow();
    return parent ? dialog.showMessageBox(parent, opts) : dialog.showMessageBox(opts);
  };

  function load() {
    if (updater) return updater;
    if (!app.isPackaged && process.env.PARITY_UPDATE_DEV !== "1") return null;
    try {
      ({ autoUpdater: updater } = require("electron-updater"));
    } catch (e) {
      log(`updater not available: ${e.message}`);
      return null;
    }
    if (process.env.PARITY_UPDATE_DEV === "1") updater.forceDevUpdateConfig = true;
    updater.setFeedURL({ provider: "generic", url: FEED });
    updater.autoDownload = canInstall;
    updater.autoInstallOnAppQuit = canInstall;
    updater.logger = { info: (m) => log(`update: ${m}`), warn: (m) => log(`update: ${m}`), error: (m) => log(`update: ${m}`), debug: () => {} };
    updater.on("checking-for-update", () => { status = "Checking"; });
    updater.on("update-not-available", () => {
      status = `Up to date (${app.getVersion()})`;
      if (manual) ask({ type: "info", message: "Parity is up to date", detail: `Version ${app.getVersion()} is the newest.`, buttons: ["OK"] });
      manual = false;
    });
    updater.on("update-available", (info) => {
      status = `Version ${info.version} is available`;
      if (canInstall) { status = `Downloading version ${info.version}`; return; }
      if (offered === info.version && !manual) return;
      offered = info.version;
      manual = false;
      const files = (info.files || []).map((f) => f.url).filter((u) => typeof u === "string" && u.endsWith(".dmg"));
      // The disk image's name is fixed by electron-builder.config.js (Parity-<version>-<arch>.dmg).
      const dmg = files.find((u) => u.includes(`-${process.arch}.`)) || `Parity-${info.version}-${process.arch}.dmg`;
      ask({
        type: "info",
        message: `Parity ${info.version} is available`,
        detail: "This copy of Parity is not signed, so it cannot install updates by itself. Download the new version, open it and drag Parity into Applications.",
        buttons: ["Download", "Later"],
        defaultId: 0,
        cancelId: 1,
      }).then(({ response }) => { if (response === 0) shell.openExternal(new URL(dmg, FEED).toString()); });
    });
    updater.on("update-downloaded", (info) => {
      status = `Version ${info.version} is ready to install`;
      manual = false;
      ask({
        type: "info",
        message: `Parity ${info.version} is ready`,
        detail: "Restart Parity to use the new version. Your windows open where they were.",
        buttons: ["Restart now", "Later"],
        defaultId: 0,
        cancelId: 1,
      }).then(({ response }) => { if (response === 0) setImmediate(() => updater.quitAndInstall()); });
    });
    updater.on("error", (e) => {
      status = "Could not check for updates";
      log(`update check failed: ${e?.message || e}`);
      if (manual) ask({ type: "warning", message: "Could not check for updates", detail: "The update service did not answer. Try again later.", buttons: ["OK"] });
      manual = false;
    });
    return updater;
  }

  function check(byHand = false) {
    const u = load();
    if (!u) {
      if (byHand) ask({ type: "info", message: "Updates work in the installed app", detail: "This copy runs from source, so it does not check for updates.", buttons: ["OK"] });
      return;
    }
    manual = byHand;
    u.checkForUpdates().catch(() => { /* reported by the error event */ });
  }

  /** Starts or stops the automatic checks, following Settings. */
  function sync() {
    clearTimeout(timer);
    clearInterval(timer);
    timer = null;
    if (!enabled() || !(app.isPackaged || process.env.PARITY_UPDATE_DEV === "1")) return;
    timer = setTimeout(() => {
      check(false);
      timer = setInterval(() => check(false), EVERY);
    }, 15000);
  }

  return { check, sync, status: () => status, canInstall, feed: FEED };
}

module.exports = { create, isSigned, FEED };
