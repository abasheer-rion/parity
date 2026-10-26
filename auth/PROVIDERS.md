# Google, Apple, phone and passkeys

How to switch on the extra ways to sign in. Nothing here has been created yet: no OAuth client, no key, no Supabase setting. Each button stays hidden until its steps are done.

Checked against the Supabase docs on 2026-10-25.

| Option | Possible | Cost | In Parity today |
| --- | --- | --- | --- |
| Continue with Google | Yes | Free | Button built, hidden until `AUTH_PROVIDERS` lists `google` |
| Sign in with Apple | Yes | Apple Developer Program, $99 a year | Button built, hidden until `AUTH_PROVIDERS` lists `apple` |
| Phone number with a text code | Yes | About $0.012 to $0.013 per US text on Twilio, or about $0.058 per code on Twilio Verify, plus a number and US texting registration | Not built. About a day of work once a provider is chosen |
| Passkeys (Face ID, Touch ID, Windows Hello) as the sign-in | Yes, marked experimental by Supabase | Free | Button built, hidden until `AUTH_PASSKEYS=on` |
| Authenticator apps (two-step sign-in) | Yes | Free | On. Settings, Account, Two-step sign-in |
| GitHub, Microsoft | Yes | Free | Buttons built, hidden |

Every provider sends people back to the same Supabase address:

```
https://ttqvpxvctnomfbeoqbbs.supabase.co/auth/v1/callback
```

Treat each client secret like any other key: store it in the Keychain, add its row to `~/.claude/CREDENTIALS.md`, and paste it only into the Supabase dashboard.

## Google

1. Open the [Google Cloud console](https://console.cloud.google.com/) and pick or create a project named `parity`.
2. Google Auth Platform, Branding: app name `Parity`, support email yours, home page `https://parity.endyland.com`, privacy policy `https://parity.endyland.com/legal/privacy/`, terms `https://parity.endyland.com/legal/terms/`. Authorised domain: `endyland.com`.
3. Audience: External. Data Access: scopes `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile` only. Publish the app when people outside your test users should sign in. These scopes need no Google review.
4. Clients, Create client:
   - Application type: Web application. Name: `Parity Supabase`.
   - Authorised JavaScript origins: `https://parity.endyland.com`
   - Authorised redirect URIs: `https://ttqvpxvctnomfbeoqbbs.supabase.co/auth/v1/callback`
5. Create. Copy the Client ID and the Client secret.
6. Supabase dashboard, project `ttqvpxvctnomfbeoqbbs`, Authentication, Sign In / Providers, Google. Turn it on, paste the Client ID and Client secret, save.
7. Show the button (below).

The desktop app: Google refuses sign-in inside an app's own window ([Google OAuth policy](https://developers.google.com/identity/protocols/oauth2/policies)). The button already opens Google in the system browser and comes back through `parity://login/` (`web/src/auth/pages/Providers.tsx`). Add `parity://**` to Authentication, URL Configuration, Redirect URLs before turning Google on, or the desktop app falls back to the site address.

Docs: [Login with Google](https://supabase.com/docs/guides/auth/social-login/auth-google), [Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls).

## Apple

Needs a paid Apple Developer account ($99 a year).

1. [Apple Developer](https://developer.apple.com/account/), Certificates, Identifiers and Profiles, Identifiers. Create an App ID with Sign in with Apple turned on.
2. Create a Services ID, for example `com.endyland.parity.web`. Turn on Sign in with Apple and configure it:
   - Domains: `ttqvpxvctnomfbeoqbbs.supabase.co`
   - Return URL: `https://ttqvpxvctnomfbeoqbbs.supabase.co/auth/v1/callback`
3. Keys: create a key with Sign in with Apple. Download the `.p8` file once and store it in the Keychain. Note the Key ID and your Team ID.
4. Services, Sign in with Apple for Email Communication: register `no-reply@parity.endyland.com`, so emails reach people who hide their address.
5. Make the client secret from the key (the Supabase Apple page has a tool for it). Supabase dashboard, Authentication, Sign In / Providers, Apple: turn it on, enter the Services ID as the client ID, and the secret.
6. The secret expires after 6 months. Put a reminder in the calendar to make a new one, or Apple sign-in stops.
7. Show the button (below).

Docs: [Login with Apple](https://supabase.com/docs/guides/auth/social-login/auth-apple).

## Show the buttons

GitHub repository, Settings, Secrets and variables, Actions, Variables: add `AUTH_PROVIDERS` with the providers you turned on, for example `google,apple`. The next deploy shows "Continue with Google" and "Continue with Apple" on log in and sign up. Only list a provider after it is on in Supabase, or the button fails.

After a provider sign-in, people come back to `/login/`, which finishes signing in and sends them on. That address is already allowed by the redirect list in `auth/push_templates.sh --settings`.

## Phone number

Supabase sends the text through a provider you pay: Twilio, Twilio Verify, MessageBird or Vonage (TextLocal is community supported). Prices checked 2026-10-25:

- Twilio: $0.0083 per text plus a carrier fee of about $0.0035 to $0.005, so about $0.012 to $0.013 per US text. A number is $1.15 a month. US texting needs A2P 10DLC registration (a one-off brand and campaign fee, then a monthly fee; we could not load the current amounts, so check them on Twilio).
- Twilio Verify: about $0.05 per successful code plus $0.0083 per text, about $0.058 per sign-in. Twilio handles the sender registration.

Steps:

1. Open a Twilio account. For plain Twilio, buy a number and finish the 10DLC registration. For Twilio Verify, create a Verify service.
2. Supabase dashboard, Authentication, Sign In / Providers, Phone: pick the provider, enter its account SID, auth token and the number or Verify service ID.
3. Authentication, Attack Protection: turn on CAPTCHA and keep the text rate limit low, so nobody runs up the bill.
4. Ask for the phone form to be built. It uses `signInWithOtp({ phone })` and `verifyOtp({ phone, token, type: "sms" })`.

Docs: [Phone login](https://supabase.com/docs/guides/auth/phone-login), [Twilio US SMS pricing](https://www.twilio.com/en-us/sms/pricing/us), [Twilio Verify pricing](https://www.twilio.com/en-us/verify/pricing).

## Passkeys (Face ID, Touch ID)

Face ID and Touch ID on Apple devices, and Windows Hello, are passkeys. Supabase supports a passkey as the whole sign-in, with no password, but marks the feature experimental: "The API may change without notice". It is not offered as a second step after a password.

1. Supabase dashboard, Authentication, Passkeys: turn it on with
   - Relying party name: `Parity`
   - Relying party ID: `parity.endyland.com`
   - Origins: `https://parity.endyland.com`
   The relying party ID can never change later: every saved passkey stops working if it does.
2. Add the GitHub variable `AUTH_PASSKEYS` = `on`.
3. After the deploy, people add a passkey in Settings, Account, Passkeys, and can then use "Use a passkey" on log in. A passkey is added to an account that already exists and is confirmed.

The installed supabase-js has the passkey calls on by default (`signInWithPasskey()`, `registerPasskey()`), so no code change is needed. In the desktop app, Touch ID through Electron is reported to work from Electron 42 but is not tested here.

Docs: [Passkeys](https://supabase.com/docs/guides/auth/passkeys).

## Authenticator apps

Already on in the code. `auth/push_templates.sh --apply --settings` makes sure the hosted project allows them (`mfa_totp_enroll_enabled`, `mfa_totp_verify_enabled`). Nothing else to set up.
