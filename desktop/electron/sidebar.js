// Draws the sidebar from the main process's section list (sections.js) and keeps the
// current section marked (DEC-0041).
const ICONS = {
  home: ["M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"],
  check: ["M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z", "M9 12l2 2 4-4"],
  grid: ["M4 4h6v6H4z", "M14 4h6v6h-6z", "M4 14h6v6H4z", "M14 14h6v6h-6z"],
  book: ["M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5z", "M5 19.5A1.5 1.5 0 0 0 6.5 21H19", "M9 7h6"],
  terminal: ["M3 5a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z", "M7 9l3 3-3 3", "M13 15h4"],
  chart: ["M4 4v16h16", "M8 15l3.5-4 3 2.5L19 8"],
  cap: ["M2 9l10-5 10 5-10 5z", "M6 11v5c3.5 2.5 8.5 2.5 12 0v-5"],
  flask: ["M9 3h6", "M10 3v6l-5 9a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7-3l-5-9V3", "M7.5 15h9"],
  user: ["M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", "M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"],
};

const NS = "http://www.w3.org/2000/svg";
function icon(name) {
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  for (const d of ICONS[name] || ICONS.grid) {
    const p = document.createElementNS(NS, "path");
    p.setAttribute("d", d);
    svg.appendChild(p);
  }
  return svg;
}

const buttons = new Map();
function mark(id) {
  for (const [key, b] of buttons) {
    if (key === id) b.setAttribute("aria-current", "page");
    else b.removeAttribute("aria-current");
  }
}

window.paritySidebar.sections().then(({ sections, platform, active }) => {
  document.body.classList.add(platform);
  const mod = platform === "darwin" ? "Cmd" : "Ctrl";
  for (const s of sections) {
    const b = document.createElement("button");
    b.type = "button";
    b.title = s.key ? `${s.label} (${mod}+${s.key === "," ? "," : s.key})` : s.label;
    b.append(icon(s.icon));
    const label = document.createElement("span");
    label.textContent = s.label;
    b.append(label);
    b.addEventListener("click", () => window.paritySidebar.go(s.id));
    buttons.set(s.id, b);
    document.querySelector(s.bottom ? ".foot" : ".list").appendChild(b);
  }
  mark(active);
});
window.paritySidebar.onActive(mark);
