// Links to the legal pages, for the React pages (sign-in pages, app menu, Settings).
// The plain HTML pages carry the same list in their footers.
import "./legal-links.css";

export const LEGAL_PAGES = [
  { href: "/legal/privacy/", label: "Privacy" },
  { href: "/legal/terms/", label: "Terms" },
  { href: "/legal/cookies/", label: "Cookies" },
  { href: "/legal/accessibility/", label: "Accessibility" },
  { href: "/legal/risk/", label: "Risk" },
  { href: "/legal/regulatory/", label: "Regulatory" },
] as const;

export function LegalLinks({ className = "", cookieSettings = true }: { className?: string; cookieSettings?: boolean }) {
  return (
    <nav className={`legal-links ${className}`} aria-label="Legal">
      {LEGAL_PAGES.map((p) => <a key={p.href} href={p.href}>{p.label}</a>)}
      {cookieSettings && <button type="button" data-cookie-prefs>Cookie settings</button>}
    </nav>
  );
}

/** Changelog, announcements and status, with their RSS feeds (DEC-0073). Built by scripts/updates/build.py. */
export const UPDATE_PAGES = [
  { href: "/changelog/", label: "Changelog" },
  { href: "/announcements/", label: "Announcements" },
  { href: "/status/", label: "Status" },
] as const;

export function UpdatesLinks({ className = "" }: { className?: string }) {
  return (
    <nav className={`legal-links ${className}`} aria-label="Updates">
      {UPDATE_PAGES.map((p) => <a key={p.href} href={p.href}>{p.label}</a>)}
      {UPDATE_PAGES.map((p) => <a key={`${p.href}feed`} href={`${p.href}feed.xml`}>{p.label} RSS</a>)}
    </nav>
  );
}
