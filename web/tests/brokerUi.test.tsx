// Broker trading in Parity Trade (DEC-0046): the mode badge on every ticket, preview and
// list, the sandbox card that asks for no personal or bank details, the retry that keeps
// its idempotency key, and the fall back to the in-browser demo account when the server
// does not carry orders. The client is a fake: no test talks to the network.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TradingClient } from "../src/lib/trading/client";
import type { Preview, TradingStatus } from "../src/lib/trading/types";
import type { Demo } from "../src/trade/demo";

const fakeDemo = {
  all: [{ key: "eq.US_MKT", short: "US", label: "US market" }], list: [{ key: "eq.US_MKT" }], error: null, loaded: true,
  accounts: [], account: undefined, chooseAccount: () => {}, addAccount: () => {},
  book: { cash: 100000, positions: {} }, orders: [], open: [], done: [], fills: [], holdings: [],
  equity: 100000, start: 100000, upl: 0, realized: 0, curve: [], stats: {}, costs: { fee_bps: 0, fee_min: 0, slippage_bps: 0 },
  last: () => ({ time: "2026-10-23", open: 100, high: 101, low: 99, close: 100, volume: 0 }), refPrice: () => 100, label: (k: string) => k,
  busy: false, place: async () => {}, cancelOrder: () => {},
} as unknown as Demo;

vi.mock("../src/trade/demo", async (orig) => ({ ...(await orig<typeof import("../src/trade/demo")>()), useDemo: () => fakeDemo }));

const { TradingProvider } = await import("../src/trade/trading");
const { OrderTicket } = await import("../src/trade/OrderTicket");
const { PositionsTable } = await import("../src/trade/blotter");
const { BrokerPositionsTable, BrokerOrdersTable, SandboxCard } = await import("../src/trade/brokerBlotter");

const LIMITS = { maxOrderValue: 50000, maxQty: 1000, priceCollar: 0.1, shortingAllowed: false, ordersPerMinute: 30 };
const status = (s: Partial<TradingStatus>): TradingStatus => ({ mode: "demo", engine: "alpaca_paper", badge: "Demo money", notes: [], limits: LIMITS, ...s });
const PREVIEW: Preview = { ok: true, badge: "Sandbox", mode: "sandbox", price: 180, priceSource: "Latest trade", estQty: 2, estCost: 360, estFees: 0, errors: [], warnings: ["Day trade count is 3 of 3"] };

function fakeClient(st: TradingStatus | Error, extra: Partial<Record<keyof TradingClient, unknown>> = {}): TradingClient {
  return {
    status: vi.fn(async () => { if (st instanceof Error) throw st; return st; }),
    preview: vi.fn(async () => PREVIEW),
    placeOrder: vi.fn(),
    orders: vi.fn(async () => []),
    modifyOrder: vi.fn(),
    cancelOrder: vi.fn(),
    fills: vi.fn(async () => []),
    positions: vi.fn(async () => ({ positions: [{ symbol: "AAPL", assetClass: "us_equity", qty: 2, avgCost: 170, lastPrice: 180, marketValue: 360, unrealizedPl: 20, realizedPl: 0 }], balances: { mode: "sandbox", badge: "Sandbox", cash: 1000, buyingPower: 1000, equity: 1360, totalPl: 20 } })),
    exportCsv: vi.fn(),
    createSandboxAccount: vi.fn(async () => ({ status: "ACTIVE", funded: false })),
    fundSandbox: vi.fn(async () => ({ ok: true })),
    streamUrl: vi.fn(async () => "/api/trade/stream?access_token=x"),
    ...extra,
  } as unknown as TradingClient;
}

// jsdom has no EventSource, so the provider's stream stays idle.
const wrap = (client: TradingClient, ui: ReactNode) => render(<TradingProvider client={client}>{ui}</TradingProvider>);
const ticket = () => <OrderTicket symbol="S:AAPL" confirm={false} />;

afterEach(cleanup);

describe("fall back to the in-browser demo account", () => {
  it("keeps the demo ticket, badged Demo money, when status fails", async () => {
    const c = fakeClient(new Error("offline"));
    wrap(c, ticket());
    await waitFor(() => expect(c.status).toHaveBeenCalled());
    expect(screen.getByRole("option", { name: "Trailing stop" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: /symbol/i })).toBeNull();
    expect(screen.getByText("Demo money")).toBeInTheDocument();
  });

  it("keeps the demo ticket when the engine is browser", async () => {
    const c = fakeClient(status({ engine: "browser" }));
    wrap(c, ticket());
    await waitFor(() => expect(c.status).toHaveBeenCalled());
    await act(async () => {});
    expect(screen.getByRole("option", { name: "Trailing stop" })).toBeInTheDocument();
    expect(c.orders).not.toHaveBeenCalled();
  });

  it("badges the demo positions list, even with no provider", () => {
    render(<PositionsTable />);
    expect(screen.getByText("Demo money")).toBeInTheDocument();
  });
});

describe.each([
  ["demo", status({ engine: "alpaca_paper", mode: "demo", badge: "Demo money" }), "Demo money"],
  ["sandbox", status({ engine: "alpaca_broker_sandbox", mode: "sandbox", badge: "Sandbox", account: { status: "ACTIVE", funded: true } }), "Sandbox"],
])("server %s mode", (_name, st, badge) => {
  it("badges the ticket and the preview", async () => {
    const c = fakeClient(st);
    wrap(c, ticket());
    const sym = await screen.findByRole("textbox", { name: /symbol/i });
    expect(sym).toHaveValue("AAPL");
    expect(within(screen.getByRole("form", { name: "Order ticket" })).getByText(badge)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Preview/ }));
    const preview = await screen.findByRole("region", { name: "Order preview" });
    expect(within(preview).getByText(badge)).toBeInTheDocument();
    expect(within(preview).getByText("Day trade count is 3 of 3")).toBeInTheDocument();
    expect(c.preview).toHaveBeenCalledWith(expect.objectContaining({ symbol: "AAPL", side: "buy", type: "market", qty: 1, timeInForce: "day" }));
  });

  it("badges the positions and order lists", async () => {
    const c = fakeClient(st);
    wrap(c, <><BrokerPositionsTable /><BrokerOrdersTable rows={[]} tz="UTC" actions /></>);
    expect(await screen.findByText("AAPL")).toBeInTheDocument();
    expect(screen.getAllByText(badge)).toHaveLength(2);
  });
});

describe("broker ticket", () => {
  const sandbox = status({ engine: "alpaca_broker_sandbox", mode: "sandbox", badge: "Sandbox", account: { status: "ACTIVE", funded: true } });

  it("retries a failed Confirm with the same idempotency key, and a new order gets a new key", async () => {
    const order = { id: "o1", side: "buy", symbol: "AAPL", status: "new", filledQty: 0, createdAt: "2026-10-26T14:00:00Z" };
    const placeOrder = vi.fn()
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValueOnce({ order, duplicate: false })
      .mockResolvedValueOnce({ order: { ...order, id: "o2" }, duplicate: false });
    const c = fakeClient(sandbox, { placeOrder });
    wrap(c, ticket());
    fireEvent.click(await screen.findByRole("button", { name: /^Preview/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Confirm" }));
    fireEvent.click(await screen.findByRole("button", { name: "Try again" }));
    await waitFor(() => expect(placeOrder).toHaveBeenCalledTimes(2));
    expect(placeOrder.mock.calls[1][1]).toBe(placeOrder.mock.calls[0][1]);

    fireEvent.click(await screen.findByRole("button", { name: /^Preview/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(placeOrder).toHaveBeenCalledTimes(3));
    expect(placeOrder.mock.calls[2][1]).not.toBe(placeOrder.mock.calls[0][1]);
  });

  it("offers gtc and ioc only for crypto, and dollar amounts only for market day orders", async () => {
    const c = fakeClient(sandbox);
    wrap(c, ticket());
    const sym = await screen.findByRole("textbox", { name: /symbol/i });
    fireEvent.change(sym, { target: { value: "BTC/USD" } });
    const tif = screen.getByRole("combobox", { name: "Time in force" });
    expect(within(tif).getAllByRole("option").map((o) => o.getAttribute("value"))).toEqual(["gtc", "ioc"]);
    expect(screen.getByRole("radio", { name: "Dollars" })).toBeDisabled();

    fireEvent.change(sym, { target: { value: "AAPL" } });
    fireEvent.click(screen.getByRole("radio", { name: "Dollars" }));
    fireEvent.change(screen.getByRole("spinbutton", { name: /Amount/ }), { target: { value: "250" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Type" }), { target: { value: "limit" } });
    expect(screen.getByText("Dollar amounts work on market day orders only")).toBeInTheDocument();
  });

  it("blocks Confirm when the preview has errors", async () => {
    const c = fakeClient(sandbox, { preview: vi.fn(async () => ({ ...PREVIEW, ok: false, errors: ["Not enough buying power"] })) });
    wrap(c, ticket());
    fireEvent.click(await screen.findByRole("button", { name: /^Preview/ }));
    expect(await screen.findByText("Not enough buying power")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm" })).toBeDisabled();
  });
});

describe("sandbox onboarding", () => {
  const BANNED = /ssn|social security|tax|tin\b|birth|dob|address|bank|routing|account number|iban|swift/i;

  it("asks only for the agreement, with no personal or bank fields", async () => {
    const c = fakeClient(status({ engine: "alpaca_broker_sandbox", mode: "sandbox", badge: "Sandbox", account: null }));
    wrap(c, <SandboxCard />);
    const card = await screen.findByRole("region", { name: "Sandbox account" });
    expect(card).toHaveTextContent("No personal details are collected");
    const inputs = card.querySelectorAll("input, select, textarea");
    expect([...inputs].map((i) => i.getAttribute("type"))).toEqual(["checkbox"]);
    for (const el of card.querySelectorAll("label, input, button")) {
      expect(`${el.textContent} ${el.getAttribute("placeholder") ?? ""} ${el.getAttribute("name") ?? ""}`).not.toMatch(BANNED);
    }
    const create = within(card).getByRole("button", { name: "Create sandbox account" });
    expect(create).toBeDisabled();
    fireEvent.click(within(card).getByRole("checkbox"));
    fireEvent.click(create);
    await waitFor(() => expect(c.createSandboxAccount).toHaveBeenCalled());
  });

  it("asks only for a pretend amount when funding", async () => {
    const c = fakeClient(status({ engine: "alpaca_broker_sandbox", mode: "sandbox", badge: "Sandbox", account: { status: "ACTIVE", funded: false } }));
    wrap(c, <SandboxCard />);
    const card = await screen.findByRole("region", { name: "Sandbox account" });
    const inputs = [...card.querySelectorAll("input, select, textarea")];
    expect(inputs.map((i) => i.getAttribute("type"))).toEqual(["number"]);
    expect(card.textContent).not.toMatch(BANNED);
    fireEvent.click(within(card).getByRole("button", { name: "Add pretend funds" }));
    await waitFor(() => expect(c.fundSandbox).toHaveBeenCalledWith(10000));
  });

  it("is hidden outside sandbox mode", async () => {
    const c = fakeClient(status({ engine: "alpaca_paper" }));
    wrap(c, <SandboxCard />);
    await waitFor(() => expect(c.status).toHaveBeenCalled());
    await act(async () => {});
    expect(screen.queryByRole("region", { name: "Sandbox account" })).toBeNull();
  });
});

describe("copy", () => {
  it("has no em or en dashes in the broker screens", async () => {
    const { readFileSync } = await import("node:fs");
    for (const f of ["src/trade/BrokerTicket.tsx", "src/trade/brokerBlotter.tsx", "src/trade/trading.tsx", "src/lib/trading/client.ts"]) {
      expect(readFileSync(f, "utf8")).not.toMatch(/[–—]/);
    }
  });
});
