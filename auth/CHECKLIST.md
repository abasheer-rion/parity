# Sign-in: owner checklist

What the owner must do to finish the hosted sign-in setup, and a test to run once at the end. The code side is done: the pages, the emails, the tests and the push script. Only the owner can sign in to Supabase, so these steps wait for you.

Order matters. Connect the email sender **before** you turn email confirmation on, or new people cannot finish signing up.

## 1. Before you start

- [ ] The pull request that added this file is merged, and the deploy finished. Check that <https://parity.endyland.com/legal/> loads.
- [ ] Resend shows the domain `parity.endyland.com` as **Verified** (Resend dashboard, Domains). If it says Pending, wait for it. DNS records were added on 2026-10-21.
- [ ] The Resend key is in the Keychain as `resend-api-key`. It is already in `~/.claude/CREDENTIALS.md`. Check it is there without printing it:

  ```sh
  security find-generic-password -s resend-api-key >/dev/null && echo "found"
  ```

## 2. Make a Supabase access token

1. Sign in to the Supabase dashboard as the owner. Open **Account**, then **Access Tokens**, and create a token named `parity-auth-push`.
2. Store it in the Keychain. The command asks for the token, so it never lands in your shell history:

   ```sh
   security add-generic-password -s vault:supabase-access-token -a "$USER" -w
   ```

3. Add its row to `~/.claude/CREDENTIALS.md`: name `vault:supabase-access-token`, service Supabase, account (your Supabase login), purpose "push Parity auth settings and emails", location keychain, scope "full Management API access for the account", created (today), expiry (as set).

## 3. Push the email sender, the settings and the emails

1. See what will be sent. Nothing is sent yet:

   ```sh
   auth/push_templates.sh --smtp --settings
   ```

2. Send it all in one go:

   ```sh
   auth/push_templates.sh --apply --smtp --settings
   ```

   This first saves the current settings to `~/.config/parity/supabase-auth-backups/` (so the change can be undone), then sets:

   | Setting | Value |
   | --- | --- |
   | Email sender (SMTP) | `smtp.resend.com`, port 465, user `resend`, password from `resend-api-key` |
   | From | `Parity <no-reply@parity.endyland.com>` |
   | Email confirmation | **On** (`mailer_autoconfirm: false`) |
   | Site URL | `https://parity.endyland.com` |
   | Redirect allow-list | `https://parity.endyland.com/**`, `https://sim.endyland.com/**`, `https://trade.endyland.com/**`, `https://*.endyland.com/**`, the old `parity-research.pages.dev` addresses, and `http://127.0.0.1:5173/**`, `http://localhost:5173/**` |
   | Emails | the six templates and subjects in `auth/dist/` |
   | Rules | passwords of 10 or more characters with letters and numbers, 6-digit codes that last 60 minutes, authenticator apps on, both addresses confirm an email change, a code before a password change on an old session |
   | Email rate limit | 100 an hour |

3. It should end with "Sent." If Supabase answers with an error, nothing is confirmed as changed. Send me the message.

### If you prefer the dashboard

The same settings by hand, in the Supabase dashboard for project `ttqvpxvctnomfbeoqbbs`:

1. **Authentication, Emails, SMTP Settings:** turn on custom SMTP. Sender email `no-reply@parity.endyland.com`, sender name `Parity`, host `smtp.resend.com`, port `465`, username `resend`, password: the Resend key (`security find-generic-password -s resend-api-key -w | pbcopy`, paste, then copy something else).
2. **Authentication, Rate Limits:** emails sent per hour, 100.
3. **Authentication, Sign In / Providers, Email:** turn **Confirm email** on.
4. **Authentication, URL Configuration:** Site URL `https://parity.endyland.com`. Add each redirect URL from the table above.
5. **Authentication, Emails, Templates:** for each of the six emails, paste the subject and the body from `auth/dist/<name>.html`. The push script is quicker and cannot make a typo.

## 4. Switch off the old team-only login

Only after the test below passes. In the Cloudflare dashboard, Zero Trust, Access, Applications: remove the application that covers `parity.endyland.com` (and `parity-research.pages.dev`). Write down its settings first so it can be put back. The site's own sign-in check then takes over, and the `CF_Authorization` cookie stops being set.

## 5. Test it once, end to end

Use an inbox you can read, for example `you+parity1@gmail.com`. Use a private window so old cookies do not interfere. Tick each line.

### Sign up and verify

- [ ] Open <https://parity.endyland.com/>. A small cookie notice shows at the bottom left. Click **Preferences**: Essential is on and locked, Analytics is off and cannot be turned on. Click **Cancel**, then **OK**. The notice goes away and does not come back on reload.
- [ ] Click **Sign up**. Type the email, click **Continue**, then type a password like `short`. The rules under the password stay unticked, and Create account says "Use at least 10 characters."
- [ ] Use a real password, tick the agreement box, and click **Create account**. You see "Check your email".
- [ ] The email arrives within a minute, from `no-reply@parity.endyland.com`, subject "Confirm your email for Parity", with the Parity logo.
- [ ] Click **Confirm my email**. It opens `https://parity.endyland.com/verify/...`. Click **Confirm and continue**. You land in the app at `/app/`.

### Log out and log in

- [ ] Open the account menu (bottom of the sidebar) and choose **Sign out**. You are on the log-in page.
- [ ] Log in with a wrong password. You see "That email and password do not match."
- [ ] Log in with the right password. You land in the app.
- [ ] Sign out. Type your email, click **Continue**, then **Email me a code instead**, and type the 6 digits from the email. You land in the app.

### Verify by code, and resend

- [ ] Sign out. Sign up again with a second address (`you+parity2@...`). On "Check your email", click **Send the email again**. Only the newest email works.
- [ ] Type the 6-digit code from the newest email instead of clicking the link. You land in the app.

### Forgot password

- [ ] Sign out. Click **Forgot your password?**, enter the first address, and send. The email "Reset your Parity password" arrives.
- [ ] Click its button, then **Continue**. Choose a new password (type it twice). You land in the app.
- [ ] Sign out and log in with the new password. It works, and the old one does not.

### Two-step sign-in

- [ ] In Settings, Account, click **Set up an authenticator app**. Scan the QR code with 1Password, Google Authenticator or Authy, type the code, and click **Turn on**.
- [ ] Sign out and log in. After the password, it asks for the authenticator code. A wrong code says so. The right code lets you in.
- [ ] In Settings, Account, click **Remove**, then **Yes, turn off two-step**. Signing in no longer asks for a code.

### Account settings

- [ ] **Change email** to `you+parity3@...`. Both the old and the new address get an email. Confirm both (link or code). The page then shows the new address.
- [ ] **Change password.** If it asks for a code, one arrives by email. After saving, the new password works.
- [ ] **Request deletion.** It says "Requested on (today)". The request appears in the Supabase table `account_deletion_requests`. Delete the test users by hand in Authentication, Users when you are done.

### Sim World and the other side

- [ ] While signed in on parity.endyland.com, open <https://sim.endyland.com/>. Sim World opens without asking you to log in again.
- [ ] Sign out, then open <https://sim.endyland.com/> again. You see the log-in page on `sim.endyland.com`. Log in. You come back to Sim World, not to the app.
- [ ] Signed out, open <https://parity.endyland.com/research/>. Log in. You land on the research side.

### Safety checks

- [ ] Open <https://parity.endyland.com/login/?next=https://example.com/> while signed in. You go to `/app/`, never to example.com.
- [ ] Open <https://parity.endyland.com/data/latest.json> in a private window. It answers "Sign in to see this."

### Legal pages

- [ ] The footer of the front page, the log-in page and the app's account menu link to Privacy, Terms, Cookies, Accessibility and Risk. Each page shows "Draft for lawyer review" and a date.
- [ ] Fill in the parts marked in yellow on those pages: the operator's legal name and address, a contact email, the governing law, and the Supabase region and backup period. Then have a lawyer review them.

## If something goes wrong

- **No emails arrive:** check Resend, Logs. If Supabase cannot send, turn **Confirm email** off in the dashboard (Authentication, Sign In / Providers, Email) so people can still sign up, then tell me.
- **A link goes to the wrong address:** check the Site URL and the redirect list in Authentication, URL Configuration.
- **Undo everything:** the file saved in `~/.config/parity/supabase-auth-backups/` holds the old settings. Send it to me and I will put them back.
