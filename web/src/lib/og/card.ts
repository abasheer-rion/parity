// The share image (1200 by 630) as SVG, for link previews in chats and social posts
// (DEC-0038). One drawing for every card: the static ones made at build (plugins/meta.ts)
// and the live ones the /og/ functions make for a Verify badge or a strategy. Pure string
// work with no browser or Node imports, so all of them can use it. The text is set in
// Inter, which the renderer is given as a font file (src/lib/og/fonts, SIL Open Font
// License), so it looks the same wherever it is drawn.
import { HOST, OG_CARDS, type OgCard } from "../meta";

export const W = 1200;
export const H = 630;
const PAD = 80;
const TEXT_W = W - PAD * 2;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Rough Inter advance widths, in ems. Good enough to wrap lines without measuring.
function charWidth(c: string): number {
  if (c === " ") return 0.25;
  if ("iljI!.,:;'|".includes(c)) return 0.25;
  if ("frt()[]".includes(c)) return 0.34;
  if ("mwMW".includes(c)) return 0.82;
  if (/[0-9]/.test(c)) return 0.58;
  if (/[A-Z]/.test(c)) return 0.66;
  if (/[a-z]/.test(c)) return 0.52;
  return 0.6;
}

export function textWidth(s: string, size: number, bold = false): number {
  let w = 0;
  for (const c of s) w += charWidth(c);
  return w * size * (bold ? 1.05 : 1);
}

/** Splits text into at most `max` lines that fit `width`; the last line ends in "…" if cut. */
export function wrap(text: string, size: number, width: number, max: number, bold = false): string[] {
  const out: string[] = [];
  let line = "";
  for (const word of text.trim().split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (!line || textWidth(next, size, bold) <= width) line = next;
    else { out.push(line); line = word; }
  }
  if (line) out.push(line);
  if (out.length <= max) return out;
  const kept = out.slice(0, max);
  let last = kept[max - 1];
  while (last.includes(" ") && textWidth(`${last}…`, size, bold) > width) last = last.replace(/\s+\S+$/, "");
  kept[max - 1] = `${last}…`;
  return kept;
}

/** The brand lockup (public/brand/.../parity-lockup-on-dark.svg), placed as a nested SVG. */
function logo(svg: string, x: number, y: number, height: number): string {
  const open = svg.match(/<svg\b[^>]*>/);
  if (!open) return "";
  const box = open[0].match(/viewBox="([^"]+)"/)?.[1] ?? "0 0 317 74";
  const [, , bw, bh] = box.split(/\s+/).map(Number);
  const inner = svg.slice((open.index ?? 0) + open[0].length).replace(/<\/svg>\s*$/, "").replace(/<title>[\s\S]*?<\/title>/, "");
  const width = Math.round((height * bw) / bh);
  return `<svg x="${x}" y="${y}" width="${width}" height="${height}" viewBox="${box}">${inner}</svg>`;
}

function frame(body: string, logoSvg: string, foot: string, accent?: string): string {
  const grid: string[] = [];
  for (let x = 60; x < W; x += 60) grid.push(`M${x} 0V${H}`);
  for (let y = 60; y < H; y += 60) grid.push(`M0 ${y}H${W}`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs><radialGradient id="glow" cx="85%" cy="8%" r="75%"><stop offset="0" stop-color="#1b2a6b"/><stop offset=".62" stop-color="#07080d" stop-opacity="0"/></radialGradient></defs>
<rect width="${W}" height="${H}" fill="#07080d"/>
<rect width="${W}" height="${H}" fill="url(#glow)"/>
<path d="${grid.join("")}" stroke="#85a8ff" stroke-opacity=".05" stroke-width="1"/>
${accent ? `<rect x="0" y="0" width="12" height="${H}" fill="${accent}"/>` : ""}
${logo(logoSvg, PAD, 64, 60)}
<g font-family="Inter" fill="#f1f3f9">
${body}
<text x="${PAD}" y="${H - 64}" font-size="24" font-weight="600" fill="#85a8ff">${esc(foot)}</text>
</g>
</svg>`;
}

function lines(texts: string[], x: number, y: number, step: number, attrs: string): string {
  return texts.map((t, i) => `<text x="${x}" y="${y + i * step}" ${attrs}>${esc(t)}</text>`).join("\n");
}

/** A page card: a small label, a headline and one or two lines under it, centred in the space below the logo. */
export function cardSvg(card: OgCard, logoSvg: string, foot = HOST): string {
  const title = wrap(card.title, 66, TEXT_W, 3, true);
  const sub = wrap(card.sub, 30, TEXT_W - 40, title.length > 2 ? 1 : 2);
  const height = 82 + (title.length - 1) * 78 + 58 + (sub.length - 1) * 42;
  const top = Math.round(188 + Math.max(0, 334 - height) / 2);
  const titleTop = top + 82;
  const subTop = titleTop + (title.length - 1) * 78 + 58;
  const body = [
    `<text x="${PAD}" y="${top}" font-size="22" font-weight="600" letter-spacing="4" fill="#85a8ff">${esc(card.kicker.toUpperCase())}</text>`,
    lines(title, PAD, titleTop, 78, `font-size="66" font-weight="600" letter-spacing="-1"`),
    lines(sub, PAD, subTop, 42, `font-size="30" fill="#a3a8b9"`),
  ].join("\n");
  return frame(body, logoSvg, foot);
}

export const pageCardSvg = (key: string, logoSvg: string) => cardSvg(OG_CARDS[key] ?? OG_CARDS.default, logoSvg);

export interface BadgeCard {
  /** "Holds up", "Could be luck", ... or "Withdrawn by its owner". */
  verdict: string;
  color: string;
  /** "Survives up to 4 tries". */
  survives: string;
  /** "Self-reported backtest · 212 trades · 2020-01-02 to 2024-03-28". */
  detail: string;
  /** The trust line, shown on live badges only. */
  note?: string;
  id: string;
}

/** A Verify badge's card: the verdict, how many tries it survives and what was checked. */
export function badgeCardSvg(b: BadgeCard, logoSvg: string): string {
  const verdict = wrap(b.verdict, 104, TEXT_W, 1, true);
  const detail = wrap(b.detail, 28, TEXT_W, 1);
  const note = b.note ? wrap(b.note, 22, TEXT_W, 2) : [];
  const body = [
    `<text x="${PAD}" y="206" font-size="22" font-weight="600" letter-spacing="4" fill="#85a8ff">PARITY VERIFY</text>`,
    lines(verdict, PAD, 316, 0, `font-size="104" font-weight="600" letter-spacing="-2" fill="${b.color}"`),
    `<text x="${PAD}" y="382" font-size="44" font-weight="600">${esc(b.survives)}</text>`,
    lines(detail, PAD, 432, 0, `font-size="28" fill="#a3a8b9"`),
    lines(note, PAD, 492, 30, `font-size="22" fill="#a3a8b9"`),
  ].join("\n");
  return frame(body, logoSvg, `${HOST}/v/${b.id}`, b.color);
}
