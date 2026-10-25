// The getting started checklist (DEC-0060): what each item is, where it links, and the rule
// that decides whether it is done. No React and no network here, so the rule is unit tested
// (tests/onboarding.test.ts).
//
// An item is done when either:
//   - it has a done time saved in onboarding_state (stamped the first time the action was seen,
//     never cleared, so deleting a watchlist later does not undo the item), or
//   - a live signal says the action has happened (a demo order exists, the email is
//     confirmed, an AI app holds a token for this person, and so on).
// A live signal that is true without a saved time is "newly done": the store saves its time.
//
// The brokerage item is never done and never counts: there is no broker partner yet
// (DEC-0046), so it only offers "Notify me".

export type ItemId = "email" | "ai" | "verify" | "trade" | "watch" | "lesson" | "mfa" | "wallet" | "broker";

/** The items that can be completed, in the order they show. */
export const DOABLE: Exclude<ItemId, "broker">[] = ["email", "ai", "verify", "trade", "watch", "lesson", "mfa", "wallet"];

/** The onboarding_state column holding each item's done time. */
export const COLUMN: Record<Exclude<ItemId, "broker">, string> = {
  email: "email_at", ai: "ai_at", verify: "verify_at", trade: "trade_at",
  watch: "watch_at", lesson: "lesson_at", mfa: "mfa_at", wallet: "wallet_at",
};

export interface Item {
  id: ItemId;
  title: string;
  /** One plain line under the title. */
  body: string;
  /** Where the action happens. Absent for items handled in place (wallet, brokerage). */
  href?: string;
  action: string;
}

export type Stamps = Partial<Record<Exclude<ItemId, "broker">, string | null>>;
export type Signals = Partial<Record<Exclude<ItemId, "broker">, boolean>>;

export interface ItemState extends Item { done: boolean; at: string | null }

export interface Progress {
  items: ItemState[];
  done: number;
  total: number;
  /** Items a live signal shows as done that have no saved time yet. */
  newly: Exclude<ItemId, "broker">[];
  /** The first item not done yet, if any. */
  next: ItemState | null;
}

/** The items, with links built for the app the checklist is in. */
export function itemList(links: { connect: string; verify: string; trade: string; watch: string; academy: string; account: string }): Item[] {
  return [
    { id: "email", title: "Verify your email", body: "Click the link we emailed you, so you can reset your password if you forget it.", href: links.account, action: "Account" },
    { id: "ai", title: "Connect your AI", body: "Add Parity to Claude, ChatGPT, Gemini or Cursor. Done when your AI app first signs in.", href: links.connect, action: "Connect" },
    { id: "verify", title: "Run your first Verify check", body: "Upload a trade log, describe a bot or pick a strategy, and read the result.", href: links.verify, action: "Verify" },
    { id: "trade", title: "Place a demo trade", body: "Buy or sell with the demo account in Trade. Virtual money, delayed prices.", href: links.trade, action: "Trade" },
    { id: "watch", title: "Add a watchlist or alert", body: "Add a symbol to a watchlist, set a price alert, or follow a strategy.", href: links.watch, action: "Watchlists" },
    { id: "lesson", title: "Take an Academy lesson", body: "Finish one short lesson, with its quick check.", href: links.academy, action: "Academy" },
    { id: "mfa", title: "Turn on two-step sign-in", body: "Ask for a code from an authenticator app after your password.", href: links.account, action: "Account" },
    { id: "wallet", title: "Add a crypto wallet, read only", body: "By its public address, or by signing a message in your wallet app. We never ask for your seed phrase or private key.", action: "Add wallet" },
    { id: "broker", title: "Link a brokerage account, coming later", body: "This will go through a regulated broker partner. Parity holds no money and never asks for bank or card details.", action: "Notify me" },
  ];
}

/** The welcome after sign-up (src/auth/pages/Welcome.tsx, DEC-0044) asks what the person
 *  wants to do first and keeps the picks in this browser under this key. */
export const INTERESTS_KEY = "parity.interests.v1";
const FOR_INTEREST: Record<string, Exclude<ItemId, "broker">> = { verify: "verify", trade: "trade", strategies: "watch", learn: "lesson" };

/** The items the person picked in the welcome come right after "Verify your email", in the
 *  order they picked them. Everything else keeps its place. */
export function orderByInterests(items: Item[], picks: string[]): Item[] {
  const want = picks.map((p) => FOR_INTEREST[p]).filter(Boolean);
  if (!want.length) return items;
  const first = items.filter((i) => i.id === "email");
  const picked = want.map((id) => items.find((i) => i.id === id)).filter((i): i is Item => !!i);
  return [...first, ...picked, ...items.filter((i) => i.id !== "email" && !want.includes(i.id as Exclude<ItemId, "broker">))];
}

/** Works out which items are done. `mfaAvailable: false` drops two-step sign-in from the list. */
export function progress(items: Item[], stamps: Stamps, signals: Signals, opts: { mfaAvailable?: boolean } = {}): Progress {
  const shown = items.filter((i) => i.id !== "mfa" || opts.mfaAvailable !== false);
  const newly: Exclude<ItemId, "broker">[] = [];
  const out: ItemState[] = shown.map((i) => {
    if (i.id === "broker") return { ...i, done: false, at: null };
    const at = stamps[i.id] ?? null;
    const live = signals[i.id] === true;
    if (live && !at) newly.push(i.id);
    return { ...i, done: !!at || live, at };
  });
  const doable = out.filter((i) => i.id !== "broker");
  return {
    items: out,
    done: doable.filter((i) => i.done).length,
    total: doable.length,
    newly,
    next: doable.find((i) => !i.done) ?? null,
  };
}
