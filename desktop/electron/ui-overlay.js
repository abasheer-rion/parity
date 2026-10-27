// The layer over the page (DEC-0049): the sections menu, the command palette (Cmd K), Open
// link (Cmd L) and naming a workspace. Escape, a click outside or a choice closes it.
const shell = window.parityShell;
const $ = (id) => document.getElementById(id);
const icon = window.parityIcon;
const mac = shell.platform === "darwin";
const MOD = mac ? "Cmd" : "Ctrl";
let data = null;
let items = []; // the rows the arrow keys move through
let sel = 0;

const close = () => shell.send("close-overlay");
$("scrim").addEventListener("mousedown", close);
document.querySelector(".drawer h2 img")?.addEventListener("error", (e) => e.target.remove());

function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "on") for (const [ev, fn] of Object.entries(v)) n.addEventListener(ev, fn);
    else if (v !== false && v != null) n.setAttribute(k, v === true ? "" : v);
  }
  for (const k of kids) if (k != null && k !== false) n.append(k);
  return n;
}

/** One row: icon, name, shortcut, and a button that opens it in a new window when it can. */
let rowSeq = 0;
function row({ ic, name, key, current, run, runNew }, option = false) {
  // In the palette the rows are options of a list the arrow keys move through; in the menu
  // they are plain buttons.
  const r = el("button", { type: "button", class: "row", role: option ? "option" : false, id: option ? `opt-${++rowSeq}` : false, "aria-selected": option ? "false" : false, "aria-current": current ? "page" : false },
    icon(ic, 17), el("span", { class: "name" }, name), key ? el("kbd", {}, key) : null);
  if (runNew) {
    // For the mouse only: from the keyboard, Cmd or Ctrl Enter (Alt Enter in the menu) does the same.
    const nw = el("span", { class: "nw", title: "Open in a new window", "aria-hidden": "true" }, icon("newwin", 14));
    nw.addEventListener("click", (e) => { e.stopPropagation(); runNew(); });
    r.append(nw);
  }
  r.addEventListener("click", (e) => (runNew && (e.altKey || e.shiftKey || e.metaKey || e.ctrlKey) ? runNew() : run()));
  r.addEventListener("mousemove", () => select(items.indexOf(r)));
  r._run = run;
  r._runNew = runNew;
  return r;
}

function select(i) {
  if (!items.length) return;
  sel = (i + items.length) % items.length;
  items.forEach((r, j) => { r.classList.toggle("sel", j === sel); if (r.getAttribute("role") === "option") r.setAttribute("aria-selected", String(j === sel)); });
  items[sel].scrollIntoView({ block: "nearest" });
  if (items[sel].id) $("q").setAttribute("aria-activedescendant", items[sel].id);
}

const openSection = (id, newWindow = false) => shell.send("open-section", { id, newWindow });
const openPath = (path, newWindow = false) => shell.send("open-path", { path, newWindow });

// ------------------------------------------------------------ the menu

function showMenu() {
  $("drawer").hidden = false;
  $("card").hidden = true;
  const list = $("sections"), foot = $("foot");
  list.replaceChildren();
  foot.replaceChildren();
  items = [];
  for (const s of data.sections) {
    const r = row({ ic: s.icon, name: s.label, key: s.key, current: s.id === data.active, run: () => openSection(s.id), runNew: () => openSection(s.id, true) });
    (s.bottom ? foot : list).append(r);
    items.push(r);
  }
  const settings = row({ ic: "gear", name: "Settings", key: `${MOD} ,`, run: () => shell.send("settings") });
  foot.append(settings);
  items.push(settings);
  $("nwHint").textContent = `Alt-click, or the arrow at the end of a row, opens it in a new window.`;
  sel = Math.max(0, data.sections.findIndex((s) => s.id === data.active));
  select(sel);
  items[sel]?.focus({ preventScroll: true });
}

// ------------------------------------------------------------ the palette

const looksLikeLink = (q) => /^(parity:\/\/|https?:\/\/)/i.test(q) || /^[a-z0-9-]+(\.[a-z0-9-]+)+\//i.test(q) || /^\/?(s|v)\/[A-Za-z0-9_]+/.test(q);

function paletteRows(q) {
  const t = q.trim().toLowerCase();
  const hit = (s) => !t || s.toLowerCase().includes(t);
  const groups = [];
  if (t && looksLikeLink(q.trim())) groups.push(["Link", [{ ic: "link", name: `Open ${q.trim()}`, run: () => openLink(q.trim()) }]]);
  groups.push(["Sections", data.sections.filter((s) => hit(s.label)).map((s) => ({ ic: s.icon, name: s.label, key: s.key, current: s.id === data.active, run: () => openSection(s.id), runNew: () => openSection(s.id, true) }))]);
  groups.push(["Recent pages", data.recent.filter((r) => hit(r.title) || hit(r.path)).map((r) => ({ ic: "clock", name: r.title, run: () => openPath(r.path), runNew: () => openPath(r.path, true) }))]);
  groups.push(["Workspaces", data.workspaces.filter(hit).map((n) => ({ ic: "layers", name: `Open workspace: ${n}`, run: () => shell.send("open-workspace", n) }))]);
  groups.push(["Commands", data.commands.filter((c) => hit(c.label)).map((c) => ({ ic: c.id === "page-search" ? "search" : c.id === "settings" ? "gear" : c.id.startsWith("new-window") ? "newwin" : c.id === "on-top" ? "pin" : c.id === "link" || c.id === "copy-link" ? "link" : "bolt", name: c.id === "on-top" && data.onTop ? "Stop keeping this window on top" : c.label, key: c.key, run: () => shell.send(c.id) }))]);
  return groups.filter(([, rows]) => rows.length);
}

function renderPalette() {
  const out = $("results");
  out.replaceChildren();
  items = [];
  const groups = paletteRows($("q").value);
  if (!groups.length) out.append(el("p", { class: "empty" }, "Nothing matches. Paste a Parity link to open it."));
  for (const [name, rows] of groups) {
    out.append(el("p", { class: "group" }, name));
    for (const r of rows) { const b = row(r, true); b.tabIndex = -1; out.append(b); items.push(b); }
  }
  select(0);
}

async function openLink(value) {
  const res = await shell.ask("open-link", value);
  if (!res?.ok) showError("That is not a Parity link. Paste an address on paritytrading.app, a short link such as /s/fx_carry, or a parity:// link.");
}

function showError(text) {
  const out = $("results");
  out.replaceChildren(el("p", { class: "error", role: "alert" }, text));
  items = [];
  $("q").removeAttribute("aria-activedescendant");
}

function showCard(mode) {
  $("drawer").hidden = true;
  $("card").hidden = false;
  const q = $("q");
  q.value = "";
  q.removeAttribute("aria-activedescendant");
  q.setAttribute("aria-label", mode === "link" ? "Link to open" : mode === "name" ? "Workspace name" : "Search sections, pages and commands");
  $("qIcon").replaceChildren(icon(mode === "link" ? "link" : mode === "name" ? "layers" : "search", 17));
  const tips = $("tips");
  tips.replaceChildren();
  $("results").replaceChildren();
  items = [];
  if (mode === "palette") {
    q.placeholder = "Go to a section, a recent page or a command, or paste a link";
    tips.append(el("span", {}, el("kbd", {}, "Enter"), " open"), el("span", {}, el("kbd", {}, `${MOD} Enter`), " in a new window"), el("span", {}, el("kbd", {}, "Esc"), " close"));
    renderPalette();
  } else if (mode === "link") {
    q.placeholder = "Paste a link: paritytrading.app/..., /s/fx_carry, /v/... or parity://...";
    tips.append(el("span", {}, el("kbd", {}, "Enter"), " open in this window"), el("span", {}, el("kbd", {}, "Esc"), " close"));
  } else if (mode === "name") {
    q.placeholder = "Name this workspace, for example Morning trading";
    tips.append(el("span", {}, "Saves every open window with its page, size and place. Open it later from the Window menu or here."));
  }
  q.dataset.mode = mode;
  setTimeout(() => q.focus(), 0);
}

$("q").addEventListener("input", () => { if ($("q").dataset.mode === "palette") renderPalette(); else $("results").replaceChildren(); });
$("q").addEventListener("keydown", async (e) => {
  const mode = $("q").dataset.mode;
  if (e.key === "ArrowDown") { e.preventDefault(); select(sel + 1); }
  else if (e.key === "ArrowUp") { e.preventDefault(); select(sel - 1); }
  else if (e.key === "Enter") {
    e.preventDefault();
    const v = $("q").value.trim();
    if (mode === "link") { if (v) openLink(v); return; }
    if (mode === "name") {
      if (!v) return;
      const res = await shell.ask("save-workspace", v);
      if (!res?.ok) showError("Give the workspace a name.");
      return;
    }
    const r = items[sel];
    if (!r) return;
    if ((e.metaKey || e.ctrlKey) && r._runNew) r._runNew();
    else r._run();
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") { e.preventDefault(); close(); return; }
  if ($("drawer").hidden) return;
  if (e.key === "ArrowDown") { e.preventDefault(); select(sel + 1); items[sel]?.focus({ preventScroll: true }); }
  else if (e.key === "ArrowUp") { e.preventDefault(); select(sel - 1); items[sel]?.focus({ preventScroll: true }); }
  else if (e.key === "Enter" && items[sel] && document.activeElement !== items[sel]) { e.preventDefault(); (e.altKey && items[sel]._runNew ? items[sel]._runNew : items[sel]._run)(); }
});

function show(payload) {
  if (!payload || !payload.mode) return;
  data = payload;
  document.body.classList.remove("open");
  if (payload.mode === "menu") showMenu();
  else showCard(payload.mode);
  requestAnimationFrame(() => document.body.classList.add("open"));
}

shell.on("shell:overlay", show);
shell.ask("overlay").then(show);
