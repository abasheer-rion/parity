---
id: DEC-0044
title: One sign-in panel that fades in over the front page
type: decision
status: accepted
created: 2026-10-24
updated: 2026-10-25
authors: [ayan]
tags: [ui]
related: [DEC-0039, DEC-0038, REF-0017]
---

# One sign-in panel that fades in over the front page

## In plain words

Log in and Sign up no longer open a separate page with red glows behind a card. On the front page, clicking either one fades the page out. The dark background stays where it is, and one sign-in panel fades in over it. Back, Escape or the logo fade the panel out and the page back in. The address says which form is open (`/#login`, `/#signup`, `/#reset`), so links and the back button work. `/login/`, `/signup/`, `/reset/` and `/verify/` still work on their own and show the same panel on the same background.

The panel asks for the email first, then the password, with "Email me a code instead" under it. Log in, sign up and reset switch in place: the step fades and the panel's height follows the content, so nothing jumps. Errors show under the field they are about. Buttons show a spinner while they work. It uses the front page's buttons, glass, type and colours.

## Context

The owner, on 24 October 2026: "login and sign up is bad, get rid of the orbs, just make the fade out of main screen, keep same background, and now show a better login and/or sign up element, that's more consistent". The sign-in pages restyled in [DEC-0039](0039-a-front-page-for-verify-dark-glass-and-scroll-scenes.md) were separate pages with their own orbs, a Password / Email code switch and their own copy of the buttons.

## Decision

1. **One element.** `web/src/auth/AuthFlow.tsx` holds log in, sign up, reset and verify. It runs in two places: the front page's panel (`src/auth/front.tsx`, loaded by `src/site/main.ts` on hover, focus or click of Log in and Sign up) and the stand-alone pages (`src/auth/main.tsx`).
2. **The fade.** The front page adds `auth-open` to `<html>`. The page's content, footer and corner controls fade out in 0.22 s; the panel fades and rises in after it. The backdrop (its colour and grain) never moves. Its red glow fades out, so the sign-in view has no orbs. The stand-alone pages have the same backdrop without the glow. The hero field stops while the panel is open.
3. **Addresses.** A click pushes `#login` or `#signup`, so Back closes the panel. Switching forms inside it replaces the entry. On the stand-alone pages a switch replaces the address with that form's page and keeps `?next=` ([DEC-0038](0038-every-page-gets-its-tags-from-one-table-and-every-view-has-a-link.md)). The links keep real `/login/` and `/signup/` addresses, so they work with no script, in a new tab, or if the panel cannot load.
4. **The steps.** Email, then password (with "Forgot password?" beside its label and "Email me a code instead" under it) or a one-time code. Sign up: email, then a password with its rules and the terms, then "Check your email". The email typed carries between forms. A hidden username field keeps password managers matching the right account. No provider buttons show until one is switched on ([auth/PROVIDERS.md](../../auth/PROVIDERS.md)).
5. **One look.** `web/src/site/kit.css` holds the colours, backdrop, glass, corner logo and `.btn`. The build inlines it on the front page and on the four sign-in pages (`<!--site-kit-->`), so the panel's buttons are the hero's buttons and the first frame is already dark.
6. **Accessibility.** On the front page the panel is a modal dialog: the page behind it is hidden from screen readers and the keyboard, focus moves to the first field on open and back to the link that opened it on close, and Escape closes it. Errors are announced and linked to their field. Reduced motion turns every fade, rise and height change off.
7. **Behaviour unchanged.** Every Supabase call, the email confirmation, the code, the reset, the authenticator step, the cookie on `.endyland.com`, the error wording and the safe `next` stay as they were. Two hops now happen in place: an unconfirmed log-in opens "Check your email", and a reset or invite link opens the new-password form.
8. **Checks.** `npm test` covers the flows; `npm run auth:panel` drives the panel in a browser with every Supabase request stubbed; `npm run auth:shots` writes screenshots; the layout shift audit now includes the front page, `/#login`, `/#signup` and the sign-in pages.

## Update 2026-10-25: no box, links at the bottom, Forgot password

The owner, on 25 October 2026: "move these hyperlinks to the very bottom and greyed out. Also i dont like the sign in page, i think i dont like the box, just keep it in the page, so its not bounded by anything and keep the text consistent, also we need a forgot password."

1. **No box.** The form has no border, background or shadow. It sits on the backdrop in a 360 px column, left aligned like the front page's hero, with the hero's heading weight and tracking.
2. **Three text sizes.** Heading, body (lead, fields, buttons, the switch line) and small (labels, links beside a field, hints, errors, messages), set once in `flow.css`. Colours are the front page's text, muted and faint.
3. **Legal links at the bottom.** The legal links and "Research and education only. Not investment advice." sit at the very bottom of the screen, small and grey, underlined only on hover or focus. The form growing never moves them.
4. **Forgot password.** "Forgot password?" now shows on the first step, under Continue, as well as beside the password field. It opens the reset form with the email already typed. After sending, the form says "Check your email"; the code from the email still works there.

### Google, Apple, phone and passkeys

The owner asked whether these are options. All four are possible with Supabase Auth. Owner steps for each are in [auth/PROVIDERS.md](../../auth/PROVIDERS.md). Nothing has been switched on or created.

| Option | Possible | Cost | What the owner does |
| --- | --- | --- | --- |
| Continue with Google | Yes | Free | Make a Google Cloud web OAuth client with the Supabase callback, paste it into Supabase, add `google` to `AUTH_PROVIDERS` |
| Sign in with Apple | Yes | $99 a year (Apple Developer Program) | Make a Services ID and a key, paste the secret into Supabase, renew the secret every 6 months, add `apple` to `AUTH_PROVIDERS` |
| Phone number | Yes | About $0.012 to $0.013 per US text (Twilio) or about $0.058 per code (Twilio Verify), plus US texting registration | Open Twilio, enter it in Supabase, turn on CAPTCHA, then ask for the phone form to be built |
| Passkeys, so Face ID and Touch ID | Yes, experimental in Supabase | Free | Turn on Passkeys in Supabase with the ID `parity.endyland.com`, set `AUTH_PASSKEYS=on` |

The Google, Apple and passkey buttons are already built and hidden behind those settings, so turning one on is a configuration change. The phone form is not built.

## Update 2026-10-25: Linear-style motion, a strength bar and a welcome

The owner, on 25 October 2026: "let's have Linear type of animations when onboarding or signing in, and also how it fades in, very modern and what we want, also with this animation for checking if the password meets our standards, use what we did on useargus.co page with the bar underneath."

**What Linear does (observed on linear.app/login, 25 October 2026).** The logo stays still. Each step's content fades in from 10 px above over 300 ms after a 200 ms pause, on a soft ease-out curve. "Continue with email" swaps the buttons for the email field in place, with the same fade, and the field gets a soft coloured focus ring. Nothing else moves.

1. **Entrances.** Each step's parts blur and rise in one after another: the heading, the line under it, each field, the button, then the links under the form, about 50 ms apart. Each part rises 10 px, clears a 5 px blur and fades in over 0.5 s on a short spring (`cubic-bezier(.16, 1, .3, 1)`). On the front page the parts wait until the page behind has faded.
2. **Steps.** When a step is replaced (email to password, password to "Check your email", log in to reset), the old step slides up 8 px, blurs and fades out over 0.22 s while the new one rises in. The panel's height follows on the same spring, so nothing jumps. The leaving copy is hidden from screen readers and the keyboard.
3. **Fields and buttons.** A focused field gets a soft white glow. Buttons shrink slightly while pressed.
4. **Success.** After a good log in, code or new password, the pressed button's label turns into a check and the panel blurs and fades out, then the next page loads (0.42 s in all).
5. **Strength bar.** Under a new password: four segments that fill from the left and turn red, amber, yellow-green, then green as the password gets stronger, with the word beside them (Too weak, Easy to guess, Fair, Good, Strong). The rules (at least 10 characters, a letter, a number) still decide what is allowed; each one ticks with a small pop when met. The strength counts length (14 and 20 characters each add a step) and kinds of character (3 or more adds a step), and marks common words, runs like abcdef or 123456, a few characters repeated, and the email's name as easy to guess. Screen readers hear "Password strength: Good" when it changes. It shows on sign up, reset password and Account, Change password. The pattern is ported from the owner's other site; the code, colours and words are Parity's.
6. **Welcome.** A new account sees three short steps before the app: what Parity does, what they want to do first (any of five picks, kept in this browser only), then Verify or Parity Trade, ordered by the picks. "Skip for now" on every step, and the last step's "Go to the app", go to `next` as before. People with an authenticator app get that step instead.
7. **Reduced motion.** No entrances, no sliding steps, no check animation, no delay before the next page.
8. **Checks.** `npm run auth:motion` records each scene at 1440 by 900 and 390 by 844 with every Supabase request stubbed, and checks the stagger, the leaving step, the bar, the announcement, the welcome, the success fade and reduced motion. The layout shift audit stays at 0.000 on the front page and every sign-in page.

## Alternatives considered

- **A cross-document fade to separate pages.** That is what DEC-0039 did. The page still reloaded and the background was drawn again.
- **Keep the orbs on the sign-in view.** Rejected: the owner asked for none.
- **Password and email on one screen with a Password / Email code switch.** Rejected for email first, as Clerk, Linear, Vercel, Stripe and Ramp do. It is one decision per screen and leaves room for providers later.

## Consequences

- Account and Security settings inside the app still use `src/auth/form.tsx` and `auth.css`, unchanged.
- The front page loads the panel's code only when someone points at, focuses or clicks Log in or Sign up, so its first paint is unchanged.

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

- [DEC-0049: The desktop app opens on the log-in page, with a menu button and its own controls](0049-the-desktop-app-opens-on-the-log-in-page-with-a-menu-button-and-its-own-controls.md)
- [LOG-0019: Work log for 24 and 25 October](../log/2026-10-25-work-log-for-24-and-25-october.md)
<!-- backlinks:end -->
