Parity for Mac and Windows. The whole Parity site in one window, loaded live.

New in 0.2.3:

- Parity moved to paritytrading.app. The app opens the new address and checks it for updates. Links to the old endyland.com addresses still open inside the app.
- You sign in once more after the update, because a sign-in never carries over between two domains.

New in 0.2.2:

- Signed. The Mac app is signed with Argus Vision's Apple Developer ID and checked by Apple, so it opens like any other app. The Windows installer is signed by Argus Vision, Inc.
- Fixed the cause of the black page and the "A JavaScript error occurred" box. Back to Parity in the Academy, Trade, the Workbench and the Terminal tried to close the page, which emptied the window and made it fail when it closed. Now the button goes back to Parity, and a page that closes itself takes you back to the section before it.

New in 0.2.1:

- No more "A JavaScript error occurred" box followed by Parity quitting. An unexpected error is now noted in the log and shown once in plain words with Reload pages, and Parity keeps running. A page whose contents were lost is opened again in place.
- Never a black window. A page that stops drawing (after sleep, a screen change, Stage Manager or a graphics restart) is drawn again, and a page that stays empty reloads once, then says it could not open, with Retry.
- Windows open already drawn, with Parity's loading screen, instead of an empty dark frame.
- Faster: the sections you use most open in the background, built files stay cached, and each app downloads much less code.
- The app keeps a small log of pages that failed, to help trace a problem: Mac `~/Library/Logs/Parity/parity.log`, Windows `%APPDATA%\Parity\logs\parity.log`. It holds no passwords or sign-in tokens.

New in 0.2.0:

- The app opens on the log-in page, with no sidebar and no cookie notice. After you log in it opens the last page you used.
- No sidebar: a menu button at the top left opens the sections, and every page uses the whole window.
- Drag the bar along the top to move the window; double-click it to zoom.
- Cmd or Ctrl plus K for a command palette, plus L to open any Parity link, plus Shift plus C to copy a page's link. Back and Forward with keys, mouse buttons and trackpad swipes.
- Open any section or chart in its own window. Windows come back where they were, and sets of windows can be saved as workspaces.
- A menu bar item with your watchlist's prices, a key to show or hide Parity from any app, Keep on top, focus mode, and Trade alerts with every window closed (all in Settings).
- Parity checks for new versions by itself once its update feed is switched on.

Research and education only. Not investment advice. Trade uses a demo account with delayed data and no real money.

Which file to download:

- `Parity-<version>-arm64.dmg`: Mac with Apple silicon (M1 or later)
- `Parity-<version>-x64.dmg`: Intel Mac
- `Parity-Setup-<version>.exe`: Windows

The `.zip`, `.blockmap` and `latest*.yml` files are for automatic updates.

The Mac app and disk images are signed by Argus Vision, Inc. and notarized by Apple: drag Parity into Applications and open it.

The Windows installer is signed by Argus Vision, Inc. While the signature is new, Windows may still show "Windows protected your PC" for a while; click More info, then Run anyway. The warning fades as more people install it.
