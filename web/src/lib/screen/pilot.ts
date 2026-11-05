// "Start a free 30-day pilot" (DEC-0087): checking the form and sending it. The request goes
// straight into public.pilot_requests with the publishable key (insert only; the database
// keeps a rate limit and hides the table from everyone but the team), then the pilot-notify
// Edge Function emails contact@paritytrading.app. If that email fails the request is still
// stored, so the person is told it was received.

export type PilotKind = "prop_firm" | "copy_trading" | "bot_marketplace" | "other";
export const VOLUMES = [
  ["under_100", "Under 100"],
  ["100_1000", "100 to 1,000"],
  ["1000_10000", "1,000 to 10,000"],
  ["over_10000", "Over 10,000"],
] as const;
export type Volume = (typeof VOLUMES)[number][0];

export interface PilotForm { kind: PilotKind; firm: string; name: string; email: string; volume: string; message: string; page: string }

export type FieldError = Partial<Record<"firm" | "name" | "email" | "volume" | "message", string>>;

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
/** Free mail hosts: a work email is asked for, so these get a gentle note, not a refusal. */
const FREE_MAIL = /@(gmail|googlemail|yahoo|hotmail|outlook|live|icloud|me|aol|proton|protonmail|gmx|yandex|mail)\.[a-z.]+$/i;

export function validate(f: PilotForm): FieldError {
  const e: FieldError = {};
  if (!f.firm.trim()) e.firm = "Enter the firm's name.";
  else if (f.firm.trim().length > 120) e.firm = "Use at most 120 characters.";
  if (!f.name.trim()) e.name = "Enter your name.";
  else if (f.name.trim().length > 120) e.name = "Use at most 120 characters.";
  if (!EMAIL.test(f.email.trim()) || f.email.trim().length > 254) e.email = "Enter an email address, like name@firm.com.";
  if (!VOLUMES.some(([v]) => v === f.volume)) e.volume = "Choose about how many accounts a month.";
  if (f.message.length > 2000) e.message = "Use at most 2,000 characters.";
  return e;
}

export const isFreeMail = (email: string) => FREE_MAIL.test(email.trim());

export interface SendDeps { url: string; key: string; fetch?: typeof fetch; uuid?: () => string }

export type SendResult = { ok: true; emailed: boolean } | { ok: false; reason: "rate_limited" | "invalid" | "network" };

export async function sendPilot(f: PilotForm, d: SendDeps): Promise<SendResult> {
  const f$ = d.fetch ?? fetch;
  const id = (d.uuid ?? (() => crypto.randomUUID()))();
  const headers = { apikey: d.key, Authorization: `Bearer ${d.key}`, "Content-Type": "application/json" };
  let res: Response;
  try {
    res = await f$(`${d.url}/rest/v1/pilot_requests`, {
      method: "POST",
      headers: { ...headers, Prefer: "return=minimal" },
      body: JSON.stringify({ id, kind: f.kind, firm: f.firm.trim(), name: f.name.trim(), email: f.email.trim(), accounts_per_month: f.volume, message: f.message.trim(), page: f.page.slice(0, 200) }),
    });
  } catch {
    return { ok: false, reason: "network" };
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, reason: /rate_limited/.test(text) ? "rate_limited" : res.status >= 500 ? "network" : "invalid" };
  }
  try {
    const n = await f$(`${d.url}/functions/v1/pilot-notify`, { method: "POST", headers, body: JSON.stringify({ id }) });
    const body = (await n.json().catch(() => ({}))) as { sent?: boolean };
    return { ok: true, emailed: n.ok && body.sent === true };
  } catch {
    return { ok: true, emailed: false };
  }
}
