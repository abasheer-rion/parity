// An uploaded file checked the same way wherever it is uploaded. The compare page uses this;
// the Verify page's own call (pages/verify/Checker.tsx) passes the same inputs, and a test
// keeps the two words for "signed out" the same.
import type { PriceBook } from "../prices";
import type { Answers, Parsed } from "../types";
import { benchmarkFrom, checkFile, type Result } from "./index";

/** The fills check's words when the daily prices were not loaded because nobody is signed in. */
export const SIGNED_OUT_PRICES = "Not checked while signed out: our daily prices load only for signed-in accounts. Sign in and run the check again to compare the fills with them.";

/**
 * The daily prices check the fills when they are loaded, and when nobody is signed in the
 * report says the prices were not loaded, not that we hold none.
 */
export function checkUpload({ parsed, answers, prices, signedIn, triesDefaulted }: { parsed: Parsed; answers: Answers; prices: PriceBook | null; signedIn: boolean; triesDefaulted?: boolean }): Result {
  const needsPrices = !!parsed.trades?.some((t) => t.symbol && (t.entry != null || t.exit != null));
  return checkFile({
    parsed, answers, triesDefaulted,
    prices: needsPrices ? prices : null,
    benchmark: benchmarkFrom(prices),
    pricesMissing: needsPrices && !signedIn ? SIGNED_OUT_PRICES : undefined,
  });
}
