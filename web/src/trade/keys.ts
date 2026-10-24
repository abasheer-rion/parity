// Parity Trade's keyboard (DEC-0039), following the common platform keys: Shift+B and
// Shift+S buy and sell (Robinhood Legend, TradingView), Alt+T, Alt+H and Alt+F for
// drawings, Alt+Enter to maximise a chart, Ctrl+K for search, typing to find a symbol.

export const MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
const MOD = MAC ? "Cmd" : "Ctrl";

/** Shown in Settings and the key sheet (?). */
export const HOTKEYS: [string, string][] = [
  ["A to Z", "Symbol search"],
  [`${MOD}+K`, "Command palette"],
  ["/", "Indicators"],
  ["?", "Keys"],
  ["Shift+B / Shift+S", "Buy / sell (market)"],
  ["Shift+Alt+B / S", "Buy / sell (limit)"],
  ["Shift+D / W / M", "Timeframe 1D / 1W / 1M"],
  ["Shift+C", "Next chart type"],
  ["Shift+L", "Log scale"],
  ["Alt+H / T / F", "Horizontal line / trend / Fibonacci"],
  ["Esc", "Cursor, close"],
  ["Alt+1 / 2 / 4", "1, 2 or 4 charts"],
  ["[ / ]", "Previous / next chart"],
  ["Alt+Enter", "Maximise chart"],
  ["Alt+R", "Side panel"],
  ["Alt+B", "Bottom dock"],
  ["Alt+A", "New alert"],
  [`${MOD}+S`, "Save layout"],
  ["Shift+1 to 8", "Chart, Watchlists, Screener, Portfolio, Orders, Alerts, Strategies, Settings"],
];

export const isTyping = (el: EventTarget | null) => {
  const e = el as HTMLElement | null;
  if (!e || !e.tagName) return false;
  return e.tagName === "INPUT" || e.tagName === "TEXTAREA" || e.tagName === "SELECT" || e.isContentEditable;
};

/** A key that should open symbol search with that character: a letter or digit, no modifier. */
export const startsSearch = (e: KeyboardEvent) => !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey && /^[a-z0-9]$/i.test(e.key);
