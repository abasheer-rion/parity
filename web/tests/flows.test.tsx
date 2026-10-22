// The sign-in flows end to end in the browser code, against a fake Supabase client:
// sign up, verify (code and link), log in with and without an authenticator app, forgot
// and reset password, resend, sign out, and the guard for /app/, /research/ and /sim/.
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authError, fakeSession, makeSupabase } from "./mockSupabase";

const h = vi.hoisted(() => ({ supabase: null as unknown as ReturnType<typeof import("./mockSupabase").makeSupabase>, go: vi.fn(), goPush: vi.fn() }));

vi.mock("../src/auth/client", async () => {
  const { explain } = await import("../src/auth/errors");
  return { supabase: new Proxy({}, { get: (_t, k) => (h.supabase as unknown as Record<string | symbol, unknown>)[k] }), requireClient: () => h.supabase, explain };
});
vi.mock("../src/auth/nav", () => ({ go: (p: string) => h.go(p), goPush: (p: string) => h.goPush(p) }));

const { SignIn } = await import("../src/auth/pages/SignIn");
const { SignUp } = await import("../src/auth/pages/SignUp");
const { Reset } = await import("../src/auth/pages/Reset");
const { Verify } = await import("../src/auth/pages/Verify");
const { AppGuard } = await import("../src/auth/AuthGate");
const { signOut } = await import("../src/auth/session");

function at(path: string, host = "https://parity.endyland.com") {
  window.history.replaceState({}, "", new URL(path, host).pathname + new URL(path, host).search + new URL(path, host).hash);
}
const type = (label: string | RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const click = (name: string | RegExp) => fireEvent.click(screen.getByRole("button", { name }));

beforeEach(() => {
  h.supabase = makeSupabase();
  h.go.mockReset();
  h.goPush.mockReset();
});
afterEach(() => cleanup());

describe("log in", () => {
  it("goes to a safe next after the password is right", async () => {
    at("/login/?next=%2Fresearch%2F%23%2Fdocs");
    render(<SignIn />);
    await screen.findByRole("heading", { name: "Log in to Parity" });
    type("Email", "amanda@example.com");
    type("Password", "correct horse 42");
    click("Log in");
    await waitFor(() => expect(h.go).toHaveBeenCalledWith("/research/#/docs"));
    expect(h.supabase.auth.signInWithPassword).toHaveBeenCalledWith({ email: "amanda@example.com", password: "correct horse 42" });
  });

  it("ignores a next that points at another site", async () => {
    at("/login/?next=https%3A%2F%2Fevil.com%2F");
    render(<SignIn />);
    await screen.findByRole("heading", { name: "Log in to Parity" });
    type("Email", "amanda@example.com");
    type("Password", "correct horse 42");
    click("Log in");
    await waitFor(() => expect(h.go).toHaveBeenCalledWith("/app/"));
  });

  it("returns to Sim World on its own host", async () => {
    at("/login/?next=https%3A%2F%2Fsim.endyland.com%2Fsim%2F");
    render(<SignIn />);
    await screen.findByRole("heading", { name: "Log in to Parity" });
    type("Email", "amanda@example.com");
    type("Password", "correct horse 42");
    click("Log in");
    await waitFor(() => expect(h.go).toHaveBeenCalledWith("https://sim.endyland.com/sim/"));
  });

  it("shows a plain message for a wrong password and does not navigate", async () => {
    at("/login/");
    h.supabase.auth.signInWithPassword.mockResolvedValueOnce({ data: { session: null, user: null }, error: authError("invalid_credentials") } as never);
    render(<SignIn />);
    await screen.findByRole("heading", { name: "Log in to Parity" });
    type("Email", "amanda@example.com");
    type("Password", "wrong password 1");
    click("Log in");
    expect(await screen.findByRole("alert")).toHaveTextContent("That email and password do not match.");
    expect(h.go).not.toHaveBeenCalled();
  });

  it("checks the email before calling Supabase", async () => {
    at("/login/");
    render(<SignIn />);
    await screen.findByRole("heading", { name: "Log in to Parity" });
    type("Email", "amanda");
    type("Password", "x");
    click("Log in");
    expect(await screen.findByRole("alert")).toHaveTextContent("Enter a full email address");
    expect(h.supabase.auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it("sends unconfirmed accounts to the check-your-email screen, keeping next", async () => {
    at("/login/?next=%2Fsim%2F");
    h.supabase.auth.signInWithPassword.mockResolvedValueOnce({ data: { session: null, user: null }, error: authError("email_not_confirmed") } as never);
    render(<SignIn />);
    await screen.findByRole("heading", { name: "Log in to Parity" });
    type("Email", "amanda@example.com");
    type("Password", "correct horse 42");
    click("Log in");
    await waitFor(() => expect(h.go).toHaveBeenCalledWith("/signup/?check=amanda%40example.com&next=%2Fsim%2F"));
  });

  it("asks for the authenticator code when the account has one, then continues", async () => {
    at("/login/?next=%2Fresearch%2F");
    h.supabase.auth.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({ data: { currentLevel: "aal1", nextLevel: "aal2" }, error: null } as never);
    h.supabase.auth.mfa.listFactors.mockResolvedValue({ data: { all: [], totp: [{ id: "f1", status: "verified" }] }, error: null } as never);
    render(<SignIn />);
    await screen.findByRole("heading", { name: "Log in to Parity" });
    type("Email", "amanda@example.com");
    type("Password", "correct horse 42");
    click("Log in");
    await screen.findByRole("heading", { name: "Two-step sign-in" });
    expect(h.go).not.toHaveBeenCalled();
    type("Authenticator code", "123456");
    click("Continue");
    await waitFor(() => expect(h.go).toHaveBeenCalledWith("/research/"));
    expect(h.supabase.auth.mfa.challengeAndVerify).toHaveBeenCalledWith({ factorId: "f1", code: "123456" });
  });

  it("keeps you on the second step when the authenticator code is wrong", async () => {
    at("/login/?mfa=1");
    h.supabase.auth.mfa.listFactors.mockResolvedValue({ data: { all: [], totp: [{ id: "f1", status: "verified" }] }, error: null } as never);
    h.supabase.auth.mfa.challengeAndVerify.mockResolvedValueOnce({ data: null, error: authError("mfa_verification_failed") } as never);
    render(<SignIn />);
    type("Authenticator code", "000000");
    click("Continue");
    expect(await screen.findByRole("alert")).toHaveTextContent("That code is wrong");
    expect(h.go).not.toHaveBeenCalled();
  });

  it("logs in with an emailed code", async () => {
    at("/login/");
    render(<SignIn />);
    await screen.findByRole("heading", { name: "Log in to Parity" });
    fireEvent.click(screen.getByRole("radio", { name: "Email code" }));
    type("Email", "amanda@example.com");
    click("Email me a code");
    await screen.findByLabelText("Code");
    expect(h.supabase.auth.signInWithOtp).toHaveBeenCalledWith({ email: "amanda@example.com", options: { shouldCreateUser: false, emailRedirectTo: "https://parity.endyland.com/app/" } });
    type("Code", "654321");
    click("Log in");
    await waitFor(() => expect(h.go).toHaveBeenCalledWith("/app/"));
    expect(h.supabase.auth.verifyOtp).toHaveBeenCalledWith({ email: "amanda@example.com", token: "654321", type: "email" });
  });

  it("carries on at once when already signed in", async () => {
    at("/login/?next=%2Fsim%2F");
    h.supabase.setSession(fakeSession());
    render(<SignIn />);
    await waitFor(() => expect(h.go).toHaveBeenCalledWith("/sim/"));
  });

  it("keeps next on the links to sign up and reset", async () => {
    at("/login/?next=%2Fsim%2F");
    render(<SignIn />);
    await screen.findByRole("heading", { name: "Log in to Parity" });
    expect(screen.getByRole("link", { name: "Create an account" })).toHaveAttribute("href", "/signup/?next=%2Fsim%2F");
    expect(screen.getByRole("link", { name: "Forgot your password?" })).toHaveAttribute("href", "/reset/?next=%2Fsim%2F");
  });

  it("shows and hides the password", async () => {
    at("/login/");
    render(<SignIn />);
    await screen.findByRole("heading", { name: "Log in to Parity" });
    const input = screen.getByLabelText("Password") as HTMLInputElement;
    expect(input.type).toBe("password");
    click("Show password");
    expect(input.type).toBe("text");
    expect(screen.getByRole("button", { name: "Hide password" })).toHaveAttribute("aria-pressed", "true");
  });
});

describe("sign up and verify", () => {
  it("refuses a weak password without calling Supabase", async () => {
    at("/signup/");
    render(<SignUp />);
    type("Email", "amanda@example.com");
    type("Password", "short");
    fireEvent.click(screen.getByRole("checkbox"));
    click("Create account");
    expect(await screen.findByRole("alert")).toHaveTextContent("Use at least 10 characters.");
    expect(h.supabase.auth.signUp).not.toHaveBeenCalled();
  });

  it("asks for agreement to the terms", async () => {
    at("/signup/");
    render(<SignUp />);
    type("Email", "amanda@example.com");
    type("Password", "correct horse 42");
    click("Create account");
    expect(await screen.findByRole("alert")).toHaveTextContent("agree to the terms");
    expect(h.supabase.auth.signUp).not.toHaveBeenCalled();
  });

  it("ends on check-your-email, with the email link coming back to where you started", async () => {
    at("/signup/?next=%2Fresearch%2F");
    render(<SignUp />);
    type("Email", "amanda@example.com");
    type("Password", "correct horse 42");
    fireEvent.click(screen.getByRole("checkbox"));
    click("Create account");
    await screen.findByRole("heading", { name: "Check your email" });
    expect(h.supabase.auth.signUp).toHaveBeenCalledWith({
      email: "amanda@example.com",
      password: "correct horse 42",
      options: { emailRedirectTo: "https://parity.endyland.com/research/" },
    });
  });

  it("confirms with the 6-digit code, then lands in the app", async () => {
    at("/signup/?check=amanda%40example.com&next=%2Fresearch%2F");
    render(<SignUp />);
    type("Code from the email", "123456");
    click("Confirm email");
    await waitFor(() => expect(h.go).toHaveBeenCalledWith("/research/"));
    expect(h.supabase.auth.verifyOtp).toHaveBeenCalledWith({ email: "amanda@example.com", token: "123456", type: "signup" });
  });

  it("resends the confirmation email", async () => {
    at("/signup/?check=amanda%40example.com");
    render(<SignUp />);
    click("Send the email again");
    expect(await screen.findByText(/Sent again/)).toBeTruthy();
    expect(h.supabase.auth.resend).toHaveBeenCalledWith({ type: "signup", email: "amanda@example.com", options: { emailRedirectTo: "https://parity.endyland.com/app/" } });
  });

  it("goes straight in when confirmation is off", async () => {
    at("/signup/?next=%2Fsim%2F");
    h.supabase.auth.signUp.mockResolvedValueOnce({ data: { session: fakeSession(), user: { id: "u1" } }, error: null } as never);
    render(<SignUp />);
    type("Email", "amanda@example.com");
    type("Password", "correct horse 42");
    fireEvent.click(screen.getByRole("checkbox"));
    click("Create account");
    await waitFor(() => expect(h.go).toHaveBeenCalledWith("/sim/"));
  });

  it("verifies an email link after one click and follows its next", async () => {
    at("/verify/?type=email&token_hash=abc&next=https%3A%2F%2Fsim.endyland.com%2Fsim%2F");
    render(<Verify />);
    expect(h.supabase.auth.verifyOtp).not.toHaveBeenCalled();
    click("Confirm and continue");
    await waitFor(() => expect(h.go).toHaveBeenCalledWith("https://sim.endyland.com/sim/"));
    expect(h.supabase.auth.verifyOtp).toHaveBeenCalledWith({ type: "email", token_hash: "abc" });
  });

  it("falls back to the app when an email link's next is the bare site address", async () => {
    at("/verify/?type=email&token_hash=abc&next=https%3A%2F%2Fparity.endyland.com");
    render(<Verify />);
    click("Confirm and continue");
    await waitFor(() => expect(h.go).toHaveBeenCalledWith("/app/"));
  });

  it("explains an expired link", async () => {
    at("/verify/?type=email&token_hash=abc");
    h.supabase.auth.verifyOtp.mockResolvedValueOnce({ data: { session: null, user: null }, error: authError("otp_expired") } as never);
    render(<Verify />);
    click("Confirm and continue");
    expect(await screen.findByRole("alert")).toHaveTextContent("expired");
    expect(h.go).not.toHaveBeenCalled();
  });

  it("says when a link is incomplete", () => {
    at("/verify/?type=email");
    render(<Verify />);
    expect(screen.getByRole("heading", { name: "This link is not complete" })).toBeTruthy();
  });
});

describe("forgot and reset password", () => {
  it("emails a reset link and code, returning to next", async () => {
    at("/reset/?next=%2Fresearch%2F");
    render(<Reset session={{ loading: false, session: null }} />);
    type("Email", "amanda@example.com");
    click("Send reset email");
    await screen.findByLabelText("Code from the email");
    expect(h.supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith("amanda@example.com", { redirectTo: "https://parity.endyland.com/research/" });
  });

  it("opens the reset page from a recovery link, keeping next", async () => {
    at("/verify/?type=recovery&token_hash=abc&next=https%3A%2F%2Fparity.endyland.com%2Fresearch%2F");
    render(<Verify />);
    click("Continue");
    await waitFor(() => expect(h.go).toHaveBeenCalledWith("/reset/?next=%2Fresearch%2F"));
  });

  it("saves a new password and continues", async () => {
    at("/reset/?next=%2Fresearch%2F");
    render(<Reset session={{ loading: false, session: fakeSession() as never }} />);
    await screen.findByRole("heading", { name: "Choose a new password" });
    type("New password", "new password 42");
    type("Type it again", "new password 42");
    click("Save password");
    await waitFor(() => expect(h.go).toHaveBeenCalledWith("/research/"));
    expect(h.supabase.auth.updateUser).toHaveBeenCalledWith({ password: "new password 42" });
  });

  it("catches two passwords that differ", async () => {
    at("/reset/");
    render(<Reset session={{ loading: false, session: fakeSession() as never }} />);
    await screen.findByRole("heading", { name: "Choose a new password" });
    type("New password", "new password 42");
    type("Type it again", "new password 43");
    click("Save password");
    expect(await screen.findByRole("alert")).toHaveTextContent("do not match");
    expect(h.supabase.auth.updateUser).not.toHaveBeenCalled();
  });

  it("asks for an emailed code when Supabase wants proof", async () => {
    at("/reset/");
    h.supabase.auth.updateUser
      .mockResolvedValueOnce({ data: { user: null }, error: authError("reauthentication_needed") } as never)
      .mockResolvedValueOnce({ data: { user: {} }, error: null } as never);
    render(<Reset session={{ loading: false, session: fakeSession() as never }} />);
    await screen.findByRole("heading", { name: "Choose a new password" });
    type("New password", "new password 42");
    type("Type it again", "new password 42");
    click("Save password");
    await screen.findByLabelText("Code from the email");
    expect(h.supabase.auth.reauthenticate).toHaveBeenCalled();
    type("Code from the email", "111222");
    click("Save password");
    await waitFor(() => expect(h.go).toHaveBeenCalledWith("/app/"));
    expect(h.supabase.auth.updateUser).toHaveBeenLastCalledWith({ password: "new password 42", nonce: "111222" });
  });

  it("asks for the authenticator code first when the account has one", async () => {
    at("/reset/");
    h.supabase.auth.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({ data: { currentLevel: "aal1", nextLevel: "aal2" }, error: null } as never);
    render(<Reset session={{ loading: false, session: fakeSession() as never }} />);
    expect(await screen.findByRole("heading", { name: "Confirm it is you" })).toBeTruthy();
  });
});

describe("the app guard", () => {
  const app = () => render(<AppGuard>{(u) => <p>Hello {u.email}</p>}</AppGuard>);

  it.each([
    ["/app/#/watchlist", "/login/?next=%2Fapp%2F%23%2Fwatchlist"],
    ["/research/#/docs", "/login/?next=%2Fresearch%2F%23%2Fdocs"],
    ["/sim/", "/login/?next=%2Fsim%2F"],
  ])("%s sends signed-out people to log in and back", async (path, login) => {
    at(path);
    app();
    await waitFor(() => expect(h.go).toHaveBeenCalledWith(login));
    expect(screen.queryByText(/Hello/)).toBeNull();
  });

  it.each(["/app/", "/research/", "/sim/"])("%s asks for the second step when it is pending", async (path) => {
    at(path);
    h.supabase.setSession(fakeSession());
    h.supabase.auth.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({ data: { currentLevel: "aal1", nextLevel: "aal2" }, error: null } as never);
    app();
    const want = path === "/app/" ? "/login/?mfa=1" : `/login/?mfa=1&next=${encodeURIComponent(path)}`;
    await waitFor(() => expect(h.go).toHaveBeenCalledWith(want));
  });

  it.each(["/app/", "/research/", "/sim/"])("%s shows the app when signed in", async (path) => {
    at(path);
    h.supabase.setSession(fakeSession());
    app();
    expect(await screen.findByText("Hello amanda@example.com")).toBeTruthy();
    expect(h.go).not.toHaveBeenCalled();
  });

  it("leaves when the person signs out in another tab", async () => {
    at("/research/");
    h.supabase.setSession(fakeSession());
    app();
    await screen.findByText("Hello amanda@example.com");
    act(() => h.supabase.setSession(null));
    await waitFor(() => expect(h.go).toHaveBeenCalledWith("/login/?next=%2Fresearch%2F"));
  });
});

describe("sign out", () => {
  it("clears the local session even if the server cannot be reached", async () => {
    h.supabase.auth.signOut
      .mockResolvedValueOnce({ error: authError("request_timeout") } as never)
      .mockResolvedValueOnce({ error: null } as never);
    await signOut();
    expect(h.supabase.auth.signOut).toHaveBeenLastCalledWith({ scope: "local" });
    expect(h.goPush).toHaveBeenCalledWith("/login/");
  });
});
