// Sim World additions (DEC-0066): the event words, the example scenarios and the library.
import { describe, expect, it } from "vitest";
import { parseEvent } from "../src/lib/eventText";
import { PRESETS } from "../src/lib/scenarios";

// The engine's list (engine/src/parity/scenarios.py TYPES). A preset with any other type
// matches no past event at all, which is how two presets used to show nothing.
const TYPES = ["war", "military_strike", "terrorist_attack", "oil_supply_shock", "sanctions", "trade_war", "supply_chain_shock", "pandemic",
  "financial_crisis", "sovereign_default", "currency_crisis", "bank_run", "rate_shock", "central_bank_surprise", "crypto_crash", "election",
  "political_crisis", "natural_disaster"];

describe("example scenarios", () => {
  it("every preset uses a kind the engine knows", () => {
    for (const p of PRESETS) expect(TYPES, p.label).toContain(p.spec.type);
  });
});

describe("reading a typed event", () => {
  it.each([
    ["A run on a big US bank", "bank_run"],
    ["Italy cannot pay its debts", "sovereign_default"],
    ["Turkish lira plunges", "currency_crisis"],
    ["China devalues the yuan", "currency_crisis"],
    ["Bitcoin crashes after an exchange fails", "crypto_crash"],
    ["US bond yields spike on an inflation surprise", "rate_shock"],
    ["A container ship blocks the Suez canal", "supply_chain_shock"],
    ["Russia invades Poland", "war"],
    ["Iran bombs a Chinese port", "military_strike"],
    ["A stock market crash in Japan", "financial_crisis"],
  ])("%s", (text, type) => {
    expect(parseEvent(text).type).toBe(type);
  });

  it("finds the new countries and their regions", () => {
    const p = parseEvent("Sri Lanka and Ireland default");
    expect(p.actors).toEqual(expect.arrayContaining(["sri_lanka", "ireland"]));
    expect(p.regions).toEqual(expect.arrayContaining(["south_asia", "europe"]));
  });
});
