// A one-line hook for pages where a checklist action happens (Verify, Trade, the strategy
// bookmark): marks the item done without pulling the onboarding store into the page's first
// load. Failures are ignored; the checklist also works the item out from live data.
import type { ItemId } from "./items";

export function signalDone(id: Exclude<ItemId, "broker">): void {
  void import("./store").then((m) => m.markDone(id)).catch(() => undefined);
}
