// Links to the legal pages, for the React pages (sign-in pages, app menu, Settings).
// The plain HTML pages carry the same list in their footers.
import "./legal-links.css";

export const LEGAL_PAGES = [
  { href: "/legal/privacy/", label: "Privacy" },
  { href: "/legal/terms/", label: "Terms" },
  { href: "/legal/cookies/", label: "Cookies" },
  { href: "/legal/accessibility/", label: "Accessibility" },
  { href: "/legal/risk/", label: "Risk" },
] as const;

export function LegalLinks({ className = "", cookieSettings = true }: { className?: string; cookieSettings?: boolean }) {
  return (
    <nav className={`legal-links ${className}`} aria-label="Legal">
      {LEGAL_PAGES.map((p) => <a key={p.href} href={p.href}>{p.label}</a>)}
      {cookieSettings && <button type="button" data-cookie-prefs>Cookie settings</button>}
    </nav>
  );
}
