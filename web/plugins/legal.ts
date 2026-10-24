// The legal pages (web/legal/**/index.html) are plain HTML. They share a head, a header
// and a footer, filled in at build time from the markers below so each page stays short:
//   <!--legal:head-->     the stylesheet and the cookie notice script
//   <!--legal:header-->   skip link, logo and the way back into Parity
//   <!--legal:footer-->   legal links, cookie settings and the "not investment advice" line
// The same footer markup is copied by hand into web/index.html (its footer only).
import type { Plugin } from "vite";

export const LEGAL_LINKS: [string, string][] = [
  ["/legal/privacy/", "Privacy"],
  ["/legal/terms/", "Terms"],
  ["/legal/cookies/", "Cookies"],
  ["/legal/accessibility/", "Accessibility"],
  ["/legal/risk/", "Risk"],
];

// Titles, descriptions, icons and share tags come from src/lib/meta.ts (plugins/meta.ts).
const HEAD = `
    <link rel="stylesheet" href="/src/legal/legal.css" />
    <script type="module" src="/src/legal/page.ts"></script>`;

const HEADER = `
    <a class="skip" href="#main">Skip to content</a>
    <header class="lg-header">
      <div class="lg-wrap">
        <a class="lg-brand" href="/"><img src="/brand/2026-10-22-wordmark/parity-lockup-on-dark.svg" width="171" height="40" alt="Parity home" /></a>
        <nav class="lg-nav" aria-label="Site">
          <a href="/legal/">Legal</a>
          <a href="/login/">Log in</a>
          <a class="lg-cta" href="/signup/">Sign up</a>
        </nav>
      </div>
    </header>`;

const FOOTER = `
    <footer class="lg-footer">
      <div class="lg-wrap">
        <nav class="lg-legal" aria-label="Legal">
          ${LEGAL_LINKS.map(([href, label]) => `<a href="${href}">${label}</a>`).join("\n          ")}
          <button type="button" data-cookie-prefs>Cookie settings</button>
        </nav>
        <p>Research and education only. Not investment advice. Results are backtests and simulations, and the past does not promise the future.</p>
        <p>&copy; 2026 Parity</p>
      </div>
    </footer>`;

export function parityLegal(): Plugin {
  return {
    name: "parity-legal",
    transformIndexHtml: {
      order: "pre",
      handler(html, ctx) {
        if (!ctx.path.startsWith("/legal/")) return html;
        return html
          .replace("<!--legal:head-->", HEAD)
          .replace("<!--legal:header-->", HEADER)
          .replace("<!--legal:footer-->", FOOTER);
      },
    },
  };
}
