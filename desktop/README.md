# Parity for Mac and Windows

The whole Parity site in one window: the front page and Verify, the product app (Strategies), Research, Parity Terminal and Parity Trade, with a sidebar to switch between them. Built with Electron and electron-builder ([DEC-0041](../docs/decisions/0041-parity-as-an-installable-site-and-a-desktop-app-for-mac-and-windows.md)). Research and education only. Not investment advice. Trading in the app uses a demo account with delayed data and no real money.

## Install

Download from the repository's Releases page: `Parity-<version>-arm64.dmg` for a Mac with Apple silicon (M1 or later), `Parity-<version>-x64.dmg` for an Intel Mac, `Parity Setup <version>.exe` for Windows.

The app is not registered with Apple or Microsoft yet, so each computer asks you to confirm the first time.

**Mac**

1. Open the `.dmg` and drag Parity into Applications.
2. In Applications, right-click Parity and choose Open, then Open again.
3. If the Mac only offers to move it to the Bin: open System Settings, then Privacy & Security, scroll down and click Open Anyway next to Parity.

After the first time it opens normally.

**Windows**

1. Run `Parity Setup <version>.exe`.
2. If Windows shows "Windows protected your PC", click More info, then Run anyway.
3. Choose where to install it. It adds a Start menu and a desktop shortcut.

## Using it

- Sign in with your Parity email and password, or an email code. You stay signed in when you close the app.
- The sidebar: Home, Verify, Strategies, Research, Terminal, Trade and Account. Cmd (Mac) or Ctrl (Windows) plus 1 to 6 opens each one, plus comma opens Account. Back is Cmd+[ on a Mac and Alt+Left on Windows.
- Trade alerts show as desktop notifications. Clicking one opens that chart.
- `parity://` links open the app at a page, for example `parity://s/fx_carry`, `parity://trade/#/alerts` or `parity://sim/macro`. Links to parity.endyland.com, trade.endyland.com, academy.endyland.com and sim.endyland.com inside the app stay in the app; other links open in your browser.
- The window remembers its size and place, and opens on the last page you had.
- Updates: download the new version from Releases. Automatic updates are built in but off until the app is signed.

## Building it

```bash
cd web && npm ci && cd ../desktop && npm ci
npm run web          # builds the site and copies it to build/web (no research data is copied)
npm start            # runs the app from source
npm test             # address routing tests
npm run build:mac    # dist/Parity-<version>-arm64.dmg and -x64.dmg (ad hoc signed, not notarized)
npm run build:win    # dist/Parity Setup <version>.exe (unsigned), on Windows
```

On this Mac, prefix the Mac build with `DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer CSC_IDENTITY_AUTO_DISCOVERY=false`. `npm run icons` redraws the icons from the brand's starburst. `npm run shots` saves a picture of each section to `~/Desktop/parity-app/`; with `npm run dev` it uses a local dev server instead of the built site.

The release workflow (`.github/workflows/desktop-release.yml`) builds both installers on GitHub's runners and attaches them to a draft release. Run it from the Actions tab, or push a tag such as `desktop-v0.1.0`.
