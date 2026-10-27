// Screenshots of the app's windows for checking a build (DEC-0049), with no screen-recording
// permission needed: each window is drawn from its own views (title bar, offline line, page,
// and the menu layer blended on top). Runs only when PARITY_SHOTS names a folder.
//
//   PARITY_SHOTS=<folder>        where the PNG files go
//   PARITY_SHOTS_STEPS=a,b,...   what to do, in order (default: wall). Steps:
//       wall      the window as it opened (signed out: the log-in wall)
//       menu      open the sections menu and capture it
//       palette   open the command palette and capture it
//       trade     open Trade full window and capture it
//       window2   open Research in a second window and capture that window
//       quit      quit the app (always last)
//   PARITY_SHOTS_WAIT=<ms>       how long each page gets to draw (default 6000)
const { app, nativeImage } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function bits(img) {
  const size = img.getSize();
  const buf = img.toBitmap();
  const w = Math.round(Math.sqrt((buf.length / 4) * (size.width / size.height))) || size.width;
  return { buf, w, h: Math.round(buf.length / 4 / w) };
}

/** Draws `src` into `out` at row `y0` and column `x0`, blending by alpha (BGRA, premultiplied or not, treated as straight). */
function blit(out, W, H, src, y0, x0 = 0) {
  for (let y = 0; y < src.h && y0 + y < H; y++) {
    for (let x = 0; x < src.w && x0 + x < W; x++) {
      const s = (y * src.w + x) * 4, d = ((y0 + y) * W + x0 + x) * 4;
      const a = src.buf[s + 3] / 255;
      if (a >= 0.999) { out[d] = src.buf[s]; out[d + 1] = src.buf[s + 1]; out[d + 2] = src.buf[s + 2]; out[d + 3] = 255; }
      else if (a > 0) {
        for (let c = 0; c < 3; c++) out[d + c] = Math.round(src.buf[s + c] + out[d + c] * (1 - a));
        out[d + 3] = 255;
      }
    }
  }
}

async function captureWindow(w) {
  const parts = [];
  const pageY = w.active?.view.getBounds().y ?? 0;
  if (w.active?.saved) parts.push({ view: w.bar, y: w.bar.getBounds().y });
  if (w.active) parts.push({ view: w.active.view, y: pageY });
  // The controls sit over the page's header row (or on their own strip above a page without one).
  if (!w.focusMode) parts.push({ view: w.titlebar, y: 0, x: w.titlebar.getBounds().x, overlay: !w.strip });
  if (w.overlayMode) parts.push({ view: w.overlay, y: w.overlay.getBounds().y, overlay: true });
  const { width, height } = w.win.getContentBounds();
  const imgs = [];
  for (const p of parts) imgs.push({ ...p, img: bits(await p.view.webContents.capturePage()) });
  const scale = imgs.length ? imgs[imgs.length - 1].img.w / width : 1;
  const W = Math.round(width * scale), H = Math.round(height * scale);
  const out = Buffer.alloc(W * H * 4);
  for (let i = 0; i < out.length; i += 4) { out[i] = 8; out[i + 1] = 6; out[i + 2] = 5; out[i + 3] = 255; }
  for (const p of imgs) blit(out, W, H, p.img, Math.round(p.y * scale), Math.round((p.x || 0) * scale));
  return nativeImage.createFromBitmap(out, { width: W, height: H, scaleFactor: scale }).toPNG();
}

async function run(api) {
  const dir = process.env.PARITY_SHOTS;
  fs.mkdirSync(dir, { recursive: true });
  const steps = (process.env.PARITY_SHOTS_STEPS || "wall").split(",").map((s) => s.trim()).filter(Boolean);
  const ms = Number(process.env.PARITY_SHOTS_WAIT || 6000);
  let n = 0;
  const save = async (w, name) => {
    const file = path.join(dir, `${String(++n).padStart(2, "0")}-${name}.png`);
    try { fs.writeFileSync(file, await captureWindow(w)); console.log(`wrote ${file}`); } catch (e) { console.log(`capture ${name} failed: ${e.message}`); }
  };
  await wait(ms);
  for (const step of steps) {
    const w = api.focused();
    if (!w) break;
    if (step === "wall") await save(w, "window");
    else if (step === "menu") { w.openOverlay("menu"); await wait(700); await save(w, "menu-open"); w.closeOverlay(); }
    else if (step === "palette") { w.openOverlay("palette"); await wait(700); await save(w, "palette"); w.closeOverlay(); }
    else if (step === "trade") { w.openSection("trade"); await wait(ms); await save(w, "trade"); }
    else if (step === "window2") { const w2 = api.newWindow("/research/"); await wait(ms); if (w2) await save(w2, "second-window"); }
    else if (step === "quit") break;
  }
  app.quit();
}

module.exports = { run, captureWindow };
