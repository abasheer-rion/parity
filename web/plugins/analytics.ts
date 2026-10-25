// Product analytics on every page (DEC-0053). Adds the small boot script to every HTML file
// in every build (site, app, sim, trade, academy, lab) and in dev, so a new page or app is
// covered with no work. The script records nothing until the person switches analytics on.
//
// The comment marker lets scripts/analytics-check.mjs prove, after a build, that every
// built page has it; tests/analyticsWiring.test.ts proves every page and route maps to a
// known app and a stable route name.
import type { Plugin } from "vite";

export const ANALYTICS_MARKER = "<!--parity-analytics-->";
const TAG = `${ANALYTICS_MARKER}\n    <script type="module" src="/src/lib/analytics/boot.ts"></script>\n  `;

export function parityAnalytics(): Plugin {
  return {
    name: "parity-analytics",
    transformIndexHtml: {
      order: "pre",
      handler(html) {
        if (html.includes(ANALYTICS_MARKER)) return html;
        return html.includes("</head>") ? html.replace("</head>", `${TAG}</head>`) : `${TAG}${html}`;
      },
    },
  };
}
