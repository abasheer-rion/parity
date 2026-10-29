// Renders shareable clips from the sims (DEC-0035, GDE-0008): a 9:16 MP4 for TikTok,
// Reels and Shorts (1080x1920), a 1:1 MP4 (1080x1080) and a GIF under 8 MB, plus a
// manifest with suggested caption text and hashtags. Frames are drawn by scenes.ts,
// photographed by headless Chromium (Playwright) and encoded by ffmpeg.
//
//   cd web && npm run content                      every scene, every format
//   npm run content -- --scenes bot-battle --formats vertical,gif
//   npm run content -- --examples                  also refresh web/public/content/*.gif
//   npm run content -- --signature                 the signature clips (DEC-0067): Academy
//                                                  lessons and methodology explainers, 9:16 and
//                                                  1:1, into ~/Desktop/parity-clips/signature/
//   npm run content -- --signature --stills        one PNG per step instead of video
//   npm run content -- --reels                     the Academy lesson films (DEC-0085): 9:16 and
//                                                  1:1 clips with captions into
//                                                  ~/Desktop/parity-clips/academy-motion/, and the
//                                                  16:9 film the Academy plays with reduced motion
//                                                  into web/public/content/academy/ (reels.ts)
//
// Reads engine/output/bots/ (parity bots export), engine/output/world.json (parity world
// export) and engine/output/latest.json (a strategy run). A scene whose file is missing
// is skipped and the manifest says so. Writes content/out/ at the repo root (ignored by
// git). Nothing is posted anywhere: people post the clips themselves.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Page } from "playwright";
import { allScenes, frame, RISK, SITE, type Data, type Layout, type Scene } from "./scenes.ts";
import { clipFrame, positionAt, signatureClips, timeline, type ClipSize } from "./signature.ts";
import { lessonReels, reelHash } from "./reels.ts";
import { plan, script, vtt } from "../../src/ui/reel/timeline.ts";
import { reelSvg, REEL_SIZES, type ReelSize } from "../../src/ui/reel/render.ts";
import type { BotRunFile, BotsIndex } from "../../src/lib/botStats.ts";
import { RAW } from "../../src/ui/tokens.gen.ts";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, "../../..");

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const flag = (name: string) => process.argv.includes(`--${name}`);

const SIGNATURE = flag("signature");
const REELS = flag("reels");
const DATA = resolve(arg("data", join(ROOT, "engine/output")));
const OUT = resolve(arg("out", REELS ? join(homedir(), "Desktop/parity-clips/academy-motion") : SIGNATURE ? join(homedir(), "Desktop/parity-clips/signature") : join(ROOT, "content/out")));
const FPS = Number(arg("fps", "30"));
const FFMPEG = arg("ffmpeg", existsSync("/opt/homebrew/bin/ffmpeg") ? "/opt/homebrew/bin/ffmpeg" : "ffmpeg");
const WANT = arg("scenes", "all");
const FORMATS = arg("formats", "vertical,square,gif").split(",");
const GIF_LIMIT = 8 * 1024 * 1024;
const EXAMPLE_LIMIT = 2 * 1024 * 1024;
const ALL_IDS = ["bot-battle", "strategy-race", "crisis-replay", "luck-vs-skill", "smoothing-illusion"];

const LAYOUTS: Record<string, Layout> = {
  vertical: { w: 1080, h: 1920, vertical: true },
  square: { w: 1080, h: 1080, vertical: false },
};

function readJson<T>(path: string): T | undefined {
  try { return JSON.parse(readFileSync(path, "utf8")) as T; } catch { return undefined; }
}

function loadData(): Data {
  const d: Data = {};
  const index = readJson<BotsIndex>(join(DATA, "bots/index.json"));
  if (index) {
    const cache = new Map<string, BotRunFile | null>();
    d.bots = { index, run: (id) => { if (!cache.has(id)) cache.set(id, readJson<BotRunFile>(join(DATA, "bots", `${id}.json`)) ?? null); return cache.get(id) ?? null; } };
  }
  d.world = readJson(join(DATA, "world.json"));
  d.report = readJson(join(DATA, "latest.json"));
  return d;
}

function ffmpeg(args: string[]): void {
  const r = spawnSync(FFMPEG, ["-hide_banner", "-loglevel", "error", "-y", ...args], { stdio: ["ignore", "inherit", "inherit"] });
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${args.join(" ")}`);
}

/** Two-pass GIF (a palette made for this clip), shrinking until it fits `limit`. */
function gif(src: string, out: string, limit: number, tries: [number, number][]): { width: number; fps: number; bytes: number } {
  for (const [width, fps] of tries) {
    const vf = `fps=${fps},scale=${width}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`;
    ffmpeg(["-i", src, "-vf", vf, "-loop", "0", out]);
    const bytes = statSync(out).size;
    if (bytes <= limit) return { width, fps, bytes };
  }
  throw new Error(`${out} stays over ${(limit / 1e6).toFixed(1)} MB at every size tried`);
}

/** Show one frame: parse our own SVG markup and swap it in as the page's only child. */
async function show(page: Page, svg: string): Promise<void> {
  await page.evaluate((s) => {
    const doc = new DOMParser().parseFromString(s, "image/svg+xml");
    document.getElementById("r")!.replaceChildren(document.importNode(doc.documentElement, true));
  }, svg);
}

async function renderVideo(page: Page, scene: Scene, layout: Layout, brand: { wordmark: string }, out: string): Promise<number> {
  const n = Math.round(scene.seconds * FPS);
  return encode(page, layout, n, (i) => frame(scene, n > 1 ? i / (n - 1) : 1, layout, brand), out);
}

/** Photographs n frames in headless Chromium and pipes them to ffmpeg as one H.264 MP4. */
async function encode(page: Page, layout: Layout, n: number, frameAt: (i: number) => string, out: string, crf = 20): Promise<number> {
  await page.setViewportSize({ width: layout.w, height: layout.h });
  const enc = spawn(FFMPEG, ["-hide_banner", "-loglevel", "error", "-y", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "-",
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "medium", "-crf", String(crf), "-r", String(FPS), "-movflags", "+faststart", out], { stdio: ["pipe", "inherit", "inherit"] });
  const done = new Promise<void>((ok, fail) => enc.on("close", (code) => (code === 0 ? ok() : fail(new Error(`ffmpeg exited ${code}`)))));
  for (let i = 0; i < n; i++) {
    await show(page, frameAt(i));
    const shot = await page.screenshot({ type: "jpeg", quality: 92 });
    if (!enc.stdin.write(shot)) await new Promise((ok) => enc.stdin.once("drain", ok));
  }
  enc.stdin.end();
  await done;
  return n;
}

/** A headless page with Inter loaded (from Google Fonts when online; the system sans-serif otherwise). */
async function openPage() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  await page.setContent(`<!doctype html><html><head><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=block">
    <style>html,body{margin:0;background:${RAW["color-canvas"]};overflow:hidden}#r svg{display:block}</style></head><body><div id="r"></div></body></html>`, { waitUntil: "load", timeout: 15000 }).catch(() => {});
  await page.evaluate(async () => { await Promise.race([document.fonts.ready, new Promise((ok) => setTimeout(ok, 4000))]); }).catch(() => {});
  return { browser, page };
}

/** The signature clips: every Academy lesson on the signature scenes and the explainers, at 9:16 and 1:1. */
async function signatureMain() {
  const clips = signatureClips(ROOT).filter((c) => WANT === "all" || WANT.split(",").includes(c.id));
  if (!clips.length) throw new Error(`No signature clips match ${WANT}.`);
  const sizes = FORMATS.filter((f): f is ClipSize => f === "vertical" || f === "square");
  if (!sizes.length) throw new Error("Signature clips come in --formats vertical and square.");
  const folder = (size: ClipSize) => join(OUT, size === "vertical" ? "9x16" : "1x1");
  const { browser, page } = await openPage();
  if (flag("stills")) {
    for (const c of clips) for (const size of sizes) {
      const dir = join(folder(size), "stills");
      mkdirSync(dir, { recursive: true });
      await page.setViewportSize({ width: LAYOUTS[size].w, height: LAYOUTS[size].h });
      for (let i = 0; i < c.visual.steps.length; i++) {
        await show(page, clipFrame(c, i, size));
        await page.screenshot({ path: join(dir, `${c.id}-step${i + 1}.png`) });
      }
    }
    await browser.close();
    console.log(`Wrote stills to ${OUT}`);
    return;
  }
  const manifest: Record<string, unknown>[] = [];
  for (const c of clips) {
    const tl = timeline(c.visual);
    const n = Math.round(tl.seconds * FPS);
    const files: { format: string; file: string; bytes: number; frames: number; fps: number }[] = [];
    const t0 = Date.now();
    for (const size of sizes) {
      mkdirSync(folder(size), { recursive: true });
      const out = join(folder(size), `${c.id}.mp4`);
      await encode(page, LAYOUTS[size], n, (i) => clipFrame(c, positionAt(tl.keys, i / FPS), size), out);
      files.push({ format: size === "vertical" ? "mp4 9:16 1080x1920" : "mp4 1:1 1080x1080", file: relative(OUT, out), bytes: statSync(out).size, frames: n, fps: FPS });
    }
    manifest.push({
      id: c.id, title: c.title, seconds: Math.round(tl.seconds * 10) / 10, data: c.tag, alt: c.visual.alt,
      captions: c.visual.steps.map((st) => st.caption), caption: `${c.social.caption}\n\nTry it: ${SITE}`, hashtags: c.social.hashtags,
      on_screen_risk_line: c.risk ?? RISK, files,
    });
    console.log(`${c.id}: ${files.map((f) => `${f.file} ${(f.bytes / 1e6).toFixed(2)} MB`).join(", ")} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  }
  await browser.close();
  const before = readJson<{ clips?: { id: string }[] }>(join(OUT, "manifest.json"))?.clips ?? [];
  const order = signatureClips(ROOT).map((c) => c.id);
  const all = [...before.filter((b) => !manifest.some((m) => m.id === b.id)), ...manifest].sort((a, b) => order.indexOf(a.id as string) - order.indexOf(b.id as string));
  writeFileSync(join(OUT, "manifest.json"), JSON.stringify({
    generated_at: new Date().toISOString(), site: SITE, style: "signature charts (DEC-0067)",
    rules: "Every frame says where its numbers come from (example, hypothetical, simulated or a real run), and the risk line is on screen in every frame. No clip says what to buy or promises a result. Post them yourself; this script never publishes.",
    clips: all,
  }, null, 2));
  console.log(`Wrote ${join(OUT, "manifest.json")}`);
}

/**
 * The Academy lesson films: 9:16 and 1:1 clips with burned-in captions and the risk line for
 * social, and the 16:9 film without burned-in captions (it has a caption file instead) that
 * the Academy plays with reduced motion. academy/reels.json records each film's hash, so a
 * test can tell when a lesson changed and its film needs rendering again.
 */
async function reelsMain() {
  const all = lessonReels(ROOT);
  const films = all.filter((r) => WANT === "all" || WANT.split(",").includes(r.id));
  if (!films.length) throw new Error(`No lesson films match ${WANT}.`);
  const site = join(ROOT, "web/public/content/academy");
  mkdirSync(site, { recursive: true });
  const indexFile = join(ROOT, "academy/reels.json");
  const index = readJson<{ about: string; reels: Record<string, unknown> }>(indexFile) ?? { about: "", reels: {} };
  const social = FORMATS.filter((f): f is ReelSize => f === "vertical" || f === "square");
  const folder = (size: ReelSize) => join(OUT, size === "vertical" ? "9x16" : size === "square" ? "1x1" : "16x9");
  const { browser, page } = await openPage();
  const manifest: Record<string, unknown>[] = [];
  for (const f of films) {
    const P = plan(f.reel);
    const n = Math.round(P.seconds * FPS);
    const t0 = Date.now();
    const files: { format: string; file: string; bytes: number }[] = [];
    for (const size of social) {
      mkdirSync(folder(size), { recursive: true });
      const out = join(folder(size), `${f.id}.mp4`);
      const c = REEL_SIZES[size];
      await encode(page, { w: c.w, h: c.h, vertical: size === "vertical" }, n, (i) => reelSvg(f.reel, f.visual, P, i / FPS, { size, captions: true, risk: `${f.risk} ${SITE}`, id: "r" }), out);
      files.push({ format: `mp4 ${size === "vertical" ? "9:16" : "1:1"} ${c.w}x${c.h}`, file: relative(OUT, out), bytes: statSync(out).size });
    }
    if (!flag("no-site")) {
      const c = REEL_SIZES.wide;
      const out = join(site, `${f.id}.mp4`);
      await encode(page, { w: c.w, h: c.h, vertical: false }, n, (i) => reelSvg(f.reel, f.visual, P, i / FPS, { size: "wide", risk: f.risk, id: "r" }), out, 28);
      writeFileSync(join(site, `${f.id}.vtt`), vtt(P));
      index.reels[f.id] = { hash: reelHash(f.reel, f.visual), seconds: Math.round(P.seconds * 10) / 10, mp4: `/content/academy/${f.id}.mp4`, vtt: `/content/academy/${f.id}.vtt` };
      files.push({ format: `mp4 16:9 ${c.w}x${c.h} (Academy, reduced motion)`, file: relative(ROOT, out), bytes: statSync(out).size });
    }
    mkdirSync(OUT, { recursive: true });
    writeFileSync(join(OUT, `${f.id}.vtt`), vtt(P));
    writeFileSync(join(OUT, `${f.id}.script.txt`), script(P));
    manifest.push({ id: f.id, title: f.title, seconds: Math.round(P.seconds * 10) / 10, alt: f.reel.alt, tag: f.reel.tag, on_screen_risk_line: f.risk, captions: `${f.id}.vtt`, voice_over_script: `${f.id}.script.txt`, files });
    console.log(`${f.id}: ${files.map((x) => `${x.file} ${(x.bytes / 1e6).toFixed(2)} MB`).join(", ")} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  }
  await browser.close();
  const order = all.map((r) => r.id);
  index.reels = Object.fromEntries(Object.entries(index.reels).filter(([k]) => order.includes(k)).sort(([a], [b]) => order.indexOf(a) - order.indexOf(b)));
  writeFileSync(indexFile, JSON.stringify(index, null, 1) + "\n");
  const before = readJson<{ clips?: { id: string }[] }>(join(OUT, "manifest.json"))?.clips ?? [];
  const clips = [...before.filter((b) => !manifest.some((m) => m.id === b.id)), ...manifest].sort((a, b) => order.indexOf(a.id as string) - order.indexOf(b.id as string));
  writeFileSync(join(OUT, "manifest.json"), JSON.stringify({
    generated_at: new Date().toISOString(), site: SITE, style: "Academy motion films (DEC-0085)",
    rules: "Every frame says what its numbers are and carries the risk line. No clip says what to buy or promises a result. Post them yourself; this script never publishes.",
    clips,
  }, null, 2));
  console.log(`Wrote ${join(OUT, "manifest.json")} and ${relative(ROOT, indexFile)}`);
}

async function main() {
  if (REELS) return reelsMain();
  if (SIGNATURE) return signatureMain();
  const data = loadData();
  const available = allScenes(data);
  const scenes = available.filter((s) => WANT === "all" || WANT.split(",").includes(s.id));
  const skipped = ALL_IDS.filter((id) => !available.some((s) => s.id === id));
  if (!scenes.length) throw new Error(`No scenes to render (wanted ${WANT}; missing data for ${skipped.join(", ") || "none"}).`);
  mkdirSync(OUT, { recursive: true });
  const svg = readFileSync(join(ROOT, "web/public/brand/2026-10-22-wordmark/parity-wordmark-on-dark.svg"));
  const brand = { wordmark: `data:image/svg+xml;base64,${svg.toString("base64")}` };

  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  // Inter from Google Fonts when online; the system sans-serif otherwise.
  await page.setContent(`<!doctype html><html><head><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=block">
    <style>html,body{margin:0;background:${RAW["color-surface"]};overflow:hidden}#r svg{display:block}</style></head><body><div id="r"></div></body></html>`, { waitUntil: "load", timeout: 15000 }).catch(() => {});
  await page.evaluate(async () => { await Promise.race([document.fonts.ready, new Promise((ok) => setTimeout(ok, 4000))]); }).catch(() => {});

  // --stills: a few PNG frames per scene and layout, to check a design without encoding.
  if (flag("stills")) {
    for (const scene of scenes) for (const [name, layout] of Object.entries(LAYOUTS)) {
      await page.setViewportSize({ width: layout.w, height: layout.h });
      for (const t of [0.05, 0.5, 0.85, 0.99]) {
        await show(page, frame(scene, t, layout, brand));
        await page.screenshot({ path: join(OUT, `still-${scene.id}-${name}-${Math.round(t * 100)}.png`) });
      }
    }
    await browser.close();
    console.log(`Wrote stills to ${OUT}`);
    return;
  }

  const manifest: Record<string, unknown>[] = [];
  for (const scene of scenes) {
    const files: { format: string; file: string; bytes: number; frames?: number; fps?: number }[] = [];
    const t0 = Date.now();
    for (const f of FORMATS.filter((x) => LAYOUTS[x])) {
      const out = join(OUT, `${scene.id}-${f === "vertical" ? "9x16" : "1x1"}.mp4`);
      const frames = await renderVideo(page, scene, LAYOUTS[f], brand, out);
      files.push({ format: f === "vertical" ? "mp4 9:16 1080x1920" : "mp4 1:1 1080x1080", file: relative(OUT, out), bytes: statSync(out).size, frames, fps: FPS });
    }
    if (FORMATS.includes("gif") || flag("examples")) {
      let sq = join(OUT, `${scene.id}-1x1.mp4`);
      const temp = !FORMATS.includes("square");
      if (temp) { sq = join(OUT, `${scene.id}-1x1.tmp.mp4`); await renderVideo(page, scene, LAYOUTS.square, brand, sq); }
      if (FORMATS.includes("gif")) {
        const out = join(OUT, `${scene.id}.gif`);
        const g = gif(sq, out, GIF_LIMIT, [[540, 12], [480, 10], [400, 8]]);
        files.push({ format: `gif ${g.width}px ${g.fps} fps`, file: relative(OUT, out), bytes: g.bytes });
      }
      if (flag("examples")) {
        const dir = join(ROOT, "web/public/content");
        mkdirSync(dir, { recursive: true });
        const out = join(dir, `${scene.id}.gif`);
        const g = gif(sq, out, EXAMPLE_LIMIT, [[360, 8], [320, 7], [280, 6]]);
        files.push({ format: `example gif ${g.width}px ${g.fps} fps (site)`, file: relative(OUT, out), bytes: g.bytes });
      }
      if (temp) rmSync(sq);
    }
    manifest.push({
      id: scene.id, title: scene.hook, seconds: scene.seconds, period: scene.period,
      caption: `${scene.social.caption}\n\nTry it: ${SITE}`, hashtags: scene.social.hashtags,
      on_screen_risk_line: RISK, files,
    });
    console.log(`${scene.id}: ${files.map((f) => `${f.file} ${(f.bytes / 1e6).toFixed(2)} MB`).join(", ")} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  }
  await browser.close();
  // Keep earlier entries for scenes not rendered this time, so one scene can be redone alone.
  const before = readJson<{ clips?: { id: string }[] }>(join(OUT, "manifest.json"))?.clips ?? [];
  const clips = [...before.filter((c) => !manifest.some((m) => m.id === c.id)), ...manifest]
    .sort((a, b) => ALL_IDS.indexOf(a.id as string) - ALL_IDS.indexOf(b.id as string));
  const doc = {
    generated_at: new Date().toISOString(), site: SITE,
    rules: "Every number is labelled hypothetical, backtested or simulated, with its period. The risk line is on screen in every frame. No clip says what to buy or promises a result. Post them yourself; this script never publishes.",
    skipped_for_missing_data: skipped, clips,
  };
  writeFileSync(join(OUT, "manifest.json"), JSON.stringify(doc, null, 2));
  console.log(`Wrote ${join(OUT, "manifest.json")}${skipped.length ? `; skipped ${skipped.join(", ")} (no data)` : ""}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
