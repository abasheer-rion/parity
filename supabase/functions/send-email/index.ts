// Supabase Auth "Send Email" hook: Parity sends its own auth emails through Resend.
//
// Supabase calls this function instead of its SMTP sender. We check the call is really from
// Supabase (Standard Webhooks signature with the hook secret), pick the email for the action,
// fill in every value, and send it through Resend with the logo attached inline by Content-ID,
// so it shows without "download images". The templates come from auth/emails (auth/build.py
// writes templates.ts and logo.ts here). Supabase SMTP (Resend SMTP) stays configured: turning
// the hook off with auth/send_email_hook.sh --off sends through it again at once.
//
// Secrets (Supabase Edge Function secrets, never in code):
//   SEND_EMAIL_HOOK_SECRET  "v1,whsec_<base64>", the same value saved on the hook
//   RESEND_API_KEY          Resend key allowed to send from paritytrading.app
// Optional settings:
//   PARITY_SITE_URL         where links point (default https://paritytrading.app)
//   PARITY_EMAIL_FROM       sender (default "Parity Trading <no-reply@paritytrading.app>")

import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";
import { LOGO_CID } from "./templates.ts";
import { compose, type EmailData, type HookUser, type Mail } from "./compose.ts";
import { LOGO_PNG_BASE64 } from "./logo.ts";

const FROM = Deno.env.get("PARITY_EMAIL_FROM") ?? "Parity Trading <no-reply@paritytrading.app>";

async function sendViaResend(mail: Mail, key: string, idempotencyKey: string): Promise<void> {
  const body = JSON.stringify({
    from: FROM,
    to: [mail.to],
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    attachments: [{ filename: "parity.png", content: LOGO_PNG_BASE64, content_type: "image/png", content_id: LOGO_CID }],
  });
  let last = "";
  // Supabase waits about 5 s for the hook, so retry quickly and only on a busy or failing Resend.
  for (const wait of [0, 400, 1200]) {
    if (wait) await new Promise((r) => setTimeout(r, wait));
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
      body,
    });
    if (res.ok) return;
    last = `Resend ${res.status}: ${(await res.text()).slice(0, 200)}`;
    if (res.status !== 429 && res.status < 500) break;
  }
  throw new Error(last);
}

const fail = (status: number, message: string) =>
  new Response(JSON.stringify({ error: { http_code: status, message } }), {
    status,
    headers: { "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method !== "POST") return fail(405, "POST only");
  const secret = Deno.env.get("SEND_EMAIL_HOOK_SECRET");
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!secret || !resendKey) return fail(500, "Email sender is not configured");
  const payload = await req.text();
  const headers = Object.fromEntries(req.headers);
  let user: HookUser, data: EmailData;
  try {
    ({ user, email_data: data } = new Webhook(secret.replace("v1,whsec_", "")).verify(payload, headers) as {
      user: HookUser;
      email_data: EmailData;
    });
  } catch {
    return fail(401, "Invalid signature");
  }
  try {
    const mails = compose(user, data);
    const id = headers["webhook-id"] ?? crypto.randomUUID();
    await Promise.all(mails.map((m, i) => sendViaResend(m, resendKey, `${id}-${i}`)));
    console.log(JSON.stringify({ sent: mails.length, action: data.email_action_type }));
    return new Response(JSON.stringify({}), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (e) {
    console.error(JSON.stringify({ failed: data.email_action_type, error: String(e).slice(0, 300) }));
    return fail(500, "We could not send the email. Try again in a minute.");
  }
});
