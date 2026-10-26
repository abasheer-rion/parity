// Accessibility checks that axe cannot do on its own, run in CI after scripts/a11y.mjs.
// On every page (scripts/lib/a11y-env.mjs), signed in with sign-in skipped, it checks:
//   structure    one main landmark, one h1, no skipped heading levels, no positive tabindex
//   names        every button, link, field, tab and switch has an accessible name (read
//                from the browser's accessibility tree), every image has alt text, every
//                chart (canvas or svg) has a name or a text alternative next to it
//   keyboard     Tab from the top: the first stop is a working skip link, focus reaches the
//                page's main area, focus never gets stuck, every stop shows a visible focus
//                indicator and is not hidden under a sticky bar or notice (WCAG 2.4.7, 2.4.11)
//   targets      every control is at least 24 by 24 CSS px, or has room around it (2.5.8);
//                links inside sentences are exempt
//   reflow       no sideways page scroll at 320 CSS px and at 200% zoom (640 px) (1.4.10)
//   motion       with reduced motion asked for, no endless or long CSS animation and no
//                animation loop runs (2.3.3); without it, anything that moves or updates by
//                itself for more than 5 seconds has a Pause or Stop control (2.2.2)
//   live regions polite ones change at most a few times in 6 seconds, assertive ones not at all
//   contrast     text that axe could not judge (over glass, gradients and glows) is measured
//                against the real pixels behind it (1.4.3)
// On the UI library page every Tab stop must show a ring at least 2px wide (DEC-0061).
// On key pages it also opens every menu and dialog from the keyboard: a dialog takes focus
// and keeps it (Tab stays inside), Escape closes it and focus goes back to the button that
// opened it. On the sign-in pages it sends bad input and checks the error is tied to the
// field (aria-invalid, aria-describedby) and announced. The desktop app's own pages get the
// keyboard and structure checks too (opened as files, Electron is never started).
//
//   npm run a11y:checks
//   A11Y_ONLY=/trade/ npm run a11y:checks       only paths that contain the text
//   A11Y_SKIP=motion,contrast npm run a11y:checks
//
// Exits 1 on any problem and prints each one.
import { chromium } from "playwright";
import sharp from "sharp";
import AxeBuilder from "@axe-core/playwright";
import { rmSync } from "node:fs";
import { allPages, buildPublic, localContext, openPage, pool, startServer } from "./lib/a11y-env.mjs";
import { DESKTOP_PAGES, shellStub } from "./lib/desktop-shell.mjs";

const ONLY = process.env.A11Y_ONLY;
const SKIP = new Set((process.env.A11Y_SKIP ?? "").split(",").filter(Boolean));
const KEY_PAGES = [
  "/", "/login/", "/legal/privacy/", "/blog/", "/learn/", "/no-such-page-xyz/",
  "/app/#/", "/app/#/strategies", "/app/#/news", "/app/#/settings", "/app/#/markets",
  "/research/#/", "/research/#/catalog", "/sim/#/overview", "/trade/#/chart", "/trade/#/watchlists",
  "/academy/#/", "/academy/#/reading-a-backtest/return", "/lab/#/try",
];
const problems = [];
const add = (where, what) => problems.push(`${where}: ${what}`);

// ---------------------------------------------------------------- in-page helpers

// Installed before each page's own scripts: counts animation frames and records changes
// to the page's text and to its live regions, with times.
function instrument() {
  window.__a11y = { frames: 0, changes: [], live: [] };
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => { window.__a11y.frames += 1; return raf(cb); };
  const start = () => {
    const name = (el) => {
      for (let n = el; n && n !== document.body; n = n.parentElement) if (n.id || n.className) return `${n.tagName.toLowerCase()}${n.id ? `#${n.id}` : ""}${typeof n.className === "string" && n.className ? `.${n.className.trim().split(/\s+/)[0]}` : ""}`;
      return "body";
    };
    new MutationObserver((list) => {
      if (!window.__a11y.watch) return;
      const t = performance.now();
      for (const m of list) {
        const el = m.target.nodeType === 1 ? m.target : m.target.parentElement;
        if (!el || !el.isConnected) continue;
        const live = el.closest('[aria-live]:not([aria-live="off"]), [role="status"], [role="alert"], [role="log"]');
        if (live && (live.textContent ?? "").trim()) window.__a11y.live.push({ t, region: name(live), assertive: live.getAttribute("aria-live") === "assertive" || live.getAttribute("role") === "alert" });
        if (el.checkVisibility?.() && !el.closest("[aria-hidden=true]")) window.__a11y.changes.push({ t, el: name(el) });
      }
    }).observe(document.documentElement, { subtree: true, childList: true, characterData: true });
  };
  if (document.documentElement) start(); else document.addEventListener("DOMContentLoaded", start);
}

// Structure, names of images and charts, targets and tabindex, read from the DOM.
function domChecks() {
  const out = [];
  const visible = (el) => el.checkVisibility?.({ visibilityProperty: true, opacityProperty: false }) && el.getBoundingClientRect().width > 0 && !el.closest("[inert], [aria-hidden=true]");
  const label = (el) => `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}${typeof el.className === "string" && el.className ? `.${el.className.trim().split(/\s+/).slice(0, 2).join(".")}` : ""} "${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 40)}"`;
  const mains = [...document.querySelectorAll("main, [role=main]")].filter(visible);
  if (mains.length !== 1) out.push(`${mains.length} main landmarks (want 1)`);
  const heads = [...document.querySelectorAll("h1, h2, h3, h4, h5, h6, [role=heading]")].filter(visible)
    .map((h) => ({ level: Number(h.getAttribute("aria-level") ?? h.tagName.slice(1)) || 2, text: (h.textContent ?? "").trim().slice(0, 40), modal: !!h.closest("[aria-modal=true], dialog[open]") }))
    .filter((h) => !h.modal);
  const h1 = heads.filter((h) => h.level === 1);
  if (h1.length !== 1) out.push(`${h1.length} visible h1 headings (want 1)${h1.length ? `: ${h1.map((h) => `"${h.text}"`).join(", ")}` : ""}`);
  for (let i = 1; i < heads.length; i++) {
    if (heads[i].level > heads[i - 1].level + 1) { out.push(`heading level skipped: h${heads[i - 1].level} "${heads[i - 1].text}" then h${heads[i].level} "${heads[i].text}"`); break; }
  }
  if (heads.length && heads[0].level !== 1 && h1.length) out.push(`first heading is h${heads[0].level} "${heads[0].text}", before the h1`);
  for (const el of document.querySelectorAll("[tabindex]")) if (Number(el.getAttribute("tabindex")) > 0) out.push(`positive tabindex on ${label(el)}`);
  for (const img of document.querySelectorAll("img")) if (!img.hasAttribute("alt") && !img.closest("[aria-hidden=true]") && img.getAttribute("role") !== "presentation") out.push(`image without alt: ${img.getAttribute("src")?.slice(0, 60)}`);
  // Charts: a big canvas or svg needs a name, or must be hidden with a text alternative beside it.
  for (const el of document.querySelectorAll("canvas, svg")) {
    if (!visible(el) && !el.closest("[aria-hidden=true]")) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 120 || r.height < 60 || el.closest("button, a, [role=button]")) continue;
    if (el.closest("svg") !== el && el.tagName === "svg") continue;
    // Hidden decoration (a backdrop, a glow) needs nothing; a hidden chart still needs its words.
    const chartish = (n) => { for (let i = 0; n && i < 4; n = n.parentElement, i++) if (/chart|plot|graph|spark|curve/i.test(`${n.getAttribute("class") ?? ""} ${n.id}`)) return true; return false; };
    if (el.closest("[aria-hidden=true]") && !chartish(el)) continue;
    const named = (n) => n.getAttribute("aria-label") || n.getAttribute("aria-labelledby") || (n.tagName === "svg" && n.querySelector(":scope > title"));
    let ok = false;
    for (let n = el, i = 0; n && i < 10; n = n.parentElement, i++) {
      if (named(n) && ["img", "figure", "region", "group", "application"].includes(n.getAttribute("role") ?? (n.tagName === "FIGURE" ? "figure" : "")) ) { ok = true; break; }
      if (n.tagName === "FIGURE" && n.querySelector("figcaption")) { ok = true; break; }
      // A written summary or data table beside it (a table the chart library draws the chart
      // inside does not count).
      if ([...n.querySelectorAll(":scope > [data-chart-alt], :scope > table, :scope > .sr-only, :scope > .visually-hidden")].some((alt) => !alt.contains(el) && (alt.textContent ?? "").trim().length > 10)) { ok = true; break; }
    }
    if (el.tagName === "svg" && named(el) && (el.getAttribute("role") === "img" || el.getAttribute("role") === "figure")) ok = true;
    if (!ok) out.push(`chart without a text alternative: ${label(el)} ${Math.round(r.width)}x${Math.round(r.height)}`);
  }
  // Fields marked invalid must point at their error.
  for (const el of document.querySelectorAll("[aria-invalid=true]")) {
    const ids = `${el.getAttribute("aria-describedby") ?? ""} ${el.getAttribute("aria-errormessage") ?? ""}`.trim().split(/\s+/).filter(Boolean);
    if (!ids.some((id) => (document.getElementById(id)?.textContent ?? "").trim())) out.push(`invalid field with no error tied to it: ${label(el)}`);
  }
  // Target size (2.5.8): 24 by 24, or a 24 px circle around it that touches no other target.
  const sel = "a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [role=tab], [role=link], [role=checkbox], [role=radio], [role=switch], [role=menuitem], [role=option], [tabindex]:not([tabindex='-1'])";
  const targets = [...document.querySelectorAll(sel)].filter((el) => visible(el) && !el.disabled);
  const rects = targets.map((el) => el.getBoundingClientRect());
  // A link inside a line of text (a sentence, or a list such as "A, B, C") is exempt: its
  // height is set by the line. Flex and grid items are not inline, so they never count.
  const inline = (el) => {
    if (el.tagName !== "A" || !getComputedStyle(el).display.startsWith("inline")) return false;
    let block = el.parentElement;
    while (block && getComputedStyle(block).display.startsWith("inline")) block = block.parentElement;
    if (!block) return false;
    const text = (block.textContent ?? "").replace(/\s+/g, " ").trim();
    return text.length > (el.textContent ?? "").replace(/\s+/g, " ").trim().length + 1;
  };
  const small = [];
  targets.forEach((el, i) => {
    const r = rects[i];
    if (r.width >= 23.5 && r.height >= 23.5) return;
    if (inline(el)) return;
    if (el.matches("input[type=checkbox], input[type=radio]") && el.closest("label")) {
      const lr = el.closest("label").getBoundingClientRect();
      if (lr.width >= 24 && lr.height >= 24) return;
    }
    if (el.closest(".skip-link, .skip")) return;
    // A panel divider you can move with the arrow keys; its pointer band is widened in CSS.
    if (el.getAttribute("role") === "separator" && el.tabIndex >= 0 && el.hasAttribute("aria-valuenow")) return;
    small.push(i);
  });
  for (const i of small) {
    const r = rects[i];
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const clash = targets.some((other, j) => {
      if (j === i || other.contains(targets[i]) || targets[i].contains(other)) return false;
      const o = rects[j];
      if (small.includes(j)) return Math.hypot(cx - (o.left + o.width / 2), cy - (o.top + o.height / 2)) < 24;
      const nx = Math.max(o.left, Math.min(cx, o.right)), ny = Math.max(o.top, Math.min(cy, o.bottom));
      return Math.hypot(cx - nx, cy - ny) < 12;
    });
    if (clash) out.push(`target under 24x24 px with no room around it: ${label(targets[i])} ${Math.round(r.width)}x${Math.round(r.height)}`);
  }
  return out;
}

// The page's tab stops, in DOM order, each tagged so the Tab walk can find it again, with
// how it looks unfocused.
function snapshotStops() {
  const sel = "a[href], button, input:not([type=hidden]), select, textarea, summary, iframe, [tabindex], [contenteditable=true]";
  const style = (el) => {
    const s = getComputedStyle(el);
    const p = el.parentElement ? getComputedStyle(el.parentElement) : null;
    return [s.outlineStyle, s.outlineWidth, s.outlineColor, s.boxShadow, s.borderColor, s.backgroundColor, s.color, s.textDecorationLine, s.textDecorationColor, p?.boxShadow, p?.outlineStyle, p?.borderColor, p?.backgroundColor].join("|");
  };
  // Unfocused looks: take focus off whatever has it (an autofocused field) first.
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  const stops = [...document.querySelectorAll(sel)].filter((el) => el.tabIndex >= 0 && !el.disabled && el.checkVisibility?.({ visibilityProperty: true }) && !el.closest("[inert]"));
  stops.forEach((el, i) => { el.dataset.a11yStop = String(i); el.dataset.a11yStyle = style(el); });
  return stops.length;
}

// What the focused element is and whether it shows focus and is in view.
function focusState() {
  const el = document.activeElement;
  if (!el || el === document.body || el === document.documentElement) return { body: true };
  // A stop that appeared after the snapshot gets its own id now.
  if (el.dataset.a11yStop == null) el.dataset.a11yStop = `late-${(window.__a11yLate = (window.__a11yLate ?? 0) + 1)}`;
  const s = getComputedStyle(el);
  const p = el.parentElement ? getComputedStyle(el.parentElement) : null;
  const now = [s.outlineStyle, s.outlineWidth, s.outlineColor, s.boxShadow, s.borderColor, s.backgroundColor, s.color, s.textDecorationLine, s.textDecorationColor, p?.boxShadow, p?.outlineStyle, p?.borderColor, p?.backgroundColor].join("|");
  const outline = s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0 && !/rgba\(\d+, \d+, \d+, 0\)|transparent/.test(s.outlineColor);
  const changed = el.dataset.a11yStyle ? el.dataset.a11yStyle !== now : true;
  let r = el.getBoundingClientRect();
  // A visually hidden field (a styled file picker) shows its focus on its label instead.
  let hiddenOk = null;
  if (r.width <= 4 && r.height <= 4) {
    const lab = el.closest("label") ?? el.labels?.[0];
    if (lab) {
      const ls = getComputedStyle(lab);
      hiddenOk = (ls.outlineStyle !== "none" && parseFloat(ls.outlineWidth) > 0) || ls.boxShadow !== "none";
      r = lab.getBoundingClientRect();
    }
  }
  // Obscured: every sample point inside it is covered by something that is not it.
  let covered = 0, points = 0, coveredBy = "";
  for (const [fx, fy] of [[0.5, 0.5], [0.15, 0.2], [0.85, 0.2], [0.15, 0.8], [0.85, 0.8]]) {
    const x = r.left + r.width * fx, y = r.top + r.height * fy;
    if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) continue;
    points += 1;
    const hit = document.elementFromPoint(x, y);
    const own = hiddenOk !== null ? (el.closest("label") ?? el.labels?.[0]) : el;
    if (hit && hit !== el && !own.contains(hit) && !hit.contains(own)) { covered += 1; const pc = hit.parentElement?.className; coveredBy = `${hit.tagName.toLowerCase()}${typeof hit.className === "string" && hit.className ? `.${hit.className.trim().split(/\s+/)[0]}` : ""}${typeof pc === "string" && pc ? ` in .${pc.trim().split(/\s+/)[0]}` : ""}`; }
  }
  const modal = el.closest("[aria-modal=true], dialog[open]");
  const label = `${el.tagName.toLowerCase()}${el.getAttribute("type") ? `[type=${el.getAttribute("type")}]` : ""}${el.id ? `#${el.id}` : ""}${typeof el.className === "string" && el.className ? `.${el.className.trim().split(/\s+/)[0]}` : ""} "${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 30)}"`;
  return {
    stop: el.dataset.a11yStop ?? null, label: covered === points && points ? `${label} (under ${coveredBy})` : label, visible: hiddenOk ?? (outline || changed), obscured: points > 0 && covered === points,
    dateLike: el.matches("input[type=date], input[type=time], input[type=datetime-local], input[type=month], input[type=week]"),
    inMain: !!el.closest("main, [role=main]"), skip: /skip/i.test(el.textContent ?? "") && el.tagName === "A", href: el.getAttribute("href"), modal: !!modal,
  };
}

// ---------------------------------------------------------------- the checks

async function axNames(page, where) {
  const cdp = await page.context().newCDPSession(page);
  const { nodes } = await cdp.send("Accessibility.getFullAXTree");
  await cdp.detach();
  const ROLES = new Set(["button", "link", "textbox", "searchbox", "combobox", "checkbox", "radio", "switch", "tab", "menuitem", "slider", "spinbutton", "listbox", "menuitemcheckbox", "menuitemradio", "image", "img"]);
  const seen = new Set();
  for (const n of nodes) {
    if (n.ignored || !ROLES.has(n.role?.value)) continue;
    const name = (n.name?.value ?? "").trim();
    if (name) continue;
    const key = `${n.role.value} ${n.backendDOMNodeId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const props = Object.fromEntries((n.properties ?? []).map((p) => [p.name, p.value?.value]));
    if (props.hidden) continue;
    let desc = "";
    try {
      const c2 = await page.context().newCDPSession(page);
      const { node } = await c2.send("DOM.describeNode", { backendNodeId: n.backendDOMNodeId });
      await c2.detach();
      const a = Object.fromEntries((node.attributes ?? []).reduce((acc, v, i, arr) => (i % 2 ? acc : [...acc, [v, arr[i + 1]]]), []));
      desc = `${node.localName}${a.id ? `#${a.id}` : ""}${a.class ? `.${a.class.split(/\s+/)[0]}` : ""}`;
    } catch { /* gone */ }
    add(where, `${n.role.value} with no accessible name: ${desc}`);
  }
}

// Puts the keyboard's starting point at the very top of the page, as on a fresh load
// (an autofocused field would otherwise start the walk part way down).
async function fromTop(page) {
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    const mark = document.createElement("span");
    mark.tabIndex = -1;
    document.body.prepend(mark);
    mark.focus({ preventScroll: true });
    mark.blur();
    mark.remove();
  });
}

async function tabWalk(page, where, { needSkip = true, needMain = true } = {}) {
  const count = await page.evaluate(snapshotStops);
  if (!count) return;
  await page.mouse.move(0, 0);
  await fromTop(page);
  const steps = Math.min(count + 3, 90);
  const order = [];
  let reachedMain = false;
  let noFocus = 0, obscured = 0, dateSteps = 0;
  const examples = { noFocus: [], obscured: [] };
  for (let i = 0; i < steps; i++) {
    await page.keyboard.press("Tab");
    let s = await page.evaluate(focusState);
    // Something closing as focus leaves it (a suggestion list) gets a moment to go first.
    if (s.obscured || (!s.body && !s.visible)) { await page.waitForTimeout(250); s = await page.evaluate(focusState); }
    if (s.body) { if (i > 0) break; continue; }
    // A skip link is needed only when something repeated (a header, a menu) comes before
    // the main area; a page whose first stop is already in it has nothing to skip.
    if (i === 0 && needSkip && !s.inMain) {
      if (!s.skip) add(where, `first Tab stop is ${s.label}, not a skip link`);
      else {
        const before = await page.evaluate(() => location.href);
        await page.keyboard.press("Enter");
        await page.waitForTimeout(250);
        const after = await page.evaluate(() => ({ href: location.href, inMain: !!document.activeElement?.closest("main, [role=main]") || document.activeElement?.matches("main, [role=main], #main") }));
        if (!after.inMain) {
          // A plain #main link may only move where the next Tab starts; that still works.
          await page.keyboard.press("Tab");
          const next = await page.evaluate(() => !!document.activeElement?.closest("main, [role=main]"));
          if (!next) add(where, "skip link does not move focus to the main area");
        }
        if (after.href !== before && new URL(before).hash.startsWith("#/")) add(where, `skip link changed the page address to ${after.href}`);
        await fromTop(page);
        await page.keyboard.press("Tab");
      }
    }
    if (s.inMain) reachedMain = true;
    const id = s.stop ?? s.label;
    const prev = order.indexOf(id);
    if (prev < 0) {
      if (!s.visible) { noFocus += 1; if (examples.noFocus.length < 4) examples.noFocus.push(s.label); }
      if (s.obscured && !s.modal) { obscured += 1; if (examples.obscured.length < 3) examples.obscured.push(s.label); }
    }
    if (prev >= 0 && order.length - prev < Math.min(count, 12) - 1 && !s.modal && !order.slice(prev).every((x) => x === id)) {
      add(where, `focus is stuck in a loop of ${order.length - prev} stops: ${order.slice(prev, prev + 4).join(", ")}`);
      break;
    }
    // Tab steps through the day, month and year of a date field, which keeps the focus.
    if (prev >= 0 && order[order.length - 1] === id && s.dateLike && ++dateSteps < 5) continue;
    if (prev >= 0 && order[order.length - 1] === id) { add(where, `Tab does not move on from ${s.label}`); break; }
    dateSteps = 0;
    if (prev >= 0) break; // wrapped round to the start
    order.push(id);
  }
  if (noFocus) add(where, `${noFocus} Tab stops show no visible focus, e.g. ${examples.noFocus.join(", ")}`);
  if (obscured) add(where, `${obscured} Tab stops are hidden under other content when focused, e.g. ${examples.obscured.join(", ")}`);
  if (needMain && !reachedMain && (await page.locator("main a[href], main button, main input, main select, main [tabindex='0']").count()) > 0) add(where, "Tab never reaches the main area");
}

async function dialogs(page, where) {
  const triggers = await page.evaluate(() => {
    const els = [...document.querySelectorAll("[aria-haspopup]:not([aria-haspopup=false]), button[aria-controls][aria-expanded=false], [data-dialog-trigger]")]
      .filter((el) => el.checkVisibility?.() && !el.disabled && el.getBoundingClientRect().width > 0 && !el.closest("[inert]"));
    return els.slice(0, 8).map((el, i) => { el.dataset.a11yTrigger = String(i); return { i, label: `${el.tagName.toLowerCase()} "${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 30)}"`, popup: el.getAttribute("aria-haspopup") }; });
  });
  for (const t of triggers) {
    const sel = `[data-a11y-trigger="${t.i}"]`;
    if (!(await page.locator(sel).count())) continue;
    await page.locator(sel).focus();
    await page.keyboard.press("Enter");
    await page.waitForTimeout(350);
    const state = await page.evaluate((s) => {
      const trig = document.querySelector(s);
      const modal = [...document.querySelectorAll("[aria-modal=true], dialog[open]")].find((d) => d.checkVisibility?.() && (d.getAttribute("aria-modal") === "true" || d.matches(":modal")));
      return { expanded: trig?.getAttribute("aria-expanded"), modal: !!modal, focusInModal: !!(modal && modal.contains(document.activeElement)), url: location.href };
    }, sel);
    if (state.modal) {
      if (!state.focusInModal) add(where, `dialog from ${t.label} does not take focus`);
      let escaped = false;
      for (let k = 0; k < 20; k++) {
        await page.keyboard.press("Tab");
        const inside = await page.evaluate(() => { const m = [...document.querySelectorAll("[aria-modal=true], dialog[open]")].find((d) => d.checkVisibility?.()); return !m || m.contains(document.activeElement); });
        if (!inside) { escaped = true; break; }
      }
      if (escaped) add(where, `focus leaves the dialog from ${t.label} on Tab`);
    }
    if (state.modal || (t.popup && state.expanded === "true")) {
      await page.keyboard.press("Escape");
      await page.waitForTimeout(350);
      const after = await page.evaluate((s) => {
        const trig = document.querySelector(s);
        const modal = [...document.querySelectorAll("[aria-modal=true], dialog[open]")].find((d) => d.checkVisibility?.());
        return { open: !!modal, expanded: trig?.getAttribute("aria-expanded"), back: !!trig && (document.activeElement === trig || trig.contains(document.activeElement)) };
      }, sel);
      if (after.open || after.expanded === "true") add(where, `Escape does not close the ${state.modal ? "dialog" : "menu"} from ${t.label}`);
      else if (!after.back) add(where, `focus does not go back to ${t.label} after Escape`);
    } else if (state.expanded === "true") {
      await page.keyboard.press("Enter");
    }
    if (state.url !== (await page.evaluate(() => location.href))) break;
  }
}

async function reflow(page, where, base) {
  for (const [w, h, what] of [[320, 700, "320 px"], [640, 430, "200% zoom"]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(400);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (over > 1) add(where, `scrolls sideways by ${over}px at ${what}`);
  }
  await page.setViewportSize(base);
}

async function motion(browser, server, path) {
  const where = `motion ${path}`;
  // Reduced motion: nothing endless or long, and no animation loop.
  const ctx = await localContext(browser, server.base, { viewport: { width: 1280, height: 860 }, reducedMotion: "reduce" }, { tours: false });
  await ctx.addInitScript(instrument);
  const page = await ctx.newPage();
  await openPage(page, server.base + path);
  await page.waitForTimeout(800);
  const reduced = await page.evaluate(async () => {
    const f0 = window.__a11y.frames;
    await new Promise((r) => setTimeout(r, 2000));
    const running = document.getAnimations().filter((a) => a.playState === "running").map((a) => {
      const t = a.effect?.getComputedTiming?.() ?? {};
      const el = a.effect?.target;
      // Any animation still running once the page has settled, endless or not (DEC-0061).
      return { endless: t.iterations === Infinity, long: typeof t.duration === "number" && t.duration > 10, name: a.animationName ?? a.constructor.name, el: el ? `${el.tagName?.toLowerCase()}.${typeof el.className === "string" ? el.className.split(/\s+/)[0] : ""}` : "" };
    }).filter((a) => a.endless || a.long);
    return { frames: window.__a11y.frames - f0, running };
  });
  // Running CSS animations under reduced motion are checked by scripts/a11y.mjs (DEC-0061);
  // this adds the script-driven loops it cannot see.
  if (reduced.frames > 60) add(where, `an animation loop runs with reduced motion on (${reduced.frames} frames in 2 s)`);
  await ctx.close();

  // Normal motion: what moves or changes by itself for more than 5 seconds needs a Pause or Stop.
  const ctx2 = await localContext(browser, server.base, { viewport: { width: 1280, height: 860 }, reducedMotion: "no-preference" }, { tours: false });
  await ctx2.addInitScript(instrument);
  const p2 = await ctx2.newPage();
  await openPage(p2, server.base + path);
  await p2.waitForTimeout(1500);
  const moving = await p2.evaluate(async () => {
    window.__a11y.changes = []; window.__a11y.live = []; window.__a11y.watch = true;
    const t0 = performance.now();
    await new Promise((r) => setTimeout(r, 6500));
    window.__a11y.watch = false;
    const by = new Map();
    for (const c of window.__a11y.changes) { const v = by.get(c.el) ?? []; v.push(c.t - t0); by.set(c.el, v); }
    const updating = [...by.entries()].filter(([, ts]) => ts.length >= 3 && Math.min(...ts) < 2500 && Math.max(...ts) > 5000).map(([el]) => el);
    const anims = document.getAnimations().filter((a) => a.playState === "running" && a.effect?.getComputedTiming?.().iterations === Infinity)
      .map((a) => a.effect?.target).filter((el) => el && el.checkVisibility?.() && !el.closest("[aria-hidden=true]") && el.getBoundingClientRect().width > 60 && !/spin|skel|load|shimmer|busy|progress/i.test(`${el.className}`));
    const live = new Map();
    for (const l of window.__a11y.live) { const v = live.get(l.region) ?? { n: 0, assertive: l.assertive, ts: [] }; if (!v.ts.some((t) => Math.abs(t - l.t) < 50)) { v.n += 1; v.ts.push(l.t); } live.set(l.region, v); }
    const pause = [...document.querySelectorAll("button, [role=button], [role=switch], input[type=checkbox]")].some((b) => b.checkVisibility?.() && /\b(pause|resume|freeze)\b|\bstop (the )?(live )?(updates|ticker|tape|animation|scrolling)|\bplay (the )?(ticker|tape|animation)/i.test(`${b.getAttribute("aria-label") ?? ""} ${b.textContent ?? ""} ${b.getAttribute("title") ?? ""}`));
    return { updating, moving: anims.map((el) => `${el.tagName.toLowerCase()}.${`${el.className}`.split(/\s+/)[0]}`), live: [...live.entries()].map(([region, v]) => ({ region, n: v.n, assertive: v.assertive })), pause };
  });
  if ((moving.updating.length || moving.moving.length) && !moving.pause) {
    add(where, `content updates or moves by itself for over 5 s with no Pause or Stop control: ${[...moving.updating, ...moving.moving].slice(0, 4).join(", ")}`);
  }
  for (const l of moving.live) {
    if (l.assertive && l.n > 1) add(where, `assertive live region ${l.region} spoke ${l.n} times in 6.5 s`);
    else if (l.n > 3) add(where, `live region ${l.region} spoke ${l.n} times in 6.5 s (want 3 or fewer)`);
  }
  await ctx2.close();
}

// Text axe could not judge (over glass, images, gradients): hide the text, photograph what
// is behind it, and measure the text colour against the lightest and darkest pixels.
async function realContrast(page, where) {
  const axe = await new AxeBuilder({ page }).withRules(["color-contrast"]).analyze();
  const nodes = axe.incomplete.flatMap((v) => v.nodes).slice(0, 40);
  let worst = [];
  const retried = new Map();
  for (let k = 0; k < nodes.length; k++) {
    const n = nodes[k];
    // A slow machine can still be drawing or fading the picture: wait longer on each retry.
    if (retried.has(n.target[0])) await page.waitForTimeout(1200 * retried.get(n.target[0]));
    const target = n.target[0];
    if (typeof target !== "string") continue;
    const info = await page.evaluate(async (sel) => {
      const el = document.querySelector(sel);
      if (!el || !el.checkVisibility?.()) return null;
      el.scrollIntoView({ block: "center", behavior: "instant" });
      for (let i = 0; i < 3; i++) await new Promise((r) => requestAnimationFrame(r));
      // The box of the text itself, without padding or borders.
      // The element's own words (its first text node), not the boxes of what it contains.
      const range = document.createRange();
      const own = [...el.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim());
      range.selectNodeContents(own ?? el);
      // One line box of it (a link that wraps would otherwise take in its neighbours' text).
      const t = [...range.getClientRects()].sort((p, q) => q.width * q.height - p.width * p.height)[0] ?? range.getBoundingClientRect();
      // Only the part inside the element's own box (text cut off with an ellipsis is not drawn).
      const eb = el.getBoundingClientRect();
      const left = Math.max(t.left, eb.left), top = Math.max(t.top, eb.top), right = Math.min(t.right, eb.right), bottom = Math.min(t.bottom, eb.bottom);
      const r = { left, top, right, bottom, width: right - left, height: bottom - top };
      if (r.width < 4 || r.height < 4) return null;
      const s = getComputedStyle(el);
      const svg = el instanceof SVGElement;
      let op = 1;
      for (let x = el; x; x = x.parentElement) op *= Number(getComputedStyle(x).opacity);
      const paint = svg ? s.fill : s.color;
      const m = paint.match(/rgba?\(([\d.]+),? ([\d.]+),? ([\d.]+)(?:,? \/? ?([\d.]+))?\)/) ?? paint.match(/color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)(?: \/ ([\d.]+))?\)/);
      if (!m) return null;
      const srgb = paint.startsWith("color(");
      const rgb = [1, 2, 3].map((i) => (srgb ? Number(m[i]) * 255 : Number(m[i])));
      const a = (m[4] === undefined ? 1 : Number(m[4])) * op * (svg ? Number(s.fillOpacity || 1) : 1);
      const size = parseFloat(s.fontSize), bold = Number(s.fontWeight) >= 700;
      if (!document.getElementById("a11y-hide-text")) {
        const st = document.createElement("style");
        st.id = "a11y-hide-text";
        st.textContent = "[data-a11y-hide], [data-a11y-hide] * { color: transparent !important; -webkit-text-fill-color: transparent !important; text-shadow: none !important; fill: transparent !important; caret-color: transparent !important; text-decoration-color: transparent !important; } [data-a11y-hide] svg, [data-a11y-hide] img { visibility: hidden !important; }";
        document.head.append(st);
      }
      el.setAttribute("data-a11y-hide", "");
      return { box: { x: Math.max(0, r.left), y: Math.max(0, r.top), width: Math.min(r.right, innerWidth) - Math.max(0, r.left), height: Math.min(r.bottom, innerHeight) - Math.max(0, r.top) }, rgb, a, large: size >= 24 || (bold && size >= 18.66), text: (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 30) };
    }, target).catch(() => null);
    if (!info || info.box.width < 2 || info.box.height < 2) { await page.evaluate((sel) => document.querySelector(sel)?.removeAttribute("data-a11y-hide"), target).catch(() => {}); continue; }
    await page.waitForTimeout(30);
    const png = await page.screenshot({ clip: info.box, animations: "disabled" }).catch(() => null);
    await page.evaluate((sel) => document.querySelector(sel)?.removeAttribute("data-a11y-hide"), target).catch(() => {});
    if (!png) continue;
    const { data, info: meta } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const lum = (r, g, b) => [r, g, b].map((c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }).reduce((s, c, i) => s + c * [0.2126, 0.7152, 0.0722][i], 0);
    const px = [];
    for (let i = 0; i < meta.width * meta.height; i++) px.push([data[i * 3], data[i * 3 + 1], data[i * 3 + 2]]);
    px.sort((p, q) => lum(...p) - lum(...q));
    const pick = (q) => px[Math.min(px.length - 1, Math.floor(q * (px.length - 1)))];
    let ratio = Infinity;
    // The 10th and 90th percentile of the pixels behind: a hairline grid line crossing the
    // text box is ignored, a real background is not.
    for (const bg of [pick(0.1), pick(0.9)]) {
      const fg = info.rgb.map((c, i) => c * info.a + bg[i] * (1 - info.a));
      const [l1, l2] = [lum(...fg), lum(...bg)].sort((x, y) => y - x);
      ratio = Math.min(ratio, (l1 + 0.05) / (l2 + 0.05));
    }
    const need = info.large ? 3 : 4.5;
    // A reading taken mid-transition (a fade, a reveal) is taken again before it counts.
    if (ratio < need && (retried.get(target) ?? 0) < 2) { retried.set(target, (retried.get(target) ?? 0) + 1); nodes.push(n); continue; }
    if (ratio < need && process.env.A11Y_DEBUG) (await import("node:fs")).writeFileSync(`${process.env.A11Y_DEBUG}/${info.text.replace(/\W+/g, "_").slice(0, 20)}.png`, png);
    if (ratio < need) worst.push(`"${info.text}" ${ratio.toFixed(2)}:1 (need ${need}) at ${target}`);
  }
  if (worst.length) add(where, `${worst.length} text items under AA contrast over their real background, e.g. ${worst.slice(0, 3).join("; ")}`);
}

async function authErrors(browser, server) {
  const ctx = await localContext(browser, server.base, { viewport: { width: 1280, height: 860 } });
  const cases = [
    ["/login/", async (p) => { await p.getByLabel(/email/i).first().fill("not-an-email"); }],
    ["/signup/", async () => {}],
    ["/reset/", async (p) => { await p.getByLabel(/email/i).first().fill("not-an-email"); }],
  ];
  for (const [path, fill] of cases) {
    const where = `form errors ${path}`;
    const page = await ctx.newPage();
    await openPage(page, server.base + path);
    try {
      await fill(page);
      const field = page.getByLabel(/email/i).first();
      await field.focus();
      await page.keyboard.press("Enter");
      await page.waitForTimeout(600);
      const res = await page.evaluate(() => {
        const invalid = [...document.querySelectorAll("[aria-invalid=true]")];
        const tied = invalid.map((el) => `${el.getAttribute("aria-describedby") ?? ""} ${el.getAttribute("aria-errormessage") ?? ""}`.trim().split(/\s+/).map((id) => document.getElementById(id)).filter((e) => e && (e.textContent ?? "").trim()));
        const announced = invalid.length > 0 && tied.flat().some((e) => e.closest("[role=alert], [aria-live=polite], [aria-live=assertive], [role=status]"));
        return { invalid: invalid.length, tied: tied.filter((t) => t.length).length, announced, focusOnInvalid: invalid.includes(document.activeElement) };
      });
      if (!res.invalid) add(where, "bad input marks no field as invalid (aria-invalid)");
      else {
        if (res.tied < res.invalid) add(where, "an invalid field has no error message tied to it (aria-describedby)");
        if (!res.announced) add(where, "the error message is not announced (role=alert or a live region)");
      }
    } catch (e) {
      add(where, `could not run: ${e.message.split("\n")[0]}`);
    }
    await page.close();
  }
  await ctx.close();
}

// The UI library page (#/ui), where every component is live: each Tab stop shows a focus
// ring at least 2px wide and is on screen, and Tab reaches at least 40 controls (DEC-0061).
async function libraryRings(browser, server) {
  const where = "UI library /research/#/ui";
  const ctx = await localContext(browser, server.base, { viewport: { width: 1440, height: 900 } }, { tours: false });
  const page = await ctx.newPage();
  await openPage(page, `${server.base}/research/#/ui`);
  const seen = new Set();
  let stops = 0;
  for (let i = 0; i < 600; i++) {
    await page.keyboard.press("Tab");
    const f = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      // A library checkbox or radio hides its input and rings the box drawn next to it.
      const shown = el.matches("input[type=checkbox], input[type=radio]") && getComputedStyle(el).opacity === "0" ? el.nextElementSibling ?? el : el;
      const s = getComputedStyle(shown);
      const ring = s.outlineStyle !== "none" && parseFloat(s.outlineWidth) >= 2;
      const shadow = s.boxShadow !== "none" && /\b[2-9]px\b/.test(s.boxShadow);
      const r = shown.getBoundingClientRect();
      const path = [];
      for (let e = el; e && e !== document.body && path.length < 3; e = e.parentElement) path.unshift(e.tagName.toLowerCase() + (typeof e.className === "string" && e.className ? "." + e.className.trim().split(/\s+/)[0] : ""));
      const name = (el.getAttribute("aria-label") || el.textContent || el.getAttribute("title") || el.tagName).trim().slice(0, 40);
      return { key: path.join(">") + "|" + name + "|" + Math.round(r.top + window.scrollY), where: path.join(" > "), name, ring: ring || shadow, onScreen: r.bottom > 0 && r.top < window.innerHeight && r.width > 0 };
    });
    if (!f) continue;
    if (seen.has(f.key)) break;
    seen.add(f.key);
    stops++;
    if (!f.ring) add(where, `no visible 2px focus ring on "${f.name}" at ${f.where}`);
    if (!f.onScreen) add(where, `focused "${f.name}" is off screen at ${f.where}`);
  }
  if (stops < 40) add(where, `Tab reached only ${stops} controls`);
  await ctx.close();
}

// A first-run tour is a dialog: it takes focus, keeps Tab inside, is marked modal, and
// Escape ends it without leaving focus nowhere.
async function tourCheck(browser, server) {
  const ctx = await localContext(browser, server.base, { viewport: { width: 1280, height: 860 } });
  for (const path of ["/app/#/", "/sim/#/overview", "/trade/#/chart"]) {
    const where = `tour ${path}`;
    const page = await ctx.newPage();
    await openPage(page, server.base + path);
    const card = page.locator(".ui-tour[role=dialog]");
    if (!(await card.count())) { await page.close(); continue; }
    const s = await page.evaluate(() => { const c = document.querySelector(".ui-tour[role=dialog]"); return { modal: c?.getAttribute("aria-modal") === "true", focus: !!c?.contains(document.activeElement), named: !!(c?.getAttribute("aria-label") || c?.getAttribute("aria-labelledby")) }; });
    if (!s.modal) add(where, "the tour keeps focus like a modal but is not marked aria-modal");
    if (!s.focus) add(where, "the tour does not take focus");
    if (!s.named) add(where, "the tour has no accessible name");
    for (let k = 0; k < 8; k++) await page.keyboard.press("Tab");
    if (!(await page.evaluate(() => !!document.querySelector(".ui-tour[role=dialog]")?.contains(document.activeElement)))) add(where, "Tab leaves the tour");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
    const after = await page.evaluate(() => ({ open: !!document.querySelector(".ui-tour[role=dialog]"), body: document.activeElement === document.body || !document.activeElement }));
    if (after.open) add(where, "Escape does not end the tour");
    else if (after.body) add(where, "focus is lost (on the page body) after the tour ends");
    await page.close();
  }
  await ctx.close();
}

async function desktopShell(browser) {
  for (const d of DESKTOP_PAGES.filter((p) => !ONLY || p.name.includes(ONLY))) {
    const where = `desktop ${d.name}`;
    const ctx = await browser.newContext({ viewport: d.viewport, reducedMotion: "reduce", bypassCSP: true });
    await ctx.addInitScript(shellStub);
    const page = await ctx.newPage();
    await page.goto(d.url, { waitUntil: "load" });
    await page.waitForTimeout(300);
    await axNames(page, where);
    const dom = await page.evaluate(domChecks);
    for (const p of dom) if (!/main landmarks|h1 headings|first heading/.test(p) || d.name === "settings" || d.name.includes("page")) add(where, p);
    await tabWalk(page, where, { needSkip: false, needMain: false });
    if (d.name !== "title bar" && d.url.includes("ui-overlay")) {
      await page.evaluate(() => { window.__shellSent = []; });
      await page.keyboard.press("Escape");
      const sent = await page.evaluate(() => window.__shellSent.map((s) => s[0]));
      if (!sent.includes("close-overlay")) add(where, "Escape does not close the menu or palette");
    }
    await ctx.close();
  }
}

// ---------------------------------------------------------------- run

const publicDir = buildPublic();
const pages = allPages(publicDir).filter((p) => !ONLY || p.includes(ONLY));
const browser = await chromium.launch();
const server = await startServer("bypass", publicDir);
const base = { width: 1280, height: 860 };
const ctx = await localContext(browser, server.base, { viewport: base }, { tours: false });
await pool(pages, 4, async (path) => {
  const where = path;
  const page = await ctx.newPage();
  page.on("popup", (p) => p.close().catch(() => {}));
  try {
    await openPage(page, server.base + path);
    for (const p of await page.evaluate(domChecks)) add(where, p);
    await axNames(page, where);
    if (!SKIP.has("keyboard")) await tabWalk(page, where);
    if (!SKIP.has("keyboard") && KEY_PAGES.includes(path)) { await openPage(page, server.base + path); await dialogs(page, where); }
    if (!SKIP.has("contrast")) { await openPage(page, server.base + path); await realContrast(page, where); }
    if (!SKIP.has("reflow")) await reflow(page, where, base);
  } catch (e) {
    add(where, `could not check: ${e.message.split("\n")[0]}`);
  }
  await page.close().catch(() => {});
});
await ctx.close();
if (!SKIP.has("keyboard") && !ONLY) await tourCheck(browser, server);
if (!SKIP.has("keyboard") && (!ONLY || "/research/#/ui".includes(ONLY))) await libraryRings(browser, server);
if (!SKIP.has("motion")) await pool(pages, 4, (path) => motion(browser, server, path).catch((e) => add(`motion ${path}`, `could not check: ${e.message.split("\n")[0]}`)));
await server.close();

if (!SKIP.has("forms") && (!ONLY || "/login/ /signup/ /reset/".includes(ONLY))) {
  const signedOut = await startServer("signed-out", publicDir);
  await authErrors(browser, signedOut);
  await signedOut.close();
}
if (!SKIP.has("desktop")) await desktopShell(browser);
await browser.close();
rmSync(publicDir, { recursive: true, force: true });

const unique = [...new Set(problems)].sort();
console.log(`a11y checks: ${pages.length} pages, ${KEY_PAGES.length} with menus and dialogs, sign-in forms, ${DESKTOP_PAGES.length} desktop app pages`);
for (const p of unique) console.log(`  FAIL ${p}`);
console.log(unique.length ? `${unique.length} problems` : "no problems");
process.exit(unique.length ? 1 : 0);
