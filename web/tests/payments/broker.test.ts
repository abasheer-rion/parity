// The Broker interface (DEC-0045): the demo account works through it, a real broker
// adapter refuses every call.
import { beforeEach, describe, expect, it } from "vitest";
import { BrokerNotEnabledError, brokerFor, liveBrokerStub, paperBroker } from "../../src/lib/broker";
import { setLocalStore } from "../../src/lib/userStore";
import type { Bar } from "../../src/lib/indicators";

const BAR: Bar = { time: "2026-10-23", open: 100, high: 100, low: 100, close: 100 };

describe("real broker stub", () => {
  it("throws 'not enabled' on every call", async () => {
    for (const id of ["alpaca", "ibkr", "oanda", "coinbase"] as const) {
      const b = liveBrokerStub(id);
      expect(b.mode).toBe("live");
      await expect(b.account()).rejects.toBeInstanceOf(BrokerNotEnabledError);
      await expect(b.positions()).rejects.toThrow(/not enabled/);
      await expect(b.orders()).rejects.toThrow(/not enabled/);
      await expect(b.placeOrder({ symbol: "SPY", side: "buy", type: "market", qty: 1 })).rejects.toThrow(/not enabled/);
      await expect(b.cancelOrder("x")).rejects.toThrow(/not enabled/);
    }
  });

  it("asking for live gives the stub, paper gives the demo account", () => {
    expect(brokerFor("live", async () => BAR).mode).toBe("live");
    expect(brokerFor("paper", async () => BAR).id).toBe("paper");
  });
});

describe("paper broker", () => {
  beforeEach(() => {
    setLocalStore(true);
    window.localStorage.clear();
  });

  it("places a market buy on the demo account and shows the position", async () => {
    const b = paperBroker(async () => BAR);
    const start = await b.account();
    expect(start.mode).toBe("paper");
    expect(start.cash).toBe(100_000);
    const placed = await b.placeOrder({ symbol: "SPY", side: "buy", type: "market", qty: 10 });
    expect(placed[0].status).toBe("filled");
    const pos = await b.positions();
    expect(pos).toHaveLength(1);
    expect(pos[0]).toMatchObject({ symbol: "SPY", qty: 10 });
    expect((await b.account()).cash).toBeLessThan(100_000);
    expect(await b.orders()).toHaveLength(1);
  });

  it("refuses an order when there is no delayed price", async () => {
    await expect(paperBroker(async () => null).placeOrder({ symbol: "XYZ", side: "buy", type: "market", qty: 1 })).rejects.toThrow(/No delayed price/);
  });
});
