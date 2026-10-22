// The front page's 3D hero: a slowly turning globe of market nodes, arcs with small
// pulses travelling along them, and the Parity starburst in the middle. It leans a
// little toward the pointer. Loaded after first paint by main.ts, never for people who
// ask for reduced motion. It stops drawing when it is off screen or the tab is hidden.
import {
  AdditiveBlending, BufferAttribute, BufferGeometry, Color, DoubleSide, Group, LineSegments, Mesh,
  MeshBasicMaterial, PerspectiveCamera, Points, Scene, ShaderMaterial, WebGLRenderer,
} from "three";
import { arcPoints, FAMILIES, makeGlobe, START_POSE, starRays } from "./nodes";

const NODE_VERT = /* glsl */ `
  uniform float uTime;
  uniform float uScale;
  attribute float aSize;
  attribute float aPhase;
  attribute vec3 aColor;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float facing = normalize((modelMatrix * vec4(position, 1.0)).xyz).z;
    vColor = aColor;
    vAlpha = 0.22 + 0.78 * smoothstep(-0.9, 0.9, facing);
    float breathe = 1.0 + 0.16 * sin(uTime * 0.8 + aPhase);
    gl_PointSize = aSize * breathe * uScale / -mv.z;
    gl_Position = projectionMatrix * mv;
  }`;
const NODE_FRAG = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float a = smoothstep(0.5, 0.15, d);
    gl_FragColor = vec4(vColor, a * vAlpha);
  }`;
const ARC_VERT = /* glsl */ `
  uniform float uTime;
  attribute float aT;
  attribute float aSeed;
  varying float vGlow;
  varying float vFacing;
  void main() {
    float head = fract(uTime * 0.11 + aSeed);
    vGlow = smoothstep(0.14, 0.0, abs(aT - head));
    vFacing = smoothstep(-0.8, 0.8, normalize((modelMatrix * vec4(position, 1.0)).xyz).z);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;
const ARC_FRAG = /* glsl */ `
  uniform vec3 uColor;
  varying float vGlow;
  varying float vFacing;
  void main() {
    gl_FragColor = vec4(uColor, (0.07 + 0.6 * vGlow) * (0.25 + 0.75 * vFacing));
  }`;

function nodesMesh(uniforms: Record<string, { value: number }>) {
  const { nodes, arcs } = makeGlobe();
  const pos = new Float32Array(nodes.length * 3);
  const col = new Float32Array(nodes.length * 3);
  const size = new Float32Array(nodes.length);
  const phase = new Float32Array(nodes.length);
  const c = new Color();
  nodes.forEach((n, i) => {
    pos.set(n.p, i * 3);
    c.set(FAMILIES[n.family].color);
    col.set([c.r, c.g, c.b], i * 3);
    size[i] = n.size;
    phase[i] = (i * 2.399) % (Math.PI * 2);
  });
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(pos, 3));
  g.setAttribute("aColor", new BufferAttribute(col, 3));
  g.setAttribute("aSize", new BufferAttribute(size, 1));
  g.setAttribute("aPhase", new BufferAttribute(phase, 1));
  const points = new Points(g, new ShaderMaterial({
    uniforms, vertexShader: NODE_VERT, fragmentShader: NODE_FRAG, transparent: true, depthWrite: false, blending: AdditiveBlending,
  }));

  const seg: number[] = [];
  const ts: number[] = [];
  const seeds: number[] = [];
  arcs.forEach(([a, b], k) => {
    const pts = arcPoints(nodes[a].p, nodes[b].p);
    for (let s = 0; s < pts.length - 1; s++) {
      seg.push(...pts[s], ...pts[s + 1]);
      ts.push(s / (pts.length - 1), (s + 1) / (pts.length - 1));
      seeds.push((k * 0.618) % 1, (k * 0.618) % 1);
    }
  });
  const lg = new BufferGeometry();
  lg.setAttribute("position", new BufferAttribute(new Float32Array(seg), 3));
  lg.setAttribute("aT", new BufferAttribute(new Float32Array(ts), 1));
  lg.setAttribute("aSeed", new BufferAttribute(new Float32Array(seeds), 1));
  const lines = new LineSegments(lg, new ShaderMaterial({
    uniforms: { ...uniforms, uColor: { value: new Color("#8fb0ff") } },
    vertexShader: ARC_VERT, fragmentShader: ARC_FRAG, transparent: true, depthWrite: false, blending: AdditiveBlending,
  }));
  return { points, lines };
}

/** The starburst as a faceted solid: each ray has a light and a dark face meeting at a ridge. */
function starMesh() {
  const pos: number[] = [];
  const col: number[] = [];
  const light = new Color("#5cc2f5");
  const tipLight = new Color("#3fb3f0");
  const dark = new Color("#1d4f8f");
  const h = 0.1;
  for (const { angle, length, width } of starRays(0.52)) {
    const tip = [Math.cos(angle) * length, Math.sin(angle) * length, 0];
    const l = [Math.cos(angle + Math.PI / 2) * width, Math.sin(angle + Math.PI / 2) * width, 0];
    const r = [-l[0], -l[1], 0];
    for (const z of [h, -h]) {
      const c = [0, 0, z];
      pos.push(...c, ...l, ...tip, ...c, ...tip, ...r);
      col.push(light.r, light.g, light.b, light.r, light.g, light.b, tipLight.r, tipLight.g, tipLight.b);
      col.push(dark.r, dark.g, dark.b, tipLight.r * 0.6, tipLight.g * 0.6, tipLight.b * 0.6, dark.r, dark.g, dark.b);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute("color", new BufferAttribute(new Float32Array(col), 3));
  return new Mesh(g, new MeshBasicMaterial({ vertexColors: true, side: DoubleSide }));
}

export function startHero(host: HTMLElement, pointerArea: HTMLElement = host): () => void {
  const canvas = document.createElement("canvas");
  canvas.className = "hero-canvas";
  canvas.setAttribute("aria-hidden", "true");
  host.appendChild(canvas);

  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "low-power" });
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(dpr);
  const scene = new Scene();
  const camera = new PerspectiveCamera(36, 1, 0.1, 20);
  camera.position.z = 3.4;

  const uniforms = { uTime: { value: 0 }, uScale: { value: 60 } };
  const globe = new Group();
  const { points, lines } = nodesMesh(uniforms);
  globe.add(lines, points);
  globe.rotation.set(START_POSE.rx, START_POSE.ry, 0);
  const star = starMesh();
  scene.add(globe, star);

  const resize = () => {
    const w = host.clientWidth || 1;
    const hgt = host.clientHeight || 1;
    renderer.setSize(w, hgt, false);
    camera.aspect = w / hgt;
    camera.updateProjectionMatrix();
    uniforms.uScale.value = dpr * hgt * 0.05;
  };
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  resize();

  // Pointer: a gentle lean, never more than about 15 degrees.
  let tx = 0, ty = 0, cx = 0, cy = 0;
  const onMove = (e: PointerEvent) => {
    if (e.pointerType === "touch") return;
    const r = pointerArea.getBoundingClientRect();
    tx = ((e.clientY - r.top) / r.height - 0.5) * 0.45;
    ty = ((e.clientX - r.left) / r.width - 0.5) * 0.6;
  };
  const onLeave = () => { tx = 0; ty = 0; };
  pointerArea.addEventListener("pointermove", onMove, { passive: true });
  pointerArea.addEventListener("pointerleave", onLeave);

  let spin = 0;
  let last = performance.now();
  let first = true;
  const frame = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    spin += dt * 0.08;
    cx += (tx - cx) * 0.045;
    cy += (ty - cy) * 0.045;
    uniforms.uTime.value = now / 1000;
    globe.rotation.x = START_POSE.rx + cx;
    globe.rotation.y = START_POSE.ry + spin + cy;
    star.rotation.set(cx * 1.3, cy * 1.5 + Math.sin(now / 4200) * 0.22, -spin * 0.5);
    renderer.render(scene, camera);
    if (first) { first = false; host.classList.add("live"); }
  };

  let onScreen = true;
  const sync = () => {
    const run = onScreen && !document.hidden;
    if (run) last = performance.now();
    renderer.setAnimationLoop(run ? frame : null);
  };
  const io = new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; sync(); });
  io.observe(host);
  document.addEventListener("visibilitychange", sync);
  canvas.addEventListener("webglcontextlost", () => host.classList.remove("live"));
  sync();

  return () => {
    renderer.setAnimationLoop(null);
    io.disconnect();
    ro.disconnect();
    document.removeEventListener("visibilitychange", sync);
    pointerArea.removeEventListener("pointermove", onMove);
    pointerArea.removeEventListener("pointerleave", onLeave);
    renderer.dispose();
    canvas.remove();
    host.classList.remove("live");
  };
}
