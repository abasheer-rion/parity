// The sidebar's sections, top to bottom (DEC-0041). One list: the sidebar, the Go menu and
// its shortcuts are all built from it.
//
//   id      stable name, used by the sidebar and the menu
//   label   the words under the icon
//   path    where it opens, inside the bundled site
//   icon    one of the icons drawn in sidebar.html
//   needs   a file that must be in the build for the section to show. This is how a new
//           app (Academy, Workbench) appears once its page is built, with no other change.
//   bottom  sits at the foot of the sidebar instead of in the list
//
// Number shortcuts (Cmd or Ctrl plus 1, 2, ...) go to the visible sections in order;
// Account is Cmd or Ctrl plus comma, the usual key for settings.
module.exports = [
  { id: "home", label: "Home", path: "/", icon: "home" },
  { id: "verify", label: "Verify", path: "/app/#/verify", icon: "check" },
  { id: "app", label: "Strategies", path: "/app/", icon: "grid" },
  { id: "research", label: "Research", path: "/research/", icon: "book" },
  { id: "sim", label: "Terminal", path: "/sim/", icon: "terminal" },
  { id: "trade", label: "Trade", path: "/trade/", icon: "chart" },
  { id: "academy", label: "Academy", path: "/academy/", icon: "cap", needs: "academy/index.html" },
  { id: "lab", label: "Workbench", path: "/lab/", icon: "flask", needs: "lab/index.html" },
  { id: "account", label: "Account", path: "/app/#/settings/account", icon: "user", bottom: true },
];
