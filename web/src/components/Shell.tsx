// The app frame, laid out like Mercury's: a quiet left sidebar (workspace row, search,
// a segmented switch between areas, nav with nested children for the active item,
// bookmarks, the run picker and the account menu) and the page. There is no top bar:
// on phones a small floating button opens the sidebar (DEC-0020).
import { useEffect, useState, type ReactNode } from "react";
import { Icon } from "../ui/icons";
import { pageByHref } from "../lib/pages";
import { simUrl, SPACE, SPACE_ROOT } from "../lib/space";
import { setPrefs, toggleBookmark, usePrefs } from "../lib/prefs";

interface NavItem { href: string; label: string; icon: string; routes: string[]; children?: { href: string; label: string; routes: string[] }[]; external?: boolean }

// Plain names: say what the page does, not what we call it internally. Each item's
// hover text comes from lib/pages.ts, the same words search and Start here use.
// Product and research are separate apps with separate navigation (DEC-0015).
const START: NavItem = { href: "#/start", label: "Start here", icon: "sparkle", routes: ["start"] };
const HOW: NavItem = { href: "#/how", label: "How Parity works", icon: "info", routes: ["how"] };
const GLOSSARY: NavItem = { href: "#/learn", label: "Glossary", icon: "cap", routes: ["learn"] };

const PRODUCT: NavItem[] = [
  { href: "#/", label: "Home", icon: "home", routes: ["", "home"] },
  {
    href: "#/strategies", label: "Discover", icon: "chart", routes: ["strategies", "strategy", "compare", "lab"],
    children: [
      { href: "#/strategies", label: "All strategies", routes: ["strategies", "strategy"] },
      { href: "#/compare", label: "Compare", routes: ["compare"] },
      { href: "#/lab", label: "Try settings", routes: ["lab"] },
    ],
  },
  { href: "#/watchlist", label: "Watchlist", icon: "bookmark", routes: ["watchlist"] },
  { href: "#/scenarios", label: "What if", icon: "pulse", routes: ["scenarios"] },
  {
    href: "#/markets", label: "Markets", icon: "pulse", routes: ["markets"],
    children: [
      { href: "#/markets", label: "Overview", routes: [] },
      { href: "#/markets/new", label: "New and trending", routes: [] },
      { href: "#/markets/crypto", label: "Crypto", routes: [] },
      { href: "#/markets/perps", label: "Perps", routes: [] },
      { href: "#/markets/etfs", label: "ETFs", routes: [] },
      { href: "#/markets/terms", label: "Hype terms", routes: [] },
      { href: "#/markets/practice", label: "Practice", routes: [] },
    ],
  },
  {
    href: "#/news", label: "News", icon: "news", routes: ["news"],
    children: [
      { href: "#/news", label: "Latest", routes: [] },
      { href: "#/news/history", label: "Biggest days", routes: [] },
    ],
  },
  GLOSSARY,
  START,
  HOW,
];

const RESEARCH: NavItem[] = [
  { href: "#/", label: "Research home", icon: "home", routes: ["", "home"] },
  {
    href: "#/docs", label: "Research docs", icon: "book", routes: ["docs", "doc", "refs"],
    children: [
      { href: "#/docs", label: "All docs", routes: [] },
      { href: "#/docs/type/decision", label: "Decisions", routes: [] },
      { href: "#/docs/type/hypothesis", label: "Hypotheses", routes: [] },
      { href: "#/docs/type/experiment", label: "Experiments", routes: [] },
      { href: "#/docs/type/research", label: "Reading notes", routes: [] },
      { href: "#/docs/type/log", label: "Logs", routes: [] },
      { href: "#/refs", label: "Bibliography", routes: ["refs"] },
    ],
  },
  { href: "#/ledger", label: "Official record", icon: "ledger", routes: ["ledger"] },
  { href: "#/search", label: "Strategy search", icon: "search", routes: ["search"] },
  {
    href: "#/catalog", label: "Algorithm library", icon: "catalog", routes: ["catalog", "algo", "signals", "explore"],
    children: [
      { href: "#/catalog", label: "All ideas", routes: ["catalog", "algo"] },
      { href: "#/signals", label: "Early signals", routes: ["signals"] },
      { href: "#/explore", label: "Raw prices", routes: ["explore"] },
    ],
  },
  // Sim World is its own full-screen site and opens in a new tab (DEC-0020).
  { href: simUrl(), label: "Sim World", icon: "compass", routes: ["sim"], external: true },
  {
    href: "#/data", label: "Data", icon: "database", routes: ["data", "sources"],
    children: [
      { href: "#/data", label: "Data health", routes: ["data"] },
      { href: "#/sources", label: "Sources", routes: ["sources"] },
    ],
  },
  GLOSSARY,
  START,
  HOW,
  { href: "#/ui", label: "UI library", icon: "palette", routes: ["ui"] },
];

// Settings are kept bare on purpose: a section exists only when there is a reason to
// change something. The older sections (reading, shortcuts, runs, team, about) are kept
// in pages/SettingsHidden.tsx and can come back by adding them here.
// Parity is dark only (DEC-0020), so there is no Appearance section any more.
export const SETTINGS_SECTIONS = [
  { group: "Settings", items: [
    { id: "account", label: "Account" },
  ] },
];

const MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
const SEARCH_KEY = MAC ? "\u2318K" : "Ctrl K";

export function Shell({
  route,
  arg,
  hash,
  run,
  email,
  onSignOut,
  wide,
  full,
  children,
}: {
  route: string;
  arg?: string;
  hash: string;
  /** The research run picker, shown in the sidebar footer on pages that read a run. */
  run?: ReactNode;
  email?: string | null;
  onSignOut?: () => void;
  wide?: boolean;
  /** Full-bleed page (Sim World): the sidebar can fold into a slim icon rail. */
  full?: boolean;
  children: ReactNode;
}) {
  const prefs = usePrefs();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  useEffect(() => { setOpen(false); setMenu(false); }, [hash]);
  // Escape closes the phone sidebar and the account menu.
  useEffect(() => {
    const on = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); setMenu(false); } };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, []);
  const openSearch = () => { setOpen(false); setMenu(false); window.dispatchEvent(new Event("parity:search")); };
  const research = SPACE === "research";
  const items = research ? RESEARCH : PRODUCT;
  const settings = route === "settings";

  return (
    <div className={`frame ${open ? "nav-open" : ""} ${full && prefs.rail ? "railed" : ""}`}>
      <aside className="side" id="side" data-lenis-prevent>
        <div className="org">
          <a className="org-button" href="#/">
            <span className="org-mark"><img src="/brand/2026-10-21-starburst/parity-mark.svg" alt="" width={24} height={24} /></span>
            <span className="org-name" aria-label="Parity">
              <img className="on-dark" src="/brand/2026-10-22-wordmark/parity-letters-on-dark.svg" alt="" height={13} />
              <img className="on-light" src="/brand/2026-10-22-wordmark/parity-letters-on-light.svg" alt="" height={13} />
            </span>
            <span className={`org-badge ${SPACE}`}>{SPACE === "research" ? "Research" : "Beta"}</span>
          </a>
          {full && (
            <button className="rail-toggle" onClick={() => setPrefs({ rail: !prefs.rail })}
              aria-label={prefs.rail ? "Expand sidebar" : "Collapse sidebar"} title={prefs.rail ? "Expand sidebar" : "Collapse sidebar"}>
              <Icon name="sidebar" size={15} />
            </button>
          )}
        </div>
        <button className="side-search" onClick={openSearch} aria-label="Search pages, strategies and words, or ask a question" aria-keyshortcuts="/ Meta+K">
          <Icon name="search" size={14} />
          <span className="lbl">Search or ask</span>
          <kbd aria-hidden>{SEARCH_KEY}</kbd>
        </button>
        {settings ? (
          <nav className="side-nav settings-nav" aria-label="Settings">
            <a className="side-back" href="#/"><span className="ico"><Icon name="chevronLeft" size={13} /></span> Settings</a>
            {SETTINGS_SECTIONS.map((g) => (
              <div key={g.group} className="side-group">
                <div className="side-label">{g.group}</div>
                {g.items.map((i) => (
                  <a key={i.id} href={`#/settings/${i.id}`} className={`side-item flat ${(arg ?? "account") === i.id ? "active" : ""}`}><span className="lbl">{i.label}</span></a>
                ))}
              </div>
            ))}
          </nav>
        ) : (
          <>
            <div className="switcher">
              <div className="seg" role="tablist" aria-label="Side of Parity">
                <a role="tab" aria-selected={!research} className={!research ? "on" : ""} href={research ? SPACE_ROOT.product : "#/"} title="The app: discover and follow strategies"><Icon name="chart" size={13} />Product</a>
                <a role="tab" aria-selected={research} className={research ? "on" : ""} href={research ? "#/" : SPACE_ROOT.research} title="Where results are made, kept apart from the product"><Icon name="book" size={13} />Research</a>
              </div>
            </div>
            <div className="nav-wrap">
              <nav className="side-nav" aria-label="Main">
                {items.map((n) => {
                  const active = n.routes.includes(route);
                  return (
                    <div key={n.href}>
                      <a href={n.href} title={n.external ? "Opens Sim World in a new tab" : pageByHref[n.href]?.what ?? n.label} className={`side-item ${active ? "active" : ""}`} aria-expanded={n.children ? active : undefined}
                        {...(n.external ? { target: "_blank", rel: "noopener" } : {})}>
                        <span className="ico"><Icon name={n.icon} size={14} /></span>
                        <span className="lbl">{n.label}</span>
                      </a>
                      {n.children && (
                        <div className={`side-children ${active ? "open" : ""}`}>
                          <div>
                            {n.children.map((c) => {
                              const on = c.routes.length ? c.routes.includes(route) : hash === c.href || (c.href === "#/docs" && hash.startsWith("#/doc/"));
                              return <a key={c.href} href={c.href} title={pageByHref[c.href]?.what} className={on ? "on" : ""} tabIndex={active ? 0 : -1}>{c.label}</a>;
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </nav>
              <div className="side-sep" />
              <div className="side-group">
                <div className="side-label">Bookmarks</div>
                {prefs.bookmarks.length === 0 && <p className="side-empty">Use the bookmark button next to a page title to pin it here.</p>}
                <div className="bm-list">
                  {prefs.bookmarks.map((b) => (
                    <a key={b.href} href={b.href} className={`side-item bm ${hash === b.href ? "active" : ""}`}>
                      <span className="ico"><Icon name="bookmark" size={12} /></span> <span className="lbl">{b.label}</span>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
        {run && !settings && <div className="side-run">{run}</div>}
        <div className="account">
          <button className="account-row" onClick={() => setMenu((m) => !m)} aria-expanded={menu}>
            <span className="avatar" aria-hidden>{initials(email)}</span>
            <span className="account-name">{email ? email.split("@")[0] : "You"}</span>
            <Icon name="dots" size={14} />
          </button>
          {menu && (
            <div className="menu up" role="menu">
              <div className="menu-head">{email ?? "Signed in"}</div>
              <a role="menuitem" href="#/settings/account"><Icon name="gear" size={13} /> Account and settings</a>
              <button role="menuitem" onClick={openSearch}><Icon name="search" size={13} /> Search <kbd className="menu-kbd" aria-hidden>{SEARCH_KEY}</kbd></button>
              {onSignOut && <button role="menuitem" onClick={onSignOut}><Icon name="external" size={13} /> Sign out</button>}
            </div>
          )}
        </div>
      </aside>
      <div className="scrim" onClick={() => setOpen(false)} />
      <div className="main-col">
        <button className="menu-fab" aria-label="Open menu" aria-controls="side" aria-expanded={open} onClick={() => setOpen(true)}><Icon name="menu" size={18} /></button>
        <main className={full ? "full" : wide ? "wide" : ""}>{children}</main>
      </div>
    </div>
  );
}

function initials(email?: string | null): string {
  if (!email) return "P";
  const name = email.split("@")[0].replace(/[^a-z]/gi, " ").trim().split(/\s+/);
  return ((name[0]?.[0] ?? "P") + (name[1]?.[0] ?? "")).toUpperCase();
}

/** Page title with Mercury's round bookmark button beside it. */
export function Title({ children, label, actions }: { children: ReactNode; label?: string; actions?: ReactNode }) {
  const prefs = usePrefs();
  const href = window.location.hash || "#/";
  const text = label ?? (typeof children === "string" ? children : href);
  const marked = prefs.bookmarks.some((b) => b.href === href);
  return (
    <div className="title-row">
      <h1>{children}</h1>
      <button className={`round-btn ${marked ? "on" : ""}`} onClick={() => toggleBookmark(href, text)}
        aria-label={marked ? "Remove from bookmarks" : "Add to bookmarks"} title={marked ? "Remove from bookmarks" : "Add to bookmarks"}>
        <Icon name="bookmark" size={13} />
      </button>
      {actions && <div className="title-actions">{actions}</div>}
    </div>
  );
}
