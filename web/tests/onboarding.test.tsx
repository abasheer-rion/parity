// The getting started checklist, the tour component and read-only wallet proofs (DEC-0060).
// No network: the tour runs in jsdom, wallet signatures are made with throwaway keys.
import { ed25519 } from "@noble/curves/ed25519.js";
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { keccak_256 } from "@noble/hashes/sha3.js";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DOABLE, itemList, orderByInterests, progress } from "../src/onboarding/items";
import { Tour, availableSteps, type GuidedStep } from "../src/ui/guidedTour";
import { base58Decode, base58Encode, checkAddress, looksSecret, toChecksumAddress } from "../src/lib/wallet/address";
import { buildMessage, messageProblem, parseMessage, WINDOW_MS } from "../src/lib/wallet/siwe";
import { checkProof, recoverEthereumAddress, verifySolana } from "../src/lib/wallet/verify";

const LINKS = { connect: "/connect/", verify: "#/verify", trade: "/trade/#/chart", watch: "/trade/#/watchlists", academy: "/academy/", account: "#/settings/account" };
const items = itemList(LINKS);

describe("checklist completion", () => {
  it("lists eight items that can be done, plus brokerage", () => {
    expect(items.map((i) => i.id)).toEqual([...DOABLE, "broker"]);
    const p = progress(items, {}, {});
    expect(p.total).toBe(8);
    expect(p.done).toBe(0);
    expect(p.next?.id).toBe("email");
  });

  it("counts an item done from a saved time or from a live signal", () => {
    const p = progress(items, { verify: "2026-10-25T10:00:00Z" }, { trade: true, ai: false });
    expect(p.items.find((i) => i.id === "verify")).toMatchObject({ done: true, at: "2026-10-25T10:00:00Z" });
    expect(p.items.find((i) => i.id === "trade")).toMatchObject({ done: true, at: null });
    expect(p.items.find((i) => i.id === "ai")?.done).toBe(false);
    expect(p.done).toBe(2);
  });

  it("reports live signals without a saved time as newly done, and only those", () => {
    const p = progress(items, { trade: "2026-10-25T10:00:00Z" }, { trade: true, email: true, watch: true, lesson: false });
    expect(p.newly.sort()).toEqual(["email", "watch"]);
  });

  it("keeps a saved item done after its live signal goes away (a deleted watchlist)", () => {
    const p = progress(items, { watch: "2026-10-25T10:00:00Z" }, { watch: false });
    expect(p.items.find((i) => i.id === "watch")?.done).toBe(true);
  });

  it("never counts brokerage, even if something marks it", () => {
    const p = progress(items, { broker: "2026-10-25T10:00:00Z" } as never, { broker: true } as never);
    expect(p.items.find((i) => i.id === "broker")?.done).toBe(false);
    expect(p.total).toBe(8);
  });

  it("drops two-step sign-in when it is not available", () => {
    const p = progress(items, {}, {}, { mfaAvailable: false });
    expect(p.items.some((i) => i.id === "mfa")).toBe(false);
    expect(p.total).toBe(7);
  });

  it("is all done when every doable item is done", () => {
    const all = Object.fromEntries(DOABLE.map((id) => [id, true]));
    const p = progress(items, {}, all);
    expect(p.done).toBe(p.total);
    expect(p.next).toBeNull();
  });

  it("puts what the person picked in the welcome right after verifying the email", () => {
    expect(orderByInterests(items, ["learn", "trade", "research"]).map((i) => i.id)).toEqual(["email", "lesson", "trade", "ai", "verify", "watch", "mfa", "wallet", "broker"]);
    expect(orderByInterests(items, []).map((i) => i.id)).toEqual(items.map((i) => i.id));
  });

  it("asks for no bank, routing or card details anywhere in the copy", () => {
    const text = items.map((i) => `${i.title} ${i.body}`).join(" ");
    expect(text).toMatch(/never asks for bank or card details/);
    expect(text).toMatch(/never ask for your seed phrase or private key/);
    expect(text).not.toMatch(/[–—]/);
  });
});

// ---------------------------------------------------------------- the tour

// jsdom has no scrollIntoView; the library's tour card calls it.
Element.prototype.scrollIntoView ??= function scrollIntoView() {};

function box(el: HTMLElement, shown = true) {
  el.getBoundingClientRect = () => (shown ? { x: 10, y: 10, left: 10, top: 10, right: 110, bottom: 40, width: 100, height: 30, toJSON: () => ({}) } : { x: 0, y: 0, left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0, toJSON: () => ({}) }) as DOMRect;
  return el;
}

let fixture: HTMLElement | null = null;
afterEach(() => { cleanup(); fixture?.remove(); fixture = null; });

/** Four targets: a, c and d on screen, b hidden. */
function page() {
  fixture = document.createElement("div");
  for (const [id, shown] of [["a", true], ["b", false], ["c", true], ["d", true]] as const) {
    const el = document.createElement("div");
    el.id = id;
    fixture.append(box(el, shown));
  }
  document.body.append(fixture);
}

const STEPS: GuidedStep[] = [
  { id: "a", target: "#a", title: "First", body: "One" },
  { id: "b", target: "#b", title: "Hidden", body: "Two" },
  { id: "c", target: "#c", title: "Third", body: "Three" },
  { id: "x", target: "#missing", title: "Missing", body: "Four" },
  { id: "d", target: "#d", title: "Last", body: "Five" },
];

describe("tour", () => {
  it("skips steps whose target is missing or hidden", () => {
    page();
    expect(availableSteps(STEPS)).toEqual([0, 2, 4]);
  });

  it("counts only the steps it can show, moves with buttons and arrow keys, and ends with Done", async () => {
    page();
    const onEnd = vi.fn();
    render(<Tour open steps={STEPS} label="Test tour" onEnd={onEnd} />);
    // The tip shows once it has been positioned against its target.
    expect(await screen.findByRole("dialog")).toHaveAccessibleName("First");
    expect(screen.getByText("1 of 3")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Third")).toBeInTheDocument();
    expect(screen.getByText("2 of 3")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(screen.getByText("3 of 3")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(screen.getByText("2 of 3")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "ArrowRight" });
    fireEvent.click(await screen.findByRole("button", { name: "Done" }));
    expect(onEnd).toHaveBeenCalledWith("done", 4);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it("Escape skips the tour, and other keys do not reach the page", () => {
    page();
    const onEnd = vi.fn();
    const pageKeys = vi.fn();
    window.addEventListener("keydown", pageKeys);
    render(<Tour open steps={STEPS} label="Test tour" onEnd={onEnd} />);
    fireEvent.keyDown(window, { key: "k" });
    fireEvent.keyDown(window, { key: "Escape" });
    window.removeEventListener("keydown", pageKeys);
    expect(pageKeys).not.toHaveBeenCalled();
    expect(onEnd).toHaveBeenCalledWith("skip", 0);
  });

  it("Skip all tours ends with skip-all", async () => {
    page();
    const onEnd = vi.fn();
    render(<Tour open steps={STEPS} label="Test tour" onEnd={onEnd} />);
    fireEvent.click(await screen.findByRole("button", { name: "Skip all tours" }));
    expect(onEnd).toHaveBeenCalledWith("skip-all", 0);
  });

  it("keeps Tab inside the tip", async () => {
    page();
    render(<Tour open steps={STEPS} label="Test tour" onEnd={() => {}} />);
    const tip = await screen.findByRole("dialog");
    for (let i = 0; i < 6; i++) fireEvent.keyDown(window, { key: "Tab" });
    expect(tip.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
    expect(tip.contains(document.activeElement)).toBe(true);
  });

  it("ends as none, without marking anything, when no target is on the page", () => {
    const onEnd = vi.fn();
    render(<Tour open steps={STEPS} label="Test tour" onEnd={onEnd} />);
    expect(onEnd).toHaveBeenCalledWith("none", 0);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("moves on when the current target disappears (a narrower window)", async () => {
    page();
    vi.useFakeTimers();
    render(<Tour open steps={STEPS} label="Test tour" onEnd={() => {}} />);
    box(document.getElementById("a")!, false);
    await act(async () => { window.dispatchEvent(new Event("resize")); vi.advanceTimersByTime(200); });
    vi.useRealTimers();
    expect(screen.getByText("Third")).toBeInTheDocument();
    expect(screen.getByText("1 of 2")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------- wallets

describe("wallet addresses", () => {
  it("accepts a valid Ethereum address and folds it to lower case", () => {
    const r = checkAddress("ethereum", "0x52908400098527886E0F7030069857D2E4169EE7");
    expect(r).toEqual({ ok: true, address: "0x52908400098527886e0f7030069857d2e4169ee7" });
  });

  it("refuses an Ethereum address whose capitals do not match its checksum", () => {
    const r = checkAddress("ethereum", "0x52908400098527886E0F7030069857D2E4169Ee7");
    expect(r.ok).toBe(false);
  });

  it("makes EIP-55 checksums (the EIP's own examples)", () => {
    for (const a of ["0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed", "0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359", "0xdbF03B407c01E7cD3CBea99509d93f8DDDC8C6FB"]) {
      expect(toChecksumAddress(a.toLowerCase())).toBe(a);
    }
  });

  it("accepts a Solana address of 32 bytes and refuses other base58 text", () => {
    expect(checkAddress("solana", "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM").ok).toBe(true);
    expect(checkAddress("solana", "0OIl0OIl0OIl0OIl0OIl0OIl0OIl0OIl").ok).toBe(false);
    expect(checkAddress("solana", "1111111111111111111111111111111").ok).toBe(false);
  });

  it("round-trips base58", () => {
    const b = new Uint8Array([0, 0, 1, 2, 3, 250, 255]);
    expect(base58Decode(base58Encode(b))).toEqual(b);
  });

  it("refuses anything that looks like a seed phrase or private key, before it is saved", () => {
    const phrase = "abandon ability able about above absent absorb abstract absurd abuse access accident";
    expect(looksSecret(phrase)).toBe(true);
    expect(looksSecret(`0x${"ab".repeat(32)}`)).toBe(true);
    expect(looksSecret(base58Encode(new Uint8Array(64).fill(7)))).toBe(true);
    expect(looksSecret(`[${Array.from({ length: 64 }, (_, i) => i).join(",")}]`)).toBe(true);
    expect(looksSecret("0x52908400098527886E0F7030069857D2E4169EE7")).toBe(false);
    const r = checkAddress("ethereum", phrase);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.problem).toMatch(/seed phrase or private key/);
  });
});

describe("wallet proofs", () => {
  const userId = "11111111-1111-4111-8111-111111111111";
  const host = "parity.endyland.com";
  const origin = `https://${host}`;
  const now = new Date("2026-10-25T12:00:00Z");
  const enc = new TextEncoder();
  const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");

  function ethWallet() {
    const key = secp256k1.utils.randomSecretKey();
    const pub = secp256k1.getPublicKey(key, false).slice(1);
    const address = toChecksumAddress(`0x${hex(keccak_256(pub).slice(-20))}`);
    const sign = (message: string) => {
      const body = enc.encode(message);
      const digest = keccak_256(new Uint8Array([...enc.encode(`\x19Ethereum Signed Message:\n${body.length}`), ...body]));
      const sig = secp256k1.sign(digest, key, { prehash: false, format: "recovered" });
      // noble puts the recovery byte first; Ethereum puts it last, plus 27.
      return `0x${hex(sig.slice(1))}${(sig[0] + 27).toString(16)}`;
    };
    return { address, sign };
  }

  function solWallet() {
    const key = ed25519.utils.randomSecretKey();
    const address = base58Encode(ed25519.getPublicKey(key));
    const sign = (message: string) => btoa(String.fromCharCode(...ed25519.sign(enc.encode(message), key)));
    return { address, sign };
  }

  it("builds an EIP-4361 message that parses back", () => {
    const m = buildMessage({ chain: "ethereum", domain: host, origin, address: "0xabc", userId, nonce: "abcdefgh12", now });
    expect(m.split("\n")[0]).toBe(`${host} wants you to sign in with your Ethereum account:`);
    expect(m).toContain("Chain ID: 1");
    expect(m).toContain(`- parity:user:${userId}`);
    const f = parseMessage(m)!;
    expect(f).toMatchObject({ chain: "ethereum", domain: host, uri: origin, version: "1", nonce: "abcdefgh12", issuedAt: now.toISOString() });
  });

  it("accepts a real Ethereum signature and recovers the address", () => {
    const w = ethWallet();
    const message = buildMessage({ chain: "ethereum", domain: host, origin, address: w.address, userId, nonce: "abcdefgh12", now });
    const signature = w.sign(message);
    expect(recoverEthereumAddress(message, signature)).toBe(w.address.toLowerCase());
    const r = checkProof({ chain: "ethereum", address: w.address, message, signature }, { userId, host, origin, now: now.getTime() + 1000 });
    expect(r).toEqual({ ok: true, chain: "ethereum", address: w.address.toLowerCase() });
  });

  it("refuses a signature from another wallet", () => {
    const w = ethWallet(), other = ethWallet();
    const message = buildMessage({ chain: "ethereum", domain: host, origin, address: w.address, userId, nonce: "abcdefgh12", now });
    const r = checkProof({ chain: "ethereum", address: w.address, message, signature: other.sign(message) }, { userId, host, origin, now: now.getTime() });
    expect(r.ok).toBe(false);
  });

  it("accepts a real Solana signature and refuses a changed message", () => {
    const w = solWallet();
    const message = buildMessage({ chain: "solana", domain: host, origin, address: w.address, userId, nonce: "abcdefgh12", now });
    const signature = w.sign(message);
    expect(verifySolana(message, signature, w.address)).toBe(true);
    expect(checkProof({ chain: "solana", address: w.address, message, signature }, { userId, host, origin, now: now.getTime() })).toMatchObject({ ok: true });
    const changed = message.replace("Nonce: abcdefgh12", "Nonce: abcdefgh13");
    expect(verifySolana(changed, signature, w.address)).toBe(false);
  });

  it("refuses a proof signed for another account, another site, or too long ago", () => {
    const w = ethWallet();
    const message = buildMessage({ chain: "ethereum", domain: host, origin, address: w.address, userId, nonce: "abcdefgh12", now });
    const signature = w.sign(message);
    const at = now.getTime();
    expect(checkProof({ chain: "ethereum", address: w.address, message, signature }, { userId: "22222222-2222-4222-8222-222222222222", host, origin, now: at })).toMatchObject({ ok: false, error: expect.stringMatching(/another Parity account/) });
    expect(checkProof({ chain: "ethereum", address: w.address, message, signature }, { userId, host: "evil.example", origin: "https://evil.example", now: at })).toMatchObject({ ok: false });
    expect(checkProof({ chain: "ethereum", address: w.address, message, signature }, { userId, host, origin, now: at + WINDOW_MS + 1000 })).toMatchObject({ ok: false, error: expect.stringMatching(/too old/) });
    expect(messageProblem(message.replace("Read only", "Full access"), { chain: "ethereum", address: w.address, host, origin, userId, now: at })).toMatch(/changed/);
  });

  it("refuses bad input shapes", () => {
    expect(checkProof(null, { userId, host, origin })).toMatchObject({ ok: false, status: 400 });
    expect(checkProof({ chain: "bitcoin" }, { userId, host, origin })).toMatchObject({ ok: false, status: 400 });
    expect(checkProof({ chain: "ethereum", address: "0x1", message: "x", signature: "0x00" }, { userId, host, origin })).toMatchObject({ ok: false, status: 400 });
  });
});
