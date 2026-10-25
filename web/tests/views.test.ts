// The sign-in panel's addresses (DEC-0044): which form a path shows, what a query carries,
// and the stand-alone address each form switches to, keeping next.
import { describe, expect, it } from "vitest";
import { authUrl, carryFromQuery, viewFromPath } from "../src/auth/views";

describe("sign-in panel addresses", () => {
  it.each([["/login/", "login"], ["/login", "login"], ["/signup/", "signup"], ["/reset", "reset"], ["/verify/", "verify"], ["/other/", "login"]])("%s shows %s", (path, view) => {
    expect(viewFromPath(path)).toBe(view);
  });

  it("reads what a page's query hands over", () => {
    expect(carryFromQuery("?check=a%40b.co&mfa=1&from=invite")).toEqual({ check: "a@b.co", mfa: true, invite: true });
    expect(carryFromQuery("")).toEqual({ check: null, mfa: false, invite: false });
  });

  it("keeps next on every form's address", () => {
    expect(authUrl("login", "/sim/")).toBe("/login/?next=%2Fsim%2F");
    expect(authUrl("login", "/app/", { mfa: true })).toBe("/login/?mfa=1");
    expect(authUrl("signup", "/research/", { check: "a@b.co" })).toBe("/signup/?check=a%40b.co&next=%2Fresearch%2F");
    expect(authUrl("reset", "/app/#/x", { invite: true })).toBe("/reset/?from=invite&next=%2Fapp%2F%23%2Fx");
    expect(authUrl("verify", "/sim/")).toBe("/verify/");
  });
});
