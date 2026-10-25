---
id: DEC-0044
title: One sign-in panel that fades in over the front page
type: decision
status: accepted
created: 2026-10-24
updated: 2026-10-24
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
4. **The steps.** Email, then password (with "Forgot your password?" beside its label and "Email me a code instead" under it) or a one-time code. Sign up: email, then a password with its rules and the terms, then "Check your email". The email typed carries between forms. A hidden username field keeps password managers matching the right account. No provider buttons show until one is switched on ([auth/PROVIDERS.md](../../auth/PROVIDERS.md)).
5. **One look.** `web/src/site/kit.css` holds the colours, backdrop, glass, corner logo and `.btn`. The build inlines it on the front page and on the four sign-in pages (`<!--site-kit-->`), so the panel's buttons are the hero's buttons and the first frame is already dark.
6. **Accessibility.** On the front page the panel is a modal dialog: the page behind it is hidden from screen readers and the keyboard, focus moves to the first field on open and back to the link that opened it on close, and Escape closes it. Errors are announced and linked to their field. Reduced motion turns every fade, rise and height change off.
7. **Behaviour unchanged.** Every Supabase call, the email confirmation, the code, the reset, the authenticator step, the cookie on `.endyland.com`, the error wording and the safe `next` stay as they were. Two hops now happen in place: an unconfirmed log-in opens "Check your email", and a reset or invite link opens the new-password form.
8. **Checks.** `npm test` covers the flows; `npm run auth:panel` drives the panel in a browser with every Supabase request stubbed; `npm run auth:shots` writes screenshots; the layout shift audit now includes the front page, `/#login`, `/#signup` and the sign-in pages.

## Alternatives considered

- **A cross-document fade to separate pages.** That is what DEC-0039 did. The page still reloaded and the background was drawn again.
- **Keep the orbs on the sign-in view.** Rejected: the owner asked for none.
- **Password and email on one screen with a Password / Email code switch.** Rejected for email first, as Clerk, Linear, Vercel, Stripe and Ramp do. It is one decision per screen and leaves room for providers later.

## Consequences

- Account and Security settings inside the app still use `src/auth/form.tsx` and `auth.css`, unchanged.
- The front page loads the panel's code only when someone points at, focuses or clicks Log in or Sign up, so its first paint is unchanged.

<!-- backlinks:start (generated by scripts/docs.py) -->
## Referenced by

Nothing links here yet.
<!-- backlinks:end -->
