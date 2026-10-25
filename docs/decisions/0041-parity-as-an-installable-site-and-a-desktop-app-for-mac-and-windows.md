---
id: DEC-0041
title: Parity as an installable site and a desktop app for Mac and Windows
type: decision
status: accepted
created: 2026-10-24
updated: 2026-10-24
authors: [ayan]
tags: [infra, process, ui]
related: [DEC-0038, DEC-0040, DEC-0024, DEC-0020, DEC-0048]
---

# Parity as an installable site and a desktop app for Mac and Windows

## In plain words

Parity can now be installed two ways. In Chrome, Edge or Safari, the site offers an Install button, and Parity then opens in its own window with an icon in the dock or Start menu. There is also a desktop app for Mac and Windows that holds the whole site: the front page and Verify, the product app, Research, Parity Terminal and Parity Trade. It has a sidebar to switch between them, a menu with keyboard shortcuts, desktop notifications for Trade alerts and `parity://` links. The app is not registered with Apple or Microsoft, so the first time you open it your computer asks you to confirm. Phone apps come later.

## Context

The owner asked on 24 October 2026 for "an app asap, all of it, trading with research and normal site". The first plan was iPhone and Android apps; the owner then narrowed it to "a non registered app for mac or windows", built "like how we built rion bulk email send", which is an Electron app packaged by electron-builder with a Windows installer and a Mac disk image made on GitHub's runners.

The site is a Vite build of separate pages (`index`, `app`, `research`, `sim`, `trade` and the sign-in pages). The Pages middleware ([DEC-0038](0038-every-page-gets-its-tags-from-one-table-and-every-view-has-a-link.md)) refuses `/app/`, `/research/`, `/sim/`, `/trade/` and `/data/` without a session cookie. Parity Terminal already had its own manifest and service worker ([DEC-0024](0024-parity-terminal-a-market-terminal-of-its-own-at-the-sim-address.md)).

## Decision

1. **Reuse the web code.** No second UI. The installable site and the desktop app run the same built pages.
2. **The installable site.** One manifest for the site and the product app (`/manifest.webmanifest`, start page `/app/`, shortcuts to Verify, Trade, Research and the Terminal, a maskable icon), one for Trade (`/trade/manifest.webmanifest`) and the Terminal's own. A service worker at `/sw.js` loads pages from the network first, falls back to the last good copy and then to `/offline.html`, and keeps hashed build files. It never stores `/data/`, `/local/`, share images, badges, sign-in redirects or errors. A small card offers to install once, on the front page and in the apps, fixed to the corner so the page never moves; on an iPhone it says how to add Parity to the home screen. "Not now" hides it for 30 days.
3. **The desktop app: Electron and electron-builder,** in `desktop/`, with the same layout as the bulk email app: `electron/main.js`, a `build` block in `desktop/package.json`, `build:mac` and `build:win` scripts and a release workflow. Tauri was the first choice for size but the owner asked for the same tools as the earlier app.
4. **Bundled pages, live data.** Since version 0.1.2 the app loads the live site when online and uses the bundled pages only offline ([DEC-0048](0048-the-desktop-app-loads-the-live-site-and-keeps-a-copy-for-offline.md)). Before that, the app serves the built site from inside itself at `app://parity/` and asks parity.endyland.com only for what is not bundled (`/data/`, `/stats.json`, badges, share images). The build refuses to package a `data/` or `local/` folder, so no research data ships inside the app.
5. **Sign-in.** The Pages middleware does not run for bundled pages, so the app relies on the same in-page sign-in check the web apps already have. The Supabase session is kept in the app's own storage, which survives restarts. The app passes the session's access token to the main process, which sends it as `Authorization: Bearer` when it fetches `/data/`. The middleware now accepts that header and checks it exactly like the cookie. Everything a person owns still comes from Supabase under row level security.
6. **A sidebar and a menu.** A slim sidebar (Home, Verify, Strategies, Research, Terminal, Trade, Account) stays put while the pages change. Sections are one list in `desktop/electron/sections.js`; an entry with `needs` appears only when its page is in the build, which is how Academy and Workbench join when their apps land. The menu has Go shortcuts (Cmd or Ctrl plus a number for each section, plus comma for Account, Back and Forward), reload, zoom and full screen. The window's size and place are remembered.
7. **Links.** `parity://` opens the app at a page: `parity://s/<strategy>`, `parity://v/<id>`, `parity://trade/#/chart?s=<symbol>`, `parity://sim/<workspace>`, or any parity.endyland.com, sim.endyland.com or trade.endyland.com address. Links to those three addresses inside the app stay in the app; every other address opens in the browser.
8. **Notifications.** When a Trade alert fires, the app shows a desktop notification as well as the toast. Clicking it opens that symbol's chart.
9. **Updates.** Auto-update is written but off until the app is signed; until then a new version is a new download from the release.
10. **Not registered.** The Mac build is signed ad hoc and not notarized; the Windows installer is not signed. The install note in `desktop/README.md` says how to open each the first time.

## Alternatives considered

- **iPhone and Android apps with Capacitor.** Planned first, then put off by the owner. The service worker, the token check in the middleware and the `parity://` routing are what a phone app would need too.
- **Tauri.** Smaller downloads, but the owner asked for the same tools as the bulk email app.
- **Load parity.endyland.com in a window.** Simplest, but nothing would open without a connection, and the app could not add a sidebar, shortcuts or notifications that work across the separate pages.

## Consequences

- The middleware accepts a bearer token on the protected paths; its tests cover it.
- A new workflow, `desktop-release.yml`, builds the site once, then the Windows installer on `windows-latest` and the Mac disk images (Apple silicon and Intel) on `macos-latest`, and attaches them to a draft GitHub release. CI runs the desktop routing tests and checks that the copy of the site holds no research data.
- The layout shift audit covers the install card: it is fixed, so it adds no shift.
- Phone apps, signing, notarisation and store listings are later owner decisions.

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [DEC-0042: Parity Academy, a full-screen course player of its own](0042-parity-academy-a-full-screen-course-player-of-its-own.md)
- [DEC-0043: Parity Workbench, one full-screen tool for strategy work](0043-parity-workbench-one-full-screen-tool-for-strategy-work.md)
- [DEC-0048: The desktop app loads the live site and keeps a copy for offline](0048-the-desktop-app-loads-the-live-site-and-keeps-a-copy-for-offline.md)
- [CMP-0016: Kraken Pro, a customisable crypto trading app with a native desktop](../competitors/0016-kraken-pro.md)
- [LOG-0016: Ayan work log, front page, Trade, links, copy and apps](../log/2026-10-25-ayan-work-log-front-page-trade-links-copy-and-apps.md)
<!-- backlinks:end -->
