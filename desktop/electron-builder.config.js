// How electron-builder packages Parity (DEC-0041, DEC-0049).
//
// Signing is decided by what the environment holds, so the same file builds both ways:
//
//   CSC_LINK and CSC_KEY_PASSWORD set   the Mac app is signed with that Developer ID
//                                       Application certificate, with the hardened runtime.
//   APPLE_API_KEY, APPLE_API_KEY_ID and APPLE_API_ISSUER also set
//                                       it is notarized with that App Store Connect API key
//                                       (APPLE_API_KEY is the path to the .p8 file). The
//                                       release workflow writes the file from its secret.
//   none of them                        an ad hoc signed, unnotarized build, as before. It
//                                       cannot update itself on a Mac (updater.js says why).
//
// Windows builds are unsigned unless WIN_CSC_LINK is set; electron-updater installs unsigned
// NSIS updates. A signed and notarized Mac build gets "parity": { "signed": true } in its
// package.json, which the updater reads.
const signMac = !!process.env.CSC_LINK;
const notarize = signMac && !!(process.env.APPLE_API_KEY && process.env.APPLE_API_KEY_ID && process.env.APPLE_API_ISSUER);

module.exports = {
  appId: "ai.paritytrading.desktop",
  productName: "Parity",
  copyright: "Copyright 2026 Parity Trading, Inc.",
  directories: { output: "dist", buildResources: "assets" },
  files: ["electron/**/*", "assets/icon.png", "assets/tray*.png", "package.json", "!**/*.map"],
  extraResources: [{ from: "build/web", to: "web", filter: ["**/*", "!**/*.map"] }],
  extraMetadata: { parity: { signed: signMac && notarize } },
  protocols: [{ name: "Parity link", schemes: ["parity"] }],
  // The public update feed (web/src/lib/desktopFeed.ts). The release workflow attaches the
  // files to a GitHub release; publishing that release is what ships it.
  publish: [{ provider: "generic", url: "https://parity.endyland.com/desktop/updates/" }],
  mac: {
    category: "public.app-category.finance",
    icon: "assets/icon.icns",
    ...(signMac
      ? { hardenedRuntime: true, gatekeeperAssess: false, entitlements: "build-resources/entitlements.mac.plist", entitlementsInherit: "build-resources/entitlements.mac.plist", notarize }
      : { identity: "-", hardenedRuntime: false, gatekeeperAssess: false, notarize: false }),
    darkModeSupport: true,
    minimumSystemVersion: "11.0",
    // The zip is what the updater downloads; the disk image is for a first install.
    target: [
      { target: "dmg", arch: ["arm64", "x64"] },
      { target: "zip", arch: ["arm64", "x64"] },
    ],
  },
  dmg: {
    title: "Parity ${version}",
    iconSize: 100,
    contents: [{ x: 130, y: 200 }, { x: 410, y: 200, type: "link", path: "/Applications" }],
    window: { width: 540, height: 380 },
    artifactName: "Parity-${version}-${arch}.dmg",
  },
  zip: { artifactName: "Parity-${version}-${arch}-mac.zip" },
  win: {
    icon: "assets/icon.ico",
    target: [{ target: "nsis", arch: ["x64"] }],
  },
  nsis: {
    // No spaces: the name must match latest.yml and the release asset exactly.
    artifactName: "Parity-Setup-${version}.exe",
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    installerIcon: "assets/icon.ico",
    uninstallerIcon: "assets/icon.ico",
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: "Parity",
  },
};
