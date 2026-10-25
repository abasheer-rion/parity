# Sign-in and email

Everything about how people sign in to Parity and the emails they get. The reasons are in [DEC-0012](../docs/decisions/0012-open-sign-up-with-supabase-auth-replaces-the-cloudflare-login.md).

**Status:** anyone can sign up. The code expects email confirmation on, with Resend as the sender. The hosted project still needs the owner to push those settings: follow [CHECKLIST.md](CHECKLIST.md), which also has the one-time end-to-end test.

## How it works

- `/` is a public front page. `/login/`, `/signup/`, `/reset/` and `/verify/` are public sign-in pages, and `/legal/` holds the legal pages. The product app (`/app/`), the research app (`/research/`), Sim World (`/sim/`, or `sim.endyland.com`), Parity Trade (`/trade/`, or `trade.endyland.com`), Parity Academy (`/academy/`, or `academy.endyland.com`) and Parity Workbench (`/lab/`, or `lab.endyland.com`) need a session, and all six use the same guard.
- After signing in, people go back to where they started (`?next=`). Only addresses on this site or on `https://*.endyland.com` are followed; anything else goes to `/app/` (`web/src/auth/redirect.ts`, tested in `web/tests/redirect.test.ts`).
- Supabase Auth holds the accounts. People log in with email and password, a 6-digit email code, Google or GitHub (when switched on), or a passkey (when switched on). Accounts can add an authenticator app for two-step sign-in.
- The browser keeps the session in a cookie. A Cloudflare Pages function (`web/functions/_middleware.ts`) checks that cookie's token against Supabase's public keys before it serves anything under `/app/` or `/data/`. No secret is needed for that check. Without a valid session, `/app/` sends you to `/login/` and `/data/` answers 401.
- The database lets any signed-in person read published research. The team list (`public.members`) now only gives a "Parity team" badge in Account settings.
- Every email link goes to `/verify/`, which asks for one click before it uses the link. Some mail filters open every link to scan it, and that would use up a one-time link.
- Known limit: the middleware checks that you are signed in, not that you finished two-step sign-in. The app itself asks for the second step before it shows anything.

## What is where

| Path | What it is |
| --- | --- |
| `auth/emails/<name>.html` | The body of each email, made of parts. Starts with its subject and preview line. |
| `auth/emails/<name>.txt` | The plain-text version of the same email. |
| `auth/emails/_layout.html` | The frame every email sits in: logo, card, footer, dark mode colours. |
| `auth/emails/partials/` | Reusable parts: heading, paragraph, note, button, code box, fallback link, divider, header, footer. |
| `auth/build.py` | Puts each body in the layout and writes the finished emails. Also checks them. |
| `auth/dist/` | The finished emails. Generated: do not edit by hand. |
| `auth/preview.html` | Every email in light, dark and plain text, with sample values. Generated. |
| `auth/push_templates.sh` | Sends the finished emails (and optionally the settings) to Supabase. |
| `auth/PROVIDERS.md` | How to switch on Google, GitHub and passkeys. |
| `auth/CHECKLIST.md` | The owner's steps to finish the hosted setup, and the end-to-end test. |
| `web/tests/` | Tests for the sign-in flows against a fake Supabase client, the redirect rules, the consent API and the middleware. `npm test` in `web/`. |
| `web/legal/`, `web/src/legal/` | The legal pages, the cookie notice and the consent API (`consent.ts`). |
| `web/src/auth/` | The browser side: Supabase client, session hooks, the app guard, the sign-in pages (entry `main.tsx`) and Account settings. |
| `web/functions/_middleware.ts` | Lets only signed-in people fetch `/app/` and `/data/`. `web/public/_routes.json` limits it to those paths. |
| `web/index.html` | The public front page: plain HTML and CSS, no script. |
| `supabase/config.toml` | The `[auth]` section: sign-in rules and where each template lives. Drives local Supabase only. |

## The emails

The file name is the template's name in Supabase, so one word is used everywhere.

| Name | Sent when | Subject | What the person does |
| --- | --- | --- | --- |
| `confirmation` | Someone signs up | Confirm your email for Parity | Clicks the button, or types the code on the sign-up screen |
| `magic_link` | Someone asks for a sign-in code | Your Parity sign-in code | Types the code, or clicks the button |
| `recovery` | Someone forgets their password | Reset your Parity password | Clicks the button or types the code, then picks a new password |
| `email_change` | A signed-in person changes their email | Confirm your new email for Parity | Confirms from both the old and the new address |
| `invite` | The owner invites someone from the Supabase dashboard | You are invited to Parity | Accepts, then picks a password |
| `reauthentication` | Someone changes their password and must prove it is them | Your Parity confirmation code | Types the code in Settings |

The emails use these Supabase values ([Supabase email templates](https://supabase.com/docs/guides/auth/auth-email-templates)):

| Value | Meaning |
| --- | --- |
| `{{ .Token }}` | The 6-digit code |
| `{{ .TokenHash }}` | A hashed version of the code, used in our links |
| `{{ .SiteURL }}` | The site address set in Supabase |
| `{{ .Email }}` | The person's email |
| `{{ .NewEmail }}` | The new address (email change only) |
| `{{ .ConfirmationURL }}` | Supabase's own link. We do not use it; our links go to `/verify/` instead. |

Every link has the form `{{ .SiteURL }}/verify/?type=<type>&token_hash={{ .TokenHash }}&next={{ .RedirectTo }}`. `{{ .RedirectTo }}` is the address the person started from (for example `https://sim.endyland.com/`), passed by the browser as a plain address with no query. Supabase only keeps it when it is on the redirect allow-list, and otherwise uses the Site URL. `/verify/` checks it like every other `next`. `build.py` fails if an email uses a value its template does not have.

### Design rules

- Tables for layout and inline styles, so Gmail, Outlook and Apple Mail all show the same thing.
- Light by default. Apple Mail, iOS Mail and Outlook switch to our dark surfaces (`#10101a`, `#171721`) when the reader uses dark mode. Gmail applies its own dark mode, and every colour still reads after it does.
- One blue button (`#2f6bff`) per email, drawn twice: once for Outlook on Windows, once for everyone else.
- The logo is a PNG at `https://parity.endyland.com/brand/2026-10-21-starburst/parity-icon-dark.png` with alt text. Email apps block SVG and embedded images, so it must be a hosted PNG. The `/brand/` folder is public.
- Each email stays under 100 kB (Gmail cuts off longer ones). `build.py` checks.

## Changing an email

1. Edit `auth/emails/<name>.html` (and the `.txt` next to it). For a part used by every email, edit `auth/emails/partials/` or `_layout.html`.
2. If you change a subject, change it in `supabase/config.toml` too. `build.py` fails until they match.
3. Run `python3 auth/build.py` (or `make auth`).
4. Open `auth/preview.html` in a browser and look at every email in light and dark.
5. Commit the sources and `auth/dist/` together. CI runs `python3 auth/build.py --check` and fails if `dist` is out of date.
6. After the change reaches main, send it to Supabase with `auth/push_templates.sh --apply`.

Parts are included with `[[> button url="..." label="..." ]]`. Inside a part, `[[ label ]]` is replaced by the argument. This never clashes with Supabase's `{{ }}`.

Supabase sends only the HTML version today. The plain-text files are kept so the wording is reviewed in one place, and for when we send through our own email provider.

## Flows

- **Sign up:** email and password (at least 10 characters, letters and numbers, shown as a checklist while typing, with Show and Hide), agreement to the terms, or Google or GitHub. With confirmation on, they see "Check your email" and confirm by link or code, then land where they started. With it off, they go straight in.
- **Log in:** password, an emailed code (`magic_link`, existing accounts only), a provider or a passkey. Then `/app/`, or the page they were trying to open.
- **Two-step sign-in (Settings, Account):** scan a QR code with an authenticator app and type its code. From then on, logging in asks for a code from the app too. Remove it from the same place.
- **Passkeys (Settings, Account):** add or remove passkeys once they are switched on (`auth/PROVIDERS.md`).
- **Forgot password (`/reset/`):** email a link and code (`recovery`), then choose a new password.
- **Change email or password (Settings, Account):** both addresses confirm an email change; a password change may ask for an emailed code (`reauthentication`).
- **Delete my account (Settings, Account):** files a request in `public.account_deletion_requests`. The owner deletes the account by hand in the Supabase dashboard.

## What the owner must do

Everything is in [CHECKLIST.md](CHECKLIST.md): make a Supabase access token, run `auth/push_templates.sh --apply --smtp --settings` (Resend as the sender, confirmation on, site URL `https://parity.endyland.com`, the redirect allow-list and the emails), test once end to end, then switch off Cloudflare Access. Google, GitHub and passkeys are optional, in [PROVIDERS.md](PROVIDERS.md).

## Email providers

Supabase's own sender is for testing: it only delivers to members of the Supabase organisation and sends 2 emails an hour ([Supabase custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)). With a provider connected, Supabase starts at 30 emails an hour; raise it in Authentication, Rate Limits. Every option needs a sending domain we own (for example `mail.endyland.com`) with the DNS records the provider gives.

| Provider | Free | First paid step | Notes |
| --- | --- | --- | --- |
| [Resend](https://resend.com/pricing) | 3,000 a month, 100 a day | $20 a month for 50,000 | Simplest to set up, listed by Supabase |
| [Postmark](https://postmarkapp.com/pricing) | 100 a month (testing) | $15 a month for 10,000 | Best known for landing in the inbox |
| [Cloudflare Email Service](https://developers.cloudflare.com/email-service/platform/pricing/) | Only to verified addresses on the free plan | Workers Paid ($5 a month) includes 3,000, then $0.35 per 1,000 | SMTP at `smtp.mx.cloudflare.net:465`, user `api_token`, password an API token with Email Sending: Edit. Keeps DNS and email in one place |

Prices checked on 2026-10-21. Our recommendation for now: Resend's free plan. It covers a research team many times over, and moving later only means changing the SMTP settings.

## Local development

```sh
supabase start                                   # local Supabase; emails appear at http://127.0.0.1:54324
cd web && VITE_SUPABASE_URL=http://127.0.0.1:54321 VITE_SUPABASE_ANON_KEY=<local anon key> npm run dev
```

`npm run dev` serves the front page, the sign-in pages and the app (`/app/`) from one server; the middleware only runs on Cloudflare. Without the two variables, dev talks to the hosted project. Local Supabase reads `supabase/config.toml`, so it uses the templates in `auth/dist/` and the same rules as production. `supabase status` prints the local anon key.
