// The window's controls (DEC-0049): menu, Back, Forward, search and Keep on top, in the page's
// header row (window.js). There is no title. Empty parts drag the window; the buttons do
// not. Double-click an empty part to zoom or maximise the window, as the system does.
const shell = window.parityShell;
const $ = (id) => document.getElementById(id);
const mac = shell.platform === "darwin";
document.body.classList.add(shell.platform);

$("menu").append(window.parityIcon("menu", 17));
$("back").append(window.parityIcon("back", 16));
$("forward").append(window.parityIcon("forward", 16));
$("pin").append(window.parityIcon("pin", 15));
$("search").append(window.parityIcon("search", 13));
const key = document.createElement("kbd");
key.textContent = mac ? "\u2318K" : "Ctrl K";
$("search").append(key);
$("search").title = `Search sections, pages and commands (${mac ? "Cmd K" : "Ctrl K"})`;
$("back").title = mac ? "Back (Cmd [)" : "Back (Alt Left)";
$("forward").title = mac ? "Forward (Cmd ])" : "Forward (Alt Right)";
$("menu").title = "Sections";

$("menu").addEventListener("click", () => shell.send("menu"));
$("back").addEventListener("click", () => shell.send("back"));
$("forward").addEventListener("click", () => shell.send("forward"));
$("pin").addEventListener("click", () => shell.send("on-top"));
$("search").addEventListener("click", () => shell.send("palette"));

let overlay = null;
// A press on the empty bar closes an open menu or palette, like a click outside it.
document.addEventListener("mousedown", (e) => { if (overlay && !e.target.closest(".btn")) shell.send("close-overlay"); });
document.addEventListener("dblclick", (e) => { if (!e.target.closest(".btn")) shell.send("dblclick"); });

// Moving the window. On Windows the bar is a drag region and the system moves the window, so
// this page never sees the press. On a Mac (and anywhere the region is ignored) the press
// arrives here and the app moves the window by the pointer's travel on the screen.
let drag = null;
let queued = null;
document.addEventListener("pointerdown", (e) => {
  if (e.button !== 0 || e.target.closest(".btn") || e.detail > 1) return;
  drag = e.pointerId;
  try { document.body.setPointerCapture(e.pointerId); } catch { /* the move still works inside the bar */ }
  shell.send("drag-start", { x: e.screenX, y: e.screenY });
});
document.addEventListener("pointermove", (e) => {
  if (drag === null || e.pointerId !== drag) return;
  const first = queued === null;
  queued = { x: e.screenX, y: e.screenY };
  if (first) requestAnimationFrame(() => { if (queued) shell.send("drag-move", queued); queued = null; });
});
const stop = (e) => {
  if (drag === null || e.pointerId !== drag) return;
  if (queued) shell.send("drag-move", queued);
  queued = null;
  drag = null;
  shell.send("drag-end");
};
document.addEventListener("pointerup", stop);
document.addEventListener("pointercancel", stop);

function render(s) {
  overlay = s.overlay;
  document.body.classList.toggle("wall", s.wall);
  document.body.classList.toggle("fullscreen", s.fullscreen);
  $("back").disabled = !s.back;
  $("forward").disabled = !s.forward;
  $("back").hidden = s.wall && !s.back;
  $("forward").hidden = s.wall && !s.back && !s.forward;
  $("menu").setAttribute("aria-expanded", String(s.overlay === "menu"));
  $("pin").hidden = s.wall || !(s.section === "trade" || s.onTop);
  $("pin").setAttribute("aria-pressed", String(!!s.onTop));
  $("offline").hidden = !s.offline;
  measure();
}

let flashTimer = null;
shell.on("shell:flash", (text) => {
  const f = $("flash");
  f.textContent = text;
  f.classList.add("on");
  measure();
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => { f.classList.remove("on"); f.textContent = ""; measure(); }, 1600);
});

// The window sizes this view to the buttons (and a passing message), and tells the page how
// much of its header row to leave free (window.js, setLead).
let sent = "";
function measure() {
  requestAnimationFrame(() => {
    const base = Math.ceil($("cluster").getBoundingClientRect().width + 8);
    const f = $("flash");
    const full = f.textContent ? Math.ceil(base + f.getBoundingClientRect().width + 8) : base;
    const key = `${base}/${full}`;
    if (key === sent) return;
    sent = key;
    shell.send("lead-size", { base, full });
  });
}
new ResizeObserver(measure).observe($("cluster"));
shell.on("shell:state", render);
shell.ask("state").then((s) => s && render(s));
