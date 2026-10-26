---
id: DEC-0059
title: A Parity page is never black, it shows a loading screen or says what went wrong
type: decision
status: accepted
created: 2026-10-25
updated: 2026-10-25
authors: [ayan]
tags: [infra, ui]
related: [REF-0024, DEC-0041, DEC-0048, DEC-0049, DEC-0045]
---

# A Parity page is never black, it shows a loading screen or says what went wrong

## In plain words

The owner opened an Academy lesson in the desktop app and saw a black window with only the lesson's title at the top. From now on every Parity app paints a branded loading screen with the first bytes of the page, fades it into the page once the page draws, and replaces it with a plain message and a Try again button if anything fails. The desktop app also draws its pages again after sleep, a screen change or a graphics restart, reloads a page that stays empty, and keeps a small log so a problem can be traced.

## Context

- The owner's window (desktop 0.2.0, Academy at academy.endyland.com, open for about 12 hours) was black below the title bar. The title had been set by the lesson's own code, so the page had loaded and drawn at least once.
- Locally, with a made-up session against a copy of the site (web/scripts/perf/stub.mjs), every app and the lesson drew in Chromium and in Electron 44.9.3, including after hiding, minimising, switching sections and killing the graphics process. The bundle the owner's app had cached was byte for byte the same as main, and it drew with his kind of progress data, with failing data and with data that never arrived.
- The page's process was alive and the size of a loaded page, so the content was most likely there but not reaching the screen. Nothing in the page could tell the person, and the app had no log to look at afterwards.
- Separately, the apps had no loading screen before their code arrived, no catch for a part of a page that crashes (React then empties the whole page), and a code file that a newer deploy removed left a blank page.

## Decision

1. Each app's index.html carries a loading screen in plain HTML and CSS (web/plugins/boot.ts): the starburst mark drawing in, a thin progress line, no layout shift. A small inline watcher fades it out when the app draws, reloads once when one of Parity's code files fails, says "taking longer than usual" after 12 seconds, and shows Try again if the page goes empty after drawing.
2. Every app root and every page sits inside a crash guard (web/src/ui/boundary.tsx) that shows what went wrong with Try again and Reload. A missing code file reloads once instead.
3. The desktop app shows a window only once its page has drawn (or after 1.5 s), draws every page again after sleep, when the screen is opened again, after screen changes and a graphics restart, checks the page in front when a window comes back, reloads a page that stays empty once and then shows Could not open with Retry, and keeps a 1 MB log of page failures with secrets removed.
4. In the desktop app's main process, an error nobody caught is written to the log and shown once in plain words with Reload pages; the app keeps running (desktop/electron/guard.js). 0.2.0 showed Electron's raw "A JavaScript error occurred in the main process" box and then quit while it was open (a crash report on the owner's Mac at 13:22 on 25 October). A page whose contents were lost is opened again in place, and a page whose process keeps stopping shows Could not open after three tries in a minute.
5. The sign-in check answers a code file with a plain 401 instead of the log-in page, so a failed file is a failed file.
6. The cause, found on 25 October with the app's own checks and every window hidden: Back to Parity in Academy, Trade, the Workbench and the Terminal calls `window.close()` when the page looks like a tab Parity opened. In the desktop app that closes the page's contents and leaves an empty, black view under the title bar, which still shows the lesson's title. Electron then reads the view's contents as undefined, and 0.2.0 asked them whether they were closed, so closing the window threw in the main process: the "A JavaScript error occurred" box, and the crash while it was open. Now those pages never close themselves in the desktop app, a page that does close itself leaves its window, which goes back to the section before it or Home (desktop 0.2.2), and every check of a page's contents allows for none. The self-test's selfclose scenario covers it.

## Consequences

- A failure is now visible and recoverable everywhere, and the next one can be traced from the desktop log.
- The cause on the owner's machine is known and fixed (item 6); the repaint, the log and the guard stay for anything else that stops a page drawing.
- The desktop self-test keeps every window hidden (no window, Dock icon, menu bar item or message appears), so it can run on a working Mac.
- Tests: web/tests/boot.test.tsx, the desktop self-test's blank and selfclose scenarios (npm run test:app), and the sections scenario in web/scripts/perf/desktop.mjs.

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [REF-0024: App speed, how we measure it and what we changed](../reference/0024-app-speed-how-we-measure-it-and-what-we-changed.md)
- [LOG-0019: Work log for 24 and 25 October](../log/2026-10-25-work-log-for-24-and-25-october.md)
<!-- backlinks:end -->
