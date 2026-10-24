// REF-0016 badges: acceptance test 9 (a withdrawn badge's page shows the withdrawal
// notice, not a 404), the badge and dataset rows for test 6 (no trace of personal data),
// the opt-in box (never ticked by default), the image, the social line and the public
// image function. The database is always stubbed; no test talks to the network.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { onRequestGet } from "../../functions/badge/[id]";
import { onRequestGet as servePage } from "../../functions/v/[id]";
import { badgeSvg, embedSnippet, newBadgeId, socialLine, type PublicBadge } from "../../src/lib/verify/badge";
import { checkFile } from "../../src/lib/verify/checks";
import { parseText } from "../../src/lib/verify/parse";
import { badgeRecord, datasetRow, publicCards } from "../../src/lib/verify/publish";
import { badgeIdFromPath, VerifyBadge } from "../../src/pages/VerifyBadge";
import { honestEdge } from "./fixtures";

if (!window.matchMedia) {
  Object.defineProperty(window, "matchMedia", { value: (q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false }) });
}

// A stand-in for the database: records inserts, lists no badges. The real client is
// never loaded, so nothing here can reach Supabase.
const inserted: unknown[] = [];
const stubDb = async () => ({
  from: () => ({
    insert: async (row: unknown) => { inserted.push(row); return { error: null }; },
    select: () => ({ order: () => ({ limit: async () => ({ data: [], error: null }) }) }),
    update: () => ({ eq: async () => ({ error: null }) }),
  }),
});

const SECRETS = ["88001234", "Test Person", "someone@example.com", "Demo-Server01"];
const personal = readFileSync(join(import.meta.dirname, "../fixtures/verify/personal.csv"), "utf8");
const result = (text: string) => checkFile({ parsed: parseText(text), answers: { kind: "demo", balance: 10000, tries: 3, claim: {} }, prices: null });

const live = (over: Partial<PublicBadge> = {}): PublicBadge => {
  const r = result(honestEdge());
  const rec = badgeRecord(r, { id: "Ab3dEf6hIj9k", name: "My EURUSD bot", sha256: "a".repeat(64) });
  return { ...rec, created_at: "2026-10-24T10:00:00Z", withdrawn_at: null, cards: JSON.parse(JSON.stringify(rec.cards)), ...over } as PublicBadge;
};

describe("badge ids", () => {
  it("are 12 random letters and digits, never repeating", () => {
    const ids = new Set(Array.from({ length: 2000 }, () => newBadgeId()));
    expect(ids.size).toBe(2000);
    for (const id of ids) expect(id).toMatch(/^[A-Za-z0-9]{12}$/);
  });
  it("are read from the address", () => {
    expect(badgeIdFromPath("/v/Ab3dEf6hIj9k")).toBe("Ab3dEf6hIj9k");
    expect(badgeIdFromPath("/v/Ab3dEf6hIj9k/")).toBe("Ab3dEf6hIj9k");
  });
});

describe("what leaves the browser carries no personal data (test 6)", () => {
  const r = result(personal);
  it("the badge record", () => {
    const rec = badgeRecord(r, { id: newBadgeId(), name: "Bot", sha256: "b".repeat(64) });
    const json = JSON.stringify(rec);
    for (const s of SECRETS) expect(json).not.toContain(s);
    expect(json).not.toContain("balance\"");
    expect(rec.file_sha256).toBe("b".repeat(64));
  });
  it("the dataset row: no name, no hash, months only, numbers only", () => {
    const row = datasetRow(result(honestEdge()));
    const json = JSON.stringify(datasetRow(r));
    for (const s of SECRETS) expect(json).not.toContain(s);
    expect(row.month_from).toBe("2023-01-01");
    expect(row.month_to).toMatch(/^\d{4}-\d{2}-01$/);
    expect(Object.keys(row)).not.toContain("file_sha256");
    expect(Object.keys(row)).not.toContain("name");
    expect(JSON.stringify(row.summary)).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(row.asset_classes).toEqual(["fx"]);
  });
  it("stores 'never passes' in a form JSON can hold", () => {
    const r2 = checkFile({ parsed: parseText(honestEdge()), answers: { kind: "demo", balance: 10000, tries: 1, claim: {} }, prices: null });
    const c = publicCards({ ...r2, card3: { ...r2.card3!, monthsMore: Infinity } });
    expect(JSON.parse(JSON.stringify(c)).card3.monthsMore).toBe(-1);
  });
});

describe("the badge image, embed and social line", () => {
  it("is 320 by 80 and carries the trust words", () => {
    const s = badgeSvg(live());
    expect(s).toContain('width="320" height="80"');
    expect(s).toContain("Self-reported: Parity checked the numbers in the file,");
    expect(s).toContain("Not a recommendation.");
  });
  it("never shows the old verdict once withdrawn", () => {
    const s = badgeSvg(live({ withdrawn_at: "2026-11-02T08:00:00Z", verdict: null, cards: null }));
    expect(s).toContain("Withdrawn by its owner");
    expect(s).toContain("on 2026-11-02");
  });
  it("writes the social line the spec describes", () => {
    const line = socialLine({ id: "Ab3dEf6hIj9k", verdict: "could_be_luck", survives_tries: 4, input_kind: "backtest", trade_count: 212 }, "parity.endyland.com");
    expect(line).toBe("Parity Verify: Could be luck. Survives up to 4 tries. Self-reported backtest, 212 trades. parity.endyland.com/v/Ab3dEf6hIj9k");
    expect(embedSnippet("Ab3dEf6hIj9k", "https://parity.endyland.com")).toContain('src="https://parity.endyland.com/badge/Ab3dEf6hIj9k.svg" width="320" height="80"');
  });
});

describe("the public badge page", () => {
  it("shows the withdrawal notice, not a 404 (test 9)", async () => {
    const load = vi.fn(async () => live({ withdrawn_at: "2026-11-02T08:00:00Z", name: null, verdict: null, cards: null, file_sha256: null }));
    render(<VerifyBadge path="/v/Ab3dEf6hIj9k" load={load} />);
    expect(await screen.findByText("This record was withdrawn by its owner on 2 Nov 2026")).toBeInTheDocument();
    expect(load).toHaveBeenCalledWith("Ab3dEf6hIj9k");
    expect(screen.queryByText(/No record at this address/)).toBeNull();
  });

  it("shows the verdict, the five cards, the date, the method and the file hash, with no sign-in", async () => {
    const { container } = render(<VerifyBadge path="/v/Ab3dEf6hIj9k" load={async () => live()} />);
    expect(await screen.findByRole("heading", { name: "My EURUSD bot" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Holds up" })).toBeInTheDocument();
    expect(container.querySelectorAll(".vf-cards .mcard").length).toBeGreaterThanOrEqual(5);
    expect(screen.getByText("a".repeat(64))).toBeInTheDocument();
    expect(screen.getByText(/Checked on 24 Oct 2026 with method verify-1.0/)).toBeInTheDocument();
    expect(screen.getByText(/Verification is not a recommendation/)).toBeInTheDocument();
    // Links on the public page go to the public lessons and glossary, not into the app.
    expect(container.querySelector('a[href^="#/"]')).toBeNull();
  });

  it("says plainly when there is no badge at the address", async () => {
    render(<VerifyBadge path="/v/Ab3dEf6hIj9k" load={async () => null} />);
    expect(await screen.findByText("No record at this address")).toBeInTheDocument();
    render(<VerifyBadge path="/v/not-an-id" load={async () => { throw new Error("must not be called"); }} />);
    expect(screen.getAllByText("No record at this address").length).toBe(2);
  });
});

describe("the badge image function, /badge/<id>.svg", () => {
  const stub = (rows: PublicBadge[]) => vi.fn(async () => new Response(JSON.stringify(rows), { status: 200 })) as unknown as typeof fetch;
  it("draws a live badge", async () => {
    const f = stub([live()]);
    const res = await onRequestGet({ request: new Request("https://x/badge/Ab3dEf6hIj9k.svg"), params: { id: "Ab3dEf6hIj9k.svg" } }, f);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("image/svg+xml");
    expect(await res.text()).toContain("Holds up");
    expect(JSON.parse((f as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1].body)).toEqual({ p_id: "Ab3dEf6hIj9k" });
  });
  it("refuses a bad id without asking the database, and shows withdrawal", async () => {
    const f = stub([]);
    expect((await onRequestGet({ request: new Request("https://x/badge/x.svg"), params: { id: "x.svg" } }, f)).status).toBe(404);
    expect(f).not.toHaveBeenCalled();
    const w = await onRequestGet({ request: new Request("https://x"), params: { id: "Ab3dEf6hIj9k.svg" } }, stub([live({ withdrawn_at: "2026-11-02T00:00:00Z", verdict: null, cards: null })]));
    expect(await w.text()).toContain("Withdrawn by its owner");
  });
});

describe("the share panel", async () => {
  const { SharePanel, DATASET_TEXT } = await import("../../src/pages/verify/Share");
  it("never ticks the dataset box by default, says what it is used for, and publishes only summary numbers", async () => {
    const r = result(personal);
    const parsed = parseText(personal);
    render(<SharePanel r={r} file={{ parsed, sha256: "c".repeat(64), name: "account-88001234.csv" }} db={stubDb} />);
    const box = screen.getByRole("checkbox", { name: DATASET_TEXT });
    expect(box).not.toBeChecked();
    expect(screen.getByText(/may be sold to other companies in aggregate/)).toBeInTheDocument();
    expect(screen.getByText(/This cannot be undone/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Only add to the dataset" })).toBeDisabled();
    // The name starts empty (a file name can hold personal details), so publishing waits for one.
    expect(screen.getByRole("button", { name: "Publish badge" })).toBeDisabled();
    fireEvent.change(screen.getByRole("textbox", { name: /Name for the record/ }), { target: { value: "My bot" } });
    fireEvent.click(screen.getByRole("button", { name: "Publish badge" }));
    await waitFor(() => expect(inserted).toHaveLength(1));
    const row = inserted[0] as Record<string, unknown>;
    expect(row.id).toMatch(/^[A-Za-z0-9]{12}$/);
    expect(row.file_sha256).toBe("c".repeat(64));
    for (const s of SECRETS) expect(JSON.stringify(row)).not.toContain(s);
    expect((await screen.findAllByText(/\/v\/[A-Za-z0-9]{12}$/)).length).toBeGreaterThan(0);
  });
});

describe("the badge page function, /v/<id>", () => {
  it("serves the built /v/ page for any id, out of search", async () => {
    const fetch = vi.fn(async (req: Request | string) => new Response(`<title>page for ${new URL(typeof req === "string" ? req : req.url).pathname}</title>`, { headers: { "Content-Type": "text/html" } }));
    const res = await servePage({ request: new Request("https://parity.endyland.com/v/Ab3dEf6hIj9k"), env: { ASSETS: { fetch } }, params: { id: "Ab3dEf6hIj9k" } });
    expect(await res.text()).toBe("<title>page for /v/</title>");
    expect(res.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
  });
});
