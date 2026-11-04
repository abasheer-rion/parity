// The pages for firms (DEC-0087) under web/business/ at build time. Shared parts:
//   <!--business:corner-->   the logo and the corner links (no top bar, DEC-0039)
//   <!--business:pilot-->    the "Start a free 30-day pilot" form, a dialog opened by
//                            src/business/pilot.ts
//   <!--business:footer-->   legal links and the "not investment advice" line
// and every <!--pilot:name--> number, filled from the SYNTHETIC sample's summary
// (public/business/prop-firms/sample/summary.json, written by `npm run pilot:sample` from the
// same screen code the page runs). An unknown name fails the build, so a typo cannot ship.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Plugin } from "vite";
import { VOLUMES } from "../src/lib/screen/pilot";
import type { Headline } from "../src/lib/screen/sample";
import { LEGAL_LINKS } from "./legal";

const SUMMARY = resolve(import.meta.dirname, "../public/business/prop-firms/sample/summary.json");

const pct = (v: number | null | undefined) => (v == null ? "n/a" : `${Math.round(v * 100)}%`);
const range = (lo: number | null | undefined, hi: number | null | undefined) => `${pct(lo)} to ${pct(hi)}`;

export function pilotValues(h: Headline = JSON.parse(readFileSync(SUMMARY, "utf8")) as Headline): Record<string, string> {
  const b = h.backtest;
  return {
    "no-edge-pass": pct(h.noEdgePassChance),
    target: pct(h.rules.target),
    "max-loss": pct(h.rules.maxLoss),
    accounts: h.accounts.toLocaleString("en-US"),
    passers: h.passers.toLocaleString("en-US"),
    "judged-passers": h.judgedPassers.toLocaleString("en-US"),
    "lucky-passers": h.luckyPassers.toLocaleString("en-US"),
    "lucky-share": pct(h.luckyPasserShare),
    "only-luck": h.onlyLuckCheck.toLocaleString("en-US"),
    "thin-passers": h.notEnoughPassers.toLocaleString("en-US"),
    "hit-rate": pct(b?.hitRate), "hit-ci": range(b?.hitLo, b?.hitHi),
    "holds-blowup": pct(b?.holdsBlowup), "holds-ci": range(b?.holdsLo, b?.holdsHi),
    "false-alarms": pct(b?.falseAlarms), "false-ci": range(b?.falseLo, b?.falseHi),
    caught: pct(b?.caught), "caught-ci": range(b?.caughtLo, b?.caughtHi),
  };
}

export function fillPilot(html: string, values = pilotValues()): string {
  return html.replace(/<!--pilot:([a-z-]+)-->/g, (_, name: string) => {
    if (!(name in values)) throw new Error(`business page: unknown marker <!--pilot:${name}-->`);
    return values[name];
  });
}

const CORNER = (here: string) => {
  const links: [string, string, string][] = [
    ["/business/prop-firms/", "Prop firms", ""],
    ["/business/prop-firms/sample/", "Sample report", ""],
    ["/business/screen/", "Screen a batch", "wide"],
    ["/verify/", "Verify", "wide"],
  ];
  return `
    <a class="skip" href="#main">Skip to content</a>
    <div class="corner corner-logo">
      <a href="/" aria-label="Parity home">
        <img src="/brand/2026-10-21-starburst/parity-mark-white.svg" width="22" height="22" alt="" />
        <img class="letters" src="/brand/2026-10-22-wordmark/parity-letters-on-dark.svg" width="70" height="15" alt="" />
      </a>
    </div>
    <nav class="corner corner-nav" aria-label="Business">
      ${links.map(([href, label, cls]) => `<a href="${href}"${cls ? ` class="${cls}"` : ""}${href === here ? ' aria-current="page"' : ""}>${label}</a>`).join("\n      ")}
    </nav>`;
};

const field = (id: string, label: string, input: string, optional = false) =>
  `<div class="bz-field"><label for="pilot-${id}">${label}${optional ? ' <span class="opt">(optional)</span>' : ""}</label>${input}<span id="pilot-${id}-e" class="bz-status err" aria-live="polite"></span></div>`;

export const PILOT_FORM = `
    <dialog class="bz-dialog" aria-labelledby="pilot-h">
      <form novalidate>
        <h2 id="pilot-h">Start a free 30-day pilot</h2>
        <p>Tell us who you are and we will reply by email to set it up. No card and no contract.</p>
        ${field("firm", "Firm", '<input id="pilot-firm" name="firm" autocomplete="organization" required maxlength="120" aria-describedby="pilot-firm-e" />')}
        ${field("name", "Your name", '<input id="pilot-name" name="name" autocomplete="name" required maxlength="120" aria-describedby="pilot-name-e" />')}
        ${field("email", "Work email", '<input id="pilot-email" name="email" type="email" autocomplete="email" required maxlength="254" aria-describedby="pilot-email-e" />')}
        ${field("volume", "Accounts a month", `<select id="pilot-volume" name="volume" required aria-describedby="pilot-volume-e"><option value="">Choose one</option>${VOLUMES.map(([v, l]) => `<option value="${v}">${l}</option>`).join("")}</select>`)}
        ${field("message", "Message", '<textarea id="pilot-message" name="message" maxlength="2000" aria-describedby="pilot-message-e"></textarea>', true)}
        <div class="bz-trap" aria-hidden="true"><label for="pilot-website">Leave this empty</label><input id="pilot-website" name="website" tabindex="-1" autocomplete="off" /></div>
        <p class="bz-small">We keep what you send here only to answer you. <a href="/legal/privacy/">Privacy policy</a>.</p>
        <p class="bz-status" role="status" aria-live="polite" data-status></p>
        <div class="bz-actions">
          <button type="button" class="btn" data-close>Close</button>
          <button type="submit" class="btn primary">Send request</button>
        </div>
      </form>
    </dialog>`;

export const BUSINESS_FOOTER = `
    <footer class="bz-footer">
      <div class="wrap">
        <span>Research and education only. Not investment advice. A verdict is about a record, not about a trader's future.</span>
        <nav aria-label="Legal">
          <a href="/methodology/#batch">Methodology</a>
          ${LEGAL_LINKS.map(([href, label]) => `<a href="${href}">${label}</a>`).join("\n          ")}
          <a href="mailto:contact@paritytrading.app">contact@paritytrading.app</a>
        </nav>
      </div>
    </footer>`;

export function parityBusiness(): Plugin {
  return {
    name: "parity-business",
    transformIndexHtml: {
      order: "pre",
      handler(html, ctx) {
        if (!ctx.path.startsWith("/business/")) return html;
        const here = ctx.path.replace(/index\.html$/, "");
        return fillPilot(html)
          .replace("<!--business:corner-->", CORNER(here))
          .replace("<!--business:pilot-->", PILOT_FORM)
          .replace("<!--business:footer-->", BUSINESS_FOOTER);
      },
    },
  };
}
