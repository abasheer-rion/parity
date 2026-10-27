// What the Send Email hook sends: the template for each action, with every value filled in.
// Pure functions, tested by compose.test.ts (deno test).

import { TEMPLATES } from "./templates.ts";

const SITE_URL = (Deno.env.get("PARITY_SITE_URL") ?? "https://paritytrading.app").replace(/\/$/, "");

// Supabase's action name to our template name (auth/emails/<name>.html).
const ACTION_TO_TEMPLATE: Record<string, string> = {
  signup: "confirmation",
  magiclink: "magic_link",
  email: "magic_link",
  recovery: "recovery",
  invite: "invite",
  email_change: "email_change",
  reauthentication: "reauthentication",
};

// Security notices Supabase can send when they are switched on. Short and plain.
const NOTICES: Record<string, [string, string]> = {
  password_changed_notification: ["Your Parity password was changed", "The password on your Parity account was just changed."],
  email_changed_notification: ["Your Parity email was changed", "The email address on your Parity account was just changed."],
  phone_changed_notification: ["Your Parity phone number was changed", "The phone number on your Parity account was just changed."],
  identity_linked_notification: ["A sign-in method was added to Parity", "A new sign-in method was linked to your Parity account."],
  identity_unlinked_notification: ["A sign-in method was removed from Parity", "A sign-in method was removed from your Parity account."],
  mfa_factor_enrolled_notification: ["Two-step sign-in added on Parity", "A two-step sign-in method was added to your Parity account."],
  mfa_factor_unenrolled_notification: ["Two-step sign-in removed on Parity", "A two-step sign-in method was removed from your Parity account."],
};

export type EmailData = {
  token?: string;
  token_hash?: string;
  token_new?: string;
  token_hash_new?: string;
  redirect_to?: string;
  email_action_type: string;
  site_url?: string;
};
export type HookUser = { email?: string; new_email?: string };
export type Mail = { to: string; subject: string; html: string; text: string };

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** Fill every {{ .Value }} slot. Fails loudly on a slot we have no value for. */
export function render(template: string, values: Record<string, string>, html: boolean): string {
  return template.replace(/\{\{\s*\.([A-Za-z]+)\s*\}\}/g, (_m, name: string) => {
    if (!(name in values)) throw new Error(`no value for {{ .${name} }}`);
    return html ? escapeHtml(values[name]) : values[name];
  });
}

/** The emails one hook call sends: one, or two for a secure email change. */
export function compose(user: HookUser, data: EmailData, siteUrl = SITE_URL): Mail[] {
  const action = data.email_action_type;
  // `next` in our links is a whole address passed as one query value (Supabase encodes it the same way).
  const next = encodeURIComponent(data.redirect_to || siteUrl);
  const email = user.email ?? "";
  const newEmail = user.new_email ?? "";
  const key = ACTION_TO_TEMPLATE[action];
  if (!key) {
    const notice = NOTICES[action];
    if (!notice || !email) throw new Error(`no email for action ${action}`);
    return [noticeMail(email, notice[0], notice[1], siteUrl)];
  }
  const t = TEMPLATES[key];
  const make = (to: string, token: string, tokenHash: string): Mail => {
    const values = {
      SiteURL: siteUrl, Email: email, NewEmail: newEmail, Token: token, TokenHash: tokenHash,
      RedirectTo: next, ConfirmationURL: `${siteUrl}/verify/`,
    };
    return { to, subject: t.subject, html: render(t.html, values, true), text: render(t.text, values, false) };
  };
  if (action === "email_change") {
    // Supabase's names are crossed for backward compatibility: the current address gets
    // token + token_hash_new, the new address gets token_new + token_hash.
    if (data.token_hash_new && email) {
      return [
        make(email, data.token ?? "", data.token_hash_new),
        make(newEmail, data.token_new ?? "", data.token_hash ?? ""),
      ].filter((m) => m.to);
    }
    return [make(newEmail || email, data.token ?? "", data.token_hash ?? "")];
  }
  return [make(email, data.token ?? "", data.token_hash ?? "")];
}

function noticeMail(to: string, subject: string, line: string, siteUrl: string): Mail {
  // Reuse the frame of the reauthentication email, with the notice in place of its body.
  const frame = TEMPLATES.reauthentication.html;
  const open = frame.indexOf("<!--body-->") + "<!--body-->".length;
  const close = frame.indexOf("<!--/body-->");
  const body = `<p class="p-text" style="margin:0 0 14px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:24px;color:#141622;">${escapeHtml(line)}</p>` +
    `<p class="p-muted" style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:21px;color:#5b5f72;">Not you? Reset your password at <a class="p-link" href="${escapeHtml(siteUrl)}/reset/" style="color:#1F4FBF;">${escapeHtml(siteUrl.replace(/^https?:\/\//, ""))}/reset/</a>.</p>`;
  const html = open > 10 && close > open
    ? render(frame.slice(0, open) + body + frame.slice(close), { SiteURL: siteUrl, Email: to }, true)
    : `<p>${escapeHtml(line)}</p>`;
  const text = `${line}\nNot you? Reset your password at ${siteUrl}/reset/\n\n--\nSent to ${to} by Parity Trading (${siteUrl}).\n`;
  return { to, subject, html: html.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(subject)}</title>`), text };
}

