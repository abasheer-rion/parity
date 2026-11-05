// Every source the fill price check may use, in the order tried for each market (DEC-0092).
// Exchanges' own candles (Coinbase, Kraken, Binance, Bybit, OKX) are not here: their terms
// forbid this use. No free currency source we read has highs and lows we may use.
import { ONCHAIN } from "./onchain";
import { ALPACA_IEX, type SourceDef } from "./sources";

export const FILL_SOURCES: SourceDef[] = [ALPACA_IEX, ONCHAIN];
