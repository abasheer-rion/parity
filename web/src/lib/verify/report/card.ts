// The report's image card for social posts and chats (DEC-0089): 1200 by 630, the size link
// previews use, in the same frame as the site's share cards (src/lib/og/card.ts). The
// verdict, how many tries it survives, what was checked and a small line of its growth. Pure
// string work: the page turns it into a PNG in the browser, and tests read the SVG.
import { frame, W, wrap } from "../../og/card";
import { HOST } from "../../meta";
import { RAW } from "../../../ui/tokens.gen";
import { survivesText } from "../checks/verdict";
import { VERDICT_COLOR } from "../badge";
import type { ReportData } from "./model";
import { count } from "../words";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const PAD = 80;

/** A small line of the record's growth (or profit so far), with the benchmark in grey. */
function spark(d: ReportData, x: number, y: number, w: number, h: number): string {
  const c = d.curve;
  if (!c || c.values.length < 2) return "";
  const all = [...c.values, ...(c.bench ?? []).filter((v): v is number => v != null)];
  const lo = Math.min(...all), hi = Math.max(...all);
  const span = hi - lo || 1;
  const px = (i: number) => x + (i / (c.values.length - 1)) * w;
  const py = (v: number) => y + h - ((v - lo) / span) * h;
  const path = (vals: (number | null)[]) => vals.map((v, i) => (v == null ? "" : `${i === 0 || vals[i - 1] == null ? "M" : "L"}${px(i).toFixed(1)} ${py(v).toFixed(1)}`)).join("");
  const end = c.values[c.values.length - 1];
  const up = c.unit === "growth" ? end >= 1 : end >= 0;
  const col = up ? RAW["color-positive"] : RAW["color-negative"];
  return [
    c.bench ? `<path d="${path(c.bench)}" fill="none" stroke="${RAW["color-text-muted"]}" stroke-width="2" stroke-opacity=".7"/>` : "",
    `<path d="${path(c.values)}" fill="none" stroke="${col}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>`,
    `<circle cx="${px(c.values.length - 1).toFixed(1)}" cy="${py(end).toFixed(1)}" r="7" fill="${col}"/>`,
  ].join("");
}

/** The card as SVG. `fontCss` embeds the font when the SVG is drawn in a browser. */
export function reportCardSvg(d: ReportData, logoSvg: string, fontCss = ""): string {
  const color = VERDICT_COLOR[d.verdict.id];
  const left = W - PAD * 2 - 360;
  const verdict = wrap(d.verdict.label, 96, W - PAD * 2, 1, true);
  const survives = d.c3 ? survivesText(d.c3.survives) : d.source === "description" ? "A claim, not a record" : "Luck check not measured";
  const parts = [d.what, d.trades != null ? count(d.trades, "trade") : null, d.dateFrom && d.dateTo ? `${d.dateFrom.slice(0, 7)} to ${d.dateTo.slice(0, 7)}` : null].filter(Boolean) as string[];
  const detail = wrap(parts.join(" · "), 26, left, 1);
  const sentence = wrap(d.verdict.sentence, 22, left, 2);
  const body = [
    fontCss ? `<style>${fontCss}</style>` : "",
    `<text x="${PAD}" y="196" font-size="24" font-weight="600" fill="${RAW["color-accent-text"]}">Parity Verify</text>`,
    `<text x="${PAD}" y="292" font-size="96" font-weight="600" letter-spacing="-2" fill="${color}">${esc(verdict[0] ?? "")}</text>`,
    `<text x="${PAD}" y="364" font-size="40" font-weight="600">${esc(survives)}</text>`,
    `<text x="${PAD}" y="412" font-size="26" fill="${RAW["color-text-muted"]}">${esc(detail[0] ?? "")}</text>`,
    ...sentence.map((l, i) => `<text x="${PAD}" y="${460 + i * 30}" font-size="22" fill="${RAW["color-text-muted"]}">${esc(l)}</text>`),
    spark(d, W - PAD - 320, 340, 320, 150),
  ].join("\n");
  return frame(body, logoSvg, `${HOST}/verify · method ${d.method} · checked ${d.checkedOn}`, color);
}
