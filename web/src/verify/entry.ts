// Entry for /verify/ (web/verify/index.html). An email link loads the sign-in confirm
// screen exactly as before; anything else loads the public Verify checker (DEC-0081).
import { TITLES } from "../auth/views";
import { isAuthLink } from "./dispatch";

if (isAuthLink(window.location.search, window.location.hash)) {
  document.title = TITLES.verify;
  void import("../auth/main");
} else {
  void import("./publicMain");
}
