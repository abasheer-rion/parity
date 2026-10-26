// The cookie notice: a small dark card on the first visit, and a preferences dialog.
// Plain DOM, no React, so the same file runs on the plain HTML pages (front page, legal
// pages) and inside the apps. Importing this file mounts it once.
//
// Any element with a data-cookie-prefs attribute opens the preferences dialog, so a
// "Cookie settings" link works anywhere (footers, Settings).
import { ANALYTICS_AVAILABLE, getConsent, hasDecided, privacySignal, setConsent } from "./consent";
import "./notice.css";
import { isDesktop } from "../desktop/bridge";

const POLICY = "/legal/cookies/";
let banner: HTMLElement | null = null;
let dialog: HTMLDialogElement | null = null;

type Child = Node | string | null | false;

/** Builds an element from fixed attributes and children. Text is always set as text. */
function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string | boolean> = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false) continue;
    node.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children) if (c) node.append(c);
  return node;
}

function closeBanner() {
  banner?.remove();
  banner = null;
}

function showBanner() {
  // The desktop app stores only what it needs to work (the sign-in cookie and its own
  // settings), as the cookie policy's desktop section says, so it shows no notice (DEC-0049).
  if (banner || hasDecided() || isDesktop()) return;
  // Equal choices: essential only, or essential plus our own analytics. A browser that asks
  // not to be tracked gets only the first (analytics cannot be switched on there).
  const signal = privacySignal();
  const essential = h("button", { type: "button", class: signal || !ANALYTICS_AVAILABLE ? "cn-btn cn-primary" : "cn-btn" }, signal || !ANALYTICS_AVAILABLE ? "OK" : "Essential only");
  const allow = !signal && ANALYTICS_AVAILABLE ? h("button", { type: "button", class: "cn-btn cn-primary" }, "Allow analytics") : null;
  const prefs = h("button", { type: "button", class: "cn-btn" }, "Preferences");
  essential.addEventListener("click", () => { setConsent({ analytics: false }); closeBanner(); });
  allow?.addEventListener("click", () => { setConsent({ analytics: true }); closeBanner(); });
  prefs.addEventListener("click", () => openPreferences());
  const text = !ANALYTICS_AVAILABLE
    ? "We use only essential cookies, to keep you signed in and remember your settings. We do not use analytics or ads. "
    : signal
    ? "We use essential cookies to keep you signed in and remember your settings. Your browser asks sites not to track it, so our analytics stays off. No ads. "
    : "We use essential cookies to keep you signed in and remember your settings. If you allow it, our own analytics also counts which pages you open and what you click, so we can improve Parity. Off unless you allow it. No ads or third parties. ";
  banner = h("section", { class: "cn", "aria-label": "Cookie notice" },
    h("p", { class: "cn-text" }, text, h("a", { href: POLICY }, "Cookie policy")),
    h("div", { class: "cn-actions" }, prefs, essential, allow));
  document.body.appendChild(banner);
}

function category(id: string, name: string, help: string, checked: boolean, disabled: boolean): HTMLLIElement {
  return h("li", { class: "cn-cat" },
    h("div", { class: "cn-cat-text" },
      h("label", { class: "cn-cat-name", for: `cn-${id}` }, name),
      h("span", { class: "cn-cat-help", id: `cn-${id}-help` }, help)),
    h("span", { class: "cn-switch" },
      h("input", { type: "checkbox", role: "switch", id: `cn-${id}`, checked, disabled, "aria-describedby": `cn-${id}-help` }),
      h("span", { "aria-hidden": "true" })));
}

function buildDialog(): HTMLDialogElement {
  const signal = privacySignal();
  const analyticsHelp = !ANALYTICS_AVAILABLE
    ? "Not used. Unavailable until we add any, and we will ask you here first."
    : signal
    ? "Off. Your browser sends Do Not Track or Global Privacy Control, so we do not offer it."
    : "Our own analytics: pages you open, time on each, what you click, how far you scroll and errors, with a random id kept in this browser. No ads, no third parties. Off unless you switch it on.";
  const form = h("form", { method: "dialog", class: "cn-form" },
    h("h2", { id: "cn-title", class: "cn-title" }, "Cookie preferences"),
    h("p", { id: "cn-desc", class: "cn-lead" },
      "Choose what Parity may store in your browser. The ",
      h("a", { href: POLICY }, "cookie policy"),
      " lists every item."),
    h("ul", { class: "cn-cats" },
      category("essential", "Essential", "Keeps you signed in and remembers settings such as this choice. Always on, because the site cannot work without it.", true, true),
      category("analytics", "Analytics", analyticsHelp, false, !ANALYTICS_AVAILABLE || signal)),
    h("div", { class: "cn-actions" },
      h("button", { type: "submit", class: "cn-btn", value: "cancel", formnovalidate: true }, "Cancel"),
      h("button", { type: "submit", class: "cn-btn cn-primary", value: "save" }, "Save choices")));
  const d = h("dialog", { class: "cn-dialog", "aria-labelledby": "cn-title", "aria-describedby": "cn-desc" }, form);
  d.addEventListener("close", () => {
    if (d.returnValue === "save") {
      setConsent({ analytics: (d.querySelector("#cn-analytics") as HTMLInputElement).checked });
      closeBanner();
    }
  });
  // Clicking the dimmed backdrop closes it, like Escape.
  d.addEventListener("click", (e) => { if (e.target === d) d.close("cancel"); });
  document.body.appendChild(d);
  return d;
}

/** Opens the preferences dialog, showing the current choice. */
export function openPreferences() {
  dialog ??= buildDialog();
  (dialog.querySelector("#cn-analytics") as HTMLInputElement).checked = getConsent()?.analytics === true;
  dialog.returnValue = "";
  if (typeof dialog.showModal === "function") dialog.showModal();
  else dialog.setAttribute("open", "");
}

/** Mounts the notice once per page. Safe to call more than once. */
export function mountCookieNotice() {
  const w = window as unknown as { __parityCookieNotice?: boolean };
  if (w.__parityCookieNotice) return;
  w.__parityCookieNotice = true;
  document.addEventListener("click", (e) => {
    const target = (e.target as Element | null)?.closest?.("[data-cookie-prefs]");
    if (!target) return;
    e.preventDefault();
    openPreferences();
  });
  const start = () => showBanner();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
}

mountCookieNotice();
