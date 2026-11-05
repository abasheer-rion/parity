# Sample pages for reading claims

Small text files used by `web/tests/verify/claims-page.test.ts` (DEC-0088). None is a copy of
a real page: the words and numbers are made up, so nothing here belongs to anyone else. Where a
file copies the layout of a real kind of page, the source and what was changed are below.

| File | What it is | Source of the layout | Changed |
| --- | --- | --- | --- |
| `mql5-signal.html` | A trading signal's statistics page | The public MQL5 Signals pages (`https://www.mql5.com/en/signals/<id>`), seen on 3 November 2026; their robots.txt allows these pages | Kept the labels and number formats ("Growth:", "Profit Trades: 481 (68.52%)", "1 981.71 USD", "2024.12.30", "Relative drawdown: By Balance:"). Every name, number and date is made up. The markup is our own, much shorter. |
| `sales-page.html` | A bot's sales page | None: written for the tests in the style of common expert-advisor sales pages | All made up. Includes broker conditions, a refund period and "No martingale, no grid", which must not read as claims. |
| `post.txt` | A post someone pastes from a social network | None | All made up. X's robots.txt allows no automatic readers, so posts are pasted, never fetched. |
| `stats-page-copied.txt` | Text a person copies from a statistics page with labels such as "Gain", "Abs. Gain", "Monthly", "Drawdown", "Profitability" | None seen live: the best-known site of this kind shows a check for automatic visitors, so we never fetched one | All made up, including the labels' layout. |
| `signal-channel.txt` | A signals channel's message | None | All made up. |
| `noise.html` | A page of broker conditions | None | Leverage, commission, spreads, a forecast and risk per trade: none is a performance claim. |
| `scripted-shell.html` | A page that fills in its numbers with scripts after it opens | The shape of a Next.js page, seen on a public account page that robots.txt allows (3 November 2026) | Only the empty shell, with made-up words. |

When a new kind of page is added, copy its layout with made-up numbers, keep the file small, and
add a row here.
