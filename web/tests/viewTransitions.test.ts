// Which page changes keep the fade (src/site/viewTransitions.ts). Only the front page, the
// sign-in pages and /connect/ opt in; a transition into any other page is aborted by the
// browser and shows there as an uncaught error, so it is skipped before leaving.
import { describe, expect, it } from "vitest";
import { skipsTransition } from "../src/site/viewTransitions";

const HERE = "https://parity.example/";

describe("skipsTransition", () => {
  it("keeps the fade between the pages that opt in", () => {
    for (const to of ["/", "/login/", "/signup/", "/reset/", "/verify/?x=1", "/connect/", "/login"]) expect(skipsTransition(to, HERE)).toBe(false);
  });
  it("skips it into the apps and every other page", () => {
    for (const to of ["/app/", "/trade/#/chart", "/research/", "/learn/", "/ideas/", "/blog/", "/news/", "/legal/privacy/", "/notes/dec-0001/"]) expect(skipsTransition(to, HERE)).toBe(true);
  });
  it("skips it for another site or no address", () => {
    expect(skipsTransition("https://example.com/", HERE)).toBe(true);
    expect(skipsTransition(undefined, HERE)).toBe(true);
  });
});
