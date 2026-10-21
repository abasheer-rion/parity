# Sign-in and email

Everything about how people sign in to Parity and the emails they get. The reasons are in [DEC-0012](../docs/decisions/0012-sign-in-inside-the-app-uses-supabase-auth-behind-a-switch.md).

**Status: built, switched off.** The live site still uses only the Cloudflare login. Nothing here has been sent to Supabase yet. See [Switching it on](#switching-it-on).

## How it works

- Supabase Auth holds the accounts. It is part of the Supabase project we already use (`ttqvpxvctnomfbeoqbbs`).
- People sign in with email and password, or with a 6-digit code sent by email.
- An email must be confirmed before anyone can sign in.
- After sign-in, the app checks that the email is on the team list (`public.members`). The database checks the same list on every read, so someone not on the list sees nothing even if they get past the screen.
- Every email link goes to one page in the app, `#/auth/verify`, which asks for one click before it uses the link. Some mail filters (Outlook's Safe Links, for example) open every link to scan it, and that would use up a one-time link.
- In-app sign-in is off unless the site is built with `VITE_APP_AUTH=on`. When off, none of the sign-in code is downloaded.

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
| `auth/sql/` | Database changes for sign-in, not applied yet. |
| `web/src/auth/` | The app side: Supabase client, session hooks, the guard and the sign-in pages. |
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
| `{{ .ConfirmationURL }}` | Supabase's own link. We do not use it; our links go to `#/auth/verify` instead. |

Every link has the form `{{ .SiteURL }}/#/auth/verify?type=<type>&token_hash={{ .TokenHash }}`. `build.py` fails if an email uses a value its template does not have.

### Design rules

- Tables for layout and inline styles, so Gmail, Outlook and Apple Mail all show the same thing.
- Light by default. Apple Mail, iOS Mail and Outlook switch to our dark surfaces (`#10101a`, `#171721`) when the reader uses dark mode. Gmail applies its own dark mode, and every colour still reads after it does.
- One blue button (`#2f6bff`) per email, drawn twice: once for Outlook on Windows, once for everyone else.
- The logo is a PNG at `https://parity-research.pages.dev/brand/2026-10-21/parity-icon-dark.png` with alt text. Email apps block SVG and embedded images, so it must be a hosted PNG. The `/brand/` folder must stay reachable without the Cloudflare login.
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

- **Sign up:** email and password (at least 10 characters, letters and numbers). The app then shows "Check your email". The person clicks the link or types the code. Until then they cannot sign in.
- **Sign in with password:** if the email is not confirmed yet, the app sends them back to "Check your email".
- **Sign in with a code:** the app emails a code (`magic_link`). It does not create new accounts.
- **Forgot password:** email a link and code (`recovery`), then choose a new password at `#/auth/reset`.
- **Change email (Settings, Account):** both the old and new address get an email and both must confirm.
- **Change password (Settings, Account):** if the person has not signed in recently, Supabase emails a code (`reauthentication`) and the app asks for it.
- **Delete my account (Settings, Account):** files a request in `public.account_deletion_requests`. The owner deletes the account by hand in the Supabase dashboard.
- **Not on the team list:** the person can sign in but sees a page saying their email is not on the list, with a sign-out button.

## Switching it on

Owner steps, in order. Nothing here has been done yet.

1. **Create a Supabase access token.** Supabase dashboard, Account, Access Tokens, create one named `parity-auth-templates`. Store it in the Keychain and add its row to `~/.claude/CREDENTIALS.md`:

   ```sh
   security add-generic-password -s vault:supabase-access-token -a "$USER" -w
   ```

   (It prompts for the value, so it never lands in shell history.) The token can change any project you can see, so delete it when the switch-on is done.

2. **Pick an email provider and connect it** in Supabase, Authentication, Emails, SMTP Settings (see the next section). Until then only members of the Supabase organisation get emails, and only 2 an hour.

3. **Send the templates and settings:**

   ```sh
   auth/push_templates.sh                     # dry run: shows what would be sent
   auth/push_templates.sh --apply --settings  # sends templates, site URL, redirect list, password rules
   ```

   This sets the site URL to `https://parity-research.pages.dev`, allows redirects to it, its preview subdomains and `127.0.0.1:5173`, requires email confirmation, requires both addresses to confirm an email change, asks for a code before a password change, and sets passwords to at least 10 characters with letters and numbers. If your plan has it, also turn on the leaked-password check in Authentication, Policies.

4. **Apply the database change.** Copy `auth/sql/0001_verified_members_and_deletion_requests.sql` to `supabase/migrations/<timestamp>_auth_verified_members.sql` and merge it. The migrations workflow applies it. It makes the team-list check require a confirmed email and adds the deletion request table.

5. **Add yourself and the team to `public.members`** if they are not already there (lowercase emails).

6. **Turn on the switch.** In GitHub, Settings, Secrets and variables, Actions, Variables, add `APP_AUTH` = `on` and `SUPABASE_ANON_KEY` = the project's public anon key (Supabase, Project Settings, API). Both are public values, so variables, not secrets. The next deploy builds with sign-in on.

7. **Keep Cloudflare in front for now.** The research data is still copied into the site as files at deploy time, and only Cloudflare protects those files. Remove Cloudflare only after the data is read from the database instead.

To switch off again, delete the `APP_AUTH` variable and redeploy.

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
cd web && VITE_APP_AUTH=on VITE_SUPABASE_URL=http://127.0.0.1:54321 VITE_SUPABASE_ANON_KEY=<local anon key> npm run dev
```

Local Supabase reads `supabase/config.toml`, so it uses the templates in `auth/dist/` and the same rules as production. `supabase status` prints the local anon key.
