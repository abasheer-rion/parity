// deno test supabase/functions/send-email/compose.test.ts
import { assert, assertEquals } from "jsr:@std/assert@1";
import { compose } from "./compose.ts";
import { TEMPLATES } from "./templates.ts";

const user = { email: "amanda@example.com", new_email: "amanda.new@example.com" };
const base = { token: "482913", token_hash: "hashA", redirect_to: "https://sim.paritytrading.app/sim/" };
const actions = ["signup", "magiclink", "email", "recovery", "invite", "reauthentication"];

Deno.test("every template fills every value and shows the inline logo", () => {
  for (const action of actions) {
    const [m] = compose(user, { ...base, email_action_type: action }, "https://paritytrading.app");
    assertEquals(m.to, "amanda@example.com");
    for (const part of [m.html, m.text, m.subject]) assert(!part.includes("{{"), `${action}: unfilled slot`);
    assert(m.html.includes('src="cid:parity-logo"'), `${action}: no inline logo`);
    assert(!m.html.includes("https://paritytrading.app/email/"), `${action}: hosted logo used`);
  }
});

Deno.test("codes and links carry the token, hash and encoded next address", () => {
  const [m] = compose(user, { ...base, email_action_type: "signup" }, "https://paritytrading.app");
  assert(m.html.includes("482913"));
  assert(m.html.includes("token_hash=hashA&amp;next=https%3A%2F%2Fsim.paritytrading.app%2Fsim%2F"));
  assert(m.text.includes("token_hash=hashA&next=https%3A%2F%2Fsim.paritytrading.app%2Fsim%2F"));
});

Deno.test("secure email change sends two emails with the crossed token pairs", () => {
  const mails = compose(user, { ...base, token_new: "777111", token_hash_new: "hashB", email_action_type: "email_change" }, "https://x.test");
  assertEquals(mails.map((m) => m.to), ["amanda@example.com", "amanda.new@example.com"]);
  assert(mails[0].html.includes("token_hash=hashB") && mails[0].html.includes("482913"));
  assert(mails[1].html.includes("token_hash=hashA") && mails[1].html.includes("777111"));
  assert(mails[0].html.includes("amanda.new@example.com"));
});

Deno.test("a notice uses the same frame", () => {
  const [m] = compose(user, { email_action_type: "password_changed_notification" }, "https://paritytrading.app");
  assertEquals(m.subject, "Your Parity password was changed");
  assert(m.html.includes("cid:parity-logo") && !m.html.includes("{{"));
});

Deno.test("there is one template per action", () => {
  assertEquals(Object.keys(TEMPLATES).sort(), ["confirmation", "email_change", "invite", "magic_link", "reauthentication", "recovery"]);
});
