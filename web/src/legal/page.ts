// Script for the plain HTML legal pages: the cookie notice, and marking the current page
// in the footer. The pages read and work without it.
import "./notice";

const here = window.location.pathname.replace(/\/?$/, "/");
document.querySelectorAll<HTMLAnchorElement>(".lg-legal a").forEach((a) => {
  if (a.getAttribute("href") === here) a.setAttribute("aria-current", "page");
});

// The AI app guides: a Copy button next to each address or command. It says "Copied" in its
// own label, which screen readers announce through the live region beside it (WCAG 4.1.3).
document.querySelectorAll<HTMLButtonElement>("[data-copy]").forEach((btn) => {
  btn.hidden = false;
  btn.addEventListener("click", () => {
    const text = document.getElementById(btn.dataset.copy ?? "")?.textContent?.trim() ?? "";
    const status = btn.parentElement?.querySelector<HTMLElement>("[role=status]");
    void navigator.clipboard?.writeText(text).then(() => {
      btn.textContent = "Copied";
      if (status) status.textContent = "Copied";
      setTimeout(() => { btn.textContent = "Copy"; if (status) status.textContent = ""; }, 1500);
    });
  });
});
