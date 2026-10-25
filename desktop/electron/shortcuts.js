// The app's keyboard shortcuts (DEC-0049), read from each key press before the page sees it,
// so they work the same on Mac and Windows and in every view of a window. Plain functions, no
// Electron, so `npm test` can run them. Cmd on a Mac is Ctrl on Windows.
//
//   Cmd 1 to 9         open a section            Cmd K          command palette
//   Cmd [ and ]        back and forward          Cmd L          open a link
//   (Alt Left/Right on Windows)                  Cmd Shift C    copy this page's link
//   Cmd N              new window                Cmd Shift N    this page in a new window
//   Cmd ,              settings                  Cmd Shift F    focus mode
//   Cmd Alt T          keep this window on top   Cmd W          close the window
//   Cmd R, Cmd Shift R reload                    Cmd 0, =, -    zoom
//   Cmd M              minimise                  Ctrl Cmd F or F11  full screen

/** The action a key press asks for, or null to let the page have it. */
function actionFor(input, platform) {
  if (!input || input.type !== "keyDown" || input.isAutoRepeat && !/^(BracketLeft|BracketRight|ArrowLeft|ArrowRight|Equal|Minus)$/.test(input.code)) return null;
  const mac = platform === "darwin";
  const code = input.code || "";
  const mod = mac ? input.meta && !input.control : input.control && !input.meta;
  if (mac && input.meta && input.control && !input.shift && !input.alt && code === "KeyF") return "fullscreen";
  if (!mac && code === "F11" && !input.control && !input.alt && !input.shift) return "fullscreen";
  if (!mac && input.alt && !input.control && !input.meta && !input.shift) {
    if (code === "ArrowLeft") return "back";
    if (code === "ArrowRight") return "forward";
  }
  if (!mod) return null;
  if (input.alt && !input.shift) {
    if (code === "KeyT") return "on-top";
    if (mac && code === "KeyI") return "devtools";
    return null;
  }
  if (input.alt) return null;
  if (input.shift) {
    switch (code) {
      case "KeyC": return "copy-link";
      case "KeyN": return "new-window-here";
      case "KeyF": return "focus";
      case "KeyR": return "reload-hard";
      case "KeyI": return mac ? null : "devtools";
      default: return null;
    }
  }
  if (/^Digit[1-9]$/.test(code)) return `section:${code.slice(5)}`;
  switch (code) {
    case "KeyK": return "palette";
    case "KeyL": return "link";
    case "BracketLeft": return mac ? "back" : null;
    case "BracketRight": return mac ? "forward" : null;
    case "KeyN": return "new-window";
    case "Comma": return "settings";
    case "KeyW": return "close-window";
    case "KeyM": return "minimize";
    case "KeyR": return "reload";
    case "Digit0": return "zoom-reset";
    case "Equal": return "zoom-in";
    case "Minus": return "zoom-out";
    default: return null;
  }
}

module.exports = { actionFor };
