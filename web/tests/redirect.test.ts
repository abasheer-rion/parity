import { describe, expect, it } from "vitest";
import { emailLanding, safeNext, withNext } from "../src/auth/redirect";

const parity = { origin: "https://paritytrading.app", hostname: "paritytrading.app" };
const sim = { origin: "https://sim.paritytrading.app", hostname: "sim.paritytrading.app" };
const local = { origin: "http://127.0.0.1:5173", hostname: "127.0.0.1" };

describe("safeNext: allowed", () => {
  it.each([
    ["/app/", "/app/"],
    ["/app/#/strategy/fx-carry", "/app/#/strategy/fx-carry"],
    ["/research/", "/research/"],
    ["/research/#/docs?q=carry", "/research/#/docs?q=carry"],
    ["/sim/", "/sim/"],
    ["/sim/?scenario=gulf", "/sim/?scenario=gulf"],
    ["/data/latest.json", "/data/latest.json"],
    ["  /research/  ", "/research/"],
    // An absolute address on this same host comes back as a path.
    ["https://paritytrading.app/research/", "/research/"],
    // Other paritytrading.app hosts keep their full address.
    ["https://sim.paritytrading.app/sim/", "https://sim.paritytrading.app/sim/"],
    ["https://sim.paritytrading.app/", "https://sim.paritytrading.app/"],
    // The old domain still counts while its addresses redirect (DEC-0067).
    ["https://parity.endyland.com/x", "https://parity.endyland.com/x"],
    ["https://sim.endyland.com/sim/", "https://sim.endyland.com/sim/"],
  ])("%s on parity -> %s", (raw, want) => {
    expect(safeNext(raw, parity)).toBe(want);
  });

  it("sends / on the main site to the app, but keeps / on the sim host", () => {
    expect(safeNext("/", parity)).toBe("/app/");
    expect(safeNext("https://paritytrading.app", parity)).toBe("/app/");
    expect(safeNext("/", sim)).toBe("/");
    expect(safeNext("https://sim.paritytrading.app/", parity)).toBe("https://sim.paritytrading.app/");
  });

  it("keeps / on the trade host too", () => {
    const trade = { origin: "https://trade.paritytrading.app", hostname: "trade.paritytrading.app" };
    expect(safeNext("/", trade)).toBe("/");
    expect(safeNext("https://trade.paritytrading.app/", parity)).toBe("https://trade.paritytrading.app/");
    expect(safeNext("/trade/#/portfolio", parity)).toBe("/trade/#/portfolio");
  });

  it("keeps / on the academy host too", () => {
    const academy = { origin: "https://academy.paritytrading.app", hostname: "academy.paritytrading.app" };
    expect(safeNext("/", academy)).toBe("/");
    expect(safeNext("https://academy.paritytrading.app/#/luck-vs-skill", parity)).toBe("https://academy.paritytrading.app/#/luck-vs-skill");
    expect(safeNext("/academy/#/progress", parity)).toBe("/academy/#/progress");
  });

  it("keeps / on the lab host too", () => {
    const lab = { origin: "https://lab.paritytrading.app", hostname: "lab.paritytrading.app" };
    expect(safeNext("/", lab)).toBe("/");
    expect(safeNext("https://lab.paritytrading.app/#/search?q=carry", parity)).toBe("https://lab.paritytrading.app/#/search?q=carry");
    expect(safeNext("/lab/#/compare", parity)).toBe("/lab/#/compare");
  });

  it("allows the same origin in local development", () => {
    expect(safeNext("http://127.0.0.1:5173/research/", local)).toBe("/research/");
    expect(safeNext("/sim/", local)).toBe("/sim/");
  });
});

describe("safeNext: refused (falls back to /app/)", () => {
  it.each([
    null,
    undefined,
    "",
    "   ",
    "//evil.com",
    "//evil.com/app/",
    "/\\evil.com",
    "\\\\evil.com",
    "/\t/evil.com",
    "/\n/evil.com",
    "https://evil.com/",
    "https://evil.com/app/",
    "http://sim.paritytrading.app/",
    "https://sim.paritytrading.app:8443/",
    "https://paritytrading.app.evil.com/",
    "https://evilparitytrading.app/",
    "https://sim.paritytrading.app@evil.com/",
    "https://user:pass@sim.paritytrading.app/",
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    "data:text/html,hi",
    "app/",
    "evil.com",
    "/login/",
    "/login/?next=/app/",
    "/signup/",
    "/reset/",
    "/verify/?type=email",
    "https://sim.paritytrading.app/login/",
    "http://127.0.0.1:5173/app/",
  ])("%j", (raw) => {
    expect(safeNext(raw as string | null | undefined, parity)).toBe("/app/");
  });

  it("uses the fallback it is given", () => {
    expect(safeNext("https://evil.com", parity, "/research/")).toBe("/research/");
  });
});

describe("withNext", () => {
  it("leaves the default out", () => {
    expect(withNext("/login/", "/app/")).toBe("/login/");
    expect(withNext("/login/", "")).toBe("/login/");
  });
  it("encodes the next address", () => {
    expect(withNext("/login/", "/research/#/docs")).toBe("/login/?next=%2Fresearch%2F%23%2Fdocs");
    expect(withNext("/login/?mfa=1", "/sim/")).toBe("/login/?mfa=1&next=%2Fsim%2F");
  });
});

describe("emailLanding", () => {
  it("is an absolute address with no query or fragment", () => {
    expect(emailLanding("/research/#/docs?q=1", parity)).toBe("https://paritytrading.app/research/");
    expect(emailLanding("/app/", parity)).toBe("https://paritytrading.app/app/");
    expect(emailLanding("/", sim)).toBe("https://sim.paritytrading.app/");
    expect(emailLanding("https://sim.paritytrading.app/sim/?x=1", parity)).toBe("https://sim.paritytrading.app/sim/");
  });
  it("never points off site", () => {
    expect(emailLanding("https://evil.com/", parity)).toBe("https://paritytrading.app/app/");
  });
});

describe("desktop app pages at app://parity (DEC-0041)", () => {
  const app = { origin: "app://parity", hostname: "parity" };
  it("keeps same-app paths", () => {
    expect(safeNext("/trade/#/alerts", app)).toBe("/trade/#/alerts");
    expect(safeNext("/research/", app)).toBe("/research/");
  });
  it("still refuses other sites", () => {
    expect(safeNext("https://evil.example/", app)).toBe("/app/");
    expect(safeNext("app://evil/", app)).toBe("/app/");
  });
  it("points emails at the website", () => {
    expect(emailLanding("/trade/", app)).toBe("https://paritytrading.app/trade/");
  });
});
