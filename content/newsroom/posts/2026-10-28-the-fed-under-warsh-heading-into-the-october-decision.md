+++
title = "The Fed under Warsh, heading into the October decision"
dek = "Kevin Warsh has chaired four Fed meetings since Jerome Powell's last in April: a hold, a split hold, the first hike since 2023 and today's decision. Markets price a hold. We registered our news-impact engine's calls before the statement."
slug = "the-fed-under-warsh-heading-into-the-october-decision"
date = 2026-10-28
type = "News"
stance = "Fact-based reporting"
status = "published"
authors = ["parity-markets-desk"]
tags = ["central-banks", "interest-rates", "news-impact"]
markets = ["Rates", "Stocks"]

[review]
generated_by = "Claude (Parity news-impact engine session)"
approved_by = "abanish"
approved_on = 2026-10-28

[[sources]]
id = "fomc-apr"
title = "FOMC statement, 29 April 2026"
url = "https://www.atlantafed.org/news-and-events/2026/04/29/fomc-statement"
publisher = "Federal Reserve Bank of Atlanta"

[[sources]]
id = "npr-jun"
title = "Federal Reserve holds interest rates steady and hints at rate hike later this year"
url = "https://www.npr.org/2026/06/17/nx-s1-5860084/fed-chief-warsh-first-fomc-meeting"
publisher = "NPR"

[[sources]]
id = "cnbc-jul"
title = "Fed rate decision July 2026: Divided Fed holds interest rates steady"
url = "https://www.cnbc.com/2026/07/29/fed-rate-decision-july-2026.html"
publisher = "CNBC"

[[sources]]
id = "presser-jul"
title = "Chair Warsh's press conference, 29 July 2026 (transcript)"
url = "https://www.federalreserve.gov/mediacenter/files/FOMCpresconf20260729.pdf"
publisher = "Federal Reserve"

[[sources]]
id = "cnn-sep"
title = "What Kevin Warsh said about the Fed's first rate hike since 2023"
url = "https://www.cnn.com/2026/09/16/economy/fed-rate-decision-september"
publisher = "CNN"

[[sources]]
id = "cnbc-cpi"
title = "CPI inflation report September 2026"
url = "https://www.cnbc.com/2026/10/14/cpi-inflation-report-september-2026.html"
publisher = "CNBC"

[[sources]]
id = "cnbc-jobs"
title = "Labor market faltered in September as jobs increased by just 29,000"
url = "https://www.cnbc.com/2026/10/02/jobs-report-september-2026.html"
publisher = "CNBC"

[[sources]]
id = "fattail"
title = "Warsh forward guidance: odds 60% on CPI, then 16%"
url = "https://fattail.ai/warsh-data-vs-fedspeak/"
publisher = "FatTail"

[[sources]]
id = "euronews"
title = "What to expect from the Fed as Warsh weighs hot inflation, oil and US midterms"
url = "https://euronews.com/2026/10/27/what-to-expect-from-the-fed-as-warsh-weighs-hot-inflation-oil-and-us-midterms"
publisher = "Euronews"

[[sources]]
id = "treasury"
title = "Daily Treasury par yield curve rates"
url = "https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?type=daily_treasury_yield_curve"
publisher = "US Treasury"

[[sources]]
id = "bauer-swanson"
title = "Monetary policy surprises (Bauer and Swanson), update to December 2023"
url = "https://www.frbsf.org/research-and-insights/data-and-indicators/monetary-policy-surprises/"
publisher = "Federal Reserve Bank of San Francisco"

[[sources]]
id = "call"
title = "Live call for the 28 October decision, registered before the statement"
url = "https://github.com/abasheer-rion/parity/blob/main/event-graph/calls/fed_2026-10-28.md"
publisher = "Parity"
+++

The Federal Reserve announces its decision at 2:00pm Eastern today, with Chair Kevin Warsh's press conference at 2:30pm. Futures price a 91% chance that the target range stays at 3.75% to 4.00%[^fattail].

## From Powell to Warsh

| Meeting | Chair | Decision | 2-year Treasury yield that day |
| --- | --- | --- | --- |
| 29 April | Powell (his last as chair) | Held at 3.50-3.75%, with dissents against keeping a bias toward cuts[^fomc-apr] | +0.08 |
| 17 June | Warsh (his first) | Held, 12-0; dropped the wording that pointed to cuts; nine officials saw a hike by year-end[^npr-jun] | +0.15 |
| 29 July | Warsh | Held, 9-3; Hammack, Kashkari and Logan dissented for a hike[^cnbc-jul] | −0.04 |
| 16 September | Warsh | Raised to 3.75-4.00%, 12-0, the first hike since 2023[^cnn-sep] | +0.07 |

Yield changes are from the Treasury's daily par curve[^treasury]. In July the 30-year yield rose to its highest since 2007 while the 2-year fell, and Warsh said he would not call the decision a "pause"[^presser-jul].

## What happened since September

- September consumer prices rose 3.7% from a year earlier, with gasoline up 9.1% on the month. Core prices rose 0.3% on the month, above the 0.2% expected[^cnbc-cpi].
- Employers added 29,000 jobs in September and unemployment rose to 4.2%[^cnbc-jobs].
- The futures-implied chance of an October hike fell from 72% on 28 September to about 9% by 27 October, after speeches by New York Fed President Williams, Vice Chair Jefferson and Governor Waller, and Warsh's remark in Bangkok that he does not "prejudge meetings"[^fattail].
- Brent crude fell more than 6% on Monday on hopes for Iran diplomacy, to about $111, against about $72 before the war began in late February. The midterm elections are on 3 November[^euronews].

## What our engine registered

Parity's news-impact engine replays past events blind and scores itself. We added 15 Fed decisions under Powell and Warsh, using each day's 2-year yield change as the surprise. The engine named the direction of 61 stock moves correctly and 51 wrongly. Homebuilders were right in 19 of 19, while the three Warsh meetings went 6 right and 15 wrong. The published 30-minute measure of Fed surprises agreed in sign with our measure on 6 of the 8 meetings it covers[^bauer-swanson].

Before today's statement we registered the engine's calls for three outcomes, and our own expectation of a small fall in the 2-year yield, about 0.03 points[^call]. The calls will be locked from the actual 2-year move before the close and scored after it, including the ones that turn out wrong.

> [!note] This is a record of what we registered, not advice. The engine's past record on Fed days is shown above, failures included.
