// The legal pages (web/legal/**/index.html), the API guide (web/developers/) and the download page (web/download/) are plain HTML. They share a head, a header
// and a footer, filled in at build time from the markers below so each page stays short:
//   <!--legal:head-->     the stylesheet and the cookie notice script
//   <!--legal:header-->   skip link, the logo, Log in and Sign up
//   <!--legal:footer-->   legal links, cookie settings and the "not investment advice" line
// The same footer markup is copied by hand into web/index.html (its footer only).
import type { Plugin } from "vite";
import { fillGuide, isGuide } from "./guides";

export const LEGAL_LINKS: [string, string][] = [
  ["/legal/privacy/", "Privacy"],
  ["/legal/terms/", "Terms"],
  ["/legal/cookies/", "Cookies"],
  ["/legal/accessibility/", "Accessibility"],
  ["/legal/risk/", "Risk"],
  ["/legal/regulatory/", "Regulatory"],
];

// Titles, descriptions, icons and share tags come from src/lib/meta.ts (plugins/meta.ts).
const HEAD = `
    <link rel="stylesheet" href="/src/legal/legal.css" />
    <script type="module" src="/src/legal/page.ts"></script>`;

// No top bar (DEC-0039): the logo mark and PARITY in the top left, quiet Log in and Sign up
// on the right, the same as the front page.
const HEADER = `
    <a class="skip" href="#main">Skip to content</a>
    <header class="lg-top">
      <a class="lg-brand" href="/" aria-label="Parity home">
        <img src="/brand/2026-10-21-starburst/parity-mark-white.svg" width="22" height="22" alt="" />
        <img src="/brand/2026-10-22-wordmark/parity-letters-on-dark.svg" width="70" height="15" alt="" />
      </a>
      <nav class="lg-nav" aria-label="Account">
        <a href="/download/">Download</a>
        <a href="/login/">Log in</a>
        <a class="lg-su" href="/signup/">Sign up</a>
      </nav>
    </header>`;

// Small grey links, as on the sign-in pages.
const FOOTER = `
    <footer class="lg-footer">
      <nav class="lg-legal" aria-label="Legal">
        <a href="/download/">Download</a>
        ${LEGAL_LINKS.map(([href, label]) => `<a href="${href}">${label}</a>`).join("\n        ")}
        <button type="button" data-cookie-prefs>Cookie settings</button>
      </nav>
      <p>Research and education only. Not investment advice. Results are backtests and simulations on past data.</p>
      <p>&copy; 2026 Parity</p>
    </footer>`;

export function parityLegal(): Plugin {
  return {
    name: "parity-legal",
    transformIndexHtml: {
      order: "pre",
      handler(html, ctx) {
        if (!ctx.path.startsWith("/legal/") && !ctx.path.startsWith("/developers/") && !ctx.path.startsWith("/download/") && !isGuide(ctx.path)) return html;
        const page = isGuide(ctx.path) ? fillGuide(html, ctx.path) : html;
        return page
          .replace("<!--legal:head-->", HEAD)
          .replace("<!--legal:header-->", HEADER)
          .replace("<!--legal:footer-->", FOOTER);
      },
    },
  };
}
