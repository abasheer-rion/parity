// The app frame, laid out like Mercury's: a quiet left sidebar (workspace row, a
// segmented switch between areas, nav with nested children for the active item,
// bookmarks), a slim top bar (search, run picker, settings, profile) and the page.
import { useEffect, useState, type ReactNode } from "react";
import { Icon } from "../ui/icons";
import { setPrefs, toggleBookmark, usePrefs } from "../lib/prefs";

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
  { href: "#/scenarios", label: "Scenarios", icon: "compass", routes: ["scenarios"] },
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
  { href: "#/ui", label: "UI library", icon: "palette", routes: ["ui"] },
];

// Settings are kept bare on purpose: a section exists only when there is a reason to
// change something. The older sections (reading, shortcuts, runs, team, about) are kept
// in pages/SettingsHidden.tsx and can come back by adding them here.
export const SETTINGS_SECTIONS = [
  { group: "Settings", items: [
    { id: "account", label: "Account" },
    { id: "appearance", label: "Appearance" },
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
  full,
  children,
}: {
  route: string;
  arg?: string;
  hash: string;
  top?: ReactNode;
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
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => { setOpen(false); setMenu(false); }, [hash]);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 4);
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  const research = RESEARCH.some((n) => n.routes.includes(route));
  const items = research ? RESEARCH : MARKETS;
  const settings = route === "settings";

  return (
    <div className={`frame ${open ? "nav-open" : ""} ${full && prefs.rail ? "railed" : ""}`}>
      <aside className="side" data-lenis-prevent>
        <div className="org">
          <a className="org-button" href="#/">
            <span className="org-mark"><img src="/brand/2026-10-21-starburst/parity-mark.svg" alt="" width={24} height={24} /></span>
            <span className="org-name">Parity</span>
            <span className="org-badge">Beta</span>
          </a>
          {full && (
            <button className="rail-toggle" onClick={() => setPrefs({ rail: !prefs.rail })}
              aria-label={prefs.rail ? "Expand sidebar" : "Collapse sidebar"} title={prefs.rail ? "Expand sidebar" : "Collapse sidebar"}>
              <Icon name="sidebar" size={15} />
            </button>
          )}
        </div>
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
              <div className="seg" role="tablist" aria-label="Area">
                <a role="tab" aria-selected={!research} className={!research ? "on" : ""} href="#/"><Icon name="chart" size={13} />Markets</a>
                <a role="tab" aria-selected={research} className={research ? "on" : ""} href="#/docs"><Icon name="book" size={13} />Research</a>
              </div>
            </div>
            <div className="nav-wrap">
              <nav className="side-nav" aria-label="Main">
                {items.map((n) => {
                  const active = n.routes.includes(route);
                  return (
                    <div key={n.href}>
                      <a href={n.href} title={n.label} className={`side-item ${active ? "active" : ""}`} aria-expanded={n.children ? active : undefined}>
                        <span className="ico"><Icon name={n.icon} size={14} /></span>
                        <span className="lbl">{n.label}</span>
                      </a>
                      {n.children && (
                        <div className={`side-children ${active ? "open" : ""}`}>
                          <div>
                            {n.children.map((c) => {
                              const on = c.routes.length ? c.routes.includes(route) : hash === c.href || (c.href === "#/docs" && hash.startsWith("#/doc/"));
                              return <a key={c.href} href={c.href} className={on ? "on" : ""} tabIndex={active ? 0 : -1}>{c.label}</a>;
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
        <div className="account">
          <button className="account-row" onClick={() => setMenu((m) => !m)} aria-expanded={menu}>
            <span className="avatar" aria-hidden>{initials(email)}</span>
            <span className="account-name">{email ? email.split("@")[0] : "You"}</span>
            <Icon name="dots" size={14} />
          </button>
          {menu && (
            <div className="menu up" role="menu">
              <div className="menu-head">{email ?? (import.meta.env.VITE_APP_AUTH === "on" ? "Signed in" : "Signed in through Cloudflare")}</div>
              <a role="menuitem" href="#/settings/account"><Icon name="user" size={13} /> Account</a>
              <a role="menuitem" href="#/settings/appearance"><Icon name="gear" size={13} /> Settings</a>
              {onSignOut && <button role="menuitem" onClick={onSignOut}><Icon name="external" size={13} /> Sign out</button>}
            </div>
          )}
        </div>
      </aside>
      <div className="scrim" onClick={() => setOpen(false)} />
      <div className="main-col">
        <header className={`topbar ${scrolled ? "scrolled" : ""}`}>
          <button className="icon-btn menu-btn" aria-label="Menu" onClick={() => setOpen(true)}><Icon name="menu" /></button>
          <button className="search-trigger" onClick={() => window.dispatchEvent(new Event("parity:search"))}>
            <Icon name="search" size={13} /> <span>Search for anything</span>
          </button>
          <div className="topbar-right">
            {top}
            <a className="icon-btn" href="#/settings/appearance" aria-label="Settings" title="Settings"><Icon name="gear" size={15} /></a>
          </div>
        </header>
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
