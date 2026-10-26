// The first-run tours (DEC-0060): 3 to 6 steps for each area, shown once per person, the
// first time they open that area. A step whose target is not on screen (a phone layout, a
// closed panel) is skipped by the tour itself, so phone and desktop steps can sit side by
// side. Copy follows REF-0017: say what it is, short sentences. Trade stays terse.
import { desktop } from "../desktop/bridge";
import type { GuidedStep } from "../ui/guidedTour";

export type Area = "home" | "desktop" | "verify" | "trade" | "lab" | "research" | "terminal" | "academy" | "account";

const MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
const MOD = MAC ? "Cmd" : "Ctrl";
const DESK_MOD = desktop?.platform === "darwin" ? "Cmd" : desktop ? "Ctrl" : MOD;

/** The first element matching `selector` whose text starts with `text`, or its closest `up`. */
export function byText(selector: string, text: string, up?: string): () => Element | null {
  return () => {
    const el = Array.from(document.querySelectorAll(selector)).find((e) => (e.textContent ?? "").trim().startsWith(text)) ?? null;
    return up && el ? el.closest(up) : el;
  };
}

export const TOURS: Record<Area, { label: string; steps: GuidedStep[] }> = {
  home: {
    label: "Home tour",
    steps: [
      { id: "checklist", target: "[data-tour='checklist']", title: "Getting started", body: "A few first things to try. Each one ticks itself when you do it. Hide the list any time and bring it back from Account." },
      { id: "search", target: ".side-search", title: "Search or ask", body: `Find a page, a strategy or a word. Press ${MOD} K from anywhere.`, placement: "right" },
      { id: "verify", target: ".side-nav a[href='#/verify']", title: "Verify", body: "Check a trade log or a bot's claims: profit per trade, worst loss, and whether the result could be luck.", placement: "right" },
      { id: "apps", target: byText(".side-nav a", "Trade"), title: "Trade, Workbench and Academy", body: "Each opens as a full-screen app in a new tab. Trade uses a demo account with virtual money.", placement: "right" },
      { id: "ask", target: ".phome-hero .ask", title: "Ask a question", body: "Type a question in plain words. Parity searches its pages, strategies and glossary." },
      { id: "menu", target: ".menu-fab", title: "Menu", body: "Every page, search and your account are in here." },
      { id: "account", target: ".account-row", title: "Your account", body: "Settings, two-step sign-in, your wallets and the tours. Turn tours back on here any time.", placement: "right" },
    ],
  },
  desktop: {
    label: "Desktop app tour",
    steps: [
      { id: "menu", target: { edge: "top-left", inset: desktop?.platform === "darwin" ? 80 : 10 }, title: "Menu button", body: "In the bar above: the sections and Account. Alt-click a section to open it in a new window." },
      { id: "palette", target: { edge: "top-right", inset: desktop?.platform === "darwin" ? 16 : 160 }, title: `Search with ${DESK_MOD} K`, body: "Jump to a section, a recent page or a command, or paste a Parity link." },
      { id: "windows", target: { edge: "top-left", inset: desktop?.platform === "darwin" ? 80 : 10 }, title: "More than one window", body: `${DESK_MOD} N opens a new window. Window, Save windows as workspace keeps a set you can open again later.` },
    ],
  },
  verify: {
    label: "Verify tour",
    steps: [
      { id: "mode", target: ".ui-seg[aria-label='What to check']", title: "Choose what to check", body: "Upload a trade log, describe a bot in words, or pick one of our tested strategies." },
      { id: "privacy", target: ".vf-privacy", title: "Your file stays here", body: "An uploaded file is read and checked in this browser. It is never sent to our servers." },
      { id: "input", target: ".vf-input", title: "Fill in what you know", body: "Each answer changes which checks run. The luck check needs to know how many versions were tried." },
      { id: "result", target: ".vf-input ~ .ui-empty, .vf-result, .ui-empty", title: "Read the result", body: "Profit per trade, worst loss, the luck check and signs of tuning to past data, in plain words." },
    ],
  },
  trade: {
    label: "Trade tour",
    steps: [
      { id: "chart", target: ".ws-charts", title: "Chart", body: "Type any letter to change symbol. Shift+D, W or M sets the timeframe." },
      { id: "chart-m", target: ".m-pane", title: "Chart", body: "Tap the symbol to change it." },
      { id: "ticket", target: "[aria-label='Order ticket']", title: "Order ticket", body: "Demo account, virtual money. Shift+B buys, Shift+S sells.", placement: "left" },
      { id: "ticket-m", target: ".mtabs button:nth-child(3)", title: "Order ticket", body: "Demo account, virtual money.", placement: "top" },
      { id: "dock", target: ".ws-dock", title: "Positions", body: "Positions, orders and fills.", placement: "top" },
      { id: "dock-m", target: ".mtabs button:nth-child(4)", title: "Positions", body: "Positions, orders and fills.", placement: "top" },
      { id: "keys", target: ".rail", title: "Views and keys", body: "Shift+1 to 9 switch views. Press ? for every key.", placement: "right" },
      { id: "palette", target: ".tb-search", title: "Command palette", body: `${MOD} K: symbols, layouts and every command.` },
    ],
  },
  lab: {
    label: "Workbench tour",
    steps: [
      { id: "tools", target: ".lb-rail", title: "Tools", body: "Try settings, What if, Compare, Strategy search, Edge Lab and live prices. Shift and a number switches between them.", placement: "right" },
      { id: "tools-m", target: ".lb-tabs", title: "Tools", body: "Try settings, What if, Compare, Strategy search, Edge Lab and live prices.", placement: "top" },
      { id: "main", target: ".lb-main", title: "Your workspace", body: "Change a strategy's settings and see the result after trading costs. Nothing here changes the research results.", placement: "left" },
      { id: "link", target: ".lb-copy", title: "Copy link", body: "Saves this view as it is now in a link you can share. Press L." },
      { id: "keys", target: ".lb-keys", title: "Keys", body: "Press ? for every shortcut." },
    ],
  },
  research: {
    label: "Research tour",
    steps: [
      { id: "answer", target: ".rq", title: "The answer so far", body: "Whether any strategy beats holding the S&P 500, from the latest research run." },
      { id: "tests", target: ".verdict-bar", title: "The 11 tests", body: "Every strategy runs the same 11 tests. This bar counts how many strategies got each verdict." },
      { id: "passed", target: byText(".pcard h2", "Most tests passed", ".pcard"), title: "Most tests passed", body: "The strategies that passed the most of the 11 tests, with their luck check score." },
      { id: "search-card", target: byText(".pcard h2", "Strategy search", ".pcard"), title: "Strategy search", body: "A program tries strategy variations around the clock. What it finds stays a lead until it is registered and run officially." },
      { id: "search", target: ".side-search", title: "Search", body: `Find a doc, a strategy or a term, or ask a question. ${MOD} K opens it from anywhere.`, placement: "right" },
    ],
  },
  terminal: {
    label: "Terminal tour",
    steps: [
      { id: "cmd", target: ".term-cmd", title: "Command line", body: "Type a function or a series, such as MON or CMP EUR JPY, then Enter. Press / or Ctrl K to jump here." },
      { id: "ws", target: ".term-wstabs", title: "Workspaces", body: "Each tab is a preset set of panels. F2 and up switch between them." },
      { id: "panels", target: ".term-main", title: "Panels", body: "Click a panel to focus it. Commands run in the focused panel.", placement: "top" },
      { id: "actions", target: ".term-wsact", title: "Add, reset, help", body: "Add a panel, reset this workspace, or open the help (F1)." },
    ],
  },
  academy: {
    label: "Academy tour",
    steps: [
      { id: "continue", target: ".pac-hero", title: "Continue", body: "Opens the lesson you were on, or the first one. Press C." },
      { id: "courses", target: ".pac-grid", title: "Courses", body: "Each course lists its lessons and minutes. A lesson ends with a quick check.", placement: "top" },
      { id: "progress", target: ".pac-chip", title: "Progress", body: "Lessons done across every course, saved to your account." },
      { id: "nav", target: ".pac-rail", title: "Library and settings", body: "Move between the library, your progress and settings.", placement: "right" },
      { id: "nav-m", target: ".pac-tabs", title: "Library and settings", body: "Move between the library, your progress and settings.", placement: "top" },
    ],
  },
  account: {
    label: "Account tour",
    steps: [
      { id: "email", target: byText(".srow-label", "Email", ".srow"), title: "Email", body: "The address you sign in with. Changing it asks you to confirm both addresses." },
      { id: "mfa", target: byText(".srow-label", "Two-step sign-in", ".srow"), title: "Two-step sign-in", body: "Ask for a code from an authenticator app after your password." },
      { id: "checklist", target: "[data-tour='acct-checklist']", title: "Getting started", body: "Bring back the checklist on Home after hiding it." },
      { id: "tours", target: "[data-tour='acct-tours']", title: "Show tours again", body: "Turns every tour back on. Each one opens once more, the next time you visit that area." },
    ],
  },
};
