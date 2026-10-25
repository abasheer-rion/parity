// The hero's moving field (DEC-0039), in plain WebGL so it adds about 3 kB, not three.js.
// Every point is worked out on the GPU from its path's numbers and the time, so thousands
// move at 60 frames a second on a laptop. The shapes come from fieldModel.ts, the same
// numbers the still picture is drawn from. The field:
//   - draws inside the box the still picture sits in (.field-box), so CSS sets the layout;
//   - stops when the hero is off screen or the tab is hidden;
//   - draws fewer points if frames run slow;
//   - fades as the hero scrolls away.
import { makePaths } from "./fieldModel";

const VERT = `
attribute vec4 aA; attribute vec4 aB; attribute vec4 aC;
uniform float uT; uniform vec2 uRes; uniform vec4 uBox; uniform float uDpr; uniform float uFade;
varying float vA; varying float vS;
void main() {
  float u = fract(aC.z + uT / aC.y);
  float n = 0.5 * sin(u * aB.x + aA.x) + 0.3 * sin(u * aB.y + aA.y) + 0.2 * sin(u * aB.z + aA.z);
  float c = smoothstep(0.18, 1.0, u);
  float cloud = (aA.w * 0.82 + n * 0.3) * (1.0 - 0.45 * c);
  float lineY = -0.1 + 0.32 * u;
  float surv = step(0.5, aC.x);
  float y = mix(cloud, cloud + (lineY - cloud) * pow(c, 0.75), surv);
  float fadeIn = smoothstep(0.0, 0.08, u);
  float aS = fadeIn * (0.55 + 0.45 * smoothstep(0.3, 0.9, u)) * (1.0 - smoothstep(0.985, 1.0, u));
  float aN = fadeIn * (1.0 - smoothstep(aB.w - 0.1, aB.w, u)) * (0.75 - 0.35 * u);
  float tail = fract(aC.x) * 2.0;
  vA = mix(aN, aS, surv) * uFade * (1.0 - tail * 0.85);
  vS = surv;
  float px = mix(uBox.x, uBox.y, u);
  float py = uBox.z - y * uBox.w;
  gl_Position = vec4(px / uRes.x * 2.0 - 1.0, 1.0 - py / uRes.y * 2.0, 0.0, 1.0);
  gl_PointSize = aC.w * uDpr * (1.0 - tail * 0.45) * mix(1.0, 1.5, surv);
}`;

const FRAG = `
precision mediump float;
varying float vA; varying float vS;
void main() {
  float r = length(gl_PointCoord - 0.5);
  float m = smoothstep(0.5, 0.05, r);
  vec3 col = mix(vec3(0.6, 0.62, 0.69), vec3(0.97, 0.98, 1.0), vS);
  float a = vA * m * mix(0.62, 1.0, vS);
  gl_FragColor = vec4(col * a, a);
}`;

function shader(gl: WebGLRenderingContext, type: number, src: string) {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "shader");
  return s;
}

const paused = () => document.documentElement.classList.contains("auth-open");

export function startField(hero: HTMLElement, box: HTMLElement): void {
  const canvas = document.createElement("canvas");
  canvas.className = "field-canvas";
  canvas.setAttribute("aria-hidden", "true");
  const gl = canvas.getContext("webgl", { alpha: true, antialias: false, premultipliedAlpha: true, powerPreference: "low-power" });
  if (!gl) return;

  const narrow = window.innerWidth < 760;
  const paths = makePaths(narrow ? 900 : 1700);
  // Each path is drawn as short streaks of points: a head and a fading tail.
  const STREAK = narrow ? 8 : 12;
  const GAP = 0.0026;
  const data: number[] = [];
  for (const p of paths) {
    const streaks = p.survivor ? 9 : 1;
    for (let s = 0; s < streaks; s++) {
      const phase = (((p.y0 * 13.37 + p.p1 + s / streaks) % 1) + 1) % 1;
      for (let k = 0; k < STREAK; k++) {
        // aC.x: survivor flag in the integer part, tail position (0..0.5) in the fraction.
        data.push(p.p1, p.p2, p.p3, p.y0, p.f1, p.f2, p.f3, p.death,
          (p.survivor ? 1 : 0) + (k / STREAK) * 0.5, p.cross, (phase + 1 - k * GAP) % 1, narrow ? 2.4 : 3);
      }
    }
  }
  const count = data.length / 12;

  const prog = gl.createProgram()!;
  gl.attachShader(prog, shader(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, shader(gl, gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
  ["aA", "aB", "aC"].forEach((name, i) => {
    const loc = gl.getAttribLocation(prog, name);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 4, gl.FLOAT, false, 48, i * 16);
  });
  const U = (n: string) => gl.getUniformLocation(prog, n);
  const uT = U("uT"), uRes = U("uRes"), uBox = U("uBox"), uDpr = U("uDpr"), uFade = U("uFade");
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(0, 0, 0, 0);

  hero.prepend(canvas);
  let dpr = 1, w = 0, h = 0;
  const size = () => {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const r = hero.getBoundingClientRect();
    w = r.width; h = r.height;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    const b = box.getBoundingClientRect();
    gl.uniform2f(uRes, w, h);
    gl.uniform4f(uBox, b.left - r.left, b.right - r.left, b.top - r.top + b.height / 2, b.height / 2);
    gl.uniform1f(uDpr, dpr);
  };
  size();
  new ResizeObserver(size).observe(hero);

  let drawn = count, raf = 0, visible = true, frames = 0, slow = 0, last = performance.now();
  const t0 = performance.now() - 9000;
  const frame = (now: number) => {
    raf = 0;
    if (!visible || document.hidden || paused()) return;
    // Drop half the points, once or twice, if frames take too long.
    const dt = now - last; last = now;
    if (frames++ > 20 && frames < 400) { if (dt > 24) slow++; if (slow > 30 && drawn > count / 4) { drawn = Math.floor(drawn / 2); slow = 0; } }
    const fade = 1 - Math.min(1, Math.max(0, window.scrollY / (h * 0.95)));
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(uT, (now - t0) / 1000);
    gl.uniform1f(uFade, 0.25 + 0.75 * fade);
    gl.drawArrays(gl.POINTS, 0, drawn);
    if (frames === 2) hero.classList.add("field-live");
    raf = requestAnimationFrame(frame);
  };
  const run = () => { if (!raf && visible && !document.hidden && !paused()) { last = performance.now(); raf = requestAnimationFrame(frame); } };
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; run(); }).observe(hero);
  document.addEventListener("visibilitychange", run);
  // The sign-in panel (DEC-0044) covers the hero: rest while it is open.
  new MutationObserver(run).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  run();
}
