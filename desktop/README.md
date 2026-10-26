# Parity for Mac and Windows

The whole Parity site, loaded live so it always matches parity.endyland.com: the front page and Verify, the product app (Strategies), Research, Parity Terminal, Parity Trade, Academy and Workbench. Every page uses the whole window, under a slim bar with a menu button. Built with Electron and electron-builder ([DEC-0041](../docs/decisions/0041-parity-as-an-installable-site-and-a-desktop-app-for-mac-and-windows.md), [DEC-0048](../docs/decisions/0048-the-desktop-app-loads-the-live-site-and-keeps-a-copy-for-offline.md), [DEC-0049](../docs/decisions/0049-the-desktop-app-opens-on-the-log-in-page-with-a-menu-button-and-its-own-controls.md)). Research and education only. Not investment advice. Trading in the app uses a demo account with delayed data and no real money.

## Install

Download from the repository's Releases page: `Parity-<version>-arm64.dmg` for a Mac with Apple silicon (M1 or later), `Parity-<version>-x64.dmg` for an Intel Mac, `Parity-Setup-<version>.exe` for Windows.

Until the app is signed, each computer asks you to confirm the first time.

**Mac**

1. Open the `.dmg` and drag Parity into Applications.
2. In Applications, right-click Parity and choose Open, then Open again.
3. If the Mac only offers to move it to the Bin: open System Settings, then Privacy & Security, scroll down and click Open Anyway next to Parity.

**Windows**

1. Run `Parity-Setup-<version>.exe`.
2. If Windows shows "Windows protected your PC", click More info, then Run anyway.
3. Choose where to install it. It adds a Start menu and a desktop shortcut.

## Using it

- **Log in first.** Signed out, the app shows only the log-in page. After you log in it opens the last page you used, Home the first time, and the other windows you had open. You stay signed in when you quit.
- **The menu button** at the top left (right of the traffic lights on a Mac) opens the sections and Account. Pick one, press Escape or click outside to close it. Alt-click a section, or the arrow at the end of its row, to open it in a new window.
- **Move the window** by dragging the bar along the top. Double-click it to zoom (Mac) or maximise (Windows).
- **Shortcuts** (Cmd on a Mac, Ctrl on Windows):

  | Keys | What it does |
  | --- | --- |
  | Cmd 1 to 8 | Home, Verify, Strategies, Research, Terminal, Trade, Academy, Workbench |
  | Cmd K | Command palette: sections, recent pages, workspaces, commands, or paste a link |
  | Cmd L | Open a Parity link: an address on the site, `/s/...`, `/v/...` or `parity://...` |
  | Cmd [ and Cmd ] | Back and Forward (Alt Left and Alt Right on Windows) |
  | Cmd Shift C | Copy this page's link, using the short link where there is one |
  | Cmd N, Cmd Shift N | New window, this page in a new window |
  | Cmd Alt T | Keep this window on top of other apps |
  | Cmd Shift F | Focus mode: full screen with the bar hidden |
  | Cmd , | Settings |

  The mouse's back and forward buttons and a sideways swipe on a Mac trackpad also go back and forward. In Trade, the palette offers Trade's own search.
- **Windows and workspaces.** Every window comes back at launch with its page, size and place. Window, Save windows as workspace keeps a named set; open it from the Window menu or the palette.
- **Sections stay loaded** after you leave them, so going back is instant and shows the page as you left it.
- **The menu bar item** (the tray on Windows) has quick actions and your active Trade watchlist's prices.
- **Trade alerts** show as notifications. Turn on "Keep running when windows close" in Settings to get them with every window closed.
- **A key to show or hide Parity** from any app can be set in Settings. It is off until you set one.
- **Links.** `parity://` links open the app at a page, for example `parity://s/fx_carry`, `parity://trade/#/alerts` or `parity://sim/macro`. Links to parity.endyland.com and its sim., trade., academy. and lab. addresses stay in the app; other links open in your browser.
- **Offline,** the app shows the copy of the site it was built with, under a line that says "Offline, showing saved copy", and goes back to the live site when the connection returns.
- **Never a black window.** A page that stops drawing is drawn again; one that stays empty reloads once, then shows Could not open with Retry. Problems are noted in a small log: `~/Library/Logs/Parity/parity.log` on a Mac, `%APPDATA%\Parity\logs\parity.log` on Windows, with no passwords or sign-in tokens ([DEC-0058](../docs/decisions/0059-a-parity-page-is-never-black-it-shows-a-loading-screen-or-says-what-went-wrong.md)).
- **Privacy.** The app keeps the sign-in cookie, its settings, your windows and your recent pages on the computer. It shows no cookie notice. The [cookie policy](https://parity.endyland.com/legal/cookies/#desktop) has the details.

## Updates

Pages are always current. For the app itself, Parity checks `https://parity.endyland.com/desktop/updates/` 15 seconds after launch and every 6 hours (Settings can turn it off; Parity, Check for updates checks now). That feed serves the newest **published** desktop release, so a draft release reaches nobody until it is published.

- Windows: the update downloads in the background and Parity asks to restart.
- Mac, signed and notarized: the same.
- Mac, not signed (every build until the Apple secrets below exist): Parity says a new version is available and opens its disk image in the browser.

## Owner steps

These need the owner's accounts. Nothing here is created by the build.

**1. Turn on the update feed (one secret).**

1. On GitHub, Settings, Developer settings, Fine-grained tokens, Generate new token: resource owner `abasheer-rion`, only the repository `abasheer-rion/parity`, permission Contents: Read-only, an expiry you will remember.
2. In Cloudflare, Workers & Pages, `parity-research`, Settings, Variables and Secrets, Production: add a secret named `DESKTOP_RELEASES_TOKEN` with that token.
3. Redeploy the site (any merge to main does it). `https://parity.endyland.com/desktop/updates/latest-mac.yml` then answers with the newest published version; before that it answers 503.

**2. Sign and notarize the Mac app (five secrets).** With the Apple Developer account (another company's account works; its name shows as the developer):

1. Certificate: in the Apple Developer site, Certificates, add a **Developer ID Application** certificate (not Apple Development or Mac App Distribution). Only the account holder can create it. Make the request with Keychain Access, install the certificate, then export the certificate with its private key as a `.p12` file with a password.
2. API key: in App Store Connect, Users and Access, Integrations, App Store Connect API, Team Keys, generate a key with Developer access. Download `AuthKey_<KEYID>.p8` (it downloads once) and note the Key ID and the Issuer ID shown above the list.
3. In GitHub, `abasheer-rion/parity`, Settings, Secrets and variables, Actions, add:
   - `CSC_LINK`: the `.p12` file as base64 (`base64 -i cert.p12 | pbcopy`)
   - `CSC_KEY_PASSWORD`: the `.p12` password
   - `APPLE_API_KEY`: the whole text of the `.p8` file
   - `APPLE_API_KEY_ID`: the Key ID
   - `APPLE_API_ISSUER`: the Issuer ID
4. Run the release workflow. The Mac build is then signed with the hardened runtime and notarized, and marked so it installs its own updates. Copies installed before that still need one manual install of a signed version.

Windows builds stay unsigned; Windows installs their updates as they are. A Windows code signing certificate (`WIN_CSC_LINK`, `WIN_CSC_KEY_PASSWORD`) would remove the "Windows protected your PC" prompt.

## Building it

```bash
cd web && npm ci && cd ../desktop && npm ci
npm run web          # builds the site and copies it to build/web (no research data is copied)
npm start            # runs the app from source
npm test             # routing, shortcuts, settings, saved windows, links and signing config
npm run test:app     # the running app, windows hidden: log-in wall on a deep link, dragging, offline copy, Retry, menu, a page that closes itself
npm run build:mac    # dist/Parity-<version>-arm64.dmg, -x64.dmg, the update zips and latest-mac.yml
npm run build:win    # dist/Parity-Setup-<version>.exe and latest.yml, on Windows
```

On this Mac, prefix the Mac build with `DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer CSC_IDENTITY_AUTO_DISCOVERY=false`. `npm run icons` redraws the app and menu bar icons from the brand's starburst. `npm run shots` saves pictures of the windows to `~/Desktop/parity-app/shots/` by drawing each window's own views, so it needs no screen recording permission; `PARITY_SHOTS_STEPS` picks the steps (see `electron/shots.js`). `PARITY_LIVE_ORIGIN=https://10.255.255.1 npm start` points the app at an address that never answers, to see the offline copy, and `PARITY_LOG=1` prints each page the app loads, also in a packaged build. Against a local dev server started with `VITE_AUTH_BYPASS=1 npm run dev -- --port 5199`, `PARITY_DEV_URL=http://127.0.0.1:5199 PARITY_AUTH_BYPASS=1` treats the app as signed in, for screenshots; the bypass only works with a loopback dev address.

The release workflow (`.github/workflows/desktop-release.yml`) builds both installers and the update files on GitHub's runners and attaches them to a draft release. Run it from the Actions tab, or push a tag such as `desktop-v0.2.0`. Publish the release to ship it.

## How it is put together

| File | What it does |
| --- | --- |
| `electron/main.js` | Start-up, windows, the log-in wall, messages, the menu, settings |
| `electron/window.js` | One window: title bar, pages, the menu layer, focus mode |
| `electron/page.js` | One page view: live site or saved copy, links, the wall |
| `electron/ui-titlebar.*`, `ui-overlay.*`, `ui-settings.*` | The app's own pages: title bar, menu and palette, Settings |
| `electron/preload.js`, `shell-preload.js` | The bridges for website pages and for the app's own pages |
| `electron/tray.js`, `updater.js` | Menu bar item and updates |
| `electron/routes.js`, `shortcuts.js`, `settings.js`, `workspace.js` | Plain logic with tests |
| `electron-builder.config.js` | Packaging and signing |
