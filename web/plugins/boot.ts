// The loading screen every Parity app shows before its code arrives (DEC-0058). It is plain
// HTML and CSS written into each app's index.html, so it paints with the first bytes of the
// page: the dark background, the starburst mark drawing in and a thin progress line. When
// the app puts its first real content on the page (a skeleton or the page itself) the screen
// fades out over it. It never moves the page: it is fixed on top and leaves no space behind.
//
// A small inline script watches the start:
//   - a file the page needs fails to load, or a newer deploy removed it: reload once, then
//     say so with a Try again button
//   - nothing has drawn after 12 seconds: say it is taking longer, with Try again
//   - the app drew and then the page went empty (a crash the app did not catch): say so,
//     with Try again
// So a Parity page is never a black screen. The sign-in check's "Loading" line counts as
// still loading (its Try again does not). Reduced motion: no drawing or pulsing, the line holds still.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Plugin } from "vite";

/** The app entries that get the screen (the site's own pages paint straight from HTML). */
export const BOOT_PAGES = ["/app/", "/research/", "/sim/", "/trade/", "/academy/", "/lab/"];

const MARK = readFileSync(resolve(import.meta.dirname, "../public/brand/2026-10-21-starburst/parity-mark.svg"), "utf8")
  .replace(/<title>.*?<\/title>/, "")
  .replace(/ role="img" aria-label="Parity"/, ' aria-hidden="true" focusable="false"')
  .replace(/width="64" height="64"/, 'width="56" height="56" class="pboot-mark"');

const CSS = `
#pboot{position:fixed;inset:0;z-index:2147483600;display:grid;place-items:center;background:#050608;color:#a4a8b6;
font:14px/1.5 Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;transition:opacity .32s cubic-bezier(.2,.7,.2,1),visibility 0s linear .32s}
#pboot.pboot-out{opacity:0;visibility:hidden;pointer-events:none}
#pboot[hidden]{display:none}
#pboot .pboot-c{display:grid;justify-items:center;gap:18px;text-align:center;padding:24px;max-width:360px}
#pboot .pboot-mark{transform-origin:50% 50%;animation:pboot-draw .9s cubic-bezier(.2,.7,.2,1) both,pboot-pulse 2.4s ease-in-out .9s infinite}
#pboot .pboot-line{position:fixed;top:0;left:0;right:0;height:2px;overflow:hidden;background:rgb(92 194 245 / .08)}
#pboot .pboot-line i{position:absolute;inset:0;background:linear-gradient(90deg,transparent,#5cc2f5,transparent);transform:translateX(-100%);animation:pboot-run 1.3s cubic-bezier(.4,0,.2,1) infinite}
#pboot .pboot-msg{display:none;margin:0;color:#c9ccd6}
#pboot .pboot-row{display:none;gap:8px}
#pboot button{font:inherit;color:#f4f5f8;background:#151720;border:1px solid rgb(255 255 255 / .14);border-radius:8px;padding:7px 14px;cursor:pointer}
#pboot button.pboot-go{background:#1f78c8;border-color:#1f78c8}
#pboot button:focus-visible{outline:2px solid #5cc2f5;outline-offset:2px}
#pboot.pboot-slow .pboot-msg,#pboot.pboot-fail .pboot-msg{display:block}
#pboot.pboot-slow .pboot-row,#pboot.pboot-fail .pboot-row{display:flex}
#pboot.pboot-fail .pboot-mark{animation:none;opacity:.5}
#pboot.pboot-fail .pboot-line{display:none}
@keyframes pboot-draw{from{opacity:0;transform:scale(.6) rotate(-30deg)}}
@keyframes pboot-pulse{50%{opacity:.72;transform:scale(.96)}}
@keyframes pboot-run{to{transform:translateX(100%)}}
@media (prefers-reduced-motion:reduce){#pboot .pboot-mark{animation:pboot-fade .3s ease-out both}#pboot .pboot-line i{animation:none;transform:none;opacity:.5}}
@keyframes pboot-fade{from{opacity:0}}
`.replace(/\n/g, "");

const HTML = `<div id="pboot" role="status" aria-live="polite" aria-label="Loading Parity"><div class="pboot-line"><i></i></div><div class="pboot-c">${MARK}<p class="pboot-msg"></p><div class="pboot-row"><button type="button" class="pboot-go" data-act="retry">Try again</button></div></div></div>`;

/**
 * The watcher, run inline in the page before anything else (its source is written into the
 * HTML, so it uses nothing from outside itself). Exported so the tests can run it.
 */
export function bootWatch(): void {
  const b = document.getElementById("pboot");
  const root = document.getElementById("root");
  if (!b || !root) return;
  const KEY = "parity.boot.reload";
  let drew = false, gone = false, failed = false;
  const msg = (t: string) => { const m = b.querySelector(".pboot-msg"); if (m) m.textContent = t; };
  const real = () => {
    const c = root.firstElementChild;
    if (!c) return false;
    // The sign-in check's "Loading" counts as still loading; its "Try again" is real content.
    return !(root.children.length === 1 && c.classList.contains("auth-splash") && !c.querySelector("button"));
  };
  const hide = () => {
    if (gone) return;
    gone = true;
    b.classList.remove("pboot-slow");
    b.classList.add("pboot-out");
    setTimeout(() => { if (gone) b.hidden = true; }, 360);
    try { sessionStorage.removeItem(KEY); } catch { /* storage blocked */ }
  };
  const show = (cls: string, t: string) => {
    gone = false;
    b.hidden = false;
    b.classList.remove("pboot-out", "pboot-slow", "pboot-fail");
    b.classList.add(cls);
    b.setAttribute("aria-label", t);
    msg(t);
  };
  const fail = (t: string) => {
    if (failed) return;
    failed = true;
    show("pboot-fail", t);
    (window as unknown as { parityBootFailed?: string }).parityBootFailed = t;
  };
  const reloadOnce = () => {
    let again = false;
    try { again = !!sessionStorage.getItem(KEY); sessionStorage.setItem(KEY, "1"); } catch { again = true; }
    if (again) fail("Parity could not load a file it needs. Check your connection and try again.");
    else window.location.reload();
  };
  const check = () => {
    if (failed) return;
    if (real()) { drew = true; hide(); }
    else if (drew && !root.firstElementChild) fail("Something went wrong and this page stopped. Try again to reload it.");
  };
  new MutationObserver(check).observe(root, { childList: true });
  setTimeout(() => { if (!drew && !failed) show("pboot-slow", "This is taking longer than usual. Check your connection, or try again."); }, 12000);
  window.addEventListener("error", (e) => {
    const t = e.target as HTMLElement | null;
    // Only Parity's own built files: a blocked outside script (an ad blocker, a Cloudflare
    // check) must never send the page into reloads.
    const src = t?.tagName === "SCRIPT" ? (t as HTMLScriptElement).src : t?.tagName === "LINK" && (t as HTMLLinkElement).rel === "stylesheet" ? (t as HTMLLinkElement).href : "";
    const ours = !!src && src.includes(`${window.location.host}/`) && src.includes("/assets/");
    if (!drew && ours) reloadOnce();
  }, true);
  window.addEventListener("vite:preloadError", (e) => { e.preventDefault(); reloadOnce(); });
  window.addEventListener("unhandledrejection", (e) => {
    const m = String(e.reason?.message ?? e.reason ?? "");
    if (/dynamically imported module|Importing a module script failed|error loading dynamically imported/i.test(m)) reloadOnce();
  });
  b.addEventListener("click", (e) => {
    if ((e.target as HTMLElement | null)?.getAttribute?.("data-act") !== "retry") return;
    try { sessionStorage.removeItem(KEY); } catch { /* storage blocked */ }
    window.location.reload();
  });
}

const SCRIPT = `(${bootWatch.toString()})();`;

/** Makes the Google Fonts stylesheet load without holding up the first paint (text uses fallbacks until it arrives). */
export function asyncFonts(html: string): string {
  return html.replace(/<link href="(https:\/\/fonts\.googleapis\.com\/[^"]+)" rel="stylesheet" \/>/g,
    '<link rel="preload" as="style" href="$1" /><link href="$1" rel="stylesheet" media="print" onload="this.media=\'all\'" /><noscript><link href="$1" rel="stylesheet" /></noscript>');
}

export function bootScreen(html: string): string {
  if (html.includes('id="pboot"')) return html;
  return asyncFonts(html)
    .replace("</head>", `  <style id="pboot-css">${CSS}</style>\n  </head>`)
    .replace('<div id="root"></div>', `${HTML}\n    <div id="root"></div>\n    <script>${SCRIPT}</script>`);
}

export function parityBoot(): Plugin {
  return {
    name: "parity-boot",
    transformIndexHtml: {
      order: "pre",
      handler(html, ctx) {
        const page = ctx.path.replace(/index\.html$/, "");
        return BOOT_PAGES.includes(page) ? bootScreen(html) : html;
      },
    },
  };
}
