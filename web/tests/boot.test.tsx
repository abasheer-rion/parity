// The loading screen and the crash guard (DEC-0056): a Parity page shows something within
// the first paint, and a failure says so with Try again, never a black screen.
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { asyncFonts, BOOT_PAGES, bootScreen, bootWatch } from "../plugins/boot";
import { ErrorBoundary, isChunkError } from "../src/ui/boundary";

const PAGE = `<!doctype html><html><head>
<link href="https://fonts.googleapis.com/css2?family=Inter&display=swap" rel="stylesheet" />
</head><body>
<div id="root"></div>
<script type="module" src="/src/main.tsx"></script>
</body></html>`;

/** Puts the screen's markup on the page (without its inline script) and starts the watcher. */
function mount() {
  const out = bootScreen(PAGE);
  document.body.innerHTML = out.slice(out.indexOf("<body>") + 6, out.indexOf("</body>")).replace(/<script>[\s\S]*?<\/script>/, "");
  bootWatch();
}

describe("the loading screen in each app's page", () => {
  it("covers every app", () => {
    expect(BOOT_PAGES).toEqual(["/app/", "/research/", "/sim/", "/trade/", "/academy/", "/lab/"]);
  });

  it("is written before the app's root, with its style in the head and its watcher after", () => {
    const out = bootScreen(PAGE);
    expect(out.indexOf('id="pboot"')).toBeGreaterThan(-1);
    expect(out.indexOf('id="pboot"')).toBeLessThan(out.indexOf('id="root"'));
    expect(out.indexOf("pboot-css")).toBeLessThan(out.indexOf("</head>"));
    expect(out).toContain("(function bootWatch(");
    expect(bootScreen(out)).toBe(out); // once only
  });

  it("does not hold the first paint for the web fonts", () => {
    const out = asyncFonts(PAGE);
    expect(out).toContain('media="print" onload="this.media=\'all\'"');
    expect(out).toContain("<noscript>");
  });

  it("respects reduced motion", () => {
    expect(bootScreen(PAGE)).toContain("prefers-reduced-motion:reduce");
  });
});

describe("what the loading screen does", () => {
  let reload: ReturnType<typeof vi.fn>;
  const boot = () => document.getElementById("pboot")!;
  const root = () => document.getElementById("root")!;
  const real = window.location;

  beforeEach(() => {
    sessionStorage.clear();
    reload = vi.fn();
    Object.defineProperty(window, "location", { configurable: true, value: { href: real.href, host: real.host, reload } });
  });
  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(window, "location", { configurable: true, value: real });
    document.body.innerHTML = "";
  });

  it("shows at once, then fades out when the app draws", async () => {
    mount();
    expect(boot().hidden).toBe(false);
    root().innerHTML = "<div class='app'>Home</div>";
    await vi.waitFor(() => expect(boot().classList.contains("pboot-out")).toBe(true));
  });

  it("stays while the sign-in check says Loading", async () => {
    mount();
    root().innerHTML = "<div class='auth-splash'>Loading</div>";
    await new Promise((r) => setTimeout(r, 10));
    expect(boot().classList.contains("pboot-out")).toBe(false);
  });

  it("says so with Try again when the page goes empty after drawing", async () => {
    mount();
    root().innerHTML = "<div class='app'>Home</div>";
    await vi.waitFor(() => expect(boot().classList.contains("pboot-out")).toBe(true));
    root().innerHTML = "";
    await vi.waitFor(() => expect(boot().classList.contains("pboot-fail")).toBe(true));
    expect(boot().hidden).toBe(false);
    expect(boot().textContent).toContain("Something went wrong");
    fireEvent.click(boot().querySelector("button")!);
    expect(reload).toHaveBeenCalled();
  });

  it("says it is taking longer after 12 seconds, with Try again", () => {
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    mount();
    vi.advanceTimersByTime(12_100);
    expect(boot().classList.contains("pboot-slow")).toBe(true);
    expect(boot().textContent).toContain("taking longer than usual");
  });

  it("reloads once when one of its code files is gone, then explains", () => {
    mount();
    const s = document.createElement("script");
    s.src = `http://${real.host}/app/assets/main-abcdefgh.js`;
    document.body.appendChild(s);
    s.dispatchEvent(new Event("error"));
    expect(reload).toHaveBeenCalledTimes(1);
    s.dispatchEvent(new Event("error"));
    expect(reload).toHaveBeenCalledTimes(1);
    expect(boot().classList.contains("pboot-fail")).toBe(true);
    expect(boot().textContent).toContain("could not load a file");
  });

  it("ignores an outside script that fails (a blocker, a Cloudflare check)", () => {
    mount();
    const s = document.createElement("script");
    s.src = "https://static.example.com/x.js";
    document.body.appendChild(s);
    s.dispatchEvent(new Event("error"));
    expect(reload).not.toHaveBeenCalled();
    expect(boot().classList.contains("pboot-fail")).toBe(false);
  });
});

describe("the crash guard", () => {
  let fail = true;
  function Flaky() {
    if (fail) throw new Error("boom");
    return <p>Drawn</p>;
  }

  it("shows what happened with Try again instead of an empty page, and Try again draws it", () => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    fail = true;
    render(<ErrorBoundary scope="page"><Flaky /></ErrorBoundary>);
    expect(screen.getByRole("alert").textContent).toContain("stopped working");
    expect(screen.getByText("boom")).toBeTruthy();
    fail = false;
    act(() => { fireEvent.click(screen.getByText("Try again")); });
    expect(screen.getByText("Drawn")).toBeTruthy();
    quiet.mockRestore();
  });

  it("knows a missing code file from other errors", () => {
    expect(isChunkError(new TypeError("Failed to fetch dynamically imported module: https://x/a.js"))).toBe(true);
    expect(isChunkError(new Error("Importing a module script failed."))).toBe(true);
    expect(isChunkError(new Error("x is undefined"))).toBe(false);
  });
});
