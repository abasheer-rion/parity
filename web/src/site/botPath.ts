// The front page's Bot Battle moment (DEC-0039): a bot that wins 99.1% of its trades and
// still turns $10,000 into $992. The end figures are the real Double down result on US
// stocks from 1928 (DEC-0035). The path in between is drawn for illustration, not taken
// from the replay: 228 small wins, two large losses, in the order a doubling-down bot
// meets them. plugins/site.ts draws it at build time; main.ts plays it on scroll.
import { rng } from "./fieldModel";

export const START = 10_000;
export const END = 992;
export const TRADES = 230;
export const LOSSES = [141, 229];
export const Y_TOP = 16_000;

export interface Trade { balance: number; win: boolean }

export function botTrades(): Trade[] {
  const r = rng(35);
  const out: Trade[] = [];
  let b = START;
  for (let i = 0; i < TRADES; i++) {
    if (i === LOSSES[0]) b *= 0.41;
    else if (i === LOSSES[1]) b = END;
    else b *= 1 + 0.0012 + r() * 0.003;
    out.push({ balance: Math.round(b), win: !LOSSES.includes(i) });
  }
  return out;
}

export const W = 640, H = 300, PAD_T = 18, PAD_B = 14;
export const bx = (i: number) => (i / (TRADES - 1)) * W;
export const by = (v: number) => PAD_T + (1 - v / Y_TOP) * (H - PAD_T - PAD_B);

const r1 = (n: number) => Math.round(n * 10) / 10;

/** The balance chart as SVG, for the build. Every part shows with no script. */
export function botChartSvg(): string {
  const t = botTrades();
  const pts = [`0,${r1(by(START))}`, ...t.map((x, i) => `${r1(bx(i))},${r1(by(x.balance))}`)].join(" ");
  const start = r1(by(START));
  const grid = [0, 5000, 10000, 15000].map((v) => `<line x1="0" x2="${W}" y1="${r1(by(v))}" y2="${r1(by(v))}"/>`).join("");
  return `<svg class="bot-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true" focusable="false" data-b="${t.map((x) => x.balance).join(",")}">`
    + `<g class="bot-grid">${grid}</g>`
    + `<line class="bot-start" x1="0" x2="${W}" y1="${start}" y2="${start}"/>`
    + `<polyline class="bot-line" pathLength="1" points="${pts}"/>`
    + `</svg>`;
}

/** The strip of trades under the chart: a short green tick per win, a tall red one per loss. */
export function botTapeSvg(): string {
  const bars = botTrades().map((x, i) => `<rect class="${x.win ? "w" : "l"}" x="${r1(bx(i) - 0.9)}" y="${x.win ? 6 : 0}" width="1.8" height="${x.win ? 10 : 22}"/>`).join("");
  return `<svg class="bot-tape" viewBox="-2 0 ${W + 4} 22" preserveAspectRatio="none" aria-hidden="true" focusable="false">${bars}</svg>`;
}
