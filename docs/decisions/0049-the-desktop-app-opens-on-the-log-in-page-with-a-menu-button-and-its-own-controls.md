---
id: DEC-0049
title: The desktop app opens on the log-in page, with a menu button and its own controls
type: decision
status: accepted
created: 2026-10-25
updated: 2026-10-25
authors: [ayan]
tags: [infra, ui]
related: [DEC-0041, DEC-0048, DEC-0044, DEC-0040, DEC-0038, DEC-0022]
---

# The desktop app opens on the log-in page, with a menu button and its own controls

## In plain words

Version 0.2.0 of the desktop app opens on the log-in page and nothing else: no sidebar, no section buttons, no cookie notice. After you log in it opens the last page you used, Home the first time. The sidebar is gone. A menu button at the top left opens the sections over the page and closes when you pick one, press Escape or click outside it, so every page uses the whole window. A slim bar along the top moves the window when you drag it and zooms it when you double-click it.

The app also does things the website cannot: any section or page opens in its own window, every window comes back where it was at launch, a set of windows can be saved as a workspace, a menu bar item shows your watchlist's prices, a key of your choice shows or hides Parity from any app, Trade alerts arrive with every window closed if you allow it, a chart window can stay on top, focus mode hides the bar, and sections you leave stay loaded so going back is instant. It checks for new versions by itself. Updates install themselves on Windows now, and on a Mac once the app is signed.

## Context

The owner, on 25 October 2026, after using 0.1.2: "first wall should be logging in, i shouldnt see a sidebar, also not a huge fan of the sidebar ... with the app it can get really large and is better optimized for full screen trading and research and also simming where the sidebar just turns into a top left hamburger icon. Also cant drag around the app where i want, make it easy to, also make sure to add meta data and deep links and navigation. The app should inherently have something different that gives us more control etc." For updates, the owner has access to another company's Apple developer account.

Version 0.1.2 ([DEC-0041](0041-parity-as-an-installable-site-and-a-desktop-app-for-mac-and-windows.md), [DEC-0048](0048-the-desktop-app-loads-the-live-site-and-keeps-a-copy-for-offline.md)) showed a permanent 76 pixel sidebar beside every page, including the log-in panel, and the website's cookie notice. Only the sidebar could move the window. The update code was written but off, because the repository is private and an unsigned Mac app cannot replace itself.

## Decision

This replaces items 6 (the sidebar) and 9 (updates) of [DEC-0041](0041-parity-as-an-installable-site-and-a-desktop-app-for-mac-and-windows.md) and item 6 (no update check) of [DEC-0048](0048-the-desktop-app-loads-the-live-site-and-keeps-a-copy-for-offline.md). Everything else in both stands.

1. **The log-in wall.** The app reads the website's session cookie in its own storage. Signed out, a window loads only `/login/` (the panel from [DEC-0044](0044-one-sign-in-panel-that-fades-in-over-the-front-page.md)), the other sign-in pages and the legal pages they link to. The title bar shows no menu button, search or title. A sign-in page may only leave once the cookie exists; the app then opens the last page used (Home the first time, never Account) and reopens the other saved windows. Signing out anywhere closes every window but one and puts that one on the wall.
2. **No cookie notice in the app.** The app stores only the sign-in cookie, its settings, its windows and its recent pages, all on the computer. The website skips the notice when it runs in the app, and the app hides it on older pages and the saved copy. The cookie policy has a section for the desktop app and the privacy policy says what the app keeps and sends.
3. **A title bar instead of a sidebar.** Each window has a 38 pixel bar drawn by the app above the page. It drags the window from anywhere that is not a button, on every page, on the log-in wall and while a page loads or fails, because it is the app's own page and needs no network. On Windows it is a system drag region; on a Mac, where a view inside the window does not reliably get one (0.1.2 could not be moved), the app moves the window by the pointer's travel. A double-click zooms (Mac, following the system setting) or maximises (Windows). It holds the menu button (right of the Mac traffic lights; at the left on Windows, where the system draws minimise, maximise and close on the right), Back and Forward, the page title from the page's tags ([DEC-0038](0038-every-page-gets-its-tags-from-one-table-and-every-view-has-a-link.md)), a search button and, in Trade, Keep on top. The menu opens over the page from the left. Each section's own navigation, such as the Trade rail, is unchanged.
4. **Navigation.** Back and Forward with Cmd or Ctrl plus [ and ] (Alt plus arrows on Windows), the mouse's back and forward buttons, a two-finger swipe on a Mac trackpad where the page does not scroll sideways, and three-finger swipes. Cmd or Ctrl plus 1 to 8 opens a section. Cmd or Ctrl plus K opens a command palette across sections, recent pages, workspaces and commands; in Trade it offers Trade's own search, which that key used to open. Cmd or Ctrl plus L opens any Parity link (an address on the site, `/s/...`, `/v/...` or `parity://...`). Cmd or Ctrl plus Shift plus C copies the page's shareable link, with the short link where there is one. The Go menu lists recent pages. `parity://` links open the right section and page.
5. **Windows and workspaces.** Any section or page opens in its own window (Alt-click in the menu, the arrow at the end of a row, Cmd or Ctrl plus Shift plus N for the current page). Every window's page, size, place, screen and Keep on top come back at launch; a window saved on a screen that is gone opens centred. "Save windows as workspace" names a set; opening it replaces the open windows. State lives in `state.json` in the app's data folder.
6. **Instant sections.** Each window keeps up to four sections loaded. Going back to one shows it as it was, with no reload. Settings can turn this off.
7. **Menu bar item.** Quick actions and, by default, the active Trade watchlist's last delayed close and day change, one at a time on a Mac, in the tooltip on Windows. The prices come from a Trade page through a new bridge call; the app keeps a hidden Trade page loaded while the ticker or "keep running" is on.
8. **Alerts with the window closed.** With "Keep running when windows close" on (off by default), closing the last window hides it and its pages keep running, so Trade alerts still show as notifications. The same alert from two Trade pages shows once.
9. **More control.** A key that shows or hides Parity from any app (off until set), Keep on top for a window, focus mode (full screen with the title bar hidden, Cmd or Ctrl plus Shift plus F), and a Settings page (Cmd or Ctrl plus comma) for all of the above.
10. **Security.** Every view keeps context isolation and the sandbox on and Node off. Website pages get the page bridge only on the trusted addresses; the title bar, menu layer and Settings page get a separate bridge only at `app://parity/__desktop/`. The main process checks the sending view and frame for every message and accepts a fixed list of actions.
11. **Updates.** The release workflow attaches `latest-mac.yml`, `latest.yml`, the Mac zips and disk images, the Windows installer and their block maps to the GitHub release. A Pages function at `/desktop/updates/` on the site serves the newest published desktop release without a login, reading GitHub with a read-only token kept in the Pages environment (`DESKTOP_RELEASES_TOKEN`). Drafts are never served, so publishing a release is what ships it. The app checks 15 seconds after launch and every 6 hours. Windows downloads in the background and asks to restart. A signed and notarized Mac build does the same; an unsigned Mac build offers to download the new disk image instead.
12. **Ready for signing.** `desktop/electron-builder.config.js` signs with a Developer ID Application certificate and the hardened runtime when `CSC_LINK` and `CSC_KEY_PASSWORD` exist, and notarizes with an App Store Connect API key when `APPLE_API_KEY`, `APPLE_API_KEY_ID` and `APPLE_API_ISSUER` also exist. Without them the build is ad hoc signed as before. Nothing is signed until the owner adds those secrets. The secrets exist since 26 October and 0.2.2 is the first signed build, for Mac and Windows ([DEC-0062](0062-desktop-builds-are-signed-with-argus-vision-certificates.md)).

13. **Never a blank window.** A page that cannot load live opens from the saved copy; a page the saved copy cannot open either shows "Could not open this page" with Retry. A deep link while signed out opens the log-in wall (0.1.2 showed an empty window). `npm run test:app` checks both in the running app, with the title bar drag, the offline copy and the menu, in CI on a Mac runner and before every release build.

## Alternatives considered

- **Keep the sidebar, collapsible.** The owner asked for it to go. A collapsed sidebar still takes a strip of every page.
- **Inject the drag region into each website page.** The pages are live and vary by section; a bar drawn by the app works on every page, the saved copy and the log-in wall alike.
- **Host the update files in an R2 bucket.** Needs a new bucket and a token with write access. The Pages function needs one read-only token and keeps GitHub's draft and publish step as the release gate.
- **Make the repository's releases public.** Not possible for one part of a private repository.

## Consequences

- Owner steps are in `desktop/README.md`: the Pages secret `DESKTOP_RELEASES_TOKEN` turns the update feed on, and the five Apple secrets turn on signing and notarization.
- Until the Apple secrets exist, Mac copies tell people about a new version and open its disk image; they cannot install it by themselves.
- The hidden Trade page and the loaded sections use more memory. Both can be turned off in Settings.
- `npm run shots` writes screenshots of the app's windows by drawing each window's own views, so it needs no screen recording permission.

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [DEC-0041: Parity as an installable site and a desktop app for Mac and Windows](0041-parity-as-an-installable-site-and-a-desktop-app-for-mac-and-windows.md)
- [DEC-0048: The desktop app loads the live site and keeps a copy for offline](0048-the-desktop-app-loads-the-live-site-and-keeps-a-copy-for-offline.md)
- [DEC-0058: One token file for every app and a lint that blocks raw values](0058-one-token-file-for-every-app-and-a-lint-that-blocks-raw-values.md)
- [DEC-0059: A Parity page is never black, it shows a loading screen or says what went wrong](0059-a-parity-page-is-never-black-it-shows-a-loading-screen-or-says-what-went-wrong.md)
- [DEC-0060: A getting started checklist and first-run tours, and no bank details until a broker partner](0060-a-getting-started-checklist-and-first-run-tours-and-no-bank-details-until-a-broker-partner.md)
- [DEC-0062: Desktop builds are signed with Argus Vision certificates](0062-desktop-builds-are-signed-with-argus-vision-certificates.md)
- [DEC-0072: Public pages are cached up to 3 days, the desktop app stays signed in, and a download page](0072-public-pages-are-cached-up-to-3-days-the-desktop-app-stays-signed-in-and-a-download-page.md)
- [LOG-0019: Work log for 24 and 25 October](../log/2026-10-25-work-log-for-24-and-25-october.md)
<!-- backlinks:end -->
