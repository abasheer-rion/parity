import { describe, expect, it } from "vitest";
import { isDuplicateFill, saveFills } from "../src/lib/paper/account";
import type { PaperFill } from "../src/lib/paper/matching";

const fill = (order_id: string): PaperFill => ({ order_id, symbol: "fx.EUR", side: "buy", qty: 1, price: 1.1, fee: 1, bar_date: "2026-10-01", realized_pnl: null });
const dup = new Error('Could not save: duplicate key value violates unique constraint "paper_fills_one_per_order"');

// A fake fills table that refuses a second fill for the same order, like the database.
function fakeTable() {
  const saved = new Set<string>();
  const one = async (r: { order_id: string }) => {
    if (saved.has(r.order_id)) throw dup;
    saved.add(r.order_id);
    return r as never;
  };
  return {
    saved,
    insert: one,
    insertMany: async (rows: { order_id: string }[]) => {
      if (rows.some((r) => saved.has(r.order_id))) throw dup; // one statement: all or nothing
      return Promise.all(rows.map(one));
    },
  };
}

describe("one fill per order", () => {
  it("knows the database's refusal", () => {
    expect(isDuplicateFill(dup)).toBe(true);
    expect(isDuplicateFill(new Error("Could not save: permission denied"))).toBe(false);
  });

  it("treats a fill another tab already saved as done, and keeps the new ones", async () => {
    const t = fakeTable();
    await saveFills([fill("a")], "acct", t);
    await saveFills([fill("a")], "acct", t); // the second tab
    await saveFills([fill("a"), fill("b")], "acct", t);
    expect([...t.saved].sort()).toEqual(["a", "b"]);
  });

  it("still reports other errors", async () => {
    const bad = { insert: async () => { throw new Error("offline"); }, insertMany: async () => { throw new Error("offline"); } };
    await expect(saveFills([fill("a")], "acct", bad as never)).rejects.toThrow("offline");
  });
});
