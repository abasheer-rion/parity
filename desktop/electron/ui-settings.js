// The Settings page (DEC-0049): each switch saves as soon as it changes.
const shell = window.parityShell;
const $ = (id) => document.getElementById(id);
const mac = shell.platform === "darwin";
let info = null;

if (!mac) {
  for (const n of document.querySelectorAll("[data-mac]")) n.hidden = true;
  $("trayName").textContent = "Show Parity in the taskbar tray";
  document.querySelector(".top").style.display = "none";
}

function render() {
  for (const box of document.querySelectorAll("input[type=checkbox][data-key]")) box.checked = !!info.settings[box.dataset.key];
  $("key").value = (info.settings.globalShortcut || "").replace(/CommandOrControl|CmdOrCtrl/, mac ? "Cmd" : "Ctrl").split("+").join(" ");
  $("version").textContent = `Version ${info.version}`;
  $("update").textContent = `${info.update || "Not checked yet"}.${info.canInstall ? "" : " This copy is not signed, so a new version is a download."}`;
  const ws = $("workspaces");
  ws.replaceChildren();
  if (!info.workspaces.length) {
    const p = document.createElement("div");
    p.className = "ws";
    p.innerHTML = '<span class="muted">None saved yet.</span>';
    ws.append(p);
  }
  for (const name of info.workspaces) {
    const r = document.createElement("div");
    r.className = "ws";
    const s = document.createElement("span");
    s.textContent = name;
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn";
    b.textContent = "Delete";
    b.addEventListener("click", async () => { info = { ...info, ...(await shell.ask("workspace:delete", name)) }; render(); });
    r.append(s, b);
    ws.append(r);
  }
}

async function set(patch) {
  const res = await shell.ask("settings:set", patch);
  info = { ...info, ...res };
  $("keyErr").hidden = !res.error;
  $("keyErr").textContent = res.error || "";
  render();
}

for (const box of document.querySelectorAll("input[type=checkbox][data-key]")) {
  box.addEventListener("change", () => set({ [box.dataset.key]: box.checked }));
}

// The key recorder: one to three modifiers and one key.
const NAMES = { Space: "Space", ArrowUp: "Up", ArrowDown: "Down", ArrowLeft: "Left", ArrowRight: "Right", Home: "Home", End: "End", PageUp: "PageUp", PageDown: "PageDown" };
$("key").addEventListener("keydown", (e) => {
  e.preventDefault();
  if (e.key === "Escape" || e.key === "Tab") { $("key").blur(); return; }
  let key = null;
  if (/^Key[A-Z]$/.test(e.code)) key = e.code.slice(3);
  else if (/^Digit[0-9]$/.test(e.code)) key = e.code.slice(5);
  else if (/^F([1-9]|1[0-9]|2[0-4])$/.test(e.code)) key = e.code;
  else if (NAMES[e.code]) key = NAMES[e.code];
  if (!key) return;
  const mods = [];
  if (mac ? e.metaKey : e.ctrlKey) mods.push("CommandOrControl");
  if (mac && e.ctrlKey) mods.push("Control");
  if (e.altKey) mods.push("Alt");
  if (e.shiftKey) mods.push("Shift");
  if (!mods.length) { $("keyErr").hidden = false; $("keyErr").textContent = "Hold at least one of Cmd, Ctrl, Alt or Shift with the key."; return; }
  set({ globalShortcut: [...mods, key].join("+") });
});
$("clearKey").addEventListener("click", () => set({ globalShortcut: "" }));
$("checkNow").addEventListener("click", async () => { info = { ...info, ...(await shell.ask("updates:check")) }; render(); });
$("cookies").addEventListener("click", (e) => { e.preventDefault(); shell.ask("open-cookies"); });

shell.ask("settings:get").then((i) => { info = i; render(); });
