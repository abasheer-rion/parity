import { describe, expect, it } from "vitest";
import { emailLanding, safeNext, withNext } from "../src/auth/redirect";

const parity = { origin: "https://parity.endyland.com", hostname: "parity.endyland.com" };
const sim = { origin: "https://sim.endyland.com", hostname: "sim.endyland.com" };
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
    ["https://parity.endyland.com/research/", "/research/"],
    // Other endyland.com hosts keep their full address.
    ["https://sim.endyland.com/sim/", "https://sim.endyland.com/sim/"],
    ["https://sim.endyland.com/", "https://sim.endyland.com/"],
    ["https://endyland.com/x", "https://endyland.com/x"],
  ])("%s on parity -> %s", (raw, want) => {
    expect(safeNext(raw, parity)).toBe(want);
  });

  it("sends / on the main site to the app, but keeps / on the sim host", () => {
    expect(safeNext("/", parity)).toBe("/app/");
    expect(safeNext("https://parity.endyland.com", parity)).toBe("/app/");
    expect(safeNext("/", sim)).toBe("/");
    expect(safeNext("https://sim.endyland.com/", parity)).toBe("https://sim.endyland.com/");
  });

  it("keeps / on the trade host too", () => {
    const trade = { origin: "https://trade.endyland.com", hostname: "trade.endyland.com" };
    expect(safeNext("/", trade)).toBe("/");
    expect(safeNext("https://trade.endyland.com/", parity)).toBe("https://trade.endyland.com/");
    expect(safeNext("/trade/#/portfolio", parity)).toBe("/trade/#/portfolio");
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
    "http://sim.endyland.com/",
    "https://sim.endyland.com:8443/",
    "https://endyland.com.evil.com/",
    "https://evilendyland.com/",
    "https://sim.endyland.com@evil.com/",
    "https://user:pass@sim.endyland.com/",
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
    "https://sim.endyland.com/login/",
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
    expect(emailLanding("/research/#/docs?q=1", parity)).toBe("https://parity.endyland.com/research/");
    expect(emailLanding("/app/", parity)).toBe("https://parity.endyland.com/app/");
    expect(emailLanding("/", sim)).toBe("https://sim.endyland.com/");
    expect(emailLanding("https://sim.endyland.com/sim/?x=1", parity)).toBe("https://sim.endyland.com/sim/");
  });
  it("never points off site", () => {
    expect(emailLanding("https://evil.com/", parity)).toBe("https://parity.endyland.com/app/");
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
    expect(emailLanding("/trade/", app)).toBe("https://parity.endyland.com/trade/");
  });
});
