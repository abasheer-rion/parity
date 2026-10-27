// The site-wide warnings banner for the plain HTML pages (DEC-0073). It reads /status.json
// (written by scripts/updates/build.py) and shows each current warning in the slot marked
// data-status-banner, or after the page header. Each warning can be closed and stays closed
// in this browser. Nothing shows when there are no warnings or the file cannot be read.
// The app does the same with src/components/StatusBanner.tsx; tests/statusBanner.test.ts
// keeps the two in step. No dependencies; text is set with textContent only.
(function () {
  var KEY = "parity.status.dismissed";
  var WORDS = { info: "Notice", warning: "Warning", outage: "Outage" };
  var CSS = ".psb{display:flex;flex-direction:column;gap:8px;width:calc(100% - 32px);max-width:1120px;margin:12px auto}" +
    ".psb[hidden]{display:none}" +
    ".psb-item{display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px;padding:10px 14px;border-radius:12px;border:1px solid;font:15px/1.5 Inter,-apple-system,BlinkMacSystemFont,\"Segoe UI\",Roboto,Helvetica,Arial,sans-serif}" +
    ".psb-text{flex:1 1 240px;min-width:0;margin:0;overflow-wrap:anywhere}" +
    ".psb-text a{color:inherit;text-decoration:underline;text-underline-offset:2px}" +
    ".psb-x{flex:none;min-height:32px;padding:0 12px;border-radius:8px;border:1px solid currentColor;background:transparent;color:inherit;font:inherit;font-size:14px;cursor:pointer}" +
    ".psb-x:focus-visible,.psb-text a:focus-visible{outline:2px solid currentColor;outline-offset:2px}" +
    ".psb-info{background:#0e1a36;color:#eef2ff;border-color:#85a8ff}" +
    ".psb-warning{background:#2b2208;color:#fbf0d0;border-color:#e8c06a}" +
    ".psb-outage{background:#3b1013;color:#ffe6e6;border-color:#f07a7a}" +
    "html.auth-open .psb{visibility:hidden}";

  function readDismissed() {
    try {
      var v = JSON.parse(window.localStorage.getItem(KEY) || "[]");
      return Array.isArray(v) ? v.filter(function (x) { return typeof x === "string"; }) : [];
    } catch (e) { return []; }
  }
  function remember(id) {
    var next = readDismissed().filter(function (x) { return x !== id; }).concat([id]).slice(-50);
    try { window.localStorage.setItem(KEY, JSON.stringify(next)); } catch (e) { /* blocked storage */ }
  }
  function safeLink(h) { return typeof h === "string" && (/^\/(?!\/)/.test(h) || /^https:\/\//.test(h)) ? h : ""; }
  function parse(doc) {
    var list = doc && Array.isArray(doc.warnings) ? doc.warnings : [];
    return list.filter(function (w) {
      return w && typeof w.id === "string" && w.id && typeof w.title === "string" && w.title && WORDS.hasOwnProperty(w.level);
    });
  }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function render(warnings) {
    var closed = readDismissed();
    var shown = warnings.filter(function (w) { return closed.indexOf(w.id) < 0; });
    if (!shown.length) return;
    var style = el("style");
    style.textContent = CSS;
    document.head.appendChild(style);
    var slot = document.querySelector("[data-status-banner]");
    var box = el("div", "psb");
    box.setAttribute("role", "status");
    box.setAttribute("aria-live", "polite");
    if (slot) slot.appendChild(box);
    else {
      var header = document.querySelector("body > header");
      if (header) header.insertAdjacentElement("afterend", box);
      else document.body.insertBefore(box, document.body.firstChild);
    }
    var offset = slot && Number(slot.getAttribute("data-offset"));
    if (offset) slot.style.paddingTop = offset + "px";
    // Filled a moment after the live region exists, so screen readers announce it.
    setTimeout(function () {
      shown.forEach(function (w) {
        var item = el("div", "psb-item psb-" + w.level);
        item.setAttribute("data-id", w.id);
        var p = el("p", "psb-text");
        p.appendChild(el("strong", "", WORDS[w.level] + ":"));
        p.appendChild(document.createTextNode(" " + w.title + "." + (w.detail ? " " + w.detail : "")));
        var link = safeLink(w.link);
        if (link) {
          p.appendChild(document.createTextNode(" "));
          var a = el("a", "", "More");
          a.href = link;
          p.appendChild(a);
        }
        var b = el("button", "psb-x", "Dismiss");
        b.type = "button";
        b.setAttribute("aria-label", "Dismiss this notice: " + w.title);
        b.addEventListener("click", function () {
          remember(w.id);
          item.remove();
          if (!box.querySelector(".psb-item")) {
            box.hidden = true;
            if (offset) slot.style.paddingTop = "";
          }
        });
        item.appendChild(p);
        item.appendChild(b);
        box.appendChild(item);
      });
    }, 30);
  }
  function start() {
    if (!window.fetch) return;
    fetch("/status.json", { cache: "no-cache", credentials: "omit" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (doc) { render(parse(doc)); })
      .catch(function () { /* no banner */ });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
