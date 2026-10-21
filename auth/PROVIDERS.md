# Google, GitHub and passkeys

How to switch on the extra ways to sign in. The buttons and settings are built; each one stays hidden until its steps below are done. Nothing here has been created yet.

What Supabase supports today (checked 2026-10-21):

| Option | Supabase support | In Parity |
| --- | --- | --- |
| Google, GitHub, Apple, Microsoft sign-in | Supported (OAuth) | Buttons built, hidden until listed in `AUTH_PROVIDERS` |
| Authenticator apps (two-step sign-in) | Supported (TOTP), free | On. Settings, Account, Two-step sign-in |
| Passkeys (Face ID, Touch ID, Windows Hello) as the main sign-in | Experimental: "The API may change without notice" ([Supabase passkeys](https://supabase.com/docs/guides/auth/passkeys)) | Built, hidden until `AUTH_PASSKEYS=on` |
| Passkeys as a second step | Not offered by Supabase today | Not built |

Every provider sends people back to the same Supabase address:

```
https://ttqvpxvctnomfbeoqbbs.supabase.co/auth/v1/callback
```

Treat each client secret like any other key: store it in the Keychain, add its row to `~/.claude/CREDENTIALS.md`, and paste it only into the Supabase dashboard.

## Google

1. Open the [Google Cloud console](https://console.cloud.google.com/) and pick or create a project named `parity`.
2. APIs and Services, OAuth consent screen (Google Auth Platform, Branding). App name `Parity`, support email yours. Audience: External. Scopes: `openid`, `email`, `profile` only. Publish the app when you want people outside your test users to sign in.
3. APIs and Services, Credentials, Create credentials, OAuth client ID.
   - Application type: Web application. Name: `Parity Supabase`.
   - Authorised JavaScript origins: `https://parity-research.pages.dev`
   - Authorised redirect URIs: `https://ttqvpxvctnomfbeoqbbs.supabase.co/auth/v1/callback`
4. Create. Copy the Client ID and the Client secret.
5. Supabase dashboard, project `ttqvpxvctnomfbeoqbbs`, Authentication, Sign In / Providers, Google. Turn it on, paste the Client ID and Client secret, save.

## GitHub

1. GitHub, Settings, Developer settings, OAuth Apps, New OAuth App.
   - Application name: `Parity`
   - Homepage URL: `https://parity-research.pages.dev`
   - Authorization callback URL: `https://ttqvpxvctnomfbeoqbbs.supabase.co/auth/v1/callback`
2. Register application, then Generate a new client secret. Copy the Client ID and the secret.
3. Supabase dashboard, Authentication, Sign In / Providers, GitHub. Turn it on, paste both, save.

Apple and Microsoft (`azure`) follow the same pattern with their own consoles; their buttons are in the list too.

## Show the buttons

GitHub repository, Settings, Secrets and variables, Actions, Variables: add `AUTH_PROVIDERS` with the providers you turned on, for example `google,github`. The next deploy shows "Continue with Google" and "Continue with GitHub" on the log-in and sign-up pages. Only list a provider after it is on in Supabase, or the button will fail.

After a provider sign-in, people come back to `/login/`, which finishes signing in and sends them to `/app/`. That address is already allowed by the redirect list in `auth/push_templates.sh --settings`.

## Passkeys

Experimental in Supabase, so treat it as a trial.

1. Supabase dashboard, Authentication, find Passkeys (it may sit under Sign In / Providers or Advanced while experimental). Turn it on with:
   - Relying party name: `Parity`
   - Relying party ID: `parity-research.pages.dev`
   - Origins: `https://parity-research.pages.dev`
   If the dashboard has no switch yet, set the same values in `[auth.passkey]` and `[auth.webauthn]` in `supabase/config.toml` and push them with `supabase config push` while logged in to the CLI.
2. Add the GitHub variable `AUTH_PASSKEYS` = `on`.
3. After the deploy, people add a passkey in Settings, Account, Passkeys, and can then use "Use a passkey" on the log-in page.

A passkey only works on the site name it was made for. Moving to a custom domain later means people add their passkeys again.

## Authenticator apps

Already on in the code. `auth/push_templates.sh --apply --settings` makes sure the hosted project allows them (`mfa_totp_enroll_enabled`, `mfa_totp_verify_enabled`). Nothing else to set up.
