// The title bar (DEC-0049). The whole bar drags the window; its buttons do not. Double-click
// on the bar zooms or maximises the window, as the system does.
const shell = window.parityShell;
const $ = (id) => document.getElementById(id);
const mac = shell.platform === "darwin";
document.body.classList.add(shell.platform);

$("menu").append(window.parityIcon("menu", 17));
$("back").append(window.parityIcon("back", 16));
$("forward").append(window.parityIcon("forward", 16));
$("pin").append(window.parityIcon("pin", 15));
$("search").append(window.parityIcon("search", 13));
const label = document.createElement("span");
label.textContent = "Search";
const key = document.createElement("kbd");
key.textContent = mac ? "Cmd K" : "Ctrl K";
$("search").append(label, key);
$("search").title = `Search sections, pages and commands (${key.textContent})`;
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

function render(s) {
  overlay = s.overlay;
  document.body.classList.toggle("wall", s.wall);
  document.body.classList.toggle("fullscreen", s.fullscreen);
  $("title").textContent = s.title || "";
  $("back").disabled = !s.back;
  $("forward").disabled = !s.forward;
  $("back").hidden = s.wall && !s.back;
  $("forward").hidden = s.wall && !s.back && !s.forward;
  $("menu").setAttribute("aria-expanded", String(s.overlay === "menu"));
  $("pin").hidden = s.wall || !(s.section === "trade" || s.onTop);
  $("pin").setAttribute("aria-pressed", String(!!s.onTop));
  $("offline").hidden = !s.offline;
}

let flashTimer = null;
shell.on("shell:flash", (text) => {
  const f = $("flash");
  f.textContent = text;
  f.classList.add("on");
  $("title").style.visibility = "hidden";
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => { f.classList.remove("on"); $("title").style.visibility = ""; }, 1600);
});
shell.on("shell:state", render);
shell.ask("state").then((s) => s && render(s));
