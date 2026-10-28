// The public Verify page at /verify/ (DEC-0081): the address still confirms every email
// link, anyone can check a file without signing in and without sending it, the embeds and
// the small card, and the read-only connections scaffold that stays off.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

if (!window.matchMedia) {
  Object.defineProperty(window, "matchMedia", { value: (q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false }) });
}

// Nobody is signed in. The real Supabase client is never loaded.
vi.mock("../../src/auth/session", () => ({ useSession: () => ({ loading: false, session: null }) }));
vi.mock("../../src/auth/client", () => ({ supabase: {} }));

import { onRequestGet as serveCard } from "../../functions/badge/[id]/card";
import { badgeAlt, badgeCardHtml, cardSnippet, embedSnippet, markdownSnippet, type PublicBadge } from "../../src/lib/verify/badge";
import { checkFile } from "../../src/lib/verify/checks";
import { connect, connectionsEnabled, NotAvailable, PROVIDERS, trustLevel } from "../../src/lib/verify/connect";
import { parseText } from "../../src/lib/verify/parse";
import { SIGNED_OUT_PRICES } from "../../src/pages/verify/Checker";
import { AUTH_KEYS, isAuthLink } from "../../src/verify/dispatch";
import { PublicVerify } from "../../src/verify/PublicVerify";

// Unmount after each test, and let late timers (tooltips, toasts) run while the page still
// exists, so nothing updates React after the test environment is gone.
afterEach(() => cleanup());
afterAll(() => new Promise((r) => setTimeout(r, 500)));

const fx = (name: string) => readFileSync(join(import.meta.dirname, "../fixtures/verify", name), "utf8");

describe("/verify/ dispatch: email links keep working", () => {
  it("sends every Supabase email link to the confirm screen", () => {
    expect(isAuthLink("?type=email&token_hash=abc&next=%2Fapp%2F", "")).toBe(true);
    expect(isAuthLink("?type=recovery&token_hash=abc", "")).toBe(true);
    expect(isAuthLink("?type=email", "")).toBe(true); // an incomplete link still says so
    expect(isAuthLink("?code=abc", "")).toBe(true);
    expect(isAuthLink("?error=access_denied&error_description=Email+link+is+invalid", "")).toBe(true);
    expect(isAuthLink("", "#access_token=x&type=signup")).toBe(true);
    expect(isAuthLink("", "#error=unauthorized_client&error_description=expired")).toBe(true);
    for (const k of AUTH_KEYS) expect(isAuthLink(`?${k}=1`, ""), k).toBe(true);
  });

  it("shows the checker for anything else", () => {
    expect(isAuthLink("", "")).toBe(false);
    expect(isAuthLink("?utm_source=x", "")).toBe(false);
    expect(isAuthLink("", "#/?mode=describe&example=1")).toBe(false);
    expect(isAuthLink("", "#supported")).toBe(false);
  });
});

describe("the public page, signed out", () => {
  it("checks an upload with no sign-in and no request, and says what signing in adds", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => { throw new Error(`unexpected request: ${String(input)}`); });
    const { container } = render(<PublicVerify />);
    expect(screen.getByRole("heading", { level: 1, name: "Verify a trading record" })).toBeInTheDocument();
    // Our strategies are behind sign-in, so that way in is not offered.
    expect(screen.queryByRole("radio", { name: /Pick a strategy/ })).toBeNull();
    const text = fx("generic.csv");
    const f = new File([text], "trades.csv", { type: "text/csv" });
    if (!("arrayBuffer" in f)) Object.assign(f, { arrayBuffer: async () => new TextEncoder().encode(text).buffer });
    fireEvent.change(container.querySelector('.vp-tool input[type="file"]')!, { target: { files: [f] } });
    await screen.findByText(/Trade list, 6 closed trades/);
    fireEvent.click(screen.getByRole("button", { name: "Check this record" }));
    await screen.findByText("Not enough data");
    expect(fetchSpy).not.toHaveBeenCalled();
    // Card 4 says the fill checks did not run while signed out.
    expect(screen.getAllByText(SIGNED_OUT_PRICES).length).toBeGreaterThan(0);
    const login = screen.getByRole("link", { name: "Log in to publish" });
    expect(login.getAttribute("href")).toBe("/login/?next=%2Fverify%2F");
    fetchSpy.mockRestore();
  });

  it("lists the supported files, marks unverified layouts, and says connections are coming later", () => {
    const { container } = render(<PublicVerify />);
    const cards = container.querySelectorAll("#supported .vp-card");
    expect(cards.length).toBeGreaterThanOrEqual(19);
    expect(container.querySelector("#supported")!.textContent).toContain("Unverified layout");
    expect(container.querySelector("#vp-connect-h")?.textContent).toBe("Read-only connections: coming later");
    expect(container.textContent).not.toMatch(/verified by (your )?broker/i);
    expect(container.textContent).not.toContain("\u2014");
    expect(container.querySelector('a[href="/methodology/"]')).not.toBeNull();
  });
});

describe("card 4 without daily prices", () => {
  it("says the fills were not checked because nobody is signed in", () => {
    const r = checkFile({ parsed: parseText(fx("generic.csv")), answers: { kind: "backtest", balance: 10000, tries: 1, claim: {} }, prices: null, pricesMissing: SIGNED_OUT_PRICES });
    const fills = r.card4.find((c) => c.id === "fills")!;
    expect(fills.status).toBe("na");
    expect(fills.detail).toBe(SIGNED_OUT_PRICES);
  });
});

const live = (over: Partial<PublicBadge> = {}): PublicBadge => ({
  id: "Ab3dEf6hIj9k", created_at: "2026-10-24T10:00:00Z", withdrawn_at: null, name: "My bot", input_kind: "backtest", stated_tries: 3,
  date_from: "2024-01-01", date_to: "2026-01-01", trade_count: 212, verdict: "could_be_luck", survives_tries: 4, cards: null, method_version: "verify-1.0", file_sha256: "a".repeat(64), ...over,
});

describe("embeds", () => {
  const origin = "https://paritytrading.app";
  it("HTML and Markdown carry alt text with the verdict", () => {
    const alt = badgeAlt(live());
    expect(alt).toBe("Parity Verify: Could be luck. Survives up to 4 tries. Self-reported record.");
    expect(embedSnippet("Ab3dEf6hIj9k", origin, alt)).toBe(`<a href="${origin}/v/Ab3dEf6hIj9k"><img src="${origin}/badge/Ab3dEf6hIj9k.svg" width="320" height="80" alt="${alt}"></a>`);
    expect(markdownSnippet("Ab3dEf6hIj9k", origin, alt)).toBe(`[![${alt}](${origin}/badge/Ab3dEf6hIj9k.svg)](${origin}/v/Ab3dEf6hIj9k)`);
    expect(cardSnippet("Ab3dEf6hIj9k", origin)).toContain(`src="${origin}/badge/Ab3dEf6hIj9k/card"`);
    expect(badgeAlt(live({ withdrawn_at: "2026-10-25T00:00:00Z" }))).toBe("Parity Verify badge: see what was checked");
  });

  it("the card shows the verdict and the trust line, never an owner, and has no script", () => {
    const html = badgeCardHtml(live(), "Ab3dEf6hIj9k", origin);
    expect(html).toContain("Could be luck");
    expect(html).toContain("Survives up to 4 tries.");
    expect(html).toContain("212 trades, Self-reported backtest.");
    expect(html).toContain("Self-reported: Parity checked the numbers in the file");
    expect(html).not.toMatch(/<script|owner|user_id/i);
    const gone = badgeCardHtml(live({ withdrawn_at: "2026-10-25T00:00:00Z" }), "Ab3dEf6hIj9k", origin);
    expect(gone).toContain("Withdrawn by its owner");
    expect(gone).not.toContain("Could be luck");
  });

  it("the card function answers GET with a cached page any site may frame", async () => {
    const f = vi.fn(async () => new Response(JSON.stringify([live()]), { status: 200 })) as unknown as typeof fetch;
    const res = await serveCard({ request: new Request("https://paritytrading.app/badge/Ab3dEf6hIj9k/card"), params: { id: "Ab3dEf6hIj9k" } }, f);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/html; charset=utf-8");
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=300");
    expect(res.headers.get("Content-Security-Policy")).toContain("frame-ancestors *");
    expect(res.headers.get("Content-Security-Policy")).toContain("default-src 'none'");
    expect(await res.text()).toContain('href="https://paritytrading.app/v/Ab3dEf6hIj9k"');
    const bad = await serveCard({ request: new Request("https://paritytrading.app/badge/x/card"), params: { id: "<x>" } }, f);
    expect(bad.status).toBe(404);
    expect(await bad.text()).not.toContain("<x>");
  });
});

describe("read-only connections: a scaffold, switched off", () => {
  it("is off unless the build turns it on, and never connects", async () => {
    expect(connectionsEnabled({})).toBe(false);
    expect(connectionsEnabled({ VITE_VERIFY_CONNECTIONS: "on" })).toBe(true);
    await expect(connect("alpaca", {})).rejects.toBeInstanceOf(NotAvailable);
    await expect(connect("kraken", { VITE_VERIFY_CONNECTIONS: "on" })).rejects.toThrow("not built yet");
    expect(PROVIDERS.map((p) => p.id)).toEqual(["alpaca", "binance", "coinbase", "kraken", "ibkr"]);
    expect(trustLevel("upload")).toBe("Self-reported");
  });
});
