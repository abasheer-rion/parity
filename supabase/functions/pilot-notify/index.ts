// "Start a free 30-day pilot" (DEC-0087): emails contact@paritytrading.app when a firm asks.
//
// The business pages store the request themselves (public.pilot_requests, insert only, with a
// rate limit in the database), then call this function with the request's id. The function
// claims the row with claim_pilot_request(), which gives back each new row once and only in
// its first 15 minutes, and sends one plain email through Resend, the same sender as the auth
// emails (send-email). The reply-to is the firm's work email. The function holds no data and
// cannot read any other request.
//
// Secrets (Supabase Edge Function secrets, never in code):
//   RESEND_API_KEY          the Resend key the auth emails already use
// Set by Supabase: SUPABASE_URL. The publishable key comes in with the page's request.
// Optional: PILOT_NOTIFY_TO (default contact@paritytrading.app), PARITY_EMAIL_FROM.
// Deployed with verify_jwt off (the publishable key is not a JWT); it checks the origin.

const TO = Deno.env.get("PILOT_NOTIFY_TO") ?? "contact@paritytrading.app";
const FROM = Deno.env.get("PARITY_EMAIL_FROM") ?? "Parity Trading <no-reply@paritytrading.app>";
const ORIGIN_OK = /^https:\/\/([a-z0-9-]+\.)*paritytrading\.app$|^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const KIND: Record<string, string> = { prop_firm: "Prop firm", copy_trading: "Copy-trading platform", bot_marketplace: "Bot or signal marketplace", other: "Other" };
const VOLUME: Record<string, string> = { under_100: "Under 100", "100_1000": "100 to 1,000", "1000_10000": "1,000 to 10,000", over_10000: "Over 10,000" };

interface Row { kind: string; firm: string; name: string; email: string; accounts_per_month: string; message: string; page: string; created_at: string }

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function cors(origin: string | null): Record<string, string> {
  return origin && ORIGIN_OK.test(origin)
    ? { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "apikey, authorization, content-type, x-client-info", Vary: "Origin" }
    : {};
}

const reply = (status: number, body: unknown, headers: Record<string, string>) =>
  new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type": "application/json", "Cache-Control": "no-store" } });

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  const h = cors(origin);
  if (req.method === "OPTIONS") return new Response(null, { status: origin && ORIGIN_OK.test(origin) ? 204 : 403, headers: h });
  if (req.method !== "POST") return reply(405, { error: "POST only" }, h);
  if (!origin || !ORIGIN_OK.test(origin)) return reply(403, { error: "origin not allowed" }, h);
  const key = Deno.env.get("RESEND_API_KEY");
  const base = Deno.env.get("SUPABASE_URL");
  const apikey = req.headers.get("apikey") ?? "";
  if (!key || !base) return reply(503, { error: "not configured" }, h);
  let id = "";
  try {
    const body = await req.json() as { id?: unknown };
    id = typeof body.id === "string" ? body.id : "";
  } catch { /* falls through to the check below */ }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return reply(400, { error: "send the request id" }, h);

  const claim = await fetch(`${base}/rest/v1/rpc/claim_pilot_request`, {
    method: "POST",
    headers: { apikey, Authorization: `Bearer ${apikey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_id: id }),
  });
  if (!claim.ok) {
    console.error(JSON.stringify({ msg: "pilot claim failed", status: claim.status }));
    return reply(502, { error: "could not read the request" }, h);
  }
  const rows = await claim.json() as Row[];
  if (!rows.length) return reply(200, { sent: false }, h);
  const r = rows[0];
  const lines: [string, string][] = [
    ["Firm", r.firm], ["Name", r.name], ["Work email", r.email], ["Kind", KIND[r.kind] ?? r.kind],
    ["Accounts a month", VOLUME[r.accounts_per_month] ?? r.accounts_per_month], ["Page", r.page || "n/a"], ["Sent", r.created_at],
  ];
  const text = `A firm asked for a free 30-day pilot.\n\n${lines.map(([k, v]) => `${k}: ${v}`).join("\n")}\n\nMessage:\n${r.message || "(none)"}\n\nReply to this email to answer them. Every request is also in the pilot_requests table.`;
  const html = `<p>A firm asked for a free 30-day pilot.</p><table cellpadding="4">${lines.map(([k, v]) => `<tr><td><b>${esc(k)}</b></td><td>${esc(v)}</td></tr>`).join("")}</table><p><b>Message</b></p><p style="white-space:pre-wrap">${esc(r.message || "(none)")}</p><p>Reply to this email to answer them. Every request is also in the pilot_requests table.</p>`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Idempotency-Key": `pilot-${id}` },
    body: JSON.stringify({ from: FROM, to: [TO], reply_to: r.email, subject: `Pilot request: ${r.firm.slice(0, 80)} (${VOLUME[r.accounts_per_month] ?? r.accounts_per_month} accounts a month)`, text, html }),
  });
  if (!res.ok) {
    // The request stays stored; the team sees it in the table.
    console.error(JSON.stringify({ msg: "pilot email failed", status: res.status }));
    return reply(502, { sent: false, stored: true }, h);
  }
  console.log(JSON.stringify({ msg: "pilot email sent", kind: r.kind }));
  return reply(200, { sent: true }, h);
});
