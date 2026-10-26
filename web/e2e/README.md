# E2E suite

Playwright tests for every Parity app, run against the built site (`web/dist`), served by
`e2e/server.ts` the way Cloudflare Pages and `functions/_middleware.ts` serve it. Two
sizes: desktop (1440x900) and phone (390x844). Headless only.

Nothing leaves the machine. Supabase is a stand-in inside the browser (`e2e/supabase.ts`),
with a made-up signed-in user and an in-memory database. `/data/` is served from small
fixtures (`e2e/data.ts`). Google Fonts is answered from `e2e/fonts`, so pages lay out with
the real fonts on any machine. Every other outside address gets an empty answer.

Any console error or warning, uncaught exception, HTTP error or failed request fails a test
(`e2e/fixtures.ts`). A test that expects one says so with `expectConsole` or `allowHttp`.

## Run it

```sh
cd web
npm ci
npx playwright install chromium
npm run build
npm run e2e                                   # everything
npm run e2e -- --project=desktop e2e/trade    # one size, one file
npm run e2e -- -g "order ticket"              # by name
```

Never use `--headed`, `--ui`, `--debug` or `show-report`: they open windows. On a failure,
read `test-results/<test>/error-context.md` and the screenshot next to it.

## What is where

| File | What it checks |
|---|---|
| `routes.spec.ts` | Every route of every app: loads, real text, no NaN, no sideways scroll, no text that collides or is cut off, charts draw (axe runs in `scripts/a11y.mjs`) |
| `auth.spec.ts` | Log in, sign up, reset, the email link page, log out, the sign-in wall |
| `nav.spec.ts` | Menus, deep links, Copy link, the back button, not found pages |
| `site.spec.ts` | Front page, cookie notice, legal pages, blog, news, glossary, ideas, notes |
| `app.spec.ts` | Product side: search, account menu, Discover, strategy page, Verify, settings |
| `research.spec.ts` | Catalog, algorithm report, bibliography |
| `sim.spec.ts`, `trade.spec.ts`, `academy.spec.ts`, `lab.spec.ts` | Each app's main flows |
| `visual.spec.ts` | Screenshots of key screens, compared with `__screenshots__/` |

Fixture options: `test.use({ signedIn: false })` for a visitor, `tours: true` for the
first-run tours, `consent: false` for the cookie notice.

## Screenshot baselines

Baselines are made on Linux by CI, because text is smoothed differently on a Mac. Locally the
visual tests skip (set `E2E_VISUAL=1` to run them anyway). They also skip when a baseline
is missing, until it is made.

To make or refresh them:

1. Push a commit with `[update-baselines]` in its message, or run the "E2E baselines"
   workflow by hand (`gh workflow run e2e-baselines.yml --ref <branch>`).
2. Download them: `gh run download <run id> -n e2e-screenshots -D web/e2e/__screenshots__`
3. Look at the images, then commit them.

## CI

The `e2e` job in `.github/workflows/ci.yml` builds once, then runs the suite in four
shards. A failed shard uploads its HTML report and test results as an artifact.
