// The report's image card as a PNG, made in the browser (DEC-0089): the card's SVG, with the
// Inter font embedded so it looks the same everywhere, drawn onto a canvas at twice the size
// for sharp text. Nothing is sent anywhere; the file is downloaded or handed to the phone's
// share sheet.
import interUrl from "../../../lib/og/fonts/inter-600.bin?url";
import interRegularUrl from "../../../lib/og/fonts/inter-400.bin?url";
import { reportCardSvg } from "../../../lib/verify/report/card";
import type { ReportData } from "../../../lib/verify/report/model";

const LOGO = "/brand/2026-10-22-wordmark/parity-lockup-on-dark.svg";

async function dataUrl(url: string, type: string): Promise<string> {
  const buf = new Uint8Array(await (await fetch(url)).arrayBuffer());
  let s = "";
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return `data:${type};base64,${btoa(s)}`;
}

/** The card as SVG text, with the font embedded. */
export async function cardSvgFor(d: ReportData): Promise<string> {
  const [logo, f600, f400] = await Promise.all([
    fetch(LOGO).then((r) => (r.ok ? r.text() : "")).catch(() => ""),
    dataUrl(interUrl, "font/ttf").catch(() => ""),
    dataUrl(interRegularUrl, "font/ttf").catch(() => ""),
  ]);
  const css = [f400 && `@font-face{font-family:Inter;font-weight:400;src:url(${f400}) format("truetype")}`, f600 && `@font-face{font-family:Inter;font-weight:600;src:url(${f600}) format("truetype")}`].filter(Boolean).join("");
  return reportCardSvg(d, logo, css);
}

/** The card as a PNG blob, 2400 by 1260. */
export async function cardPng(d: ReportData): Promise<Blob> {
  const svg = await cardSvgFor(d);
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    img.decoding = "async";
    await new Promise<void>((ok, fail) => { img.onload = () => ok(); img.onerror = () => fail(new Error("card did not draw")); img.src = url; });
    const canvas = document.createElement("canvas");
    canvas.width = 2400; canvas.height = 1260;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no canvas");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((ok, fail) => canvas.toBlob((b) => (b ? ok(b) : fail(new Error("no png"))), "image/png"));
  } finally {
    URL.revokeObjectURL(url);
  }
}

export const cardFileName = (d: ReportData) => `parity-verify-${d.verdict.id.replace(/_/g, "-")}-${d.checkedOn}.png`;
