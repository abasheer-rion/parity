// The business pages' script (DEC-0087): the "Start a free 30-day pilot" form, a dialog the
// build writes into each page (plugins/business.ts), opened by any [data-pilot] link or by
// #pilot in the address. Without this script those links are plain emails to
// contact@paritytrading.app. Also loads the cookie notice.
import "../legal/notice";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "../auth/config";
import { isFreeMail, sendPilot, validate, type FieldError, type PilotForm, type PilotKind } from "../lib/screen/pilot";

const FIELDS = ["firm", "name", "email", "volume", "message"] as const;
const dialog = document.querySelector<HTMLDialogElement>("dialog.bz-dialog");
const kind = (document.body.dataset.kind as PilotKind | undefined) ?? "prop_firm";

if (dialog) {
  const form = dialog.querySelector("form")!;
  const status = dialog.querySelector<HTMLElement>("[data-status]")!;
  const submit = form.querySelector<HTMLButtonElement>("button[type=submit]")!;
  let opener: HTMLElement | null = null;
  dialog.querySelector("[data-close]")?.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (ev) => { if (ev.target === dialog) dialog.close(); });
  dialog.addEventListener("close", () => opener?.focus());

  const open = (from: HTMLElement | null) => {
    opener = from;
    submit.hidden = false;
    status.textContent = "";
    dialog.showModal();
    form.querySelector<HTMLInputElement>("[name=firm]")?.focus();
  };
  for (const a of document.querySelectorAll<HTMLElement>("[data-pilot]")) {
    a.setAttribute("aria-haspopup", "dialog");
    a.addEventListener("click", (ev) => { ev.preventDefault(); open(a); });
  }
  if (location.hash === "#pilot") open(null);

  const val = (n: string) => ((form.elements.namedItem(n) as HTMLInputElement | null)?.value ?? "");
  const show = (errors: FieldError) => {
    for (const k of FIELDS) {
      const input = form.elements.namedItem(k) as HTMLElement;
      const msg = dialog.querySelector<HTMLElement>(`#pilot-${k}-e`);
      if (msg) msg.textContent = errors[k] ?? "";
      if (errors[k]) input.setAttribute("aria-invalid", "true"); else input.removeAttribute("aria-invalid");
    }
  };

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const f: PilotForm = { kind, firm: val("firm"), name: val("name"), email: val("email"), volume: val("volume"), message: val("message"), page: location.pathname };
    const errors = validate(f);
    show(errors);
    const first = FIELDS.find((k) => errors[k]);
    if (first) { (form.elements.namedItem(first) as HTMLElement).focus(); return; }
    status.className = "bz-status";
    // A filled hidden field means a script, not a person: say thanks and send nothing.
    if (val("website")) { status.className = "bz-status ok"; status.textContent = "Thanks. We will be in touch by email."; return; }
    submit.disabled = true;
    status.textContent = "Sending.";
    const r = await sendPilot(f, { url: SUPABASE_URL, key: SUPABASE_PUBLISHABLE_KEY });
    submit.disabled = false;
    if (r.ok) {
      status.className = "bz-status ok";
      status.textContent = `Thanks, ${f.name.trim().split(/\s+/)[0]}. We have your request and will reply to ${f.email.trim()}.${isFreeMail(f.email) ? " A work email helps us find your firm." : ""}`;
      form.reset();
      submit.hidden = true;
    } else {
      status.className = "bz-status err";
      status.textContent = r.reason === "rate_limited"
        ? "Too many requests from here in the last hour. Try later, or email contact@paritytrading.app."
        : r.reason === "invalid"
        ? "Something in the form was not accepted. Check each field, or email contact@paritytrading.app."
        : "We could not send it. Check your connection and try again, or email contact@paritytrading.app.";
    }
  });
}
