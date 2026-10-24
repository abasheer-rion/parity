// The startup programs named on the front page (DEC-0039). Change the names here only:
// plugins/site.ts writes them into web/index.html at build time, so they show with no script.
//
// These are support programs, not investors, so the page says "Supported by", never
// "backed by" or "invested in". Both are shown as plain text. Cloudflare's trademark
// guidelines allow its name in word form but its logo only with written permission;
// NVIDIA gives Inception members official badges through the member portal, under its
// own rules, so a badge goes here only once we have it from there.
export const BACKERS_LABEL = "Supported by";
export const BACKERS: readonly string[] = ["NVIDIA Inception", "Cloudflare for Startups"];

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** The strip's HTML, for the build. */
export function backersHtml(): string {
  const names = BACKERS.map((b) => `<li>${esc(b)}</li>`).join("");
  const sentence = `${BACKERS_LABEL} ${BACKERS.join(" and ")}`;
  return `<p class="backers-lbl">${esc(BACKERS_LABEL)}</p><ul class="backers-list" aria-label="${esc(sentence)}">${names}</ul>`;
}
