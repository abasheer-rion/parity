// "Skip to content" for keyboard and screen reader users. The apps route with the URL
// hash, so a plain href="#main" would change the page; this moves focus instead.
import "./skip-link.css";
export function SkipLink({ target = "main" }: { target?: string }) {
  return (
    <a
      className="skip-link"
      href={`#${target}`}
      onClick={(e) => {
        e.preventDefault();
        const el = document.getElementById(target);
        if (!el) return;
        if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
        el.focus();
        el.scrollIntoView({ block: "start" });
      }}
    >
      Skip to content
    </a>
  );
}
