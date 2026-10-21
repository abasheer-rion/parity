// The app frame, laid out like Mercury's: a quiet left sidebar (workspace row, a
// segmented switch between areas, nav with nested children for the active item,
// bookmarks), a slim top bar (search, run picker, settings, profile) and the page.
import { useEffect, useState, type ReactNode } from "react";
import { Icon } from "./icons";
import { toggleBookmark, usePrefs } from "../lib/prefs";

interface NavItem { href: string; label: string; icon: string; routes: string[]; children?: { href: string; label: string; routes: string[] }[] }

const MARKETS: NavItem[] = [
  { href: "#/", label: "Home", icon: "home", routes: ["", "home"] },
  {
    href: "#/strategies", label: "Strategies", icon: "chart", routes: ["strategies", "strategy", "compare", "lab", "explore", "signals"],
    children: [
      { href: "#/strategies", label: "All strategies", routes: ["strategies", "strategy"] },
      { href: "#/compare", label: "Compare", routes: ["compare"] },
      { href: "#/lab", label: "Lab", routes: ["lab"] },
      { href: "#/explore", label: "Explore", routes: ["explore"] },
      { href: "#/signals", label: "Signals", routes: ["signals"] },
    ],
  },
  { href: "#/catalog", label: "Catalog", icon: "catalog", routes: ["catalog", "algo"] },
  { href: "#/ledger", label: "Ledger", icon: "ledger", routes: ["ledger"] },
  {
    href: "#/data", label: "Data", icon: "database", routes: ["data", "sources"],
    children: [
      { href: "#/data", label: "Health", routes: ["data"] },
      { href: "#/sources", label: "Sources", routes: ["sources"] },
    ],
  },
];

const RESEARCH: NavItem[] = [
  {
    href: "#/docs", label: "Docs", icon: "book", routes: ["docs", "doc"],
    children: [
      { href: "#/docs", label: "All docs", routes: [] },
      { href: "#/docs/type/decision", label: "Decisions", routes: [] },
      { href: "#/docs/type/hypothesis", label: "Hypotheses", routes: [] },
      { href: "#/docs/type/experiment", label: "Experiments", routes: [] },
      { href: "#/docs/type/research", label: "Research", routes: [] },
      { href: "#/docs/type/log", label: "Logs", routes: [] },
    ],
  },
  { href: "#/learn", label: "Glossary", icon: "cap", routes: ["learn"] },
  { href: "#/refs", label: "Bibliography", icon: "quote", routes: ["refs"] },
];

export const SETTINGS_SECTIONS = [
  { group: "Personal", items: [
    { id: "profile", label: "Profile" },
    { id: "appearance", label: "Appearance" },
    { id: "reading", label: "Reading" },
    { id: "shortcuts", label: "Keyboard shortcuts" },
  ] },
  { group: "Research", items: [
    { id: "runs", label: "Data runs" },
    { id: "team", label: "Team" },
    { id: "about", label: "About" },
  ] },
];

export function Shell({
  route,
  arg,
  hash,
  top,
  email,
  onSignOut,
  wide,
  children,
}: {
  route: string;
  arg?: string;
  hash: string;
  top?: ReactNode;
  email?: string | null;
  onSignOut?: () => void;
  wide?: boolean;
  children: ReactNode;
}) {
  const prefs = usePrefs();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  useEffect(() => { setOpen(false); setMenu(false); }, [hash]);
  const research = RESEARCH.some((n) => n.routes.includes(route));
  const items = research ? RESEARCH : MARKETS;
  const settings = route === "settings";

  return (
    <div className={`frame ${open ? "nav-open" : ""}`}>
      <aside className="side">
        <div className="org">
          <span className="org-mark" aria-hidden />
          <span className="org-name">Parity</span>
          <span className="org-badge">POC</span>
        </div>
        {settings ? (
          <nav className="side-nav" aria-label="Settings">
            <a className="side-back" href="#/"><Icon name="chevronLeft" /> Settings</a>
            {SETTINGS_SECTIONS.map((g) => (
              <div key={g.group} className="side-group">
                <div className="side-label">{g.group}</div>
                {g.items.map((i) => (
                  <a key={i.id} href={`#/settings/${i.id}`} className={`side-item flat ${(arg ?? "profile") === i.id ? "active" : ""}`}>{i.label}</a>
                ))}
              </div>
            ))}
          </nav>
        ) : (
          <>
            <div className="seg" role="tablist" aria-label="Area">
              <a role="tab" aria-selected={!research} className={!research ? "on" : ""} href="#/"><Icon name="chart" size={13} /> Markets</a>
              <a role="tab" aria-selected={research} className={research ? "on" : ""} href="#/docs"><Icon name="book" size={13} /> Research</a>
            </div>
            <nav className="side-nav" aria-label="Main">
              {items.map((n) => {
                const active = n.routes.includes(route);
                return (
                  <div key={n.href}>
                    <a href={n.href} className={`side-item ${active ? "active" : ""}`}>
                      <Icon name={n.icon} /> {n.label}
                    </a>
                    {active && n.children && (
                      <div className="side-children">
                        {n.children.map((c) => {
                          const on = c.routes.length ? c.routes.includes(route) : hash === c.href || (c.href === "#/docs" && hash.startsWith("#/doc"));
                          return <a key={c.href} href={c.href} className={on ? "on" : ""}>{c.label}</a>;
                        })}
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
              {prefs.bookmarks.map((b) => (
                <a key={b.href} href={b.href} className={`side-item bm ${hash === b.href ? "active" : ""}`}>
                  <Icon name="bookmark" size={14} /> <span>{b.label}</span>
                </a>
              ))}
            </div>
          </>
        )}
      </aside>
      <div className="scrim" onClick={() => setOpen(false)} />
      <div className="main-col">
        <header className="topbar">
          <button className="icon-btn menu-btn" aria-label="Menu" onClick={() => setOpen(true)}><Icon name="menu" /></button>
          <button className="search-trigger" onClick={() => window.dispatchEvent(new Event("parity:search"))}>
            <Icon name="search" /> <span>Search for anything</span> <kbd>/</kbd>
          </button>
          <div className="topbar-right">
            {top}
            <a className="icon-btn" href="#/settings/appearance" aria-label="Settings" title="Settings"><Icon name="gear" /></a>
            <div className="avatar-wrap">
              <button className="avatar" aria-label="Profile" onClick={() => setMenu((m) => !m)}>{(email ?? "P")[0].toUpperCase()}</button>
              {menu && (
                <div className="menu" role="menu">
                  <div className="menu-head">{email ?? "Local session"}</div>
                  <a role="menuitem" href="#/settings/profile"><Icon name="user" /> Profile</a>
                  <a role="menuitem" href="#/settings/appearance"><Icon name="gear" /> Settings</a>
                  {onSignOut && <button role="menuitem" onClick={onSignOut}><Icon name="external" /> Sign out</button>}
                </div>
              )}
            </div>
          </div>
        </header>
        <main className={wide ? "wide" : ""}>{children}</main>
      </div>
    </div>
  );
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
