// Script for the plain HTML legal pages: the cookie notice, and marking the current page
// in the footer. The pages read and work without it.
import "./notice";

const here = window.location.pathname.replace(/\/?$/, "/");
document.querySelectorAll<HTMLAnchorElement>(".lg-legal a").forEach((a) => {
  if (a.getAttribute("href") === here) a.setAttribute("aria-current", "page");
});
