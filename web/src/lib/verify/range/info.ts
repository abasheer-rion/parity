// What each fill price source is and how it is judged, in one place for the server (which
// uses the numbers) and the page and methodology (which say them in words). DEC-0092.
import type { SourceInfo } from "./engine";

const MIN = 60_000;

export interface SourceWords extends SourceInfo {
  /** What the source is, in words, for the result and the methodology. */
  what: string;
  /** The credit a source asks for wherever a result from it is shown. */
  credit?: string;
}

export type SourceId = "alpaca-iex" | "onchain-base";

export const SOURCE_INFO: Record<SourceId, SourceWords> = {
  "alpaca-iex": {
    id: "alpaca-iex", name: "IEX exchange trades, through Alpaca", market: "stock",
    barMs: MIN, window: 5 * MIN, tolBar: 0.005, tolDay: 0.01, tick: 0.01,
    what: "trades on the IEX exchange (through Alpaca), one-minute bars from 5 minutes before to 5 minutes after the fill, 0.5% allowed; the day's low and high, 1% allowed, when IEX had no trade in those minutes",
    credit: "Data provided for free by IEX. By accessing or using IEX Historical Data, you agree to the IEX Historical Data Terms of Use.",
  },
  "onchain-base": {
    id: "onchain-base", name: "Parity on-chain price, swaps in Base pools", market: "crypto",
    barMs: 2_000, window: 10 * MIN, tolBar: 0.01, tolDay: 0.01, exactTime: true,
    what: "swaps in our on-chain pools on Base from 10 minutes before to 10 minutes after the fill, 1% allowed (about the last eight weeks)",
  },
};

export const sourceWords = (id: string | undefined): SourceWords | null => (id && id in SOURCE_INFO ? SOURCE_INFO[id as SourceId] : null);
