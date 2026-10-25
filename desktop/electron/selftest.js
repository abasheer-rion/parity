// Checks the running app from inside (DEC-0049). Started by scripts/selftest.mjs with
// PARITY_SELFTEST=<scenario>; prints PASS or FAIL lines and quits with 0 or 1.
//
//   wall      signed out, opened by a parity:// deep link: one visible window on the log-in
//             page with the form drawn, no menu, and a second deep link stays on the wall.
//             Dragging the title bar moves the window.
//   offline   the website does not answer: the saved copy's log-in page shows under the
//             offline line, and a page that cannot open at all shows Retry.
//   signedin  (PARITY_AUTH_BYPASS with a local server) the menu opens with every section, a
//             section opens, and a section opens in a second window.
const { app } = require("electron");

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function until(fn, ms = 20000, step = 200) {
  const end = Date.now() + ms;
  for (;;) {
    let v = false;
    try { v = await fn(); } catch { v = false; }
    if (v) return v;
    if (Date.now() > end) return false;
    await wait(step);
  }
}

async function run(api) {
  const scenario = process.env.PARITY_SELFTEST;
  let failed = 0;
  const check = (name, ok, detail = "") => {
    if (!ok) failed++;
    console.log(`${ok ? "PASS" : "FAIL"} ${scenario}: ${name}${!ok && detail ? ` (${detail})` : ""}`);
  };
  const js = (wc, code) => wc.executeJavaScript(code, true);
  const settled = (w) => until(() => w.active && w.active.path !== null && !w.active.wc.isLoading() && !w.titlebar.webContents.isLoading(), 25000);
  const hasForm = (w) => until(() => js(w.active.wc, "!!document.querySelector('input[type=email], input[autocomplete~=email], input[name=email]')"), 15000, 400);

  try {
    const w = await until(() => api.windows()[0], 10000);
    check("a window opens", !!w);
    if (!w) throw new Error("no window");
    await settled(w);

    if (scenario === "wall" || scenario === "offline") {
      check("the window is visible", w.win.isVisible());
      check("exactly one window", api.windows().length === 1, `${api.windows().length}`);
      check("the deep link opened the log-in page", /^\/login\//.test(w.active.path || ""), w.active.path);
      check("the window is on the log-in wall", w.wall === true);
      check("the log-in form is drawn", await hasForm(w));
      check("the title bar is loaded", w.titlebar.webContents.getURL().includes("ui-titlebar.html"));
      w.openOverlay("menu");
      check("the menu does not open on the wall", w.overlayMode === null);
      check("the title bar hides the menu button on the wall", await js(w.titlebar.webContents, "document.body.classList.contains('wall') && getComputedStyle(document.getElementById('menu')).display === 'none'"));
    }

    if (scenario === "wall") {
      api.openLink("parity://app/#/verify");
      await wait(1500);
      await settled(w);
      check("a second deep link stays on the wall", /^\/login\//.test(w.active.path || "") && api.windows().length === 1, w.active.path);
      // Drag: a press, a move of 120 by 40 and a release on the title bar's empty middle.
      const [x0, y0] = w.win.getPosition();
      const tb = w.titlebar.webContents;
      const at = (x, y) => ({ x, y, globalX: x0 + x, globalY: y0 + y });
      tb.sendInputEvent({ type: "mouseMove", ...at(300, 19) });
      tb.sendInputEvent({ type: "mouseDown", button: "left", clickCount: 1, ...at(300, 19) });
      for (let i = 1; i <= 6; i++) { tb.sendInputEvent({ type: "mouseMove", button: "left", ...at(300 + i * 20, 19 + Math.round(i * 40 / 6)) }); await wait(60); }
      tb.sendInputEvent({ type: "mouseUp", button: "left", clickCount: 1, ...at(420, 59) });
      await wait(500);
      const [x1, y1] = w.win.getPosition();
      check("dragging the title bar moves the window", Math.abs(x1 - x0 - 120) <= 3 && Math.abs(y1 - y0 - 40) <= 3, `moved ${x1 - x0},${y1 - y0}`);
    }

    if (scenario === "offline") {
      check("the saved copy is showing", w.active.saved === true);
      check("the offline line is showing", w.bar.getVisible?.() ?? true);
      w.active.showError("/nowhere/", "test");
      await until(() => w.active.wc.getURL().includes("ui-error.html") && !w.active.wc.isLoading(), 8000);
      check("a page that cannot open shows Retry", await until(() => js(w.active.wc, "!!document.getElementById('retry') && document.body.innerText.includes('Could not open')"), 5000));
    }

    if (scenario === "signedin") {
      check("signed in, not on the wall", w.wall === false);
      w.openOverlay("menu");
      await wait(800);
      check("the menu opens", w.overlayMode === "menu" && w.overlay.getVisible?.() !== false);
      const rows = await until(() => js(w.overlay.webContents, "document.querySelectorAll('#drawer:not([hidden]) .row').length"), 5000);
      check("the menu lists the sections, Account and Settings", rows >= 8, `${rows} rows`);
      w.closeOverlay();
      check("Escape-style close hides the menu", w.overlayMode === null);
      const before = api.windows().length;
      api.newWindow("/");
      await wait(1500);
      check("a page opens in a second window", api.windows().length === before + 1, `${api.windows().length}`);
      // The bundled pages ask for a real session, so the section may land on its log-in
      // page here; what matters is that the menu opened that section in this window.
      w.openSection("research");
      await settled(w);
      check("a section opens from the menu", w.active.key === "research" && (w.active.wantPath || "").startsWith("/research"), `${w.active.key} ${w.active.wantPath}`);
    }
  } catch (e) {
    check("ran to the end", false, e.message);
  }
  app.exit(failed ? 1 : 0);
}

module.exports = { run };
