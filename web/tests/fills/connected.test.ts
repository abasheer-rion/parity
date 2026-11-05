// Broker-connected records (DEC-0091) get the fill price check on the server (DEC-0092).
// Trades Parity read from the broker itself should pass it: a fill outside the traded range
// there would point at our data, not the trader, so this doubles as a self-test.
import { beforeEach, describe, expect, it } from "vitest";
import { buildRecord } from "../../src/lib/connect/record";
import { fromB64url } from "../../src/lib/connect/bytes";
import type { VenueRead } from "../../src/lib/connect/types";
import type { Fill } from "../../src/lib/verify/parse/fills";
import { memoryCache, resetPacing } from "../../src/lib/verify/range/load";
import { FILL_SOURCES } from "../../src/lib/verify/range/registry";
import { serverFills } from "../../src/lib/verify/range/server";
import { testSecret } from "../connect/helpers";
import { marketFetch, PATH } from "./market";

const NOW = Date.parse("2026-03-20T12:00:00Z");
const at = (iso: string) => Date.parse(`${iso}Z`);

/** Thirty round trips in Bitcoin, bought and sold at prices the made-up market traded. */
function read(shift = 1): VenueRead {
  const fills: Fill[] = [];
  for (let i = 0; i < 30; i++) {
    const open = at("2026-03-02T09:00:00") + i * 3 * 3_600_000, close = open + 40 * 60_000;
    for (const [t, side] of [[open, "buy"], [close, "sell"]] as const) {
      const price = Math.round(PATH["BTC-USD"](t) * (side === "sell" ? shift : 1) * 100) / 100;
      fills.push({ time: new Date(t).toISOString().slice(0, 19), symbol: "BTCUSDT", side, qty: 0.01, price, value: 0.01 * price, fee: 0.05 });
    }
  }
  return { account: "acct-1", env: "live", fills, allowShort: false, sameAs: "binance_spot", notes: [] };
}

const run = (venue: VenueRead) => buildRecord({
  venue, venueId: "binance", range: { from: "2026-03-01", to: "2026-03-10" }, tries: 1, balance: 10_000, userId: "u1",
  seed: fromB64url(testSecret(1)), prices: null, now: NOW,
  fillCheck: serverFills({ env: {}, sources: FILL_SOURCES, cache: memoryCache(), fetch: marketFetch().fetch, sleep: async () => undefined }, () => NOW, 3, 200),
});

beforeEach(() => resetPacing());

describe("the fill price check on a broker-connected record", () => {
  it("passes trades read from the broker, and the signed cards carry the row", async () => {
    const r = await run(read());
    const row = r.result.card4.find((c) => c.id === "range")!;
    expect(row.status).toBe("pass");
    expect(row.detail).toMatch(/^All 60 fills we could check sit inside the range traded at that time on our data source\./);
    expect(row.detail).toMatch(/swaps in our on-chain pools on Base/);
    expect(r.cards.card4.find((c) => c.id === "range")!.status).toBe("pass");
    expect(r.result.card4.find((c) => c.id === "session")!.detail).toMatch(/crypto trades every day/);
  });

  it("would show a difference in our data at once: sells 3% above the market fail it", async () => {
    const r = await run(read(1.03));
    expect(r.result.card4.find((c) => c.id === "range")!.status).toBe("fail");
  });

  it("says it was not run when the check is not wired in", async () => {
    const r = await buildRecord({ venue: read(), venueId: "binance", range: { from: "2026-03-01", to: "2026-03-10" }, tries: 1, balance: 10_000, userId: "u1", seed: fromB64url(testSecret(1)), prices: null, now: NOW });
    expect(r.result.card4.find((c) => c.id === "range")!.detail).toMatch(/was not run for this record/);
  });
});
