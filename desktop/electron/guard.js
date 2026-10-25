// The app's last line of defence (DEC-0058). Without it, an error nobody caught in the main
// process makes Electron show its raw "A JavaScript error occurred in the main process"
// box, and 0.2.0 then quit on its own while that box was open. Here such an error is written
// to the log (logfile.js), the app keeps running, and the person sees one plain message with
// a way out: Reload pages draws every window's page again, OK closes the message. The same
// error is not shown twice within a minute, so a repeating fault cannot stack messages.
const SHOW_AGAIN_MS = 60_000;

/** Plain-words text for the message; `detail` holds the first line of the error. */
function message(err) {
  const first = String((err && (err.stack || err.message)) || err || "Unknown error").split("\n")[0].slice(0, 200);
  return {
    type: "warning",
    message: "Something went wrong in Parity",
    detail: `Parity kept running. If a page looks wrong, reload it.\n\n${first}`,
    buttons: ["Reload pages", "OK"],
    defaultId: 0,
    cancelId: 1,
  };
}

/**
 * Installs the handlers. `log` writes a line, `ask` shows a message box and resolves with
 * the button index, `reload` reloads every window's page. All three are given by main.js
 * (and by the tests).
 */
function install({ proc = process, log, ask, reload, now = () => Date.now() }) {
  const shown = new Map();
  let open = false;

  const handle = (kind, err) => {
    const text = String((err && (err.stack || err.message)) || err);
    try { log(`${kind}: ${text}`); } catch { /* the log must never throw here */ }
    if (kind !== "uncaught error") return; // a stray promise is logged only
    const key = text.split("\n")[0];
    const at = shown.get(key);
    if (open || (at !== undefined && now() - at < SHOW_AGAIN_MS)) return;
    shown.set(key, now());
    open = true;
    Promise.resolve()
      .then(() => ask(message(err)))
      .then((r) => { if (r && r.response === 0) reload(); })
      .catch(() => {})
      .finally(() => { open = false; });
  };

  proc.on("uncaughtException", (err) => handle("uncaught error", err));
  proc.on("unhandledRejection", (err) => handle("unhandled promise", err));
  return { handle };
}

module.exports = { install, message, SHOW_AGAIN_MS };
