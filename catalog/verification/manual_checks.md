## Manual checks

Done by hand on 2026-10-21 by opening each source. The script found only 2 reported results whose verified_on_page claim
looked contradicted, so the list below also covers the weakest automatic matches, the scattered matches, the one blocked
source, every Sharpe above 2, and a recompute of the catalog's own calculations.

1. fx-volatility-risk-premium, result 0 (volatility 8.15 percent). Page supports it. The PDF prints decimal points as
   colons ("8:15", "17:0"), so the text search missed it. Table 3 Panel A, developed column: mean 4.95, Sdev 8.15,
   SR 0.61, MDD 17.0. All four catalog numbers are right. The script now corrects colon decimals.
2. fx-volatility-risk-premium, result 1 (volatility 8.14 percent, drawdown 24.4 percent). Page supports it. Same table,
   developed and emerging column: 4.16, 8.14, 0.51, 24.4. The carry figures in the notes (Sharpe 0.53, drawdown 28.2) also match.
3. fx-carry-g10, results 2 and 3 (Daniel, Hodrick and Lu). Page supports them. Sharpe 0.78 and 0.87, standard deviation
   5.06 and 7.62, means 3.96 and 6.60 percent, drawdowns 12 percent (94 days) and 21.5 percent are all printed. They
   look scattered only because the drawdowns come from a later section, as the notes say.
4. betting-against-beta, result 0. Page supports it. Table III: BAB excess return 0.70 percent a month, volatility 10.7,
   Sharpe 0.78. The 8.4 percent annual return is 0.70 times 12, as the notes say. The script's own match for 8.4 was a
   coincidence elsewhere in the paper.
5. crypto-time-series-momentum, result 1 (Sharpe 0.37). Number is right but misleading. Table 17 shows 0.37 for the top
   quintile, but it is a weekly Sharpe ratio (about 2.7 if annualized). Result 0 (0.45) and
   crypto-google-search-attention (0.48) are weekly too. They sit in the same field as annual Sharpe ratios, so any
   comparison or median across the catalog (for example in docs/research/0007) mixes units.
6. fx-fomc-dollar-announcement, result 0 (Sharpe 0.51). Page supports it. The script's first hit was "-0.51bps", a
   coincidence, but the paper also says "an increase in the Sharpe ratio from 0.51 to 0.93".
7. managed-futures-trend-following, result 2 (volatility 12 percent). Page supports it. The script matched an unrelated
   0.12 coefficient, but the paper says the TSMOM factor "has an annualized volatility of 12% per year over the sample
   period 1985-2009".
8. pairs-trading-distance, result 0 (11 percent). The DOI page blocks scripts. The abstract (read through OpenAlex) says
   "average annualized excess returns of up to 11%". Supported, but it is an upper figure ("up to"), not an average.
9. Every Sharpe above 2. All are printed in their sources exactly as the catalog has them: finbert-gdelt-fx-sentiment
   5.87 (with 55.4 percent return and -15.6 percent drawdown in the same row of Table 1), crypto-perp-funding-carry 6.45
   and 2.24, llm-headline-sentiment 2.97, lstm-sequence-models 2.3365 (same column as its return, volatility and
   drawdown). The copying is right. Whether these numbers are believable is a separate question.
10. The catalog's own calculations (139 numbers, 35 results). Recomputed 15 results (60 numbers) from the Kenneth French
    files (HML, momentum, market) and the AQR time series momentum file with the method the notes describe. Every
    number matched to the printed precision. Not recomputed: AQR betting against beta, AQR Century of Factor Premia,
    Damodaran, dual momentum, turn of the month, Halloween and volatility-managed portfolios.

Other things found while checking:

- The three FTC links about Warrior Trading in docs/research/0006 return 404, also with a browser user agent. The claims
  they support currently have no working source.
- Carver's year 11 post is readable. It shows -16.3 percent, a 12.0 percent CAGR and a Sharpe of 0.76, so the
  "[unverified, from a search snippet]" note in docs/research/0003 can be dropped.
- Doc numbers the scan flagged as missing are supported in another form: ESMA prints "74-89%", and arXiv 2408.13214 says
  10.69 percent lower MAE (the doc says "about 10%").
- Crossref lists the first author of the 2003 AER paper (doi 10.1257/000282803321455151) as "Anderson". The repo's
  "Andersen" is correct. The registry is wrong.
- No two places cite the same paper with a different year or author, except where an entry's origin field names the
  original idea or the working paper year. In 7 entries (MACD, Bollinger, Ichimoku, FX technical rules, copy trading,
  crypto funding carry, pairs trading) origin.source_url links a later paper, not the originator.
