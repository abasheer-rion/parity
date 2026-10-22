// The front page's large scale sim: thousands of illustrative paths fanning out from
// today, drawn on two canvases. Loaded by main.ts only when the section comes near the
// screen, after the page has finished loading.
//   - Each scenario's paths are stroked once, whole, onto a hidden canvas (eight
//     strokes, one per colour). Each frame then copies the next thin slice of it onto
//     the visible trails canvas, so the paths appear to grow from left to right.
//   - The heads canvas is cleared each frame: the moving front of every path as a
//     point cloud, then the 5th, 50th and 95th percentile lines once the paths land.
// It pauses when off screen or when the tab is hidden. With reduced motion it draws
// one finished picture and stops. The model is in simModel.ts; it is illustrative only.
import { bands, finalRanks, RAMP, rng, SCENARIOS, simulate, WEEKS, Y_MAX, Y_MIN } from "./simModel";

const DRAW_MS = 6200;
const HOLD_MS = 2800;
const FADE_MS = 900;

interface Layout { w: number; h: number; dpr: number; ox: number; right: number; top: number; bottom: number; narrow: boolean }

export function startSim(stage: HTMLElement, opts: { reduce: boolean; onScenario?: (label: string) => void; onDrawn?: (total: number) => void }) {
  const trails = document.createElement("canvas");
  const heads = document.createElement("canvas");
  trails.className = "sim-canvas sim-trails";
  heads.className = "sim-canvas sim-heads";
  for (const c of [trails, heads]) { c.setAttribute("aria-hidden", "true"); stage.appendChild(c); }
  const tctx = trails.getContext("2d")!;
  const off = document.createElement("canvas");
  const octx = off.getContext("2d")!;
  const hctx = heads.getContext("2d")!;

  let L: Layout = measure();
  let count = 0;
  let paths: Float32Array = new Float32Array(0);
  let ranks: Float32Array = new Float32Array(0);
  let band: [Float32Array, Float32Array, Float32Array] | null = null;
  let past: number[] = [];
  let scenarioIndex = 0;
  let cycleStart = 0;
  let drawnPx = 0;
  let total = 0;
  let counted = false;
  let running = false;
  let raf = 0;
  let pausedAt = 0;

  function measure(): Layout {
    const r = stage.getBoundingClientRect();
    const narrow = r.width < 900;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    return {
      w: Math.max(1, r.width), h: Math.max(1, r.height), dpr, narrow,
      // Wide screens: today sits just right of the text column (1120px wrap, 430px copy).
      ox: narrow ? Math.round(r.width * 0.1) : Math.round(Math.max(r.width * 0.44, Math.max(0, (r.width - 1120) / 2) + 20 + 430 + 56)),
      right: narrow ? 64 : 104, top: narrow ? 40 : 64, bottom: 40,
    };
  }

  function size() {
    for (const c of [trails, heads, off]) {
      c.width = Math.round(L.w * L.dpr);
      c.height = Math.round(L.h * L.dpr);
    }
    tctx.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
    hctx.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
    octx.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
  }

  const X = (w: number) => L.ox + ((L.w - L.ox - L.right) * w) / WEEKS;
  const Y = (v: number) => L.top + ((Y_MAX - v) / (Y_MAX - Y_MIN)) * (L.h - L.top - L.bottom);

  function newCycle(now: number) {
    const sc = SCENARIOS[scenarioIndex % SCENARIOS.length];
    count = opts.reduce ? 1200 : L.narrow ? 1400 : 3000;
    const seed = 1000 + scenarioIndex * 7919;
    paths = simulate(count, sc, seed);
    ranks = finalRanks(paths, count);
    band = bands(paths, count);
    // The past: one quiet line walking in from the left edge to today.
    const r = rng(42);
    const steps = 70;
    past = [];
    let v = 0;
    for (let i = 0; i < steps; i++) { past.push(v); v -= 0.0016 + 0.022 * (r() - 0.5) * 2; }
    past.reverse();
    renderPaths();
    tctx.clearRect(0, 0, L.w, L.h);
    trails.style.opacity = "1";
    drawnPx = 0;
    counted = false;
    cycleStart = now;
    opts.onScenario?.(sc.label);
  }

  function bucketOf(i: number) { return Math.min(RAMP.length - 1, Math.floor(ranks[i] * RAMP.length)); }

  /** Strokes every path, whole, onto the hidden canvas. */
  function renderPaths() {
    const n = WEEKS + 1;
    octx.clearRect(0, 0, L.w, L.h);
    octx.globalCompositeOperation = "lighter";
    // Wider than one device pixel, so the lines are filled shapes, not hairlines that
    // draw each joint twice and leave bright vertical stripes.
    octx.lineWidth = 1.3 / Math.min(L.dpr, 1.3);
    octx.globalAlpha = L.narrow ? 0.06 : 0.042;
    octx.lineJoin = "round";
    const xs = Array.from({ length: n }, (_, w) => X(w));
    for (let b = 0; b < RAMP.length; b++) {
      octx.strokeStyle = RAMP[b];
      octx.beginPath();
      for (let i = 0; i < count; i++) {
        if (bucketOf(i) !== b) continue;
        const base = i * n;
        octx.moveTo(xs[0], Y(paths[base]));
        for (let w = 1; w < n; w++) octx.lineTo(xs[w], Y(paths[base + w]));
      }
      octx.stroke();
    }
    octx.globalAlpha = 1;
    octx.globalCompositeOperation = "source-over";
  }

  /** Shows the hidden canvas up to x (in CSS pixels), copying only the new slice. */
  function addTrails(x: number) {
    const to = Math.min(off.width, Math.ceil(x * L.dpr));
    if (to <= drawnPx) return;
    tctx.save();
    tctx.setTransform(1, 0, 0, 1, 0, 0);
    tctx.drawImage(off, drawnPx, 0, to - drawnPx, off.height, drawnPx, 0, to - drawnPx, off.height);
    tctx.restore();
    drawnPx = to;
  }

  function drawFrame(axisAlpha: number) {
    const c = hctx;
    c.clearRect(0, 0, L.w, L.h);
    c.font = "500 11px Inter, system-ui, sans-serif";
    c.textBaseline = "middle";
    // The starting value, a hairline across the future.
    const y0 = Y(0);
    c.globalAlpha = axisAlpha;
    c.strokeStyle = "rgba(169,182,255,0.16)";
    c.setLineDash([2, 4]);
    c.beginPath(); c.moveTo(L.ox, y0); c.lineTo(L.w - L.right + 8, y0); c.stroke();
    c.setLineDash([]);
    // Today: a vertical hairline and a label.
    c.strokeStyle = "rgba(169,182,255,0.22)";
    c.beginPath(); c.moveTo(L.ox, L.top - 18); c.lineTo(L.ox, L.h - L.bottom + 8); c.stroke();
    c.fillStyle = "#a3a8b9";
    c.textAlign = "center";
    c.fillText("Today", L.ox, L.h - L.bottom + 22);
    c.fillText("1 year", X(52), L.h - L.bottom + 22);
    c.fillText("2 years", X(WEEKS), L.h - L.bottom + 22);
    // The past line.
    c.strokeStyle = "rgba(201,205,217,0.5)";
    c.lineWidth = 1.2;
    c.beginPath();
    past.forEach((v, i) => {
      const x = (L.ox * i) / (past.length - 1);
      if (i) c.lineTo(x, Y(v)); else c.moveTo(x, Y(v));
    });
    c.stroke();
    c.fillStyle = "#eef0f8";
    c.beginPath(); c.arc(L.ox, y0, 3, 0, Math.PI * 2); c.fill();
    c.globalAlpha = 1;
  }

  function drawHeads(week: number) {
    const n = WEEKS + 1;
    const w0 = Math.floor(week), w1 = Math.min(WEEKS, w0 + 1), f = week - w0;
    const x = X(week);
    const c = hctx;
    c.globalAlpha = 0.75;
    for (let b = 0; b < RAMP.length; b++) {
      c.fillStyle = RAMP[b];
      for (let i = 0; i < count; i++) {
        if (bucketOf(i) !== b) continue;
        const base = i * n;
        const v = paths[base + w0] * (1 - f) + paths[base + w1] * f;
        c.fillRect(x - 0.8, Y(v) - 0.8, 1.6, 1.6);
      }
    }
    c.globalAlpha = 1;
  }

  function drawBands(alpha: number) {
    if (!band) return;
    const c = hctx;
    const names = ["Worst 5%", "Middle", "Best 5%"];
    const styles = ["rgba(143,176,255,0.9)", "rgba(244,245,250,0.95)", "rgba(143,224,191,0.9)"];
    c.globalAlpha = alpha;
    band.forEach((line, k) => {
      c.strokeStyle = styles[k];
      c.lineWidth = k === 1 ? 1.6 : 1.1;
      c.setLineDash(k === 1 ? [] : [4, 4]);
      c.beginPath();
      for (let w = 0; w <= WEEKS; w++) { if (w) c.lineTo(X(w), Y(line[w])); else c.moveTo(X(w), Y(line[w])); }
      c.stroke();
      c.setLineDash([]);
      const end = Math.exp(line[WEEKS]) - 1;
      c.fillStyle = styles[k];
      c.textAlign = "left";
      c.font = "500 11px Inter, system-ui, sans-serif";
      const pctText = `${end >= 0 ? "+" : "−"}${Math.abs(end * 100).toFixed(0)}%`;
      c.fillText(L.narrow ? pctText : `${names[k]} ${pctText}`, X(WEEKS) + 8, Y(line[WEEKS]));
    });
    c.globalAlpha = 1;
  }

  function still() {
    newCycle(performance.now());
    addTrails(L.w);
    drawFrame(1);
    drawBands(1);
    total = count;
    opts.onDrawn?.(total);
  }

  function tick(now: number) {
    raf = 0;
    if (!running) return;
    const t = now - cycleStart;
    if (t < DRAW_MS) {
      const p = t / DRAW_MS;
      const eased = 1 - Math.pow(1 - p, 1.6);
      const week = eased * WEEKS;
      addTrails(X(week));
      drawFrame(Math.min(1, t / 500));
      drawHeads(week);
    } else if (t < DRAW_MS + HOLD_MS) {
      addTrails(L.w);
      if (!counted) { counted = true; total += count; opts.onDrawn?.(total); }
      drawFrame(1);
      drawBands(Math.min(1, (t - DRAW_MS) / 600));
    } else if (t < DRAW_MS + HOLD_MS + FADE_MS) {
      const a = 1 - (t - DRAW_MS - HOLD_MS) / FADE_MS;
      trails.style.opacity = String(Math.max(0, a));
      drawFrame(1);
      drawBands(a);
    } else {
      scenarioIndex++;
      newCycle(now);
    }
    raf = requestAnimationFrame(tick);
  }

  function play() {
    if (running || opts.reduce) return;
    running = true;
    // Resume where it paused, so the sweep does not jump.
    if (pausedAt) { cycleStart += performance.now() - pausedAt; pausedAt = 0; }
    raf = requestAnimationFrame(tick);
  }
  function pause() {
    if (!running) return;
    running = false;
    pausedAt = performance.now();
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  size();
  if (opts.reduce) still();
  // Start paused; the first play() begins the sweep from its first frame.
  else { newCycle(performance.now()); pausedAt = performance.now(); }
  stage.classList.add("live");

  let visible = false;
  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible && !document.hidden) play(); else pause();
  }, { threshold: 0.05 });
  io.observe(stage);
  document.addEventListener("visibilitychange", () => { if (document.hidden) pause(); else if (visible) play(); });

  // On a size change, start the current scenario again at the new size.
  let resizeTimer = 0;
  let lastW = L.w;
  new ResizeObserver(() => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      const next = measure();
      if (Math.abs(next.w - lastW) < 2 && Math.abs(next.h - L.h) < 2) return;
      L = next; lastW = next.w;
      size();
      if (opts.reduce) { still(); return; }
      newCycle(performance.now());
      if (!running) pausedAt = performance.now();
    }, 150);
  }).observe(stage);
}
