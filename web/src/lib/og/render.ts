/// <reference path="./modules.d.ts" />
// Turns a share card's SVG into a PNG inside a Cloudflare function (DEC-0038). resvg runs
// as WebAssembly in the function itself, with Inter loaded from the two font files, so no
// outside service is called. Social sites do not show SVG previews, only PNG and JPEG.
import { initWasm, Resvg } from "@resvg/resvg-wasm";
import wasm from "@resvg/resvg-wasm/index_bg.wasm";
import inter400 from "./fonts/inter-400.bin";
import inter600 from "./fonts/inter-600.bin";

let ready: Promise<void> | null = null;

export async function svgToPng(svg: string): Promise<Uint8Array> {
  ready ??= initWasm(wasm).catch((e: unknown) => { ready = null; throw e; });
  await ready;
  const resvg = new Resvg(svg, {
    fitTo: { mode: "original" },
    font: { fontBuffers: [new Uint8Array(inter400), new Uint8Array(inter600)], defaultFontFamily: "Inter" },
  });
  try {
    return resvg.render().asPng();
  } finally {
    resvg.free();
  }
}
